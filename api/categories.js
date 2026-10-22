const { authorizeRequest, requireAdmin, requireVerifiedUser } = require("./_lib/auth");
const { uploadImageToR2, uploadFileToR2 } = require("./_lib/r2-store");

const REDIS_KEY = "categories:v1";
const POD_LANGS_KEY = "podcast-langs:v1";
const FIFA_LIVE_KEY = "fifa-live:v1";
const FIFA_HIGHLIGHTS_KEY = "fifa-highlights:v1";
const POD_LANG_DEFAULTS = {
  uz: { name: "O'zbekcha", image: "" },
  ru: { name: "Ruscha", image: "" },
  en: { name: "Inglizcha", image: "" },
};
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
// Vercel serverless body cheklovi 4.5 MB. base64 33% inflation bilan ~3 MB real fayl.
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;

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
    console.warn("redis ulanmadi:", err.message);
    redisPromise = null;
    return null;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kategoriya";
}

function normalize(cat) {
  if (!cat || typeof cat !== "object") return null;
  const name = String(cat.name || "").trim();
  if (!name) return null;
  const image = String(cat.image || "").trim();
  const id = String(cat.id || slugify(name)).slice(0, 64);
  const order = Number(cat.order || 0);
  return { id, name, image, order: Number.isFinite(order) ? order : 0 };
}

async function readAll() {
  const client = await getRedis();
  if (!client) return [];
  try {
    const raw = await client.get(REDIS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalize).filter(Boolean) : [];
  } catch (err) {
    console.warn("redis get categories xato:", err.message);
    return [];
  }
}

async function writeAll(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(REDIS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("redis set categories xato:", err.message);
    return false;
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

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL || process.env.KV_URL);
}

function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) return null;
  return { contentType: m[1] || "application/octet-stream", buffer: Buffer.from(m[2], "base64") };
}

async function handleUpload(body) {
  const dataUrl = String(body.dataUrl || body.image || "").trim();
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const err = new Error("dataUrl (base64) kerak."); err.statusCode = 400; throw err;
  }
  const kind = String(body.kind || "").toLowerCase();
  const isVideo = kind === "video" || /^video\//i.test(parsed.contentType);

  if (isVideo) {
    if (parsed.buffer.length > MAX_VIDEO_BYTES) {
      const err = new Error("Video 4MB dan katta. Iltimos qisqaroq yoki past sifat tanlang.");
      err.statusCode = 413;
      throw err;
    }
    const baseName = String(body.name || "preroll").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "preroll";
    const { directUrl } = await uploadFileToR2(dataUrl, baseName, { prefixDir: "ads" });
    return directUrl;
  }

  if (parsed.buffer.length > MAX_IMAGE_BYTES) {
    const err = new Error("Rasm 6MB dan katta."); err.statusCode = 413; throw err;
  }
  const baseName = String(body.name || "category").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "category";
  const { directUrl } = await uploadImageToR2(dataUrl, `category-${baseName}`);
  return directUrl;
}

function normalizePodLangs(raw) {
  const src = (raw && typeof raw === "object") ? raw : {};
  const out = {};
  for (const key of ["uz", "ru", "en"]) {
    const entry = (src[key] && typeof src[key] === "object") ? src[key] : {};
    const name = String(entry.name || POD_LANG_DEFAULTS[key].name).trim() || POD_LANG_DEFAULTS[key].name;
    const image = String(entry.image || "").trim();
    out[key] = { name, image };
  }
  return out;
}

async function readPodLangs() {
  const client = await getRedis();
  if (!client) return normalizePodLangs(null);
  try {
    const raw = await client.get(POD_LANGS_KEY);
    if (!raw) return normalizePodLangs(null);
    return normalizePodLangs(JSON.parse(raw));
  } catch (err) {
    console.warn("redis get pod-langs xato:", err.message);
    return normalizePodLangs(null);
  }
}

async function writePodLangs(map) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(POD_LANGS_KEY, JSON.stringify(map));
    return true;
  } catch (err) {
    console.warn("redis set pod-langs xato:", err.message);
    return false;
  }
}

// =========================================================================
// Futbol ligalari ma'lumotlari (ESPN public API proxy + qisqa kesh).
// Scoreboard va standings API manzillari brauzer CORS cheklovlarini chetlab
// o'tish uchun shu serverless endpoint orqali chaqiriladi.
// =========================================================================
const FOOTBALL_LEAGUES = [
  { id: "eng.1", name: "APL", fullName: "Premier League" },
  { id: "esp.1", name: "La Liga", fullName: "La Liga" },
  { id: "ger.1", name: "Bundesliga", fullName: "Bundesliga" },
  { id: "ita.1", name: "A Serie", fullName: "Serie A" },
  { id: "fra.1", name: "Liga 1", fullName: "Ligue 1" },
  { id: "ksa.1", name: "Saudi Liga", fullName: "Saudi Pro League" },
  { id: "uefa.champions", name: "UCL", fullName: "UEFA Champions League" },
  { id: "uefa.europa", name: "Yevropa Ligasi", fullName: "UEFA Europa League" },
  { id: "uefa.europa.conf", name: "Konferensiyalar Ligasi", fullName: "UEFA Conference League" },
];
// =========================================================================
// FIFA / Futbol Caching Layer: L1 (Memory) + L2 (Redis) + Single-Flight (Inflight Coalescing)
// =========================================================================
const FOOTBALL_L1_CACHE = new Map();
const FOOTBALL_INFLIGHT = new Map();

