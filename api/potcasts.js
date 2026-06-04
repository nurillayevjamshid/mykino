// Potkast kanallari API.
// Admin paneldan YouTube kanal linki qo'shilsa, RSS orqali kanal nomi va
// oxirgi ~15 videoni olib, Redis'ga saqlaymiz. Frontend GET orqali o'qiydi.

const fs = require("fs");
const path = require("path");
const { setCors } = require("./_lib/google-drive");

const SEED_FILE = path.join(process.cwd(), "data", "potcasts.json");
const REDIS_KEY = "potcasts:channels:v1";
const RSS_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";
const FETCH_TIMEOUT_MS = 12000;

let redisPromise = null;
async function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (redisPromise) {
    try { const c = await redisPromise; if (c?.isOpen) return c; } catch (_) {}
    redisPromise = null;
  }
  redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.error("redis error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await redisPromise;
  } catch (err) {
    console.warn("redis ulanishi muvaffaqiyatsiz:", err.message);
    redisPromise = null;
    return null;
  }
}

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL || process.env.KV_URL);
}

function readSeed() {
  try {
    if (!fs.existsSync(SEED_FILE)) return [];
    const raw = fs.readFileSync(SEED_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("potcasts seed read error:", err);
    return [];
  }
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "channel";
}

// Linkdan YouTube kanal ID'sini olishga harakat qilamiz.
// To'g'ridan-to'g'ri /channel/UC... bo'lsa ID darhol bor.
// /@handle, /c/name, /user/name bo'lsa, sahifani fetch qilib HTML'dan topamiz.
function extractDirectChannelId(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (/^UC[\w-]{20,24}$/.test(value)) return value;
  const m = /youtube\.com\/channel\/(UC[\w-]{20,24})/.exec(value);
  if (m) return m[1];
  return "";
}

function normalizeChannelUrl(input) {
  let value = String(input || "").trim();
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) {
    if (/^@/.test(value)) value = `https://www.youtube.com/${value}`;
    else if (/^UC[\w-]{20,24}$/.test(value)) value = `https://www.youtube.com/channel/${value}`;
    else value = `https://www.youtube.com/${value.replace(/^\/+/, "")}`;
  }
  return value;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MyKinoBot/1.0)",
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// HTML sahifadan kanal ID'sini topamiz: ko'p joyda "channelId":"UC..." uchraydi.
async function resolveChannelIdFromUrl(url) {
  const direct = extractDirectChannelId(url);
  if (direct) return direct;
  const normalized = normalizeChannelUrl(url);
  let html = "";
  try {
    const res = await fetchWithTimeout(normalized);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    const e = new Error(`Kanal sahifasini ochib bo'lmadi: ${err.message}`);
    e.statusCode = 502;
    throw e;
  }
  const patterns = [
    /"channelId":"(UC[\w-]{20,24})"/,
    /"externalChannelId":"(UC[\w-]{20,24})"/,
    /\/channel\/(UC[\w-]{20,24})/,
    /<meta\s+itemprop=["']channelId["']\s+content=["'](UC[\w-]{20,24})["']/,
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m) return m[1];
  }
  const e = new Error("Kanal ID topilmadi. Linkni tekshiring.");
  e.statusCode = 400;
  throw e;
}

// Oddiy XML matn ichidan tag qiymatini olish (regex bilan, kichik RSS uchun yetadi).
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m = re.exec(xml);
  return m ? m[1] : "";
}

