const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getBotToken,
  getAdminChatIds,
  formatErrorMessage,
  reportError,
  withErrorHandler,
  _resetErrorLoggerState,
} = require("../../api/_lib/error-logger");

test("Global Error Handler & Telegram Logger Suite", async (t) => {
  const originalEnv = { ...process.env };

  t.beforeEach(() => {
    _resetErrorLoggerState();
    process.env = { ...originalEnv };
  });

  t.after(() => {
    process.env = originalEnv;
  });

  await t.test("1. Admin IDs parsing from various env variables", () => {
    process.env.ADMIN_TELEGRAM_ID = "12345678, 87654321";
    assert.deepEqual(getAdminChatIds(), ["12345678", "87654321"]);

    delete process.env.ADMIN_TELEGRAM_ID;
    process.env.ADMIN_CHAT_ID = "999888777";
    assert.deepEqual(getAdminChatIds(), ["999888777"]);

    delete process.env.ADMIN_CHAT_ID;
    process.env.FEEDBACK_GROUP_ID = "-100123456789";
    assert.deepEqual(getAdminChatIds(), ["-100123456789"]);
  });

  await t.test("2. formatErrorMessage formats detailed Telegram HTML message", () => {
    const error = new Error("Database connection lost");
    error.statusCode = 500;
    const msg = formatErrorMessage(error, {
      location: "api/categories.js (FIFA API)",
      method: "GET",
      url: "/api/categories?type=fifa",
      user: "1234567 (@testuser)",
    });

    assert.match(msg, /KUTILMAGAN BACKEND XATOLIK/);
    assert.match(msg, /api\/categories\.js \(FIFA API\)/);
    assert.match(msg, /Database connection lost/);
    assert.match(msg, /GET \/api\/categories\?type=fifa/);
    assert.match(msg, /1234567 \(@testuser\)/);
    assert.match(msg, /Stack trace:/);
  });

  await t.test("3. reportError gracefully skips when BOT_TOKEN or ADMIN_ID missing", async () => {
    delete process.env.BOT_TOKEN;
    delete process.env.ADMIN_TELEGRAM_ID;
    delete process.env.FEEDBACK_GROUP_ID;

    const res = await reportError(new Error("Test error"));
    assert.equal(res.reported, false);
    assert.match(res.reason, /BOT_TOKEN/);
  });

  await t.test("4. reportError sends alert to Telegram and respects deduplication cooldown", async () => {
    process.env.BOT_TOKEN = "123456:FAKE_TOKEN";
    process.env.ADMIN_TELEGRAM_ID = "99887766";

    const sentRequests = [];
    const origFetch = global.fetch;
    global.fetch = async (url, options) => {
      sentRequests.push({ url, options, body: JSON.parse(options.body) });
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 101 } }),
      };
    };

    try {
      // 1-marta: Yuborilishi kerak
      const res1 = await reportError(new Error("Connection reset by peer"), {
        location: "YouTube Queue",
      });
      assert.equal(res1.reported, true);
      assert.equal(sentRequests.length, 1);
      assert.equal(sentRequests[0].body.chat_id, "99887766");
      assert.match(sentRequests[0].body.text, /Connection reset by peer/);

      // 2-marta: Bir xil xatolik tez takrorlansa (deduplication), Telegramga qayta yuborilmaydi (suppressed)
      const res2 = await reportError(new Error("Connection reset by peer"), {
        location: "YouTube Queue",
      });
      assert.equal(res2.reported, false);
      assert.equal(res2.suppressed, true);
      assert.equal(res2.count, 2);
      assert.equal(sentRequests.length, 1); // Yangi xabar yuborilmadi!
    } finally {
      global.fetch = origFetch;
    }
  });

  await t.test("5. withErrorHandler catches unexpected exceptions and returns 500 JSON", async () => {
    process.env.BOT_TOKEN = "123456:FAKE_TOKEN";
    process.env.ADMIN_TELEGRAM_ID = "99887766";

    let reportedError = null;
    const origFetch = global.fetch;
    global.fetch = async (url, options) => {
      reportedError = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true }) };
    };

    try {
      const buggyHandler = async () => {
        throw new Error("Critical crash in business logic!");
      };

      const wrapped = withErrorHandler(buggyHandler, { location: "api/test-service.js" });

      let statusSet = 0;
      let jsonPayload = null;
      const req = { url: "/api/test", method: "POST" };
      const res = {
        status(s) { statusSet = s; return this; },
        json(p) { jsonPayload = p; return this; },
      };

      await wrapped(req, res);

      assert.equal(statusSet, 500);
      assert.equal(jsonPayload.ok, false);
      assert.match(jsonPayload.error, /Critical crash/);
      assert.ok(reportedError);
      assert.match(reportedError.text, /Critical crash in business logic!/);
      assert.match(reportedError.text, /api\/test-service\.js/);
    } finally {
      global.fetch = origFetch;
    }
  });
});
