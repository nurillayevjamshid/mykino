const crypto = require("crypto");

// Clean and normalize URLs to get origins
const ALLOWED_ORIGINS = [
  process.env.WEBAPP_URL,
  "https://kino-telegram-mini-app.vercel.app"
].map(url => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch (_) {
    return url;
  }
}).filter(Boolean);

// Allowed local origins for development and testing
const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  const normalized = origin.trim().toLowerCase();
  return ALLOWED_ORIGINS.includes(normalized) || DEV_ORIGINS.includes(normalized);
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (isOriginAllowed(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    response.setHeader("Access-Control-Allow-Origin", process.env.WEBAPP_URL || "https://kino-telegram-mini-app.vercel.app");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization, X-TG-Init-Data, X-API-Key, X-Admin-Password");
  response.setHeader("Access-Control-Allow-Credentials", "true");
}

function verifyTelegramWebappInitData(initData, botToken) {
  if (!initData) return false;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    // Verify expiration: max 24 hours to prevent replay attacks
    const authDate = Number(params.get("auth_date") || 0);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) {
      console.warn("Telegram WebApp initData has expired:", authDate);
      return false;
    }

    params.delete("hash");
    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys
      .map((key) => `${key}=${params.get(key)}`)
      .join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return calculatedHash === hash;
  } catch (error) {
    console.error("Telegram WebApp initData validation error:", error);
    return false;
  }
}

function generateSignedToken(fileId, botToken) {
  const expires = Math.floor(Date.now() / 1000) + 7200; // 2 hours
  const stringToSign = `${fileId}:${expires}`;
  const signature = crypto
    .createHmac("sha256", botToken)
    .update(stringToSign)
    .digest("hex")
    .slice(0, 16);
  return `${expires}.${signature}`;
}

function verifySignedToken(fileId, token, botToken) {
  if (!token) return false;
  try {
    const [expiresStr, signature] = token.split(".");
    if (!expiresStr || !signature) return false;

    const expires = Number(expiresStr);
    const now = Math.floor(Date.now() / 1000);
    if (now > expires) {
      return false; // Token expired
    }

    const stringToSign = `${fileId}:${expires}`;
    const expectedSignature = crypto
      .createHmac("sha256", botToken)
      .update(stringToSign)
      .digest("hex")
      .slice(0, 16);

    return signature === expectedSignature;
  } catch (_) {
    return false;
  }
}

// In-memory request log cache for simple stateless IP rate-limiting
const ipCache = new Map();
const IP_TTL_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_MIN = 120; // 120 requests/minute per IP

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const clientData = ipCache.get(ip) || { count: 0, resetTime: now + IP_TTL_MS };

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + IP_TTL_MS;
  } else {
    clientData.count++;
  }
  ipCache.set(ip, clientData);

  return clientData.count <= MAX_REQUESTS_PER_MIN;
}

// ---------- Drive fileId & redirect validators ----------

// Google Drive file ID format: base64url alfaviti, odatda 28-44 belgi.
// Diapazon kengroq olindi (20..80) — kelajakdagi format o'zgarishlariga toqat.
// Bu validatsiya log injection, URL injection (`?alt=media&...` ulash), Drive
// quota DoS va katalog tashqarisidagi faylga noruxsat kirishni oldini oladi.
const DRIVE_FILE_ID_RE = /^[A-Za-z0-9_-]{20,80}$/;
function isValidDriveFileId(id) {
  return typeof id === "string" && DRIVE_FILE_ID_RE.test(id);
}

// drive-resolve qaytaradigan Location header faqat Google CDN/host'lariga
// yo'naltirilishi mumkin. Aks holda endpoint open-redirect bo'lib qoladi va
// fishing havola sifatida ishlatilishi mumkin (mykino.app/api/drive-resolve...).
const ALLOWED_DRIVE_REDIRECT_HOSTS = [
  /\.googleusercontent\.com$/i,
  /\.googleapis\.com$/i,
  /^drive\.google\.com$/i,
  /^lh\d+\.googleusercontent\.com$/i,
];
function isAllowedDriveRedirect(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  let host;
  try { host = new URL(rawUrl).host.toLowerCase(); } catch { return false; }
  return ALLOWED_DRIVE_REDIRECT_HOSTS.some((re) => re.test(host));
}

// ---------- Admin auth helpers ----------

