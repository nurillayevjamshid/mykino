const { listDriveMovies, updateCatalogMovieMetadata, setCors } = require("./_lib/google-drive");
const { getMp4DurationSeconds } = require("./_lib/mp4-duration");
const crypto = require("crypto");

const MAX_PROBES_PER_REQUEST = 2;
const PROBE_TIMEOUT_MS = 3500;
const recentlyTried = new Set();

async function probeMissingDurations(movies) {
  const candidates = movies.filter((m) =>
    m && m.cdnUrl && (!m.durationMinutes || m.durationMinutes <= 0) && !recentlyTried.has(m.driveFileId || m.id),
  );
  if (!candidates.length) return;

  const slice = candidates.slice(0, MAX_PROBES_PER_REQUEST);
  await Promise.all(slice.map(async (movie) => {
    const id = movie.driveFileId || movie.id;
    recentlyTried.add(id);
    try {
      const seconds = await getMp4DurationSeconds(movie.cdnUrl, { timeoutMs: PROBE_TIMEOUT_MS });
      const minutes = Math.max(1, Math.round(seconds / 60));
      movie.durationMinutes = minutes;
      await updateCatalogMovieMetadata(id, { durationMinutes: minutes });
      console.log(`[duration] ${movie.title || id} -> ${minutes} daqiqa`);
    } catch (error) {
      console.warn(`[duration] ${movie.title || id} probe xato: ${error.message}`);
    }
  }));
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    let movies = [];
    try {
      movies = await listDriveMovies();
    } catch (driveError) {
      console.error("Google Drive error, falling back to local JSON:", driveError.message);
      const fs = require("fs");
      const path = require("path");
      const localPath = path.join(process.cwd(), "data", "movies.json");
      if (fs.existsSync(localPath)) {
        const rawData = fs.readFileSync(localPath, "utf8");
        movies = JSON.parse(rawData);
      } else {
        throw driveError;
      }
    }

    try {
      await probeMissingDurations(movies);
    } catch (probeError) {
      console.warn("[duration] umumiy probe xato:", probeError.message);
    }

    response.status(200).json(movies);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "MOVIES_LOAD_FAILED",
      error: error.message || "Katalog yuklanmadi.",
    });
  }
};
