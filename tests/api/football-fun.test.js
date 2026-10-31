const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const ROOT = path.resolve(__dirname, "../..");
const TEST_BOT_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_test_token";

function initData(user) {
  const params = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) };
  const check = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(TEST_BOT_TOKEN).digest();
  const hash = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

const ALI = { id: 501, first_name: "Ali" };
const VALI = { id: 502, first_name: "Vali", last_name: "Karimov" };
const SOLI = { id: 503, first_name: "Soli" };

describe("football predictions, reminders and live reactions", () => {
  let handler;
  let fun;
  let matches;
  let sent;
  let prev;

  beforeEach(() => {
    prev = { token: process.env.BOT_TOKEN, redis: process.env.REDIS_URL, admin: process.env.ADMIN_PASSWORD };
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    process.env.ADMIN_PASSWORD = "admin-secret";
    delete process.env.REDIS_URL;
    delete process.env.KV_URL;
    for (const mod of ["../../api/_lib/auth", "../../api/_lib/football-fun", "../../api/categories"]) {
      delete require.cache[require.resolve(mod)];
    }
    fun = require("../../api/_lib/football-fun");
    handler = require("../../api/categories");
    matches = new Map();
    sent = [];
    fun._setMatchFetcher(async (leagueId, matchId) => matches.get(`${leagueId}:${matchId}`) || null);
    fun._setTelegramSender(async (chatId, text, extra) => { sent.push({ chatId, text, extra }); return true; });
  });

  afterEach(() => {
    for (const [key, value] of [["BOT_TOKEN", prev.token], ["REDIS_URL", prev.redis], ["ADMIN_PASSWORD", prev.admin]]) {
      if (value !== undefined) process.env[key] = value;
      else delete process.env[key];
    }
  });

  function addMatch(id, { kickoffMs, state = "pre", completed = false, home = null, away = null }) {
    matches.set(`eng.1:${id}`, {
      id, leagueId: "eng.1", leagueName: "Premier League", kickoffMs, state, completed, statusName: "",
      home: { name: "Chelsea", logo: "", score: home },
      away: { name: "Manchester United", logo: "", score: away },
    });
  }

  async function call(method, query, { user, body, headers = {} } = {}) {
    const res = createMockRes();
    const h = { ...headers };
    if (user) h["x-tg-init-data"] = initData(user);
    await handler(createMockReq({ method, url: `/api/categories?${query}`, headers: h, body }), res);
    return res;
  }

  const predict = (user, matchId, home, away) => call("POST", "type=fifa-predict", { user, body: { leagueId: "eng.1", matchId, home, away } });

  test("scoring: exact score 3 points, right outcome 1 point", () => {
    assert.deepEqual(fun.scorePrediction({ h: 2, a: 1 }, { h: 2, a: 1 }), { pts: 3, exact: true });
    assert.deepEqual(fun.scorePrediction({ h: 3, a: 0 }, { h: 2, a: 1 }), { pts: 1, exact: false });
    assert.deepEqual(fun.scorePrediction({ h: 1, a: 1 }, { h: 0, a: 0 }), { pts: 1, exact: false });
    assert.deepEqual(fun.scorePrediction({ h: 0, a: 1 }, { h: 2, a: 1 }), { pts: 0, exact: false });
    // Hafta Toshkent vaqti bo'yicha dushanbadan boshlanadi.
    assert.equal(fun.weekKey(Date.parse("2026-10-25T19:30:00Z")), "2026-10-26");
    assert.equal(fun.weekKey(Date.parse("2026-10-25T18:30:00Z")), "2026-10-19");
  });

  test("predictions are saved before kickoff, scored after full time and ranked weekly", async () => {
    const kickoff = Date.now() + 2 * 3600 * 1000;
    addMatch("1001", { kickoffMs: kickoff });

    assert.equal((await predict(null, "1001", 2, 1)).statusCode, 401, "needs a Telegram user");
    assert.equal((await predict(ALI, "1001", 21, 0)).statusCode, 400);
    assert.equal((await call("POST", "type=fifa-predict", { user: ALI, body: { leagueId: "../x", matchId: "1001", home: 1, away: 0 } })).statusCode, 404);

    let res = await predict(ALI, "1001", 1, 0);
    assert.equal(res.statusCode, 200);
    res = await predict(ALI, "1001", 2, 1); // o'zgartirish mumkin
    assert.deepEqual([res.body.prediction.h, res.body.prediction.a], [2, 1]);
    await predict(VALI, "1001", 3, 0);
    res = await predict(SOLI, "1001", 0, 0);
    assert.deepEqual(res.body.dist, { home: 2, draw: 1, away: 0, total: 3 });

    // Boshlangan o'yinga prognoz qabul qilinmaydi.
    addMatch("2002", { kickoffMs: Date.now() - 1000, state: "in" });
    res = await predict(ALI, "2002", 1, 1);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "LOCKED");

    res = await call("GET", "type=fifa-predict&view=mine", { user: ALI });
    const mine = res.body.predictions.find((p) => p.matchId === "1001");
    assert.equal(mine.status, "pending");
    assert.deepEqual([mine.h, mine.a, mine.home, mine.away], [2, 1, "Chelsea", "Manchester United"]);
    assert.equal(mine.dist.total, 3);
    assert.deepEqual(res.body.rules, { exact: 3, outcome: 1 });
  });

  test("settlement awards points and builds the leaderboard", async () => {
    const kickoff = Date.now() + 60 * 1000;
    addMatch("3003", { kickoffMs: kickoff });
    await predict(ALI, "3003", 2, 1);
    await predict(VALI, "3003", 3, 0);
    await predict(SOLI, "3003", 0, 2);

    // Vaqtni oldinga suramiz: o'yin 2 soat oldin boshlangan va 2:1 bilan tugagan.
    const realNow = Date.now;
    Date.now = () => realNow() + 3 * 3600 * 1000;
    try {
      addMatch("3003", { kickoffMs: kickoff, state: "post", completed: true, home: 2, away: 1 });
      const cron = await call("POST", "type=fifa-cron", { headers: { "x-admin-password": "admin-secret" } });
      assert.equal(cron.body.predictions.settled, 1);

      const board = await call("GET", "type=fifa-predict&view=leaderboard&period=all");
      assert.deepEqual(board.body.rows.map((r) => [r.rank, r.name, r.points, r.exact]), [
        [1, "Ali", 3, 1],
        [2, "Vali Karimov", 1, 0],
        [3, "Soli", 0, 0],
      ]);
      assert.ok(board.body.rows.every((r) => !("uid" in r) && !JSON.stringify(r).includes("501")), "no Telegram ids leak");
      assert.match(board.headers["Cache-Control"], /s-maxage=30/);

      const mine = await call("GET", "type=fifa-predict&view=mine", { user: VALI });
      const p = mine.body.predictions.find((x) => x.matchId === "3003");
      assert.equal(p.status, "settled");
      assert.equal(p.pts, 1);
      assert.deepEqual(p.final, { h: 2, a: 1 });
      assert.equal(mine.body.all.rank, 2);
      assert.equal(mine.body.all.points, 1);
      assert.ok(board.body.rows.some((r) => r.id === mine.body.me && r.name === "Vali Karimov"));

      // Ikkinchi marta ball berilmaydi.
      const again = await call("POST", "type=fifa-cron", { headers: { "x-admin-password": "admin-secret" } });
      assert.equal(again.body.predictions.settled, 0);
    } finally {
      Date.now = realNow;
    }
  });

  test("reminders go out once, 15 minutes before kickoff, with a button into the app", async () => {
    const kickoff = Date.now() + 30 * 60 * 1000;
    addMatch("4004", { kickoffMs: kickoff });
    assert.equal((await call("POST", "type=fifa-remind", { body: { leagueId: "eng.1", matchId: "4004" } })).statusCode, 401);

    let res = await call("POST", "type=fifa-remind", { user: ALI, body: { leagueId: "eng.1", matchId: "4004" } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.remindAt, kickoff - 15 * 60 * 1000);
    assert.deepEqual(res.body.matches, ["4004"]);
    await call("POST", "type=fifa-remind", { user: VALI, body: { leagueId: "eng.1", matchId: "4004" } });
    await call("POST", "type=fifa-remind", { user: SOLI, body: { leagueId: "eng.1", matchId: "4004" } });
    res = await call("DELETE", "type=fifa-remind", { user: SOLI, body: { leagueId: "eng.1", matchId: "4004" } });
    assert.deepEqual(res.body.matches, []);

    // Hali vaqti kelmagan.
    await call("POST", "type=fifa-cron", { headers: { "x-admin-password": "admin-secret" } });
    assert.equal(sent.length, 0);

    const realNow = Date.now;
    Date.now = () => realNow() + 16 * 60 * 1000;
    try {
      assert.equal((await call("POST", "type=fifa-cron")).statusCode, 401, "cron needs the admin key");
      await call("POST", "type=fifa-cron", { headers: { "x-admin-password": "admin-secret" } });
      await call("POST", "type=fifa-cron", { headers: { "x-admin-password": "admin-secret" } });
    } finally {
      Date.now = realNow;
    }
    assert.deepEqual(sent.map((m) => m.chatId).sort(), ["501", "502"]);
    assert.match(sent[0].text, /daqiqadan so'ng o'yin boshlanadi/);
    assert.match(sent[0].text, /Chelsea — Manchester United/);
    assert.match(sent[0].extra.reply_markup.inline_keyboard[0][0].web_app.url, /\/\?fifa=1$/);

    const mine = await call("GET", "type=fifa-remind", { user: ALI });
    assert.deepEqual(mine.body.matches, []);

    addMatch("5005", { kickoffMs: Date.now() - 1000, state: "in" });
    assert.equal((await call("POST", "type=fifa-remind", { user: ALI, body: { leagueId: "eng.1", matchId: "5005" } })).body.code, "STARTED");
  });

  test("ordinary football requests also deliver due reminders", async () => {
    addMatch("6006", { kickoffMs: Date.now() + 10 * 60 * 1000 });
    await call("POST", "type=fifa-remind", { user: ALI, body: { leagueId: "eng.1", matchId: "6006" } });
    // Tekshiruv ~20 soniyada bir marta ishlaydi.
    const realNow = Date.now;
    Date.now = () => realNow() + 21 * 1000;
    try {
      await call("GET", "type=fifa-viewers");
    } finally {
      Date.now = realNow;
    }
    assert.equal(sent.length, 1, "the reminder was already due and is sent right away");
  });

  test("live reactions: verified taps are counted per 4-second bucket and cached at the edge", async () => {
    assert.equal((await call("POST", "type=fifa-reactions", { body: { counts: { "🔥": 3 } } })).statusCode, 401);
    let res = await call("POST", "type=fifa-reactions", { user: ALI, body: { counts: { "🔥": 3, "⚽": 2, "💩": 9 } } });
    assert.equal(res.body.accepted, 5);
    res = await call("POST", "type=fifa-reactions", { user: VALI, body: { counts: { "🔥": 500 } } });
    assert.equal(res.body.accepted, 15, "a single request is capped");

    res = await call("GET", "type=fifa-reactions");
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.bucketMs, 4000);
    assert.equal(res.body.buckets.length, 6);
    const totals = {};
    for (const b of res.body.buckets) for (const [e, n] of Object.entries(b.counts)) totals[e] = (totals[e] || 0) + n;
    assert.deepEqual(totals, { "⚽": 2, "🔥": 18 });
    assert.match(res.headers["Cache-Control"], /s-maxage=3/);
  });

  test("a busy user can keep saving predictions: other requests do not use up the prediction limit", async () => {
    const auth = require("../../api/_lib/auth");
    // Ilovaning qolgan qismi: kino, sozlamalar, jonli reaksiyalar — daqiqasiga 100+ so'rov.
    for (let i = 0; i < 100; i++) {
      const res = createMockRes();
      await auth.applyRateLimit(createMockReq({ method: "GET", headers: { "x-tg-init-data": initData(ALI) } }), res);
    }
    for (let i = 0; i < 40; i++) {
      await call("POST", "type=fifa-reactions", { user: ALI, body: { counts: { "⚽": 1 } } });
    }
    for (let i = 0; i < 12; i++) {
      addMatch(String(4000 + i), { kickoffMs: Date.now() + 3600 * 1000 });
      const res = await predict(ALI, String(4000 + i), i % 4, 1);
      assert.equal(res.statusCode, 200, `prediction ${i + 1} must be accepted (${res.body?.error || ""})`);
    }
    // Bir o'yinni ko'p marta o'zgartirish ham mumkin; taqsimot buzilmaydi.
    for (let i = 0; i < 15; i++) {
      const res = await predict(ALI, "4000", i % 5, 2);
      assert.equal(res.statusCode, 200);
    }
    const last = await predict(ALI, "4000", 4, 2);
    assert.deepEqual(last.body.dist, { home: 1, draw: 0, away: 0, total: 1 });
  });

  test("the football page wires predictions, reminders and reactions", () => {
    const fun = fs.readFileSync(path.join(ROOT, "webapp/fifa/fifa-fun.js"), "utf8");
    for (const type of ["fifa-predict", "fifa-remind", "fifa-reactions"]) assert.match(fun, new RegExp(`"${type}"`));
    assert.match(fun, /data-fifa-remind/);
    const js = fs.readFileSync(path.join(ROOT, "webapp/fifa/fifa.js"), "utf8");
    assert.match(js, /window\.FifaFun\?\.bellHtml\?\.\(m\)/);
    assert.match(js, /window\.FifaFun\?\.toggleReminder\?\.\(remindBtn\)/);
    assert.match(js, /window\.FifaFun\?\.renderPredictPanel/);
    assert.match(js, /window\.FifaFun\?\.mountReactions/);
    const kino = fs.readFileSync(path.join(ROOT, "webapp/kino/kino.js"), "utf8");
    assert.match(kino, /loadScript\("\/static\/fifa\/fifa-fun\.js\?v=[^"]+"\)[\s\S]*?loadScript\("\/static\/fifa\/fifa\.js\?v=/);
    const html = fs.readFileSync(path.join(ROOT, "webapp/index.html"), "utf8");
    assert.match(html, /data-fifa-tab="predict"/);
    assert.match(html, /id="fifaPanelPredict"/);
  });
});