function decodeXmlEntities(str) {
  return String(str || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function parseRssFeed(xml) {
  const channelTitle = decodeXmlEntities(extractTag(xml, "title"));
  const authorBlock = extractTag(xml, "author");
  const authorName = authorBlock ? decodeXmlEntities(extractTag(authorBlock, "name")) : "";

  const entries = [];
  const entryRe = /<entry\b[\s\S]*?<\/entry>/g;
  let match;
  while ((match = entryRe.exec(xml))) {
    const block = match[0];
    const videoId = (block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1] || "";
    if (!videoId) continue;
    const title = decodeXmlEntities(extractTag(block, "title"));
    const published = extractTag(block, "published");
    const thumb = extractAttr(block, "media:thumbnail", "url")
      || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const desc = decodeXmlEntities(extractTag(block, "media:description"));
    entries.push({
      videoId,
      title,
      published,
      thumbnail: thumb,
      description: desc.slice(0, 500),
    });
  }
  return { channelTitle, authorName, entries };
}

async function fetchChannelFromRss(channelId) {
  let res;
  try {
    res = await fetchWithTimeout(`${RSS_BASE}${channelId}`);
  } catch (err) {
    const e = new Error(`RSS olishda xatolik: ${err.message}`);
    e.statusCode = 502;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(`RSS HTTP ${res.status}`);
    e.statusCode = res.status === 404 ? 404 : 502;
    throw e;
  }
  const xml = await res.text();
  const parsed = parseRssFeed(xml);
  if (!parsed.channelTitle && !parsed.entries.length) {
    const e = new Error("RSS feed bo'sh yoki o'qib bo'lmadi.");
    e.statusCode = 502;
    throw e;
  }
  return parsed;
}

// Asosiy kanal rasmi YouTube avatar sifatida olish uchun ham HTML sahifasi kerak.
// Avatar URL ko'p joyda "avatar":{"thumbnails":[{"url":"..." }]} ko'rinishida.
async function fetchChannelAvatar(channelId) {
  try {
    const res = await fetchWithTimeout(`https://www.youtube.com/channel/${channelId}`);
    if (!res.ok) return "";
    const html = await res.text();
    // Eng katta avatar olishga harakat: yt3.googleusercontent.com bilan boshlanadigan.
    const m = /"avatar":\{"thumbnails":\[(.*?)\]\}/s.exec(html);
    if (m) {
      const urls = [...m[1].matchAll(/"url":"(https:[^"]+)"/g)].map((x) => x[1]);
      if (urls.length) return urls[urls.length - 1].replace(/\\u0026/g, "&");
    }
    const fallback = /"channelMetadataRenderer":\{[^}]*"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/.exec(html);
    if (fallback) return fallback[1].replace(/\\u0026/g, "&");
    return "";
  } catch (_) {
    return "";
  }
}

function normalizeChannel(ch) {
  if (!ch || typeof ch !== "object") return null;
  const channelId = String(ch.channelId || "").trim();
  const name = String(ch.name || "").trim();
  if (!channelId || !name) return null;
  const id = String(ch.id || slugify(name) || channelId).slice(0, 80);
  const videos = Array.isArray(ch.videos) ? ch.videos.filter((v) => v && v.videoId) : [];
  return {
    id,
    channelId,
    name,
    handle: String(ch.handle || "").trim(),
    description: String(ch.description || "").trim().slice(0, 500),
    avatar: String(ch.avatar || "").trim(),
    category: String(ch.category || "Boshqa").trim() || "Boshqa",
    url: String(ch.url || `https://www.youtube.com/channel/${channelId}`).trim(),
    order: Number.isFinite(Number(ch.order)) ? Number(ch.order) : 0,
    addedAt: ch.addedAt || new Date().toISOString(),
    refreshedAt: ch.refreshedAt || new Date().toISOString(),
    videos: videos.map((v) => ({
      videoId: String(v.videoId),
      title: String(v.title || "").slice(0, 200),
      published: v.published || "",
      thumbnail: String(v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`),
      description: String(v.description || "").slice(0, 500),
    })),
  };
}

async function readChannels() {
  const client = await getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(REDIS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeChannel).filter(Boolean) : [];
  } catch (err) {
    console.warn("redis get potcasts xato:", err.message);
    return null;
  }
}

async function writeChannels(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(REDIS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("redis set potcasts xato:", err.message);
    return false;
  }
}

async function loadAll() {
  const seed = readSeed().map(normalizeChannel).filter(Boolean);
  const stored = await readChannels();
  const base = stored ?? [];
  const map = new Map();
  for (const c of [...seed, ...base]) map.set(c.channelId, c);
  return Array.from(map.values()).sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
}

async function buildChannelFromLink(input) {
  const url = String(input.url || input.link || input.channelUrl || "").trim();
  if (!url) {
    const e = new Error("Kanal linki kerak.");
    e.statusCode = 400;
    throw e;
  }
  const channelId = await resolveChannelIdFromUrl(url);
  const [feed, avatar] = await Promise.all([
    fetchChannelFromRss(channelId),
    fetchChannelAvatar(channelId),
  ]);
  return normalizeChannel({
    channelId,
    name: input.name || feed.authorName || feed.channelTitle || "Potkast",
    handle: input.handle || "",
    description: input.description || "",
    avatar: input.avatar || avatar || `https://i.ytimg.com/vi/${feed.entries[0]?.videoId || ""}/hqdefault.jpg`,
    category: input.category || "Boshqa",
    url: normalizeChannelUrl(url),
    addedAt: new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
    videos: feed.entries,
  });
}

async function refreshChannelVideos(existing) {
  const feed = await fetchChannelFromRss(existing.channelId);
  return normalizeChannel({
    ...existing,
    name: existing.name || feed.authorName || feed.channelTitle,
    refreshedAt: new Date().toISOString(),
    videos: feed.entries,
  });
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "GET") {
    try {
      const channels = await loadAll();
      response.status(200).json({ ok: true, channels, storage: isRedisEnabled() ? "redis" : "seed" });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    try {
      const body = await readBody(request);
      const action = body.action
        || (request.method === "DELETE" ? "delete" : (request.method === "PUT" ? "update" : "create"));

      if (!isRedisEnabled()) {
        response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
        return;
      }

      let list = (await readChannels()) || [];

      if (action === "create") {
        const channel = await buildChannelFromLink(body);
        if (!channel) {
          response.status(400).json({ ok: false, error: "Kanal yaratib bo'lmadi." });
          return;
        }
        if (list.some((c) => c.channelId === channel.channelId)) {
          response.status(409).json({ ok: false, error: "Bu kanal allaqachon qo'shilgan." });
          return;
        }
        channel.order = list.length;
        list.push(channel);
      } else if (action === "delete") {
        const target = String(body.id || body.channelId || "").trim();
        if (!target) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        list = list.filter((c) => c.id !== target && c.channelId !== target);
      } else if (action === "refresh") {
        const target = String(body.id || body.channelId || "").trim();
        if (!target) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const idx = list.findIndex((c) => c.id === target || c.channelId === target);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        list[idx] = await refreshChannelVideos(list[idx]);
      } else if (action === "update") {
        const target = String(body.id || body.channelId || "").trim();
        if (!target) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const idx = list.findIndex((c) => c.id === target || c.channelId === target);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        const merged = normalizeChannel({ ...list[idx], ...body });
        if (!merged) { response.status(400).json({ ok: false, error: "Noto'g'ri ma'lumot." }); return; }
        list[idx] = merged;
      } else {
        response.status(400).json({ ok: false, error: "Noma'lum action." });
        return;
      }

      const ok = await writeChannels(list);
      if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
      response.status(200).json({ ok: true, channels: await loadAll() });
    } catch (err) {
      response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
    }
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed." });
};
