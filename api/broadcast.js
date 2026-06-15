const { readCatalogMetadata, setCors } = require("./_lib/google-drive");
const { readBlobJson } = require("./_lib/blob-store");
const { getJsonFromR2Signed } = require("./_lib/r2-store");
const { isAdminAuthorized, safeCompareStrings } = require("./_lib/auth");

const TELEGRAM_API = "https://api.telegram.org";
const SEND_DELAY_MS = 50;
const BLOB_USERS_PATHNAME = "settings/bot-users.json";
const R2_USERS_KEY = "settings/bot-users.json";

function trimStr(value) {
  return String(value || "").trim();
}

async function readBody(request) {
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

function normalizeUser(record) {
  if (!record || typeof record !== "object") return null;
  const telegramId = trimStr(record.telegram_id || record.telegramId || record.id);
  if (!telegramId) return null;
  const numeric = Number(telegramId);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
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
    const resp = await fetch(`${botUrl}/api/users`, { headers: { Accept: "application/json" } });
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

function uniqIds(list) {
  const seen = new Set();
  const out = [];
  for (const id of list) {
    if (!id) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

async function loadRecipients() {
  const [r2, blob, proxied, metadataUsers] = await Promise.all([
    readUsersFromR2(),
    readUsersFromBlob(),
    tryProxyFromBot(),
    (async () => {
      try {
        const metadataState = await readCatalogMetadata();
        return readUsersFromMetadata(metadataState.data);
      } catch {
        return [];
      }
    })(),
  ]);
  return uniqIds([
    ...(r2 || []),
    ...(blob || []),
    ...(proxied || []),
    ...(metadataUsers || []),
  ]);
}

function buildReplyMarkup(buttonText, buttonUrl, asWebApp = false) {
  const text = trimStr(buttonText);
  const url = trimStr(buttonUrl);
  if (!text || !url) return null;
  // web_app — Telegram mini app sifatida ochiladi (tashqi browser emas). Faqat https URL.
  if (asWebApp && /^https:\/\//i.test(url)) {
    return JSON.stringify({ inline_keyboard: [[{ text, web_app: { url } }]] });
  }
  return JSON.stringify({ inline_keyboard: [[{ text, url }]] });
}

async function telegramSend(token, method, payload) {
  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok && json.ok, status: response.status, json };
}

function decodeDataUrl(dataUrl) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/i.exec(String(dataUrl || ""));
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isB64 = !!m[2];
  const raw = m[3] || "";
  try {
    const buf = isB64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw), "utf8");
    return { buffer: buf, mime };
  } catch {
    return null;
  }
}

