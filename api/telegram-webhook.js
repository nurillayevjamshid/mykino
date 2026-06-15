const { readBlobJson, writeBlobJson } = require("./_lib/blob-store");
const { getJsonFromR2Signed, putJsonToR2 } = require("./_lib/r2-store");
const { verifyTelegramWebappInitData, setCorsHeaders } = require("./_lib/auth");

const TG_API = "https://api.telegram.org";
const BLOB_USERS_PATHNAME = "settings/bot-users.json";
const R2_USERS_KEY = "settings/bot-users.json";

function getBotToken() {
  return String(process.env.BOT_TOKEN || "").trim();
}

function getWebappUrl() {
  return String(process.env.WEBAPP_URL || "https://kino-telegram-mini-app.vercel.app").trim().replace(/\/+$/, "");
}

function getContactUsername() {
  return String(process.env.CONTACT_USERNAME || "").trim().replace(/^@/, "");
}

function getFeedbackGroupId() {
  return String(process.env.FEEDBACK_GROUP_ID || "").trim();
}

function parseInitDataUser(initData) {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) { return null; }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function handleWebappFeedback(request, response) {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ ok: false, error: "POST kerak" }); return; }

  const botToken = getBotToken();
  const groupId = getFeedbackGroupId();
  if (!botToken || !groupId) {
    response.status(500).json({ ok: false, error: "Feedback sozlanmagan." });
    return;
  }

  const initData = String(request.headers["x-tg-init-data"] || "").trim();
  if (!initData || !verifyTelegramWebappInitData(initData, botToken)) {
    response.status(401).json({ ok: false, error: "Telegram initData yaroqsiz." });
    return;
  }

  let body = {};
  try {
    if (request.body && typeof request.body === "object") body = request.body;
    else {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      body = raw ? JSON.parse(raw) : {};
    }
  } catch { body = {}; }

  const text = String(body.text || "").trim();
  if (!text) { response.status(400).json({ ok: false, error: "Xabar bo'sh." }); return; }
  if (text.length > 2000) { response.status(400).json({ ok: false, error: "Xabar juda uzun (max 2000)." }); return; }

  const user = parseInitDataUser(initData) || {};
  const userId = user.id ? String(user.id) : "—";
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";
  const username = user.username ? `@${user.username}` : "—";

  const formatted =
    `📨 <b>Yangi murojaat</b>\n` +
    `<b>Kim:</b> ${escapeHtml(name)} (${escapeHtml(username)})\n` +
    `<b>ID:</b> <code>${escapeHtml(userId)}</code>\n` +
    `\n${escapeHtml(text)}`;

  try {
    await sendMessage(groupId, formatted);
    response.status(200).json({ ok: true });
  } catch (err) {
    console.error("Feedback send error:", err.message);
    response.status(500).json({ ok: false, error: "Yuborib bo'lmadi." });
  }
}

function bust(url, anchor = "") {
  const sep = url.includes("?") ? "&" : "?";
  const cache = `v=${Math.floor(Date.now() / 1000)}`;
  return anchor ? `${url}${sep}${cache}${anchor}` : `${url}${sep}${cache}`;
}

function startInlineKeyboard() {
  const webapp = getWebappUrl();
  const mainUrl = bust(webapp);
  const profileUrl = bust(webapp, "#profile");
  return {
    inline_keyboard: [
      [{ text: "Kino ko'rish", web_app: { url: mainUrl } }],
      [
        { text: "Profilga kirish", web_app: { url: profileUrl } },
        { text: "Oxirgi ko'rilgan kinolar", web_app: { url: profileUrl } },
      ],
      [{ text: "Murojaat qoldirish", callback_data: "feedback:start" }],
    ],
  };
}

