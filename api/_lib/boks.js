// Boks bo'limi (NTV × O'zbekiston Boks Federatsiyasi) — helper library.
// music.js'ga delegator orqali chaqiriladi (Vercel 12-funksiya limiti): /api/boks
//
// GET  /api/boks                  → efir, terma jamoa, janglar videolari (pin qilinganlar boshida)
// GET  /api/boks?resource=news    → @boxinguzbekistan kanalidagi xabarlar (?before= sahifalash)
// GET  /api/boks?resource=fights  → janglar qidiruvi / sahifalash (?q=&offset=)
// GET  /api/boks?view=admin       → admin: to'liq sozlama, janglar (filter, qidiruv), arxiv holati
// POST /api/boks {action}         → admin: update | set-channel | refresh-videos | backfill | upload
//
// Redis: boks:config:v1 — { stream, channel, pins, hidden, team, updatedAt }
//        boks:fights:v1 — janglar arxivi { channelId, items, cursor, done, syncedAt, videoCount }

const { getChannelView, resolveChannel, invalidateChannelView, ytFetch } = require("./podcasts");
const { fetchChannelPage } = require("./news-service");

const CONFIG_KEY = "boks:config:v1";
const ARCHIVE_KEY = "boks:fights:v1";
// Kanal sahifasi podcasts.js da 6 soat keshlanadi — arxivga qo'shish tez-tez arzon.
const SYNC_TTL_MS = 30 * 60 * 1000;
const BACKFILL_PAGES = 8;
const FIGHTS_PAGE = 30;
const ADMIN_PAGE = 48;
const DEFAULT_CHANNEL_INPUT = "@taylorohiggins1734";
const NEWS_CHANNEL = "boxinguzbekistan";
const MAX_PINS = 20;
const MAX_HIDDEN = 1000;
const MAX_TEAM = 60;
// YouTube Shorts 3 daqiqagacha bo'ladi — undan qisqa videolar jang emas (klip, anons).
const MIN_FIGHT_SEC = 3 * 60 + 1;
const NEWS_TTL_MS = 2 * 60 * 1000;
const NEWS_PAGE_TTL_MS = 60 * 60 * 1000;
const NEWS_MIN_POSTS = 10;
const NEWS_MAX_PAGES = 4;

// Admin hali terma jamoani saqlamagan bo'lsa — Parij-2024 chempionlari boshlang'ich ro'yxat.
const DEFAULT_TEAM = [
  { id: "dosmatov", name: "Hasanboy Do'smatov", weight: "51 kg", result: "Parij-2024 va Rio-2016 olimpiada chempioni", photo: "" },
  { id: "xalokov", name: "Abdumalik Xalokov", weight: "57 kg", result: "Parij-2024 olimpiada chempioni", photo: "" },
  { id: "muydinxojayev", name: "Asadxo'ja Muydinxo'jayev", weight: "71 kg", result: "Parij-2024 olimpiada chempioni", photo: "" },
  { id: "mullojonov", name: "Lazizbek Mullojonov", weight: "92 kg", result: "Parij-2024 olimpiada chempioni", photo: "" },
  { id: "jalolov", name: "Bahodir Jalolov", weight: "+92 kg", result: "Parij-2024 va Tokio-2020 olimpiada chempioni", photo: "" },
];

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
    client.on("error", (err) => console.error("redis (boks) error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await _redisPromise;
  } catch (err) {
    console.warn("redis (boks) ulanmadi:", err.message);
    _redisPromise = null;
    return null;
  }
}

// ---------- Normalizatsiya ----------

