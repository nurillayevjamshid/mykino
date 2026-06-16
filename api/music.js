const fs = require("fs");
const path = require("path");
const { authorizeRequest } = require("./_lib/auth");
const { handlePodcastsRequest } = require("./_lib/podcasts");
const {
  handleMusicChannelsRequest,
  loadAllChannelTracks,
  loadChannelArtists,
} = require("./_lib/music-channels");
const { handleMusicPlaylists } = require("./_lib/music-playlists");

const SEED_FILE = path.join(process.cwd(), "data", "music.json");
const REDIS_KEY = "music:tracks:v1";
const ARTISTS_KEY = "music:artists:v1";
const BLOB_API_BASE = "https://blob.vercel-storage.com";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

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

function readSeed() {
  try {
    if (!fs.existsSync(SEED_FILE)) return [];
    const raw = fs.readFileSync(SEED_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("music seed read error:", err);
    return [];
  }
}

function extractYoutubeId(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (/^[\w-]{10,12}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([\w-]{10,12})/,
    /youtu\.be\/([\w-]{10,12})/,
    /youtube\.com\/embed\/([\w-]{10,12})/,
    /youtube\.com\/shorts\/([\w-]{10,12})/,
    /music\.youtube\.com\/watch\?v=([\w-]{10,12})/,
  ];
  for (const re of patterns) {
    const m = re.exec(value);
    if (m) return m[1];
  }
  return "";
}

function normalizeCategories(track) {
  let raw = [];
  if (Array.isArray(track.categories)) raw = track.categories;
  else if (typeof track.categories === "string") raw = track.categories.split(",");
  else if (track.category) raw = String(track.category).split(",");
  const seen = new Set();
  const cats = [];
  for (const c of raw) {
    const name = String(c || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cats.push(name);
  }
  return cats.length ? cats : ["Boshqa"];
}

function normalize(track) {
  if (!track || typeof track !== "object") return null;
  const title = String(track.title || "").trim();
  const artist = String(track.artist || "").trim();
  const categories = normalizeCategories(track);
  const youtubeId = extractYoutubeId(track.youtubeId || track.url || track.link || "");
  if (!title || !artist || !youtubeId) return null;
  return {
    id: String(track.id || `${youtubeId}-${title}`).slice(0, 64),
    title,
    artist,
    categories,
    category: categories[0],
    youtubeId,
  };
}

// YouTube ID katta-kichik harfga sezgir — uni lowercase QILMAYMIZ.
function trackKey(t) {
  return `${String(t.title || "").toLowerCase()}|${String(t.artist || "").toLowerCase()}|${t.youtubeId}`;
}

function dedupe(tracks) {
  const seen = new Map();
  for (const t of tracks) {
    seen.set(trackKey(t), t);
  }
  return Array.from(seen.values());
}

async function readRedisTracks() {
  const client = await getRedis();
  if (!client) return null;
  try {
    const raw = await client.get(REDIS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalize).filter(Boolean) : [];
  } catch (err) {
    console.warn("redis get xatolik:", err.message);
    return null;
  }
}

async function writeRedisTracks(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(REDIS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("redis set xatolik:", err.message);
    return false;
  }
}

async function loadAll() {
  const seed = readSeed().map(normalize).filter(Boolean);
  const stored = await readRedisTracks();
  let channelTracks = [];
  try {
    const raw = await loadAllChannelTracks();
    channelTracks = raw.map(normalize).filter(Boolean);
  } catch (err) {
    console.warn("music channel tracks load xato:", err.message);
  }
  const base = stored ? [...seed, ...stored] : seed;
  return dedupe([...base, ...channelTracks]);
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

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "artist";
}

function normalizeArtist(a) {
  if (!a || typeof a !== "object") return null;
  const name = String(a.name || "").trim();
  if (!name) return null;
  const image = String(a.image || "").trim();
  const link = String(a.link || "").trim();
  const id = String(a.id || slugify(name)).slice(0, 64);
  const order = Number(a.order || 0);
  return { id, name, image, link, order: Number.isFinite(order) ? order : 0 };
}

async function readArtists() {
  const client = await getRedis();
  if (!client) return [];
  try {
    const raw = await client.get(ARTISTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeArtist).filter(Boolean) : [];
  } catch (err) {
    console.warn("redis get artists xato:", err.message);
    return [];
  }
}

async function writeArtists(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(ARTISTS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("redis set artists xato:", err.message);
    return false;
  }
}

function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) return null;
  return { contentType: m[1] || "application/octet-stream", buffer: Buffer.from(m[2], "base64") };
}

function extFromContentType(ct) {
  const map = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  return map[ct] || "bin";
}

async function uploadToBlob(pathname, buffer, contentType) {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) {
    const err = new Error("BLOB_READ_WRITE_TOKEN topilmadi.");
    err.statusCode = 500;
    throw err;
  }
  const url = new URL(`${BLOB_API_BASE}/${pathname.replace(/^\/+/, "")}`);
  url.searchParams.set("addRandomSuffix", "1");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "Content-Type": contentType,
      "x-content-type": contentType,
      "x-add-random-suffix": "1",
    },
    body: buffer,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    const err = new Error(payload?.error?.message || "Blob upload muvaffaqiyatsiz.");
    err.statusCode = response.status || 502;
    throw err;
  }
  return payload.url;
}

async function handleArtistUpload(body) {
  const parsed = parseDataUrl(body.dataUrl || body.image || "");
  if (!parsed) { const err = new Error("dataUrl kerak."); err.statusCode = 400; throw err; }
  if (parsed.buffer.length > MAX_IMAGE_BYTES) { const err = new Error("Rasm 6MB dan katta."); err.statusCode = 413; throw err; }
  const ext = extFromContentType(parsed.contentType);
  const baseName = String(body.name || "artist").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "artist";
  const pathname = `music-artists/${Date.now()}-${baseName}.${ext}`;
  return await uploadToBlob(pathname, parsed.buffer, parsed.contentType);
}

