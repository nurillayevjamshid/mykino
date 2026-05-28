const {
  readCatalogMetadata,
  setCors,
} = require("./_lib/google-drive");
const { readBlobJson, writeBlobJson } = require("./_lib/blob-store");
const { getJsonFromR2Signed, putJsonToR2 } = require("./_lib/r2-store");
const { handleWatchProgress } = require("./_lib/watch-progress");

const BLOB_USERS_PATHNAME = "settings/bot-users.json";
const R2_USERS_KEY = "settings/bot-users.json";

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

function trimStr(value) {
  return String(value || "").trim();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUser(record) {
  if (!record || typeof record !== "object") return null;
  const telegramId = trimStr(record.telegram_id || record.telegramId || record.id);
  if (!telegramId) return null;
  return {
    telegram_id: Number(telegramId) || telegramId,
    username: trimStr(record.username).replace(/^@+/, ""),
    first_name: trimStr(record.first_name || record.firstName || record.firstSeenName),
    started_at: trimStr(record.started_at || (record.firstSeenAt ? String(record.firstSeenAt).slice(0, 10) : "")) || todayIsoDate(),
  };
}

function readUsersFromMetadata(metadata) {
  const raw = metadata?.users;
  if (Array.isArray(raw)) return raw.map(normalizeUser).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map(normalizeUser).filter(Boolean);
  return [];
}

async function tryProxyFromBot() {
  const botUrl = trimStr(process.env.BOT_PUBLIC_URL).replace(/\/+$/, "");
  if (!botUrl) return null;
  try {
    const resp = await fetch(`${botUrl}/api/users`, { headers: { "Accept": "application/json" } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
    return list.map(normalizeUser).filter(Boolean);
  } catch {
    return null;
  }
}

async function readUsersFromBlob() {
  try {
    const data = await readBlobJson(BLOB_USERS_PATHNAME, null);
    const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    return list.map(normalizeUser).filter(Boolean);
  } catch {
    return [];
  }
}

async function readUsersFromR2() {
  try {
    const data = await getJsonFromR2Signed(R2_USERS_KEY, null);
    const list = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
    return list.map(normalizeUser).filter(Boolean);
  } catch {
    return [];
  }
}

function mergeUsers(...lists) {
  const map = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const u of list) {
      if (!u) continue;
      const key = String(u.telegram_id);
      if (!key) continue;
      const prev = map.get(key);
      if (!prev) { map.set(key, u); continue; }
      map.set(key, {
        telegram_id: prev.telegram_id || u.telegram_id,
        username: prev.username || u.username,
        first_name: prev.first_name || u.first_name,
        started_at: prev.started_at || u.started_at,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
}

async function handleUserPhoto(request, response) {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    const userId = (url.searchParams.get("userId") || "").trim();
    if (!/^\d+$/.test(userId)) {
      response.status(400).json({ ok: false, error: "userId noto'g'ri." });
      return;
    }
    const token = process.env.BOT_TOKEN;
    if (!token) {
      response.status(500).json({ ok: false, error: "BOT_TOKEN serverda sozlanmagan." });
      return;
    }
    const photosUrl = `https://api.telegram.org/bot${token}/getUserProfilePhotos?user_id=${userId}&limit=1`;
    const photosRes = await fetch(photosUrl);
    const photosPayload = await photosRes.json().catch(() => null);
    if (!photosRes.ok || !photosPayload?.ok) {
      response.status(502).json({ ok: false, error: photosPayload?.description || "getUserProfilePhotos failed" });
      return;
    }
    const firstPhoto = photosPayload.result?.photos?.[0];
    if (!firstPhoto || firstPhoto.length === 0) {
      response.status(404).json({ ok: false, error: "No profile photo" });
      return;
    }
    const target = firstPhoto[firstPhoto.length - 1];
    if (!target?.file_id) {
      response.status(404).json({ ok: false, error: "No file_id" });
      return;
    }
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(target.file_id)}`);
    const filePayload = await fileRes.json().catch(() => null);
    if (!fileRes.ok || !filePayload?.ok || !filePayload.result?.file_path) {
      response.status(502).json({ ok: false, error: filePayload?.description || "getFile failed" });
      return;
    }
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePayload.result.file_path}`;
    const imgRes = await fetch(downloadUrl);
    if (!imgRes.ok || !imgRes.body) {
      response.status(502).json({ ok: false, error: "Telegram file download failed" });
      return;
    }
    response.setHeader("Content-Type", imgRes.headers.get("content-type") || "image/jpeg");
    response.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    response.status(200).send(buffer);
  } catch (error) {
    response.status(error.statusCode || 500).json({ ok: false, error: error.message || "internal error" });
  }
}

module.exports = async function handler(request, response) {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  const reqUrl = request.url || "";
  const isPhotoRequest = /\/user-photo(?:\?|$|\.)/i.test(reqUrl) || /[?&]_photo=1/.test(reqUrl);
  if (isPhotoRequest) {
    return handleUserPhoto(request, response);
  }

  const isWatchProgressRequest = /\/watch-progress(?:\?|$|\.)/i.test(reqUrl) || /[?&]_watch=1/.test(reqUrl);
  if (isWatchProgressRequest) {
    return handleWatchProgress(request, response);
  }

  response.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (request.method === "GET") {
      const debugMatch = /[?&]_debug=([^&]+)/.exec(reqUrl);
      const expectedAdmin = trimStr(process.env.ADMIN_PASSWORD) || "admin123";
      const isDebug = debugMatch && decodeURIComponent(debugMatch[1]) === expectedAdmin;
      const [r2Outcome, blobOutcome, proxiedOutcome, metaOutcome] = await Promise.all([
        (async () => {
          try { return { ok: true, users: await readUsersFromR2() }; }
          catch (e) { return { ok: false, error: e?.message || String(e) }; }
        })(),
        (async () => {
          try { return { ok: true, users: await readUsersFromBlob() }; }
          catch (e) { return { ok: false, error: e?.message || String(e) }; }
        })(),
        (async () => {
          try { return { ok: true, users: (await tryProxyFromBot()) || [] }; }
          catch (e) { return { ok: false, error: e?.message || String(e) }; }
        })(),
        (async () => {
          try {
            const metadataState = await readCatalogMetadata();
            return { ok: true, users: readUsersFromMetadata(metadataState.data), hasFile: Boolean(metadataState.file), rawUsers: metadataState.data?.users };
          } catch (e) { return { ok: false, error: e?.message || String(e) }; }
        })(),
      ]);
      const merged = mergeUsers(r2Outcome.users || [], blobOutcome.users || [], proxiedOutcome.users || [], metaOutcome.users || []);
      if (isDebug) {
        response.status(200).json({
          merged,
          counts: {
            r2: r2Outcome.users?.length || 0,
            blob: blobOutcome.users?.length || 0,
            proxied: proxiedOutcome.users?.length || 0,
            metadata: metaOutcome.users?.length || 0,
          },
          r2: r2Outcome,
          blob: blobOutcome,
          proxied: proxiedOutcome,
          metadata: metaOutcome,
        });
        return;
      }
      response.status(200).json(merged);
      return;
    }

    if (request.method === "DELETE") {
      const body = await readRequestBody(request);
      const password = trimStr(body.password);
      const expected = trimStr(process.env.ADMIN_PASSWORD) || "admin123";
      if (password !== expected) {
        response.status(401).json({ ok: false, error: "Parol noto'g'ri." });
        return;
      }
      const telegramId = trimStr(body.telegram_id || body.telegramId || body.id);
      if (!telegramId) {
        response.status(400).json({ ok: false, error: "telegram_id kerak." });
        return;
      }
      let r2Ok = false, r2Err = null, blobOk = false, blobErr = null;
      try {
        const data = (await getJsonFromR2Signed(R2_USERS_KEY, null)) || { users: [] };
        const list = (Array.isArray(data.users) ? data.users : []).filter(u => String(u.telegram_id) !== String(telegramId));
        await putJsonToR2(R2_USERS_KEY, { users: list, updatedAt: new Date().toISOString() });
        r2Ok = true;
      } catch (err) { r2Err = err?.message || String(err); }
      try {
        const blob = (await readBlobJson(BLOB_USERS_PATHNAME, null)) || { users: [] };
        const list = (Array.isArray(blob.users) ? blob.users : []).filter(u => String(u.telegram_id) !== String(telegramId));
        await writeBlobJson(BLOB_USERS_PATHNAME, { users: list, updatedAt: new Date().toISOString() });
        blobOk = true;
      } catch (err) { blobErr = err?.message || String(err); }
      response.status(200).json({ ok: r2Ok || blobOk, r2Ok, blobOk, r2Err, blobErr });
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const next = normalizeUser(body);
      if (!next) {
        response.status(400).json({ ok: false, error: "telegram_id kerak." });
        return;
      }
      // R2 — primary (private signed GET). Blob — best-effort legacy.
      let saved = next;
      let r2Ok = false;
      let r2Err = null;
      let blobOk = false;
      let blobErr = null;
      try {
        const data = (await getJsonFromR2Signed(R2_USERS_KEY, null)) || { users: [] };
        const list = Array.isArray(data.users) ? data.users : [];
        const idx = list.findIndex(u => String(u.telegram_id) === String(next.telegram_id));
        const prev = idx >= 0 ? list[idx] : null;
        saved = { ...(prev || {}), ...next, started_at: prev?.started_at || next.started_at };
        if (idx >= 0) list[idx] = saved; else list.push(saved);
        list.sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
        await putJsonToR2(R2_USERS_KEY, { users: list, updatedAt: new Date().toISOString() });
        r2Ok = true;
      } catch (err) {
        r2Err = err?.message || String(err);
      }
      try {
        const blob = (await readBlobJson(BLOB_USERS_PATHNAME, null)) || { users: [] };
        const list = Array.isArray(blob.users) ? blob.users : [];
        const idx = list.findIndex(u => String(u.telegram_id) === String(next.telegram_id));
        const merged = { ...(idx >= 0 ? list[idx] : {}), ...next };
        if (idx >= 0) list[idx] = merged; else list.push(merged);
        await writeBlobJson(BLOB_USERS_PATHNAME, { users: list, updatedAt: new Date().toISOString() });
        blobOk = true;
      } catch (err) { blobErr = err?.message || String(err); }
      if (!r2Ok && !blobOk) {
        response.status(502).json({ ok: false, error: r2Err || blobErr || "Saqlash xato." });
        return;
      }
      response.status(200).json({ ok: true, user: saved });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};