function mainReplyKeyboard() {
  const webapp = getWebappUrl();
  const mainUrl = bust(webapp);
  const profileUrl = bust(webapp, "#profile");
  return {
    keyboard: [
      [{ text: "Kino ko'rish", web_app: { url: mainUrl } }],
      [
        { text: "Profilga kirish", web_app: { url: profileUrl } },
        { text: "Murojaat qoldirish" },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function tg(method, payload) {
  const token = getBotToken();
  if (!token) throw new Error("BOT_TOKEN sozlanmagan.");
  const response = await fetch(`${TG_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram API ${method} muvaffaqiyatsiz.`);
  }
  return data.result;
}

async function sendMessage(chatId, text, extra = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function answerCallback(callbackId, text = "") {
  try {
    await tg("answerCallbackQuery", { callback_query_id: callbackId, text });
  } catch {}
}

async function upsertUserBlob(record) {
  // Try to persist to Vercel Blob (legacy storage). Throws on suspended/missing token.
  const data = (await readBlobJson(BLOB_USERS_PATHNAME, null)) || { users: [] };
  const list = Array.isArray(data.users) ? data.users : [];
  const idx = list.findIndex((u) => String(u.telegram_id) === String(record.telegram_id));
  const merged = idx >= 0 ? { ...list[idx], ...record, started_at: list[idx].started_at || record.started_at } : record;
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  await writeBlobJson(BLOB_USERS_PATHNAME, { users: list, updatedAt: new Date().toISOString() });
}

async function upsertUserR2(record) {
  // Primary storage: Cloudflare R2 (signed GET to keep user list private).
  const data = (await getJsonFromR2Signed(R2_USERS_KEY, null)) || { users: [] };
  const list = Array.isArray(data.users) ? data.users : [];
  const idx = list.findIndex((u) => String(u?.telegram_id) === String(record.telegram_id));
  const merged = idx >= 0
    ? { ...list[idx], ...record, started_at: list[idx]?.started_at || record.started_at }
    : record;
  if (idx >= 0) list[idx] = merged;
  else list.push(merged);
  list.sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
  await putJsonToR2(R2_USERS_KEY, { users: list, updatedAt: new Date().toISOString() });
}

async function upsertUser(telegramUser) {
  if (!telegramUser?.id) return;
  const today = new Date().toISOString().slice(0, 10);
  const record = {
    telegram_id: telegramUser.id,
    username: String(telegramUser.username || "").replace(/^@+/, ""),
    first_name: String(telegramUser.first_name || ""),
    started_at: today,
  };
  // R2 — primary (reliable, private). Blob — best-effort legacy.
  let r2Ok = false;
  try {
    await upsertUserR2(record);
    r2Ok = true;
  } catch (err) {
    console.error("upsertUser R2 error:", err.message);
  }
  try {
    await upsertUserBlob(record);
  } catch (err) {
    if (!r2Ok) console.error("upsertUser blob error:", err.message);
    // ignore Blob if suspended — R2 is the source of truth
  }
  
  // Google Drive Metadata (Kafolatli zaxira)
  try {
    const { readCatalogMetadata, writeCatalogMetadata } = require("./_lib/google-drive");
    const metadataState = await readCatalogMetadata();
    if (metadataState.file) {
      const data = metadataState.data;
      const list = Array.isArray(data.users) ? data.users : (data.users ? Object.values(data.users) : []);
      const idx = list.findIndex(u => String(u.telegram_id) === String(record.telegram_id));
      const merged = idx >= 0 ? { ...list[idx], ...record, started_at: list[idx].started_at || record.started_at } : record;
      if (idx >= 0) list[idx] = merged; else list.push(merged);
      data.users = list.sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
      await writeCatalogMetadata(data, metadataState.file);
    }
  } catch (err) {
    console.error("upsertUser metadata error:", err.message);
  }
}

async function sendStart(chatId) {
  await sendMessage(
    chatId,
    "Assalomu alaykum, My Playlist botiga xush kelibsiz.\n" +
      "Biz bilan vaqtingiz chog' va maroqli o'tishini tilab qolamiz.\n" +
      "Biz siz uchun doim xizmatdamiz.",
    { reply_markup: startInlineKeyboard() },
  );
  await sendMessage(chatId, "Quyidagi menyudan foydalaning:", { reply_markup: mainReplyKeyboard() });
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = String(message.text || "").trim();
  const from = message.from;
  if (!chatId) return;

  if (text.startsWith("/start")) {
    await upsertUser(from);
    await sendStart(chatId);
    return;
  }

  if (text === "Murojaat qoldirish" || text === "Murojaat qoldiring") {
    const feedbackUrl = bust(getWebappUrl(), "#feedback");
    await sendMessage(
      chatId,
      "Talab va takliflaringizni quyidagi tugma orqali yuboring. Xabar bevosita administratorga yetkaziladi.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "📨 Murojaat yozish", web_app: { url: feedbackUrl } }]],
        },
      },
    );
    return;
  }

  if (text === "Kino ko'rish" || text === "Profilga kirish") {
    await sendMessage(chatId, "Yuqoridagi tugma orqali ochiladi.");
    return;
  }
}

async function handleCallback(callback) {
  const chatId = callback.message?.chat?.id;
  const data = String(callback.data || "");

  if (data === "feedback:start") {
    await answerCallback(callback.id);
    if (chatId) {
      const feedbackUrl = bust(getWebappUrl(), "#feedback");
      await sendMessage(
        chatId,
        "Talab va takliflaringizni quyidagi tugma orqali yuboring.",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "📨 Murojaat yozish", web_app: { url: feedbackUrl } }]],
          },
        },
      );
    }
    return;
  }

  await answerCallback(callback.id);
}

module.exports = async function handler(request, response) {
  const reqUrl = request.url || "";
  if (/[?&]action=feedback(?:&|$)/.test(reqUrl)) {
    return handleWebappFeedback(request, response);
  }
  if (request.method === "GET") {
    response.status(200).json({ ok: true, message: "Telegram webhook endpoint" });
    return;
  }
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const update = request.body && typeof request.body === "object" ? request.body : await (async () => {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      return raw ? JSON.parse(raw) : {};
    })();

    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    response.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    response.status(200).json({ ok: true });
  }
};
