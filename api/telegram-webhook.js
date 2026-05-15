const { readBlobJson, writeBlobJson } = require("./_lib/blob-store");

const TG_API = "https://api.telegram.org";
const BLOB_USERS_PATHNAME = "settings/bot-users.json";
const BLOB_SUBSCRIBE_PATHNAME = "settings/required-channels.json";

function getBotToken() {
  return String(process.env.BOT_TOKEN || "").trim();
}

function getWebappUrl() {
  return String(process.env.WEBAPP_URL || "https://kino-telegram-mini-app.vercel.app").trim().replace(/\/+$/, "");
}

function getContactUsername() {
  return String(process.env.CONTACT_USERNAME || "").trim().replace(/^@/, "");
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

async function upsertUser(telegramUser) {
  if (!telegramUser?.id) return;
  try {
    const data = (await readBlobJson(BLOB_USERS_PATHNAME, null)) || { users: [] };
    const list = Array.isArray(data.users) ? data.users : [];
    const idx = list.findIndex((u) => String(u.telegram_id) === String(telegramUser.id));
    const today = new Date().toISOString().slice(0, 10);
    const record = {
      telegram_id: telegramUser.id,
      username: String(telegramUser.username || "").replace(/^@+/, ""),
      first_name: String(telegramUser.first_name || ""),
      started_at: idx >= 0 ? list[idx].started_at || today : today,
    };
    if (idx >= 0) list[idx] = record;
    else list.push(record);
    await writeBlobJson(BLOB_USERS_PATHNAME, { users: list, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("upsertUser error:", err.message);
  }
}

async function loadRequiredChannels() {
  const data = await readBlobJson(BLOB_SUBSCRIBE_PATHNAME, null);
  if (!data || !Array.isArray(data.channels)) return [];
  return data.channels.filter((c) => c && (c.username || c.id));
}

async function isUserSubscribed(userId, channel) {
  const token = getBotToken();
  if (!token || !userId) return true;
  const chatId = channel.id || (channel.username ? `@${channel.username}` : "");
  if (!chatId) return true;
  try {
    const result = await tg("getChatMember", { chat_id: chatId, user_id: userId });
    return ["creator", "administrator", "member"].includes(result?.status);
  } catch {
    return true;
  }
}

async function checkAllSubscriptions(userId) {
  const channels = await loadRequiredChannels();
  if (!channels.length) return { ok: true, missing: [] };
  const missing = [];
  for (const ch of channels) {
    const ok = await isUserSubscribed(userId, ch);
    if (!ok) missing.push(ch);
  }
  return { ok: missing.length === 0, missing };
}

function buildSubscribeKeyboard(missing) {
  const rows = missing.map((ch) => {
    const url = ch.inviteUrl || (ch.username ? `https://t.me/${ch.username}` : "");
    return url
      ? [{ text: `📢 ${ch.title || ch.username || "Kanal"}`, url }]
      : [{ text: `📢 ${ch.title || ch.username || "Kanal"}`, callback_data: "noop" }];
  });
  rows.push([{ text: "✅ Tekshirish", callback_data: "check_sub" }]);
  return { inline_keyboard: rows };
}

async function sendStart(chatId) {
  await sendMessage(
    chatId,
    "Assalomu alaykum, My Kino botiga xush kelibsiz.\n" +
      "Biz bilan vaqtingiz chog' va maroqli o'tishini tilab qolamiz.\n" +
      "Biz siz uchun doim xizmatdamiz.",
    { reply_markup: startInlineKeyboard() },
  );
  await sendMessage(chatId, "Quyidagi menyudan foydalaning:", { reply_markup: mainReplyKeyboard() });
}

async function sendSubscribeGate(chatId, missing) {
  await sendMessage(
    chatId,
    "Botdan foydalanish uchun avval quyidagi kanal(lar)ga obuna bo'ling, so'ng <b>Tekshirish</b>ni bosing.",
    { reply_markup: buildSubscribeKeyboard(missing) },
  );
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const text = String(message.text || "").trim();
  const from = message.from;
  if (!chatId) return;

  if (text.startsWith("/start")) {
    await upsertUser(from);
    const sub = await checkAllSubscriptions(from?.id);
    if (!sub.ok) {
      await sendSubscribeGate(chatId, sub.missing);
      return;
    }
    await sendStart(chatId);
    return;
  }

  if (text === "Murojaat qoldirish" || text === "Murojaat qoldiring") {
    const contact = getContactUsername();
    if (contact) {
      await sendMessage(
        chatId,
        `Talab va takliflaringizni @${contact} ga yozib qoldiring. Qisqa fursatda javob beramiz.`,
      );
    } else {
      await sendMessage(
        chatId,
        "Talab va takliflaringizni yozib qoldiring. Qisqa fursatda javob beramiz.",
      );
    }
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
  const userId = callback.from?.id;

  if (data === "feedback:start") {
    await answerCallback(callback.id);
    const contact = getContactUsername();
    if (chatId) {
      await sendMessage(
        chatId,
        contact
          ? `Talab va takliflaringizni @${contact} ga yozib qoldiring.`
          : "Talab va takliflaringizni yozib qoldiring.",
      );
    }
    return;
  }

  if (data === "check_sub") {
    const sub = await checkAllSubscriptions(userId);
    if (!sub.ok) {
      await answerCallback(callback.id, "Hali barcha kanallarga obuna bo'lmagansiz.");
      return;
    }
    await answerCallback(callback.id, "Rahmat! Obuna tasdiqlandi.");
    if (chatId) await sendStart(chatId);
    return;
  }

  await answerCallback(callback.id);
}

module.exports = async function handler(request, response) {
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
