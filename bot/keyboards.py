from __future__ import annotations

import time

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)


def _bust(url: str, anchor: str = "") -> str:
    sep = "&" if "?" in url else "?"
    cache_param = f"v={int(time.time())}"
    if anchor:
        return f"{url}{sep}{cache_param}{anchor}"
    return f"{url}{sep}{cache_param}"


def start_menu(webapp_url: str) -> InlineKeyboardMarkup:
    main_url = _bust(webapp_url)
    profile_url = _bust(webapp_url, anchor="#profile")
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Kino ko'rish",
                    web_app=WebAppInfo(url=main_url),
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Profilga kirish",
                    web_app=WebAppInfo(url=profile_url),
                ),
                InlineKeyboardButton(
                    text="Oxirgi ko'rilgan kinolar",
                    web_app=WebAppInfo(url=profile_url),
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Murojaat qoldirish",
                    callback_data="feedback:start",
                ),
            ],
        ],
    )


def main_menu(webapp_url: str) -> ReplyKeyboardMarkup:
    main_url = _bust(webapp_url)
    profile_url = _bust(webapp_url, anchor="#profile")
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(
                    text="Kino ko'rish",
                    web_app=WebAppInfo(url=main_url),
                ),
            ],
            [
                KeyboardButton(
                    text="Profilga kirish",
                    web_app=WebAppInfo(url=profile_url),
                ),
                KeyboardButton(text="Murojaat qoldirish"),
            ],
        ],
        resize_keyboard=True,
        persistent=True,
    )


def join_inline_keyboard(channel_url: str | None) -> InlineKeyboardMarkup:
    buttons = []
    if channel_url:
        buttons.append([InlineKeyboardButton(text="Kanalga a'zo bo'lish", url=channel_url)])
    
    buttons.append([InlineKeyboardButton(text="Tekshirish", callback_data="check_sub")])
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)
