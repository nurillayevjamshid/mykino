from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder


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


def user_menu(webapp_url: str, is_admin: bool) -> ReplyKeyboardMarkup:
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


def admin_panel() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    rows = [
        ("Kinolar", "admin:movies"),
        ("Kategoriyalar", "admin:categories"),
        ("Majburiy obuna", "admin:subscription"),
        ("Foydalanuvchilar", "admin:users"),
        ("Adminlar", "admin:admins"),
        ("Statistika", "admin:stats"),
        ("Reklama yuborish", "admin:broadcast"),
        ("Sozlamalar", "admin:settings"),
        ("Texnik rejim", "admin:maintenance"),
        ("Baza nusxasi", "admin:backup"),
        ("Obunani test", "admin:check_subscription"),
    ]

    for text, callback_data in rows:
        builder.add(InlineKeyboardButton(text=text, callback_data=callback_data))
    builder.adjust(2)
    builder.row(InlineKeyboardButton(text="Yopish", callback_data="admin:close"))
    return builder.as_markup()
