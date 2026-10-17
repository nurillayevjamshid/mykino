// Global Error Handler & Telegram Admin Alert Logger
// Automatically catches unexpected backend errors (500, YouTube Queue, Football API)
// and alerts the admin via Telegram Bot with deduplication and anti-spam throttling.

const TG_API = "https://api.telegram.org";

// Anti-spam throttling & deduplication state
const ERROR_COOLDOWN_MS = 60 * 1000; // 60 soniya ichida bir xil xato qayta yuborilmaydi
const MAX_ALERTS_PER_MINUTE = 10;   // Daqiqasiga maksimal 10 ta xabar (Telegram rate limit himoyasi)

const errorCache = new Map();
const recentAlertTimestamps = [];

function getBotToken() {
  return String(process.env.BOT_TOKEN || "").trim();
}

/**
 * Admin Telegram ID(lar)ini aniqlash.
 * ADMIN_TELEGRAM_ID, ADMIN_CHAT_ID, TELEGRAM_ADMIN_ID yoki FEEDBACK_GROUP_ID dan olinadi.
 * Bir nechta ID bo'lsa vergul yoki bo'sh joy bilan ajratilgan bo'lishi mumkin.
 */
function getAdminChatIds() {
  const raw = String(
    process.env.ADMIN_TELEGRAM_ID ||
    process.env.ADMIN_CHAT_ID ||
    process.env.TELEGRAM_ADMIN_ID ||
    process.env.FEEDBACK_GROUP_ID ||
    ""
  ).trim();

  if (!raw) return [];
  return raw
    .split(/[\s,;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

function formatTashkentTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("uz-UZ", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

/**
 * Xatolik haqida chiroyli Telegram HTML formatidagi xabar matnini tuzish.
 */
function formatErrorMessage(err, context = {}) {
  const msg = err?.message || String(err || "Noma'lum xatolik");
  const location = context.location || context.component || "Backend Server";
  const method = context.method || "";
  const url = context.url || context.endpoint || "";
  const reqInfo = method && url ? `${method} ${url}` : (url || "—");
  const user = context.user ? (typeof context.user === "object" ? JSON.stringify(context.user) : String(context.user)) : "";
  const statusCode = err?.statusCode || err?.status || context.statusCode || 500;
  const timeStr = formatTashkentTime();

  let stack = String(err?.stack || "")
    .split("\n")
    .slice(0, 6)
    .join("\n")
    .trim();
  if (!stack) stack = "Stack trace mavjud emas.";

  return (
    `🚨 <b>KUTILMAGAN BACKEND XATOLIK</b>\n\n` +
    `📍 <b>Joylashuv:</b> ${escapeHtml(location)}\n` +
    `⚠️ <b>Xato matni:</b> <code>${escapeHtml(msg)}</code>\n` +
    `🔢 <b>Status / Kod:</b> <code>${escapeHtml(statusCode)}</code>\n` +
    `🌐 <b>So'rov:</b> <code>${escapeHtml(reqInfo)}</code>\n` +
    (user ? `👤 <b>Foydalanuvchi:</b> ${escapeHtml(user)}\n` : "") +
    `⏰ <b>Vaqt:</b> ${escapeHtml(timeStr)} (Toshkent)\n\n` +
    `📋 <b>Stack trace:</b>\n<pre>${escapeHtml(stack.slice(0, 1000))}</pre>`
  );
}

/**
 * Telegram API orqali xabar yuborish.
 */
async function sendTelegramAlert(htmlText, botToken, chatIds) {
  if (!botToken || !chatIds || !chatIds.length) {
    return { ok: false, error: "BOT_TOKEN yoki ADMIN_TELEGRAM_ID sozlanmagan" };
  }

  const results = [];
  for (const chatId of chatIds) {
    try {
      const response = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      const data = await response.json().catch(() => null);
      results.push({ chatId, ok: response.ok && Boolean(data?.ok), description: data?.description });
    } catch (sendErr) {
      results.push({ chatId, ok: false, error: sendErr.message });
    }
  }

  const anySuccess = results.some((r) => r.ok);
  return { ok: anySuccess, results };
}

/**
 * Asosiy xatolik xabarnomasi funksiyasi.
 * Deduplication va rate-limiting bilan admin(lar)ga Telegram orqali yuboradi.
 *
 * @param {Error|string} err - Xato obyekti yoki xabar matni
 * @param {object} context - Joylashuv va so'rov parametrlari { location, url, method, user, extra }
 * @returns {Promise<{ reported: boolean, suppressed?: boolean, reason?: string }>}
 */
async function reportError(err, context = {}) {
  const errMsg = err?.message || String(err || "Unknown error");
  const location = context.location || context.component || "Backend";
  const dedupeKey = `${location}:::${errMsg}`;
  const now = Date.now();

  // 1. Standart konsolga yozish
  console.error(`[ErrorLogger] [${location}] ${errMsg}`, err?.stack || "");

  // 2. Bir xil xatolikni takrorlanishdan saqlash (Anti-spam / Deduplication)
  const cached = errorCache.get(dedupeKey);
  if (cached && (now - cached.lastSentAt) < ERROR_COOLDOWN_MS) {
    cached.count = (cached.count || 1) + 1;
    return { reported: false, suppressed: true, count: cached.count, reason: "Deduplicated within cooldown" };
  }

  // 3. Global daqiqalik limit tekshiruvi (Maksimal 10 ta xabar / daqiqa)
  while (recentAlertTimestamps.length && now - recentAlertTimestamps[0] > 60000) {
    recentAlertTimestamps.shift();
  }
  if (recentAlertTimestamps.length >= MAX_ALERTS_PER_MINUTE) {
    return { reported: false, suppressed: true, reason: "Global rate limit reached (max 10/min)" };
  }

  const botToken = getBotToken();
  const chatIds = getAdminChatIds();

  if (!botToken || !chatIds.length) {
    return {
      reported: false,
      reason: !botToken
        ? "BOT_TOKEN environment variable sozlanmagan"
        : "ADMIN_TELEGRAM_ID environment variable sozlanmagan",
    };
  }

  // 4. Xabar tayyorlash va yuborish
  let alertText = formatErrorMessage(err, context);
  if (cached && cached.count > 1) {
    alertText += `\n\n🔁 <i>Ushbu xatolik oxirgi daqiqada ${cached.count} marta yuz berdi.</i>`;
  }

  errorCache.set(dedupeKey, { lastSentAt: now, count: 1 });
  recentAlertTimestamps.push(now);

  try {
    const res = await sendTelegramAlert(alertText, botToken, chatIds);
    return { reported: res.ok, results: res.results };
  } catch (alertErr) {
    console.error("[ErrorLogger] Telegramga xabar yuborishda xatolik:", alertErr.message);
    return { reported: false, reason: alertErr.message };
  }
}

/**
 * Serverless / Express handlerlari uchun Global Error Handler wrapper.
 * Agar handler ichida tutib olinmagan xatolik chiqsa, adminga xabar beradi va 500 javob qaytaradi.
 */
function withErrorHandler(handler, { location = "API Handler" } = {}) {
  return async function wrappedHandler(request, response) {
    try {
      return await handler(request, response);
    } catch (err) {
      await reportError(err, {
        location,
        url: request.url,
        method: request.method,
        statusCode: err?.statusCode || 500,
      }).catch(() => {});

      if (!response.headersSent) {
        const statusCode = Number(err?.statusCode || err?.status || 500);
        response.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
          ok: false,
          code: err?.code || "INTERNAL_SERVER_ERROR",
          error: err?.message || "Serverda kutilmagan xatolik yuz berdi.",
        });
      }
    }
  };
}

/**
 * Node.js jarayoni darajasida unhandledRejection va uncaughtException listenerlari.
 */
let processListenersInitialized = false;
function setupGlobalProcessErrorListeners() {
  if (processListenersInitialized) return;
  processListenersInitialized = true;

  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    reportError(err, { location: "Node.js Process (unhandledRejection)" }).catch(() => {});
  });

  process.on("uncaughtException", (err) => {
    reportError(err, { location: "Node.js Process (uncaughtException)" }).catch(() => {});
  });
}

/**
 * Testlar uchun xotira holatini tozalash yordamchisi.
 */
function _resetErrorLoggerState() {
  errorCache.clear();
  recentAlertTimestamps.length = 0;
}

module.exports = {
  getBotToken,
  getAdminChatIds,
  formatErrorMessage,
  sendTelegramAlert,
  reportError,
  withErrorHandler,
  setupGlobalProcessErrorListeners,
  _resetErrorLoggerState,
};
