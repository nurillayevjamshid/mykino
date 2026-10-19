const test = require("node:test");
const assert = require("node:assert/strict");
const authLib = require("../../api/_lib/auth");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

test("High-Load & Scalability Suite (10,000+ Concurrent Users)", async (t) => {
  await t.test("1. /api/movies returns public s-maxage Edge CDN headers for regular users", async () => {
    delete require.cache[require.resolve("../../api/movies")];
    const moviesHandler = require("../../api/movies");

    const req = createMockReq({
      method: "GET",
      url: "/api/movies",
      headers: { origin: "https://www.myplaylist.uz" },
    });
    const res = createMockRes();

    await moviesHandler(req, res);

    const cc = res.headers["Cache-Control"] || "";
    assert.match(cc, /public/);
    assert.match(cc, /s-maxage=60/);
    assert.match(cc, /stale-while-revalidate=300/);
  });

  await t.test("2. /api/music returns public s-maxage Edge CDN headers for catalog requests", async () => {
    delete require.cache[require.resolve("../../api/music")];
    const musicHandler = require("../../api/music");

    const req = createMockReq({
      method: "GET",
      url: "/api/music",
      headers: { origin: "https://www.myplaylist.uz" },
    });
    const res = createMockRes();

    await musicHandler(req, res);

    const cc = res.headers["Cache-Control"] || "";
    assert.match(cc, /public/);
    assert.match(cc, /s-maxage=60/);
    assert.match(cc, /stale-while-revalidate=300/);
  });

  await t.test("3. Mobile CGNAT: Verified Telegram users are rate-limited by userId, not shared IP", async () => {
    const sharedMobileCarrierIp = "213.230.100.50";
    const userA = { id: 111111, first_name: "UserA" };
    const userB = { id: 222222, first_name: "UserB" };

    const token = "123456:FAKE_TOKEN";
    const originalToken = process.env.BOT_TOKEN;
    process.env.BOT_TOKEN = token;

    // Helper to generate HMAC initData
    const crypto = require("crypto");
    function makeInitData(user) {
      const authDate = Math.floor(Date.now() / 1000);
      const dataCheck = `auth_date=${authDate}\nuser=${JSON.stringify(user)}`;
      const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
      const hash = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
      return `auth_date=${authDate}&user=${encodeURIComponent(JSON.stringify(user))}&hash=${hash}`;
    }

    try {
      const initDataA = makeInitData(userA);
      const initDataB = makeInitData(userB);

      // User A sends 3 requests
      for (let i = 0; i < 3; i++) {
        const reqA = createMockReq({
          method: "GET",
          headers: {
            "x-forwarded-for": sharedMobileCarrierIp,
            "x-tg-init-data": initDataA,
          },
        });
        const resA = createMockRes();
        const ok = await authLib.applyRateLimit(reqA, resA, { max: 3, windowMs: 60000 });
        assert.equal(ok, true, `User A req ${i + 1} should succeed`);
      }

      // User A 4th request exceeds quota -> blocked
      const reqA4 = createMockReq({
        method: "GET",
        headers: {
          "x-forwarded-for": sharedMobileCarrierIp,
          "x-tg-init-data": initDataA,
        },
      });
      const resA4 = createMockRes();
      const okA4 = await authLib.applyRateLimit(reqA4, resA4, { max: 3, windowMs: 60000 });
      assert.equal(okA4, false, "User A should be blocked after exceeding their individual quota");

      // User B on the EXACT SAME mobile IP must NOT be blocked!
      const reqB = createMockReq({
        method: "GET",
        headers: {
          "x-forwarded-for": sharedMobileCarrierIp,
          "x-tg-init-data": initDataB,
        },
      });
      const resB = createMockRes();
      const okB = await authLib.applyRateLimit(reqB, resB, { max: 3, windowMs: 60000 });
      assert.equal(okB, true, "User B should NOT be blocked despite sharing Carrier-Grade NAT IP with User A");
    } finally {
      if (originalToken) process.env.BOT_TOKEN = originalToken;
      else delete process.env.BOT_TOKEN;
    }
  });
});
