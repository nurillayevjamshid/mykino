from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    bot_token: str
    bot_username: str
    webapp_url: str
    web_host: str
    web_port: int
    content_channel_username: str
    content_channel_id: int | None
    feedback_group_id: int | None
    contact_username: str
    movies_path: Path
    users_path: Path
    webapp_dir: Path


def load_settings() -> Settings:
    load_dotenv(BASE_DIR / ".env")
    bot_token = os.getenv("BOT_TOKEN", "").strip()
    if not bot_token:
        raise RuntimeError("BOT_TOKEN .env faylida ko'rsatilmagan.")

    return Settings(
        bot_token=bot_token,
        bot_username=os.getenv("BOT_USERNAME", "").strip().lstrip("@"),
        webapp_url=os.getenv("WEBAPP_URL", "http://localhost:8080").rstrip("/"),
        web_host=os.getenv("WEB_HOST", "0.0.0.0"),
        web_port=int(os.getenv("WEB_PORT", "8080")),
        content_channel_username=os.getenv("CONTENT_CHANNEL_USERNAME", "").strip().lstrip("@"),
        content_channel_id=(
            int(os.getenv("CONTENT_CHANNEL_ID", "0"))
            if os.getenv("CONTENT_CHANNEL_ID", "0").strip().lstrip("-").isdigit()
            else None
        ),
        feedback_group_id=(
            int(os.getenv("FEEDBACK_GROUP_ID", "0"))
            if os.getenv("FEEDBACK_GROUP_ID", "0").strip().lstrip("-").isdigit()
            else None
        ),
        contact_username=os.getenv("CONTACT_USERNAME", "support"),
        movies_path=BASE_DIR / "data" / "movies.json",
        users_path=BASE_DIR / "data" / "users.json",
        webapp_dir=BASE_DIR / "webapp",
    )
