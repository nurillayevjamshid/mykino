const fs = require("fs");
const path = require("path");
const { setCors } = require("./_lib/google-drive");

const SEED_FILE = path.join(process.cwd(), "data", "music.json");
const KV_KEY = "music:tracks:v1";

let kvClient = null;
function getKv() {
  if (kvClient !== null) return kvClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    kvClient = false;
    return false;
  }
  try {
    const { kv } = require("@vercel/kv");
    kvClient = kv;
    return kv;
  } catch (err) {
    console.warn("@vercel/kv yuklanmadi:", err.message);
    kvClient = false;
    return false;
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

function normalize(track) {
  if (!track || typeof track !== "object") return null;
  const title = String(track.title || "").trim();
  const artist = String(track.artist || "").trim();
  const category = String(track.category || "").trim() || "Boshqa";
  const youtubeId = extractYoutubeId(track.youtubeId || track.url || track.link || "");
  if (!title || !artist || !youtubeId) return null;
  return {
    id: String(track.id || `${youtubeId}-${title}`).slice(0, 64),
    title,
    artist,
    category,
    youtubeId,
  };
}

function dedupe(tracks) {
  const seen = new Map();
  for (const t of tracks) {
    const key = `${t.title.toLowerCase()}|${t.artist.toLowerCase()}|${t.youtubeId}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return Array.from(seen.values());
}

async function readKvTracks() {
  const kv = getKv();
  if (!kv) return null;
  try {
    const value = await kv.get(KV_KEY);
    if (Array.isArray(value)) return value.map(normalize).filter(Boolean);
  } catch (err) {
    console.warn("KV get xatolik:", err.message);
  }
  return null;
}

async function writeKvTracks(list) {
  const kv = getKv();
  if (!kv) return false;
  try {
    await kv.set(KV_KEY, list);
    return true;
  } catch (err) {
    console.warn("KV set xatolik:", err.message);
    return false;
  }
}

async function loadAll() {
  const seed = readSeed().map(normalize).filter(Boolean);
  const kvList = await readKvTracks();
  if (kvList) return dedupe([...seed, ...kvList]);
  return dedupe(seed);
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

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "GET") {
    try {
      const tracks = await loadAll();
      const kvOn = Boolean(getKv());
      response.status(200).json({ ok: true, tracks, storage: kvOn ? "kv" : "seed" });
    } catch (err) {
      response.status(500).json({ ok: false, code: "MUSIC_LOAD_FAILED", error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await readBody(request);

      // Delete operation
      if (body.action === "delete" && body.key) {
        const kv = getKv();
        if (!kv) { response.status(503).json({ ok: false, code: "KV_DISABLED", error: "Vercel KV sozlanmagan." }); return; }
        const current = (await readKvTracks()) || [];
        const next = current.filter((t) => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}|${t.youtubeId}` !== String(body.key).toLowerCase());
        await writeKvTracks(next);
        response.status(200).json({ ok: true, tracks: await loadAll() });
        return;
      }

      // Replace all operation
      if (body.action === "replace" && Array.isArray(body.tracks)) {
        const kv = getKv();
        if (!kv) { response.status(503).json({ ok: false, code: "KV_DISABLED", error: "Vercel KV sozlanmagan." }); return; }
        const normalized = body.tracks.map(normalize).filter(Boolean);
        await writeKvTracks(dedupe(normalized));
        response.status(200).json({ ok: true, tracks: await loadAll() });
        return;
      }

      // Default: add single/multiple tracks
      const incoming = Array.isArray(body.tracks) ? body.tracks : (body.track ? [body.track] : []);
      const normalized = incoming.map(normalize).filter(Boolean);
      if (!normalized.length) {
        response.status(400).json({ ok: false, code: "INVALID_TRACK", error: "Title, artist va youtubeId kerak." });
        return;
      }

      const kv = getKv();
      if (!kv) {
        response.status(503).json({ ok: false, code: "KV_DISABLED", error: "Vercel KV sozlanmagan. Vercel dashboard'da KV yarating va loyihaga ulang." });
        return;
      }

      const existingKv = (await readKvTracks()) || [];
      const merged = dedupe([...existingKv, ...normalized]);
      const ok = await writeKvTracks(merged);
      if (!ok) {
        response.status(500).json({ ok: false, code: "KV_WRITE_FAILED", error: "KV ga yozish muvaffaqiyatsiz." });
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
