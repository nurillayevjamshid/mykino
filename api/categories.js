const { authorizeRequest } = require("./_lib/auth");
const { uploadImageToR2, uploadFileToR2 } = require("./_lib/r2-store");

const REDIS_KEY = "categories:v1";
const POD_LANGS_KEY = "podcast-langs:v1";
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
const FIFA_TTL_MS = 5 * 60 * 1000;
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

module.exports = async function handler(request, response) {
  // FIFA route — auth talab qilmaydi (umumiy public data)
  const earlyUrl = new URL(request.url || "/", "http://localhost");
  if (String(earlyUrl.searchParams.get("type") || "").toLowerCase() === "fifa") {
    response.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    response.setHeader("Vary", "Accept-Encoding");
    await handleFifa(request, response);
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
