from __future__ import annotations

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)
from aiogram.utils.keyboard import InlineKeyboardBuilder


def user_menu(webapp_url: str, is_admin: bool) -> ReplyKeyboardMarkup:
    buttons = [
        [
            KeyboardButton(text="🎬 Kinolar", web_app=WebAppInfo(url=webapp_url)),
            KeyboardButton(text="🔍 Qidirish"),
        ],
        [
            KeyboardButton(text="🔥 TOP kinolar", web_app=WebAppInfo(url=f"{webapp_url}/#top")),
            KeyboardButton(text="💎 Premium", web_app=WebAppInfo(url=f"{webapp_url}/#premium")),
        ],
        [
            KeyboardButton(text="👤 Profilim", web_app=WebAppInfo(url=f"{webapp_url}/#profile")),
            KeyboardButton(text="📞 Bog'lanish"),
        ],
    ]

    if is_admin:
        buttons.append([KeyboardButton(text="🛠 Admin panel")])

    return ReplyKeyboardMarkup(
        keyboard=buttons,
        resize_keyboard=True,
        input_field_placeholder="Xabar",
    )


def admin_panel() -> InlineKeyboardMarkup:
    builder = InlineKeyboardBuilder()
    rows = [
        ("🎬 Kinolar", "admin:movies"),
        ("📁 Kategoriyalar", "admin:categories"),
        ("📣 Majburiy obuna", "admin:subscription"),
        ("👥 Foydalanuvchilar", "admin:users"),
        ("👑 Adminlar", "admin:admins"),
        ("💎 Premium kodlar", "admin:premium"),
        ("📊 Statistika", "admin:stats"),
        ("📨 Reklama yuborish", "admin:broadcast"),
        ("⚙️ Sozlamalar", "admin:settings"),
        ("🛠 Texnik rejim", "admin:maintenance"),
        ("💾 Baza nusxasi", "admin:backup"),
        ("✅ Obunani test", "admin:check_subscription"),
    ]

    for text, callback_data in rows:
        builder.add(InlineKeyboardButton(text=text, callback_data=callback_data))
    builder.adjust(2)
    builder.row(InlineKeyboardButton(text="❌ Yopish", callback_data="admin:close"))
    return builder.as_markup()

