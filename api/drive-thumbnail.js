const { LOGO_POSTER_URL, getAccessToken, getDriveFileMetadata } = require("./_lib/google-drive");
const { verifySignedToken, isOriginAllowed, setCorsHeaders } = require("./_lib/auth");

function getFileId(request) {
  return String(request.query?.fileId || request.query?.id || "").trim();
}

// Ruxsat etilgan R2 host'lari (ochiq proxy bo'lib qolmasligi uchun).
function allowedR2Hosts() {
  const hosts = new Set();
  const pub = String(process.env.R2_PUBLIC_URL || "").trim();
  if (pub) {
    try { hosts.add(new URL(pub).host); } catch (_) { /* ignore */ }
  }
  return hosts;
}

// R2 rasmini Vercel orqali proxy qilib, kuchli kesh bilan stream qiladi.
// Brauzer r2.dev'ga emas, o'z domenimizga uradi -> r2.dev burst-throttle (403) yo'qoladi.
async function proxyR2Image(request, response, rawUrl) {
  let target;
  try {
    target = new URL(rawUrl);
  } catch (_) {
    response.status(400).end("bad url");
    return;
  }
  const allowed = allowedR2Hosts();
  // R2_PUBLIC_URL sozlanmagan bo'lsa ham, faqat *.r2.dev domenlariga ruxsat.
  const isR2Dev = /\.r2\.dev$/i.test(target.host);
  if (!allowed.has(target.host) && !isR2Dev) {
    response.status(403).end("forbidden host");
    return;
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok) {
    response.writeHead(307, { Location: LOGO_POSTER_URL });
    response.end();
    return;
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
  // Vercel edge'da uzoq kesh: rasm o'zgarmas (URL'da unikal hash bor).
  response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800, immutable");
  response.status(200).end(buffer);
}

module.exports = async function handler(request, response) {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  const referer = request.headers.referer;
  const origin = request.headers.origin;

  let isClientAllowed = false;
  if (origin && isOriginAllowed(origin)) {
    isClientAllowed = true;
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (isOriginAllowed(refOrigin)) {
        isClientAllowed = true;
      }
    } catch (_) {}
  }

  // R2 proxy rejimi: /api/drive-thumbnail?u=<r2-url>
  const proxyUrl = String(request.query?.u || "").trim();
  if (proxyUrl) {
    if (!isClientAllowed) {
      response.status(403).end("forbidden");
      return;
    }
    try {
      await proxyR2Image(request, response, proxyUrl);
    } catch (_) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
    }
    return;
  }

  try {
    const fileId = getFileId(request);
    if (!fileId) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    if (!isClientAllowed) {
      const token = request.query?.token;
      const botToken = process.env.BOT_TOKEN;
      if (!verifySignedToken(fileId, token, botToken)) {
        response.writeHead(307, { Location: LOGO_POSTER_URL });
        response.end();
        return;
      }
    }

    const metadata = await getDriveFileMetadata(fileId, "id,name,thumbnailLink");
    if (!metadata.thumbnailLink) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    const token = await getAccessToken();
    const upstream = await fetch(metadata.thumbnailLink, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!upstream.ok) {
      response.writeHead(307, { Location: LOGO_POSTER_URL });
      response.end();
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
    response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800, immutable");
    response.status(200).end(buffer);
  } catch {
    response.writeHead(307, { Location: LOGO_POSTER_URL });
    response.end();
  }
};
