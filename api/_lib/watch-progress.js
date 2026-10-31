const {
  readCatalogMetadata,
  readCatalogMetadataStrict,
  writeCatalogMetadata,
} = require("./google-drive");
const kv = require("./kv");

const MAX_ENTRIES_PER_USER = 500;
const PROGRESS_TTL_SEC = 400 * 24 * 3600;

// Redis'da har bir foydalanuvchining o'z hash'i: maydon = kino ID, qiymat = JSON.
// Ilgari hammaning tarixi katalog faylining ichida edi: har ~25 soniyada har bir
// tomoshabin butun katalogni qayta yozardi, ustma-ust kelgan yozuvlar bir-birini
// (va admin o'zgarishlarini) o'chirib yuborardi.
const WP = {
  user: (uid) => `wp:v1:${uid}`,
  migrated: (uid) => `wp:v1:m:${uid}`,
};

function parseEntry(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function parseMap(hash) {
  const out = {};
  for (const [id, raw] of Object.entries(hash || {})) {
    const entry = parseEntry(raw);
    if (entry) out[id] = entry;
  }
  return out;
}

// Eski (katalogdagi) tarixni bir marta Redis'ga ko'chiradi. HSETNX — Redis'dagi
// yangiroq yozuv ustidan yozilmaydi. Katalog o'qilmasa belgi qo'yilmaydi va
// keyingi so'rovda qayta urinadi.
async function ensureMigrated(store, userId) {
  if (await store.get(WP.migrated(userId))) return;
  let legacy;
  try {
    legacy = readUserProgressMap((await readCatalogMetadataStrict()).data, userId);
  } catch (_) {
    return;
  }
  const ops = Object.entries(legacy)
    .map(([id, entry]) => [id, sanitizeEntry(entry)])
    .filter(([id, entry]) => id && entry)
    .map(([id, entry]) => ["hSetNx", WP.user(userId), id, JSON.stringify(entry)]);
  if (ops.length) {
    ops.push(["expire", WP.user(userId), PROGRESS_TTL_SEC]);
    await store.batch(ops);
  }
  await store.set(WP.migrated(userId), "1", PROGRESS_TTL_SEC);
}

async function readProgressFromStore(store, userId) {
  await ensureMigrated(store, userId);
  return parseMap(await store.hGetAll(WP.user(userId)));
}

async function writeProgressToStore(store, userId, { upserts, removeIds, clearAll }) {
  await ensureMigrated(store, userId);
  const key = WP.user(userId);
  if (clearAll) {
    await store.batch([["del", key], ["set", WP.migrated(userId), "1", PROGRESS_TTL_SEC]]);
    return {};
  }
  const incoming = [];
  for (const [rawId, rawEntry] of Object.entries(upserts)) {
    const id = trim(rawId);
    const cleaned = id ? sanitizeEntry(rawEntry) : null;
    if (cleaned) incoming.push([id, cleaned]);
  }
  const ops = removeIds.map((id) => ["hDel", key, id]);
  if (incoming.length) {
    // Boshqa qurilmadan kelgan yangiroq yozuv eskisi bilan almashtirilmasin.
    const current = await store.batch(incoming.map(([id]) => ["hGet", key, id]));
    incoming.forEach(([id, entry], i) => {
      const prev = parseEntry(current[i]);
      if (prev && Number(prev.updatedAt || 0) > entry.updatedAt) return;
      ops.push(["hSet", key, id, JSON.stringify(entry)]);
    });
  }
  if (ops.length) {
    ops.push(["expire", key, PROGRESS_TTL_SEC]);
    await store.batch(ops);
  }
  let map = parseMap(await store.hGetAll(key));
  const clipped = clipToLatest(map);
  if (clipped !== map) {
    const drop = Object.keys(map).filter((id) => !(id in clipped));
    await store.batch(drop.map((id) => ["hDel", key, id]));
    map = clipped;
  }
  return map;
}

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
  const title = trim(raw.title).slice(0, 200);
  const poster = trim(raw.poster).slice(0, 600);
  const year = trim(raw.year).slice(0, 16);
  const genre = trim(raw.genre).slice(0, 120);
  if (!title && !poster && time <= 0 && duration <= 0) return null;
  return {
    time,
    duration,
    updatedAt,
    title,
    poster,
    year,
    genre,
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
    const verifiedUserId = trim(request.verifiedTelegramUserId);
    if (request.requireVerifiedUser && !verifiedUserId) {
      response.status(401).json({ ok: false, error: "Telegram foydalanuvchisi tasdiqlanmadi." });
      return;
    }
    if (request.method === "GET") {
      const url = new URL(request.url || "/", "http://localhost");
      const userId = verifiedUserId || trim(url.searchParams.get("userId") || request.query?.userId);
      if (!userId) {
        response.status(400).json({ ok: false, error: "userId kerak." });
        return;
      }
      const store = await kv.getPersistentStore();
      if (store) {
        response.status(200).json({ ok: true, userId, items: await readProgressFromStore(store, userId) });
        return;
      }
      const metadataState = await readCatalogMetadata();
      const progress = readUserProgressMap(metadataState.data, userId);
      response.status(200).json({ ok: true, userId, items: progress });
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const requestedUserId = trim(body.userId);
      if (verifiedUserId && requestedUserId && requestedUserId !== verifiedUserId) {
        response.status(403).json({ ok: false, code: "USER_ID_MISMATCH", error: "Boshqa foydalanuvchi nomidan amal bajarib bo‘lmaydi." });
        return;
      }
      const userId = verifiedUserId || requestedUserId;
      if (!userId) {
        response.status(400).json({ ok: false, error: "userId kerak." });
        return;
      }

      const upserts = body.items && typeof body.items === "object" ? body.items : {};
      const removeIds = Array.isArray(body.removeIds) ? body.removeIds.map(trim).filter(Boolean) : [];
      const clearAll = body.clearAll === true;

      const store = await kv.getPersistentStore();
      if (store) {
        const items = await writeProgressToStore(store, userId, { upserts, removeIds, clearAll });
        response.status(200).json({ ok: true, userId, items });
        return;
      }

      // Redis yo'q (lokal) — eski yo'l: katalog faylida.
      // Strict: o'qish xatosi "bo'sh katalog" bo'lib ko'rinsa, quyidagi yozuv
      // barcha kino posterlari va sozlamalarni o'chirib yuborardi.
      const metadataState = await readCatalogMetadataStrict();
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
          if (!cleaned) continue;
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
