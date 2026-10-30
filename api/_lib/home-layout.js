// Mini ilova bosh sahifasi sozlamalari — admin paneldagi "Bosh sahifa" bo'limi.
// music.js'ga delegator orqali chaqiriladi (Vercel 12-funksiya limiti): /api/home
//
// GET  /api/home                  → { ok, layout } (mini ilova keyinchalik shuni o'qiydi)
// POST /api/home {action:"update", layout} → admin: tartib, o'lcham, yoqish/o'chirish, hero, salom
//
// Redis: home:layout:v1 — { sections: [{ id, size, enabled }], hero, greeting, updatedAt }

const LAYOUT_KEY = "home:layout:v1";
const SIZES = ["s", "m", "l"];
const HERO_MODES = ["auto", "manual"];
const GREETING_MAX = 80;
const DEFAULT_GREETING = "Xayrli kun, {ism}";

// Tartib shu ro'yxatdagidek boshlanadi; hozir mini ilovada ko'rinmaydigan
// bo'limlar (Kibersport, TV) o'chiq turadi.
const SECTIONS = [
  { id: "kino", size: "l", enabled: true },
  { id: "fifa", size: "m", enabled: true },
  { id: "boks", size: "s", enabled: true },
  { id: "music", size: "s", enabled: true },
  { id: "podcasts", size: "s", enabled: true },
  { id: "favorites", size: "s", enabled: true },
  { id: "esports", size: "s", enabled: false },
  { id: "tv", size: "s", enabled: false },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

let _redisPromise = null;
async function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (_redisPromise) {
    try { const c = await _redisPromise; if (c?.isOpen) return c; } catch (_) {}
    _redisPromise = null;
  }
  _redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.error("redis (home) error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await _redisPromise;
  } catch (err) {
    console.warn("home redis ulanmadi:", err.message);
    _redisPromise = null;
    return null;
  }
}

function str(value, max) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max);
}

// Saqlangan tartibni hurmat qiladi: noma'lum bo'limlar tashlab yuboriladi,
// takrorlar olib tashlanadi, yangi qo'shilgan bo'limlar oxiriga standart
// holatda tushadi — shunda har doim har bir bo'lim aynan bir marta bo'ladi.
function normalizeSections(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((item) => {
    const id = str(item && item.id, 32);
    if (!SECTION_IDS.includes(id) || seen.has(id)) return;
    seen.add(id);
    const fallback = SECTIONS.find((s) => s.id === id);
    out.push({
      id,
      size: SIZES.includes(item.size) ? item.size : fallback.size,
      enabled: typeof item.enabled === "boolean" ? item.enabled : fallback.enabled,
    });
  });
  SECTIONS.forEach((s) => { if (!seen.has(s.id)) out.push({ ...s }); });
  return out;
}

function normalizeLayout(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const hero = c.hero && typeof c.hero === "object" ? c.hero : {};
  const movieId = str(hero.movieId, 120);
  const mode = HERO_MODES.includes(hero.mode) ? hero.mode : "auto";
  return {
    sections: normalizeSections(c.sections),
    // Qo'lda tanlash rejimi kinosiz ma'nosiz — avtomatikka qaytadi.
    hero: { mode: mode === "manual" && movieId ? "manual" : "auto", movieId: mode === "manual" ? movieId : "" },
    greeting: typeof c.greeting === "string" ? str(c.greeting, GREETING_MAX) : DEFAULT_GREETING,
    updatedAt: Number(c.updatedAt) || 0,
  };
}

// Redis bo'lmasa yoki xato bersa ham bo'lim ishlasin — xotiradagi nusxa.
let _memoryLayout = null;

async function readLayout() {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(LAYOUT_KEY);
      if (raw) return normalizeLayout(JSON.parse(raw));
    } catch (err) {
      console.warn("home layout read xato:", err.message);
    }
  }
  return normalizeLayout(_memoryLayout);
}

async function writeLayout(layout) {
  const next = normalizeLayout({ ...layout, updatedAt: Date.now() });
  _memoryLayout = next;
  const redis = await getRedis();
  if (!redis) return { layout: next, stored: false };
  await redis.set(LAYOUT_KEY, JSON.stringify(next));
  return { layout: next, stored: true };
}

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

async function handleHomeLayoutRequest(request, response) {
  try {
    if (request.method === "GET") {
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=300");
      response.status(200).json({ ok: true, layout: await readLayout() });
      return;
    }

    if (request.method === "POST") {
      const { requireAdmin } = require("./auth");
      if (!(await requireAdmin(request, response))) return;
      response.setHeader("Cache-Control", "no-store, max-age=0");
      const body = await readBody(request);
      const action = String(body.action || "update");

      if (action === "update") {
        if (!body.layout || typeof body.layout !== "object") {
          response.status(400).json({ ok: false, error: "layout kerak." });
          return;
        }
        const saved = await writeLayout(body.layout);
        response.status(200).json({ ok: true, ...saved });
        return;
      }

      response.status(400).json({ ok: false, error: "action noma'lum." });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    const status = err.statusCode || (err instanceof SyntaxError ? 400 : 500);
    console.error("home handler xato:", err.message);
    response.status(status).json({ ok: false, error: err.message || "Server xatolik." });
  }
}

module.exports = {
  handleHomeLayoutRequest,
  normalizeLayout,
  SECTIONS,
  DEFAULT_GREETING,
};
