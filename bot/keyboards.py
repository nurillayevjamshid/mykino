from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)


def start_menu(webapp_url: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Kino ko'rish",
                    web_app=WebAppInfo(url=webapp_url),
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Profilga kirish",
                    web_app=WebAppInfo(url=f"{webapp_url}/#profile"),
                ),
                InlineKeyboardButton(
                    text="Oxirgi ko'rilgan kinolar",
                    web_app=WebAppInfo(url=f"{webapp_url}/#profile"),
                ),
            ],
            [
                InlineKeyboardButton(
                    text="Murojaat qoldirish",
                    callback_data="feedback:soon",
                ),
            ],
        ],
    )