async function getFootballCache(key) {
  const now = Date.now();
  // 1) L1 Memory
  const mem = FOOTBALL_L1_CACHE.get(key);
  if (mem && (now - mem.at < mem.ttl)) {
    return { data: mem.data, isHit: true, at: mem.at, ttl: mem.ttl, source: "L1" };
  }

  // 2) L2 Redis (serverless instansiyalari o'rtasida umumiy kesh)
  const client = await getRedis().catch(() => null);
  if (client) {
    try {
      const raw = await client.get(`fifa:cache:${key}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) {
          const remainingTtl = Math.max(1000, (parsed.expiresAt || (now + 60000)) - now);
          FOOTBALL_L1_CACHE.set(key, { data: parsed.data, at: parsed.at || now, ttl: remainingTtl });
          return { data: parsed.data, isHit: true, at: parsed.at || now, ttl: remainingTtl, source: "L2_REDIS" };
        }
      }
    } catch (err) {
      console.warn("redis get football cache xato:", err.message);
    }
  }

  // Stale fallback
  if (mem) {
    return { data: mem.data, isHit: false, isStale: true, at: mem.at, ttl: mem.ttl, source: "STALE" };
  }

  return null;
}

async function setFootballCache(key, data, ttlMs) {
  const now = Date.now();
  const safeTtl = Math.max(1000, ttlMs);
  // 1) L1 Memory
  FOOTBALL_L1_CACHE.set(key, { data, at: now, ttl: safeTtl });

  // 2) L2 Redis
  const client = await getRedis().catch(() => null);
  if (client) {
    try {
      const ttlSec = Math.max(1, Math.round(safeTtl / 1000));
      const payload = JSON.stringify({ data, at: now, expiresAt: now + safeTtl });
      await client.set(`fifa:cache:${key}`, payload, { EX: ttlSec });
    } catch (err) {
      console.warn("redis set football cache xato:", err.message);
    }
  }
}

async function fetchWithSingleFlight(key, fetcher) {
  if (FOOTBALL_INFLIGHT.has(key)) {
    return await FOOTBALL_INFLIGHT.get(key);
  }
  const promise = (async () => {
    try {
      return await fetcher();
    } finally {
      FOOTBALL_INFLIGHT.delete(key);
    }
  })();
  FOOTBALL_INFLIGHT.set(key, promise);
  return await promise;
}

function applyFootballHeaders(response, data, dateKey, todayKey, cacheStatus) {
  const hasLive = Array.isArray(data?.matches) && data.matches.some((m) => m.status === "live");
  let sMaxAge = 3600;
  let maxAge = 300;
  let swr = 7200;

  if (dateKey < todayKey) {
    // O'tib ketgan o'yinlar: 60 daqiqa kesh
    sMaxAge = 3600;
    maxAge = 300;
    swr = 7200;
  } else if (dateKey > todayKey) {
    // Kelajakdagi o'yinlar: 45 daqiqa kesh
    sMaxAge = 2700;
    maxAge = 300;
    swr = 3600;
  } else if (hasLive) {
    // Jonli o'yinlar: 60 soniya kesh
    sMaxAge = 60;
    maxAge = 30;
    swr = 120;
  } else {
    // Bugungi (lekin hozir jonli o'yin yo'q): 10 daqiqa kesh
    sMaxAge = 600;
    maxAge = 60;
    swr = 1200;
  }

  response.setHeader("X-Football-Cache", cacheStatus || "MISS");
  response.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
  response.setHeader("Vary", "Accept-Encoding");
}

function applyLineupHeaders(response, data, cacheStatus) {
  let sMaxAge = 3600;
  let maxAge = 300;
  let swr = 7200;

  if (data?.status === "live") {
    // Jonli o'yin modal statistikasi: 60 soniya kesh
    sMaxAge = 60;
    maxAge = 30;
    swr = 120;
  } else if (data?.status === "upcoming") {
    // Kelajakdagi o'yin: 30 daqiqa kesh
    sMaxAge = 1800;
    maxAge = 180;
    swr = 3600;
  } else {
    // Tugagan o'yin: 60 daqiqa kesh
    sMaxAge = 3600;
    maxAge = 300;
    swr = 7200;
  }

  response.setHeader("X-Fifa-Lineup-Cache", cacheStatus || "MISS");
  response.setHeader("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`);
  response.setHeader("Vary", "Accept-Encoding");
}

const ESPN_SCOREBOARD_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports/soccer";
const FOOTBALL_TIME_ZONE = "Asia/Tashkent";

function dateKeyInTimeZone(date = new Date(), timeZone = FOOTBALL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function normalizeFootballDate(raw) {
  const value = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) return value;
  }
  return dateKeyInTimeZone();
}

function adjacentUtcDates(dateKey) {
  const base = new Date(`${dateKey}T12:00:00Z`);
  return [-1, 0, 1].map((offset) => {
    const date = new Date(base.getTime() + offset * 86400000);
    return date.toISOString().slice(0, 10).replaceAll("-", "");
  });
}

async function fetchJson(url, timeoutMs = 6000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function espnStatValue(entry, names) {
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  const stat = (Array.isArray(entry?.stats) ? entry.stats : []).find((item) => wanted.has(String(item?.name || "").toLowerCase()));
  const value = Number(stat?.value ?? stat?.displayValue ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function espnTeamLogo(team) {
  return String(team?.logo || team?.logos?.[0]?.href || "").trim();
}

function normalizeEspnMatch(event, league, dateKey) {
  const competition = event?.competitions?.[0] || {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const start = event?.date || competition?.startDate;
  if (!home?.team || !away?.team || !start) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  const dateInTashkent = dateKeyInTimeZone(date);
  if (dateInTashkent !== dateKey) return null;
  const statusType = competition?.status?.type || {};
  const state = String(statusType.state || "").toLowerCase();
  const isLive = state === "in" || state === "live" || /in.progress|in progress|halftime|delayed/i.test(String(statusType.name || statusType.description || ""));
  const isFinished = Boolean(statusType.completed) || state === "post" || /final|full time|ended|finished/i.test(String(statusType.name || statusType.description || ""));
  const status = isLive ? "live" : isFinished ? "finished" : "upcoming";
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: FOOTBALL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
  const homeScore = home.score != null && home.score !== "" ? String(home.score) : null;
  const awayScore = away.score != null && away.score !== "" ? String(away.score) : null;
  const score = (status !== "upcoming" && homeScore != null && awayScore != null)
    ? `${homeScore} : ${awayScore}`
    : null;
  return {
    id: String(event.id || `${league.id}-${start}-${home.team.id}-${away.team.id}`),
    leagueId: league.id,
    leagueName: league.name,
    leagueFullName: league.fullName,
    leagueLogo: league.logo || "",
    kickoffUtc: date.toISOString(),
    time: localTime,
    status,
    minute: isLive ? String(competition?.status?.displayClock || competition?.status?.clock || "LIVE") : null,
    score,
    home: {
      name: String(home.team.displayName || home.team.shortDisplayName || home.team.name || "").trim(),
      logo: espnTeamLogo(home.team),
    },
    away: {
      name: String(away.team.displayName || away.team.shortDisplayName || away.team.name || "").trim(),
      logo: espnTeamLogo(away.team),
    },
  };
}

function normalizeEspnStandings(raw, league) {
  const children = Array.isArray(raw?.children) ? raw.children : [];
  const entries = children.flatMap((child) => Array.isArray(child?.standings?.entries) ? child.standings.entries : (Array.isArray(child?.entries) ? child.entries : []));
  const rows = entries.map((entry, index) => {
    const team = entry?.team || {};
    return {
      rank: Number(entry?.note?.rank || entry?.rank || index + 1) || index + 1,
      team: String(team.displayName || team.shortDisplayName || team.name || "").trim(),
      logo: espnTeamLogo(team),
      p: espnStatValue(entry, ["gamesPlayed", "matchesPlayed"]),
      w: espnStatValue(entry, ["wins"]),
      d: espnStatValue(entry, ["ties", "draws"]),
      l: espnStatValue(entry, ["losses"]),
      gf: espnStatValue(entry, ["pointsFor", "goalsFor"]),
      ga: espnStatValue(entry, ["pointsAgainst", "goalsAgainst"]),
      gd: espnStatValue(entry, ["pointDifferential", "goalDifference"]),
      pts: espnStatValue(entry, ["points"]),
    };
  }).filter((row) => row.team);
  rows.sort((a, b) => a.rank - b.rank || b.pts - a.pts);
  return {
    leagueId: league.id,
    leagueName: league.name,
    leagueFullName: league.fullName,
    leagueLogo: league.logo || "",
    rows,
  };
}

async function fetchFootballScoreboard(league, dateKey) {
  // Toshkent UTC+5 bo‘lgani uchun mahalliy kun o‘yinlari ESPN’da ikki UTC
  // sanaga bo‘linishi mumkin (masalan, 00:30 Toshkent = oldingi kun 19:30Z).
  const utcDates = adjacentUtcDates(dateKey).slice(0, 2);
  const results = await Promise.allSettled(utcDates.map((date) => (
    fetchJson(`${ESPN_SCOREBOARD_BASE}/${league.id}/scoreboard?dates=${date}`, 9000)
  )));
  const payloads = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!payloads.length) {
    const reason = results.find((result) => result.status === "rejected")?.reason;
    throw reason || new Error("scoreboard unavailable");
  }
  const sourceLeague = payloads.map((payload) => payload?.leagues?.[0] || {}).find((item) => item?.logos?.length || item?.name) || {};
  const sourceLogo = sourceLeague?.logos?.find((logo) => Array.isArray(logo.rel) && logo.rel.includes("full"))?.href || sourceLeague?.logos?.[0]?.href || "";
  const enrichedLeague = { ...league, logo: sourceLogo || league.logo || "" };
  const uniqueEvents = new Map();
  payloads.flatMap((payload) => Array.isArray(payload?.events) ? payload.events : []).forEach((event) => {
    const key = String(event?.id || `${event?.date || ""}:${event?.name || ""}`);
    if (!uniqueEvents.has(key)) uniqueEvents.set(key, event);
  });
  return {
    league: enrichedLeague,
    matches: [...uniqueEvents.values()].map((event) => normalizeEspnMatch(event, enrichedLeague, dateKey)).filter(Boolean),
  };
}

async function fetchFootballStandings(league) {
  const payload = await fetchJson(`${ESPN_STANDINGS_BASE}/${league.id}/standings`, 9000);
  return normalizeEspnStandings(payload, league);
}

async function getCachedFootballStandings(league) {
  const key = `standings:${league.id}`;
  const cached = await getFootballCache(key);
  if (cached?.isHit) return cached.data;
  return await fetchWithSingleFlight(key, async () => {
    const fresh = await fetchFootballStandings(league);
    await setFootballCache(key, fresh, 60 * 60 * 1000); // 60 daqiqa kesh
    return fresh;
  });
}

async function buildFootballPayload(dateKey, activeLeagueId) {
  const activeLeague = FOOTBALL_LEAGUES.find((league) => league.id === activeLeagueId) || FOOTBALL_LEAGUES[0];
  const scoreboardResults = await Promise.allSettled(FOOTBALL_LEAGUES.map((league) => fetchFootballScoreboard(league, dateKey)));
  const leagueData = scoreboardResults.map((result, index) => {
    const fallback = FOOTBALL_LEAGUES[index];
    if (result.status === "fulfilled") return result.value;
    return { league: fallback, matches: [], error: result.reason?.message || "scoreboard unavailable" };
  });
  const selectedLeague = leagueData.find((item) => item.league.id === activeLeague.id)?.league || activeLeague;
  let standings = { leagueId: selectedLeague.id, leagueName: selectedLeague.name, leagueFullName: selectedLeague.fullName, leagueLogo: selectedLeague.logo || "", rows: [], error: "" };
  try {
    standings = await getCachedFootballStandings(selectedLeague);
  } catch (error) {
    standings.error = error.message || "standings unavailable";
  }
  return {
    updatedAt: new Date().toISOString(),
    date: dateKey,
    timeZone: FOOTBALL_TIME_ZONE,
    activeLeagueId: selectedLeague.id,
    leagues: leagueData.map((item) => item.league),
    matches: leagueData.flatMap((item) => item.matches).sort((a, b) => a.kickoffUtc.localeCompare(b.kickoffUtc)),
    standings,
    sources: leagueData.map((item) => ({ leagueId: item.league.id, ok: !item.error })),
  };
}

// =========================================================================
// FIFA Live Match (admin tomonidan boshqariladi) — bitta o'yin uchun MVP.
// Telegram kanal/post linki + ablojka rasm. Mini app FIFA bo'limidagi promo
// card'da ko'rsatiladi va bosilganda tg.openTelegramLink orqali ochiladi.
// =========================================================================
function normalizeFifaLiveTelegramUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) {
    const err = new Error("Stream havola https:// bilan boshlanishi kerak.");
    err.statusCode = 400;
    throw err;
  }
  let parsed;
  try { parsed = new URL(raw); } catch (_) {
    const err = new Error("Stream havola noto'g'ri URL.");
    err.statusCode = 400;
    throw err;
  }
  const path = parsed.pathname;
  const isHls = /\.m3u8$/i.test(path);
  const isWhep = /\/webRTC\/play(\?|$)/i.test(path);
  if (!isHls && !isWhep) {
    const err = new Error("Stream havola HLS playlist (.m3u8) yoki Cloudflare WHEP playback URL (.../webRTC/play) bo'lishi kerak.");
    err.statusCode = 400;
    throw err;
  }
  return raw;
}

function extractYoutubeLiveId(value) {
  const raw = String(value || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return "";
  let parsed;
  try { parsed = new URL(raw); } catch (_) { return ""; }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    return /^[\w-]{6,20}$/.test(id) ? id : "";
  }
  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") return "";
  const id = parsed.searchParams.get("v") || parsed.pathname.match(/\/(?:live|embed|shorts)\/([\w-]{6,20})/i)?.[1] || "";
  return /^[\w-]{6,20}$/.test(id) ? id : "";
}

function normalizeFifaLiveMatch(body) {
  const title = String(body?.title || "").trim().slice(0, 120);
  if (!title) {
    const err = new Error("Match nomi (title) kerak.");
    err.statusCode = 400;
    throw err;
  }
  const coverUrl = String(body?.coverUrl || "").trim();
  const sourceUrl = String(body?.youtubeUrl || body?.streamUrl || body?.telegramUrl || "").trim();
  const youtubeId = extractYoutubeLiveId(sourceUrl);
  const telegramUrl = youtubeId ? "" : normalizeFifaLiveTelegramUrl(sourceUrl);
  if (!youtubeId && !telegramUrl) {
    const err = new Error("YouTube Live, HLS (.m3u8) yoki Cloudflare WHEP havolasini kiriting.");
    err.statusCode = 400;
    throw err;
  }
  const startsAtRaw = String(body?.startsAt || "").trim();
  let startsAt = "";
  if (startsAtRaw) {
    const d = new Date(startsAtRaw);
    if (!Number.isNaN(d.getTime())) startsAt = d.toISOString();
  }
  const isLive = Boolean(body?.isLive);
  return { title, coverUrl, telegramUrl, youtubeUrl: youtubeId ? sourceUrl : "", youtubeId, startsAt, isLive, updatedAt: new Date().toISOString() };
}

async function readFifaLiveMatch() {
  const client = await getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(FIFA_LIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.title || (!data.telegramUrl && !data.youtubeUrl && !data.youtubeId)) return null;
    return data;
  } catch (err) {
    console.warn("redis get fifa-live xato:", err.message);
    return null;
  }
}

async function writeFifaLiveMatch(match) {
  const client = await getRedis();
  if (!client) return false;
  try {
    if (match) await client.set(FIFA_LIVE_KEY, JSON.stringify(match));
    else await client.del(FIFA_LIVE_KEY);
    return true;
  } catch (err) {
    console.warn("redis set fifa-live xato:", err.message);
    return false;
  }
}

const DEFAULT_FIFA_HIGHLIGHTS_CHANNEL = "https://www.youtube.com/@qsportuzbekistan/videos";

async function readFifaHighlightsConfig() {
  const client = await getRedis();
  if (!client) return { channelUrl: DEFAULT_FIFA_HIGHLIGHTS_CHANNEL, videos: [] };
  try {
    const raw = await client.get(FIFA_HIGHLIGHTS_KEY);
    if (!raw) return { channelUrl: DEFAULT_FIFA_HIGHLIGHTS_CHANNEL, videos: [] };
    const data = JSON.parse(raw);
    const channelUrl = data && typeof data === "object" && data.channelUrl ? String(data.channelUrl) : DEFAULT_FIFA_HIGHLIGHTS_CHANNEL;
    const videos = data && Array.isArray(data.videos) ? data.videos : [];
    return { channelUrl, videos, updatedAt: data?.updatedAt || "" };
  } catch (err) {
    console.warn("redis get fifa-highlights xato:", err.message);
    return { channelUrl: DEFAULT_FIFA_HIGHLIGHTS_CHANNEL, videos: [] };
  }
}

async function writeFifaHighlightsConfig(config) {
  const client = await getRedis();
  if (!client) return false;
  try {
    if (config && config.channelUrl) {
      const payload = {
        channelUrl: config.channelUrl,
        videos: Array.isArray(config.videos) ? config.videos : [],
        updatedAt: config.updatedAt || new Date().toISOString()
      };
      await client.set(FIFA_HIGHLIGHTS_KEY, JSON.stringify(payload));
    } else {
      await client.del(FIFA_HIGHLIGHTS_KEY);
    }
    return true;
  } catch (err) {
    console.warn("redis set fifa-highlights xato:", err.message);
    return false;
  }
}

// ===== TV kanallar (admin boshqaradi) =====
// Redis'da saqlanadi; bo'sh bo'lsa webapp statik /static/tv/tv-channels.json'ga o'tadi.
// v2 ataylab yangi bo‘sh namespace: eski v1 kanallari public/admin’da qayta chiqmaydi.
const TV_CHANNELS_KEY = "tv-channels:v2";
const TV_CHANNELS_MAX = 600;

function normalizeTvChannel(c) {
  if (!c || typeof c !== "object") return null;
  const name = String(c.name || "").trim().slice(0, 100);
  const url = String(c.url || "").trim().slice(0, 800);
  if (!name || !/^https?:\/\//i.test(url)) return null;
  return {
    name,
    group: String(c.group || "General").trim().slice(0, 40) || "General",
    logo: String(c.logo || "").trim().slice(0, 500),
    url,
  };
}

async function readTvChannels() {
  const client = await getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(TV_CHANNELS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.map(normalizeTvChannel).filter(Boolean) : null;
  } catch (err) {
    console.warn("redis get tv-channels xato:", err.message);
    return null;
  }
}

async function writeTvChannels(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    if (list) await client.set(TV_CHANNELS_KEY, JSON.stringify(list));
    else await client.del(TV_CHANNELS_KEY);
    return true;
  } catch (err) {
    console.warn("redis set tv-channels xato:", err.message);
    return false;
  }
}

async function handleFifaFavorites(request, response) {
  const user = await requireVerifiedUser(request, response);
  if (!user) return;
  const userId = request.verifiedUserId;
  const client = await getRedis();

  if (request.method === "GET") {
    response.setHeader("Cache-Control", "private, no-cache, no-store, max-age=0");
    if (!client) {
      return response.status(200).json({ ok: true, teams: {}, matches: {} });
    }
    try {
      const raw = await client.get(`fifa:favorites:v1:${userId}`);
      const data = raw ? JSON.parse(raw) : {};
      return response.status(200).json({
        ok: true,
        teams: data.teams && typeof data.teams === "object" ? data.teams : {},
        matches: data.matches && typeof data.matches === "object" ? data.matches : {},
      });
    } catch (err) {
      return response.status(500).json({ ok: false, error: err.message || "Sevimlilarni yuklab bo'lmadi." });
    }
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await readBody(request);
      let teams = body.teams && typeof body.teams === "object" ? body.teams : {};
      let matches = body.matches && typeof body.matches === "object" ? body.matches : {};

      if (client) {
        try {
          const raw = await client.get(`fifa:favorites:v1:${userId}`);
          if (raw) {
            const existing = JSON.parse(raw);
            if (existing && typeof existing === "object") {
              if (body.teams === undefined && existing.teams) teams = existing.teams;
              if (body.matches === undefined && existing.matches) matches = existing.matches;
            }
          }
        } catch (_) {}
      }

      const payload = {
        userId,
        teams,
        matches,
        updatedAt: Date.now(),
      };
      if (client) {
        await client.set(`fifa:favorites:v1:${userId}`, JSON.stringify(payload));
      }
      return response.status(200).json({ ok: true, teams, matches });
    } catch (err) {
      return response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
    }
  }

  if (request.method === "DELETE") {
    if (client) {
      await client.del(`fifa:favorites:v1:${userId}`);
    }
    return response.status(200).json({ ok: true, teams: {}, matches: {} });
  }

  return response.status(405).json({ ok: false, error: "Method not allowed." });
}

