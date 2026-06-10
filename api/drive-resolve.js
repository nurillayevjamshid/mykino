const { authorizeRequest } = require("./_lib/auth");
const { getAccessToken } = require("./_lib/google-drive");

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

function getFileId(request) {
  return String(request.query?.fileId || request.query?.id || "").trim();
}

async function resolveDirectUrl(fileId) {
  const token = await getAccessToken();
  const url = new URL(`${DRIVE_API_BASE}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");

  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Range: "bytes=0-0",
    },
    redirect: "manual",
  });

  try { upstream.body?.cancel?.(); } catch (_) {}

  if (upstream.status >= 300 && upstream.status < 400) {
    const location = upstream.headers.get("location");
    if (location) return location;
  }
  return null;
}

module.exports = async function handler(request, response) {
  if (!(await authorizeRequest(request, response))) {
    return;
  }
  if (request.method !== "GET") {
    response.status(405).json({ ok: false, error: "Faqat GET." });
    return;
  }

  try {
    const fileId = getFileId(request);
    if (!fileId) {
      response.status(400).json({ ok: false, code: "FILE_ID_MISSING", error: "fileId kerak." });
      return;
    }

    const directUrl = await resolveDirectUrl(fileId);
    if (!directUrl) {
      response.status(502).json({ ok: false, code: "RESOLVE_FAILED", error: "Drive direct URL olinmadi." });
      return;
    }

    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.status(200).json({ ok: true, url: directUrl });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "DRIVE_RESOLVE_FAILED",
      error: error.message || "Drive resolve xato.",
    });
  }
};

module.exports.config = { maxDuration: 10 };
