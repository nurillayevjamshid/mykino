const crypto = require("crypto");
const { uploadImageToR2 } = require("./_lib/r2-store");

// In-memory fallback cache (agar R2 ulanmagan bo'lsa yoki tezkor uzatish uchun)
// Map: id -> { buffer: Buffer, expiresAt: number }
const memoryStoryCache = new Map();

function cleanMemoryCache() {
  const now = Date.now();
  for (const [key, item] of memoryStoryCache.entries()) {
    if (item.expiresAt < now) {
      memoryStoryCache.delete(key);
    }
  }
}

let redisPromise = null;
async function getRedis() {
  if (redisPromise) {
    try { const c = await redisPromise; if (c?.isOpen) return c; } catch (_) {}
    redisPromise = null;
  }
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if (!redisUrl) return null;
  redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url: redisUrl });
    client.on("error", () => {});
    await client.connect();
    return client;
  })().catch(() => null);
  return await redisPromise;
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    try {
      const parsed = new URL(proxyUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        response.status(400).end("Invalid protocol");
        return;
      }
      const upstream = await fetch(parsed.toString(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; NTVCinema/1.0)" },
      });
      if (!upstream.ok) {
        response.status(upstream.status).end("Upstream fetch failed");
        return;
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      response.setHeader("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
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
      response.setHeader("Content-Type", "image/jpeg");
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
    let body = request.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
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
    const base64Data = dataUrl.replace(/^data:image\/[\w.+-]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uniqueId = `sc_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Xotiraga 2 soatga saqlash
    memoryStoryCache.set(uniqueId, {
      buffer,
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