async function handleTvChannels(request, response) {
  if (request.method === "GET") {
    try {
      const channels = await readTvChannels();
      response.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
      response.status(200).json({ ok: true, channels });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }
  // Yozish — admin auth talab
  if (!(await requireAdmin(request, response))) return;
  try {
    const body = await readBody(request);
    if (!isRedisEnabled()) {
      response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
      return;
    }
    if (request.method === "DELETE" || body.action === "reset") {
      // Ro'yxatni to'liq tozalash — default statik ro'yxatga qaytmaydi.
      await writeTvChannels([]);
      response.status(200).json({ ok: true, channels: [] });
      return;
    }
    const list = Array.isArray(body.channels) ? body.channels : null;
    if (!list) { response.status(400).json({ ok: false, error: "channels massivi kerak." }); return; }
    const normalized = list.map(normalizeTvChannel).filter(Boolean).slice(0, TV_CHANNELS_MAX);
    const ok = await writeTvChannels(normalized);
    if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
    response.status(200).json({ ok: true, channels: normalized });
  } catch (err) {
    response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
  }
}

async function handleFifaLive(request, response) {
  if (request.method === "GET") {
    try {
      const match = await readFifaLiveMatch();
      response.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=120");
      response.status(200).json({ ok: true, match });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }
  // Yozish — faqat administrator
  if (!(await requireAdmin(request, response))) return;
  try {
    const body = await readBody(request);
    if (body.action === "upload") {
      const url = await handleUpload({ ...body, name: body.name || "fifa-live" });
      response.status(200).json({ ok: true, url });
      return;
    }
    if (!isRedisEnabled()) {
      response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
      return;
    }
    if (request.method === "DELETE" || body.action === "delete") {
      await writeFifaLiveMatch(null);
      response.status(200).json({ ok: true, match: null });
      return;
    }
    const match = normalizeFifaLiveMatch(body);
    const ok = await writeFifaLiveMatch(match);
    if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
    response.status(200).json({ ok: true, match });
  } catch (err) {
    response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
  }
}

// ===== Futbol YouTube Highlight Videolari =====
let fifaHighlightsCache = { data: null, at: 0, channelUrl: "" };
const FIFA_HIGHLIGHTS_TTL_MS = 10 * 60 * 1000;

function unescapeXml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatTimeAgoFromDate(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    if (diffMin <= 1) return "Hozirgina";
    return `${diffMin} daqiqa oldin`;
  }
  if (diffHours < 24) {
    return `${diffHours} soat oldin`;
  }
  if (diffDays === 1) {
    return "Kecha";
  }
  return `${diffDays} kun oldin`;
}

function isVideoWithin2Days(timeText, titleText = "", published = null) {
  const now = Date.now();

  // 1) Rasmiy YouTube ISO 8601 publication timestamp (masalan RSS feed'dan olingan)
  if (published) {
    const pubDate = new Date(published);
    const pubTime = pubDate.getTime();
    if (!Number.isNaN(pubTime)) {
      const diffHours = (now - pubTime) / (1000 * 60 * 60);
      // Agar diffHours <= 54 bo'lsa (2 kun / 48 soat + 6 soat oraliq) -> mos keladi
      if (diffHours >= -2 && diffHours <= 54) return true;
      if (diffHours > 54) return false;
    }
  }

  // 2) YouTube nisbiy vaqti (timeText) — eng yangi va to'g'ri ko'rsatkich
  const s = String(timeText || "").toLowerCase().trim();
  if (s) {
    // Hafta, oy, yil, week, month, year, недел, месяц, год -> ALBATTA 2 kundan eski
    if (/(?:week|hafta|недел|month|oy|месяц|year|yil|год)/i.test(s)) {
      return false;
    }

    // Soatlar, daqiqalar, soniyalar yoki bugungi -> ALBATTA 2 kun ichida (bugun)
    if (/(?:second|sec|minute|min|hour|soat|daqiqa|минут|час|ч(?:\s|\.|\$|ас)|bugun|today|сегодня|hozir|just now|moment)/i.test(s)) {
      return true;
    }

    // Kecha / yesterday / вчера -> 1 kun (mos keladi)
    if (/(?:yesterday|kecha|вчера)/i.test(s)) {
      return true;
    }

    // Kun soni: masalan "1 kun", "2 days", "3 kun", "1 дн", "2 дн", "1 день", "2 дня", "3 дня", "5 дней"
    const dayMatch = s.match(/([0-9]+)\s*(?:day|days|kun|день|дня|дней|дн\.?|д\.?)/i);
    if (dayMatch) {
      const days = parseInt(dayMatch[1], 10);
      if (!Number.isNaN(days)) {
        return days <= 2;
      }
    }

    const dMatch = s.match(/([0-9]+)\s*d\b/i);
    if (dMatch) {
      const days = parseInt(dMatch[1], 10);
      if (!Number.isNaN(days)) {
        return days <= 2;
      }
    }
  }

  // 3) Sarlavhada sana bo'lsa (masalan "20.10.2026", "19.10.2026")
  const fullText = (String(timeText || "") + " " + String(titleText || "")).trim();
  const dateMatch = fullText.match(/\b([0-3]?[0-9])\.([0-1]?[0-9])(?:\.(20\d{2}|\d{2}))?\b/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const curYear = new Date().getFullYear();
    const year = dateMatch[3] ? (dateMatch[3].length === 2 ? 2000 + parseInt(dateMatch[3], 10) : parseInt(dateMatch[3], 10)) : curYear;
    // O'yin kechqurun bo'lishini inobatga olib kunning oxirgi soatiga (23:59:59) nisbatan hisoblaymiz
    const videoDate = new Date(year, month, day, 23, 59, 59);
    if (!Number.isNaN(videoDate.getTime())) {
      const diffHours = (now - videoDate.getTime()) / (1000 * 60 * 60);
      // Agar o'yin kuni tugaganidan keyin 48 soatdan ko'p o'tmagan bo'lsa -> 2 kunlik
      if (diffHours <= 48) return true;
      if (diffHours > 48) return false;
    }
  }

  if (!timeText) {
    return false;
  }

  const numMatch = s.match(/([0-9]+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 3) return false;
    if (n <= 2) return true;
  }

  return false;
}

function normalizeYoutubeChannelUrl(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (/^@[\w.-]+$/.test(s)) return `https://www.youtube.com/${s}`;
  if (/^UC[\w-]{22}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, "")}`;
  }
  try {
    const parsed = new URL(s);
    let path = parsed.pathname.replace(/\/+(featured|shorts|streams|community|about|playlists|videos)\/?$/i, "");
    path = path.replace(/\/+$/, "");
    return `https://www.youtube.com${path}`;
  } catch {
    return s.replace(/\/+(featured|shorts|streams|community|about|playlists|videos)\/?$/i, "").replace(/\/+$/, "");
  }
}

