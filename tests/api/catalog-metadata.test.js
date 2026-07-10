"use strict";

// Katalog metadata (posterlar/override'lar) wipe'dan himoya testlari.
// Stsenariy: .my-kino-metadata.json o'qish vaqtincha xato berganda
// read-modify-write oqimlari yozuvni BEKOR qilishi kerak — aks holda butun
// katalog (barcha ablojkalar) bo'sh holat bilan qayta yozilib o'chib ketadi.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const { createMockReq, createMockRes } = require("../helpers/mock-http");

const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" });

const META_FILE = {
  id: "meta-file-1",
  name: ".my-kino-metadata.json",
  mimeType: "application/json",
  modifiedTime: "2026-07-10T00:00:00Z",
};

function freshGoogleDrive() {
  delete require.cache[require.resolve("../../api/_lib/google-drive.js")];
  delete require.cache[require.resolve("../../api/_lib/watch-progress.js")];
  return require("../../api/_lib/google-drive.js");
}

function jsonResponse(payload, status = 200) {
  return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Router uslubidagi fetch stub: routes = [{ match(url, method), respond(url, init) }]
function installFetch(routes) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = String(init.method || "GET").toUpperCase();
    calls.push({ url, method, body: init.body });
    for (const route of routes) {
      if (route.match(url, method)) return route.respond(url, init);
    }
    throw new Error(`Testda kutilmagan fetch: ${method} ${url}`);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

const tokenRoute = {
  match: (url) => url.includes("oauth2.googleapis.com/token"),
  respond: () => jsonResponse({ access_token: "test-token", expires_in: 3600 }),
};

const metaSearchRoute = {
  match: (url, method) => method === "GET"
    && url.startsWith("https://www.googleapis.com/drive/v3/files?")
    && decodeURIComponent(url).includes(".my-kino-metadata.json"),
  respond: () => jsonResponse({ files: [META_FILE] }),
};

function metaMediaRoute(respond) {
  return {
    match: (url, method) => method === "GET"
      && url.includes(`/drive/v3/files/${META_FILE.id}?`)
      && url.includes("alt=media"),
    respond,
  };
}

function uploadRoute() {
  return {
    match: (url) => url.startsWith("https://www.googleapis.com/upload/drive/v3/files"),
    respond: () => jsonResponse({ ...META_FILE }),
  };
}

function uploadCalls(calls) {
  return calls.filter((c) => c.url.startsWith("https://www.googleapis.com/upload/drive/v3/files"));
}

describe("katalog metadata wipe himoyasi", () => {
  let restoreFetch = null;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.GOOGLE_DRIVE_FOLDER_ID = "folder-1";
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL = "svc@test.iam.gserviceaccount.com";
    process.env.GOOGLE_DRIVE_PRIVATE_KEY = PRIVATE_KEY_PEM;
    process.env.BOT_TOKEN = "fake-bot-token";
    // R2 ataylab sozlanmagan: zaxira yo'llari jim o'tib ketishi kerak.
    delete process.env.R2_ENDPOINT;
  });

  afterEach(() => {
    if (restoreFetch) restoreFetch();
    restoreFetch = null;
    process.env = originalEnv;
  });

  test("metadata o'qish xatosida kino tahriri bekor bo'ladi (wipe yo'q)", async () => {
    const stub = installFetch([
      tokenRoute,
      metaSearchRoute,
      metaMediaRoute(() => jsonResponse({ error: { message: "boom" } }, 500)),
      {
        // Kino faylining o'zi (getDriveFileMetadata) — muvaffaqiyatli
        match: (url, method) => method === "GET" && url.includes("/drive/v3/files/movie-a?"),
        respond: () => jsonResponse({ id: "movie-a", name: "Movie A.mp4", mimeType: "video/mp4", description: "" }),
      },
      uploadRoute(),
    ]);
    restoreFetch = stub.restore;

    const googleDrive = freshGoogleDrive();
    await assert.rejects(
      () => googleDrive.updateCatalogMovieMetadata("movie-a", { title: "Yangi nom" }),
      (error) => error.code === "CATALOG_METADATA_READ_FAILED",
    );
    assert.equal(uploadCalls(stub.calls).length, 0, "o'qish xatosida hech narsa yozilmasligi kerak");
  });

  test("metadata o'qish xatosida like/dislike ham yozuvni bekor qiladi", async () => {
    const stub = installFetch([
      tokenRoute,
      metaSearchRoute,
      metaMediaRoute(() => jsonResponse("server error", 500)),
      uploadRoute(),
    ]);
    restoreFetch = stub.restore;

    const googleDrive = freshGoogleDrive();
    await assert.rejects(
      () => googleDrive.setMovieReaction("movie-a", "user-1", "like"),
      (error) => error.code === "CATALOG_METADATA_READ_FAILED",
    );
    assert.equal(uploadCalls(stub.calls).length, 0);
  });

  test("bitta kino tahriri boshqa kinolarning posterlarini saqlab qoladi", async () => {
    const existingMetadata = {
      version: 1,
      movies: {
        "movie-b": { posterImage: "https://r2.example.com/img/poster-b.jpg", title: "Kino B" },
      },
    };
    const stub = installFetch([
      tokenRoute,
      metaSearchRoute,
      metaMediaRoute(() => jsonResponse(existingMetadata)),
      {
        match: (url, method) => method === "GET" && url.includes("/drive/v3/files/movie-a?"),
        respond: () => jsonResponse({ id: "movie-a", name: "Movie A.mp4", mimeType: "video/mp4", description: "" }),
      },
      uploadRoute(),
    ]);
    restoreFetch = stub.restore;

    const googleDrive = freshGoogleDrive();
    const saved = await googleDrive.updateCatalogMovieMetadata("movie-a", { title: "Yangi nom" });
    assert.equal(saved.override.title, "Yangi nom");

    const uploads = uploadCalls(stub.calls);
    assert.equal(uploads.length, 1);
    const uploadedBody = String(uploads[0].body);
    assert.ok(uploadedBody.includes("movie-b"), "movie-b override'i saqlanishi kerak");
    assert.ok(uploadedBody.includes("poster-b.jpg"), "movie-b posteri saqlanishi kerak");
    assert.ok(uploadedBody.includes("Yangi nom"));
  });

  test("restoreCatalogMovieOverrides revisiyalardan o'chib ketgan posterlarni yig'ib qaytaradi", async () => {
    const wipedMetadata = {
      version: 1,
      movies: { "movie-a": { reactions: { "user-1": "like" } } },
    };
    // Yangi revisiyada movie-a/b, eskisida esa faqat movie-c bor — tiklash
    // BITTA revisiya bilan cheklanmay, hammasidan yig'ishi kerak.
    const newRevision = {
      version: 1,
      movies: {
        "movie-a": { posterImage: "https://r2.example.com/img/poster-a.jpg", title: "Kino A" },
        "movie-b": { posterImage: "https://r2.example.com/img/poster-b.jpg" },
      },
      settings: { splashImageUrl: "https://r2.example.com/img/splash.jpg" },
    };
    const oldRevision = {
      version: 1,
      movies: {
        "movie-c": { posterImage: "https://r2.example.com/img/poster-c.jpg" },
      },
    };
    const stub = installFetch([
      tokenRoute,
      metaSearchRoute,
      metaMediaRoute(() => jsonResponse(wipedMetadata)),
      {
        match: (url, method) => method === "GET" && url.includes(`/files/${META_FILE.id}/revisions?`),
        respond: () => jsonResponse({
          revisions: [
            { id: "rev-old", modifiedTime: "2026-07-01T00:00:00Z" },
            { id: "rev-new", modifiedTime: "2026-07-09T00:00:00Z" },
          ],
        }),
      },
      {
        match: (url, method) => method === "GET" && url.includes(`/files/${META_FILE.id}/revisions/rev-new`),
        respond: () => jsonResponse(newRevision),
      },
      {
        match: (url, method) => method === "GET" && url.includes(`/files/${META_FILE.id}/revisions/rev-old`),
        respond: () => jsonResponse(oldRevision),
      },
      uploadRoute(),
    ]);
    restoreFetch = stub.restore;

    const googleDrive = freshGoogleDrive();
    const result = await googleDrive.restoreCatalogMovieOverrides();
    assert.equal(result.restored, 3, "uchala kino posteri ham qaytishi kerak");

    const uploads = uploadCalls(stub.calls);
    assert.equal(uploads.length, 1);
    const uploadedBody = String(uploads[0].body);
    assert.ok(uploadedBody.includes("poster-a.jpg"));
    assert.ok(uploadedBody.includes("poster-b.jpg"));
    assert.ok(uploadedBody.includes("poster-c.jpg"), "eski revisiyadagi poster ham yig'ilishi kerak");
    assert.ok(uploadedBody.includes("user-1"), "reactions saqlanib qolishi kerak");
    assert.ok(uploadedBody.includes("splash.jpg"), "bo'sh settings zaxiradan to'ldirilishi kerak");
  });

  test("watch-progress POST o'qish xatosida 502 qaytaradi va yozmaydi", async () => {
    const stub = installFetch([
      tokenRoute,
      metaSearchRoute,
      metaMediaRoute(() => jsonResponse("oops", 500)),
      uploadRoute(),
    ]);
    restoreFetch = stub.restore;

    freshGoogleDrive();
    const { handleWatchProgress } = require("../../api/_lib/watch-progress.js");
    const req = createMockReq({
      method: "POST",
      url: "/api/users?action=watch-progress",
      body: { userId: "u1", items: { "movie-a": { time: 10, duration: 100, updatedAt: Date.now() } } },
    });
    const res = createMockRes();
    await handleWatchProgress(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.ok, false);
    assert.equal(uploadCalls(stub.calls).length, 0, "xatoda katalog yozilmasligi kerak");
  });

  test("fill-only merge admin kiritgan yangi qiymatlarni buzmaydi", () => {
    const googleDrive = freshGoogleDrive();
    const { merged, filled } = googleDrive.mergeMovieOverridesFillOnly(
      {
        "movie-a": { posterImage: "https://r2.example.com/img/new-a.jpg" },
        "movie-b": { posterImage: "", title: "Kino B" },
      },
      {
        "movie-a": { posterImage: "https://r2.example.com/img/old-a.jpg" },
        "movie-b": { posterImage: "https://r2.example.com/img/old-b.jpg" },
        "movie-c": { posterImage: "https://r2.example.com/img/old-c.jpg", reactions: { u: "like" } },
      },
    );
    assert.equal(merged["movie-a"].posterImage, "https://r2.example.com/img/new-a.jpg", "yangi poster eski bilan almashmasligi kerak");
    assert.equal(merged["movie-b"].posterImage, "https://r2.example.com/img/old-b.jpg", "bo'sh poster zaxiradan to'ldiriladi");
    assert.equal(merged["movie-b"].title, "Kino B");
    assert.equal(merged["movie-c"].posterImage, "https://r2.example.com/img/old-c.jpg");
    assert.equal(merged["movie-c"].reactions, undefined, "reactions ko'chirilmaydi");
    assert.equal(filled, 2);
  });
});
