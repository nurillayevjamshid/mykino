const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// Soxta Redis: podcasts.js `require("redis").createClient()` orqali ulanadi.
function installFakeRedis() {
  const store = new Map();
  const ttls = new Map();
  const client = {
    isOpen: true,
    on() {},
    async connect() {},
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async set(key, value, opts) { store.set(key, value); ttls.set(key, opts?.EX); },
    async del(keys) { [].concat(keys).forEach((k) => { store.delete(k); ttls.delete(k); }); },
  };
  // `redis` paketi o'rnatilmagan muhitda ham ishlashi uchun require'ni o'zimiz ushlaymiz.
  const Module = require("node:module");
  const originalLoad = Module._load;
  Module._load = function load(request, ...rest) {
    if (request === "redis") return { createClient: () => client };
    return originalLoad.call(this, request, ...rest);
  };
  return { store, ttls, restore: () => { Module._load = originalLoad; } };
}

const CHANNEL = {
  id: "UCtest",
  snippet: { title: "Test podcast", thumbnails: {} },
  statistics: { videoCount: "2" },
  contentDetails: { relatedPlaylists: { uploads: "UUtest" } },
};

function ytResponse(path, quotaExceeded) {
  if (quotaExceeded && path !== "channels") {
    return new Response(JSON.stringify({ error: { code: 403, message: "quota" } }), { status: 403 });
  }
  if (quotaExceeded) return new Response(JSON.stringify({ error: { code: 403 } }), { status: 403 });
  const bodies = {
    channels: { items: [CHANNEL] },
    playlistItems: { items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }] },
    videos: {
      items: ["v1", "v2"].map((id) => ({ id, snippet: { title: id }, contentDetails: { duration: "PT20M" }, statistics: {}, status: {} })),
    },
    playlists: { items: [{ id: "PL1", snippet: { title: "Seriya" }, contentDetails: { itemCount: 3 } }] },
  };
  return new Response(JSON.stringify(bodies[path]), { status: 200 });
}

describe("Podcast channel view survives YouTube quota errors", () => {
  let redis;
  let prevFetch;
  let prevEnv;
  let mode;
  let calls;
  let podcasts;

  beforeEach(() => {
    prevEnv = { REDIS_URL: process.env.REDIS_URL, YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY, BOT_TOKEN: process.env.BOT_TOKEN };
    process.env.REDIS_URL = "redis://fake";
    process.env.YOUTUBE_API_KEY = "test-key";
    delete process.env.BOT_TOKEN; // xato xabarnomasi Telegramga ketmasin
    redis = installFakeRedis();
    mode = { quota: false, channelsDown: false };
    calls = [];
    prevFetch = global.fetch;
    global.fetch = async (url) => {
      const path = new URL(url).pathname.split("/").pop();
      calls.push(path);
      if (path === "channels" && mode.channelsDown) return ytResponse(path, true);
      return ytResponse(path, mode.quota);
    };
    // Redis ulanishi umumiy kv modulida saqlanadi — har test o'z soxta Redis'ini olsin.
    delete require.cache[require.resolve("../../api/_lib/kv")];
    delete require.cache[require.resolve("../../api/_lib/podcasts")];
    podcasts = require("../../api/_lib/podcasts");
  });

  afterEach(() => {
    global.fetch = prevFetch;
    redis.restore();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  test("caches a full view for hours and keeps a last-good copy", async () => {
    const view = await podcasts.getChannelView("UCtest");
    assert.equal(view.videos.length, 2);
    assert.equal(redis.ttls.get("podcasts:view:v3:UCtest"), 6 * 60 * 60);
    assert.ok(redis.store.has("podcasts:view:last:v1:UCtest"));

    const before = calls.length;
    await podcasts.getChannelView("UCtest");
    assert.equal(calls.length, before, "fresh cache must not call YouTube again");
  });

  test("serves the last-good videos when the quota runs out and retries soon", async () => {
    await podcasts.getChannelView("UCtest");
    redis.store.delete("podcasts:view:v3:UCtest"); // kesh muddati tugadi

    mode.quota = true; // channels ishlaydi, playlistItems/playlists 403
    const view = await podcasts.getChannelView("UCtest");
    assert.deepEqual(view.videos.map((v) => v.videoId), ["v1", "v2"]);
    assert.equal(view.playlists.length, 1);
    assert.equal(redis.ttls.get("podcasts:view:v3:UCtest"), 15 * 60);
    // Chala natija oxirgi to'liq natijani bosib ketmaydi.
    assert.equal(JSON.parse(redis.store.get("podcasts:view:last:v1:UCtest")).videos.length, 2);
  });

  test("serves the last-good view when even the channel lookup fails", async () => {
    await podcasts.getChannelView("UCtest");
    redis.store.delete("podcasts:view:v3:UCtest");

    mode.channelsDown = true;
    const view = await podcasts.getChannelView("UCtest");
    assert.equal(view.channel.title, "Test podcast");
    assert.equal(view.videos.length, 2);
  });

  test("still reports the error when there is nothing cached yet", async () => {
    mode.channelsDown = true;
    await assert.rejects(() => podcasts.getChannelView("UCtest"), /YouTube API 403/);
  });
});