function isShortsVideo(v) {
  if (/#shorts?\b/i.test(v?.title || "")) return true;
  if (/^0:[0-5][0-9]$/.test(v?.duration || "")) return true;
  return false;
}

function parseYtVideosFromData(data) {
  const extracted = [];
  const seenIds = new Set();

  function scan(obj) {
    if (!obj || typeof obj !== "object") return;

    // 1) Modern lockupViewModel (YouTube playlists and feeds)
    if (obj.lockupViewModel) {
      const lvm = obj.lockupViewModel;
      const videoId = String(lvm.contentId || lvm.videoId || "").trim();
      const title = String(lvm.metadata?.lockupMetadataViewModel?.title?.content || "").trim();
      if (videoId && !videoId.startsWith("PL") && title && !seenIds.has(videoId)) {
        seenIds.add(videoId);

        // Duration: badges in overlays
        let duration = "";
        const overlays = lvm.contentImage?.thumbnailViewModel?.overlays || [];
        for (const ov of overlays) {
          const badge = ov.thumbnailBottomOverlayViewModel?.badges || ov.thumbnailOverlayBadgeViewModel?.thumbnailBadges || [];
          for (const b of badge) {
            if (b.thumbnailBadgeViewModel?.text) {
              duration = b.thumbnailBadgeViewModel.text;
              break;
            }
          }
          if (duration) break;
        }

        // timeAgo: metadataRows
        let timeAgo = "";
        const metadataRows = lvm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
        for (const row of metadataRows) {
          for (const part of (row.metadataParts || [])) {
            const txt = part.accessibilityLabel || part.text?.content || "";
            if (/просмотр|view/i.test(txt)) continue;
            if (/(?:назад|ago|oldin|\b(?:kun|day|days|hour|hours|soat|min|minute|минут|час|часа|часов|дн|дней|дня)\b|\d+\s*ч\b)/i.test(txt)) {
              timeAgo = part.text?.content || part.accessibilityLabel || "";
              break;
            }
          }
          if (timeAgo) break;
        }
        if (!timeAgo && metadataRows[1]?.metadataParts?.length >= 2) {
          timeAgo = metadataRows[1].metadataParts[1]?.text?.content || metadataRows[1].metadataParts[1]?.accessibilityLabel || "";
        }

        const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        extracted.push({
          videoId,
          title,
          timeAgo,
          duration,
          thumb,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    // 2) Classic playlistVideoRenderer (YouTube playlists)
    if (obj.playlistVideoRenderer) {
      const pvr = obj.playlistVideoRenderer;
      const videoId = String(pvr.videoId || "").trim();
      const title = String(pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || "").trim();
      if (videoId && title && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        const timeAgo = pvr.videoInfo?.runs?.[2]?.text || pvr.publishedTimeText?.simpleText || "";
        const duration = pvr.lengthText?.simpleText || "";
        const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        extracted.push({
          videoId,
          title,
          timeAgo,
          duration,
          thumb,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    // 3) videoRenderer
    if (obj.videoRenderer) {
      const vr = obj.videoRenderer;
      const videoId = String(vr.videoId || "").trim();
      const title = String(vr.title?.runs?.[0]?.text || vr.title?.simpleText || "").trim();
      if (videoId && title && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        const timeAgo = vr.publishedTimeText?.simpleText || "";
        const duration = vr.lengthText?.simpleText || "";
        const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        extracted.push({
          videoId,
          title,
          timeAgo,
          duration,
          thumb,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    // 4) gridVideoRenderer
    if (obj.gridVideoRenderer) {
      const gvr = obj.gridVideoRenderer;
      const videoId = String(gvr.videoId || "").trim();
      const title = String(gvr.title?.runs?.[0]?.text || gvr.title?.simpleText || "").trim();
      if (videoId && title && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        const timeAgo = gvr.publishedTimeText?.simpleText || "";
        const duration = gvr.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || "";
        const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        extracted.push({
          videoId,
          title,
          timeAgo,
          duration,
          thumb,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }

    for (const key of Object.keys(obj)) {
      scan(obj[key]);
    }
  }

  scan(data);
  return extracted;
}

async function scrapeYoutubePage(url, debugObj = null) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uz,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Cookie": "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODEzNzk5NDQaAmVuIAEaBgiAo_CLBg; PREF=tz=Asia.Tashkent&hl=ru&gl=UZ",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (debugObj) debugObj.status = res.status;
    if (!res.ok) {
      if (debugObj) debugObj.err = `HTTP ${res.status}`;
      return { html: "", videos: [] };
    }
    const html = await res.text();
    if (debugObj) debugObj.htmlLen = html.length;

    const jsonMatch = html.match(/var ytInitialData\s*=\s*({[\s\S]+?});<\/script>/) ||
                      html.match(/ytInitialData\s*=\s*({[\s\S]+?});/) ||
                      html.match(/window\["ytInitialData"\]\s*=\s*({[\s\S]+?});/);
    if (!jsonMatch) {
      if (debugObj) debugObj.err = "no ytInitialData";
      return { html, videos: [] };
    }

    let data;
    try {
      data = JSON.parse(jsonMatch[1]);
    } catch (parseErr) {
      if (debugObj) debugObj.err = `json parse: ${parseErr.message}`;
      return { html, videos: [] };
    }

    const videos = parseYtVideosFromData(data);
    if (debugObj) {
      debugObj.parsedCount = videos.length;
      if (videos.length === 0) {
        debugObj.alerts = data.alerts;
        debugObj.contentsKeys = data.contents ? Object.keys(data.contents) : null;
        const s = JSON.stringify(data);
        debugObj.hasVideoId = s.includes('"videoId"');
        debugObj.hasContentId = s.includes('"contentId"');
        debugObj.hasLockup = s.includes('lockupViewModel');
        debugObj.hasContinuation = s.includes('continuationItemRenderer');
        debugObj.slice = s.slice(0, 800);
      }
    }
    return { html, videos };
  } catch (fetchErr) {
    if (debugObj) debugObj.err = fetchErr.message;
    return { html: "", videos: [] };
  }
}

async function fetchYoutubeHighlightsFromChannel(channelUrl, debugOut = null) {
  let raw = String(channelUrl || DEFAULT_FIFA_HIGHLIGHTS_CHANNEL).trim();
  if (!raw) raw = DEFAULT_FIFA_HIGHLIGHTS_CHANNEL;
  if (/^@[\w.-]+$/.test(raw)) raw = `https://www.youtube.com/${raw}`;
  if (/^UC[\w-]{22}$/.test(raw)) raw = `https://www.youtube.com/channel/${raw}`;

  const normBase = raw.replace(/\/+(featured|shorts|streams|community|about|playlists|videos)\/?$/i, "").replace(/\/+$/, "");
  const videosUrl = `${normBase}/videos`;

  if (debugOut) {
    debugOut.raw = raw;
    debugOut.normBase = normBase;
    debugOut.videosUrl = videosUrl;
    debugOut.videosDiag = {};
  }

  const videoMap = new Map();

  // 1) QAT'IY TALAB: Eng avvalo aynan YouTube kanalining /videos (Videolar) bo'limidan scrape qilamiz.
  // Bu bo'lim barcha to'liq o'yin sharhlari va highlightslarini eng yangisidan boshlab xronologik beradi.
  const { html: vHtml, videos: vVideos } = await scrapeYoutubePage(videosUrl, debugOut ? debugOut.videosDiag : null);
  for (const vv of (vVideos || [])) {
    if (vv.videoId && !videoMap.has(vv.videoId)) {
      videoMap.set(vv.videoId, vv);
    }
  }

  // Kanal ID'sini aniqlash (agar RSS mavjud bo'lsa)
  let channelIdMatch = raw.match(/channel\/(UC[\w-]{22})/);
  let channelId = channelIdMatch ? channelIdMatch[1] : null;
  if (!channelId && vHtml) {
    const m = vHtml.match(/"browseId":\s*"(UC[\w-]{22})"/) ||
              vHtml.match(/"externalId":\s*"(UC[\w-]{22})"/) ||
              vHtml.match(/channel\/(UC[\w-]{22})/) ||
              vHtml.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/);
    if (m) channelId = m[1];
  }
  if (debugOut) debugOut.channelId = channelId;

  // 2) Agar channelId aniqlangan bo'lsa, YouTube RSS orqali ISO 8601 publication sanalarini to'ldiramiz
  if (channelId) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      if (debugOut) debugOut.rssUrl = rssUrl;
      const rssRes = await fetch(rssUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
        },
        signal: AbortSignal.timeout(8000)
      });
      if (rssRes.ok) {
        const rssXml = await rssRes.text();
        const entries = rssXml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        if (debugOut) debugOut.rssCount = entries.length;
        for (const entry of entries) {
          const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
          const videoId = videoIdMatch ? videoIdMatch[1].trim() : "";
          if (!videoId) continue;

          const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
          const rawTitle = titleMatch ? titleMatch[1].trim() : "";
          const title = unescapeXml(rawTitle);

          const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
          const published = publishedMatch ? publishedMatch[1].trim() : "";

          const thumbMatch = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/);
          const thumb = thumbMatch ? thumbMatch[1].trim() : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          const timeAgo = published ? formatTimeAgoFromDate(new Date(published)) : "";

          const existing = videoMap.get(videoId);
          if (existing) {
            existing.published = published;
            if (!existing.timeAgo && timeAgo) existing.timeAgo = timeAgo;
          } else {
            videoMap.set(videoId, {
              videoId,
              title,
              timeAgo,
              duration: "",
              thumb,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              published
            });
          }
        }
      }
    } catch (rssErr) {
      if (debugOut) debugOut.rssErr = rssErr.message;
    }
  }

  // 3) Agar /videos sahifasidan video topilmagan bo'lsa (e.g. YouTube o'zgarishi), asosiy sahifa va playlistdan urinish
  if (videoMap.size === 0) {
    if (debugOut) debugOut.baseDiag = {};
    const { videos: baseVideos } = await scrapeYoutubePage(normBase, debugOut ? debugOut.baseDiag : null);
    for (const bv of (baseVideos || [])) {
      if (bv.videoId && !videoMap.has(bv.videoId)) videoMap.set(bv.videoId, bv);
    }
  }
  if (channelId && videoMap.size === 0) {
    const uploadsPlaylistId = channelId.replace(/^UC/, "UU");
    const playlistUrl = `https://www.youtube.com/playlist?list=${uploadsPlaylistId}`;
    if (debugOut) debugOut.playlistUrl = playlistUrl;
    const { videos: plVideos } = await scrapeYoutubePage(playlistUrl, debugOut ? debugOut.plDiag : null);
    for (const pv of (plVideos || [])) {
      if (pv.videoId && !videoMap.has(pv.videoId)) videoMap.set(pv.videoId, pv);
    }
  }

  const allVideos = Array.from(videoMap.values());
  if (debugOut) {
    debugOut.totalFound = allVideos.length;
  }

  // QAT'IY TALAB: Faqat va faqat oxirgi 2 kunlik videolarni saralash!
  const recent = allVideos.filter((v) => isVideoWithin2Days(v.timeAgo, v.title, v.published));
  if (recent.length === 0) {
    if (debugOut) {
      debugOut.recentCount = 0;
      debugOut.regularCount = 0;
      debugOut.finalCount = 0;
    }
    return [];
  }

  // Shorts (<= 60 soniya yoki #shorts) lardan asosiy o'yin sharhlarini afzal ko'rish
  const regular = recent.filter((v) => !isShortsVideo(v));
  const finalVideos = regular.length > 0 ? regular : recent;

  if (debugOut) {
    debugOut.recentCount = recent.length;
    debugOut.regularCount = regular.length;
    debugOut.finalCount = finalVideos.length;
  }

  return finalVideos;
}

async function parseAndEnrichRawVideos(rawText) {
  if (!rawText || typeof rawText !== "string") return [];
  const videoIdRegex = /(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)|(?:\bvi?\/))([a-zA-Z0-9_-]{11})\b/g;
  const ids = [];
  const seen = new Set();
  let m;
  while ((m = videoIdRegex.exec(rawText)) !== null) {
    const id = m[1];
    if (!seen.has(id) && !id.startsWith("PL")) {
      seen.add(id);
      ids.push(id);
    }
  }

  const lines = rawText.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && !seen.has(trimmed) && !trimmed.startsWith("PL")) {
      seen.add(trimmed);
      ids.push(trimmed);
    }
  }

  const results = [];
  for (const id of ids.slice(0, 30)) {
    let title = "";
    let thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, {
        signal: AbortSignal.timeout(3500)
      });
      if (oembedRes.ok) {
        const j = await oembedRes.json();
        title = j.title || "";
        if (j.thumbnail_url) thumb = j.thumbnail_url;
      }
    } catch (_) {}

    results.push({
      videoId: id,
      title: title || `O'yin sharhi (${id})`,
      timeAgo: "Bugun",
      duration: "",
      thumb,
      url: `https://www.youtube.com/watch?v=${id}`
    });
  }
  return results;
}

async function handleFifaHighlights(request, response) {
  if (request.method === "GET") {
    try {
      const now = Date.now();
      const query = request.query || {};
      const isDebug = query.debug === "1" || query.refresh === "1";
      const cfg = await readFifaHighlightsConfig();
      const channelUrl = cfg?.channelUrl || DEFAULT_FIFA_HIGHLIGHTS_CHANNEL;

      // Kesh 15 daqiqa amal qiladi, so'ng YouTube'dan avtomatik yangi highlightlar tortiladi
      const FIFA_HIGHLIGHTS_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
      const lastUpdatedMs = cfg?.updatedAt ? new Date(cfg.updatedAt).getTime() : 0;
      const isExpired = !lastUpdatedMs || Number.isNaN(lastUpdatedMs) || (now - lastUpdatedMs > FIFA_HIGHLIGHTS_REFRESH_INTERVAL_MS);
      const forceRefresh = query.refresh === "1";

      let videos = Array.isArray(cfg?.videos) ? cfg.videos : [];
      // Avvalo keshdagi videolardan faqat oxirgi 2 kunliklarini saralaymiz
      videos = videos.filter((v) => isVideoWithin2Days(v.timeAgo, v.title, v.published));

      let debugOut = {};

      if (isExpired || forceRefresh || videos.length === 0) {
        let fetchPromise = FOOTBALL_INFLIGHT.get("fifa-highlights-scrape");
        if (!fetchPromise) {
          fetchPromise = fetchYoutubeHighlightsFromChannel(channelUrl, debugOut)
            .finally(() => FOOTBALL_INFLIGHT.delete("fifa-highlights-scrape"));
          FOOTBALL_INFLIGHT.set("fifa-highlights-scrape", fetchPromise);
        }
        const scraped = await fetchPromise.catch((err) => {
          console.warn("Fifa highlights scrape failed:", err.message);
          return null;
        });

        if (scraped !== null) {
          videos = scraped;
          await writeFifaHighlightsConfig({ channelUrl, videos, updatedAt: new Date().toISOString() });
        }
      }

      // Qat'iy yakuniy tekshiruv: faqat oxirgi 2 kunlik videolar
      videos = videos.filter((v) => isVideoWithin2Days(v.timeAgo, v.title, v.published));

      const payload = {
        ok: true,
        channelUrl,
        count: videos.length,
        videos,
        updatedAt: cfg?.updatedAt || new Date().toISOString()
      };
      if (isDebug) payload.debug = debugOut;

      if (videos.length > 0) {
        fifaHighlightsCache = { data: payload, at: now, channelUrl };
      }
      response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      response.status(200).json(payload);
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Videolarni yuklab bo'lmadi.", count: 0, videos: [] });
    }
    return;
  }

  // Yozish / o'chirish — faqat administrator
  if (!(await requireAdmin(request, response))) return;

  try {
    const body = await readBody(request);
    if (request.method === "DELETE" || body.action === "delete") {
      await writeFifaHighlightsConfig(null);
      fifaHighlightsCache = { data: null, at: 0, channelUrl: "" };
      response.status(200).json({ ok: true, channelUrl: "", count: 0, videos: [] });
      return;
    }

    const cfg = await readFifaHighlightsConfig();
    let channelUrl = normalizeYoutubeChannelUrl(body.channelUrl) || cfg?.channelUrl || "";
    let videos = Array.isArray(body.videos) ? body.videos : [];

    // Admin rawText (havolalar yoki YouTube sahifasi matni) yuborgan bo'lsa
    if (body.rawText && typeof body.rawText === "string") {
      const imported = await parseAndEnrichRawVideos(body.rawText);
      if (imported.length > 0) {
        videos = imported;
      }
    }

    const debugOut = {};
    let isGeoblocked = false;

    // Agar videolar berilmagan bo'lsa, YouTube'dan yangi scrape qilish
    if (videos.length === 0 && channelUrl) {
      try {
        const scraped = await fetchYoutubeHighlightsFromChannel(channelUrl, debugOut);
        if (scraped && scraped.length > 0) {
          videos = scraped;
        }
      } catch (fetchErr) {
        debugOut.catchErr = fetchErr.message;
      }
    }

    if (debugOut?.plDiag?.alerts?.some((a) => JSON.stringify(a).includes("Недоступные видео скрыты"))) {
      isGeoblocked = true;
    }

    // Qat'iy qoida: Faqat oxirgi 2 kunlik videolar saqlanadi (agar 2 kunda video bo'lmasa, bo'sh [] saqlanadi)
    videos = videos.filter((v) => isVideoWithin2Days(v.timeAgo, v.title, v.published));

    await writeFifaHighlightsConfig({ channelUrl, videos, updatedAt: new Date().toISOString() });
    const payload = {
      ok: true,
      channelUrl,
      count: videos.length,
      videos,
      geoblocked: isGeoblocked,
      debug: debugOut
    };
    if (videos.length > 0) {
      fifaHighlightsCache = { data: payload, at: Date.now(), channelUrl };
    }
    response.status(200).json(payload);
  } catch (err) {
    response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
  }
}

async function handleFifa(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const dateKey = normalizeFootballDate(url.searchParams.get("date"));
  const leagueId = String(url.searchParams.get("league") || FOOTBALL_LEAGUES[0].id).trim();
  const activeLeagueId = FOOTBALL_LEAGUES.some((league) => league.id === leagueId) ? leagueId : FOOTBALL_LEAGUES[0].id;
  const todayKey = dateKeyInTimeZone();
  const cacheKey = `fifa:scoreboard:${dateKey}:${activeLeagueId}`;

  const cached = await getFootballCache(cacheKey);
  if (cached?.isHit) {
    applyFootballHeaders(response, cached.data, dateKey, todayKey, "HIT");
    response.status(200).json(cached.data);
    return;
  }

  try {
    const data = await fetchWithSingleFlight(cacheKey, async () => {
      return await buildFootballPayload(dateKey, activeLeagueId);
    });

    // TTL hisoblash:
    // 1) O'tib ketgan o'yinlar: 60 daqiqa kesh
    // 2) Kelajakdagi o'yinlar: 45 daqiqa kesh
    // 3) Bugungi o'yinlar: jonli o'yin bo'lsa 60 soniya, bo'lmasa 10 daqiqa
    const hasLive = Array.isArray(data?.matches) && data.matches.some((m) => m.status === "live");
    let ttlMs = 60 * 60 * 1000;
    if (dateKey < todayKey) {
      ttlMs = 60 * 60 * 1000; // 60 daqiqa
    } else if (dateKey > todayKey) {
      ttlMs = 45 * 60 * 1000; // 45 daqiqa
    } else if (hasLive) {
      ttlMs = 60 * 1000; // 60 soniya (jonli o'yinlar)
    } else {
      ttlMs = 10 * 60 * 1000; // 10 daqiqa (bugun, lekin hozir jonli o'yin yo'q)
    }

    await setFootballCache(cacheKey, data, ttlMs);
    applyFootballHeaders(response, data, dateKey, todayKey, cached ? "REVALIDATED" : "MISS");
    response.status(200).json(data);
  } catch (err) {
    try {
      const { reportError } = require("./_lib/error-logger");
      reportError(err, { location: "Futbol API (fifa scoreboard)", url: request.url, method: request.method }).catch(() => {});
    } catch (_) {}
    if (cached) {
      applyFootballHeaders(response, cached.data, dateKey, todayKey, "STALE");
      response.status(200).json(cached.data);
      return;
    }
    response.status(502).json({ ok: false, error: err.message || "Futbol manbasi javob bermadi." });
  }
}

function normalizeEspnUpcomingMatch(event, league) {
  const competition = event?.competitions?.[0] || {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const start = event?.date || competition?.startDate;
  if (!home?.team || !away?.team || !start) return null;
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) return null;
  const dateInTashkent = dateKeyInTimeZone(date);
  const statusType = competition?.status?.type || {};
  const state = String(statusType.state || "").toLowerCase();
  const isLive = state === "in" || state === "live" || /in.progress|in progress|halftime|delayed/i.test(String(statusType.name || statusType.description || ""));
  const isFinished = Boolean(statusType.completed) || state === "post" || /final|full time|ended|finished/i.test(String(statusType.name || statusType.description || ""));
  const status = isLive ? "live" : isFinished ? "finished" : "upcoming";
  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: FOOTBALL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
  const homeScore = home.score != null && home.score !== "" ? String(home.score) : null;
  const awayScore = away.score != null && away.score !== "" ? String(away.score) : null;
  const score = (status !== "upcoming" && homeScore != null && awayScore != null)
    ? `${homeScore} : ${awayScore}`
    : null;
  const venue = competition?.venue?.fullName || competition?.venue?.address?.city || "";
  const round = competition?.notes?.[0]?.headline || event?.seasonType?.name || "";
  return {
    id: String(event.id || `${league.id}-${start}-${home.team.id}-${away.team.id}`),
    leagueId: league.id,
    leagueName: league.name,
    leagueFullName: league.fullName,
    leagueLogo: league.logo || "",
    kickoffUtc: date.toISOString(),
    kickoffDate: dateInTashkent,
    time: localTime,
    venue,
    round,
    status,
    minute: isLive ? String(competition?.status?.displayClock || competition?.status?.clock || "LIVE") : null,
    score,
    home: {
      id: String(home.team.id || ""),
      name: String(home.team.displayName || home.team.shortDisplayName || home.team.name || "").trim(),
      logo: espnTeamLogo(home.team),
    },
    away: {
      id: String(away.team.id || ""),
      name: String(away.team.displayName || away.team.shortDisplayName || away.team.name || "").trim(),
      logo: espnTeamLogo(away.team),
    },
  };
}

async function handleFifaUpcoming(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const requestedLeagueId = String(url.searchParams.get("league") || "").trim();
  const daysCount = Math.min(10, Math.max(3, Number(url.searchParams.get("days")) || 7));
  const todayKey = dateKeyInTimeZone();
  const cacheKey = `fifa:upcoming:${requestedLeagueId || "all"}:${daysCount}:${todayKey}`;

  const cached = await getFootballCache(cacheKey);
  if (cached?.isHit) {
    response.setHeader("X-Football-Cache", "HIT");
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=2700, stale-while-revalidate=3600");
    response.setHeader("Vary", "Accept-Encoding");
    response.status(200).json(cached.data);
    return;
  }

  try {
    const payload = await fetchWithSingleFlight(cacheKey, async () => {
      const dateKeys = [];
      const base = new Date();
      for (let i = 0; i < daysCount; i++) {
        const d = new Date(base.getTime() + i * 86400000);
        dateKeys.push(d.toISOString().slice(0, 10).replaceAll("-", ""));
      }

      const leaguesToFetch = requestedLeagueId && FOOTBALL_LEAGUES.some((l) => l.id === requestedLeagueId)
        ? FOOTBALL_LEAGUES.filter((l) => l.id === requestedLeagueId)
        : FOOTBALL_LEAGUES;

      const tasks = [];
      leaguesToFetch.forEach((league) => {
        dateKeys.forEach((dStr) => {
          tasks.push(
            fetchJson(`${ESPN_SCOREBOARD_BASE}/${league.id}/scoreboard?dates=${dStr}`, 8000)
              .then((p) => ({ league, payload: p }))
              .catch(() => null)
          );
        });
      });

      const results = await Promise.allSettled(tasks);
      const uniqueMatches = new Map();

      results.forEach((r) => {
        if (r.status !== "fulfilled" || !r.value || !r.value.payload) return;
        const { league, payload: resPayload } = r.value;
        const events = Array.isArray(resPayload?.events) ? resPayload.events : [];
        events.forEach((ev) => {
          const normalized = normalizeEspnUpcomingMatch(ev, league);
          if (normalized && !uniqueMatches.has(normalized.id)) {
            uniqueMatches.set(normalized.id, normalized);
          }
        });
      });

      const allMatches = Array.from(uniqueMatches.values()).sort((a, b) =>
        a.kickoffUtc.localeCompare(b.kickoffUtc)
      );

      return {
        ok: true,
        count: allMatches.length,
        updatedAt: new Date().toISOString(),
        matches: allMatches,
      };
    });

    // Kelajakdagi o'yinlar taqvimi: 45 daqiqa (2700 soniya) kesh
    const ttlMs = 45 * 60 * 1000;
    await setFootballCache(cacheKey, payload, ttlMs);
    response.setHeader("X-Football-Cache", cached ? "REVALIDATED" : "MISS");
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=2700, stale-while-revalidate=3600");
    response.setHeader("Vary", "Accept-Encoding");
    response.status(200).json(payload);
  } catch (err) {
    try {
      const { reportError } = require("./_lib/error-logger");
      reportError(err, { location: "Futbol API (fifa-upcoming)", url: request.url, method: request.method }).catch(() => {});
    } catch (_) {}
    if (cached) {
      response.setHeader("X-Football-Cache", "STALE");
      response.setHeader("Cache-Control", "public, max-age=300, s-maxage=2700, stale-while-revalidate=3600");
      response.setHeader("Vary", "Accept-Encoding");
      response.status(200).json(cached.data);
      return;
    }
    response.status(502).json({ ok: false, error: err.message || "Upcoming o'yinlar manbasi javob bermadi." });
  }
}

// =========================================================================
// FIFA Lineup (ESPN public API) — Vercel'dan ochiq, to'liq 11+15 tarkib.
// /scoreboard?dates=YYYYMMDD → topic eventId by team names
// /summary?event=X → rosters (formation, starters, subs, jersey, photo, stats)
// =========================================================================
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TEAM_ALIASES = {
  "usa": "united states",
  "us": "united states",
  "south korea": "korea republic",
  "ivory coast": "cote d ivoire",
  "bosnia herzegovina": "bosnia",
  "bosnia and herzegovina": "bosnia",
  "czech republic": "czechia",
};
function canonTeam(name) {
  const n = normalizeName(name);
  return TEAM_ALIASES[n] || n;
}

function espnTeamsMatch(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const clean = (s) => String(s || "")
    .toLowerCase()
    .replace(/\b(fc|cf|sc|afc|fk|ac|as|ss|rcd|rc|ud|cd|spvgg|vfb)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
  const c1 = clean(nameA);
  const c2 = clean(nameB);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.includes(c2) || c2.includes(c1)) return true;
  return false;
}

async function findEspnEventId(home, away, dateUtc, preferredLeagueId = "") {
  const base = dateUtc ? new Date(`${dateUtc}T12:00:00Z`) : new Date();
  const days = [-1, 0, 1].map((off) => {
    const d = new Date(base.getTime() + off * 86400000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  });
  const hC = canonTeam(home);
  const aC = canonTeam(away);
  const candidateLeagues = [
    preferredLeagueId,
    ...FOOTBALL_LEAGUES.map((l) => l.id).filter((id) => id !== preferredLeagueId),
    "fifa.world",
  ].filter(Boolean);

  for (const lid of candidateLeagues) {
    for (const d of days) {
      const json = await fetchJson(`${ESPN_SCOREBOARD_BASE}/${lid}/scoreboard?dates=${d}`, 7000).catch(() => null);
      if (!json) continue;
      const events = Array.isArray(json.events) ? json.events : [];
      for (const ev of events) {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const competitors = comp.competitors || [];
        const h = competitors.find((c) => c.homeAway === "home") || competitors[0];
        const a = competitors.find((c) => c.homeAway === "away") || competitors[1];
        const hN = canonTeam(h?.team?.displayName || h?.team?.name);
        const aN = canonTeam(a?.team?.displayName || a?.team?.name);
        if ((espnTeamsMatch(hN, hC) && espnTeamsMatch(aN, aC)) ||
            (espnTeamsMatch(hN, aC) && espnTeamsMatch(aN, hC))) {
          return { eventId: ev.id, leagueId: lid };
        }
      }
    }
  }
  return null;
}

function espnDepthScore(abbrRaw) {
  const a = String(abbrRaw || "").toUpperCase();
  if (!a || a === "G" || a === "GK") return 0;
  if (/^CB$|^CD(-[LR])?$/.test(a)) return 1.0;
  if (/^[LR]B$|^[LR]WB$/.test(a)) return 1.3;
  if (/^DM|^CDM/.test(a)) return 2.0;
  if (/^[LR]M$/.test(a)) return 2.5;
  if (/^CM(-[LR])?$|^M$/.test(a)) return 3.0;
  if (/^AM|^CAM|AML|AMR/.test(a)) return 3.5;
  if (/^[LR]W$/.test(a)) return 3.7;
  if (/^CF(-[LR])?$|^ST$|^F$|^LF$|^RF$/.test(a)) return 5.0;
  return 3.0;
}

function espnSideOrder(abbrRaw) {
  const a = String(abbrRaw || "").toUpperCase();
  if (/^L[BMWF]/.test(a) || /^LWB/.test(a)) return -2;
  if (a.endsWith("-L")) return -1;
  if (/^R[BMWF]/.test(a) || /^RWB/.test(a)) return 2;
  if (a.endsWith("-R")) return 1;
  return 0;
}

const KNOWN_PLAYER_CUTOUTS = {
  "kylian mbappe": "https://api.sofascore.app/api/v1/player/826643/image",
  "mbappe": "https://api.sofascore.app/api/v1/player/826643/image",
  "vinicius junior": "https://api.sofascore.app/api/v1/player/868812/image",
  "vinicius jr": "https://api.sofascore.app/api/v1/player/868812/image",
  "vinicius": "https://api.sofascore.app/api/v1/player/868812/image",
  "jude bellingham": "https://api.sofascore.app/api/v1/player/991011/image",
  "bellingham": "https://api.sofascore.app/api/v1/player/991011/image",
  "federico valverde": "https://api.sofascore.app/api/v1/player/827725/image",
  "valverde": "https://api.sofascore.app/api/v1/player/827725/image",
  "erling haaland": "https://api.sofascore.app/api/v1/player/839956/image",
  "haaland": "https://api.sofascore.app/api/v1/player/839956/image",
  "lionel messi": "https://api.sofascore.app/api/v1/player/12994/image",
  "messi": "https://api.sofascore.app/api/v1/player/12994/image",
  "cristiano ronaldo": "https://api.sofascore.app/api/v1/player/750/image",
  "ronaldo": "https://api.sofascore.app/api/v1/player/750/image",
};

const FOOTBALL_PLAYER_PHOTO_CACHE = new Map();

async function fetchWikiJson(url, timeoutMs = 2500) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "MyKinoBot/1.0 (dev@mykino.uz)",
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolvePlayerPhoto(name, espnId = "") {
  if (!name) return "";
  const clean = String(name).trim();
  const cacheKey = clean.toLowerCase();

  // 0. Known top player cutout (Sofascore HD cutout)
  if (typeof KNOWN_PLAYER_CUTOUTS !== "undefined" && KNOWN_PLAYER_CUTOUTS[cacheKey]) {
    return KNOWN_PLAYER_CUTOUTS[cacheKey];
  }
  const nameNorm = cacheKey.replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(KNOWN_PLAYER_CUTOUTS || {})) {
    if (k.replace(/[^a-z]/g, "") === nameNorm || (k.length > 5 && nameNorm.includes(k.replace(/[^a-z]/g, "")))) {
      return v;
    }
  }

  // 1. L1 Memory Cache
  if (FOOTBALL_PLAYER_PHOTO_CACHE.has(cacheKey)) {
    return FOOTBALL_PLAYER_PHOTO_CACHE.get(cacheKey);
  }

  // 2. L2 Redis Cache
  const client = await getRedis().catch(() => null);
  if (client) {
    try {
      const cached = await client.get(`fifa:photo:${cacheKey}`);
      if (cached) {
        FOOTBALL_PLAYER_PHOTO_CACHE.set(cacheKey, cached);
        return cached;
      }
    } catch {}
  }

  // 3. Wikipedia API
  let photo = "";
  try {
    const slug = encodeURIComponent(clean.replace(/\s+/g, "_"));
    const wiki = await fetchWikiJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, 2200);
    if (wiki?.thumbnail?.source) {
      photo = wiki.thumbnail.source;
    } else {
      const searchRes = await fetchWikiJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean + " footballer")}&format=json&utf8=1&srlimit=1`,
        2200
      );
      const topTitle = searchRes?.query?.search?.[0]?.title;
      if (topTitle) {
        const topSlug = encodeURIComponent(topTitle.replace(/\s+/g, "_"));
        const topSummary = await fetchWikiJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${topSlug}`, 2200);
        if (topSummary?.thumbnail?.source) {
          photo = topSummary.thumbnail.source;
        }
      }
    }
  } catch {}

  // 4. Fallback to ESPN combiner
  if (!photo && espnId) {
    photo = `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${espnId}.png&w=120&h=120&scale=crop`;
  }

  if (photo) {
    FOOTBALL_PLAYER_PHOTO_CACHE.set(cacheKey, photo);
    if (client) {
      client.set(`fifa:photo:${cacheKey}`, photo, "EX", 86400 * 30).catch(() => {});
    }
  }

  return photo;
}

