"use strict";

const { test, describe, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createMockReq, createMockRes } = require("../helpers/mock-http");

// Lazy-require the handler so each test can install fetch stubs first.
function loadHandler() {
  // Clear require cache so the handler picks up the freshly-stubbed fetch.
  delete require.cache[require.resolve("../../api/movies.js")];
  return require("../../api/movies.js");
}

// Drive returns this when listDriveMovies succeeds.
const DRIVE_MOVIES = [
  {
    id: "drive-1",
    fileId: "drive-1",
    title: "Interstellar",
    code: "INT14",
    year: 2014,
    genre: "Sci-Fi",
    rating: 8.7,
    quality: "HD",
    cdnUrl: "https://cdn.example.com/int14.mp4",
    posterImage: "https://cdn.example.com/int14.jpg",
    showInHeader: true,
  },
  {
    id: "drive-2",
    fileId: "drive-2",
    title: "The Dark Knight",
    code: "TDK08",
    year: 2008,
    genre: "Action",
    rating: 9.0,
    quality: "4K",
    cdnUrl: "https://cdn.example.com/tdk08.mp4",
  },
];

// Build a Response that matches the global fetch API.
function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: init.headers || { "Content-Type": "application/json" },
  });
}

function htmlResponse(payload, init = {}) {
  return new Response(payload, {
    status: init.status || 200,
    headers: init.headers || { "Content-Type": "text/html; charset=utf-8" },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

// Stub global fetch for the duration of a test. The matcher is a function
// (url, init) => boolean; the responder returns a Response.
function installFetchStub(matcher, responder) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (matcher(url, init)) return responder(url, init);
    // Fall through to original so e.g. nothing else surprises us.
    return original.call(globalThis, url, init);
  };
  return () => {
    globalThis.fetch = original;
  };
}

describe("api/movies.js", () => {
  let restoreFetch;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env = { ...process.env, BOT_TOKEN: "fake-token", WEBAPP_URL: "https://kino-telegram-mini-app.vercel.app" };
  });

  afterEach(() => {
    if (restoreFetch) restoreFetch();
    restoreFetch = null;
    if (originalEnv) {
      process.env = originalEnv;
      originalEnv = null;
    }
    mock.restoreAll();
  });

  test("GET /api/movies returns array and sets ETag", async () => {
    const googleDrive = require("../../api/_lib/google-drive");
    mock.method(googleDrive, "listDriveMovies", async () => DRIVE_MOVIES);

    const handler = loadHandler();
    const req = createMockReq({ method: "GET", url: "/api/movies", headers: { "x-api-key": "fake-token" } });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["ETag"], "ETag header should be set");
    assert.match(res.headers["ETag"], /^W\/"[A-Za-z0-9+/=]+"$/);
    assert.ok(Array.isArray(res.body), "response body should be an array");
    assert.equal(res.body.length, DRIVE_MOVIES.length);
    assert.equal(res.body[0].title, "Interstellar");
  });

  test("GET /api/movies returns 304 when If-None-Match matches", async () => {
    const googleDrive = require("../../api/_lib/google-drive");
    mock.method(googleDrive, "listDriveMovies", async () => DRIVE_MOVIES);

    const handler = loadHandler();
    const firstReq = createMockReq({ method: "GET", url: "/api/movies", headers: { "x-api-key": "fake-token" } });
    const firstRes = createMockRes();
    await handler(firstReq, firstRes);
    const etag = firstRes.headers["ETag"];
    assert.ok(etag);

    const secondReq = createMockReq({
      method: "GET",
      url: "/api/movies",
      headers: { "if-none-match": etag, "x-api-key": "fake-token" },
    });
    const secondRes = createMockRes();
    await handler(secondReq, secondRes);

    assert.equal(secondRes.statusCode, 304);
    assert.equal(secondRes.ended, true);
  });

  test("GET /api/movies falls back to local JSON when Drive fails", async () => {
    const googleDrive = require("../../api/_lib/google-drive");
    mock.method(googleDrive, "listDriveMovies", async () => {
      throw new Error("Drive fails");
    });

    const handler = loadHandler();
    const req = createMockReq({ method: "GET", url: "/api/movies", headers: { "x-api-key": "fake-token" } });
    const res = createMockRes();
    await handler(req, res);

    // data/movies.json is checked into the repo, so the fallback should succeed.
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body), "fallback should still return an array");
    const localPath = path.join(process.cwd(), "data", "movies.json");
    const local = JSON.parse(fs.readFileSync(localPath, "utf8"));
    assert.equal(res.body.length, local.length);
  });

  test("OPTIONS /api/movies returns 204 and CORS headers", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "OPTIONS", url: "/api/movies" });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.headers["Access-Control-Allow-Origin"], "https://kino-telegram-mini-app.vercel.app");
    assert.match(res.headers["Access-Control-Allow-Methods"], /GET/);
  });

  test("POST /api/movies returns 405 Method Not Allowed", async () => {
    const handler = loadHandler();
    const req = createMockReq({ method: "POST", url: "/api/movies", headers: { "x-api-key": "fake-token" } });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, "METHOD_NOT_ALLOWED");
  });

  test("GET /api/movies?_share=1&movie=UNKNOWN returns share HTML with default title", async () => {
    restoreFetch = installFetchStub(
      (url) => String(url).startsWith("https://www.googleapis.com/"),
      () => jsonResponse({ files: [] })
    );

    const handler = loadHandler();
    const req = createMockReq({
      method: "GET",
      url: "/api/movies?_share=1&movie=UNKNOWN",
      headers: { host: "kino-telegram-mini-app.vercel.app" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["Content-Type"], /text\/html/);
    assert.ok(typeof res.body === "string", "share page should be HTML string");
    assert.match(res.body, /MY PLAYLIST/);
    assert.match(res.body, /<meta property="og:title"/);
  });

  test("PUT /api/movies?_series=1 without id returns 400", async () => {
    const handler = loadHandler();
    const req = createMockReq({
      method: "PUT",
      url: "/api/movies?_series=1",
      headers: { "x-api-key": "fake-token" },
      body: { description: "no id here" },
    });
    const res = createMockRes();
    await handler(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.code, "MISSING_ID");
  });

  test("GET /api/movies sets Cache-Control with CDN hints on GET", async () => {
    restoreFetch = installFetchStub(
      (url) => String(url).startsWith("https://www.googleapis.com/"),
      () => jsonResponse({ files: [] })
    );

    const handler = loadHandler();
    const req = createMockReq({ method: "GET", url: "/api/movies", headers: { "x-api-key": "fake-token" } });
    const res = createMockRes();
    await handler(req, res);

    const cc = res.headers["Cache-Control"];
    assert.ok(cc, "Cache-Control should be set on GET");
    assert.equal(cc, "private, no-cache, no-store, max-age=0");
  });
});