function str(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function httpsUrl(value) {
  const raw = str(value, 1000);
  return /^https:\/\//i.test(raw) ? raw : "";
}

function extractYoutubeId(input) {
  const raw = str(input, 300);
  if (!raw) return "";
  if (/^[\w-]{11}$/.test(raw)) return raw;
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return "";
}

function uniqueIds(list, max) {
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const id = extractYoutubeId(item);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

function normalizeStream(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const youtubeId = extractYoutubeId(s.youtubeId || s.url);
  return {
    url: youtubeId ? str(s.url, 300) || `https://youtu.be/${youtubeId}` : "",
    youtubeId,
    title: str(s.title, 120),
    subtitle: str(s.subtitle, 160),
    isLive: Boolean(s.isLive) && Boolean(youtubeId),
  };
}

function normalizeMember(raw, index) {
  const m = raw && typeof raw === "object" ? raw : {};
  const name = str(m.name, 80);
  if (!name) return null;
  const id = str(m.id, 40).replace(/[^\w-]/g, "") || `m${Date.now().toString(36)}${index}`;
  return {
    id,
    name,
    weight: str(m.weight, 24),
    result: str(m.result, 240),
    photo: httpsUrl(m.photo),
  };
}

function normalizeTeam(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((raw, i) => {
    const member = normalizeMember(raw, i);
    if (!member || seen.has(member.id)) return;
    seen.add(member.id);
    out.push(member);
  });
  return out.slice(0, MAX_TEAM);
}

function normalizeChannel(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    input: str(c.input, 200) || DEFAULT_CHANNEL_INPUT,
    channelId: /^UC[\w-]{20,}$/.test(String(c.channelId || "")) ? String(c.channelId) : "",
    title: str(c.title, 120),
    avatar: httpsUrl(c.avatar),
    handle: str(c.handle, 80),
  };
}

function normalizeConfig(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  return {
    stream: normalizeStream(c.stream),
    channel: normalizeChannel(c.channel),
    pins: uniqueIds(c.pins, MAX_PINS),
    hidden: uniqueIds(c.hidden, MAX_HIDDEN),
    // team hech saqlanmagan bo'lsa (undefined) — boshlang'ich ro'yxat
    team: Array.isArray(c.team) ? normalizeTeam(c.team) : DEFAULT_TEAM.map((m) => ({ ...m })),
    updatedAt: Number(c.updatedAt) || 0,
  };
}

// Redis bo'lmasa yoki xato bersa ham bo'lim ishlasin — xotiradagi nusxa.
let _memoryConfig = null;

async function readConfig() {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(CONFIG_KEY);
      if (raw) return normalizeConfig(JSON.parse(raw));
    } catch (err) {
      console.warn("boks config read xato:", err.message);
    }
  }
  return normalizeConfig(_memoryConfig);
}

async function writeConfig(config) {
  const next = normalizeConfig({ ...config, updatedAt: Date.now() });
  _memoryConfig = next;
  const redis = await getRedis();
  if (!redis) return { config: next, stored: false };
  await redis.set(CONFIG_KEY, JSON.stringify(next));
  return { config: next, stored: true };
}

// ---------- Janglar videolari ----------

async function ensureChannelId(config) {
  if (config.channel.channelId) return config.channel.channelId;
  const snapshot = await resolveChannel(config.channel.input);
  config.channel = {
    ...config.channel,
    channelId: snapshot.channelId,
    title: snapshot.title,
    avatar: snapshot.avatar,
    handle: snapshot.handle,
  };
  try { await writeConfig(config); } catch (_) {}
  return snapshot.channelId;
}

function isFight(video) {
  return !video.isShort && Number(video.durationSec) >= MIN_FIGHT_SEC;
}

function isoToSeconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ""));
  if (!m) return 0;
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0);
}

// Arxivda ixcham saqlanadi: { id, t: sarlavha, p: sana, d: davomiylik (s), v: ko'rishlar }
function compactFight(v) {
  return { id: v.videoId, t: v.title || "", p: v.publishedAt || "", d: Number(v.durationSec) || 0, v: Number(v.viewCount) || 0 };
}

