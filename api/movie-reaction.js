const {
  getMovieReaction,
  setMovieReaction,
  addMovieComment,
  listMovieComments,
  setCors,
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

function getAction(request, body) {
  return String(request.query?.action || body?.action || "").trim().toLowerCase();
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (request.method === "GET") {
      const action = getAction(request, null);
      const id = String(request.query?.id || "").trim();
      const userId = String(request.query?.userId || "").trim();
      if (!id) {
        response.status(400).json({ ok: false, code: "MISSING_ID", error: "Kino ID si kerak." });
        return;
      }
      if (action === "comments") {
        const data = await listMovieComments(id);
        response.status(200).json({ ok: true, ...data });
        return;
      }
      const data = await getMovieReaction(id, userId);
      response.status(200).json({ ok: true, ...data });
      return;
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await readRequestBody(request);
      const action = getAction(request, body);
      const id = String(body.id || "").trim();
      const userId = String(body.userId || "").trim();
      if (!id) {
        response.status(400).json({ ok: false, code: "MISSING_ID", error: "Kino ID si kerak." });
        return;
      }

      if (action === "comment") {
        if (!userId) {
          response.status(400).json({ ok: false, code: "MISSING_USER", error: "Foydalanuvchi ID si kerak." });
          return;
        }
        const data = await addMovieComment(id, {
          userId,
          userName: body.userName,
          userPhotoUrl: body.userPhotoUrl,
          text: body.text,
        });
        response.status(200).json({ ok: true, ...data });
        return;
      }

      const reaction = body.reaction === "like" || body.reaction === "dislike" ? body.reaction : null;
      if (!userId) {
        response.status(400).json({ ok: false, code: "MISSING_FIELDS", error: "userId kerak." });
        return;
      }
      const data = await setMovieReaction(id, userId, reaction);
      response.status(200).json({ ok: true, ...data });
      return;
    }

    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET/POST ishlaydi." });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "REACTION_FAILED",
      error: error.message || "Saqlanmadi.",
    });
  }
};