const ADMIN_COOKIE = "__admin_session";
const ADMIN_SESSION_TTL_SEC = 7 * 24 * 3600; // 7 days
const ADMIN_LOCK_MAX_FAILS = 5;
const ADMIN_LOCK_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Per-IP failed-admin-login tracker
const adminFailCache = new Map();

function getClientIp(request) {
  const xf = request.headers["x-forwarded-for"];
  if (xf) return String(xf).split(",")[0].trim();
  return request.socket?.remoteAddress || "unknown";
}

function adminIsLocked(ip) {
  if (!ip) return false;
  const entry = adminFailCache.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    adminFailCache.delete(ip);
    return false;
  }
  return entry.count >= ADMIN_LOCK_MAX_FAILS;
}

function adminRegisterFail(ip) {
  if (!ip) return;
  const now = Date.now();
  const entry = adminFailCache.get(ip);
  if (!entry || now > entry.resetAt) {
    adminFailCache.set(ip, { count: 1, resetAt: now + ADMIN_LOCK_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function adminResetFails(ip) {
  if (!ip) return;
  adminFailCache.delete(ip);
}

function safeCompareStrings(a, b) {
  const sa = String(a == null ? "" : a);
  const sb = String(b == null ? "" : b);
  const bufA = Buffer.from(sa, "utf8");
  const bufB = Buffer.from(sb, "utf8");
  // timingSafeEqual requires equal-length buffers; pad to the longer length so
  // comparison time does not leak which input was shorter.
  const len = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);
  const eq = crypto.timingSafeEqual(padA, padB);
  return eq && bufA.length === bufB.length;
}

function getAdminSecret() {
  // Prefer a dedicated secret; fall back to BOT_TOKEN; final fallback so dev never crashes.
  return process.env.ADMIN_SESSION_SECRET
    || process.env.BOT_TOKEN
    || process.env.ADMIN_PASSWORD
    || "kino-admin-fallback";
}

function signAdminSession(ttlSec = ADMIN_SESSION_TTL_SEC) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `v1.${exp}`;
  const sig = crypto.createHmac("sha256", getAdminSecret()).update(payload).digest("hex").slice(0, 32);
  return { token: `${payload}.${sig}`, exp };
}

function verifyAdminSession(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, expStr, sig] = parts;
  if (ver !== "v1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  const expectedSig = crypto.createHmac("sha256", getAdminSecret()).update(`${ver}.${expStr}`).digest("hex").slice(0, 32);
  return safeCompareStrings(sig, expectedSig);
}

function parseCookies(request) {
  const header = request.headers?.cookie;
  if (!header || typeof header !== "string") return {};
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

function buildAdminCookie(token, maxAgeSec = ADMIN_SESSION_TTL_SEC) {
  // SameSite=None; Secure is required for cross-origin Telegram WebApp cookies.
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSec}`;
}

function buildAdminClearCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function setAdminSessionCookie(response, token, maxAgeSec = ADMIN_SESSION_TTL_SEC) {
  appendSetCookie(response, buildAdminCookie(token, maxAgeSec));
}

function clearAdminSessionCookie(response) {
  appendSetCookie(response, buildAdminClearCookie());
}

function appendSetCookie(response, value) {
  const prev = response.getHeader("Set-Cookie");
  if (!prev) {
    response.setHeader("Set-Cookie", value);
  } else if (Array.isArray(prev)) {
    response.setHeader("Set-Cookie", prev.concat(value));
  } else {
    response.setHeader("Set-Cookie", [prev, value]);
  }
}

function isAdminAuthorized(request) {
  // 1) Cookie (preferred)
  const cookies = parseCookies(request);
  if (cookies[ADMIN_COOKIE] && verifyAdminSession(cookies[ADMIN_COOKIE])) return true;
  // 2) Header (legacy, still accepted)
  const headerPass = request.headers["x-admin-password"];
  const expected = process.env.ADMIN_PASSWORD || "admin123";
  if (headerPass && safeCompareStrings(headerPass, expected)) return true;
  return false;
}

/**
 * Validates request authorization and sets CORS headers.
 * Returns true if authorized, false otherwise (and automatically sends response error).
 */
async function authorizeRequest(request, response, options = {}) {
  // 1. Set CORS headers
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return false;
  }

  // 2. Simple Rate Limiting (IP-based)
  const clientIp = getClientIp(request);
  if (!checkRateLimit(clientIp)) {
    response.status(429).json({ ok: false, code: "TOO_MANY_REQUESTS", error: "Siz juda ko'p so'rov yubordingiz. Iltimos biroz kuting." });
    return false;
  }

  // 3. Skip auth for share pages (GET requests with _share=1)
  const isShare = String(request.query?._share || "") === "1" || /[?&]_share=1/.test(request.url || "");
  if (isShare && request.method === "GET" && options.allowShare) {
    return true;
  }

  // 4. Retrieve Auth credentials from Headers
  const initData = request.headers["x-tg-init-data"] || request.headers["x-telegram-init-data"];
  const authHeader = request.headers["authorization"] || "";

  let bearerToken = "";
  if (authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.substring(7).trim();
  }

  const apiKey = request.headers["x-api-key"] || request.headers["x-bot-token"];
  const adminPasswordHeader = request.headers["x-admin-password"];

  const botToken = process.env.BOT_TOKEN;
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  // Check 1: API Key / Bot Token (for Telegram bot or backend requests) — constant-time
  if (apiKey && botToken && (safeCompareStrings(apiKey, botToken) || safeCompareStrings(apiKey, `Bot ${botToken}`))) {
    return true;
  }
  if (authHeader.startsWith("Bot ") && botToken && safeCompareStrings(authHeader.substring(4).trim(), botToken)) {
    return true;
  }

  // Check 2a: Admin session cookie (preferred path — set by /api/users?action=admin-login)
  const cookies = parseCookies(request);
  if (cookies[ADMIN_COOKIE] && verifyAdminSession(cookies[ADMIN_COOKIE])) {
    return true;
  }

  // Check 2b: Admin Password header (legacy fallback) — constant-time + per-IP lockout
  if (adminPasswordHeader) {
    if (adminIsLocked(clientIp)) {
      response.status(429).json({ ok: false, code: "ADMIN_LOCKED", error: "Juda ko'p noto'g'ri urinish. 10 daqiqadan keyin qayta urinib ko'ring." });
      return false;
    }
    if (safeCompareStrings(adminPasswordHeader, adminPassword)) {
      adminResetFails(clientIp);
      return true;
    }
    adminRegisterFail(clientIp);
  }

  // Check 3: Telegram WebApp InitData (for normal users)
  const tgToken = initData || bearerToken;
  if (tgToken && botToken) {
    if (verifyTelegramWebappInitData(tgToken, botToken)) {
      return true;
    }
  }

  // Hotlink protection: check Referer and Origin if they are present
  // If Origin/Referer are from untrusted sources, reject
  const origin = request.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    response.status(403).json({ ok: false, code: "FORBIDDEN", error: "Ruxsat berilmagan domen (CORS Block)." });
    return false;
  }

  // Same-origin GET fallback: Telegram ba'zan reply-keyboard webapp tugmasi
  // bosilganda initData'ni bo'sh yoki eskirgan holda yetkazadi (ayniqsa Desktop
  // klientida). Bunday paytda foydalanuvchini "Kirish taqiqlangan" ekraniga
  // uloqtirish o'rniga, agar so'rov bizning ruxsat etilgan domendan kelayotgan
  // GET bo'lsa, katalogni o'qishga ruxsat beramiz. Yozish/o'zgartirish (POST/PUT/DELETE)
  // baribir initData yoki admin parolisiz o'tmaydi.
  if (request.method === "GET" && origin && isOriginAllowed(origin)) {
    return true;
  }
  // Origin yo'q bo'lsa (mobil Telegram WebView ba'zan yubormaydi), Referer'ga qaraymiz
  if (request.method === "GET") {
    const referer = request.headers.referer || request.headers.referrer;
    if (referer) {
      try {
        const refOrigin = new URL(referer).origin;
        if (isOriginAllowed(refOrigin)) {
          return true;
        }
      } catch (_) {}
    }
  }

  // If we reach here, request is unauthorized
  response.status(401).json({
    ok: false,
    code: "UNAUTHORIZED",
    error: "Ruxsat berilmadi. Faqat rasmiy Telegram Mini App va Bot orqali kirish mumkin."
  });
  return false;
}

module.exports = {
  authorizeRequest,
  setCorsHeaders,
  isOriginAllowed,
  generateSignedToken,
  verifySignedToken,
  // admin auth helpers
  safeCompareStrings,
  signAdminSession,
  verifyAdminSession,
  parseCookies,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  isAdminAuthorized,
  getClientIp,
  adminIsLocked,
  adminRegisterFail,
  adminResetFails,
  ADMIN_COOKIE,
  // drive validators
  isValidDriveFileId,
  isAllowedDriveRedirect,
};
