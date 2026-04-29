from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from aiohttp import ClientSession, ClientTimeout, web
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import CallbackQuery, Message

from .channel_sync import sync_public_channel
from .config import Settings, load_settings
from .keyboards import admin_panel, start_menu
from .storage import load_movies, load_users, parse_movie_caption, search_movies, upsert_movie, upsert_user
from .webserver import create_web_app


router = Router()


def _is_admin(user_id: int | None, admin_ids: set[int]) -> bool:
    return bool(user_id and user_id in admin_ids)


def _normalize_menu_text(text: str | None) -> str:
    cleaned = "".join(ch if ch.isalnum() else " " for ch in (text or "").casefold())
    return " ".join(cleaned.split())


def _menu_action(text: str | None) -> str | None:
    normalized = _normalize_menu_text(text)
    if normalized == "admin panel":
        return "admin"
    if normalized == "qidirish":
        return "search"
    if normalized in {"bog lanish", "boglanish"}:
        return "contact"
    if normalized in {"murojaat qoldiring", "murojaat qoldirish"}:
        return "feedback"
    if normalized in {"kino korish", "kino ko rish", "kinolar"}:
        return "watch"
    if normalized in {
        "profilga kirish",
        "profilim",
        "oxirgi korilgan kino",
        "oxirgi ko rilgan kino",
        "oxirgi korilgan kinolar",
        "oxirgi ko rilgan kinolar",
    }:
        return "profile"
    return None


def _matches_content_channel(message: Message, settings: Settings) -> bool:
    if message.chat.type != "channel":
        return False
    if settings.content_channel_id and message.chat.id != settings.content_channel_id:
        return False
    if settings.content_channel_username:
        return (message.chat.username or "").casefold() == settings.content_channel_username.casefold()
    return True


def _fallback_title(message: Message) -> str:
    if message.video and message.video.file_name:
        return Path(message.video.file_name).stem
    if message.document and message.document.file_name:
        return Path(message.document.file_name).stem
    return f"Kino {message.message_id}"


def _media_file_id(message: Message) -> str | None:
    if message.video:
        return message.video.file_id
    if message.document and (message.document.mime_type or "").startswith("video/"):
        return message.document.file_id
    return None


def _build_channel_movie(message: Message) -> dict:
    movie = parse_movie_caption(message.caption, _fallback_title(message), message.message_id)
    username = message.chat.username
    file_id = _media_file_id(message)
    source_url = f"https://t.me/{username}/{message.message_id}" if username else ""
    movie.update(
        {
            "sourceType": "telegram_channel",
            "telegramChatId": message.chat.id,
            "telegramMessageId": message.message_id,
            "telegramFileId": file_id,
            "telegramVideoFileId": file_id,
            "video_file_id": file_id,
            "sourceUrl": source_url,
            "telegramPostUrl": source_url,
        }
    )
    return movie


def _movie_by_id(settings: Settings, movie_id: int) -> dict | None:
    return next((movie for movie in load_movies(settings.movies_path) if int(movie.get("id", 0)) == movie_id), None)


def _watch_id_from_start(text: str | None) -> int | None:
    if not text:
        return None
    parts = text.strip().split(maxsplit=1)
    if len(parts) != 2:
        return None
    payload = parts[1].strip()
    if not payload.startswith("watch_"):
        return None
    movie_id = payload.removeprefix("watch_")
    return int(movie_id) if movie_id.isdigit() else None


async def _sync_user_to_webapp(settings: Settings, user_record: dict) -> None:
    if not settings.webapp_url or not user_record:
        return

    url = f"{settings.webapp_url.rstrip('/')}/api/admin/track-user"
    payload = {
        "user": {
            "id": user_record.get("id"),
            "username": user_record.get("username", ""),
            "first_name": user_record.get("firstName", ""),
            "last_name": user_record.get("lastName", ""),
        }
    }
    try:
        timeout = ClientTimeout(total=4)
        async with ClientSession(timeout=timeout) as session:
            async with session.post(url, json=payload) as response:
                if response.status >= 400:
                    logging.warning("User sync failed with HTTP %s", response.status)
    except Exception as error:  # Network should never block bot replies.
        logging.warning("User sync failed: %s", error)