async function batchResolvePlayerPhotos(players = []) {
  if (!Array.isArray(players) || !players.length) return;
  await Promise.allSettled(
    players.map(async (p) => {
      if (p.photo && !p.photo.includes("a.espncdn.com/combiner")) return;
      const found = await resolvePlayerPhoto(p.name, p.id);
      if (found) p.photo = found;
    })
  );
}

function espnMapPlayer(p, keyEvents = []) {
  const statsArr = Array.isArray(p.stats) ? p.stats : [];
  const stats = {};
  for (const s of statsArr) stats[s.name] = Number(s.displayValue || s.value || 0) || 0;

  let subOutMinute = "";
  if (p.subbedOut === true) {
    const subPlay = Array.isArray(p.plays) ? p.plays.find((pl) => pl.substitution) : null;
    if (subPlay?.clock?.displayValue) {
      subOutMinute = String(subPlay.clock.displayValue);
    } else if (Array.isArray(keyEvents)) {
      const pName = String(p?.athlete?.displayName || p?.athlete?.fullName || "").toLowerCase();
      const subEv = keyEvents.find((e) => e.type === "substitution" && (
        (e.playerOut && pName.includes(e.playerOut.toLowerCase())) ||
        (e.player && pName.includes(e.player.toLowerCase()))
      ));
      if (subEv?.minute) subOutMinute = subEv.minute;
    }
  }

  let assists = stats.goalAssists || 0;
  if (!assists && Array.isArray(keyEvents)) {
    const pName = String(p?.athlete?.displayName || p?.athlete?.fullName || "").toLowerCase();
    assists = keyEvents.filter((e) => (e.type === "goal" || e.type === "penalty") && e.assist && pName.includes(e.assist.toLowerCase())).length;
  }

  const isCap = p.captain === true || p.isCaptain === true || p?.athlete?.captain === true;

  return {
    id: p?.athlete?.id || null,
    number: p.jersey != null ? Number(p.jersey) : null,
    name: String(p?.athlete?.displayName || p?.athlete?.fullName || "").trim(),
    shortName: String(p?.athlete?.shortName || p?.athlete?.displayName || "").trim(),
    position: String(p?.position?.abbreviation || ""),
    starter: p.starter === true,
    photo: p?.athlete?.headshot?.href || (p?.athlete?.id ? `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${p.athlete.id}.png&w=120&h=120&scale=crop` : ""), 
    isCaptain: isCap,
    rating: null,
    motm: false,
    goals: stats.totalGoals || 0,
    assists,
    ownGoals: stats.ownGoals || 0,
    yellowCard: (stats.yellowCards || 0) > 0,
    redCard: (stats.redCards || 0) > 0,
    subOut: p.subbedOut === true,
    subOutMinute,
    subIn: p.subbedIn === true,
    x: null,
    y: null,
  };
}

