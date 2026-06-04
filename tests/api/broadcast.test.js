"use strict";

const { test, describe, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");

const { createMockReq, createMockRes } = require("../helpers/mock-http");

function loadHandler() {
  delete require.cache[require.resolve("../../api/broadcast.js")];
  return require("../../api/broadcast.js");
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: init.headers || { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

function installFetchStub(handlers) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const key = String(url);
    for (const [matcher, responder] of handlers) {
      if (matcher(key, init)) return responder(key, init);
    }
    return original.call(globalThis, url, init);
  };
  return () => {
    globalThis.fetch = original;
  };
}

function isTelegramSend(url) {
  return /^https:\/\/api\.telegram\.org\/bot[^/]+\/send(Message|Photo|Video)$/.test(url);
}

function isUserListUrl(url) {
  // R2 / Blob / proxy / metadata endpoints — we treat them as "user list sources".
  return /r2|blob|api\/users|metadata/.test(url) || !isTelegramSend(url);
}

describe("api/broadcast.js — auth & input validation", () => {
  let restoreFetch;
  let originalEnv;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
    restoreFetch = null;
    if (originalEnv) {
      process.env = originalEnv;
      originalEnv = null;
    }
    mock.restoreAll();
  });

  function setEnv(overrides) {
    originalEnv = { ...process.env };
    process.env = { ...process.env, ...overrides };
  }

  test("GET /api/broadcast returns 405 Method Not Allowed", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "GET", url: "/api/broadcast" });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.body.ok, false);
  });

  test("POST without body returns 400 (no text, no media)", async () => {
    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Matn yoki media/);
  });

  test("POST with wrong password returns 401", async () => {
    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "WRONG", text: "salom" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Parol/);
  });

  test("POST with text longer than 4000 chars returns 400", async () => {
    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret", text: "a".repeat(4001) },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /4000/);
  });

  test("POST without BOT_TOKEN returns 500", async () => {
    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "" });
    // Stub all user-list endpoints to return one user so we get past the empty check.
    restoreFetch = installFetchStub([
      [(url) => isUserListUrl(url), () => jsonResponse({ users: [123] })],
    ]);
    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret", text: "salom" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 500);
    assert.match(res.body.error, /BOT_TOKEN/);
  });

  test("POST with no recipients returns 400 (even with valid token)", async () => {
    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    // All user-list endpoints return empty.
    restoreFetch = installFetchStub([
      [(url) => isUserListUrl(url), () => jsonResponse({ users: [] })],
    ]);
    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret", text: "salom" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /Obunachilar/);
  });
});

describe("api/broadcast.js — happy path", () => {
  let restoreFetch;
  let originalEnv;
  let telegramCalls;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
    restoreFetch = null;
    if (originalEnv) {
      process.env = originalEnv;
      originalEnv = null;
    }
    telegramCalls = null;
    mock.restoreAll();
  });

  function setEnv(overrides) {
    originalEnv = { ...process.env };
    process.env = { ...process.env, ...overrides };
  }

  test("sends to all recipients and reports sent/failed counts", async () => {
    const googleDrive = require("../../api/_lib/google-drive");
    const blobStore = require("../../api/_lib/blob-store");
    const r2Store = require("../../api/_lib/r2-store");

    mock.method(googleDrive, "readCatalogMetadata", async () => ({ file: null, data: { users: [{ id: 111 }, { id: 222 }, { id: 333 }] } }));
    mock.method(blobStore, "readBlobJson", async () => ({ users: [{ id: 111 }, { id: 222 }, { id: 333 }] }));
    mock.method(r2Store, "getJsonFromR2Signed", async () => ({ users: [{ id: 111 }, { id: 222 }, { id: 333 }] }));

    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    telegramCalls = [];

    restoreFetch = installFetchStub([
      // User-list sources return three users total (we dedupe in the handler).
      [
        (url) => isUserListUrl(url),
        () => jsonResponse({ users: [{ id: 111 }, { id: 222 }, { id: 333 }] }),
      ],
      // Telegram sendMessage returns ok.
      [
        isTelegramSend,
        (url, init) => {
          telegramCalls.push({ url, body: JSON.parse(init.body) });
          return jsonResponse({ ok: true, result: { message_id: 1 } });
        },
      ],
    ]);

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret", text: "salom hammaga!" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200, `unexpected status: ${res.statusCode} body=${JSON.stringify(res.body)}`);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.sent, 3);
    assert.equal(res.body.failed, 0);
    assert.equal(telegramCalls.length, 3);
    // First call's chat_id is the first user in the de-duplicated list.
    assert.equal(telegramCalls[0].body.chat_id, 111);
    assert.equal(telegramCalls[0].body.text, "salom hammaga!");
  });

  test("retries on 429 and counts as sent when retry succeeds", async () => {
    const googleDrive = require("../../api/_lib/google-drive");
    const blobStore = require("../../api/_lib/blob-store");
    const r2Store = require("../../api/_lib/r2-store");

    mock.method(googleDrive, "readCatalogMetadata", async () => ({ file: null, data: { users: [{ id: 42 }] } }));
    mock.method(blobStore, "readBlobJson", async () => ({ users: [{ id: 42 }] }));
    mock.method(r2Store, "getJsonFromR2Signed", async () => ({ users: [{ id: 42 }] }));

    setEnv({ ADMIN_PASSWORD: "secret", BOT_TOKEN: "fake-token" });
    telegramCalls = [];
    let callIndex = 0;

    restoreFetch = installFetchStub([
      [(url) => isUserListUrl(url), () => jsonResponse({ users: [{ id: 42 }] })],
      [
        isTelegramSend,
        (url, init) => {
          telegramCalls.push({ url, body: JSON.parse(init.body) });
          callIndex += 1;
          // First attempt: 429. Second attempt: ok.
          if (callIndex === 1) {
            return jsonResponse(
              { ok: false, error_code: 429, parameters: { retry_after: 0 } },
              { status: 429 }
            );
          }
          return jsonResponse({ ok: true, result: { message_id: 99 } });
        },
      ],
    ]);

    const handler = loadHandler();
    const req = createMockReq({
      method: "POST",
      url: "/api/broadcast",
      body: { password: "secret", text: "retry-me" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sent, 1);
    assert.equal(res.body.failed, 0);
    assert.ok(telegramCalls.length >= 2, "should have retried at least once");
  });
});
