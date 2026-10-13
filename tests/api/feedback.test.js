"use strict";

const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createMockReq, createMockRes } = require("../helpers/mock-http");

function loadHandler() {
  delete require.cache[require.resolve("../../api/telegram-webhook.js")];
  return require("../../api/telegram-webhook.js");
}

function makeValidInitData(botToken, userObj = { id: 12345, first_name: "Ali" }) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("query_id", "AAG_test");
  params.set("user", JSON.stringify(userObj));

  const sortedPairs = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(sortedPairs).digest("hex");
  params.set("hash", hash);

  return params.toString();
}

describe("api/telegram-webhook.js — feedback endpoint", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  test("returns 401 when initData is missing or invalid", async () => {
    process.env.BOT_TOKEN = "test-token";
    process.env.FEEDBACK_GROUP_ID = "-100123456789";

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/telegram-webhook?action=feedback",
      body: { text: "Yordam kerak" },
      headers: {},
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body?.error, /initData/);
  });

  test("returns 400 when message text is empty", async () => {
    process.env.BOT_TOKEN = "test-token";
    process.env.FEEDBACK_GROUP_ID = "-100123456789";
    const initData = makeValidInitData("test-token");

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/telegram-webhook?action=feedback",
      body: { text: "   " },
      headers: { "x-tg-init-data": initData },
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body?.error, /bo'sh/);
  });

  test("returns 500 with clear guidance when FEEDBACK_GROUP_ID is missing", async () => {
    process.env.BOT_TOKEN = "test-token";
    delete process.env.FEEDBACK_GROUP_ID;
    const initData = makeValidInitData("test-token");

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/telegram-webhook?action=feedback",
      body: { text: "Salom" },
      headers: { "x-tg-init-data": initData },
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(res.body?.error, /FEEDBACK_GROUP_ID sozlanmagan/);
  });

  test("returns clear human-readable error when bot is not in group (chat not found)", async () => {
    process.env.BOT_TOKEN = "test-token";
    process.env.FEEDBACK_GROUP_ID = "-1003653549810";
    const initData = makeValidInitData("test-token");

    globalThis.fetch = async (url) => {
      if (String(url).includes("/sendMessage")) {
        return new Response(JSON.stringify({
          ok: false,
          error_code: 400,
          description: "Bad Request: chat not found",
        }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 200 });
    };

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/telegram-webhook?action=feedback",
      body: { text: "Salom admin" },
      headers: { "x-tg-init-data": initData },
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(res.body?.error, /chat not found/);
    assert.match(res.body?.error, /admin huquqini bering/);
  });

  test("returns 200 when feedback sends successfully", async () => {
    process.env.BOT_TOKEN = "test-token";
    process.env.FEEDBACK_GROUP_ID = "-1003653549810";
    const initData = makeValidInitData("test-token");

    globalThis.fetch = async (url) => {
      if (String(url).includes("/sendMessage")) {
        return new Response(JSON.stringify({
          ok: true,
          result: { message_id: 999 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("{}", { status: 200 });
    };

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/telegram-webhook?action=feedback",
      body: { text: "Yaxshi ishlayapti!" },
      headers: { "x-tg-init-data": initData },
    });
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, true);
  });
});
