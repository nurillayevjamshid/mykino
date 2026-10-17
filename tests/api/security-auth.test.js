const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test_token";
const TEST_ADMIN_PASSWORD = "jamnr";

function createValidInitData(userObj, botToken = TEST_BOT_TOKEN, authDate = Math.floor(Date.now() / 1000)) {
  const params = {
    auth_date: String(authDate),
    query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
    user: JSON.stringify(userObj),
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, v);
  }
  qs.set("hash", hash);
  return qs.toString();
}

describe("Security Audit & Protection Suite", () => {
  let prevBotToken;
  let prevRedisUrl;
  let authLib;
  let categoriesHandler;
  let settingsHandler;
  let moviesHandler;
  let movieUpdateHandler;
  let musicHandler;
  let usersHandler;

  beforeEach(() => {
    prevBotToken = process.env.BOT_TOKEN;
    prevRedisUrl = process.env.REDIS_URL;
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;

    // Reload auth and handlers with clean state
    delete require.cache[require.resolve("../../api/_lib/auth")];
    authLib = require("../../api/_lib/auth");

    delete require.cache[require.resolve("../../api/categories")];
    categoriesHandler = require("../../api/categories");

    delete require.cache[require.resolve("../../api/settings")];
    settingsHandler = require("../../api/settings");

    delete require.cache[require.resolve("../../api/movies")];
    moviesHandler = require("../../api/movies");

    delete require.cache[require.resolve("../../api/movie-update")];
    movieUpdateHandler = require("../../api/movie-update");

    delete require.cache[require.resolve("../../api/music")];
    musicHandler = require("../../api/music");

    delete require.cache[require.resolve("../../api/users")];
    usersHandler = require("../../api/users");
  });

  afterEach(() => {
    if (prevBotToken !== undefined) process.env.BOT_TOKEN = prevBotToken;
    else delete process.env.BOT_TOKEN;
    if (prevRedisUrl !== undefined) process.env.REDIS_URL = prevRedisUrl;
    else delete process.env.REDIS_URL;
  });

  // =========================================================================
  // 1. Telegram WebApp initData HMAC-SHA256 Signature Verification
  // =========================================================================
  describe("1. Telegram WebApp HMAC-SHA256 Signature Validation", () => {
    test("valid initData passes cryptographic verification", () => {
      const user = { id: 987654321, first_name: "Ali", username: "ali_valiyev" };
      const validInitData = createValidInitData(user);
      const ok = authLib.verifyTelegramWebappInitData(validInitData, TEST_BOT_TOKEN);
      assert.equal(ok, true);
    });

    test("tampered or forged initData is rejected", () => {
      const user = { id: 987654321, first_name: "Ali" };
      const validInitData = createValidInitData(user);
      // Alter the user id in the initData without re-computing hash
      const forgedInitData = validInitData.replace("987654321", "111222333");
      const ok = authLib.verifyTelegramWebappInitData(forgedInitData, TEST_BOT_TOKEN);
      assert.equal(ok, false);
    });

    test("expired initData (>24 hours) is rejected (anti-replay)", () => {
      const user = { id: 987654321, first_name: "Ali" };
      const expiredDate = Math.floor(Date.now() / 1000) - (86400 + 3600); // 25 hours ago
      const expiredInitData = createValidInitData(user, TEST_BOT_TOKEN, expiredDate);
      const ok = authLib.verifyTelegramWebappInitData(expiredInitData, TEST_BOT_TOKEN);
      assert.equal(ok, false);
    });

    test("requireVerifiedUser extracts verified user details and attaches to request", async () => {
      const user = { id: 555444333, first_name: "Sardor", username: "sardor_dev" };
      const validInitData = createValidInitData(user);
      const req = createMockReq({
        method: "GET",
        headers: { "x-tg-init-data": validInitData },
      });
      const res = createMockRes();

      const verified = await authLib.requireVerifiedUser(req, res);
      assert.ok(verified);
      assert.equal(verified.id, 555444333);
      assert.equal(req.verifiedUserId, "555444333");
      assert.equal(res.statusCode, 200);
    });

    test("requireVerifiedUser returns 401 when initData is missing or invalid", async () => {
      const req = createMockReq({
        method: "GET",
        headers: { "x-tg-init-data": "garbage_invalid_token" },
      });
      const res = createMockRes();

      const verified = await authLib.requireVerifiedUser(req, res);
      assert.equal(verified, null);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "UNVERIFIED_USER");
    });
  });

  // =========================================================================
  // 2. Personal Actions & FIFA Favorites Endpoint Protection
  // =========================================================================
  describe("2. Personal Actions & IDOR Protection", () => {
    test("FIFA favorites GET & POST reject requests without valid initData with 401", async () => {
      const req = createMockReq({
        method: "GET",
        url: "/api/categories?type=fifa-favorites",
      });
      const res = createMockRes();

      await categoriesHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "UNVERIFIED_USER");
    });

    test("FIFA favorites GET & POST succeed for verified Telegram user", async () => {
      const user = { id: 777888999, first_name: "Temur" };
      const initData = createValidInitData(user);

      // GET
      const getReq = createMockReq({
        method: "GET",
        url: "/api/categories?type=fifa-favorites",
        headers: { "x-tg-init-data": initData },
      });
      const getRes = createMockRes();
      await categoriesHandler(getReq, getRes);
      assert.equal(getRes.statusCode, 200);
      assert.equal(getRes.body.ok, true);
      assert.deepEqual(getRes.body.teams, {});

      // POST
      const postReq = createMockReq({
        method: "POST",
        url: "/api/categories?type=fifa-favorites",
        headers: { "x-tg-init-data": initData },
        body: {
          teams: { "Real Madrid": { name: "Real Madrid", leagueId: "esp.1" } },
          matches: { "m-1": { id: "m-1", title: "Real vs Barca" } },
        },
      });
      const postRes = createMockRes();
      await categoriesHandler(postReq, postRes);
      assert.equal(postRes.statusCode, 200);
      assert.equal(postRes.body.ok, true);
      assert.ok(postRes.body.teams["Real Madrid"]);
    });

    test("Watch progress POST prevents IDOR by rejecting mismatched userId with 403", async () => {
      const user = { id: 12345, first_name: "User1" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "POST",
        url: "/api/users?_watch=1",
        headers: { "x-tg-init-data": initData },
        body: {
          userId: "99999", // Attempting to alter another user's progress
          movieId: "movie_123",
          progress: 50,
        },
      });
      const res = createMockRes();

      await usersHandler(req, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, "USER_ID_MISMATCH");
    });

    test("Music playlists resource prevents IDOR by rejecting mismatched userId with 403", async () => {
      const user = { id: 12345, first_name: "User1" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "POST",
        url: "/api/music?resource=playlists",
        query: { resource: "playlists" },
        headers: { "x-tg-init-data": initData },
        body: {
          userId: "attacker_target_user",
          name: "Hacked Playlist",
        },
      });
      const res = createMockRes();

      await musicHandler(req, res);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, "USER_ID_MISMATCH");
    });
  });

  // =========================================================================
  // 3. Admin Authorization Protection
  // =========================================================================
  describe("3. Strict Admin Authorization Protection", () => {
    test("POST /api/settings returns 401 when called without credentials", async () => {
      const req = createMockReq({
        method: "POST",
        url: "/api/settings",
        body: { splashEnabled: true },
      });
      const res = createMockRes();

      await settingsHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "ADMIN_UNAUTHORIZED");
    });

    test("POST /api/settings rejects standard Telegram user (even with valid initData) with 401", async () => {
      const user = { id: 888111, first_name: "NormalUser" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "POST",
        url: "/api/settings",
        headers: { "x-tg-init-data": initData },
        body: { splashEnabled: true },
      });
      const res = createMockRes();

      await settingsHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "ADMIN_UNAUTHORIZED");
    });

    test("POST /api/settings succeeds with valid admin session cookie", async () => {
      const { token } = authLib.signAdminSession();
      const req = createMockReq({
        method: "POST",
        url: "/api/settings",
        headers: {
          cookie: `${authLib.ADMIN_COOKIE}=${token}`,
        },
        body: {},
      });
      const res = createMockRes();

      await settingsHandler(req, res);
      // Status code is 200 or 503 (if Redis is not configured in test env), but NOT 401 unauthorized
      assert.notEqual(res.statusCode, 401);
    });

    test("POST /api/categories mutations return 401 for non-admin", async () => {
      const user = { id: 888111, first_name: "NormalUser" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "POST",
        url: "/api/categories",
        headers: { "x-tg-init-data": initData },
        body: { name: "Malicious Category" },
      });
      const res = createMockRes();

      await categoriesHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "ADMIN_UNAUTHORIZED");
    });

    test("POST /api/movie-update returns 401 for non-admin", async () => {
      const user = { id: 888111, first_name: "NormalUser" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "POST",
        url: "/api/movie-update",
        headers: { "x-tg-init-data": initData },
        body: { id: "movie-1", title: "Changed Title" },
      });
      const res = createMockRes();

      await movieUpdateHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "ADMIN_UNAUTHORIZED");
    });

    test("GET /api/users returns 401 for non-admin to prevent user list exfiltration", async () => {
      const user = { id: 888111, first_name: "NormalUser" };
      const initData = createValidInitData(user);

      const req = createMockReq({
        method: "GET",
        url: "/api/users",
        headers: { "x-tg-init-data": initData },
      });
      const res = createMockRes();

      await usersHandler(req, res);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.code, "ADMIN_UNAUTHORIZED");
    });

    test("GET /api/users succeeds with X-Admin-Password header", async () => {
      const req = createMockReq({
        method: "GET",
        url: "/api/users",
        headers: { "x-admin-password": TEST_ADMIN_PASSWORD },
      });
      const res = createMockRes();

      await usersHandler(req, res);
      assert.equal(res.statusCode, 200);
      assert.ok(Array.isArray(res.body));
    });
  });

  // =========================================================================
  // 4. Rate Limiting Protection
  // =========================================================================
  describe("4. Distributed & In-Memory Rate Limiting", () => {
    test("Rate limiter sets X-RateLimit-* headers", async () => {
      const req = createMockReq({
        method: "GET",
        url: "/api/categories?type=fifa&date=2026-08-27&league=esp.1",
        headers: { "x-forwarded-for": "203.0.113.195" },
      });
      const res = createMockRes();

      const ok = await authLib.applyRateLimit(req, res, { max: 10, windowMs: 60000 });
      assert.equal(ok, true);
      assert.equal(String(res.headers["X-RateLimit-Limit"]), "10");
      assert.equal(String(res.headers["X-RateLimit-Remaining"]), "9");
      assert.ok(res.headers["X-RateLimit-Reset"]);
    });

    test("Rate limiter blocks client with 429 when max request quota is exceeded", async () => {
      const testIp = "198.51.100.77";
      const maxLimit = 5;

      for (let i = 0; i < maxLimit; i++) {
        const req = createMockReq({
          method: "GET",
          headers: { "x-forwarded-for": testIp },
        });
        const res = createMockRes();
        const ok = await authLib.applyRateLimit(req, res, { max: maxLimit, windowMs: 60000 });
        assert.equal(ok, true, `Request ${i + 1} should be allowed`);
      }

      // The 6th request must be blocked
      const blockedReq = createMockReq({
        method: "GET",
        headers: { "x-forwarded-for": testIp },
      });
      const blockedRes = createMockRes();
      const blocked = await authLib.applyRateLimit(blockedReq, blockedRes, { max: maxLimit, windowMs: 60000 });

      assert.equal(blocked, false);
      assert.equal(blockedRes.statusCode, 429);
      assert.equal(blockedRes.body.code, "TOO_MANY_REQUESTS");
      assert.ok(blockedRes.headers["Retry-After"] !== undefined);
      assert.equal(String(blockedRes.headers["X-RateLimit-Remaining"]), "0");
    });
  });
});