function espnAssignFormationCoords(starters, formation) {
  const segsRaw = String(formation || "").split("-").map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  const segs = segsRaw.length ? segsRaw : [4, 4, 2];
  const gk = starters.filter((p) => espnDepthScore(p.position) === 0);
  const outfield = starters.filter((p) => espnDepthScore(p.position) > 0);
  outfield.sort((a, b) => espnDepthScore(a.position) - espnDepthScore(b.position));

  const rows = [gk];
  let cursor = 0;
  for (const size of segs) {
    rows.push(outfield.slice(cursor, cursor + size));
    cursor += size;
  }
  // Qoldiqlar bo'lsa, oxirgi qatorga qo'shamiz
  if (cursor < outfield.length) {
    rows[rows.length - 1].push(...outfield.slice(cursor));
  }

  const rowCount = rows.length;
  const startX = 0.08;
  const endX = 0.46;
  rows.forEach((row, rIdx) => {
    const x = rowCount === 1 ? 0.5 : startX + ((endX - startX) * rIdx) / (rowCount - 1);
    row.sort((a, b) => espnSideOrder(a.position) - espnSideOrder(b.position));
    const N = row.length;
    row.forEach((p, i) => {
      p.x = x;
      p.y = N === 1 ? 0.5 : 0.15 + (0.85 - 0.15) * (i / (N - 1));
    });
  });
}

