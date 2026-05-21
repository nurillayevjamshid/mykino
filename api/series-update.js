const { setCors, updateCatalogSeriesMetadata } = require("./_lib/google-drive");

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

const SERIES_DESCRIPTION_MAX_LENGTH = 4000;

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
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "UPDATE_FAILED",
      error: error.message || "Serial yangilashda xatolik.",
    });
  }
};
