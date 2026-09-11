"""Admin panelni real ma'lumot bilan sinash uchun vaqtinchalik server.

Ishlatish:
    .venv/Scripts/python.exe scripts/dev_preview_server.py

So'ngra brauzerda: http://127.0.0.1:8899/admin
(parol: .env dagi ADMIN_PASSWORD, bo'lmasa "admin123")
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiohttp import web  # noqa: E402

from bot.storage import upsert_user  # noqa: E402
from bot.webserver import create_web_app  # noqa: E402

BASE = Path(__file__).resolve().parent.parent
PORT = 8899


class PreviewSettings:
    bot_token = "preview-token"
    bot_username = "myntv_bot"
    webapp_url = f"http://127.0.0.1:{PORT}"
    web_host = "127.0.0.1"
    web_port = PORT
    content_channel_username = ""
    content_channel_id = None
    feedback_group_id = None
    contact_username = "support"
    movies_path = BASE / "data" / "movies.json"
    users_path = BASE / "data" / "users.json"
    webapp_dir = BASE / "webapp"


class U:
    def __init__(s, i, u=None, f="", l=None):
        s.id, s.username, s.first_name, s.last_name = i, u, f, l


SAMPLE = [
    (679291909, "nurillaevv", "Жам", "Нуриллаев"),
    (74402946, None, "ABDULLOH", None),
    (7575677312, "Ruxsoraxonn", "Ruxsora", None),
    (5878057404, "miocomment", "MIO BEAUTY", None),
    (2111426807, "nurbek1112", "Nurbek", "Toshmatov"),
    (887888146, "Chessff", "Turganbaev", "Asirbek"),
]


def seed():
    settings = PreviewSettings()
    for uid, un, fn, ln in SAMPLE:
        upsert_user(settings.users_path, U(uid, un, fn, ln))
    # Bittasi qayta /start bosdi — last_active yangilanishi ko'rinadi
    upsert_user(settings.users_path, U(679291909, "nurillaevv", "Жам", "Нуриллаев"))
    return settings


async def main():
    settings = seed()
    app = create_web_app(settings)
    runner = web.AppRunner(app)
    await runner.setup()
    await web.TCPSite(runner, settings.web_host, PORT).start()
    print(f"Admin panel:  http://127.0.0.1:{PORT}/admin")
    print(f"API tekshirish: http://127.0.0.1:{PORT}/api/users")
    print(f"Parol: {__import__('os').environ.get('ADMIN_PASSWORD', 'admin123')} (.env yo'q)")
    print("To'xtatish: Ctrl+C")
    try:
        import asyncio
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
