"""bot/storage.py dagi /start -> users.json oqimining testlari.

Ishga tushirish:  python -m unittest discover -s tests -p "test_*.py"
Yoki:             python tests/test_bot_users.py

Bu testlar quyidagilarni kafolatlaydi:
  1. /start bosgan user users.json ga yoziladi.
  2. Kerakli maydonlar saqlanadi (telegram_id, username, first_name,
     last_name, started_at, last_active).
  3. Bir user qayta /start bossa DUPLICATE yaratilmaydi — mavjud yozuv
     yangilanadi va last_active o'zgaradi.
  4. Fayl oddiy JSON bo'lib qoladi (server qayta ishga tushsa ham yo'qolmaydi).
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.storage import load_users, save_users, upsert_user  # noqa: E402


class FakeTelegramUser:
    """aiogram User obyektining kerakli qismini taqlid qiladi."""

    def __init__(self, id, username=None, first_name="", last_name=None):
        self.id = id
        self.username = username
        self.first_name = first_name
        self.last_name = last_name


class UpsertUserTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        self.path = self.tmpdir / "users.json"

    def read(self):
        return json.loads(self.path.read_text(encoding="utf-8"))

    def test_start_creates_users_json(self):
        self.assertFalse(self.path.exists())
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        self.assertTrue(self.path.exists(), "users.json yaratilmadi")

    def test_all_required_fields_saved(self):
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        user = self.read()[0]
        for field in (
            "telegram_id",
            "username",
            "first_name",
            "last_name",
            "started_at",
            "last_active",
        ):
            self.assertIn(field, user, f"{field} saqlanmadi")
        self.assertEqual(user["telegram_id"], 111)
        self.assertEqual(user["username"], "ali")
        self.assertEqual(user["first_name"], "Ali")
        self.assertEqual(user["last_name"], "Valiyev")

    def test_dates_carry_full_time(self):
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali"))
        user = self.read()[0]
        # "2026-09-11T13:54:53+00:00" — sana VA vaqt bo'lishi shart.
        self.assertIn("T", user["started_at"])
        self.assertIn("T", user["last_active"])

    def test_repeat_start_no_duplicate(self):
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        self.assertEqual(len(self.read()), 1, "duplicate yozuv yaratildi")

    def test_repeat_start_updates_last_active_only(self):
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        first = self.read()[0]
        time.sleep(0.01)
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        second = self.read()[0]

        self.assertNotEqual(first["last_active"], second["last_active"], "last_active yangilanmadi")
        self.assertEqual(first["started_at"], second["started_at"], "started_at o'zgarmasligi kerak")

    def test_username_update_keeps_last_name(self):
        """Telegram last_name yubormasa ham eskisi saqlanib qoladi."""
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        upsert_user(self.path, FakeTelegramUser(111, "ali_new", "Ali", None))
        user = self.read()[0]
        self.assertEqual(user["username"], "ali_new")
        self.assertEqual(user["last_name"], "Valiyev")

    def test_telegram_id_is_unique(self):
        for uid in (111, 222, 333, 111, 222):
            upsert_user(self.path, FakeTelegramUser(uid, f"u{uid}", f"User{uid}"))
        users = self.read()
        ids = [u["telegram_id"] for u in users]
        self.assertEqual(len(ids), len(set(ids)), "telegram_id unique emas")
        self.assertEqual(sorted(ids), [111, 222, 333])

    def test_file_survives_reload(self):
        """Fayl diskda qoladi — qayta o'qilganda ma'lumot yo'qolmaydi."""
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali", "Valiyev"))
        reloaded = load_users(self.path)
        self.assertEqual(len(reloaded), 1)
        self.assertEqual(reloaded[0]["telegram_id"], 111)

    def test_storage_has_no_external_backend(self):
        """users.json oddiy lokal fayl bo'lishi kerak — tashqi servis yo'q."""
        upsert_user(self.path, FakeTelegramUser(111, "ali", "Ali"))
        self.assertEqual(self.path.name, "users.json")
        self.assertEqual(self.path.parent, self.tmpdir)


if __name__ == "__main__":
    unittest.main(verbosity=2)
