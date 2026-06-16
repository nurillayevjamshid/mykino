const { readCatalogMetadata, writeCatalogMetadata } = require("./google-drive");

const MAX_PLAYLISTS_PER_USER = 50;
const MAX_TRACKS_PER_PLAYLIST = 1000;
const MAX_NAME_LENGTH = 80;

function trim(value) {
  return String(value == null ? "" : value).trim();
}

function sanitizeName(value) {
  return trim(value).replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
}

function sanitizeTrackId(value) {
  const v = trim(value);
  return /^[\w-]{6,32}$/.test(v) ? v : "";
}

function sanitizePlaylist(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = trim(raw.id);
  const name = sanitizeName(raw.name);
  if (!id || !name) return null;
  const tracksArr = Array.isArray(raw.tracks) ? raw.tracks : [];
  const seen = new Set();
  const tracks = [];
  for (const t of tracksArr) {
    const id2 = sanitizeTrackId(t);
    if (!id2 || seen.has(id2)) continue;
    seen.add(id2);
    tracks.push(id2);
    if (tracks.length >= MAX_TRACKS_PER_PLAYLIST) break;
  }
  return {
    id,
    name,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    tracks,
  };
}

function readUserPlaylists(metadata, userId) {
  const all = metadata?.musicPlaylists;
  if (!all || typeof all !== "object") return {};
  const entry = all[String(userId)];
  if (!entry || typeof entry !== "object") return {};
  const cleaned = {};
  for (const [id, pl] of Object.entries(entry)) {
    const sanitized = sanitizePlaylist(pl);
    if (sanitized) cleaned[id] = sanitized;
  }
  return cleaned;
}

function toList(map) {
  return Object.values(map).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function newId() {
  return `pl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function readBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) return JSON.parse(request.body.toString("utf8"));
  if (request.body && typeof request.body === "string") return JSON.parse(request.body);
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function withUserPlaylists(userId, mutate) {
  const metadataState = await readCatalogMetadata();
  const root = metadataState.data && typeof metadataState.data === "object" ? metadataState.data : {};
  const all = root.musicPlaylists && typeof root.musicPlaylists === "object" ? { ...root.musicPlaylists } : {};
  const current = all[userId] && typeof all[userId] === "object" ? { ...all[userId] } : {};
  const next = mutate(current);
  if (next === null) return null;
  if (Object.keys(next).length === 0) delete all[userId];
  else all[userId] = next;
  const nextRoot = { ...root, musicPlaylists: all };
  await writeCatalogMetadata(nextRoot, metadataState.file);
  return next;
}

async function handleMusicPlaylists(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (request.method === "GET") {
      const url = new URL(request.url || "/", "http://localhost");
      const userId = trim(url.searchParams.get("userId") || request.query?.userId);
      if (!userId) { response.status(400).json({ ok: false, error: "userId kerak." }); return; }
      const metadataState = await readCatalogMetadata();
      const map = readUserPlaylists(metadataState.data, userId);
      response.status(200).json({ ok: true, userId, playlists: toList(map) });
      return;
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const userId = trim(body.userId);
      if (!userId) { response.status(400).json({ ok: false, error: "userId kerak." }); return; }
      const action = trim(body.action || "create");

      if (action === "create") {
        const name = sanitizeName(body.name);
        if (!name) { response.status(400).json({ ok: false, error: "Nom kerak." }); return; }
        let created = null;
        await withUserPlaylists(userId, (cur) => {
          if (Object.keys(cur).length >= MAX_PLAYLISTS_PER_USER) {
            const err = new Error("Playlistlar soni chegarasiga yetdi.");
            err.statusCode = 400;
            throw err;
          }
          const id = newId();
          const now = Date.now();
          const initial = Array.isArray(body.tracks) ? body.tracks.map(sanitizeTrackId).filter(Boolean) : [];
          if (body.trackId) {
            const t = sanitizeTrackId(body.trackId);
            if (t && !initial.includes(t)) initial.push(t);
          }
          created = { id, name, createdAt: now, updatedAt: now, tracks: initial };
          cur[id] = created;
          return cur;
        });
        response.status(200).json({ ok: true, playlist: created });
        return;
      }

      if (action === "rename") {
        const id = trim(body.id);
        const name = sanitizeName(body.name);
        if (!id || !name) { response.status(400).json({ ok: false, error: "id va name kerak." }); return; }
        let renamed = null;
        await withUserPlaylists(userId, (cur) => {
          if (!cur[id]) return cur;
          cur[id] = { ...cur[id], name, updatedAt: Date.now() };
          renamed = cur[id];
          return cur;
        });
        if (!renamed) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        response.status(200).json({ ok: true, playlist: renamed });
        return;
      }

      if (action === "delete") {
        const id = trim(body.id);
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        await withUserPlaylists(userId, (cur) => { delete cur[id]; return cur; });
        response.status(200).json({ ok: true });
        return;
      }

      if (action === "toggleTrack" || action === "addTrack" || action === "removeTrack") {
        const id = trim(body.id);
        const trackId = sanitizeTrackId(body.trackId);
        if (!id || !trackId) { response.status(400).json({ ok: false, error: "id va trackId kerak." }); return; }
        let result = null;
        await withUserPlaylists(userId, (cur) => {
          const pl = cur[id];
          if (!pl) return cur;
          const tracks = Array.isArray(pl.tracks) ? [...pl.tracks] : [];
          const idx = tracks.indexOf(trackId);
          let nowIn;
          if (action === "addTrack") {
            if (idx < 0) tracks.push(trackId);
            nowIn = true;
          } else if (action === "removeTrack") {
            if (idx >= 0) tracks.splice(idx, 1);
            nowIn = false;
          } else {
            if (idx >= 0) { tracks.splice(idx, 1); nowIn = false; }
            else { tracks.push(trackId); nowIn = true; }
          }
          if (tracks.length > MAX_TRACKS_PER_PLAYLIST) tracks.length = MAX_TRACKS_PER_PLAYLIST;
          cur[id] = { ...pl, tracks, updatedAt: Date.now() };
          result = { playlist: cur[id], inPlaylist: nowIn };
          return cur;
        });
        if (!result) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        response.status(200).json({ ok: true, ...result });
        return;
      }

      if (action === "setTracks") {
        const id = trim(body.id);
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const tracksArr = Array.isArray(body.tracks) ? body.tracks.map(sanitizeTrackId).filter(Boolean) : [];
        let updated = null;
        await withUserPlaylists(userId, (cur) => {
          if (!cur[id]) return cur;
          const dedup = Array.from(new Set(tracksArr)).slice(0, MAX_TRACKS_PER_PLAYLIST);
          cur[id] = { ...cur[id], tracks: dedup, updatedAt: Date.now() };
          updated = cur[id];
          return cur;
        });
        if (!updated) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        response.status(200).json({ ok: true, playlist: updated });
        return;
      }

      response.status(400).json({ ok: false, error: "Noma'lum action." });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({ ok: false, error: error.message || "playlist failed" });
  }
}

module.exports = { handleMusicPlaylists };
