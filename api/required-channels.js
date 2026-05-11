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

function readChannelsFromSettings(settings) {
  const raw = Array.isArray(settings?.requiredChannels) ? settings.requiredChannels : [];
  return raw.map(normalizeChannel).filter(Boolean);
}

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  try {
    const metadataState = await readCatalogMetadata();
    const settings = metadataState.data.settings || {};
    let channels = readChannelsFromSettings(settings);

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
        channels = channels.filter(c => `${(c.username || "").toLowerCase()}|${c.id || ""}` !== key);
        channels.push(next);
      }

      metadataState.data.settings = { ...settings, requiredChannels: channels };
      await writeCatalogMetadata(metadataState.data, metadataState.file);
      response.status(200).json({ ok: true, channels });
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
      channels = channels.filter(c => {
        const u = (c.username || "").toLowerCase();
        const matchU = targetUsername && u === targetUsername;
        const matchId = targetId && c.id === targetId;
        return !(matchU || matchId);
      });
      metadataState.data.settings = { ...settings, requiredChannels: channels };
      await writeCatalogMetadata(metadataState.data, metadataState.file);
      response.status(200).json({ ok: true, channels });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};
