from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from aiohttp import ClientSession, web

try:
    from aiohttp_client_cache import CachedSession
except ImportError:  # pragma: no cover - optional local dependency
    CachedSession = ClientSession

from .config import Settings
from .storage import load_movies, load_users, save_movies, save_users


def get_env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def set_cors(response: web.StreamResponse) -> web.StreamResponse:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Id"
    return response


def json_response(payload: Any, status: int = 200) -> web.Response:
    return set_cors(web.json_response(payload, status=status))


async def read_json_body(request: web.Request) -> dict[str, Any]:
    if request.can_read_body:
        try:
            payload = await request.json()
            return payload if isinstance(payload, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


def resolve_admin_id(request: web.Request, payload: dict[str, Any] | None = None) -> int:
    raw = (
        (payload or {}).get("adminId")
        or request.query.get("adminId", "")
        or request.headers.get("X-Admin-Id", "")
    )
    return int(str(raw).strip()) if str(raw).strip().isdigit() else 0


def ensure_admin(request: web.Request, settings: Settings, payload: dict[str, Any] | None = None) -> int:
    admin_id = resolve_admin_id(request, payload)
    if admin_id not in settings.admin_ids:
        raise web.HTTPForbidden(
            text=json.dumps({
                "ok": False,
                "code": "ADMIN_REQUIRED",
                "error": "Bu endpoint faqat admin uchun.",
            }),
            content_type="application/json",
        )
    return admin_id


def safe_rating(value: Any) -> float:
    try:
        numeric = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(10.0, round(numeric, 1)))


def upsert_local_user(settings: Settings, user: dict[str, Any]) -> dict[str, Any]:
    raw_user_id = str(user.get("id") or "").strip()
    user_id = int(raw_user_id) if raw_user_id.isdigit() else 0
    if user_id <= 0:
        raise web.HTTPBadRequest(
            text=json.dumps({
                "ok": False,
                "code": "TRACK_USER_ID_REQUIRED",
                "error": "Foydalanuvchi ID topilmadi.",
            }),
            content_type="application/json",
        )

    users = load_users(settings.users_path)
    now = datetime.now(timezone.utc).isoformat()
    existing_index = next((index for index, item in enumerate(users) if int(item.get("id", 0)) == user_id), None)
    existing = users[existing_index] if existing_index is not None else {}
    record = {
        "id": user_id,
        "username": str(user.get("username") or existing.get("username") or "").strip(),
        "firstName": str(user.get("first_name") or user.get("firstName") or existing.get("firstName") or "").strip(),
        "lastName": str(user.get("last_name") or user.get("lastName") or existing.get("lastName") or "").strip(),
        "photoUrl": str(user.get("photo_url") or user.get("photoUrl") or existing.get("photoUrl") or "").strip(),
        "firstSeenAt": existing.get("firstSeenAt") or now,
        "lastSeenAt": now,
    }

    if existing_index is None:
        users.append(record)
    else:
        users[existing_index] = {**existing, **record}

    save_users(settings.users_path, sorted(users, key=lambda item: int(item.get("id", 0))))
    return {
        "userCount": len(users),
        "updatedAt": now,
        "user": record,
    }


def update_local_movie(settings: Settings, payload: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    file_id = str(payload.get("fileId") or "").strip()
    if not file_id:
        raise web.HTTPBadRequest(
            text=json.dumps({
                "ok": False,
                "code": "FILE_ID_REQUIRED",
                "error": "Qaysi kino tahrirlanayotgani aniqlanmadi.",
            }),
            content_type="application/json",
        )

    movies = load_movies(settings.movies_path)
    movie_index = next(
        (
            index
            for index, item in enumerate(movies)
            if str(item.get("id", "")) == file_id
            or str(item.get("fileId", "")) == file_id
            or str(item.get("driveFileId", "")) == file_id
            or str(item.get("code", "")) == file_id
        ),
        None,
    )
    if movie_index is None:
        raise web.HTTPNotFound(
            text=json.dumps({
                "ok": False,
                "code": "MOVIE_NOT_FOUND",
                "error": "Kino topilmadi.",
            }),
            content_type="application/json",
        )

    current = movies[movie_index]
    updated = {
        **current,
        "title": str(payload.get("title") or current.get("title") or "").strip(),
        "genre": str(payload.get("genre") or payload.get("category") or current.get("genre") or "Kino").strip(),
        "description": str(payload.get("description") or current.get("description") or "").strip(),
        "poster": str(payload.get("poster") or current.get("poster") or "").strip(),
        "heroPoster": str(payload.get("heroPoster") or current.get("heroPoster") or "").strip(),
        "quality": str(payload.get("quality") or current.get("quality") or "HD").strip(),
        "rating": safe_rating(payload.get("rating", current.get("rating", 0))),
        "heroFeatured": bool(payload.get("heroFeatured", current.get("heroFeatured", False))),
    }
    movies[movie_index] = updated
    save_movies(settings.movies_path, movies)
    return movies, updated


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

    app = web.Application(middlewares=[cors_middleware])

    async def index(_: web.Request) -> web.FileResponse:
        return web.FileResponse(settings.webapp_dir / "index.html")

    async def movies(_: web.Request) -> web.Response:
        return json_response(load_movies(settings.movies_path))

    async def admin_dashboard(request: web.Request) -> web.Response:
        ensure_admin(request, settings)
        local_movies = load_movies(settings.movies_path)
        local_users = load_users(settings.users_path)
        categories = {str(movie.get("genre") or "Kino").strip() for movie in local_movies}
        return json_response({
            "ok": True,
            "stats": {
                "botUsers": len(local_users),
                "movies": len(local_movies),
                "editedMovies": len(local_movies),
                "categories": len(categories),
                "updatedAt": max(
                    [str(user.get("lastSeenAt") or "") for user in local_users] + [""]
                ),
            },
            "movies": local_movies,
            "users": local_users,
        })

    async def admin_track_user(request: web.Request) -> web.Response:
        payload = await read_json_body(request)
        user = payload.get("user") if isinstance(payload.get("user"), dict) else payload
        result = upsert_local_user(settings, user if isinstance(user, dict) else {})
        return json_response({"ok": True, **result})

    async def admin_movies(request: web.Request) -> web.Response:
        payload = await read_json_body(request)
        ensure_admin(request, settings, payload)
        updated_movies, updated_movie = update_local_movie(settings, payload)
        return json_response({
            "ok": True,
            "movie": updated_movie,
            "movies": updated_movies,
        })

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

    app.router.add_get("/", index)
    app.router.add_get("/api/movies", movies)
    app.router.add_get("/api/admin/dashboard", admin_dashboard)
    app.router.add_post("/api/admin/track-user", admin_track_user)
    app.router.add_post("/api/admin/movies", admin_movies)
    app.router.add_get("/api/youtube/movies", youtube_movies)
    app.router.add_get("/api/video-url/{fileId}", video_url)
    app.router.add_get("/api/stream/{fileId}", stream_video)
    app.router.add_get("/api/video-stream/{fileId}", stream_video)
    app.router.add_get("/health", health)
    app.router.add_static("/static", settings.webapp_dir)
    return app
