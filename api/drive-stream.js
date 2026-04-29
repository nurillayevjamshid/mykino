const { Readable } = require("stream");
const { getDriveMediaResponse, setCors } = require("./_lib/google-drive");

function getFileId(request) {
  return String(request.query?.fileId || request.query?.id || "").trim();
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

  try {
    const fileId = getFileId(request);
    if (!fileId) {
      response.status(400).json({ ok: false, code: "FILE_ID_MISSING", error: "fileId ko'rsatilmagan." });
      return;
    }

    const headers = {};
    if (request.headers.range) headers.Range = request.headers.range;
    const upstream = await getDriveMediaResponse(fileId, headers);

    for (const header of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }

    response.setHeader("Content-Disposition", "inline");
    if (!response.getHeader("accept-ranges")) response.setHeader("Accept-Ranges", "bytes");
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
      code: error.code || "GOOGLE_DRIVE_STREAM_FAILED",
      error: error.message || "Video manbasi hozircha tayyor emas.",
    });
  }
};
