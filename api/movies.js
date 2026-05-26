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
