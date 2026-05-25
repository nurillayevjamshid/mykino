const {
  getDriveFileMetadata,
  setCors,
  updateCatalogMovieMetadata,
  listAllPendingComments,
  moderateMovieComment,
  replyMovieComment,
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

const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
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

  response.setHeader("Cache-Control", "no-store, max-age=0");

  // Admin actions for comments moderation
  const action = String(request.query?.action || "").trim().toLowerCase();
  if (action === "pendingcomments" && request.method === "GET") {
    try {
      const password = trimString(request.query?.password);
      const expected = trimString(process.env.ADMIN_PASSWORD) || "admin123";
      if (password !== expected) {
        response.status(401).json({ ok: false, error: "Parol noto'g'ri." });
        return;
      }
      const data = await listAllPendingComments();
      response.status(200).json({ ok: true, ...data });
    } catch (error) {
      response.status(error.statusCode || 500).json({ ok: false, error: error.message });
    }
    return;
  }

  if (request.method !== "PUT" && request.method !== "POST") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat PUT/POST ishlaydi." });
    return;
  }

  try {
    const body = await readRequestBody(request);

    // Admin actions for comments (POST with action)
    const postAction = String(request.query?.action || body.action || "").trim().toLowerCase();
    if (postAction === "moderatecomment" || postAction === "replycomment") {
      const password = trimString(body.password);
      const expected = trimString(process.env.ADMIN_PASSWORD) || "admin123";
      if (password !== expected) {
        response.status(401).json({ ok: false, error: "Parol noto'g'ri." });
        return;
      }
      const movieId = trimString(body.movieId || body.id);
      const commentId = trimString(body.commentId);
      if (!movieId || !commentId) {
        response.status(400).json({ ok: false, error: "movieId va commentId kerak." });
        return;
      }
      if (postAction === "moderatecomment") {
        const data = await moderateMovieComment(movieId, commentId, trimString(body.moderation));
        response.status(200).json({ ok: true, ...data });
      } else {
        const data = await replyMovieComment(movieId, commentId, body.reply || "");
        response.status(200).json({ ok: true, ...data });
      }
      return;
    }

    const id = trimString(body.id || body.fileId || body.driveFileId);

    if (!id) {
      response.status(400).json({ ok: false, code: "MISSING_ID", error: "Kino ID si kerak." });
      return;
    }

    const updates = {};
    if (hasOwn(body, "title")) updates.title = body.title;
    if (hasOwn(body, "genre") || hasOwn(body, "category")) {
      updates.genre = hasOwn(body, "genre") ? body.genre : body.category;
    }
    if (hasOwn(body, "rating")) updates.rating = body.rating;
    if (hasOwn(body, "quality")) updates.quality = body.quality;
    if (hasOwn(body, "posterImage")) updates.posterImage = body.posterImage;
    if (!hasOwn(body, "posterImage") && hasOwn(body, "poster")) updates.poster = body.poster;
    if (hasOwn(body, "headerImage")) {
      updates.headerImage = body.headerImage;
    } else if (hasOwn(body, "heroPoster")) {
      updates.heroPoster = body.heroPoster;
    } else if (hasOwn(body, "headerPoster")) {
      updates.headerPoster = body.headerPoster;
    } else if (hasOwn(body, "heroImage")) {
      updates.heroImage = body.heroImage;
    }
    if (hasOwn(body, "headerCrop")) {
      updates.headerCrop = body.headerCrop && typeof body.headerCrop === "object" ? body.headerCrop : null;
    }
    if (hasOwn(body, "description")) {
      const description = trimString(body.description);
      if (description.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
        response.status(400).json({
          ok: false,
          code: "DESCRIPTION_TOO_LONG",
          error: `Tavsif juda uzun. Maksimal: ${MOVIE_DESCRIPTION_MAX_LENGTH} ta belgi.`,
        });
        return;
      }
      updates.description = description;
    }
    if (hasOwn(body, "year")) updates.year = body.year;
    if (hasOwn(body, "showInHeader")) updates.showInHeader = body.showInHeader;

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
        headerImage: trimString(override.headerImage),
        heroPoster: trimString(override.headerImage),
        showInHeader: Boolean(override.showInHeader),
        heroFeatured: Boolean(override.showInHeader),
        headerCrop: override.headerCrop || null,
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
