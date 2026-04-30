const {
  getDriveFileMetadata,
  setCors,
  updateCatalogMovieMetadata,
} = require("./_lib/google-drive");

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

function safeRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(10, Number(numeric.toFixed(1))));
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat PUT/POST ishlaydi." });
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const body = await readRequestBody(request);
    const id = trimString(body.id || body.fileId || body.driveFileId);

    if (!id) {
      response.status(400).json({ ok: false, code: "MISSING_ID", error: "Kino ID si kerak." });
      return;
    }

    const updates = {
      title: body.title,
      genre: body.genre || body.category,
      rating: body.rating,
      quality: body.quality,
      posterImage: body.posterImage !== undefined ? body.posterImage : body.poster,
      description: body.description,
      year: body.year,
      showInHeader: body.showInHeader,
    };

    const saved = await updateCatalogMovieMetadata(id, updates);
    const metadata = await getDriveFileMetadata(id, "id,name,mimeType,thumbnailLink,webViewLink");
    const override = saved.override;
    const posterImage = trimString(override.posterImage);

    response.status(200).json({
      ok: true,
      message: "Kino bazada yangilandi.",
      movie: {
        id,
        fileId: id,
        driveFileId: id,
        fileName: metadata.name || "",
        title: trimString(override.title) || metadata.name || "",
        genre: trimString(override.genre) || "Kino",
        category: trimString(override.genre) || "Kino",
        rating: safeRating(override.rating),
        quality: trimString(override.quality) || "HD",
        posterImage,
        poster: posterImage,
        description: trimString(override.description),
        year: override.year || "",
      },
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "UPDATE_FAILED",
      error: error.message || "Kino yangilashda xatolik.",
    });
  }
};
