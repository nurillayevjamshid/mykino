const { setCors, readCatalogMetadata, writeCatalogMetadata } = require("./_lib/google-drive");

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

function normalizePublicImageUrl(value) {
  const raw = trimString(value);
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:[a-z0-9-]+\.)*(?:public\.)?blob\.vercel-storage\.com\//i.test(raw)) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    const error = new Error("Rasm URL noto'g'ri. Vercel Blob'dan olingan https linkni kiriting.");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const error = new Error("Rasm URL faqat http yoki https bo'lishi kerak.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.href;
}

function readStoredPublicImageUrl(value) {
  try {
    return normalizePublicImageUrl(value);
  } catch {
    return "";
  }
}

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data.settings || {};

    if (request.method === "GET") {
      response.status(200).json({ splashImageUrl: readStoredPublicImageUrl(settings.splashImageUrl || "") });
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const splashImageUrl = normalizePublicImageUrl(body.splashImageUrl || "");

      // Update settings in metadata
      metadataState.data.settings = { ...settings, splashImageUrl };
      await writeCatalogMetadata(metadataState.data, metadataState.file);

      response.status(200).json({ ok: true, splashImageUrl });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(500).json({ ok: false, error: err.message });
  }
};
