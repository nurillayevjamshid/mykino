const {
  readCatalogMetadata,
  writeCatalogMetadata,
  setCors,
} = require("./_lib/google-drive");

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

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

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
