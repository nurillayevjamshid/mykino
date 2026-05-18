const {
  readCatalogMetadata,
  writeCatalogMetadata,
  setCors,
} = require("./_lib/google-drive");
const { handleWatchProgress } = require("./_lib/watch-progress");

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
      const proxied = await tryProxyFromBot();
      if (proxied) {
        response.status(200).json(proxied);
        return;
      }
      const metadataState = await readCatalogMetadata();
      response.status(200).json(readUsersFromMetadata(metadataState.data));
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      const next = normalizeUser(body);
      if (!next) {
        response.status(400).json({ ok: false, error: "telegram_id kerak." });
        return;
      }
      const metadataState = await readCatalogMetadata();
      const existing = readUsersFromMetadata(metadataState.data);
      const filtered = existing.filter(u => String(u.telegram_id) !== String(next.telegram_id));
      filtered.push(next);
      filtered.sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
      metadataState.data.users = filtered;
      await writeCatalogMetadata(metadataState.data, metadataState.file);
      response.status(200).json({ ok: true, user: next });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};
