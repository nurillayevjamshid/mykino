const { authorizeRequest } = require("./_lib/auth");
const { uploadImageToR2, uploadFileToR2 } = require("./_lib/r2-store");

const REDIS_KEY = "categories:v1";
const POD_LANGS_KEY = "podcast-langs:v1";
const FIFA_LIVE_KEY = "fifa-live:v1";
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
// FIFA JCH 2026 ma'lumotlari (proxy + kesh).
// Jadval: openfootball/worldcup.json (public domain, CORS OK)
// LIVE/standings: worldcup26.ir/get/{games,groups,teams} (CORS yo'q — proxy)
// 5 daqiqali in-memory kesh — funktsiya isitilgan paytda tashqi so'rovni kamaytiradi.
// =========================================================================
const FIFA_CACHE = { data: null, at: 0 };
// Live skor va daqiqa real vaqt rejimida yangilanishi uchun keshni qisqa
// ushlaymiz. Manba endpoint'lari yengil (4 ta fetch, allSettled), shu sababli
// 30 soniyalik TTL xavfsiz.
const FIFA_TTL_MS = 30 * 1000;
const FIFA_SCHEDULE_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const FIFA_LIVE_GAMES_URL = "https://worldcup26.ir/get/games";
const FIFA_LIVE_GROUPS_URL = "https://worldcup26.ir/get/groups";
const FIFA_LIVE_TEAMS_URL = "https://worldcup26.ir/get/teams";