async function handleArtistsRequest(request, response) {
  if (request.method === "GET") {
    try {
      const artists = await readArtists();
      let channelArtists = [];
      try { channelArtists = await loadChannelArtists(); } catch (_) {}
      const seen = new Set(artists.map((a) => String(a.name || "").toLowerCase()));
      for (const ca of channelArtists) {
        const key = String(ca.name || "").toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        artists.push(ca);
      }
      artists.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, artists, storage: isRedisEnabled() ? "redis" : "none" });
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
        const url = await handleArtistUpload(body);
        response.status(200).json({ ok: true, url });
        return;
      }

      if (!isRedisEnabled()) {
        response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
        return;
      }

      let list = await readArtists();
      if (action === "delete") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        list = list.filter((a) => a.id !== id);
      } else if (action === "update") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const idx = list.findIndex((a) => a.id === id);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        const merged = normalizeArtist({ ...list[idx], ...body, id });
        if (!merged) { response.status(400).json({ ok: false, error: "Noto'g'ri ma'lumot." }); return; }
        list[idx] = merged;
      } else {
        const created = normalizeArtist(body);
        if (!created) { response.status(400).json({ ok: false, error: "name kerak." }); return; }
        if (list.some((a) => a.id === created.id)) {
          created.id = `${created.id}-${Date.now().toString(36)}`;
        }
        created.order = list.length;
        list.push(created);
      }

      const ok = await writeArtists(list);
      if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
      list.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, artists: list });
    } catch (err) {
      response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
    }
    return;
  }
  response.status(405).json({ ok: false, error: "Method not allowed." });
}

module.exports = async function handler(request, response) {
  if (!(await authorizeRequest(request, response))) {
    return;
  }
  response.setHeader("Cache-Control", "no-store, max-age=0");

  const resource = String(request.query?.resource || "").toLowerCase();
  if (resource === "artists") {
    await handleArtistsRequest(request, response);
    return;
  }
  if (resource === "podcasts" || request.query?._podcasts) {
    await handlePodcastsRequest(request, response);
    return;
  }
  if (resource === "music-channels" || resource === "channels") {
    await handleMusicChannelsRequest(request, response);
    return;
  }
  if (resource === "playlists" || request.query?._playlists) {
    await handleMusicPlaylists(request, response);
    return;
  }

  if (request.method === "GET") {
    try {
      const tracks = await loadAll();
      response.status(200).json({ ok: true, tracks, storage: isRedisEnabled() ? "redis" : "seed" });
    } catch (err) {
      response.status(500).json({ ok: false, code: "MUSIC_LOAD_FAILED", error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await readBody(request);

      if (!isRedisEnabled()) {
        response.status(503).json({ ok: false, code: "REDIS_DISABLED", error: "Vercel Redis sozlanmagan. Vercel dashboard'da Redis yarating va loyihaga ulang." });
        return;
      }

      if (body.action === "delete" && body.key) {
        // Kalitda title|artist lowercase, youtubeId esa o'z holicha.
        const wantA = String(body.key);
        const wantB = wantA.toLowerCase();
        const current = (await readRedisTracks()) || [];
        const next = current.filter((t) => {
          const k = trackKey(t);
          return k !== wantA && k.toLowerCase() !== wantB;
        });
        await writeRedisTracks(next);
        response.status(200).json({ ok: true, tracks: await loadAll() });
        return;
      }

      if (body.action === "update" && body.key) {
        const wantA = String(body.key);
        const wantB = wantA.toLowerCase();
        const matchKey = (t) => {
          const k = trackKey(t);
          return k === wantA || k.toLowerCase() === wantB;
        };
        const current = (await readRedisTracks()) || [];
        const all = await loadAll();
        const base = all.find(matchKey);
        if (!base) {
          response.status(404).json({ ok: false, code: "TRACK_NOT_FOUND", error: "Qo'shiq topilmadi." });
          return;
        }
        const updated = normalize({ ...base, categories: body.categories });
        if (!updated) {
          response.status(400).json({ ok: false, code: "INVALID_TRACK", error: "Noto'g'ri ma'lumot." });
          return;
        }
        const idx = current.findIndex(matchKey);
        if (idx >= 0) current[idx] = updated;
        else current.push(updated);
        await writeRedisTracks(current);
        response.status(200).json({ ok: true, tracks: await loadAll() });
        return;
      }

      if (body.action === "replace" && Array.isArray(body.tracks)) {
        const normalized = body.tracks.map(normalize).filter(Boolean);
        await writeRedisTracks(dedupe(normalized));
        response.status(200).json({ ok: true, tracks: await loadAll() });
        return;
      }

      const incoming = Array.isArray(body.tracks) ? body.tracks : (body.track ? [body.track] : []);
      const normalized = incoming.map(normalize).filter(Boolean);
      if (!normalized.length) {
        response.status(400).json({ ok: false, code: "INVALID_TRACK", error: "Title, artist va youtubeId kerak." });
        return;
      }

      const existing = (await readRedisTracks()) || [];
      const merged = dedupe([...existing, ...normalized]);
      const ok = await writeRedisTracks(merged);
      if (!ok) {
        response.status(500).json({ ok: false, code: "REDIS_WRITE_FAILED", error: "Redis ga yozish muvaffaqiyatsiz." });
        return;
      }
      response.status(200).json({ ok: true, tracks: await loadAll() });
    } catch (err) {
      response.status(400).json({ ok: false, code: "BAD_REQUEST", error: err.message || "Invalid body" });
    }
    return;
  }

  response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET/POST/PUT." });
};
