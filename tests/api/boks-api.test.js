const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const fight = (id, title, p, d = 600) => ({ id, t: title, p, d, v: 10 });

describe("Boks API (api/_lib/boks.js)", () => {
  let boks;
  let prev;

  beforeEach(() => {
    prev = { redis: process.env.REDIS_URL, kv: process.env.KV_URL, admin: process.env.ADMIN_PASSWORD };
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;
    process.env.ADMIN_PASSWORD = "admin-secret";
    for (const mod of ["../../api/_lib/auth", "../../api/_lib/boks"]) delete require.cache[require.resolve(mod)];
    boks = require("../../api/_lib/boks");
  });

  afterEach(() => {
    for (const [key, value] of [["REDIS_URL", prev.redis], ["KV_URL", prev.kv], ["ADMIN_PASSWORD", prev.admin]]) {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    }
  });

  async function call(method, { query = {}, body = null, admin = false } = {}) {
    const req = createMockReq({ method, url: "/api/boks", query, body, headers: admin ? { "x-admin-password": "admin-secret" } : {} });
    const res = createMockRes();
    await boks.handleBoksRequest(req, res);
    return res;
  }

  test("config defaults: Taylor O'Higgins channel, seeded team, no stream", () => {
    const c = boks.normalizeConfig(null);
    assert.equal(c.channel.input, "@taylorohiggins1734");
    assert.equal(c.stream.youtubeId, "");
    assert.ok(c.team.length >= 5, "Paris-2024 champions are the starting roster");
    // Once the admin saves the team (even empty), it is authoritative
    assert.deepEqual(boks.normalizeConfig({ team: [] }).team, []);
  });

  test("config normalizes stream links, pins and team members", () => {
    const c = boks.normalizeConfig({
      stream: { url: "https://www.youtube.com/live/abcdefghijk?si=x", title: "Final", isLive: true },
      pins: ["https://youtu.be/AAAAAAAAAAA", "AAAAAAAAAAA", "bad", "BBBBBBBBBBB"],
      team: [{ name: "  Bahodir Jalolov ", result: "Olimpiada chempioni", photo: "javascript:alert(1)" }, { name: "" }],
    });
    assert.equal(c.stream.youtubeId, "abcdefghijk");
    assert.equal(c.stream.isLive, true);
    assert.deepEqual(c.pins, ["AAAAAAAAAAA", "BBBBBBBBBBB"]);
    assert.equal(c.team.length, 1);
    assert.equal(c.team[0].name, "Bahodir Jalolov");
    assert.equal(c.team[0].photo, "", "only https photos are kept");
    assert.ok(c.team[0].id);
    // isLive without a stream link makes no sense
    assert.equal(boks.normalizeConfig({ stream: { isLive: true } }).stream.isLive, false);
  });

  test("fights: shorts and clips up to 3 minutes are left out", () => {
    assert.equal(boks.isFight({ isShort: false, durationSec: 600 }), true);
    assert.equal(boks.isFight({ isShort: false, durationSec: 170 }), false, "3-minute Shorts");
    assert.equal(boks.isFight({ isShort: true, durationSec: 59 }), false);
    assert.equal(boks.isFight({ isShort: false, durationSec: 0 }), false, "upcoming live streams");
    assert.equal(boks.isoToSeconds("PT1H2M3S"), 3723);
    assert.equal(boks.isoToSeconds("P0D"), 0);
  });

  test("search ignores script, apostrophes and x/kh spelling; o'zbekiston means UZB", () => {
    const items = [
      fight("a", "Bakhodir Jalolov (UZB) vs. Richard Torrez (USA) Olympic Games 2024 Final", "2024-08-10"),
      fight("b", "Lazizbek Mullojonov (UZB) vs. Loren Alfonso (AZE) Olympic Games 2024", "2024-08-09"),
      fight("c", "Joel Ramos (BRA) vs. Gerlon Congo (ECU)", "2026-09-19"),
    ];
    const ids = (q) => boks.searchItems(items, q).map((i) => i.id);
    assert.deepEqual(ids("Жалолов"), ["a"]);
    assert.deepEqual(ids("Bahodir"), ["a"]);
    assert.deepEqual(ids("baxodir jalolov"), ["a"]);
    assert.deepEqual(ids("o'zbekiston"), ["a", "b"]);
    assert.deepEqual(ids("olympic 2024"), ["a", "b"]);
    assert.deepEqual(ids("tyson"), []);
    assert.equal(boks.searchKey("O‘zbekiston"), "ozbekiston");
  });

  test("public list: pins first in admin order, hidden fights never shown, paging", () => {
    const archive = { items: Array.from({ length: 70 }, (_, i) => fight(`v${String(i).padStart(10, "0")}`, `Fight ${i}`, `2026-01-${String(70 - i).padStart(2, "0")}`)) };
    const ids = archive.items.map((i) => i.id);
    const config = boks.normalizeConfig({ pins: [ids[40], ids[5]], hidden: [ids[0], ids[5]] });
    const page = boks.publicFights(archive, config);
    assert.deepEqual(page.pinned.map((v) => v.videoId), [ids[40]], "a hidden fight is not shown even when pinned");
    assert.ok(!page.videos.some((v) => v.videoId === ids[40]), "pinned fights are not repeated in the list");
    assert.ok(!page.videos.some((v) => v.videoId === ids[0]), "hidden fight left out");
    assert.equal(page.total, 70 - 2 - 1);
    assert.equal(page.videos.length, 30);
    assert.equal(page.nextOffset, 30);
    const last = boks.publicFights(archive, config, { offset: 60 });
    assert.equal(last.videos.length, 7);
    assert.equal(last.nextOffset, null);
    // A search covers pinned fights too
    const found = boks.publicFights(archive, config, { q: "Fight 40" });
    assert.deepEqual(found.videos.map((v) => [v.videoId, v.pinned]), [[ids[40], true]]);
  });

  test("admin list counts and filters", () => {
    const archive = { items: [fight("aaaaaaaaaaa", "A", "2026-01-03"), fight("bbbbbbbbbbb", "B", "2026-01-02"), fight("ccccccccccc", "C", "2026-01-01")] };
    const config = boks.normalizeConfig({ pins: ["bbbbbbbbbbb"], hidden: ["ccccccccccc"] });
    const all = boks.adminFights(archive, config);
    assert.deepEqual(all.counts, { all: 3, visible: 2, pinned: 1, hidden: 1 });
    assert.deepEqual(boks.adminFights(archive, config, { filter: "hidden" }).videos.map((v) => v.videoId), ["ccccccccccc"]);
    assert.deepEqual(boks.adminFights(archive, config, { filter: "pinned" }).videos.map((v) => [v.videoId, v.pinned]), [["bbbbbbbbbbb", true]]);
  });

  test("Telegram posts: promo footer and leading emoji are stripped from the card", () => {
    const post = boks.shapeNewsPost({
      id: 1,
      text: "📸Жаҳон чемпионатининг финал баҳслари\n\nБатафсил матн&#33;\n\nОБУНА БЎЛИНГ👉 BoxingUzbekistan",
      photos: ["https://cdn4.telesco.pe/a.jpg"],
      datetime: "2026-10-29T09:14:08+00:00",
      telegramUrl: "https://t.me/boxinguzbekistan/1",
    });
    assert.equal(post.title, "Жаҳон чемпионатининг финал баҳслари");
    assert.equal(post.text.includes("ОБУНА"), false);
    assert.equal(post.lead, "Батафсил матн!");
    const shared = boks.shapeNewsPost({ id: 2, text: "Natija\n\n👉 @OlympicUz\n\nolympic.uz I YouTube I Instagram" });
    assert.equal(shared.text, "Natija");
  });

  test("admin writes require the admin password; saved config is served publicly", async () => {
    const denied = await call("POST", { body: { action: "update", patch: { pins: ["AAAAAAAAAAA"] } } });
    assert.equal(denied.statusCode, 401);

    const tooMany = Array.from({ length: boks.MAX_PINS + 1 }, (_, i) => `pin${String(i).padStart(8, "0")}`);
    const rejected = await call("POST", { admin: true, body: { action: "update", patch: { pins: tooMany } } });
    assert.equal(rejected.statusCode, 400);

    const ok = await call("POST", {
      admin: true,
      body: { action: "update", patch: { stream: { url: "https://youtu.be/abcdefghijk", title: "Final", isLive: true }, team: [{ name: "Hasanboy Do'smatov", result: "Chempion" }] } },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.body.stored, false, "no Redis in tests");
    assert.equal(ok.body.config.stream.youtubeId, "abcdefghijk");
    assert.equal(ok.body.config.team.length, 1);

    const adminView = await call("GET", { query: { view: "admin" } });
    assert.equal(adminView.statusCode, 401, "admin view is not public");
  });
});
