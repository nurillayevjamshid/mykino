const crypto = require("crypto");
const {
  listDriveMovies,
  listDriveSeries,
  updateCatalogSeriesMetadata,
  setCors,
} = require("./_lib/google-drive");

const SERIES_DESCRIPTION_MAX_LENGTH = 4000;

async function readRequestBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString("utf8"));
  }
  if (request.body && typeof request.body === "string") {
    return JSON.parse(request.body);
  }
  if (request.body && typeof request.body === "object") {
    return request.body;
  }
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function trimString(value) {
  return String(value || "").trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function sendJsonWithEtag(request, response, payload) {
  const body = JSON.stringify(payload);
  const etag = `W/"${crypto.createHash("sha1").update(body).digest("base64")}"`;
  const ifNoneMatch = String(request.headers?.["if-none-match"] || "").trim();
  response.setHeader("ETag", etag);
  if (ifNoneMatch && ifNoneMatch === etag) {
    response.status(304).end();
    return;
  }
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.status(200).send(body);
}

async function handleMoviesList(request, response) {
  let movies = [];
  try {
    movies = await listDriveMovies();
  } catch (driveError) {
    console.error("Google Drive error, falling back to local JSON:", driveError.message);
    const fs = require("fs");
    const path = require("path");
    const localPath = path.join(process.cwd(), "data", "movies.json");
    if (fs.existsSync(localPath)) {
      movies = JSON.parse(fs.readFileSync(localPath, "utf8"));
    } else {
      throw driveError;
    }
  }
  sendJsonWithEtag(request, response, movies);
}

async function handleSeriesList(request, response) {
  const series = await listDriveSeries();
  sendJsonWithEtag(request, response, series);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(request, value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const host = request.headers?.["x-forwarded-host"] || request.headers?.host || "kino-telegram-mini-app.vercel.app";
  const proto = request.headers?.["x-forwarded-proto"] || "https";
  return `${proto}://${host}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function handleSharePage(request, response) {
  const code = trimString(request.query?.movie || "").toUpperCase();
  const webappBase = "https://kino-telegram-mini-app.vercel.app";
  const targetUrl = code ? `${webappBase}?movie=${encodeURIComponent(code)}` : webappBase;

  let movie = null;
  if (code) {
    try {
      const movies = await listDriveMovies();
      movie = movies.find((m) => String(m.code || "").toUpperCase() === code) || null;
    } catch (_) {
      movie = null;
    }
  }

  const title = movie ? `🎬 ${movie.title}` : "MY PLAYLIST — Kinolar to'plami";
  const genre = trimString(movie?.genre || "");
  const year = trimString(movie?.year || "");
  const metaLine = [year, genre].filter(Boolean).join(" • ");
  const description = movie
    ? (metaLine ? `${metaLine} — MY PLAYLIST'da bepul tomosha qiling 🍿` : "MY PLAYLIST'da bepul tomosha qiling 🍿")
    : "Eng so'nggi kinolar, seriallar va musiqalar bir joyda. Hoziroq tomosha qiling 🍿";
  const posterRel = trimString(movie?.cdnUrl) || trimString(movie?.posterImage) || "/static/assets/og-default.png";
  const posterUrl = absoluteUrl(request, posterRel);
  const pageUrl = absoluteUrl(request, request.url || "/");

  const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="video.movie">
<meta property="og:site_name" content="MY PLAYLIST">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(posterUrl)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(posterUrl)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
<style>body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d12;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}a{color:#3b82f6}</style>
</head>
<body>
<div>
<h2>${escapeHtml(title)}</h2>
<p>MY PLAYLIST ochilmoqda…</p>
<p><a href="${escapeHtml(targetUrl)}">Agar avtomatik ochilmasa, shu yerga bosing</a></p>
</div>
</body>
</html>`;

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600");
  response.status(200).send(html);
}

async function handleSeriesUpdate(request, response) {
  const body = await readRequestBody(request);
  const id = trimString(body.id || body.folderId);

  if (!id) {
    response.status(400).json({ ok: false, code: "MISSING_ID", error: "Serial ID si kerak." });
    return;
  }

  const updates = {};
  if (hasOwn(body, "title")) updates.title = body.title;
  if (hasOwn(body, "description")) {
    const description = trimString(body.description);
    if (description.length > SERIES_DESCRIPTION_MAX_LENGTH) {
      response.status(400).json({
        ok: false,
        code: "DESCRIPTION_TOO_LONG",
        error: `Tavsif juda uzun. Maksimal: ${SERIES_DESCRIPTION_MAX_LENGTH} ta belgi.`,
      });
      return;
    }
    updates.description = description;
  }
  if (hasOwn(body, "posterImage")) updates.posterImage = body.posterImage;
  if (!hasOwn(body, "posterImage") && hasOwn(body, "poster")) updates.posterImage = body.poster;
  if (body.episodes && typeof body.episodes === "object" && !Array.isArray(body.episodes)) {
    updates.episodes = body.episodes;
  }
  if (body.episodeSeasons && typeof body.episodeSeasons === "object" && !Array.isArray(body.episodeSeasons)) {
    updates.episodeSeasons = body.episodeSeasons;
  }

  const saved = await updateCatalogSeriesMetadata(id, updates);
  const override = saved.override;

  response.status(200).json({
    ok: true,
    message: "Serial bazada yangilandi.",
    series: {
      id,
      folderId: id,
      title: trimString(override.title),
      description: trimString(override.description),
      posterImage: trimString(override.posterImage),
      poster: trimString(override.posterImage),
    },
  });
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const isShare = String(request.query?._share || "") === "1"
    || /[?&]_share=1/.test(request.url || "");
  const isSeries = String(request.query?._series || "") === "1"
    || /[?&]_series=1/.test(request.url || "");

  if (request.method === "GET") {
    // CDN'da 60s kesh, 5 daqiqa stale-while-revalidate.
    // Brauzer/SW darrov tekshiradi (max-age=0), ammo CDN/Vercel javobni darrov beradi.
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    response.setHeader("Vary", "Accept-Encoding");
  } else {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  }

  try {
    if (isShare && request.method === "GET") {
      await handleSharePage(request, response);
      return;
    }
    if (isSeries) {
      if (request.method === "GET") {
        await handleSeriesList(request, response);
        return;
      }
      if (request.method === "PUT" || request.method === "POST") {
        await handleSeriesUpdate(request, response);
        return;
      }
      response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET/PUT ishlaydi." });
      return;
    }

    if (request.method !== "GET") {
      response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
      return;
    }
    await handleMoviesList(request, response);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "REQUEST_FAILED",
      error: error.message || "So'rov bajarilmadi.",
    });
  }
};
