"use strict";

const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { createMockReq, createMockRes } = require("../helpers/mock-http");

function loadHandler() {
  delete require.cache[require.resolve("../../api/story-card.js")];
  return require("../../api/story-card.js");
}

describe("api/story-card.js", () => {
  let restoreFetch;

  afterEach(() => {
    if (restoreFetch) restoreFetch();
    restoreFetch = null;
  });

  test("OPTIONS returns 204 with CORS headers", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "OPTIONS" });
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "*");
    assert.equal(res.ended, true);
  });

  test("GET without query or unsupported method returns 405", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "PUT" });
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.body.ok, false);
  });

  test("GET proxy with invalid protocol or malformed URL returns 400", async () => {
    const handler = loadHandler();

    // Malformed URL
    const req1 = createMockReq({ method: "GET", query: { proxy: "not-a-valid-url" } });
    const res1 = createMockRes();
    await handler(req1, res1);
    assert.equal(res1.statusCode, 400);

    // Invalid protocol (file:)
    const req2 = createMockReq({ method: "GET", query: { proxy: "file:///etc/passwd" } });
    const res2 = createMockRes();
    await handler(req2, res2);
    assert.equal(res2.statusCode, 400);
  });

  test("GET proxy fetches upstream image successfully", async () => {
    const originalFetch = globalThis.fetch;
    const testBuffer = Buffer.from("fake-image-bytes");
    globalThis.fetch = async (url) => {
      if (String(url).includes("example.com")) {
        return new Response(testBuffer, {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        });
      }
      return originalFetch(url);
    };
    restoreFetch = () => { globalThis.fetch = originalFetch; };

    const handler = loadHandler();
    const req = createMockReq({ method: "GET", query: { proxy: "https://example.com/test.jpg" } });
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["Content-Type"], "image/jpeg");
    assert.deepEqual(res.body, testBuffer);
  });

  test("POST without valid image dataUrl returns 400", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "POST", body: { image: "not-a-data-url" } });
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
  });

  test("POST with valid dataUrl stores in cache and GET by ID retrieves it", async () => {
    const handler = loadHandler();
    const sampleBase64 = Buffer.from("png-image-sample").toString("base64");
    const dataUrl = `data:image/png;base64,${sampleBase64}`;

    const postReq = createMockReq({
      method: "POST",
      headers: { host: "test.mykino.uz" },
      body: { image: dataUrl, id: "test-movie" },
    });
    const postRes = createMockRes();

    await handler(postReq, postRes);
    assert.equal(postRes.statusCode, 200);
    assert.equal(postRes.body.ok, true);
    assert.ok(postRes.body.url);

    // Extract generated ID from URL
    const urlObj = new URL(postRes.body.url);
    const storyId = urlObj.searchParams.get("id");
    assert.ok(storyId);

    // Retrieve via GET ?id=<storyId>
    const getReq = createMockReq({ method: "GET", query: { id: storyId } });
    const getRes = createMockRes();
    await handler(getReq, getRes);

    assert.equal(getRes.statusCode, 200);
    assert.equal(getRes.headers["Content-Type"], "image/png");
    assert.equal(getRes.body.toString("utf8"), "png-image-sample");
  });

  test("GET with non-existent story ID returns 404", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "GET", query: { id: "non-existent-id" } });
    const res = createMockRes();

    await handler(req, res);
    assert.equal(res.statusCode, 404);
  });
});