async def _send_movie(message: Message, settings: Settings, movie_id: int) -> None:
    movie = _movie_by_id(settings, movie_id)
    if not movie:
        await message.answer("Kino topilmadi.")
        return

    chat_id = movie.get("telegramChatId")
    message_id = movie.get("telegramMessageId")
    if chat_id and message_id:
        from_chat_id = int(chat_id) if str(chat_id).lstrip("-").isdigit() else str(chat_id)
        await message.bot.copy_message(
            chat_id=message.chat.id,
            from_chat_id=from_chat_id,
            message_id=int(message_id),
        )
        return

    file_id = movie.get("telegramFileId")
    if file_id:
        await message.answer_video(file_id)
        return

    await message.answer("Bu kino uchun Telegram video posti ulanmagan.")


async def _show_admin_panel(message: Message, settings: Settings) -> None:
    if not _is_admin(message.from_user.id if message.from_user else None, settings.admin_ids):
        await message.answer("Bu bo'lim faqat adminlar uchun.")
        return

    movies = load_movies(settings.movies_path)
    users = load_users(settings.users_path)
    categories = sorted({str(movie.get("genre") or "Kino") for movie in movies})
    await message.answer(
        "<b>Admin panel</b>\n\n"
        f"🎬 Kinolar: <b>{len(movies)}</b>\n"
        f"👤 Foydalanuvchilar: <b>{len(users)}</b>\n"
        f"📁 Kategoriyalar: <b>{len(categories)}</b>\n"
        "📣 Kanallar: <b>0</b>\n"
        "👁 Bugungi ko'rishlar: <b>0</b>\n\n"
        "Bo'limni tanlang:",
        reply_markup=admin_panel(),
    )


async def _show_search_hint(message: Message) -> None:
    await message.answer("Kino nomi, janri yoki kodini yuboring. Masalan: <b>JW4</b> yoki <b>Interstellar</b>.")


async def _show_contact(message: Message, settings: Settings) -> None:
    await message.answer(f"Savollar uchun: @{settings.contact_username}")


async def _show_feedback_placeholder(message: Message) -> None:
    await message.answer("Murojaat qoldirish bo'limi tez orada ishga tushadi.")


async def _send_start_menu(message: Message, settings: Settings) -> None:
    await message.answer(
        "Assalomu alaykum, My Kino botiga xush kelibsiz. Biz bilan vaqtingiz chog' va maroqli o'tishini tilab qolamiz. Biz siz uchun doim xizmatdamiz",
        reply_markup=start_menu(settings.webapp_url),
    )


@router.message(CommandStart())
async def start(message: Message, settings: Settings) -> None:
    user_record = upsert_user(settings.users_path, message.from_user)
    if user_record:
        asyncio.create_task(_sync_user_to_webapp(settings, user_record))

    movie_id = _watch_id_from_start(message.text)
    if movie_id:
        await _send_movie(message, settings, movie_id)

    await _send_start_menu(message, settings)


@router.message(Command("admin"))
@router.message(F.text == "Admin panel")
async def admin(message: Message, settings: Settings) -> None:
    await _show_admin_panel(message, settings)


@router.message(Command("sync"))
async def sync_channel(message: Message, settings: Settings) -> None:
    if not _is_admin(message.from_user.id if message.from_user else None, settings.admin_ids):
        await message.answer("Bu komanda faqat adminlar uchun.")
        return

    imported = sync_public_channel(
        settings.movies_path,
        settings.content_channel_username,
        settings.content_channel_id,
    )
    await message.answer(f"✅ Kanal sinxron qilindi. Kinolar: <b>{len(imported)}</b>")


