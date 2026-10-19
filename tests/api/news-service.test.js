const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const newsService = require("../../api/_lib/news-service");

describe("News Service Suite (@tezkorofficial_uz)", () => {
  test("inferCategory correctly categorizes diverse headlines", () => {
    assert.equal(newsService.inferCategory("⚡️ Shoshilinch xabar: Yangi qaror imzolandi"), "⚡ Tezkor");
    assert.equal(newsService.inferCategory("AQSH va Rossiya prezidentlari uchrashuv o'tkazdi"), "Dunyo");
    assert.equal(newsService.inferCategory("Toshkent shahrida yangi bog'cha va maktablar ochildi"), "Jamiyat");
    assert.equal(newsService.inferCategory("Markaziy bank dollar kursi va narxlarni e'lon qildi"), "Iqtisod");
    assert.equal(newsService.inferCategory("Real Madrid va Barselona o'rtasidagi futbol uchrashuvi"), "Sport");
    assert.equal(newsService.inferCategory("Apple yangi iPhone 17 seriyasini taqdim qildi"), "Texnologiya");
    assert.equal(newsService.inferCategory("Oddiy kundalik eslatma"), "Umumiy");
  });

  test("formatUzbekTime returns human-friendly relative strings", () => {
    const nowIso = new Date().toISOString();
    assert.equal(newsService.formatUzbekTime(nowIso), "Hozirgina");

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    assert.equal(newsService.formatUzbekTime(tenMinAgo), "10 daqiqa oldin");

    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    assert.equal(newsService.formatUzbekTime(threeHoursAgo), "3 soat oldin");
  });

  test("ingestWebhookPost registers a live telegram channel post", () => {
    const rawPost = {
      message_id: 99999,
      date: Math.floor(Date.now() / 1000),
      text: "⚡️ DIQQAT: Yangi xabar webhook orqali yetib keldi!\n\nBatafsil matn shu yerda.",
    };

    const ingested = newsService.ingestWebhookPost(rawPost);
    assert.ok(ingested);
    assert.equal(ingested.id, 99999);
    assert.equal(ingested.category, "⚡ Tezkor");
    assert.match(ingested.title, /Yangi xabar webhook/);
  });

  test("getNews fetches channel posts and supports searching and pagination", async () => {
    const result = await newsService.getNews({ limit: 5 });
    assert.equal(result.ok, true);
    assert.equal(result.channel, "tezkorofficial_uz");
    assert.ok(Array.isArray(result.posts));
    assert.ok(result.posts.length > 0);

    const firstPost = result.posts[0];
    assert.ok(firstPost.id > 0);
    assert.ok(firstPost.title.length > 0);
    assert.ok(firstPost.telegramUrl.includes("tezkorofficial_uz"));

    // Test search filter
    const searchRes = await newsService.getNews({ q: firstPost.title.slice(0, 5) });
    assert.equal(searchRes.ok, true);
    assert.ok(searchRes.posts.length > 0);

    // Test specific ID lookup
    const singleRes = await newsService.getNews({ id: firstPost.id });
    assert.equal(singleRes.ok, true);
    assert.equal(singleRes.post.id, firstPost.id);
  });
});