async function fetchJson(url, timeoutMs = 6000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "mykino-fifa/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function buildFifaPayload() {
  const [scheduleRes, gamesRes, groupsRes, teamsRes] = await Promise.allSettled([
    fetchJson(FIFA_SCHEDULE_URL),
    fetchJson(FIFA_LIVE_GAMES_URL),
    fetchJson(FIFA_LIVE_GROUPS_URL),
    fetchJson(FIFA_LIVE_TEAMS_URL),
  ]);

  const schedule = scheduleRes.status === "fulfilled" ? scheduleRes.value : null;
  const liveGames = gamesRes.status === "fulfilled" ? gamesRes.value : null;
  const liveGroups = groupsRes.status === "fulfilled" ? groupsRes.value : null;
  const liveTeams = teamsRes.status === "fulfilled" ? teamsRes.value : null;

  // Live games'ni "team1|team2" kalit bilan map qilamiz
  const liveMap = new Map();
  const arr = Array.isArray(liveGames) ? liveGames : (liveGames?.games || []);
  for (const g of arr) {
    const home = String(g.home_team_name || g.home_team || g.home || "").trim();
    const away = String(g.away_team_name || g.away_team || g.away || "").trim();
    if (!home || !away) continue;
    liveMap.set(`${home}|${away}`.toLowerCase(), {
      status: String(g.status || "").toLowerCase(),
      score_home: g.home_score ?? g.score_home ?? null,
      score_away: g.away_score ?? g.score_away ?? null,
      minute: g.minute ?? g.time_elapsed ?? null,
    });
  }

  // Team id → name (worldcup26.ir teams uchun)
  const teamIdName = new Map();
  const tArr = Array.isArray(liveTeams) ? liveTeams : (liveTeams?.teams || []);
  for (const t of tArr) {
    const id = String(t.team_id ?? t._id ?? t.id ?? "").trim();
    const name = String(t.name || t.team || "").trim();
    if (id && name) teamIdName.set(id, name);
  }

  const groupsArr = Array.isArray(liveGroups) ? liveGroups : (liveGroups?.groups || []);
  const standings = groupsArr.map((g) => ({
    name: String(g.name || "").trim(),
    rows: (g.teams || []).map((row) => ({
      team: teamIdName.get(String(row.team_id)) || `Team ${row.team_id}`,
      p: Number(row.mp || 0),
      w: Number(row.w || 0),
      d: Number(row.d || 0),
      l: Number(row.l || 0),
      gf: Number(row.gf || 0),
      ga: Number(row.ga || 0),
      pts: Number(row.pts || 0),
    })),
  })).filter((g) => g.name);

  return {
    updatedAt: new Date().toISOString(),
    schedule: schedule || { matches: [] },
    liveMap: Object.fromEntries(liveMap),
    standings,
    sources: {
      schedule: scheduleRes.status,
      games: gamesRes.status,
      groups: groupsRes.status,
      teams: teamsRes.status,
    },
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

function normalizeFifaLiveMatch(body) {
  const title = String(body?.title || "").trim().slice(0, 120);
  if (!title) {
    const err = new Error("Match nomi (title) kerak.");
    err.statusCode = 400;
    throw err;
  }
  const coverUrl = String(body?.coverUrl || "").trim();
  const telegramUrl = normalizeFifaLiveTelegramUrl(body?.telegramUrl);
  if (!telegramUrl) {
    const err = new Error("OBS stream havolasi kerak (https://.../playlist.m3u8).");
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
  return { title, coverUrl, telegramUrl, startsAt, isLive, updatedAt: new Date().toISOString() };
}

async function readFifaLiveMatch() {
  const client = await getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(FIFA_LIVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.title || !data.telegramUrl) return null;
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
  // Yozish — auth talab
  if (!(await authorizeRequest(request, response))) return;
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

async function handleFifa(request, response) {
  const now = Date.now();
  if (FIFA_CACHE.data && now - FIFA_CACHE.at < FIFA_TTL_MS) {
    response.setHeader("X-Fifa-Cache", "HIT");
    response.status(200).json(FIFA_CACHE.data);
    return;
  }
  try {
    const data = await buildFifaPayload();
    FIFA_CACHE.data = data;
    FIFA_CACHE.at = now;
    response.setHeader("X-Fifa-Cache", "MISS");
    response.status(200).json(data);
  } catch (err) {
    if (FIFA_CACHE.data) {
      response.setHeader("X-Fifa-Cache", "STALE");
      response.status(200).json(FIFA_CACHE.data);
      return;
    }
    response.status(502).json({ ok: false, error: err.message || "FIFA manbasi javob bermadi." });
  }
}

// =========================================================================
// FIFA Lineup (ESPN public API) — Vercel'dan ochiq, to'liq 11+15 tarkib.
// /scoreboard?dates=YYYYMMDD → topic eventId by team names
// /summary?event=X → rosters (formation, starters, subs, jersey, photo, stats)
// In-memory cache (10 daqiqa).
// =========================================================================
const FIFA_LINEUP_CACHE = new Map();
const FIFA_LINEUP_TTL_MS = 10 * 60 * 1000;
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

async function findEspnEventId(home, away, dateUtc) {
  const base = dateUtc ? new Date(`${dateUtc}T12:00:00Z`) : new Date();
  const days = [-1, 0, 1].map((off) => {
    const d = new Date(base.getTime() + off * 86400000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  });
  const hC = canonTeam(home);
  const aC = canonTeam(away);
  for (const d of days) {
    const json = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${d}`, 8000).catch(() => null);
    if (!json) continue;
    const events = Array.isArray(json.events) ? json.events : [];
    for (const ev of events) {
      const comp = (ev.competitions && ev.competitions[0]) || {};
      const competitors = comp.competitors || [];
      const h = competitors.find((c) => c.homeAway === "home") || competitors[0];
      const a = competitors.find((c) => c.homeAway === "away") || competitors[1];
      const hN = canonTeam(h?.team?.displayName || h?.team?.name);
      const aN = canonTeam(a?.team?.displayName || a?.team?.name);
      if (hN === hC && aN === aC) return ev.id;
      if (hN === aC && aN === hC) return ev.id;
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

function espnMapPlayer(p) {
  const statsArr = Array.isArray(p.stats) ? p.stats : [];
  const stats = {};
  for (const s of statsArr) stats[s.name] = Number(s.displayValue || s.value || 0) || 0;
  return {
    id: p?.athlete?.id || null,
    number: p.jersey != null ? Number(p.jersey) : null,
    name: String(p?.athlete?.displayName || p?.athlete?.fullName || "").trim(),
    shortName: String(p?.athlete?.shortName || p?.athlete?.displayName || "").trim(),
    position: String(p?.position?.abbreviation || ""),
    starter: p.starter === true,
    photo: p?.athlete?.headshot?.href || "",
    isCaptain: false,
    rating: null,
    motm: false,
    goals: stats.totalGoals || 0,
    ownGoals: stats.ownGoals || 0,
    yellowCard: (stats.yellowCards || 0) > 0,
    redCard: (stats.redCards || 0) > 0,
    subOut: p.subbedOut === true,
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

function espnMapRoster(roster) {
  if (!roster) return { formation: "", starting: [], subs: [], coach: null, rating: null };
  const formation = String(roster.formation || "").trim();
  const all = (roster.roster || []).map(espnMapPlayer);
  const starting = all.filter((p) => p.starter);
  const subs = all.filter((p) => !p.starter);
  espnAssignFormationCoords(starting, formation);
  return { formation, starting, subs, coach: null, rating: null };
}

async function buildFifaLineupPayload(home, away, dateUtc) {
  const eventId = await findEspnEventId(home, away, dateUtc).catch(() => null);
  if (!eventId) {
    return { ok: true, found: false, home: { starting: [], subs: [] }, away: { starting: [], subs: [] } };
  }
  const summary = await fetchJson(`${ESPN_BASE}/summary?event=${eventId}`, 9000).catch(() => null);
  const rosters = Array.isArray(summary?.rosters) ? summary.rosters : [];
  if (!rosters.length) {
    return { ok: true, found: false, matchId: eventId, home: { starting: [], subs: [] }, away: { starting: [], subs: [] } };
  }
  // ESPN bizga homeAway pamyali bermasligi mumkin — header'dan olamiz
  let homeId = null, awayId = null;
  try {
    const comps = summary?.header?.competitions?.[0]?.competitors || [];
    homeId = comps.find((c) => c.homeAway === "home")?.id;
    awayId = comps.find((c) => c.homeAway === "away")?.id;
  } catch (_) {}
  const homeRoster = rosters.find((r) => String(r?.team?.id) === String(homeId)) || rosters[0];
  const awayRoster = rosters.find((r) => String(r?.team?.id) === String(awayId)) || rosters[1];
  return {
    ok: true,
    found: true,
    matchId: eventId,
    home: espnMapRoster(homeRoster),
    away: espnMapRoster(awayRoster),
  };
}

async function handleFifaLineup(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const home = String(url.searchParams.get("home") || "").trim();
  const away = String(url.searchParams.get("away") || "").trim();
  const date = String(url.searchParams.get("date") || "").trim();
  if (!home || !away) {
    response.status(400).json({ ok: false, error: "home va away kerak" });
    return;
  }
  const key = `${home.toLowerCase()}|${away.toLowerCase()}|${date}`;
  const now = Date.now();
  const cached = FIFA_LINEUP_CACHE.get(key);
  if (cached && now - cached.at < FIFA_LINEUP_TTL_MS) {
    response.setHeader("X-Fifa-Lineup-Cache", "HIT");
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    response.status(200).json(cached.data);
    return;
  }
  try {
    const data = await buildFifaLineupPayload(home, away, date);
    FIFA_LINEUP_CACHE.set(key, { data, at: now });
    response.setHeader("X-Fifa-Lineup-Cache", "MISS");
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    response.status(200).json(data);
  } catch (err) {
    if (cached) {
      response.setHeader("X-Fifa-Lineup-Cache", "STALE");
      response.status(200).json(cached.data);
      return;
    }
    response.status(502).json({ ok: false, error: err.message || "Lineup manbasi javob bermadi." });
  }
}

module.exports = async function handler(request, response) {
  // FIFA route — auth talab qilmaydi (umumiy public data)
  const earlyUrl = new URL(request.url || "/", "http://localhost");
  const earlyType = String(earlyUrl.searchParams.get("type") || "").toLowerCase();
  if (earlyType === "fifa") {
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    response.setHeader("Vary", "Accept-Encoding");
    await handleFifa(request, response);
    return;
  }
  if (earlyType === "fifa-live") {
    await handleFifaLive(request, response);
    return;
  }
  if (earlyType === "fifa-lineup") {
    await handleFifaLineup(request, response);
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
