"use strict";

// Ko'p foydalanuvchi bir vaqtda bitta joyni o'zgartirganda hech bir yozuv
// yo'qolmasligi va umumiy fayllar (katalog, obunachilar ro'yxati) har so'rovda
// qayta yozilmasligi tekshiriladi. Redis o'rnida kv.memoryStore() ishlatiladi.

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test_token";

function initData(user) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const check = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TEST_BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const fresh = (mod) => {
  delete require.cache[require.resolve(mod)];
  return require(mod);
};

describe("concurrent writes from many users", () => {
  let kv;
  let store;
  let prevToken;
  let r2;
  let r2Writes;
  let originals;

  beforeEach(() => {
    prevToken = process.env.BOT_TOKEN;
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    kv = require("../../api/_lib/kv");
    store = kv.memoryStore();
    kv._setPersistentStore(store);
    // R2'ni xotiradagi soxta bilan almashtiramiz (har bir yozish sanaladi).
    r2 = new Map();
    r2Writes = 0;
    const r2store = require("../../api/_lib/r2-store");
    const blob = require("../../api/_lib/blob-store");
    originals = {
      strict: r2store.getJsonFromR2SignedStrict,
      put: r2store.putJsonToR2,
      blobRead: blob.readBlobJsonStrict,
      blobWrite: blob.writeBlobJson,
    };
    r2store.getJsonFromR2SignedStrict = async (key) => {
      await new Promise((r) => setImmediate(r));
      return r2.has(key) ? JSON.parse(r2.get(key)) : null;
    };
    r2store.putJsonToR2 = async (key, data) => {
      await new Promise((r) => setImmediate(r));
      r2Writes++;
      r2.set(key, JSON.stringify(data));
    };
    blob.readBlobJsonStrict = async () => null;
    blob.writeBlobJson = async () => {};
  });

  afterEach(() => {
    kv._setPersistentStore(undefined);
    const r2store = require("../../api/_lib/r2-store");
    const blob = require("../../api/_lib/blob-store");
    r2store.getJsonFromR2SignedStrict = originals.strict;
    r2store.putJsonToR2 = originals.put;
    blob.readBlobJsonStrict = originals.blobRead;
    blob.writeBlobJson = originals.blobWrite;
    if (prevToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = prevToken;
  });

  test("50 users liking the same movie at once: every like counts, catalog is not rewritten", async () => {
    const gd = fresh("../../api/_lib/google-drive");
    await store.sAdd("mr:v1:migrated", "movie-1");
    await Promise.all(Array.from({ length: 50 }, (_, i) => gd.setMovieReaction("movie-1", `u${i}`, i < 40 ? "like" : "dislike")));
    let state = await gd.getMovieReaction("movie-1", "u3");
    assert.deepEqual([state.likes, state.dislikes, state.userReaction], [40, 10, "like"]);

    // Fikrini o'zgartirish va qaytarib olish ham parallel.
    await Promise.all([
      ...Array.from({ length: 10 }, (_, i) => gd.setMovieReaction("movie-1", `u${i}`, "dislike")),
      ...Array.from({ length: 5 }, (_, i) => gd.setMovieReaction("movie-1", `u${40 + i}`, null)),
    ]);
    state = await gd.getMovieReaction("movie-1");
    assert.deepEqual([state.likes, state.dislikes], [30, 15]);

    const [listed] = await gd.overlayReactionCounts([{ id: "movie-1", likes: 0, dislikes: 0 }]);
    assert.deepEqual([listed.likes, listed.dislikes], [30, 15]);
  });

  test("30 comments posted at once on one movie are all kept", async () => {
    const gd = fresh("../../api/_lib/google-drive");
    await store.set("mc:v1:m:movie-2", "1");
    await Promise.all(Array.from({ length: 30 }, (_, i) => gd.addMovieComment("movie-2", { userId: `u${i}`, userName: `User ${i}`, text: `izoh ${i}` })));
    const list = await gd.listMovieComments("movie-2");
    assert.equal(list.total, 30);
    assert.equal(new Set(list.comments.map((c) => c.text)).size, 30);

    await gd.deleteMovieComment("movie-2", list.comments[0].id);
    assert.equal((await gd.listMovieComments("movie-2")).total, 29);
  });

  test("old comments in R2 are moved over once and still shown", async () => {
    const gd = fresh("../../api/_lib/google-drive");
    r2.set("comments/movie-3.json", JSON.stringify({ comments: [
      { id: "c_old_1", userId: "1", userName: "A", text: "eski 1", createdAt: "2026-01-01T00:00:00Z" },
      { id: "c_old_2", userId: "2", userName: "B", text: "eski 2", createdAt: "2026-01-02T00:00:00Z" },
    ] }));
    await Promise.all([gd.listMovieComments("movie-3"), gd.addMovieComment("movie-3", { userId: "3", text: "yangi" })]);
    const list = await gd.listMovieComments("movie-3");
    assert.deepEqual(list.comments.map((c) => c.text).sort(), ["eski 1", "eski 2", "yangi"]);
  });

  test("100 users opening the app at once all land in the subscriber file, written only a few times", async () => {
    const queue = fresh("../../api/_lib/users-queue");
    r2.set(queue.USERS_FILE, JSON.stringify({ users: [{ telegram_id: 1, first_name: "Eski", started_at: "2026-01-01", last_seen_at: "2026-01-01" }] }));
    await Promise.all(Array.from({ length: 100 }, async (_, i) => {
      await queue.queueUserUpsert({ telegram_id: 1000 + i, first_name: `U${i}`, started_at: "2026-10-31", last_seen_at: "2026-10-31" });
      await queue.flushPendingUsers();
    }));
    await queue.flushPendingUsers({ force: true });
    const saved = JSON.parse(r2.get(queue.USERS_FILE)).users;
    assert.equal(saved.length, 101);
    assert.equal(saved.find((u) => u.telegram_id === 1).started_at, "2026-01-01");
    assert.deepEqual(await queue.readPendingUsers(), []);
    // Asosiy fayl + kunlik zaxira: har biri ko'pi bilan bir necha marta, 100 marta emas.
    assert.ok(r2Writes <= 6, `R2 written ${r2Writes} times`);
  });

  test("watch progress from many viewers is kept per user and never rewrites the catalog", async () => {
    const gd = require("../../api/_lib/google-drive");
    const saved = { strict: gd.readCatalogMetadataStrict, write: gd.writeCatalogMetadata };
    let catalogWrites = 0;
    gd.readCatalogMetadataStrict = async () => ({ data: { watchProgress: { u0: { old: { time: 50, duration: 100, updatedAt: 1, title: "Eski" } } } }, file: {} });
    gd.writeCatalogMetadata = async () => { catalogWrites++; };
    try {
      const { handleWatchProgress } = fresh("../../api/_lib/watch-progress");
      const call = async (method, uid, body) => {
        const req = createMockReq({ method, url: "/api/watch-progress", body });
        req.verifiedTelegramUserId = uid;
        req.requireVerifiedUser = true;
        const res = createMockRes();
        await handleWatchProgress(req, res);
        return res;
      };
      await Promise.all(Array.from({ length: 40 }, (_, i) =>
        call("POST", `u${i % 10}`, { items: { [`m${i}`]: { time: i + 20, duration: 100, updatedAt: Date.now(), title: `Kino ${i}` } } })));
      const u0 = await call("GET", "u0");
      assert.deepEqual(Object.keys(u0.body.items).sort(), ["m0", "m10", "m20", "m30", "old"]);
      const u7 = await call("GET", "u7");
      assert.deepEqual(Object.keys(u7.body.items).sort(), ["m17", "m27", "m37", "m7"]);
      assert.equal(catalogWrites, 0);
    } finally {
      gd.readCatalogMetadataStrict = saved.strict;
      gd.writeCatalogMetadata = saved.write;
      fresh("../../api/_lib/watch-progress");
    }
  });

  test("playlists: users don't overwrite each other, one user's parallel adds are all kept", async () => {
    fresh("../../api/_lib/auth");
    const { handleMusicPlaylists } = fresh("../../api/_lib/music-playlists");
    const call = async (user, body) => {
      const res = createMockRes();
      await handleMusicPlaylists(createMockReq({ method: body ? "POST" : "GET", url: "/api/music.js?_playlists=1", headers: { "x-tg-init-data": initData(user) }, body }), res);
      return res;
    };
    const users = Array.from({ length: 15 }, (_, i) => ({ id: 7000 + i, first_name: `P${i}` }));
    const created = await Promise.all(users.map((u) => call(u, { action: "create", name: `Mening ${u.id}` })));
    created.forEach((r) => assert.equal(r.statusCode, 200));
    const plId = created[0].body.playlist.id;
    const tracks = Array.from({ length: 12 }, (_, i) => `track${String(i).padStart(3, "0")}`);
    const adds = await Promise.all(tracks.map((t) => call(users[0], { action: "addTrack", id: plId, trackId: t })));
    adds.forEach((r) => assert.equal(r.statusCode, 200));
    const mine = await call(users[0]);
    assert.equal(mine.body.playlists.length, 1);
    assert.deepEqual([...mine.body.playlists[0].tracks].sort(), tracks);
    for (const u of users.slice(1)) {
      const res = await call(u);
      assert.deepEqual(res.body.playlists.map((p) => p.name), [`Mening ${u.id}`]);
    }
  });

  test("playlists saved in the old shared file are kept when the user edits them", async () => {
    fresh("../../api/_lib/auth");
    const { handleMusicPlaylists } = fresh("../../api/_lib/music-playlists");
    r2.set("settings/music-playlists.json", JSON.stringify({ users: {
      8001: { pl_old: { id: "pl_old", name: "Eski", createdAt: 1, updatedAt: 1, tracks: ["trackAAA"] } },
      8002: { pl_x: { id: "pl_x", name: "Boshqa", createdAt: 1, updatedAt: 1, tracks: [] } },
    } }));
    const call = async (user, body) => {
      const res = createMockRes();
      await handleMusicPlaylists(createMockReq({ method: body ? "POST" : "GET", url: "/api/music.js?_playlists=1", headers: { "x-tg-init-data": initData(user) }, body }), res);
      return res;
    };
    const me = { id: 8001, first_name: "Old" };
    assert.deepEqual((await call(me)).body.playlists.map((p) => p.name), ["Eski"]);
    await call(me, { action: "addTrack", id: "pl_old", trackId: "trackBBB" });
    await call(me, { action: "create", name: "Yangi" });
    const after = (await call(me)).body.playlists;
    assert.deepEqual(after.map((p) => p.name).sort(), ["Eski", "Yangi"]);
    assert.deepEqual(after.find((p) => p.id === "pl_old").tracks, ["trackAAA", "trackBBB"]);
    assert.deepEqual((await call({ id: 8002, first_name: "X" })).body.playlists.map((p) => p.name), ["Boshqa"]);
  });

  test("each section has its own rate-limit counter", async () => {
    const auth = fresh("../../api/_lib/auth");
    const user = { id: 9001, first_name: "Busy" };
    const hit = async (method, url, max) => {
      const res = createMockRes();
      return auth.applyRateLimit(createMockReq({ method, url, headers: { "x-tg-init-data": initData(user) } }), res, max ? { max } : {});
    };
    // Kino ro'yxatini juda ko'p ochgan foydalanuvchi...
    for (let i = 0; i < 130; i++) await hit("GET", "/api/movies");
    assert.equal(await hit("GET", "/api/movies"), false);
    // ...ko'rish tarixi, playlist va futbolda bloklanmaydi.
    assert.equal(await hit("POST", "/api/users.js?_watch=1"), true);
    assert.equal(await hit("POST", "/api/music.js?_playlists=1", 60), true);
    assert.equal(await hit("GET", "/api/categories?type=fifa-upcoming"), true);
    // Tasodifiy ?type= bilan yangi hisoblagich ochib bo'lmaydi.
    assert.equal(auth.routeScope({ url: "/api/categories?type=abc" }), auth.routeScope({ url: "/api/categories?type=xyz" }));
  });
});
