const crypto = require("crypto");

// CORS uchun zaxira manzil. WEBAPP_URL env o'zgaruvchisi asosiy manba.
const DEFAULT_WEBAPP_URL = "https://www.myplaylist.uz";

// Clean and normalize URLs to get origins
const ALLOWED_ORIGINS = [
  process.env.WEBAPP_URL,
  DEFAULT_WEBAPP_URL,
  "https://myplaylist.uz",
  "https://www.myplaylist.uz",
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
    response.setHeader("Access-Control-Allow-Origin", process.env.WEBAPP_URL || DEFAULT_WEBAPP_URL);
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

    return safeCompareStrings(calculatedHash, hash);
  } catch (error) {
    console.error("Telegram WebApp initData validation error:", error);
    return false;
  }
}

// Tasdiqlangan initData'dan Telegram foydalanuvchisini ajratib oladi.
// hash tekshiruvidan o'tmasa yoki user bo'lmasa null qaytaradi. Bu Mini App
// o'zini obunachi sifatida ro'yxatga olganda, tanadagi telegram_id'ga ishonmay,
// haqiqiy (imzolangan) foydalanuvchini olish uchun ishlatiladi.
function getVerifiedInitDataUser(request, botToken = process.env.BOT_TOKEN) {
  if (!botToken) return null;
  const authHeader = request.headers["authorization"] || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";
  const initData = request.headers["x-tg-init-data"] || request.headers["x-telegram-init-data"] || bearer;
  if (!initData || typeof initData !== "string") return null;
  if (!verifyTelegramWebappInitData(initData, botToken)) return null;
  try {
    const rawUser = new URLSearchParams(initData).get("user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser);
    return parsed && parsed.id ? parsed : null;
  } catch (_) {
    return null;
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

// ---------- Rate Limiting (Redis distributed + in-memory fallback) ----------
let _rateLimitRedis = null;
async function getRateLimitRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (_rateLimitRedis) {
    try { const c = await _rateLimitRedis; if (c?.isOpen) return c; } catch (_) {}
    _rateLimitRedis = null;
  }
  _rateLimitRedis = (async () => {
    try {
      const { createClient } = require("redis");
      const client = createClient({ url });
      client.on("error", (err) => console.warn("redis (rate-limit) error:", err.message));
      await client.connect();
      return client;
    } catch (_) {
      return null;
    }
  })();
  return await _rateLimitRedis;
}

const memoryRateLimitCache = new Map();
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 120; // 120 requests/minute per IP

// scope — hisoblagich qaysi amal uchun ekanini bildiradi. Ilgari foydalanuvchining
// BARCHA so'rovlari (kino, sozlamalar, jonli reaksiyalar har ~2s...) bitta
// hisoblagichga tushardi va eng qattiq limitli endpoint (masalan, prognoz)
// bilan solishtirilardi: 3-4 ta prognozdan keyin "juda ko'p so'rov" chiqardi.
async function checkRateLimitAsync({ ip, userId, max = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS, scope = "" } = {}) {
  const who = userId ? `user:${userId}` : (ip ? `ip:${ip}` : "unknown");
  const keyIdentifier = scope ? `${scope}:${who}` : who;
  const now = Date.now();

  try {
    const redis = await getRateLimitRedis();
    if (redis) {
      const redisKey = `rl:v2:${keyIdentifier}`;
      // Bitta round-trip: kalit yo'q bo'lsa muddat bilan yaratiladi, keyin oshiriladi.
      const [, countRaw, ttlRaw] = await redis.multi()
        .set(redisKey, "0", { PX: windowMs, NX: true })
        .incr(redisKey)
        .pTTL(redisKey)
        .exec();
      const count = Number(countRaw);
      const ttlMs = Number(ttlRaw);
      const remainingTtl = ttlMs > 0 ? ttlMs : windowMs;
      const retryAfter = Math.ceil(remainingTtl / 1000);
      const remaining = Math.max(0, max - count);
      return {
        allowed: count <= max,
        limit: max,
        remaining,
        reset: Math.ceil((now + remainingTtl) / 1000),
        retryAfter: count > max ? retryAfter : 0,
      };
    }
  } catch (_) {}

  // In-memory sliding window fallback
  const clientData = memoryRateLimitCache.get(keyIdentifier) || { count: 0, resetTime: now + windowMs };
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + windowMs;
  } else {
    clientData.count++;
  }
  memoryRateLimitCache.set(keyIdentifier, clientData);

  const remainingTtl = Math.max(0, clientData.resetTime - now);
  const remaining = Math.max(0, max - clientData.count);
  const retryAfter = Math.ceil(remainingTtl / 1000);

  return {
    allowed: clientData.count <= max,
    limit: max,
    remaining,
    reset: Math.ceil(clientData.resetTime / 1000),
    retryAfter: clientData.count > max ? retryAfter : 0,
  };
}

function setRateLimitHeaders(response, rateCheck) {
  if (!response || !rateCheck) return;
  try {
    response.setHeader("X-RateLimit-Limit", String(rateCheck.limit));
    response.setHeader("X-RateLimit-Remaining", String(rateCheck.remaining));
    response.setHeader("X-RateLimit-Reset", String(rateCheck.reset));
    if (rateCheck.retryAfter > 0) {
      response.setHeader("Retry-After", String(rateCheck.retryAfter));
    }
  } catch (_) {}
}

async function applyRateLimit(request, response, options = {}) {
  const clientIp = getClientIp(request);
  const user = getVerifiedInitDataUser(request);
  const userId = user?.id ? String(user.id) : null;
  const max = Number(options.max || (request.method === "GET" ? DEFAULT_MAX_REQUESTS : 40));
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  // Har xil limit va o'qish/yozish o'z hisoblagichiga ega; alohida limit kerak
  // bo'lgan amallar (prognoz, reaksiya) options.scope beradi.
  const scope = String(options.scope || `${request.method === "GET" ? "r" : "w"}${max}`);

  // 1. If user is an authenticated Telegram Mini App user, rate-limit by their individual User ID.
  // This completely prevents innocent users from being blocked when sharing Carrier-Grade NAT (CGNAT) IPs
  // on mobile networks (Beeline, Ucell, Mobiuz, Uztelecom).
  if (userId) {
    const userCheck = await checkRateLimitAsync({ userId, max, windowMs, scope });
    setRateLimitHeaders(response, userCheck);
    if (!userCheck.allowed) {
      response.status(429).json({
        ok: false,
        code: "TOO_MANY_REQUESTS",
        error: "Foydalanuvchi hisobidan juda ko'p so'rov yuborildi. Iltimos biroz kuting.",
        retryAfter: userCheck.retryAfter,
      });
      return false;
    }
    return true;
  }

  // 2. Unauthenticated / Anonymous requests are rate-limited by IP
  const ipCheck = await checkRateLimitAsync({ ip: clientIp, max, windowMs, scope });
  setRateLimitHeaders(response, ipCheck);

  if (!ipCheck.allowed) {
    response.status(429).json({
      ok: false,
      code: "TOO_MANY_REQUESTS",
      error: "Siz juda ko'p so'rov yubordingiz. Iltimos biroz kuting.",
      retryAfter: ipCheck.retryAfter,
    });
    return false;
  }

  return true;
}

// Synchronous legacy wrapper for backward compatibility
function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const clientData = memoryRateLimitCache.get(`ip:${ip}`) || { count: 0, resetTime: now + DEFAULT_WINDOW_MS };
  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + DEFAULT_WINDOW_MS;
  } else {
    clientData.count++;
  }
  memoryRateLimitCache.set(`ip:${ip}`, clientData);
  return clientData.count <= DEFAULT_MAX_REQUESTS;
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

