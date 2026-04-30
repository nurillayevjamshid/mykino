from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
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


def user_menu(webapp_url: str) -> ReplyKeyboardMarkup:
    buttons = [
        [
            KeyboardButton(text="Kino ko'rish", web_app=WebAppInfo(url=webapp_url)),
        ],
        [
            KeyboardButton(text="Profilga kirish", web_app=WebAppInfo(url=f"{webapp_url}/#profile")),
            KeyboardButton(text="Oxirgi ko'rilgan kino", web_app=WebAppInfo(url=f"{webapp_url}/#profile")),
        ],
        [
            KeyboardButton(text="Murojaat qoldirish"),
        ],
    ]

    return ReplyKeyboardMarkup(
        keyboard=buttons,
        resize_keyboard=True,
        is_persistent=True,
        one_time_keyboard=False,
        input_field_placeholder="Xabar",
    )
