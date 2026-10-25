const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const settingsHandler = require("../../api/settings");

describe("FIFA live stream tab", () => {
  const root = path.resolve(__dirname, "../..");
  test("normalizes the exact VK Sport video link into an iframe URL", () => {
    const normalized = settingsHandler.normalizeFifaStreamUrl("https://vksport.m.vkvideo.ru/video-214218677_456253161");
    assert.deepEqual(normalized, {
      provider: "vk",
      url: "https://vk.ru/video_ext.php?oid=-214218677&id=456253161",
    });
  });

  test("includes the requested YouTube and VK defaults", () => {
    const settings = fs.readFileSync(path.join(root, "api/settings.js"), "utf8");
    assert.match(settings, /BUEGXoCVl7w/);
    assert.match(settings, /live\.vkvideo\.ru\/channel30008599\/stream\/sl_393740/);
    assert.match(settings, /youtube-nocookie\.com\/embed/);
    assert.match(settings, /live\.vkvideo\.ru\/app\/embed/);
    assert.match(settings, /video_ext\.php\?oid=/);
  });

  test("renders a dedicated football stream tab and panel", () => {
    const html = fs.readFileSync(path.join(root, "webapp/index.html"), "utf8");
    const fifa = fs.readFileSync(path.join(root, "webapp/fifa/fifa.js"), "utf8");
    assert.match(html, /data-fifa-tab="streams"[^>]*>Futbol stream</);
    assert.match(html, /id="fifaPanelStreams"/);
    assert.match(fifa, /async function loadFifaStreams\(\)/);
    assert.match(fifa, /class="fifa-stream-card__frame"/);
    assert.match(fifa, /tab === "streams"/);
  });

  test("provides admin controls for adding and saving stream links", () => {
    const html = fs.readFileSync(path.join(root, "webapp/admin/index.html"), "utf8");
    const js = fs.readFileSync(path.join(root, "webapp/admin/admin.js"), "utf8");
    assert.match(html, /id="fifaStreamsForm"/);
    assert.match(html, /id="fifaStreamsAddBtn"/);
    assert.match(html, /id="fifaStreamsSaveBtn"/);
    assert.match(js, /body:JSON\.stringify\(\{fifaStreams:rows\}\)/);
  });
});
