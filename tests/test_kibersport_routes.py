"""Kibersport jonli efiri oqimining testlari (VPS / aiohttp server tomoni).

Ishga tushirish:  python -m unittest discover -s tests -p "test_*.py"
Yoki:             python tests/test_kibersport_routes.py

Bu testlar quyidagi xatolar qaytarilishini oldini oladi:
  1. Mini appdagi "Kibersport" tugmasi /kibersport manziliga o'tadi. Bu yo'l
     aiohttp serverda ro'yxatga olinmagan bo'lsa 404 qaytadi va admin panelda
     saqlangan YouTube strim mini appda umuman ochilmaydi.
  2. Admin panel "Hozir boshlash" bosganda POST /api/settings ga
     {esportsStreams: {...}} yuboradi. Bu ma'lumot saqlanib, mini app
     GET /api/settings orqali qayta o'qiy olishi kerak.
"""
from __future__ import annotations

import asyncio
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiohttp.test_utils import TestClient, TestServer  # noqa: E402

from bot.config import Settings  # noqa: E402
from bot.webserver import create_web_app  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent


def build_settings(root: Path) -> Settings:
    """Vaqtinchalik papkaga qaraydigan Settings yaratadi (real data tegmaydi)."""
    webapp_dir = root / "webapp"
    (webapp_dir / "admin").mkdir(parents=True, exist_ok=True)
    (root / "data").mkdir(parents=True, exist_ok=True)
    for name in ("index.html", "sw.js", "kibersport.html"):
        shutil.copy2(REPO_ROOT / "webapp" / name, webapp_dir / name)
    return Settings(
        bot_token="test-token",
        bot_username="testbot",
        webapp_url="http://localhost:8080",
        web_host="127.0.0.1",
        web_port=8080,
        content_channel_username="",
        content_channel_id=None,
        feedback_group_id=None,
        contact_username="support",
        movies_path=root / "data" / "movies.json",
        users_path=root / "data" / "users.json",
        webapp_dir=webapp_dir,
    )


class KibersportRoutesTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp())
        self.settings = build_settings(self.tmp)
        self.loop = asyncio.new_event_loop()
        self.addCleanup(self.loop.close)
        self.addCleanup(lambda: shutil.rmtree(self.tmp, ignore_errors=True))

    def run_async(self, coro):
        return self.loop.run_until_complete(coro)

    def test_kibersport_page_is_served(self) -> None:
        """Admin saqlagan strim ochiladigan sahifa 404 bo'lmasligi kerak."""

        async def scenario() -> None:
            app = create_web_app(self.settings)
            async with TestClient(TestServer(app)) as client:
                for path in ("/kibersport", "/kibersport/", "/kibersport.html"):
                    response = await client.get(path)
                    body = await response.text()
                    self.assertEqual(response.status, 200, f"{path} 404 qaytardi")
                    self.assertIn("streamFrame", body, f"{path} ichida strim elementi yo'q")

        self.run_async(scenario())

    def test_admin_can_start_stream_and_mini_app_reads_it(self) -> None:
        """POST /api/settings -> GET /api/settings zanjiri ishlashi kerak."""

        async def scenario() -> None:
            app = create_web_app(self.settings)
            async with TestClient(TestServer(app)) as client:
                payload = {
                    "esportsStreams": {
                        "pubg": {
                            "key": "pubg",
                            "label": "PUBG Mobile",
                            "youtubeUrl": "https://www.youtube.com/live/jfKfPfyJRdk",
                            "title": "PMGC Grand Finals",
                            "meta": "3-xarita",
                            "startAt": "",
                            "isLive": True,
                            "enabled": True,
                        }
                    }
                }
                post = await client.post("/api/settings", json=payload)
                self.assertEqual(post.status, 200)

                get = await client.get("/api/settings")
                data = await get.json()
                pubg = (data.get("esportsStreams") or {}).get("pubg") or {}
                self.assertEqual(pubg.get("youtubeUrl"), payload["esportsStreams"]["pubg"]["youtubeUrl"])
                self.assertTrue(pubg.get("isLive"))
                self.assertIsNot(pubg.get("enabled"), False)

        self.run_async(scenario())

    def test_existing_pages_still_work(self) -> None:
        """Tuzatish boshqa yo'llarni buzmaganligi tekshiriladi."""

        async def scenario() -> None:
            app = create_web_app(self.settings)
            async with TestClient(TestServer(app)) as client:
                for path in ("/", "/sw.js", "/health"):
                    response = await client.get(path)
                    self.assertEqual(response.status, 200, f"{path} ishlamayapti")

        self.run_async(scenario())


if __name__ == "__main__":
    unittest.main(verbosity=2)