function computeSofascoreRating(p, isLiveOrFinished) {
  if (!isLiveOrFinished) return null;
  if (!p.starter && !p.subIn && !p.goals && !p.assists && !p.yellowCard && !p.redCard) return null;

  let r = 6.6;
  if (p.goals > 0) r += p.goals * 1.3;
  if (p.assists > 0) r += p.assists * 0.8;
  if (p.yellowCard) r -= 0.5;
  if (p.redCard) r -= 1.6;
  if (p.ownGoals > 0) r -= p.ownGoals * 1.0;

  const salt = (Number(p.number || 7) * 7 + (p.id ? Number(String(p.id).slice(-3)) : 13)) % 9;
  const variance = ((salt - 4) * 0.1);
  r += variance;

  if (p.goals >= 2) r = Math.max(r, 8.8);
  else if (p.goals === 1 && p.assists >= 1) r = Math.max(r, 8.5);
  else if (p.goals === 1) r = Math.max(r, 7.8);
  else if (p.assists >= 1) r = Math.max(r, 7.5);

  r = Math.min(9.8, Math.max(5.8, r));
  return Number(r.toFixed(1));
}

function assignPlayerRatingsAndMotm(homeStarters = [], awayStarters = [], isLiveOrFinished = false) {
  if (!isLiveOrFinished) return;
  const all = [...homeStarters, ...awayStarters];
  let maxRating = -1;
  let motmPlayer = null;

  for (const p of all) {
    if (p.rating == null) {
      p.rating = computeSofascoreRating(p, true);
    }
    if (typeof p.rating === "number" && p.rating > maxRating) {
      maxRating = p.rating;
      motmPlayer = p;
    }
  }

  if (motmPlayer && maxRating >= 7.5) {
    motmPlayer.motm = true;
  }
}

function espnMapRoster(roster, keyEvents = []) {
  if (!roster) return { formation: "", starting: [], subs: [], coach: null, rating: null };
  const formation = String(roster.formation || "").trim();
  const all = (roster.roster || []).map((p) => espnMapPlayer(p, keyEvents));
  const starting = all.filter((p) => p.starter);
  const subs = all.filter((p) => !p.starter);
  espnAssignFormationCoords(starting, formation);
  return { formation, starting, subs, coach: null, rating: null };
}

function espnMapKeyEvents(keyEvents, headerDetails = []) {
  const events = [];
  if (Array.isArray(keyEvents)) {
    keyEvents.forEach((ev) => {
      const type = String(ev?.type?.type || ev?.type?.text || "").toLowerCase();
      const isGoal = type === "goal" || type === "penalty" || ev?.scoringPlay === true;
      const isYellow = type.includes("yellow");
      const isRed = type.includes("red");
      const isSub = type.includes("substitution");
      if (!isGoal && !isYellow && !isRed && !isSub) return;

      const clock = String(ev?.clock?.displayValue || (ev?.clock?.value != null ? Math.floor(ev.clock.value / 60) + "'" : "") || "").trim();
      const clockSec = Number(ev?.clock?.value) || 0;
      const teamId = ev?.team?.id ? String(ev.team.id) : null;
      const teamName = String(ev?.team?.displayName || ev?.team?.name || "").trim();
      const p1 = String(ev?.participants?.[0]?.athlete?.displayName || ev?.participants?.[0]?.athlete?.name || "").trim();
      const p2 = String(ev?.participants?.[1]?.athlete?.displayName || "").trim();

      let kind = "event";
      if (isGoal) kind = ev?.ownGoal ? "own-goal" : (ev?.penaltyKick ? "penalty" : "goal");
      else if (isRed) kind = "red-card";
      else if (isYellow) kind = "yellow-card";
      else if (isSub) kind = "substitution";

      events.push({
        id: String(ev.id || `${kind}-${clock}-${p1}`),
        type: kind,
        minute: clock,
        clockSec,
        period: ev?.period?.number || 1,
        teamId,
        team: teamName,
        player: p1,
        assist: isGoal ? p2 : "",
        playerIn: isSub ? p1 : "",
        playerOut: isSub ? p2 : "",
        text: String(ev.text || ev.shortText || "").trim(),
      });
    });
  }

  // Header details fallback (masalan keyEvents bo'lmasa gollar comp.details dan olinadi)
  if (Array.isArray(headerDetails) && (!events.length || !events.some((e) => e.type.includes("goal")))) {
    headerDetails.forEach((d) => {
      const type = String(d?.type?.type || d?.type?.text || "").toLowerCase();
      const isGoal = type.includes("goal") || d?.scoringPlay === true;
      if (!isGoal) return;
      const clock = String(d?.clock?.displayValue || "").trim();
      const clockSec = Number(d?.clock?.value) || 0;
      const player = String(d?.athletesInvolved?.[0]?.displayName || "").trim();
      if (!player) return;
      events.push({
        id: String(d.id || `goal-${clock}-${player}`),
        type: d.ownGoal ? "own-goal" : (d.penaltyKick ? "penalty" : "goal"),
        minute: clock,
        clockSec,
        period: 1,
        teamId: d?.team?.id ? String(d.team.id) : null,
        team: String(d?.team?.displayName || "").trim(),
        player,
        assist: String(d?.athletesInvolved?.[1]?.displayName || "").trim(),
        playerIn: "",
        playerOut: "",
        text: String(d.text || "").trim(),
      });
    });
  }

  events.sort((a, b) => (a.clockSec || 0) - (b.clockSec || 0));
  return events;
}

function espnMapStatistics(boxscoreTeams) {
  if (!Array.isArray(boxscoreTeams) || boxscoreTeams.length < 2) return [];
  const homeTeam = boxscoreTeams.find((t) => t.homeAway === "home") || boxscoreTeams[0];
  const awayTeam = boxscoreTeams.find((t) => t.homeAway === "away") || boxscoreTeams[1];
  const homeStats = homeTeam?.statistics || [];
  const awayStats = awayTeam?.statistics || [];

  const findVal = (list, names) => {
    for (const n of names) {
      const found = list.find((s) => s.name?.toLowerCase() === n.toLowerCase() || s.label?.toLowerCase() === n.toLowerCase());
      if (found) return String(found.displayValue != null ? found.displayValue : (found.value != null ? found.value : ""));
    }
    return "";
  };

  const METRICS = [
    { label: "To'p nazorati", key: "possession", names: ["possession", "possessionPct", "possessionPercentage"], unit: "%" },
    { label: "Umumiy zarbalar", key: "shots", names: ["shots", "totalShots", "goalAttempts"] },
    { label: "Aniq zarbalar", key: "shotsOnTarget", names: ["shotsOnTarget", "onGoal", "shotsOnGoal"] },
    { label: "Burchak to'plari", key: "corners", names: ["corners", "cornerKicks"] },
    { label: "Qoida buzilishi", key: "fouls", names: ["fouls", "foulsCommitted"] },
    { label: "Kutilgan gollar (xG)", key: "xg", names: ["xg", "expectedgoals", "expected_goals"] },
    { label: "Noaniq zarbalar", key: "shotsOffTarget", names: ["shotsOffTarget", "offGoal", "shotsOffGoal"] },
    { label: "To'silgan zarbalar", key: "blockedShots", names: ["blockedShots", "shotsBlocked"] },
    { label: "Xavfli vaziyatlar", key: "bigChances", names: ["bigChances", "bigChancesCreated"] },
    { label: "Sariq kartochkalar", key: "yellowCards", names: ["yellowCards"] },
    { label: "Qizil kartochkalar", key: "redCards", names: ["redCards"] },
    { label: "Ofsaydlar", key: "offsides", names: ["offsides"] },
    { label: "Darvozabon seyvlari", key: "saves", names: ["saves"] },
  ];

  return METRICS.map((m) => {
    const homeVal = findVal(homeStats, m.names);
    const awayVal = findVal(awayStats, m.names);
    if (!homeVal && !awayVal) return null;
    return {
      label: m.label,
      key: m.key,
      unit: m.unit || "",
      home: homeVal || "0",
      away: awayVal || "0",
    };
  }).filter(Boolean);
}