function shapeVideo(item, flags) {
  return {
    videoId: item.id,
    title: item.t,
    thumb: `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
    publishedAt: item.p,
    durationSec: item.d,
    viewCount: item.v,
    ...flags,
  };
}

// Kanalda minglab video bor, YouTube esa bir so'rovda oxirgi ~300 tasini beradi. Shuning uchun
// janglar arxivi Redis'da yig'iladi: yangilari har sinxronda qo'shiladi, eskilari admin
// «Arxivni yuklash» tugmasi bilan (backfill) bo'laklab olinadi. Qidiruv shu arxiv bo'yicha.
let _memArchive = null;

async function readArchive() {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(ARCHIVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      console.warn("boks archive read xato:", err.message);
    }
  }
  return _memArchive;
}

async function writeArchive(archive) {
  _memArchive = archive;
  const redis = await getRedis();
  if (!redis) return;
  try { await redis.set(ARCHIVE_KEY, JSON.stringify(archive)); } catch (err) { console.warn("boks archive write xato:", err.message); }
}

function mergeFights(archive, fights) {
  const map = new Map(archive.items.map((i) => [i.id, i]));
  fights.forEach((f) => map.set(f.id, { ...map.get(f.id), ...f }));
  archive.items = [...map.values()].sort((a, b) => String(b.p).localeCompare(String(a.p)));
}

async function syncLatest(config, { force = false } = {}) {
  const channelId = await ensureChannelId(config);
  let archive = await readArchive();
  if (!archive || archive.channelId !== channelId || !Array.isArray(archive.items)) {
    archive = { channelId, items: [], cursor: "", done: false, syncedAt: 0, videoCount: 0 };
  }
  if (!force && archive.items.length && Date.now() - archive.syncedAt < SYNC_TTL_MS) return archive;
  try {
    const view = await getChannelView(channelId);
    mergeFights(archive, (view.videos || []).filter(isFight).map(compactFight));
    archive.videoCount = Number(view.channel?.videoCount) || archive.videoCount;
    archive.syncedAt = Date.now();
    await writeArchive(archive);
  } catch (err) {
    // YouTube ishlamasa — arxivdagi janglar ko'rsatilaveradi
    if (!archive.items.length) throw err;
    console.warn("boks sync xato (arxiv ishlatiladi):", err.message);
  }
  return archive;
}

// Eski janglarni bo'laklab olish: har chaqiruvda BACKFILL_PAGES × 50 ta yuklangan video.
async function backfillArchive(config) {
  const archive = await syncLatest(config);
  if (archive.done) return archive;
  const playlistId = `UU${archive.channelId.slice(2)}`;
  let token = archive.cursor || "";
  const ids = [];
  for (let i = 0; i < BACKFILL_PAGES; i++) {
    const pl = await ytFetch("playlistItems", { part: "contentDetails", playlistId, maxResults: 50, pageToken: token });
    (pl.items || []).forEach((it) => { if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId); });
    token = pl.nextPageToken || "";
    if (!token) break;
  }
  const known = new Set(archive.items.map((i) => i.id));
  const fresh = ids.filter((id) => !known.has(id));
  for (let i = 0; i < fresh.length; i += 50) {
    const r = await ytFetch("videos", { part: "contentDetails,snippet,statistics", id: fresh.slice(i, i + 50).join(","), maxResults: 50 });
    const fights = (r.items || [])
      .map((v) => ({
        id: v.id,
        t: v.snippet?.title || "",
        p: v.snippet?.publishedAt || "",
        d: isoToSeconds(v.contentDetails?.duration),
        v: Number(v.statistics?.viewCount || 0),
      }))
      .filter((f) => f.d >= MIN_FIGHT_SEC);
    mergeFights(archive, fights);
  }
  archive.scanned = (Number(archive.scanned) || 0) + ids.length;
  archive.cursor = token;
  archive.done = !token;
  await writeArchive(archive);
  return archive;
}

// ---------- Qidiruv ----------

const CYR = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "k", ғ: "g", ҳ: "h",
};
// O'zbekcha yozuvlarni (kirill, o'/g', x/kh, q/k) bir xil ko'rinishga keltiradi:
// "Баҳодир", "Bahodir", "Bakhodir" → "bahodir".
function searchKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c)
    .replace(/['‘’ʻʼ`´]/g, "")
    .replace(/kh/g, "h")
    .replace(/x/g, "h")
    .replace(/q/g, "k")
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function queryWords(q) {
  return searchKey(q)
    .split(" ")
    .filter(Boolean)
    .map((w) => (/^(ozbek|uzbek)/.test(w) ? "uzb" : w));
}

let _keyCache = { items: null, keys: null };
function titleKeys(items) {
  if (_keyCache.items !== items) _keyCache = { items, keys: items.map((i) => searchKey(i.t)) };
  return _keyCache.keys;
}

