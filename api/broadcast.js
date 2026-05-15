const { readCatalogMetadata, setCors } = require("./_lib/google-drive");

const TELEGRAM_API = "https://api.telegram.org";
const SEND_DELAY_MS = 50;

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

async function loadRecipients() {
  const proxied = await tryProxyFromBot();
  if (proxied && proxied.length) return proxied;
  const metadataState = await readCatalogMetadata();
  return readUsersFromMetadata(metadataState.data);
}

function buildReplyMarkup(buttonText, buttonUrl) {
  const text = trimStr(buttonText);
  const url = trimStr(buttonUrl);
  if (!text || !url) return null;
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
    if (password !== expectedPassword) {
      response.status(401).json({ ok: false, error: "Parol noto'g'ri." });
      return;
    }

    const text = trimStr(body.text);
    const photoUrl = trimStr(body.photoUrl);
    if (!text && !photoUrl) {
      response.status(400).json({ ok: false, error: "Matn yoki rasm kerak." });
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
    const replyMarkup = buildReplyMarkup(body.buttonText, body.buttonUrl);
    const disableNotification = Boolean(body.silent);
    const isPhoto = Boolean(photoUrl);

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

      const method = isPhoto ? "sendPhoto" : "sendMessage";
      const payload = isPhoto
        ? { ...basePayload, photo: photoUrl, caption: text }
        : { ...basePayload, text, disable_web_page_preview: Boolean(body.disablePreview) };

      try {
        const result = await telegramSend(token, method, payload);
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
          if (result.json?.error_code === 429) {
            const retryAfter = Number(result.json?.parameters?.retry_after || 1);
            await sleep(retryAfter * 1000);
            const retry = await telegramSend(token, method, payload);
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
