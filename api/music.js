const fs = require("fs");
const path = require("path");
const { setCors } = require("./_lib/google-drive");

const MUSIC_FILE = path.join(process.cwd(), "data", "music.json");

function readSeed() {
  try {
    if (!fs.existsSync(MUSIC_FILE)) return [];
    const raw = fs.readFileSync(MUSIC_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("music.json read error:", err);
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
    const seed = readSeed().map(normalize).filter(Boolean);
    response.status(200).json({ ok: true, tracks: dedupe(seed) });
    return;
  }

  if (request.method === "POST" || request.method === "PUT") {
    try {
      const body = await readBody(request);
      const incoming = Array.isArray(body.tracks) ? body.tracks : (body.track ? [body.track] : []);
      const normalized = incoming.map(normalize).filter(Boolean);
      if (!normalized.length) {
        response.status(400).json({ ok: false, code: "INVALID_TRACK", error: "Title, artist va youtubeId kerak." });
        return;
      }
      const merged = dedupe([...readSeed().map(normalize).filter(Boolean), ...normalized]);
      // Vercel serverless fs is read-only; attempt write only in writable envs.
      let persisted = false;
      try {
        fs.writeFileSync(MUSIC_FILE, JSON.stringify(merged, null, 2));
        persisted = true;
      } catch (writeErr) {
        console.warn("music.json write skipped (likely read-only fs):", writeErr.message);
      }
      response.status(200).json({ ok: true, persisted, tracks: merged });
    } catch (err) {
      response.status(400).json({ ok: false, code: "BAD_REQUEST", error: err.message || "Invalid body" });
    }
    return;
  }

  response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET/POST/PUT." });
};
