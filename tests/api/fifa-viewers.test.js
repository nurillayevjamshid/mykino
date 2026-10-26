const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test_token";
const URL = "/api/categories?type=fifa-viewers";

function createValidInitData(userObj) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(userObj) };
  const dataCheckString = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(TEST_BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

describe("FIFA live viewers counter", () => {
  let prevBotToken;
  let prevRedisUrl;
  let handler;

  beforeEach(() => {
    prevBotToken = process.env.BOT_TOKEN;
    prevRedisUrl = process.env.REDIS_URL;
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;
    delete require.cache[require.resolve("../../api/_lib/auth")];
    delete require.cache[require.resolve("../../api/categories")];
    handler = require("../../api/categories");
  });

  afterEach(() => {
    if (prevBotToken !== undefined) process.env.BOT_TOKEN = prevBotToken;
    else delete process.env.BOT_TOKEN;
    if (prevRedisUrl !== undefined) process.env.REDIS_URL = prevRedisUrl;
    else delete process.env.REDIS_URL;
  });

  async function call(method, user) {
    const headers = user ? { "x-tg-init-data": createValidInitData(user) } : {};
    const res = createMockRes();
    await handler(createMockReq({ method, url: URL, headers }), res);
    return res;
  }

  test("counts each verified Telegram user once and drops them on leave", async () => {
    assert.equal((await call("GET")).body.viewers, 0);

    const userA = { id: 1001, first_name: "A" };
    const userB = { id: 1002, first_name: "B" };
    assert.equal((await call("POST", userA)).body.viewers, 1);
    assert.equal((await call("POST", userA)).body.viewers, 1);
    assert.equal((await call("POST", userB)).body.viewers, 2);
    assert.equal((await call("GET")).body.viewers, 2);

    const left = await call("DELETE", userA);
    assert.equal(left.statusCode, 200);
    assert.equal(left.body.viewers, 1);
  });

  test("rejects heartbeats without valid initData so the count cannot be inflated", async () => {
    const res = await call("POST");
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.code, "UNVERIFIED_USER");
  });

  test("live pill renders a viewers badge that the heartbeat fills in", () => {
    const root = path.resolve(__dirname, "../..");
    const fifaJs = fs.readFileSync(path.join(root, "webapp/fifa/fifa.js"), "utf8");
    assert.match(fifaJs, /fifa-streams-live-pill"><i><\/i> LIVE<span class="fifa-streams-viewers" data-fifa-viewers hidden>/);
    assert.match(fifaJs, /type=fifa-viewers/);
    assert.doesNotMatch(fifaJs, /<span class="fifa-streams-live-pill"><i><\/i> LIVE<\/span>/);
  });
});
