from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_movies(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, list):
        raise ValueError("movies.json ro'yxat bo'lishi kerak.")
    return payload


def save_movies(path: Path, movies: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(movies, file, ensure_ascii=False, indent=2)
        file.write("\n")


def load_settings_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"splashImageUrl": ""}
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (json.JSONDecodeError, ValueError):
        return {"splashImageUrl": ""}


def save_settings_json(path: Path, data: dict[str, Any]) -> dict[str, Any]:
    current = load_settings_json(path)
    current.update(data)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(current, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return current


def load_users(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if isinstance(payload, dict):
        payload = list(payload.values())
    if not isinstance(payload, list):
        raise ValueError("users.json ro'yxat bo'lishi kerak.")
    return [item for item in payload if isinstance(item, dict)]


def save_users(path: Path, users: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(users, file, ensure_ascii=False, indent=2)
        file.write("\n")


def upsert_user(path: Path, user: Any) -> dict[str, Any] | None:
    user_id = getattr(user, "id", None)
    if not user_id:
        return None

    users = load_users(path)
    now = datetime.now(timezone.utc).isoformat()
    key = str(user_id)
    # Check by telegram_id first, fallback to id for backwards compatibility
    existing_index = next((index for index, item in enumerate(users) if str(item.get("telegram_id")) == key or str(item.get("id")) == key), None)
    existing = users[existing_index] if existing_index is not None else {}
    record = {
        "telegram_id": int(user_id),
        "username": getattr(user, "username", None) or existing.get("username", ""),
        "first_name": getattr(user, "first_name", None) or existing.get("first_name", existing.get("firstName", "")),
        "started_at": existing.get("started_at") or existing.get("firstSeenAt") or now[:10],  # Format: 2026-05-04
    }

    if existing_index is None:
        users.append(record)
    else:
        # Merge with existing, keeping watchedMovies and other data
        merged = {**existing, **record}
        # Migrate old field names if present
        if "firstSeenAt" in existing and not existing.get("started_at"):
            merged["started_at"] = existing["firstSeenAt"][:10]
        users[existing_index] = merged

    save_users(path, sorted(users, key=lambda item: int(item.get("telegram_id", item.get("id", 0)))))
    return record


def search_movies(path: Path, query: str) -> list[dict[str, Any]]:
    needle = query.casefold().strip()
    if not needle:
        return []

    movies = load_movies(path)
    return [
        movie
        for movie in movies
        if needle in str(movie.get("title", "")).casefold()
        or needle in str(movie.get("code", "")).casefold()
        or needle in str(movie.get("genre", "")).casefold()
    ]


_CAPTION_KEYS = {
    "nomi": "title",
    "name": "title",
    "title": "title",
    "kino": "title",
    "kod": "code",
    "code": "code",
    "janr": "genre",
    "genre": "genre",
    "yil": "year",
    "year": "year",
    "reyting": "rating",
    "rating": "rating",
    "sifat": "quality",
    "quality": "quality",
    "top": "isTop",
    "premium": "isPremium",
    "tavsif": "description",
    "description": "description",
}


def _to_bool(value: str) -> bool:
    return value.strip().casefold() in {"1", "true", "ha", "yes", "да", "+"}


def _movie_code(title: str, message_id: int) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "", title).upper()
    return (slug[:10] or "KINO") + str(message_id)


def parse_movie_caption(caption: str | None, fallback_title: str, message_id: int) -> dict[str, Any]:
    raw = (caption or "").strip()
    values: dict[str, Any] = {}
    plain_lines: list[str] = []

    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        key, separator, value = line.partition(":")
        normalized_key = key.strip().casefold()
        mapped_key = _CAPTION_KEYS.get(normalized_key)
        if separator and mapped_key:
            values[mapped_key] = value.strip()
        else:
            plain_lines.append(line)

    title = str(values.get("title") or (plain_lines[0] if plain_lines else fallback_title)).strip()
    if not title:
        title = f"Kino {message_id}"

    description = str(values.get("description") or "\n".join(plain_lines[1:]) or "Kanalga joylangan kino.").strip()

    try:
        year: int | str = int(str(values.get("year", "")).strip())
    except ValueError:
        year = ""

    try:
        rating = float(str(values.get("rating", "0")).replace(",", ".").strip() or 0)
    except ValueError:
        rating = 0.0

    return {
        "code": str(values.get("code") or _movie_code(title, message_id)).strip().upper(),
        "title": title,
        "year": year,
        "genre": str(values.get("genre") or "Kino").strip(),
        "rating": rating,
        "quality": str(values.get("quality") or "HD").strip().upper(),
        "isTop": _to_bool(str(values.get("isTop", ""))),
        "isPremium": _to_bool(str(values.get("isPremium", ""))),
        "poster": "",
        "posterImage": "",
        "headerImage": "",
        "showInHeader": False,
        "streamUrl": "",
        "description": description,
    }


def upsert_movie(path: Path, movie: dict[str, Any]) -> dict[str, Any]:
    movies = load_movies(path)
    if movie.get("telegramFileId") and not movie.get("video_file_id"):
        movie["video_file_id"] = movie["telegramFileId"]
    if movie.get("video_file_id") and not movie.get("telegramFileId"):
        movie["telegramFileId"] = movie["video_file_id"]
    if movie.get("telegramVideoFileId") and not movie.get("video_file_id"):
        movie["video_file_id"] = movie["telegramVideoFileId"]
    if movie.get("video_file_id") and not movie.get("telegramVideoFileId"):
        movie["telegramVideoFileId"] = movie["video_file_id"]
    if movie.get("sourceUrl") and not movie.get("telegramPostUrl"):
        movie["telegramPostUrl"] = movie["sourceUrl"]
    if movie.get("telegramPostUrl") and not movie.get("sourceUrl"):
        movie["sourceUrl"] = movie["telegramPostUrl"]
    existing_index = next(
        (
            index
            for index, item in enumerate(movies)
            if item.get("telegramChatId") == movie.get("telegramChatId")
            and item.get("telegramMessageId") == movie.get("telegramMessageId")
        ),
        None,
    )

    if existing_index is None:
        next_id = max((int(item.get("id", 0)) for item in movies), default=0) + 1
        movie["id"] = next_id
        movies.append(movie)
    else:
        existing = movies[existing_index]
        movie["id"] = existing.get("id")
        merged = {**existing, **movie}
        for key in ("telegramFileId", "telegramVideoFileId", "video_file_id", "videoFileId", "telegramPostUrl"):
            if not movie.get(key) and existing.get(key):
                merged[key] = existing[key]
        if merged.get("sourceUrl") and not merged.get("telegramPostUrl"):
            merged["telegramPostUrl"] = merged["sourceUrl"]
        if merged.get("telegramPostUrl") and not merged.get("sourceUrl"):
            merged["sourceUrl"] = merged["telegramPostUrl"]
        if merged.get("telegramFileId") and not merged.get("video_file_id"):
            merged["video_file_id"] = merged["telegramFileId"]
        if merged.get("video_file_id") and not merged.get("telegramFileId"):
            merged["telegramFileId"] = merged["video_file_id"]
        if merged.get("telegramVideoFileId") and not merged.get("video_file_id"):
            merged["video_file_id"] = merged["telegramVideoFileId"]
        if merged.get("video_file_id") and not merged.get("telegramVideoFileId"):
            merged["telegramVideoFileId"] = merged["video_file_id"]
        movies[existing_index] = merged

    save_movies(path, movies)
    return movie
