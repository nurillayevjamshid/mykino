const crypto = require("crypto");
const { uploadImageToR2 } = require("./_lib/r2-store");

// In-memory fallback cache (agar R2 ulanmagan bo'lsa yoki tezkor uzatish uchun)
// Map: id -> { buffer: Buffer, expiresAt: number }
const memoryStoryCache = new Map();

// Proxy faqat rasm uchun: aks holda u istalgan HTML/JS'ni bizning domen
// nomidan ko'rsatib berardi (admin cookie'si bor sahifada XSS). SVG ichida
// skript bo'lishi mumkin, shuning uchun u ham ruxsat etilmaydi.
const PROXY_MAX_BYTES = 10 * 1024 * 1024;
const PROXY_IMAGE_TYPE_RE = /^image\/(jpeg|jpg|png|webp|gif|avif)$/i;

function isPrivateHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) return host.includes(":");
  return false;
}

function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, item] of memoryStoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryStoryCache.delete(key);
    }
  }
}

// Barcha bo'limlar bitta umumiy Redis ulanishidan foydalanadi (api/_lib/kv.js):
// har modul o'z ulanishini ochganda bitta serverless instansiya 8+ ulanish
// ochar va ko'p foydalanuvchida Redis ulanish limitiga urilardi.
function getRedis() {
  return require("./_lib/kv").getRedisClient();
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
}

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

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  // 1. GET /api/story-card?proxy=<url> (Brauzer canvas CORS cheklovini aylanib o'tish uchun)
  const proxyUrl = String(request.query?.proxy || "").trim();
  if (proxyUrl && request.method === "GET") {
    let parsed;
    try {
      parsed = new URL(proxyUrl);
    } catch (_) {
      response.status(400).end("Invalid URL");
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      response.status(400).end("Invalid protocol");
      return;
    }
    if (isPrivateHostname(parsed.hostname)) {
      response.status(400).end("Invalid host");
      return;
    }
    try {
      const upstream = await fetch(parsed.toString(), {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: parsed.origin,
        },
        redirect: "follow",
      });
      if (!upstream.ok) {
        response.status(upstream.status).end("Upstream fetch failed");
        return;
      }
      // Ba'zi CDN'lar rasmni octet-stream deb beradi — uni jpeg deb belgilaymiz
      // (nosniff bilan brauzer uni hech qachon HTML sifatida ochmaydi).
      let contentType = String(upstream.headers.get("content-type") || "").split(";")[0].trim();
      if (/^(application|binary)\/octet-stream$/i.test(contentType)) contentType = "image/jpeg";
      if (!PROXY_IMAGE_TYPE_RE.test(contentType)) {
        response.status(415).end("Only images");
        return;
      }
      if (Number(upstream.headers.get("content-length") || 0) > PROXY_MAX_BYTES) {
        response.status(413).end("Too large");
        return;
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length > PROXY_MAX_BYTES) {
        response.status(413).end("Too large");
        return;
      }
      response.setHeader("Content-Type", contentType);
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
      response.status(200).end(buffer);
      return;
    } catch (err) {
      response.status(502).end("Proxy error");
      return;
    }
  }

  // 2. GET /api/story-card?id=<id> (Telegram Story yuklab olishi uchun)
  const storyId = String(request.query?.id || "").trim();
  if (storyId && request.method === "GET") {
    cleanMemoryCache();

    // 2a. Xotiradan tekshirish
    const cachedMem = memoryStoryCache.get(storyId);
    if (cachedMem && cachedMem.buffer) {
      response.setHeader("Content-Type", cachedMem.contentType || "image/jpeg");
      response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
      response.status(200).end(cachedMem.buffer);
      return;
    }

    // 2b. Redis'dan tekshirish
    try {
      const redis = await getRedis();
      if (redis) {
        const base64 = await redis.get(`story:${storyId}`);
        if (base64) {
          const buffer = Buffer.from(base64, "base64");
          response.setHeader("Content-Type", "image/jpeg");
          response.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
          response.status(200).end(buffer);
          return;
        }
      }
    } catch (_) {}

    response.status(404).end("Story card not found");
    return;
  }

  // 3. POST /api/story-card (Canvas orqali chizilgan rasmni qabul qilish va URL qaytarish)
  if (request.method === "POST") {
    let body = {};
    try {
      body = await readRequestBody(request);
    } catch (_) {
      body = {};
    }
    const dataUrl = String(body?.image || "").trim();
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      response.status(400).json({ ok: false, error: "image dataUrl majburiy" });
      return;
    }

    const movieSlug = String(body?.id || "card").replace(/[^\w-]/g, "");

    // 3a. Birinchi navbatda Cloudflare R2'ga yuklashga urinib ko'rish
    try {
      const upload = await uploadImageToR2(dataUrl, `story-${movieSlug}`);
      if (upload?.directUrl) {
        response.status(200).json({ ok: true, url: upload.directUrl, storage: "r2" });
        return;
      }
    } catch (r2Err) {
      console.warn("R2 story upload fallback:", r2Err.message);
    }

    // 3b. R2 yo'q bo'lsa yoki xato bersa — Redis / Xotira orqali public URL taqdim etish
    const mimeMatch = dataUrl.match(/^data:(image\/[\w.+-]+);base64,/);
    const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const base64Data = dataUrl.replace(/^data:image\/[\w.+-]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uniqueId = `sc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Xotiraga 2 soatga saqlash
    memoryStoryCache.set(uniqueId, {
      buffer,
      contentType,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });

    // Redis mavjud bo'lsa, Redis'ga ham 2 soatga saqlash
    try {
      const redis = await getRedis();
      if (redis) {
        await redis.set(`story:${uniqueId}`, base64Data, { EX: 7200 });
      }
    } catch (_) {}

    const host = request.headers["x-forwarded-host"] || request.headers.host || "mykino.uz";
    const proto = request.headers["x-forwarded-proto"] || "https";
    const publicUrl = `${proto}://${host}/api/story-card?id=${uniqueId}`;

    response.status(200).json({ ok: true, url: publicUrl, storage: "cache" });
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed" });
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