// Repo ochiq — parol va sessiya kaliti faqat env'dan olinadi, kodda hech
// qanday zaxira qiymat bo'lmasligi kerak (aks holda har kim admin bo'ladi).
// ADMIN_SESSION_SECRET berilmagan bo'lsa, kalit ADMIN_PASSWORD'dan hosil
// qilinadi: parol almashsa, eski sessiyalar ham bekor bo'ladi.
function getAdminSecret() {
  const explicit = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (explicit) return explicit;
  const password = getRequiredAdminPassword();
  if (!password) return "";
  return crypto.createHash("sha256").update(`mykino-admin-session:${password}`).digest("hex");
}

function getRequiredAdminPassword() {
  return String(process.env.ADMIN_PASSWORD || "").trim();
}

function safeCompareAdminPassword(input) {
  if (!input) return false;
  const envPass = getRequiredAdminPassword();
  return Boolean(envPass) && safeCompareStrings(input, envPass);
}

function signAdminSession(ttlSec = ADMIN_SESSION_TTL_SEC) {
  const secret = getAdminSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET sozlanmagan.");
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `v1.${exp}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
  return { token: `${payload}.${sig}`, exp };
}

function verifyAdminSession(token) {
  const secret = getAdminSecret();
  if (!secret) return false;
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, expStr, sig] = parts;
  if (ver !== "v1") return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp)) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  const expectedSig = crypto.createHmac("sha256", secret).update(`${ver}.${expStr}`).digest("hex").slice(0, 32);
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

async function readLimitedJsonBody(request, maxBytes = 1024 * 1024) {
  const contentLength = Number(request.headers?.["content-length"] || 0);
  if (contentLength > maxBytes) {
    const error = new Error("So‘rov hajmi juda katta.");
    error.statusCode = 413;
    throw error;
  }
  if (request.body && Buffer.isBuffer(request.body)) {
    if (request.body.length > maxBytes) {
      const error = new Error("So‘rov hajmi juda katta.");
      error.statusCode = 413;
      throw error;
    }
    return JSON.parse(request.body.toString("utf8"));
  }
  if (request.body && typeof request.body === "string") {
    if (Buffer.byteLength(request.body, "utf8") > maxBytes) {
      const error = new Error("So‘rov hajmi juda katta.");
      error.statusCode = 413;
      throw error;
    }
    return JSON.parse(request.body);
  }
  if (request.body && typeof request.body === "object") return request.body;
  let raw = "";
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxBytes) {
      const error = new Error("So‘rov hajmi juda katta.");
      error.statusCode = 413;
      throw error;
    }
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
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
  if (!request) return false;
  // 1) Cookie (preferred)
  const cookies = parseCookies(request);
  if (cookies[ADMIN_COOKIE] && verifyAdminSession(cookies[ADMIN_COOKIE])) return true;

  // 2) Authorization: Bearer <admin_token>
  const authHeader = request.headers?.["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.substring(7).trim();
    if (verifyAdminSession(bearer)) return true;
  }

  // 3) Header: X-Admin-Password
  const headerPass = request.headers?.["x-admin-password"];
  if (headerPass && safeCompareAdminPassword(headerPass)) return true;

  // 4) Bot Token / API Key (for server-to-server or bot automation)
  const apiKey = request.headers?.["x-api-key"] || request.headers?.["x-bot-token"];
  const botToken = process.env.BOT_TOKEN;
  if (apiKey && botToken && (safeCompareStrings(apiKey, botToken) || safeCompareStrings(apiKey, `Bot ${botToken}`))) {
    return true;
  }
  if (authHeader.startsWith("Bot ") && botToken && safeCompareStrings(authHeader.substring(4).trim(), botToken)) {
    return true;
  }

  return false;
}

/**
 * Faqat administratorlar uchun qattiq avtorizatsiya middleware.
 * Begonalar (oddiy foydalanuvchilar ham) kirishini bloklaydi.
 */
async function requireAdmin(request, response) {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return false;
  }

  const rateOk = await applyRateLimit(request, response, { max: 40 });
  if (!rateOk) return false;

  const clientIp = getClientIp(request);
  if (adminIsLocked(clientIp)) {
    response.status(429).json({ ok: false, code: "ADMIN_LOCKED", error: "Juda ko'p noto'g'ri urinish. 10 daqiqadan keyin qayta urinib ko'ring." });
    return false;
  }

  if (isAdminAuthorized(request)) {
    adminResetFails(clientIp);
    return true;
  }

  // Body password fallback if parsed
  if (request.body && typeof request.body === "object" && request.body.password) {
    if (safeCompareAdminPassword(request.body.password)) {
      adminResetFails(clientIp);
      return true;
    }
  }

  adminRegisterFail(clientIp);
  response.status(401).json({
    ok: false,
    code: "ADMIN_UNAUTHORIZED",
    error: "Ushbu amal faqat administrator uchun ruxsat etilgan.",
  });
  return false;
}

/**
 * Faqat tasdiqlangan Telegram foydalanuvchilari uchun middleware.
 * Telegram WebApp initData (HMAC-SHA256) hash'ini Bot Token orqali tekshiradi.
 * Natijada request.user va request.verifiedUserId ni biriktiradi.
 */
async function requireVerifiedUser(request, response, options = {}) {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return null;
  }

  const rateOk = await applyRateLimit(request, response, { max: 60, ...(options.rateLimit || {}) });
  if (!rateOk) return null;

  const user = getVerifiedInitDataUser(request);
  if (user && user.id) {
    request.user = user;
    request.verifiedUserId = String(user.id);
    return user;
  }

  // Administratorga ham test/boshqaruv maqsadida ruxsat beriladi
  if (isAdminAuthorized(request)) {
    request.isAdmin = true;
    request.verifiedUserId = "admin";
    return { id: "admin", is_admin: true, first_name: "Admin" };
  }

  response.status(401).json({
    ok: false,
    code: "UNVERIFIED_USER",
    error: "Telegram WebApp tasdiqlanmadi (initData xato, eskirgan yoki mavjud emas).",
  });
  return null;
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

  // 2. Rate Limiting (IP & User)
  const rateOk = await applyRateLimit(request, response, {
    max: options.rateLimitMax || (request.method === "GET" ? DEFAULT_MAX_REQUESTS : 40),
  });
  if (!rateOk) return false;

  // 3. Admin-only check
  if (options.requireAdmin || options.adminOnly) {
    return await requireAdmin(request, response);
  }

  // 4. Verified-user-only check
  if (options.requireVerifiedUser) {
    const u = await requireVerifiedUser(request, response);
    return Boolean(u);
  }

  // 5. Skip auth for share pages (GET requests with _share=1)
  const isShare = String(request.query?._share || "") === "1" || /[?&]_share=1/.test(request.url || "");
  if (isShare && request.method === "GET" && options.allowShare) {
    return true;
  }

  // 6. Check Admin credentials (Cookie, Bearer, Password header, Bot token)
  if (isAdminAuthorized(request)) {
    return true;
  }

  // 7. Check Telegram WebApp InitData (for normal users)
  const initData = request.headers["x-tg-init-data"] || request.headers["x-telegram-init-data"];
  const authHeader = request.headers["authorization"] || "";
  let bearerToken = "";
  if (authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.substring(7).trim();
  }
  const tgToken = initData || bearerToken;
  const botToken = process.env.BOT_TOKEN;
  if (tgToken && botToken) {
    if (verifyTelegramWebappInitData(tgToken, botToken)) {
      return true;
    }
  }

  // 8. Hotlink protection: check Referer and Origin if they are present
  const origin = request.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    response.status(403).json({ ok: false, code: "FORBIDDEN", error: "Ruxsat berilmagan domen (CORS Block)." });
    return false;
  }

  // 9. Same-origin GET fallback
  if (request.method === "GET" && origin && isOriginAllowed(origin)) {
    return true;
  }
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
  requireAdmin,
  requireVerifiedUser,
  applyRateLimit,
  checkRateLimitAsync,
  setRateLimitHeaders,
  setCorsHeaders,
  isOriginAllowed,
  verifyTelegramWebappInitData,
  getVerifiedInitDataUser,
  generateSignedToken,
  verifySignedToken,
  // admin auth helpers
  safeCompareStrings,
  signAdminSession,
  verifyAdminSession,
  parseCookies,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  readLimitedJsonBody,
  isAdminAuthorized,
  getRequiredAdminPassword,
  safeCompareAdminPassword,
  getAdminSecret,
  getClientIp,
  adminIsLocked,
  adminRegisterFail,
  adminResetFails,
  ADMIN_COOKIE,
  // drive validators
  isValidDriveFileId,
  isAllowedDriveRedirect,
};