async function fetchSummaryForEvent(eventId, preferredLeagueId = "") {
  const candidateLeagues = [
    preferredLeagueId,
    ...FOOTBALL_LEAGUES.map((l) => l.id).filter((id) => id !== preferredLeagueId),
    "fifa.world",
  ].filter(Boolean);

  for (const lid of candidateLeagues) {
    const summary = await fetchJson(`${ESPN_SCOREBOARD_BASE}/${lid}/summary?event=${eventId}`, 8000).catch(() => null);
    if (summary && (summary.header || summary.rosters || summary.boxscore)) {
      return { summary, leagueId: lid };
    }
  }
  return null;
}

async function buildFifaLineupPayload(optsOrHome, maybeAway, maybeDateUtc) {
  let home = "", away = "", dateUtc = "", eventId = "", leagueId = "";
  if (typeof optsOrHome === "object" && optsOrHome !== null) {
    home = String(optsOrHome.home || "").trim();
    away = String(optsOrHome.away || "").trim();
    dateUtc = String(optsOrHome.dateUtc || optsOrHome.date || "").trim();
    eventId = String(optsOrHome.eventId || optsOrHome.matchId || optsOrHome.id || "").trim();
    leagueId = String(optsOrHome.leagueId || optsOrHome.league || "").trim();
  } else {
    home = String(optsOrHome || "").trim();
    away = String(maybeAway || "").trim();
    dateUtc = String(maybeDateUtc || "").trim();
  }

  let summaryResult = null;
  let targetEventId = eventId;
  let targetLeagueId = leagueId;

  if (targetEventId) {
    summaryResult = await fetchSummaryForEvent(targetEventId, targetLeagueId);
    if (summaryResult) {
      targetLeagueId = summaryResult.leagueId;
    }
  }

  if (!summaryResult && home && away) {
    const found = await findEspnEventId(home, away, dateUtc, targetLeagueId).catch(() => null);
    if (found) {
      targetEventId = found.eventId;
      targetLeagueId = found.leagueId;
      summaryResult = await fetchSummaryForEvent(targetEventId, targetLeagueId);
    }
  }

  const summary = summaryResult?.summary;
  if (!summary) {
    return {
      ok: true,
      found: false,
      home: { starting: [], subs: [] },
      away: { starting: [], subs: [] },
      events: [],
      statistics: [],
    };
  }

  const comp = summary?.header?.competitions?.[0];
  const statusType = comp?.status?.type || {};
  const state = String(statusType.state || "").toLowerCase();
  const isLive = state === "in" || state === "live" || /in.progress|halftime/i.test(statusType.name || "");
  const isFinished = Boolean(statusType.completed) || state === "post" || /final|full time/i.test(statusType.name || "");
  const minute = isLive ? String(comp?.status?.displayClock || "LIVE") : (isFinished ? "Tugadi" : "");
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
  const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0];
  const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1];
  const homeScore = homeComp?.score != null ? String(homeComp.score) : "";
  const awayScore = awayComp?.score != null ? String(awayComp.score) : "";
  const score = (homeScore !== "" && awayScore !== "") ? `${homeScore} : ${awayScore}` : null;

  const rosters = Array.isArray(summary?.rosters) ? summary.rosters : [];
  let homeId = homeComp?.id, awayId = awayComp?.id;
  const homeRoster = rosters.find((r) => String(r?.team?.id) === String(homeId)) || rosters[0];
  const awayRoster = rosters.find((r) => String(r?.team?.id) === String(awayId)) || rosters[1];

  const events = espnMapKeyEvents(summary?.keyEvents, comp?.details);
  const statistics = espnMapStatistics(summary?.boxscore?.teams);

  const mappedHome = espnMapRoster(homeRoster, events);
  const mappedAway = espnMapRoster(awayRoster, events);

  assignPlayerRatingsAndMotm(mappedHome.starting, mappedAway.starting, isLive || isFinished);
  await batchResolvePlayerPhotos([...(mappedHome.starting || []), ...(mappedAway.starting || [])]);

  const calcTeamRating = (list) => {
    const valid = list.filter((p) => typeof p.rating === "number");
    if (!valid.length) return null;
    return Number((valid.reduce((acc, p) => acc + p.rating, 0) / valid.length).toFixed(2));
  };
  mappedHome.rating = calcTeamRating(mappedHome.starting);
  mappedAway.rating = calcTeamRating(mappedAway.starting);

  return {
    ok: true,
    found: true,
    matchId: targetEventId,
    leagueId: targetLeagueId,
    status: isLive ? "live" : (isFinished ? "finished" : "upcoming"),
    minute,
    score,
    venue: summary?.gameInfo?.venue?.fullName || comp?.venue?.fullName || "",
    leagueName: summary?.header?.league?.name || "",
    events,
    statistics,
    home: {
      id: homeId,
      name: homeComp?.team?.displayName || home || "",
      logo: espnTeamLogo(homeComp?.team),
      score: homeScore,
      ...mappedHome,
    },
    away: {
      id: awayId,
      name: awayComp?.team?.displayName || away || "",
      logo: espnTeamLogo(awayComp?.team),
      score: awayScore,
      ...mappedAway,
    },
  };
}

async function handleFifaLineup(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const home = String(url.searchParams.get("home") || "").trim();
  const away = String(url.searchParams.get("away") || "").trim();
  const date = String(url.searchParams.get("date") || "").trim();
  const eventId = String(url.searchParams.get("eventId") || url.searchParams.get("matchId") || url.searchParams.get("id") || "").trim();
  const leagueId = String(url.searchParams.get("league") || url.searchParams.get("leagueId") || "").trim();

  if (!eventId && (!home || !away)) {
    response.status(400).json({ ok: false, error: "eventId yoki home va away kerak" });
    return;
  }
  const cacheKey = `fifa:lineup:${eventId}|${leagueId}|${home.toLowerCase()}|${away.toLowerCase()}|${date}`;
  const cached = await getFootballCache(cacheKey);
  if (cached?.isHit) {
    applyLineupHeaders(response, cached.data, "HIT");
    response.status(200).json(cached.data);
    return;
  }

  try {
    const data = await fetchWithSingleFlight(cacheKey, async () => {
      return await buildFifaLineupPayload({ home, away, dateUtc: date, eventId, leagueId });
    });

    // TTL hisoblash:
    // - Jonli (live) o'yin statistikasi: 60 soniya kesh
    // - Tugagan o'yin: 60 daqiqa kesh
    // - Kelajakdagi o'yin: 30 daqiqa kesh
    // - Topilmagan: 5 daqiqa
    let ttlMs = 60 * 60 * 1000;
    if (data.status === "live") {
      ttlMs = 60 * 1000; // Jonli: 60 soniya
    } else if (data.status === "finished") {
      ttlMs = 60 * 60 * 1000; // Tugagan: 60 daqiqa
    } else if (data.status === "upcoming") {
      ttlMs = 30 * 60 * 1000; // Kelajakdagi: 30 daqiqa
    } else if (!data.found) {
      ttlMs = 5 * 60 * 1000;
    }

    await setFootballCache(cacheKey, data, ttlMs);
    applyLineupHeaders(response, data, cached ? "REVALIDATED" : "MISS");
    response.status(200).json(data);
  } catch (err) {
    try {
      const { reportError } = require("./_lib/error-logger");
      reportError(err, { location: "Futbol API (fifa-lineup modal)", url: request.url, method: request.method }).catch(() => {});
    } catch (_) {}
    if (cached) {
      applyLineupHeaders(response, cached.data, "STALE");
      response.status(200).json(cached.data);
      return;
    }
    response.status(502).json({ ok: false, error: err.message || "Match ma'lumotlari manbasi javob bermadi." });
  }
}

module.exports = async function handler(request, response) {
  // FIFA route — auth talab qilmaydi (umumiy public data)
  const earlyUrl = new URL(request.url || "/", "http://localhost");
  const earlyType = String(earlyUrl.searchParams.get("type") || "").toLowerCase();
  if (earlyType === "fifa") {
    await handleFifa(request, response);
    return;
  }
  if (earlyType === "fifa-upcoming") {
    await handleFifaUpcoming(request, response);
    return;
  }
  if (earlyType === "fifa-live") {
    await handleFifaLive(request, response);
    return;
  }
  if (earlyType === "fifa-highlights") {
    await handleFifaHighlights(request, response);
    return;
  }
  if (earlyType === "tv-channels") {
    await handleTvChannels(request, response);
    return;
  }
  if (earlyType === "fifa-lineup") {
    await handleFifaLineup(request, response);
    return;
  }
  if (earlyType === "fifa-favorites") {
    await handleFifaFavorites(request, response);
    return;
  }

  if (!(await authorizeRequest(request, response))) {
    return;
  }
  if (request.method === "GET") {
    response.setHeader("Cache-Control", "private, no-cache, no-store, max-age=0");
    response.setHeader("Vary", "Accept-Encoding, X-TG-Init-Data, Authorization");
  } else {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  }

  const url = new URL(request.url || "/", "http://localhost");
  const type = String(url.searchParams.get("type") || "").toLowerCase();

  if (type === "podcast-langs") {
    if (request.method === "GET") {
      try {
        const langs = await readPodLangs();
        response.status(200).json({ ok: true, langs, storage: isRedisEnabled() ? "redis" : "none" });
      } catch (err) {
        response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
      }
      return;
    }
    if (request.method === "POST" || request.method === "PUT") {
      if (!(await requireAdmin(request, response))) return;
      try {
        const body = await readBody(request);
        if (body.action === "upload") {
          const link = await handleUpload({ ...body, name: body.name || "pod-lang" });
          response.status(200).json({ ok: true, url: link });
          return;
        }
        if (!isRedisEnabled()) {
          response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
          return;
        }
        const current = await readPodLangs();
        const next = normalizePodLangs({ ...current, ...(body.langs || body || {}) });
        const ok = await writePodLangs(next);
        if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
        response.status(200).json({ ok: true, langs: next });
      } catch (err) {
        response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
      }
      return;
    }
    response.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  if (request.method === "GET") {
    try {
      const categories = await readAll();
      categories.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, categories, storage: isRedisEnabled() ? "redis" : "none" });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    if (!(await requireAdmin(request, response))) return;
    try {
      const body = await readBody(request);
      const action = body.action || (request.method === "DELETE" ? "delete" : (request.method === "PUT" ? "update" : "create"));

      if (action === "upload") {
        const url = await handleUpload(body);
        response.status(200).json({ ok: true, url });
        return;
      }

      if (!isRedisEnabled()) {
        response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
        return;
      }

      let list = await readAll();

      if (action === "delete") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        list = list.filter((c) => c.id !== id);
      } else if (action === "update") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const idx = list.findIndex((c) => c.id === id);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        const merged = normalize({ ...list[idx], ...body, id });
        if (!merged) { response.status(400).json({ ok: false, error: "Noto'g'ri ma'lumot." }); return; }
        list[idx] = merged;
      } else if (action === "reorder" && Array.isArray(body.ids)) {
        const map = new Map(list.map((c) => [c.id, c]));
        const ordered = [];
        body.ids.forEach((id, i) => {
          const c = map.get(String(id));
          if (c) { ordered.push({ ...c, order: i }); map.delete(c.id); }
        });
        list = [...ordered, ...map.values()];
      } else {
        const created = normalize(body);
        if (!created) { response.status(400).json({ ok: false, error: "name kerak." }); return; }
        if (list.some((c) => c.id === created.id)) {
          created.id = `${created.id}-${Date.now().toString(36)}`;
        }
        created.order = list.length;
        list.push(created);
      }

      const ok = await writeAll(list);
      if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
      list.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, categories: list });
    } catch (err) {
      response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
    }
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed." });
};
