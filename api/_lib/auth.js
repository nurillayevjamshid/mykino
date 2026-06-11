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
  const clientIp = request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown";
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

  // Check 1: API Key / Bot Token (for Telegram bot or backend requests)
  if (apiKey && botToken && (apiKey === botToken || apiKey === `Bot ${botToken}`)) {
    return true;
  }
  if (authHeader.startsWith("Bot ") && botToken && authHeader.substring(4).trim() === botToken) {
    return true;
  }

  // Check 2: Admin Password (for admin dashboard requests)
  if (adminPasswordHeader && adminPasswordHeader === adminPassword) {
    return true;
  }
  // Check in body/query for backwards compatibility with some admin actions
  if (request.body && request.body.password === adminPassword) {
    return true;
  }
  if (request.query && request.query.password === adminPassword) {
    return true;
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
  verifySignedToken
};
