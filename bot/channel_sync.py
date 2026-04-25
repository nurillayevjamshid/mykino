from __future__ import annotations

import html
import re
import urllib.request
from pathlib import Path
from typing import Any

from .storage import parse_movie_caption, upsert_movie


def _text_from_html(value: str) -> str:
    cleaned = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    return html.unescape(cleaned).strip()


def _message_blocks(page_html: str, username: str) -> list[tuple[int, str]]:
    escaped = re.escape(username)
    pattern = re.compile(
        rf'<div class="tgme_widget_message[\s\S]*?data-post="{escaped}/(\d+)"[\s\S]*?(?=</div></div><div class="tgme_widget_message_wrap|</section>)',
        re.I,
    )
    return [(int(match.group(1)), match.group(0)) for match in pattern.finditer(page_html)]


def sync_public_channel(path: Path, username: str, channel_id: int | None = None) -> list[dict[str, Any]]:
    if not username:
        return []

    request = urllib.request.Request(
        f"https://t.me/s/{username}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        page_html = response.read().decode("utf-8", errors="replace")

    imported: list[dict[str, Any]] = []
    for message_id, block in _message_blocks(page_html, username):
        if "tgme_widget_message_video_player" not in block:
            continue

        caption_match = re.search(
            r'<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)</div>',
            block,
            flags=re.I,
        )
        thumb_match = re.search(r"background-image:url\('([^']+)'\)", block, flags=re.I)
        caption = _text_from_html(caption_match.group(1)) if caption_match else ""
        movie = parse_movie_caption(caption, f"Kino {message_id}", message_id)
        movie.update(
            {
                "sourceType": "telegram_channel",
                "telegramChatId": channel_id or f"@{username}",
                "telegramMessageId": message_id,
                "sourceUrl": f"https://t.me/{username}/{message_id}",
                "poster": thumb_match.group(1) if thumb_match else movie.get("poster", ""),
            }
        )
        imported.append(upsert_movie(path, movie))

    return imported
