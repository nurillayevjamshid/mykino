from __future__ import annotations

import logging
import os
from typing import Any

from aiohttp import web
from aiohttp_client_cache import CachedSession

from .config import Settings
from .storage import load_movies


def get_env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def best_thumbnail(thumbnails: dict[str, Any]) -> str:
    return (
        thumbnails.get("maxres", {}).get("url", "")
        or thumbnails.get("standard", {}).get("url", "")
        or thumbnails.get("high", {}).get("url", "")
        or thumbnails.get("medium", {}).get("url", "")
        or thumbnails.get("default", {}).get("url", "")
    )


async def fetch_youtube_movies() -> list[dict[str, Any]]:
    api_key = get_env("YOUTUBE_API_KEY")
    playlist_id = get_env("YOUTUBE_PLAYLIST_ID", "PLrW0WsV8cL9Rug7pLf8D8NOqEI7YeO6kE")
    max_pages = max(1, min(int(get_env("YOUTUBE_MAX_PAGES", "4")), 10))

    if not api_key:
        logging.warning("YOUTUBE_API_KEY not set, returning empty list")
        return []

    movies = []
    page_token = ""
    base_url = "https://www.googleapis.com/youtube/v3/playlistItems"

    async with CachedSession() as session:
        for page in range(max_pages):
            params = {
                "part": "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": 50,
                "key": api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            async with session.get(base_url, params=params) as response:
                if response.status != 200:
                    logging.error("YouTube API error: %s", response.status)
                    break

                data = await response.json()
                items = data.get("items", [])

                for item in items:
                    snippet = item.get("snippet", {})
                    content_details = item.get("contentDetails", {})
                    video_id = content_details.get("videoId") or snippet.get("resourceId", {}).get("videoId", "")
                    title = snippet.get("title", "")
                    published_at = snippet.get("publishedAt", "")

                    if not video_id or title.lower() in ("private video", "deleted video"):
                        continue

                    year = int(published_at[:4]) if published_at else ""

                    movies.append({
                        "id": video_id,
                        "code": video_id[:10].upper(),
                        "sourceType": "youtube_playlist",
                        "videoId": video_id,
                        "youtubeVideoId": video_id,
                        "title": title,
                        "description": snippet.get("description", ""),
                        "thumbnail": best_thumbnail(snippet.get("thumbnails", {})),
                        "poster": best_thumbnail(snippet.get("thumbnails", {})),
                        "publishedAt": published_at,
                        "year": year,
                        "genre": "YouTube",
                        "rating": 0,
                        "quality": "HD",
                        "isTop": False,
                        "isPremium": False,
                        "videoUrl": f"https://www.youtube.com/watch?v={video_id}",
                        "embedUrl": f"https://www.youtube.com/embed/{video_id}?autoplay=1&playsinline=1&rel=0",
                    })

                page_token = data.get("nextPageToken", "")
                if not page_token:
                    break

    return movies


def create_web_app(settings: Settings) -> web.Application:
    app = web.Application()

    async def index(_: web.Request) -> web.FileResponse:
        return web.FileResponse(settings.webapp_dir / "index.html")

    async def movies(_: web.Request) -> web.Response:
        return web.json_response(load_movies(settings.movies_path))

    async def youtube_movies(_: web.Request) -> web.Response:
        response = web.json_response(await fetch_youtube_movies())
        response.headers["Cache-Control"] = "s-maxage=60, stale-while-revalidate=300"
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    async def health(_: web.Request) -> web.Response:
        return web.json_response({"ok": True})

    app.router.add_get("/", index)
    app.router.add_get("/api/movies", movies)
    app.router.add_get("/api/youtube/movies", youtube_movies)
    app.router.add_get("/health", health)
    app.router.add_static("/static", settings.webapp_dir)
    return app

