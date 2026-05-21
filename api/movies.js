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

async function handleMoviesList(response) {
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
  response.status(200).json(movies);
}

async function handleSeriesList(response) {
  const series = await listDriveSeries();
  response.status(200).json(series);
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

  response.setHeader("Cache-Control", "no-store, max-age=0");

  const isSeries = String(request.query?._series || "") === "1"
    || /[?&]_series=1/.test(request.url || "");

  try {
    if (isSeries) {
      if (request.method === "GET") {
        await handleSeriesList(response);
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
    await handleMoviesList(response);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "REQUEST_FAILED",
      error: error.message || "So'rov bajarilmadi.",
    });
  }
};
