const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const settingsHandler = require("../../api/settings");

describe("FIFA live stream buttons", () => {
  test("normalizes HLS .m3u8 stream links into playable stream URLs", () => {
    assert.deepEqual(settingsHandler.normalizeFifaStreamUrl("http://server.sibfungold.info:8080/live/pacha-man1/e0VaVPskUa/48687.m3u8"), {
      provider: "hls",
      url: "http://server.sibfungold.info:8080/live/pacha-man1/e0VaVPskUa/48687.m3u8",
    });
    // Foydalanuvchi yuborgan to'g'ridan-to'g'ri Xtream Codes formati:
    assert.deepEqual(settingsHandler.normalizeFifaStreamUrl("http://server.sibfungold.info:8080/pacha-man1/e0VaVPskUa/48687"), {
      provider: "hls",
      url: "http://server.sibfungold.info:8080/live/pacha-man1/e0VaVPskUa/48687.m3u8",
    });
  });

  const root = path.resolve(__dirname, "../..");
  test("normalizes YouTube Live links into playable iframe URLs", () => {
    assert.deepEqual(settingsHandler.normalizeFifaStreamUrl("https://www.youtube.com/live/BUEGXoCVl7w?si=test"), {
      provider: "youtube",
      url: "https://www.youtube-nocookie.com/embed/BUEGXoCVl7w?rel=0",
    });
  });

  test("normalizes the exact VK Sport video link into an iframe URL", () => {
    const normalized = settingsHandler.normalizeFifaStreamUrl("https://vksport.m.vkvideo.ru/video-214218677_456253161");
    assert.deepEqual(normalized, {
      provider: "vk",
      url: "https://vk.ru/video_ext.php?oid=-214218677&id=456253161",
    });
  });

  test("normalizes a VK Sport live broadcast link from the admin panel", () => {
    assert.deepEqual(settingsHandler.normalizeFifaStreamUrl("https://vksport.m.vkvideo.ru/video-221212132_456248840"), {
      provider: "vk",
      url: "https://vk.ru/video_ext.php?oid=-221212132&id=456248840",
    });
  });

  test("keeps the stream ID of VK Video Live links in the embed URL", () => {
    assert.deepEqual(settingsHandler.normalizeFifaStreamUrl("https://live.vkvideo.ru/channel34397329/stream/sl_408845"), {
      provider: "vk",
      url: "https://live.vkvideo.ru/app/embed/channel34397329/stream/sl_408845",
    });
    assert.equal(settingsHandler.normalizeFifaStreamUrl("https://live.vkvideo.ru/channel34397329").url, "https://live.vkvideo.ru/app/embed/channel34397329");
    assert.equal(
      settingsHandler.normalizeFifaStreamUrl("https://live.vkvideo.ru/app/embed/channel34397329/stream/sl_408845").url,
      "https://live.vkvideo.ru/app/embed/channel34397329/stream/sl_408845",
    );
  });

  test("re-derives the embed URL from the saved original link", () => {
    // Avval saqlangan yozuv: url eski (efir ID'siz) embed, originalUrl esa asl link.
    const [stream] = settingsHandler.normalizeFifaStreams([{
      id: "s1",
      title: "Barselona vs Real Madrid",
      url: "https://live.vkvideo.ru/app/embed/channel34397329",
      originalUrl: "https://live.vkvideo.ru/channel34397329/stream/sl_408845",
    }]);
    assert.equal(stream.url, "https://live.vkvideo.ru/app/embed/channel34397329/stream/sl_408845");
    assert.equal(stream.originalUrl, "https://live.vkvideo.ru/channel34397329/stream/sl_408845");
  });

  test("stores only the playlist URL and one https TV channel", () => {
    assert.deepEqual(settingsHandler.normalizeFifaTv(null), {
      playlistUrl: "https://iptv-org.github.io/iptv/categories/sports.m3u",
      active: null,
    });
    const tv = settingsHandler.normalizeFifaTv({
      playlistUrl: "https://example.com/list.m3u",
      active: { id: "ACISportTV.it", name: "ACI Sport TV", url: "https://example.com/aci/index.m3u8", logo: "https://example.com/aci.png", group: "Sports" },
    });
    assert.equal(tv.playlistUrl, "https://example.com/list.m3u");
    assert.equal(tv.active.url, "https://example.com/aci/index.m3u8");
    assert.equal(tv.active.name, "ACI Sport TV");
    // Mini ilova https'da — http oqim brauzerda bloklanadi, shuning uchun saqlanmaydi.
    assert.equal(settingsHandler.normalizeFifaTv({ active: { name: "X", url: "http://1.2.3.4:8080/x.m3u8" } }).active, null);
  });

  test("admin lists M3U channels with a single-on toggle and the football card shows the active one", () => {
    const adminHtml = fs.readFileSync(path.join(root, "webapp/admin/index.html"), "utf8");
    const adminJs = fs.readFileSync(path.join(root, "webapp/admin/admin.js"), "utf8");
    const fifa = fs.readFileSync(path.join(root, "webapp/fifa/fifa.js"), "utf8");
    assert.match(adminHtml, /id="fifaTvPlaylistUrl"/);
    assert.match(adminHtml, /id="fifaTvList"/);
    assert.match(adminJs, /function parseM3uPlaylist\(/);
    assert.match(adminJs, /JSON\.stringify\(\{ fifaTv: \{ playlistUrl: fifaTvState\.playlistUrl, active \} \}\)/);
    assert.match(fifa, /data\?\.fifaTv\?\.active/);
    assert.match(fifa, /autoStartLoad: false/);
  });

  test("accepts VK desktop/mobile variants and preserves extra query parameters", () => {
    for (const source of [
      "https://vk.com/video-214218677_456253161",
      "https://m.vk.com/video-214218677_456253161",
      "https://vkvideo.ru/video-214218677_456253161",
    ]) {
      assert.equal(settingsHandler.normalizeFifaStreamUrl(source).url, "https://vk.ru/video_ext.php?oid=-214218677&id=456253161");
    }
    assert.equal(
      settingsHandler.normalizeFifaStreamUrl("https://vk.com/video-214218677_456253161?hash=abc123").url,
      "https://vk.ru/video_ext.php?oid=-214218677&id=456253161&hash=abc123",
    );
  });

  test("includes the requested YouTube and VK defaults", () => {
    const settings = fs.readFileSync(path.join(root, "api/settings.js"), "utf8");
    assert.match(settings, /BUEGXoCVl7w/);
    assert.match(settings, /live\.vkvideo\.ru\/channel30008599\/stream\/sl_393740/);
    assert.match(settings, /youtube-nocookie\.com\/embed/);
    assert.match(settings, /live\.vkvideo\.ru\/app\/embed/);
  });

  test("renders football stream buttons between the hero and highlights", () => {
    const html = fs.readFileSync(path.join(root, "webapp/index.html"), "utf8");
    const fifa = fs.readFileSync(path.join(root, "webapp/fifa/fifa.js"), "utf8");
    assert.match(html, /id="fifaStreamsPromoWrap"/);
    assert.doesNotMatch(html, /data-fifa-tab="streams"/);
    assert.doesNotMatch(html, /id="fifaPanelStreams"/);
    assert.match(fifa, /async function loadFifaStreams\(/);
    assert.match(fifa, /class="fifa-vk-live-card"/);
    assert.doesNotMatch(fifa, /class="fifa-stream-button"/);
    assert.match(fifa, /target="_blank"/);
    assert.match(fifa, /class="fifa-efir-card"/);
    assert.match(fifa, /class="fifa-efir-card__frame"/);
    assert.match(fifa, /’da ochish/);
    assert.match(fifa, /streamsSignature/);
    // Telefonda VK Live embed yuklanmaydi — iframe o'rniga ochish cover'i.
    assert.match(fifa, /isVkLive && isPhone/);
    assert.match(fifa, /class="fifa-efir-card__cover"/);
  });

  test("provides admin controls for adding and saving stream links", () => {
    const html = fs.readFileSync(path.join(root, "webapp/admin/index.html"), "utf8");
    const js = fs.readFileSync(path.join(root, "webapp/admin/admin.js"), "utf8");
    assert.match(html, /id="fifaStreamsForm"/);
    assert.match(html, /id="fifaStreamsAddBtn"/);
    assert.match(html, /id="fifaStreamsSaveBtn"/);
    assert.match(js, /body: JSON\.stringify\(\{ fifaStreams: rows \}\)/);
    assert.match(js, /String\(item\.originalUrl \|\| item\.url/);
    assert.match(js, /if \(field === "url"\) fifaStreamsDraft\[i\]\.originalUrl = el\.value/);
    assert.match(js, /YouTube Live yoki VK linki/);
    assert.match(js, /video card/);
  });
});