function searchItems(items, q) {
  const words = queryWords(q);
  if (!words.length) return items;
  const keys = titleKeys(items);
  return items.filter((_, i) => words.every((w) => keys[i].includes(w)));
}

// Jamoatchilik ro'yxati: pin qilinganlar alohida (admin tartibida), qolganlari sahifalab.
function publicFights(archive, config, { q = "", offset = 0, limit = FIGHTS_PAGE } = {}) {
  const hidden = new Set(config.hidden);
  const visible = archive.items.filter((i) => !hidden.has(i.id));
  const byId = new Map(visible.map((i) => [i.id, i]));
  const pinned = config.pins.map((id) => byId.get(id)).filter(Boolean);
  const pinSet = new Set(pinned.map((i) => i.id));
  const pool = q ? searchItems(visible, q) : visible.filter((i) => !pinSet.has(i.id));
  const page = pool.slice(offset, offset + limit);
  return {
    pinned: pinned.map((i) => shapeVideo(i, { pinned: true })),
    videos: page.map((i) => shapeVideo(i, { pinned: pinSet.has(i.id) })),
    total: pool.length,
    nextOffset: offset + page.length < pool.length ? offset + page.length : null,
  };
}

function adminFights(archive, config, { q = "", offset = 0, filter = "all" } = {}) {
  const hidden = new Set(config.hidden);
  const pins = new Set(config.pins);
  const items = archive.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const counts = {
    all: items.length,
    visible: items.filter((i) => !hidden.has(i.id)).length,
    pinned: config.pins.filter((id) => byId.has(id)).length,
    hidden: items.filter((i) => hidden.has(i.id)).length,
  };
  let pool = filter === "visible" ? items.filter((i) => !hidden.has(i.id))
    : filter === "pinned" ? config.pins.map((id) => byId.get(id)).filter(Boolean)
    : filter === "hidden" ? items.filter((i) => hidden.has(i.id))
    : items;
  pool = searchItems(pool, q);
  const flags = (i) => ({ pinned: pins.has(i.id), hidden: hidden.has(i.id) });
  const page = pool.slice(offset, offset + ADMIN_PAGE);
  return {
    pinned: config.pins.map((id) => (byId.has(id) ? shapeVideo(byId.get(id), flags(byId.get(id))) : { videoId: id, title: "", thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, missing: true, pinned: true })),
    videos: page.map((i) => shapeVideo(i, flags(i))),
    total: pool.length,
    nextOffset: offset + page.length < pool.length ? offset + page.length : null,
    counts,
  };
}

function archiveInfo(archive) {
  return {
    count: archive.items.length,
    done: Boolean(archive.done),
    scanned: Number(archive.scanned) || 0,
    channelVideos: archive.videoCount || 0,
    syncedAt: archive.syncedAt || 0,
  };
}

// ---------- Yangiliklar (Telegram kanal) ----------

let _newsLatest = { at: 0, data: null };
const _newsPages = new Map();

// Satr boshidagi emoji'lar (to'liq, surrogate juftligi bilan) — sarlavhadan olib tashlanadi.
const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]|\s)+/u;

