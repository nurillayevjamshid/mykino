const { setCors } = require("./_lib/google-drive");

const BLOB_API_BASE = "https://blob.vercel-storage.com";
const MAX_BYTES = 6 * 1024 * 1024; // 6MB

async function readBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  let raw = "";
  if (Buffer.isBuffer(request.body)) raw = request.body.toString("utf8");
  else if (typeof request.body === "string") raw = request.body;
  else {
    for await (const chunk of request) raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) return null;
  const contentType = m[1] || "application/octet-stream";
  const buffer = Buffer.from(m[2], "base64");
  return { contentType, buffer };
}

function extFromContentType(ct) {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  return map[ct] || "bin";
}

async function uploadToBlob(pathname, buffer, contentType) {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    const err = new Error("Vercel Blob tokeni (BLOB_READ_WRITE_TOKEN) topilmadi.");
    err.statusCode = 500;
    throw err;
  }
  const url = new URL(`${BLOB_API_BASE}/${pathname.replace(/^\/+/, "")}`);
  url.searchParams.set("addRandomSuffix", "1");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "Content-Type": contentType,
      "x-content-type": contentType,
      "x-add-random-suffix": "1",
    },
    body: buffer,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    const err = new Error(payload?.error?.message || "Blob upload muvaffaqiyatsiz.");
    err.statusCode = response.status || 502;
    throw err;
  }
  return payload.url;
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Faqat POST." });
    return;
  }

  try {
    const body = await readBody(request);
    const dataUrl = body.dataUrl || body.image || "";
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      response.status(400).json({ ok: false, error: "dataUrl (base64 image) kerak." });
      return;
    }
    if (parsed.buffer.length > MAX_BYTES) {
      response.status(413).json({ ok: false, error: "Rasm 6MB dan katta." });
      return;
    }
    const folder = String(body.folder || "uploads").replace(/[^a-z0-9/_-]/gi, "");
    const ext = extFromContentType(parsed.contentType);
    const baseName = String(body.name || "image").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "image";
    const pathname = `${folder || "uploads"}/${Date.now()}-${baseName}.${ext}`;
    const url = await uploadToBlob(pathname, parsed.buffer, parsed.contentType);
    response.status(200).json({ ok: true, url });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
  }
};