async function telegramSendMultipart(token, method, fields, fileField, fileBuf, fileName, fileMime) {
  const url = `${TELEGRAM_API}/bot${token}/${method}`;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    form.append(k, typeof v === "string" ? v : String(v));
  }
  const blob = new Blob([fileBuf], { type: fileMime || "application/octet-stream" });
  form.append(fileField, blob, fileName || "file");
  const response = await fetch(url, { method: "POST", body: form });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok && json.ok, status: response.status, json };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function handler(request, response) {
  setCors(response);
  response.setHeader("Cache-Control", "no-store, max-age=0");

  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Faqat POST." });
    return;
  }

  try {
    const body = await readBody(request);
    const password = trimStr(body.password);
    const expectedPassword = trimStr(process.env.ADMIN_PASSWORD) || "admin123";
    const okByCookieOrHeader = isAdminAuthorized(request);
    const okByBody = password && safeCompareStrings(password, expectedPassword);
    if (!okByCookieOrHeader && !okByBody) {
      response.status(401).json({ ok: false, error: "Parol noto'g'ri." });
      return;
    }

    const text = trimStr(body.text);
    const photoUrl = trimStr(body.photoUrl);
    const videoUrl = trimStr(body.videoUrl);
    const mediaDataUrl = trimStr(body.mediaDataUrl);
    const mediaKind = body.mediaKind === "video" ? "video" : "photo";
    const decodedMedia = mediaDataUrl ? decodeDataUrl(mediaDataUrl) : null;
    if (!text && !photoUrl && !videoUrl && !decodedMedia) {
      response.status(400).json({ ok: false, error: "Matn yoki media kerak." });
      return;
    }
    if (text.length > 4000) {
      response.status(400).json({ ok: false, error: "Matn 4000 belgidan oshmasin." });
      return;
    }

    const token = trimStr(process.env.BOT_TOKEN);
    if (!token) {
      response.status(500).json({ ok: false, error: "BOT_TOKEN sozlanmagan." });
      return;
    }

    const recipients = await loadRecipients();
    if (!recipients.length) {
      response.status(400).json({ ok: false, error: "Obunachilar ro'yxati bo'sh." });
      return;
    }

    const parseMode = body.parseMode === "HTML" ? "HTML" : body.parseMode === "Markdown" ? "MarkdownV2" : "";
    const replyMarkup = buildReplyMarkup(body.buttonText, body.buttonUrl, Boolean(body.buttonAsWebApp));
    const disableNotification = Boolean(body.silent);
    const isPhoto = Boolean(photoUrl);
    const isVideo = Boolean(videoUrl);
    const isUpload = Boolean(decodedMedia);

    let sent = 0;
    let failed = 0;
    const errors = [];
    const startedAt = Date.now();
    const HARD_BUDGET_MS = 55 * 1000;

    for (let i = 0; i < recipients.length; i += 1) {
      if (Date.now() - startedAt > HARD_BUDGET_MS) {
        errors.push({ chatId: null, error: `Vaqt tugadi: ${recipients.length - i} ta foydalanuvchi yuborilmadi.` });
        break;
      }

      const chatId = recipients[i];
      const basePayload = {
        chat_id: chatId,
        disable_notification: disableNotification,
      };
      if (parseMode) basePayload.parse_mode = parseMode;
      if (replyMarkup) basePayload.reply_markup = replyMarkup;

      let method;
      let payload;
      let result;
      if (isUpload) {
        method = mediaKind === "video" ? "sendVideo" : "sendPhoto";
        const fileField = mediaKind === "video" ? "video" : "photo";
        const fileName = mediaKind === "video" ? "trailer.mp4" : "poster.jpg";
        const fields = { ...basePayload, caption: text };
        try {
          result = await telegramSendMultipart(token, method, fields, fileField, decodedMedia.buffer, fileName, decodedMedia.mime);
        } catch (error) {
          failed += 1;
          if (errors.length < 50) errors.push({ chatId, error: error.message });
          if (i < recipients.length - 1) await sleep(SEND_DELAY_MS);
          continue;
        }
      } else if (isVideo) {
        method = "sendVideo";
        payload = { ...basePayload, video: videoUrl, caption: text };
      } else if (isPhoto) {
        method = "sendPhoto";
        payload = { ...basePayload, photo: photoUrl, caption: text };
      } else {
        method = "sendMessage";
        payload = { ...basePayload, text, disable_web_page_preview: Boolean(body.disablePreview) };
      }

      try {
        if (!result) result = await telegramSend(token, method, payload);
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
          if (result.json?.error_code === 429) {
            const retryAfter = Number(result.json?.parameters?.retry_after || 1);
            await sleep(retryAfter * 1000);
            const retry = isUpload
              ? await telegramSendMultipart(token, method, { ...basePayload, caption: text }, mediaKind === "video" ? "video" : "photo", decodedMedia.buffer, mediaKind === "video" ? "trailer.mp4" : "poster.jpg", decodedMedia.mime)
              : await telegramSend(token, method, payload);
            if (retry.ok) { sent += 1; failed -= 1; }
            else if (errors.length < 50) errors.push({ chatId, error: retry.json?.description || `HTTP ${retry.status}` });
          } else if (errors.length < 50) {
            errors.push({ chatId, error: result.json?.description || `HTTP ${result.status}` });
          }
        }
      } catch (error) {
        failed += 1;
        if (errors.length < 50) errors.push({ chatId, error: error.message });
      }

      if (i < recipients.length - 1) await sleep(SEND_DELAY_MS);
    }

    response.status(200).json({
      ok: true,
      total: recipients.length,
      sent,
      failed,
      errors,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
};

module.exports.config = { maxDuration: 60 };