// Kanal har xabar oxiriga qo'yadigan reklama satrlari: "ОБУНА БЎЛИНГ👉 BoxingUzbekistan", "Facebook|Instagram|X".
const NEWS_FOOTERS = [
  /\s*(?:ОБУНА\s+БЎЛИНГ|OBUNA\s+BO['‘’ʻ`]?LING)[\s\S]*$/i,
  /\s*Facebook\s*\|\s*Instagram[\s\S]*$/i,
  // Boshqa kanallardan ulashilgan xabarlar: "👉 @OlympicUz\n\nolympic.uz I YouTube I Instagram"
  /\s*👉\s*@\w+\s*(?:\n[^\n]*(?:YouTube|Instagram)[^\n]*)?\s*$/iu,
];

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function shapeNewsPost(post) {
  let text = decodeEntities(String(post.text || "")).replace(new RegExp(`@${NEWS_CHANNEL}\\b`, "gi"), "");
  NEWS_FOOTERS.forEach((re) => { text = text.replace(re, ""); });
  text = text.trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let title = (lines[0] || "").replace(LEADING_EMOJI, "").trim();
  if (title.length > 120) {
    const cut = title.slice(0, 115);
    const space = cut.lastIndexOf(" ");
    title = `${space > 30 ? cut.slice(0, space) : cut}…`;
  }
  return {
    id: post.id,
    title: title || "Boks yangiligi",
    lead: lines.slice(1).join(" ").slice(0, 220),
    text,
    photos: post.photos || [],
    videoUrl: post.videoUrl || null,
    videoThumb: post.videoThumb || null,
    videoDuration: post.videoDuration || null,
    datetime: post.datetime,
    views: post.views,
    telegramUrl: post.telegramUrl,
  };
}

async function getBoksNews(before) {
  const now = Date.now();
  if (!before && _newsLatest.data && now - _newsLatest.at < NEWS_TTL_MS) return _newsLatest.data;
  if (before) {
    const cached = _newsPages.get(before);
    if (cached && now - cached.at < NEWS_PAGE_TTL_MS) return cached.data;
  }
  // t.me/s sahifasi ~20 ta xabar beradi, albom esa bitta post — shuning uchun bitta sahifada
  // 3–5 ta yangilik bo'lishi mumkin. Ekran to'lishi uchun bir nechta sahifani birlashtiramiz.
  const posts = [];
  let cursor = before || null;
  for (let i = 0; i < NEWS_MAX_PAGES && posts.length < NEWS_MIN_POSTS; i++) {
    const page = await fetchChannelPage(NEWS_CHANNEL, cursor);
    page.posts
      .map(shapeNewsPost)
      .filter((p) => p.text || p.photos.length || p.videoUrl)
      .forEach((p) => posts.push(p));
    cursor = page.nextBefore;
    if (!cursor) break;
  }
  const data = {
    ok: true,
    channelUrl: `https://t.me/${NEWS_CHANNEL}`,
    posts,
    nextBefore: cursor,
  };
  if (before) {
    if (_newsPages.size > 50) _newsPages.clear();
    _newsPages.set(before, { at: now, data });
  } else {
    _newsLatest = { at: now, data };
  }
  return data;
}

// ---------- HTTP ----------

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

function publicChannel(config) {
  const c = config.channel;
  return {
    title: c.title,
    avatar: c.avatar,
    url: c.handle ? `https://www.youtube.com/${c.handle}` : c.channelId ? `https://www.youtube.com/channel/${c.channelId}` : "",
  };
}

function pageParams(query) {
  return {
    q: str(query.q, 80),
    offset: Math.max(0, parseInt(query.offset, 10) || 0),
  };
}

async function adminPayload(config, query, extra = {}) {
  let archive = { items: [], done: false, videoCount: 0, syncedAt: 0 };
  let videosError = "";
  try {
    archive = await syncLatest(config);
  } catch (err) {
    videosError = err.message || "Videolarni olib bo'lmadi.";
  }
  const filter = ["all", "visible", "pinned", "hidden"].includes(String(query.filter)) ? String(query.filter) : "all";
  const redis = await getRedis();
  return {
    ok: true,
    config,
    ...adminFights(archive, config, { ...pageParams(query), filter }),
    archive: archiveInfo(archive),
    videosError,
    maxPins: MAX_PINS,
    storage: redis ? "redis" : "memory",
    ...extra,
  };
}

async function handleBoksRequest(request, response) {
  const query = request.query || {};
  try {
    if (request.method === "GET") {
      const resource = String(query.resource || "");
      if (resource === "news") {
        const before = parseInt(query.before, 10) || null;
        const data = await getBoksNews(before);
        response.setHeader(
          "Cache-Control",
          before ? "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" : "public, max-age=30, s-maxage=120, stale-while-revalidate=600"
        );
        response.status(200).json(data);
        return;
      }

      const config = await readConfig();

      if (String(query.view || "") === "admin") {
        const { requireAdmin } = require("./auth");
        if (!(await requireAdmin(request, response))) return;
        response.setHeader("Cache-Control", "no-store, max-age=0");
        response.status(200).json(await adminPayload(config, query));
        return;
      }

      let archive = null;
      let videosError = "";
      try {
        archive = await syncLatest(config);
      } catch (err) {
        console.warn("boks videos xato:", err.message);
        videosError = "Videolarni yuklab bo'lmadi.";
      }
      // Admin o'zgarishi (pin, efir) tez ko'rinsin: brauzer keshlamaydi, CDN 1 daqiqa.
      response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=120");

      // Qidiruv / "yana ko'rsatish": faqat janglar ro'yxati
      if (resource === "fights") {
        const page = archive ? publicFights(archive, config, pageParams(query)) : { videos: [], total: 0, nextOffset: null };
        response.status(200).json({ ok: true, videos: page.videos, total: page.total, nextOffset: page.nextOffset, videosError });
        return;
      }

      const fights = archive ? publicFights(archive, config) : { pinned: [], videos: [], total: 0, nextOffset: null };
      response.status(200).json({
        ok: true,
        stream: config.stream,
        team: config.team,
        channel: publicChannel(config),
        pinned: fights.pinned,
        videos: fights.videos,
        total: fights.total,
        nextOffset: fights.nextOffset,
        videosError,
      });
      return;
    }

    if (request.method === "POST") {
      const { requireAdmin } = require("./auth");
      if (!(await requireAdmin(request, response))) return;
      response.setHeader("Cache-Control", "no-store, max-age=0");
      const body = await readBody(request);
      const action = String(body.action || "update");

      if (action === "upload") {
        const dataUrl = String(body.dataUrl || "");
        if (!/^data:image\/[\w+.-]+;base64,/.test(dataUrl)) {
          response.status(400).json({ ok: false, error: "Rasm (dataUrl) kerak." });
          return;
        }
        if (dataUrl.length > 8 * 1024 * 1024) {
          response.status(413).json({ ok: false, error: "Rasm 6MB dan katta." });
          return;
        }
        const { uploadImageToR2 } = require("./r2-store");
        const name = str(body.name, 40).replace(/[^a-z0-9_-]/gi, "") || "member";
        const { directUrl } = await uploadImageToR2(dataUrl, `boks-${name}`);
        response.status(200).json({ ok: true, url: directUrl });
        return;
      }

      const config = await readConfig();
      const listQuery = body.list && typeof body.list === "object" ? body.list : {};

      if (action === "set-channel") {
        const input = str(body.input, 200);
        if (!input) {
          response.status(400).json({ ok: false, error: "Kanal havolasi yoki @handle kerak." });
          return;
        }
        const snapshot = await resolveChannel(input);
        config.channel = { input, channelId: snapshot.channelId, title: snapshot.title, avatar: snapshot.avatar, handle: snapshot.handle };
        await writeConfig(config);
        response.status(200).json(await adminPayload(config, listQuery));
        return;
      }

      if (action === "refresh-videos") {
        const channelId = await ensureChannelId(config);
        await invalidateChannelView(channelId);
        await syncLatest(config, { force: true });
        response.status(200).json(await adminPayload(config, listQuery));
        return;
      }

      if (action === "backfill") {
        const before = (await syncLatest(config)).items.length;
        const archive = await backfillArchive(config);
        response.status(200).json(await adminPayload(config, listQuery, { added: archive.items.length - before }));
        return;
      }

      if (action === "update") {
        const patch = body.patch && typeof body.patch === "object" ? body.patch : {};
        if (patch.pins !== undefined && uniqueIds(patch.pins, MAX_PINS + 1).length > MAX_PINS) {
          response.status(400).json({ ok: false, error: `Ko'pi bilan ${MAX_PINS} ta jang pin qilinadi.` });
          return;
        }
        ["stream", "pins", "hidden", "team"].forEach((key) => {
          if (patch[key] !== undefined) config[key] = patch[key];
        });
        const saved = await writeConfig(config);
        response.status(200).json({ ok: true, ...saved });
        return;
      }

      response.status(400).json({ ok: false, error: "action noma'lum." });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("boks handler xato:", err.message);
    response.status(status).json({ ok: false, error: err.message || "Server xatolik." });
  }
}

module.exports = {
  handleBoksRequest,
  normalizeConfig,
  isFight,
  isoToSeconds,
  searchKey,
  searchItems,
  publicFights,
  adminFights,
  shapeNewsPost,
  MAX_PINS,
  DEFAULT_CHANNEL_INPUT,
  NEWS_CHANNEL,
};
