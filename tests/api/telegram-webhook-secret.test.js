const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const handler = require("../../api/telegram-webhook.js");

describe("api/telegram-webhook.js — secret token", () => {
  let prev;
  beforeEach(() => {
    prev = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret-for-tests";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = prev;
  });

  test("rejects updates without Telegram's secret header", async () => {
    const res = createMockRes();
    await handler(createMockReq({ method: "POST", url: "/api/telegram-webhook", body: {} }), res);
    assert.equal(res.statusCode, 401);
  });

  test("rejects updates with a wrong secret header", async () => {
    const res = createMockRes();
    await handler(createMockReq({
      method: "POST",
      url: "/api/telegram-webhook",
      headers: { "x-telegram-bot-api-secret-token": "wrong" },
      body: {},
    }), res);
    assert.equal(res.statusCode, 401);
  });

  test("accepts updates carrying the configured secret", async () => {
    const res = createMockRes();
    await handler(createMockReq({
      method: "POST",
      url: "/api/telegram-webhook",
      headers: { "x-telegram-bot-api-secret-token": "webhook-secret-for-tests" },
      body: {},
    }), res);
    assert.equal(res.statusCode, 200);
  });
});
