const { Readable } = require("stream");
const { getFileId, getTelegramFile, setCors } = require("./telegram-file");

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const fileId = getFileId(request, "stream");
    const telegramFile = await getTelegramFile(fileId);
    const headers = {};
    if (request.headers.range) headers.Range = request.headers.range;

    const upstream = await fetch(telegramFile.downloadUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      response.status(upstream.status).json({
        ok: false,
        code: "TELEGRAM_STREAM_FETCH_FAILED",
        error: "Telegram video faylini yuklab bo'lmadi.",
      });
      return;
    }

    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    response.setHeader("Cache-Control", "private, max-age=0, no-store");
    response.status(upstream.status);

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(response);
    } else {
      response.end();
    }
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "STREAM_FAILED",
      error:
        error.message ||
        "Bu video Telegram cheklovi sabab Mini App ichida ochilmadi. Telegramda ochish tugmasidan foydalaning.",
    });
  }
};

module.exports.config = { maxDuration: 60 };
