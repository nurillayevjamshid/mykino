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

    const fileId = String(payload.fileId || "").trim();
    if (!fileId) {
      response.status(400).json({
        ok: false,
        code: "FILE_ID_REQUIRED",
        error: "Qaysi kino tahrirlanayotgani aniqlanmadi.",
      });
      return;
    }

    await upsertCatalogMovieMetadata(fileId, payload);
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
