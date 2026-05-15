from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, StateFilter
from aiogram.types import CallbackQuery, Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from .config import Settings, load_settings
from .keyboards import main_menu, start_menu
from .storage import load_movies, parse_movie_caption, search_movies, upsert_movie, upsert_user
from .webserver import create_web_app


router = Router()

class FeedbackState(StatesGroup):
    waiting_for_message = State()

def _normalize_menu_text(text: str | None) -> str:
    cleaned = "".join(ch if ch.isalnum() else " " for ch in (text or "").casefold())
    return " ".join(cleaned.split())


def _menu_action(text: str | None) -> str | None:
    normalized = _normalize_menu_text(text)
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


async def _show_search_hint(message: Message) -> None:
    await message.answer("Kino nomi, janri yoki kodini yuboring. Masalan: <b>JW4</b> yoki <b>Interstellar</b>.")


async def _show_contact(message: Message, settings: Settings) -> None:
    await message.answer(f"Savollar uchun: @{settings.contact_username}")


async def _show_feedback_placeholder(message: Message, state: FSMContext) -> None:
    await state.set_state(FeedbackState.waiting_for_message)
    await message.answer(
        "Assalomu alaykum talab va takliflarizni yozib qoldiring. "
        "Qisqa fursadda talab va taklifingizni bartaraf qilishga harakat qilamiz"
    )


async def _send_start_menu(message: Message, settings: Settings) -> None:
    await message.answer(
        "Assalomu alaykum, My Kino botiga xush kelibsiz.\n"
        "Biz bilan vaqtingiz chog' va maroqli o'tishini tilab qolamiz.\n"
        "Biz siz uchun doim xizmatdamiz.",
        reply_markup=start_menu(settings.webapp_url),
    )
    await message.answer(
        "Quyidagi menyudan foydalaning:",
        reply_markup=main_menu(settings.webapp_url),
    )


@router.message(CommandStart(), StateFilter("*"))
async def start(message: Message, state: FSMContext, settings: Settings) -> None:
    logging.info("Start handler triggered for user %s", message.from_user.id)
    await state.clear()
    try:
        upsert_user(settings.users_path, message.from_user)
    except Exception as e:
        logging.error("Failed to upsert user %s: %s", message.from_user.id, e)

    movie_id = _watch_id_from_start(message.text)
    if movie_id:
        await _send_movie(message, settings, movie_id)

    await _send_start_menu(message, settings)


@router.message(F.text == "Qidirish")
async def search_hint(message: Message) -> None:
    await _show_search_hint(message)


@router.message(F.text == "Bog'lanish")
async def contact(message: Message, settings: Settings) -> None:
    await _show_contact(message, settings)


@router.message(F.text.in_({"Murojaat qoldiring", "Murojaat qoldirish"}))
async def feedback(message: Message, state: FSMContext) -> None:
    await _show_feedback_placeholder(message, state)


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


@router.message(StateFilter(None), F.text)
async def movie_search(message: Message, state: FSMContext, settings: Settings) -> None:
    action = _menu_action(message.text)
    if action == "search":
        await _show_search_hint(message)
        return
    if action == "contact":
        await _show_contact(message, settings)
        return
    if action == "feedback":
        await _show_feedback_placeholder(message, state)
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


@router.callback_query(F.data == "feedback:start")
async def feedback_callback(callback: CallbackQuery, state: FSMContext) -> None:
    await callback.message.delete()
    await _show_feedback_placeholder(callback.message, state)

@router.message(StateFilter(FeedbackState.waiting_for_message))
async def process_feedback_message(message: Message, state: FSMContext, settings: Settings) -> None:

    if not settings.feedback_group_id:
        await message.answer("Murojaat tizimi sozlanmagan. Iltimos keyinroq urinib ko'ring.")
        await state.clear()
        return

    try:
        user_info = f"Kimdan: {message.from_user.full_name}"
        if message.from_user.username:
            user_info += f" (@{message.from_user.username})"
        user_info += f"\nID: <code>{message.from_user.id}</code>\n"
        
        if message.text:
            await message.bot.send_message(
                chat_id=settings.feedback_group_id,
                text=f"<b>Yangi murojaat!</b>\n{user_info}\n<b>Xabar:</b> {message.text}"
            )
        else:
            await message.bot.send_message(
                chat_id=settings.feedback_group_id,
                text=f"<b>Yangi murojaat!</b>\n{user_info}\n<b>Xabar:</b>"
            )
            await message.send_copy(chat_id=settings.feedback_group_id)
        
        await message.answer("Taklifiz uchun rahmat. Ko'rib chiqamiz va bartaraf etamiz")
        await _send_start_menu(message, settings)
    except Exception as e:
        logging.error("Failed to forward feedback to group %s: %s", settings.feedback_group_id, e)
        await message.answer("Murojaatni yuborishda xatolik yuz berdi.")
        await _send_start_menu(message, settings)
    finally:
        await state.clear()

@router.message(F.reply_to_message)
async def admin_reply_handler(message: Message, settings: Settings) -> None:
    if not settings.feedback_group_id or message.chat.id != settings.feedback_group_id:
        return
    
    # We need to extract the user ID from the previous message
    reply = message.reply_to_message
    if reply.from_user.id != message.bot.id:
        return
        
    lines = reply.text.splitlines() if reply.text else []
    user_id = None
    for line in lines:
        if line.startswith("ID:"):
            import re
            match = re.search(r"ID:\s*(\d+)", line)
            if match:
                user_id = int(match.group(1))
                break
            
    if user_id:
        try:
            await message.send_copy(chat_id=user_id)
            await message.answer("Javob foydalanuvchiga yuborildi.")
        except Exception as e:
            logging.error("Failed to send reply to %s: %s", user_id, e)
            await message.answer("Javob yuborishda xatolik. Foydalanuvchi botni bloklagan bo'lishi mumkin.")


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
        await bot.delete_webhook(drop_pending_updates=True)
        await dispatcher.start_polling(bot, settings=settings)
    finally:
        await runner.cleanup()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
