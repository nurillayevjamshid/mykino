const { Readable } = require("stream");
const { getDriveMediaResponse, getAccessToken, setCors } = require("./_lib/google-drive");

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

const DIRECT_URL_TTL_MS = 30 * 60 * 1000;
const directUrlCache = new Map();

function getFileId(request) {
  return String(request.query?.fileId || request.query?.id || "").trim();
}

function getCachedDirectUrl(fileId) {
  const entry = directUrlCache.get(fileId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    directUrlCache.delete(fileId);
    return null;
  }
  return entry.url;
}

function setCachedDirectUrl(fileId, url) {
  directUrlCache.set(fileId, { url, expiresAt: Date.now() + DIRECT_URL_TTL_MS });
  if (directUrlCache.size > 500) {
    const firstKey = directUrlCache.keys().next().value;
    if (firstKey) directUrlCache.delete(firstKey);
  }
}

async function resolveDriveDirectUrl(fileId) {
  const cached = getCachedDirectUrl(fileId);
  if (cached) return cached;

  const token = await getAccessToken();
  const url = new URL(`${DRIVE_API_BASE}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Range: "bytes=0-0",
    },
    redirect: "manual",
  });

  try { upstream.body?.cancel?.(); } catch (_) {}

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) {
      setCachedDirectUrl(fileId, location);
      return location;
    }
  }
  return null;
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  try {
    const fileId = getFileId(request);
    if (!fileId) {
      response.status(400).json({ ok: false, code: "FILE_ID_MISSING", error: "fileId ko'rsatilmagan." });
      return;
    }

    const forceProxy = String(request.query?.proxy || "") === "1";

    if (!forceProxy) {
      try {
        const directUrl = await resolveDriveDirectUrl(fileId);
        if (directUrl) {
          response.setHeader("Cache-Control", "public, max-age=1500");
          response.setHeader("Location", directUrl);
          response.status(302).end();
          return;
        }
      } catch (_) {
        // fall through to proxy mode
      }
    }

    const headers = {};
    if (request.headers.range) headers.Range = request.headers.range;
    const upstream = await getDriveMediaResponse(fileId, headers);

    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }

    response.setHeader("Content-Disposition", "inline");
    if (!response.getHeader("accept-ranges")) response.setHeader("Accept-Ranges", "bytes");
    response.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    response.status(upstream.status);

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "GOOGLE_DRIVE_STREAM_FAILED",
      error: error.message || "Video manbasi hozircha tayyor emas.",
    });
  }
};

module.exports.config = { maxDuration: 60 };
