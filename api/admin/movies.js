const { ensureAdmin } = require("../_lib/admin-auth");
const { listDriveMovies, setCors, upsertCatalogMovieMetadata } = require("../_lib/google-drive");

async function readJsonBody(request) {
  if (typeof request.body === "object" && request.body !== null) {
    return request.body;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

function normalizeTitle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function hasOwnValue(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeUploadedImage(value, label) {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("data:image/")) return normalized;

  const error = new Error(`${label} faqat device'dan tanlangan rasm fayli bo'lishi kerak.`);
  error.statusCode = 400;
  error.code = "IMAGE_UPLOAD_REQUIRED";
  throw error;
}

function normalizeMoviePayload(payload = {}) {
  const nextPayload = { ...payload };
  const posterValue = hasOwnValue(payload, "posterImage")
    ? payload.posterImage
    : hasOwnValue(payload, "poster")
      ? payload.poster
      : undefined;
  const headerValue = hasOwnValue(payload, "headerImage")
    ? payload.headerImage
    : hasOwnValue(payload, "heroPoster")
      ? payload.heroPoster
      : undefined;

  delete nextPayload.poster;
  delete nextPayload.heroPoster;
  delete nextPayload.headerPoster;
  delete nextPayload.heroImage;
  delete nextPayload.heroFeatured;
  delete nextPayload.isHero;

  const posterImage = normalizeUploadedImage(posterValue, "Poster rasmi");
  const headerImage = normalizeUploadedImage(headerValue, "Header rasmi");
  if (posterImage !== undefined) nextPayload.posterImage = posterImage;
  if (headerImage !== undefined) nextPayload.headerImage = headerImage;
  if (hasOwnValue(payload, "showInHeader")) {
    nextPayload.showInHeader = payload.showInHeader;
  } else if (hasOwnValue(payload, "heroFeatured")) {
    nextPayload.showInHeader = payload.heroFeatured;
  }

  return nextPayload;
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat POST ishlaydi." });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    if (!ensureAdmin(request, response, payload)) {
      return;
    }

    let fileId = String(
      payload.fileId
      || payload.id
      || payload.movieId
      || payload.driveFileId
      || payload.googleDriveFileId
      || "",
    ).trim();

    if (!fileId) {
      const title = String(payload.title || payload.movieTitle || payload.name || "").trim();
      if (title) {
        const catalogMovies = await listDriveMovies();
        const normalizedTitle = normalizeTitle(title);
        const matchedMovie = catalogMovies.find((movie) => normalizeTitle(movie?.title) === normalizedTitle) || null;
        if (matchedMovie?.id) {
          fileId = String(matchedMovie.id);
        }
      }
    }

    if (!fileId) {
      response.status(400).json({
        ok: false,
        code: "FILE_ID_REQUIRED",
        error: "Qaysi kino tahrirlanayotgani aniqlanmadi. Kinoni ro'yxatdan qayta tanlang.",
      });
      return;
    }

    await upsertCatalogMovieMetadata(fileId, normalizeMoviePayload(payload));
    const movies = await listDriveMovies();
    const updatedMovie = movies.find((movie) => String(movie.id) === fileId) || null;

    response.status(200).json({
      ok: true,
      movie: updatedMovie,
      movies,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "ADMIN_MOVIE_SAVE_FAILED",
      error: error.message || "Kino ma'lumotlarini saqlab bo'lmadi.",
    });
  }
};
