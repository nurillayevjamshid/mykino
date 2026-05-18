const {
  readCatalogMetadata,
  writeCatalogMetadata,
} = require("./google-drive");

const MAX_ENTRIES_PER_USER = 500;

async function readRequestBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString("utf8"));
  }
  if (request.body && typeof request.body === "string") {
    return JSON.parse(request.body);
  }
  if (request.body && typeof request.body === "object") {
    return request.body;
  }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function trim(value) {
  return String(value == null ? "" : value).trim();
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const time = Math.max(0, Math.floor(Number(raw.time) || 0));
  const duration = Math.max(0, Math.floor(Number(raw.duration) || 0));
  const updatedAt = Math.max(0, Math.floor(Number(raw.updatedAt) || Date.now()));
  if (time <= 0 || duration <= 0) return null;
  return {
    time,
    duration,
    updatedAt,
    title: trim(raw.title).slice(0, 200),
    poster: trim(raw.poster).slice(0, 600),
    year: trim(raw.year).slice(0, 16),
    genre: trim(raw.genre).slice(0, 120),
  };
}

function readUserProgressMap(metadata, userId) {
  const all = metadata?.watchProgress;
  if (!all || typeof all !== "object") return {};
  const entry = all[String(userId)];
  return entry && typeof entry === "object" ? entry : {};
}

function clipToLatest(map) {
  const entries = Object.entries(map);
  if (entries.length <= MAX_ENTRIES_PER_USER) return map;
  entries.sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0));
  return Object.fromEntries(entries.slice(0, MAX_ENTRIES_PER_USER));
}

async function handleWatchProgress(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (request.method === "GET") {
      const url = new URL(request.url || "/", "http://localhost");
      const userId = trim(url.searchParams.get("userId") || request.query?.userId);
      if (!userId) {
        response.status(400).json({ ok: false, error: "userId kerak." });
        return;
      }
      const metadataState = await readCatalogMetadata();
      const progress = readUserProgressMap(metadataState.data, userId);
      response.status(200).json({ ok: true, userId, items: progress });
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const userId = trim(body.userId);
      if (!userId) {
        response.status(400).json({ ok: false, error: "userId kerak." });
        return;
      }

      const upserts = body.items && typeof body.items === "object" ? body.items : {};
      const removeIds = Array.isArray(body.removeIds) ? body.removeIds.map(trim).filter(Boolean) : [];
      const clearAll = body.clearAll === true;

      const metadataState = await readCatalogMetadata();
      const root = metadataState.data && typeof metadataState.data === "object" ? metadataState.data : {};
      const allProgress = root.watchProgress && typeof root.watchProgress === "object" ? { ...root.watchProgress } : {};
      const currentUserMap = allProgress[userId] && typeof allProgress[userId] === "object" ? { ...allProgress[userId] } : {};

      let nextUserMap = currentUserMap;

      if (clearAll) {
        nextUserMap = {};
      } else {
        for (const id of removeIds) delete nextUserMap[id];
        for (const [rawId, rawEntry] of Object.entries(upserts)) {
          const id = trim(rawId);
          if (!id) continue;
          const cleaned = sanitizeEntry(rawEntry);
          if (!cleaned) {
            delete nextUserMap[id];
            continue;
          }
          const prev = nextUserMap[id];
          if (prev && Number(prev.updatedAt || 0) > cleaned.updatedAt) continue;
          nextUserMap[id] = cleaned;
        }
        nextUserMap = clipToLatest(nextUserMap);
      }

      if (Object.keys(nextUserMap).length === 0) {
        delete allProgress[userId];
      } else {
        allProgress[userId] = nextUserMap;
      }

      const nextRoot = { ...root, watchProgress: allProgress };
      await writeCatalogMetadata(nextRoot, metadataState.file);

      response.status(200).json({ ok: true, userId, items: nextUserMap });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || "watch-progress failed",
    });
  }
}

module.exports = { handleWatchProgress };
