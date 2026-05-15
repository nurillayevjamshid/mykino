from __future__ import annotations

import logging
import os
from typing import Any

from aiohttp import ClientSession, web

try:
    from aiohttp_client_cache import CachedSession
except ImportError:  # pragma: no cover - optional local dependency
    CachedSession = ClientSession

from .config import Settings
from .storage import load_movies, load_users, load_settings_json, save_settings_json


def get_env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def set_cors(response: web.StreamResponse) -> web.StreamResponse:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


def json_response(payload: Any, status: int = 200) -> web.Response:
    return set_cors(web.json_response(payload, status=status))


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


async def get_telegram_file(settings: Settings, file_id: str) -> dict[str, Any]:
    if not file_id:
        raise web.HTTPBadRequest(text='{"ok":false,"code":"FILE_ID_REQUIRED","error":"fileId berilmagan."}', content_type="application/json")

    api_url = f"https://api.telegram.org/bot{settings.bot_token}/getFile?file_id={file_id}"
    async with ClientSession() as session:
        async with session.get(api_url) as response:
            payload = await response.json(content_type=None)

    if not payload.get("ok") or not payload.get("result", {}).get("file_path"):
        description = str(payload.get("description") or "Telegram getFile xatolik qaytardi.")
        too_big = "file is too big" in description.lower()
        if too_big:
            raise web.HTTPRequestEntityTooLarge(
                max_size=0,
                actual_size=0,
                text='{"ok":false,"code":"TELEGRAM_FILE_TOO_BIG","error":"Bu video Telegram cheklovi sabab Mini App ichida ochilmadi. Telegramda ochish tugmasidan foydalaning."}',
                content_type="application/json",
            )
        raise web.HTTPBadGateway(
            text='{"ok":false,"code":"TELEGRAM_GET_FILE_FAILED","error":"Telegram video URL olinmadi."}',
            content_type="application/json",
        )

    result = payload["result"]
    return {
        "filePath": result["file_path"],
        "fileSize": result.get("file_size"),
        "downloadUrl": f"https://api.telegram.org/file/bot{settings.bot_token}/{result['file_path']}",
    }


def create_web_app(settings: Settings) -> web.Application:
    @web.middleware
    async def cors_middleware(request: web.Request, handler):
        if request.method == "OPTIONS":
            return json_response({"ok": True}, status=204)
        try:
            response = await handler(request)
        except web.HTTPException as error:
            set_cors(error)
            raise
        return set_cors(response)

    @web.middleware
    async def static_cache_middleware(request: web.Request, handler):
        response = await handler(request)
        path = request.path
        if path.startswith("/static/") or path.startswith("/admin/"):
            if "Cache-Control" not in response.headers:
                if request.query.get("v"):
                    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
                else:
                    response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    _COMPRESSIBLE_PREFIXES = (
        "text/",
        "application/json",
        "application/javascript",
        "application/xml",
        "image/svg+xml",
    )
    _SKIP_COMPRESS_PATH_PREFIXES = ("/api/stream", "/api/video-stream")

    @web.middleware
    async def compression_middleware(request: web.Request, handler):
        response = await handler(request)
        if any(request.path.startswith(p) for p in _SKIP_COMPRESS_PATH_PREFIXES):
            return response
        accept = request.headers.get("Accept-Encoding", "")
        if "gzip" not in accept and "deflate" not in accept:
            return response
        ctype = (response.headers.get("Content-Type") or "").lower()
        if any(ctype.startswith(prefix) for prefix in _COMPRESSIBLE_PREFIXES):
            try:
                response.enable_compression()
            except Exception:
                pass
        return response

    app = web.Application(middlewares=[cors_middleware, static_cache_middleware, compression_middleware])

    async def index(_: web.Request) -> web.FileResponse:
        response = web.FileResponse(settings.webapp_dir / "index.html")
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response

    async def service_worker(_: web.Request) -> web.FileResponse:
        response = web.FileResponse(settings.webapp_dir / "sw.js")
        response.headers["Cache-Control"] = "no-cache, must-revalidate"
        response.headers["Service-Worker-Allowed"] = "/"
        return response

    async def movies(_: web.Request) -> web.Response:
        return json_response(load_movies(settings.movies_path))

    async def users(_: web.Request) -> web.Response:
        return json_response(load_users(settings.users_path))

    async def youtube_movies(_: web.Request) -> web.Response:
        response = json_response(await fetch_youtube_movies())
        response.headers["Cache-Control"] = "s-maxage=60, stale-while-revalidate=300"
        return response

    async def video_url(request: web.Request) -> web.Response:
        telegram_file = await get_telegram_file(settings, request.match_info.get("fileId", ""))
        return json_response(
            {
                "ok": True,
                "videoUrl": f"/api/stream/{request.match_info.get('fileId', '')}",
                "filePath": telegram_file["filePath"],
                "fileSize": telegram_file["fileSize"],
            }
        )

    async def stream_video(request: web.Request) -> web.StreamResponse:
        telegram_file = await get_telegram_file(settings, request.match_info.get("fileId", ""))
        headers = {}
        if request.headers.get("Range"):
            headers["Range"] = request.headers["Range"]

        async with ClientSession() as session:
            async with session.get(telegram_file["downloadUrl"], headers=headers) as upstream:
                if upstream.status not in (200, 206):
                    return json_response(
                        {
                            "ok": False,
                            "code": "TELEGRAM_STREAM_FETCH_FAILED",
                            "error": "Telegram video faylini yuklab bo'lmadi.",
                        },
                        status=upstream.status,
                    )

                response = web.StreamResponse(status=upstream.status)
                for header in ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"):
                    value = upstream.headers.get(header)
                    if value:
                        response.headers[header] = value
                response.headers["Cache-Control"] = "private, max-age=0, no-store"
                set_cors(response)
                await response.prepare(request)

                async for chunk in upstream.content.iter_chunked(64 * 1024):
                    await response.write(chunk)
                await response.write_eof()
                return response

    async def health(_: web.Request) -> web.Response:
        return json_response({"ok": True, "mode": "local-bot"})

    async def get_settings(_: web.Request) -> web.Response:
        settings_data = load_settings_json(settings.webapp_dir.parent / "data" / "settings.json")
        return json_response(settings_data)

    async def post_settings(request: web.Request) -> web.Response:
        try:
            body = await request.json()
            settings_path = settings.webapp_dir.parent / "data" / "settings.json"
            updated = save_settings_json(settings_path, body)
            return json_response({"ok": True, **updated})
        except Exception as e:
            return json_response({"ok": False, "error": str(e)}, status=500)

    def _settings_path() -> Any:
        return settings.webapp_dir.parent / "data" / "settings.json"

    app.router.add_get("/", index)
    app.router.add_get("/sw.js", service_worker)
    app.router.add_get("/api/movies", movies)
    app.router.add_get("/api/users", users)
    app.router.add_get("/api/settings", get_settings)
    app.router.add_post("/api/settings", post_settings)
    app.router.add_get("/api/youtube/movies", youtube_movies)
    app.router.add_get("/api/video-url/{fileId}", video_url)
    app.router.add_get("/api/stream/{fileId}", stream_video)
    app.router.add_get("/api/video-stream/{fileId}", stream_video)
    app.router.add_get("/health", health)
    app.router.add_static("/static", settings.webapp_dir)
    app.router.add_static("/admin", settings.webapp_dir / "admin")
    return app
