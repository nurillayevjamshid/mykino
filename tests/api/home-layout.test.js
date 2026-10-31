const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const read = (...parts) => fs.readFileSync(path.resolve(__dirname, "../..", ...parts), "utf8").replace(/\r\n/g, "\n");

describe("Home layout API (api/_lib/home-layout.js)", () => {
  let home;
  let prev;

  beforeEach(() => {
    prev = { redis: process.env.REDIS_URL, kv: process.env.KV_URL, admin: process.env.ADMIN_PASSWORD };
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;
    process.env.ADMIN_PASSWORD = "admin-secret";
    for (const mod of ["../../api/_lib/auth", "../../api/_lib/home-layout"]) delete require.cache[require.resolve(mod)];
    home = require("../../api/_lib/home-layout");
  });

  afterEach(() => {
    for (const [key, value] of [["REDIS_URL", prev.redis], ["KV_URL", prev.kv], ["ADMIN_PASSWORD", prev.admin]]) {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    }
  });

  async function call(method, { body = null, admin = false } = {}) {
    const req = createMockReq({ method, url: "/api/home", query: {}, body, headers: admin ? { "x-admin-password": "admin-secret" } : {} });
    const res = createMockRes();
    await home.handleHomeLayoutRequest(req, res);
    return res;
  }

  test("defaults mirror what the mini app shows today", () => {
    const layout = home.normalizeLayout(null);
    assert.deepEqual(layout.sections.map((s) => s.id), ["kino", "fifa", "boks", "music", "podcasts", "favorites", "esports", "tv"]);
    assert.deepEqual(layout.sections.filter((s) => !s.enabled).map((s) => s.id), ["esports", "tv"]);
    assert.equal(layout.sections[0].size, "l");
    assert.deepEqual(layout.hero, { mode: "auto", movieId: "" });
    assert.equal(layout.greeting, "Xayrli kun, {ism}");
  });

  test("keeps the saved order, drops unknown and duplicate sections, appends missing ones", () => {
    const layout = home.normalizeLayout({
      sections: [
        { id: "boks", size: "l", enabled: true },
        { id: "hack", size: "l", enabled: true },
        { id: "kino", size: "xl", enabled: "yes" },
        { id: "boks", size: "s", enabled: false },
      ],
    });
    const ids = layout.sections.map((s) => s.id);
    assert.deepEqual(ids.slice(0, 2), ["boks", "kino"]);
    assert.equal(ids.length, home.SECTIONS.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(layout.sections[0].size, "l");
    // Noto'g'ri qiymatlar standartga qaytadi
    assert.equal(layout.sections[1].size, "l");
    assert.equal(layout.sections[1].enabled, true);
  });

  test("manual hero without a movie falls back to auto; greeting is trimmed and capped", () => {
    assert.deepEqual(home.normalizeLayout({ hero: { mode: "manual" } }).hero, { mode: "auto", movieId: "" });
    assert.deepEqual(home.normalizeLayout({ hero: { mode: "manual", movieId: " abc " } }).hero, { mode: "manual", movieId: "abc" });
    assert.deepEqual(home.normalizeLayout({ hero: { mode: "auto", movieId: "abc" } }).hero, { mode: "auto", movieId: "" });
    assert.equal(home.normalizeLayout({ greeting: "  Salom,   {ism}  " }).greeting, "Salom, {ism}");
    assert.equal(home.normalizeLayout({ greeting: "x".repeat(200) }).greeting.length, 80);
    assert.equal(home.normalizeLayout({ greeting: "" }).greeting, "");
  });

  test("GET is public, POST needs the admin password", async () => {
    const get = await call("GET");
    assert.equal(get.statusCode, 200);
    assert.equal(get.body.ok, true);
    assert.equal(get.body.layout.sections.length, home.SECTIONS.length);

    const denied = await call("POST", { body: { action: "update", layout: {} } });
    assert.equal(denied.statusCode, 401);
  });

  test("admin update is normalized, stored in memory without Redis and read back", async () => {
    const res = await call("POST", {
      admin: true,
      body: { action: "update", layout: { sections: [{ id: "tv", size: "m", enabled: true }], greeting: "Salom" } },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stored, false, "no Redis in tests — the change is only kept in memory");
    assert.equal(res.body.layout.sections[0].id, "tv");
    assert.ok(res.body.layout.updatedAt > 0);

    const get = await call("GET");
    assert.equal(get.body.layout.sections[0].id, "tv");
    assert.equal(get.body.layout.greeting, "Salom");
  });

  test("rejects an update without a layout and unknown actions", async () => {
    assert.equal((await call("POST", { admin: true, body: { action: "update" } })).statusCode, 400);
    assert.equal((await call("POST", { admin: true, body: { action: "wipe", layout: {} } })).statusCode, 400);
  });

  test("/api/home is routed through the music.js delegator (no new Vercel function)", () => {
    const vercel = JSON.parse(read("vercel.json"));
    assert.ok(vercel.routes.some((r) => r.src === "/api/home" && r.dest === "/api/music.js?_home=1"));
    assert.match(read("api", "music.js"), /request\.query\?\._home\) \{\s*await handleHomeLayoutRequest\(request, response\);/);
  });
});

describe("Admin hub (no sidebar)", () => {
  const html = read("webapp", "admin", "index.html");
  const js = read("webapp", "admin", "admin.js");

  test("the sidebar is gone and the hub is the section shown first", () => {
    assert.doesNotMatch(html, /<aside class="sidebar"/);
    assert.doesNotMatch(html, /id="menuToggle"/);
    assert.match(html, /<section class="content-section active hub" id="hubSection">/);
    assert.match(js, /switchSection\('hub'\);\n\}/, "init() always opens the hub");
    assert.doesNotMatch(js, /localStorage\.getItem\('admin-section'\)/);
  });

  test("every admin section has a hub tile and a section to open", () => {
    const sections = [...js.matchAll(/^\s{4}(\w+): '(\w+Section)',$/gm)].map((m) => m[1]).filter((n) => n !== "hub");
    assert.ok(sections.length >= 10);
    for (const name of sections) {
      assert.match(html, new RegExp(`data-hub-target="${name}"`), `hub tile for ${name}`);
    }
  });

  test("the home layout section is wired to its script and loads on open", () => {
    assert.match(html, /<section class="content-section hl" id="homeLayoutSection">/);
    assert.match(html, /<script src="\/admin\/admin-home\.js\?v=/);
    assert.match(js, /if \(name === 'homeLayout'\) window\.homeLayoutAdmin\?\.load\(\);/);
  });
});