@router.message(F.text == "Qidirish")
async def search_hint(message: Message) -> None:
    await _show_search_hint(message)


@router.message(F.text == "Bog'lanish")
async def contact(message: Message, settings: Settings) -> None:
    await _show_contact(message, settings)


@router.message(F.text.in_({"Murojaat qoldiring", "Murojaat qoldirish"}))
async def feedback(message: Message) -> None:
    await _show_feedback_placeholder(message)


@router.message(F.web_app_data)
async def web_app_data(message: Message, settings: Settings) -> None:
    try:
        payload = json.loads(message.web_app_data.data)
    except (TypeError, json.JSONDecodeError):
        await message.answer("Mini appdan noto'g'ri so'rov keldi.")
        return

    if payload.get("action") == "watch":
        await _send_movie(message, settings, int(payload.get("movieId", 0)))
        return

    await message.answer("Noma'lum mini app so'rovi.")


@router.message(F.text)
async def movie_search(message: Message, settings: Settings) -> None:
    action = _menu_action(message.text)
    if action == "admin":
        await _show_admin_panel(message, settings)
        return
    if action == "search":
        await _show_search_hint(message)
        return
    if action == "contact":
        await _show_contact(message, settings)
        return
    if action == "feedback":
        await _show_feedback_placeholder(message)
        return
    if action in {"watch", "profile"}:
        await message.answer("Mini appni ochish uchun menyudagi tugmadan foydalaning.")
        return

    results = search_movies(settings.movies_path, message.text or "")
    if not results:
        await message.answer("Hech narsa topilmadi. Boshqa nom yoki kod bilan urinib ko'ring.")
        return

    lines = ["Topilgan kinolar:"]
    for movie in results[:6]:
        lines.append(
            f"\n<b>{movie['title']}</b>\n"
            f"Kod: <code>{movie['code']}</code>\n"
            f"{movie['year']} · {movie['genre']} · ⭐ {movie['rating']}"
        )
    lines.append(f"\nMini app: {settings.webapp_url}")
    await message.answer("\n".join(lines))


@router.callback_query(F.data.startswith("admin:"))
async def admin_callback(callback: CallbackQuery, settings: Settings) -> None:
    if not _is_admin(callback.from_user.id if callback.from_user else None, settings.admin_ids):
        await callback.answer("Ruxsat yo'q", show_alert=True)
        return

    action = callback.data.split(":", 1)[1]
    if action == "close":
        await callback.message.delete()
        return

    if action == "stats":
        movies = load_movies(settings.movies_path)
        await callback.answer(f"Kinolar: {len(movies)}", show_alert=True)
        return

    await callback.answer("Bu bo'lim keyingi bosqichda ulanadi.", show_alert=True)


@router.callback_query(F.data == "feedback:soon")
async def feedback_callback(callback: CallbackQuery) -> None:
    await callback.answer("Murojaat qoldirish bo'limi tez orada ishga tushadi.", show_alert=True)


@router.channel_post()
async def channel_post(message: Message, settings: Settings) -> None:
    if not _matches_content_channel(message, settings):
        return

    if not _media_file_id(message):
        logging.info("Skipping channel post without video: %s", message.message_id)
        return

    movie = upsert_movie(settings.movies_path, _build_channel_movie(message))
    logging.info("Imported channel movie %s (%s)", movie["title"], movie["code"])


async def start_web_server(app: web.Application, host: str, port: int) -> web.AppRunner:
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logging.info("Mini app server started at http://%s:%s", host, port)
    return runner


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
    settings = load_settings()
    bot = Bot(
        token=settings.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    dispatcher = Dispatcher()
    dispatcher.include_router(router)

    runner = await start_web_server(create_web_app(settings), settings.web_host, settings.web_port)
    try:
        await dispatcher.start_polling(bot, settings=settings)
    finally:
        await runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())

