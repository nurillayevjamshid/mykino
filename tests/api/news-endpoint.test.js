const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const newsHandler = require("../../api/news");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

describe("GET & POST /api/news HTTP Endpoint Suite", () => {
  test("OPTIONS /api/news returns 204 with CORS headers", async () => {
    const req = createMockReq({
      method: "OPTIONS",
      url: "/api/news",
      headers: { origin: "https://myplaylist.uz" },
    });
    const res = createMockRes();

    await newsHandler(req, res);
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "https://myplaylist.uz");
  });

  test("GET /api/news returns real news posts list with Cache-Control headers", async () => {
    const req = createMockReq({
      method: "GET",
      url: "/api/news?limit=4",
      query: { limit: "4" },
    });
    const res = createMockRes();

    await newsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.channel, "tezkorofficial_uz");
    assert.ok(Array.isArray(res.body.posts));
    assert.ok(res.body.posts.length <= 4);
    assert.ok(res.headers["Cache-Control"].includes("public"));
  });

  test("GET /api/news?q=... filters posts", async () => {
    const req = createMockReq({
      method: "GET",
      url: "/api/news?q=non_existent_random_phrase_xyz_999",
      query: { q: "non_existent_random_phrase_xyz_999" },
    });
    const res = createMockRes();

    await newsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(res.body.posts, []);
  });

  test("POST /api/news ingests channel post from webhook or admin", async () => {
    const testChannelPost = {
      message_id: 88888,
      date: Math.floor(Date.now() / 1000),
      text: "⚡️ TEZKOR: Vercel serverless news ingestion muvaffaqiyatli ishga tushdi!",
    };

    const req = createMockReq({
      method: "POST",
      url: "/api/news",
      body: { channelPost: testChannelPost },
    });
    const res = createMockRes();

    await newsHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.post.id, 88888);
    assert.equal(res.body.post.category, "⚡ Tezkor");
  });
});
