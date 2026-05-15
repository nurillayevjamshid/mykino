const {
  readCatalogMetadata,
  writeCatalogMetadata,
  setCors,
  isServiceAccountStorageQuotaError,
} = require("./_lib/google-drive");
const { readBlobJson, writeBlobJson } = require("./_lib/blob-store");

const BLOB_SETTINGS_PATHNAME = "settings/required-channels.json";

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

function normalizeChannel(item) {
  if (!item || typeof item !== "object") return null;
  const username = trimStr(item.username).replace(/^@+/, "");
  const id = trimStr(item.id || item.chatId);
  const title = trimStr(item.title) || username || id;
  let inviteUrl = trimStr(item.inviteUrl || item.url);
  if (!username && !id) return null;
  if (!inviteUrl && username) inviteUrl = `https://t.me/${username}`;
  return { id, username, title, inviteUrl };
}

function dedupeChannels(list) {
  const seen = new Set();
  const result = [];
  for (const ch of list) {
    if (!ch) continue;
    const key = `${(ch.username || "").toLowerCase()}|${ch.id || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ch);
  }
  return result;
}

async function loadChannels() {
  const blob = await readBlobJson(BLOB_SETTINGS_PATHNAME, null);
  if (blob && Array.isArray(blob.channels)) {
    return dedupeChannels(blob.channels.map(normalizeChannel).filter(Boolean));
  }

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data?.settings || {};
    const raw = Array.isArray(settings.requiredChannels) ? settings.requiredChannels : [];
    return dedupeChannels(raw.map(normalizeChannel).filter(Boolean));
  } catch {
    return [];
  }
}

async function saveChannels(channels) {
  const normalized = dedupeChannels(channels.map(normalizeChannel).filter(Boolean));
  await writeBlobJson(BLOB_SETTINGS_PATHNAME, { channels: normalized, updatedAt: new Date().toISOString() });

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data?.settings || {};
    metadataState.data.settings = { ...settings, requiredChannels: normalized };
    await writeCatalogMetadata(metadataState.data, metadataState.file);
  } catch (err) {
    if (!isServiceAccountStorageQuotaError(err)) {
      // Drive yozish boshqa sabab bilan ham buzilgan bo'lsa ham, Blob saqlangani uchun davom etamiz.
    }
  }

  return normalized;
}

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    let channels = await loadChannels();

    if (request.method === "GET") {
      response.status(200).json({ ok: true, channels });
      return;
    }

    if (request.method === "POST") {
      const body = await readRequestBody(request);
      if (body && Array.isArray(body.channels)) {
        channels = body.channels.map(normalizeChannel).filter(Boolean);
      } else {
        const next = normalizeChannel(body);
        if (!next) {
          response.status(400).json({ ok: false, error: "username yoki id kerak." });
          return;
        }
        const key = `${(next.username || "").toLowerCase()}|${next.id || ""}`;
        channels = channels.filter((c) => `${(c.username || "").toLowerCase()}|${c.id || ""}` !== key);
        channels.push(next);
      }

      const saved = await saveChannels(channels);
      response.status(200).json({ ok: true, channels: saved });
      return;
    }

    if (request.method === "DELETE") {
      const body = await readRequestBody(request);
      const targetUsername = trimStr(body.username).replace(/^@+/, "").toLowerCase();
      const targetId = trimStr(body.id);
      if (!targetUsername && !targetId) {
        response.status(400).json({ ok: false, error: "username yoki id kerak." });
        return;
      }
      channels = channels.filter((c) => {
        const u = (c.username || "").toLowerCase();
        const matchU = targetUsername && u === targetUsername;
        const matchId = targetId && c.id === targetId;
        return !(matchU || matchId);
      });
      const saved = await saveChannels(channels);
      response.status(200).json({ ok: true, channels: saved });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};
