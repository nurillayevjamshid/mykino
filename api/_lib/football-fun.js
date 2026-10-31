// Futbol bo'limi uchun: prognoz o'yini (haftalik reyting), o'yin boshlanishidan
// 15 daqiqa oldin botdan eslatma va jonli efir paytidagi emoji reaksiyalar.
// Holat Redis'da (REDIS_URL / KV_URL), bo'lmasa xotirada (lokal va testlar).
const {
  requireVerifiedUser,
  setCorsHeaders,
  isAdminAuthorized,
  readLimitedJsonBody,
} = require("./auth");

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000; // Toshkent: UTC+5, yozgi vaqt yo'q
const REMIND_BEFORE_MS = 15 * 60 * 1000;
const SETTLE_AFTER_MS = 100 * 60 * 1000; // boshlanganidan ~100 daqiqa o'tib natija tekshiriladi
const VOID_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const REACTION_BUCKET_MS = 4000;
const REACTION_BUCKETS = 6;
const REACTION_EMOJIS = ["⚽", "🔥", "👏", "😍", "😂", "😱"];
const POINTS_EXACT = 3;
const POINTS_OUTCOME = 1;
const DAY_SEC = 24 * 60 * 60;

// ---------------- Saqlash (Redis yoki xotira) ----------------
function memoryStore() {
  const data = new Map();
  const alive = (k) => {
    const e = data.get(k);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { data.delete(k); return null; }
    return e;
  };
  const ensure = (k, make) => {
    let e = alive(k);
    if (!e) { e = { v: make(), exp: 0 }; data.set(k, e); }
    return e.v;
  };
  const zsorted = (k) => [...(alive(k)?.v || new Map()).entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  return {
    async get(k) { return alive(k)?.v ?? null; },
    async set(k, v, ttlSec) { data.set(k, { v: String(v), exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 }); },
    async setNx(k, v, ttlSec) { if (alive(k)) return false; data.set(k, { v: String(v), exp: Date.now() + ttlSec * 1000 }); return true; },
    async del(k) { data.delete(k); },
    async expire(k, sec) { const e = alive(k); if (e) e.exp = Date.now() + sec * 1000; },
    async hGet(k, f) { return alive(k)?.v.get(String(f)) ?? null; },
    async hSet(k, f, v) { ensure(k, () => new Map()).set(String(f), String(v)); },
    async hGetAll(k) { return Object.fromEntries(alive(k)?.v || []); },
    async hIncrBy(k, f, n) { const m = ensure(k, () => new Map()); const x = Number(m.get(String(f)) || 0) + n; m.set(String(f), String(x)); return x; },
    async zAdd(k, score, member) { ensure(k, () => new Map()).set(String(member), Number(score)); },
    async zIncrBy(k, n, member) { const m = ensure(k, () => new Map()); const x = (m.get(String(member)) || 0) + n; m.set(String(member), x); return x; },
    async zRem(k, member) { return alive(k)?.v.delete(String(member)) ? 1 : 0; },
    async zScore(k, member) { const v = alive(k)?.v.get(String(member)); return v == null ? null : v; },
    async zRangeByScore(k, min, max, count) { return zsorted(k).filter(([, s]) => s >= min && s <= max).slice(0, count).map(([m]) => m); },
    async zTop(k, count) { return zsorted(k).reverse().slice(0, count).map(([value, score]) => ({ value, score })); },
    async zRevRank(k, member) {
      const list = zsorted(k).reverse();
      const i = list.findIndex(([m]) => m === String(member));
      return i < 0 ? null : i;
    },
    async zCard(k) { return alive(k)?.v.size || 0; },
    async sAdd(k, member) { ensure(k, () => new Set()).add(String(member)); },
    async sRem(k, member) { alive(k)?.v.delete(String(member)); },
    async sMembers(k) { return [...(alive(k)?.v || [])]; },
    async batch(ops) {
      const out = [];
      for (const [op, ...args] of ops) out.push(await this[op](...args));
      return out;
    },
  };
}

// store.batch() uchun: bir nechta buyruq Redis'ga bitta round-trip'da (MULTI) ketadi.
const BATCH_OPS = {
  hIncrBy: (m, k, f, n) => m.hIncrBy(k, String(f), n),
  hSet: (m, k, f, v) => m.hSet(k, String(f), String(v)),
  hGetAll: (m, k) => m.hGetAll(k),
  expire: (m, k, sec) => m.expire(k, sec),
  zAdd: (m, k, score, member) => m.zAdd(k, { score: Number(score), value: String(member) }),
};

function redisStore(client) {
  return {
    get: (k) => client.get(k),
    set: (k, v, ttlSec) => (ttlSec ? client.set(k, String(v), { EX: ttlSec }) : client.set(k, String(v))),
    setNx: async (k, v, ttlSec) => (await client.set(k, String(v), { NX: true, EX: ttlSec })) === "OK",
    del: (k) => client.del(k),
    expire: (k, sec) => client.expire(k, sec),
    hGet: (k, f) => client.hGet(k, String(f)),
    hSet: (k, f, v) => client.hSet(k, String(f), String(v)),
    hGetAll: (k) => client.hGetAll(k),
    hIncrBy: (k, f, n) => client.hIncrBy(k, String(f), n),
    zAdd: (k, score, member) => client.zAdd(k, { score: Number(score), value: String(member) }),
    zIncrBy: (k, n, member) => client.zIncrBy(k, n, String(member)),
    zRem: (k, member) => client.zRem(k, String(member)),
    zScore: (k, member) => client.zScore(k, String(member)),
    zRangeByScore: (k, min, max, count) => client.zRangeByScore(k, min, max, { LIMIT: { offset: 0, count } }),
    zTop: (k, count) => client.zRangeWithScores(k, 0, count - 1, { REV: true }),
    zRevRank: (k, member) => client.zRevRank(k, String(member)),
    zCard: (k) => client.zCard(k),
    sAdd: (k, member) => client.sAdd(k, String(member)),
    sRem: (k, member) => client.sRem(k, String(member)),
    sMembers: (k) => client.sMembers(k),
    batch: (ops) => {
      const m = client.multi();
      for (const [op, ...args] of ops) BATCH_OPS[op](m, ...args);
      return m.exec();
    },
  };
}

let memory = null;
let redisPromise = null;
async function getStore() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return (memory = memory || memoryStore());
  if (redisPromise) {
    try {
      const c = await redisPromise;
      if (c?.isOpen) return redisStore(c);
    } catch (_) {}
    redisPromise = null;
  }
  redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.warn("redis (football) error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return redisStore(await redisPromise);
  } catch (_) {
    redisPromise = null;
    return (memory = memory || memoryStore());
  }
}

// ---------------- Yordamchilar ----------------
const trim = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const validLeague = (id) => /^[a-z]{2,6}\.[a-z0-9_.]{1,24}$/i.test(String(id || ""));
const validMatch = (id) => /^\d{3,12}$/.test(String(id || ""));
const outcome = (h, a) => Math.sign(h - a);

function weekKey(ms) {
  const d = new Date(ms + TASHKENT_OFFSET_MS);
  const day = (d.getUTCDay() + 6) % 7; // dushanba = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)).toISOString().slice(0, 10);
}

function scorePrediction(pred, final) {
  if (pred.h === final.h && pred.a === final.a) return { pts: POINTS_EXACT, exact: true };
  return { pts: outcome(pred.h, pred.a) === outcome(final.h, final.a) ? POINTS_OUTCOME : 0, exact: false };
}

function displayName(user) {
  const full = trim([user?.first_name, user?.last_name].filter(Boolean).join(" "), 40);
  return full || (user?.username ? trim(user.username, 40) : "Muxlis");
}

async function readBody(request) {
  return readLimitedJsonBody(request, 8 * 1024);
}

// ---------------- O'yin ma'lumoti (ESPN) ----------------
function mapEspnSummary(json, leagueId, matchId) {
  const comp = json?.header?.competitions?.[0];
  if (!comp) return null;
  const kickoffMs = Date.parse(comp.date);
  if (!Number.isFinite(kickoffMs)) return null;
  const side = (homeAway) => {
    const c = (comp.competitors || []).find((x) => x.homeAway === homeAway) || {};
    const score = c.score == null || c.score === "" ? null : Number(c.score);
    return {
      name: trim(c.team?.displayName || c.team?.shortDisplayName || c.team?.name, 60),
      logo: trim(c.team?.logos?.[0]?.href || c.team?.logo, 300),
      score: Number.isFinite(score) ? score : null,
    };
  };
  const type = comp.status?.type || {};
  return {
    id: String(matchId),
    leagueId,
    leagueName: trim(json?.header?.league?.abbreviation || json?.header?.league?.name, 60),
    kickoffMs,
    state: String(type.state || "pre").toLowerCase(),
    completed: Boolean(type.completed),
    statusName: String(type.name || ""),
    home: side("home"),
    away: side("away"),
  };
}

let matchFetcher = async (leagueId, matchId) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${ESPN_BASE}/${leagueId}/summary?event=${matchId}`, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return mapEspnSummary(await res.json(), leagueId, matchId);
  } finally {
    clearTimeout(timer);
  }
};

async function getMatch(store, leagueId, matchId, { fresh = false } = {}) {
  if (!validLeague(leagueId) || !validMatch(matchId)) return null;
  const key = `fifa:fun:match:${leagueId}:${matchId}`;
  if (!fresh) {
    const cached = await store.get(key);
    if (cached) return JSON.parse(cached);
  }
  const match = await matchFetcher(leagueId, matchId);
  if (!match || !match.home.name || !match.away.name) return null;
  const now = Date.now();
  const ttl = match.completed ? DAY_SEC : match.state === "in" || match.kickoffMs - now < 3600000 ? 60 : 600;
  await store.set(key, JSON.stringify(match), ttl);
  return match;
}

// ---------------- Prognoz o'yini ----------------
const K = {
  user: (uid) => `fifa:pred:user:${uid}`,
  match: (mid) => `fifa:pred:match:${mid}`,
  dist: (mid) => `fifa:pred:dist:${mid}`,
  pending: "fifa:pred:pending",
  lb: (period) => `fifa:pred:lb:${period}`,
  exact: (period) => `fifa:pred:exact:${period}`,
  played: (period) => `fifa:pred:played:${period}`,
  names: "fifa:pred:names",
};

function distFromHash(raw) {
  let obj = raw || {};
  if (Array.isArray(obj)) {
    const pairs = {};
    for (let i = 0; i + 1 < obj.length; i += 2) pairs[obj[i]] = obj[i + 1];
    obj = pairs;
  }
  const home = Number(obj.home || 0), draw = Number(obj.draw || 0), away = Number(obj.away || 0);
  return { home, draw, away, total: home + draw + away };
}

async function readDist(store, mid) {
  return distFromHash(await store.hGetAll(K.dist(mid)));
}

// Bir nechta o'yin taqsimotini bitta round-trip'da o'qiydi.
async function readDists(store, mids) {
  if (!mids.length) return {};
  const rows = await store.batch(mids.map((mid) => ["hGetAll", K.dist(mid)]));
  return Object.fromEntries(mids.map((mid, i) => [mid, distFromHash(rows[i])]));
}

// Natija hisoblash ESPN'ga murojaat qiladi — har GET'da emas, ~30 soniyada bir marta.
async function settlePredictionsThrottled(store) {
  if (!(await store.setNx("fifa:pred:settle:tick", "1", 30))) return null;
  return settlePredictions(store);
}

const outcomeField = (h, a) => (h > a ? "home" : h < a ? "away" : "draw");

async function savePrediction(store, user, body) {
  const leagueId = String(body?.leagueId || "");
  const matchId = String(body?.matchId || "");
  const h = Number(body?.home), a = Number(body?.away);
  if (![h, a].every((n) => Number.isInteger(n) && n >= 0 && n <= 20)) return { status: 400, error: "Hisob 0 dan 20 gacha bo'lishi kerak." };
  const match = await getMatch(store, leagueId, matchId);
  if (!match) return { status: 404, error: "O'yin topilmadi." };
  if (match.state !== "pre" || Date.now() >= match.kickoffMs) return { status: 409, code: "LOCKED", error: "O'yin boshlangan — prognoz qabul qilinmaydi." };

  const uid = String(user.id);
  const prevRaw = await store.hGet(K.user(uid), matchId);
  const prev = prevRaw ? JSON.parse(prevRaw) : null;
  // Xuddi o'sha hisob qayta yuborilsa bazaga hech narsa yozilmaydi.
  if (prev && prev.status === "pending" && prev.h === h && prev.a === a) {
    return { status: 200, prediction: prev, dist: await readDist(store, matchId) };
  }
  const record = {
    leagueId, matchId, h, a, at: Date.now(), kickoffMs: match.kickoffMs, leagueName: match.leagueName,
    home: match.home.name, away: match.away.name, homeLogo: match.home.logo, awayLogo: match.away.logo,
    status: "pending",
  };
  // Barcha yozuvlar va yangi taqsimot — bitta round-trip.
  const ops = [];
  if (prev) ops.push(["hIncrBy", K.dist(matchId), outcomeField(prev.h, prev.a), -1]);
  ops.push(
    ["hIncrBy", K.dist(matchId), outcomeField(h, a), 1],
    ["hSet", K.user(uid), matchId, JSON.stringify(record)],
    ["expire", K.user(uid), 180 * DAY_SEC],
    ["hSet", K.match(matchId), uid, `${h}:${a}`],
    ["expire", K.match(matchId), 30 * DAY_SEC],
    ["expire", K.dist(matchId), 30 * DAY_SEC],
    ["zAdd", K.pending, match.kickoffMs, `${leagueId}|${matchId}`],
    ["hSet", K.names, uid, displayName(user)],
    ["hGetAll", K.dist(matchId)],
  );
  const results = await store.batch(ops);
  return { status: 200, prediction: record, dist: distFromHash(results[results.length - 1]) };
}

// Tugagan o'yinlar bo'yicha ball beradi. Bir vaqtda faqat bitta jarayon ishlaydi.
async function settlePredictions(store, { maxMatches = 5 } = {}) {
  if (!(await store.setNx("fifa:pred:settle:lock", "1", 20))) return { settled: 0, skipped: true };
  const now = Date.now();
  const due = await store.zRangeByScore(K.pending, 0, now - SETTLE_AFTER_MS, maxMatches);
  let settled = 0;
  for (const member of due) {
    const [leagueId, matchId] = member.split("|");
    const match = await getMatch(store, leagueId, matchId, { fresh: true }).catch(() => null);
    const finished = match && match.completed && match.home.score != null && match.away.score != null;
    const dead = (match && match.state === "post" && !match.completed) || now - (match?.kickoffMs || now) > VOID_AFTER_MS || (!match && now - Number(await store.zScore(K.pending, member)) > VOID_AFTER_MS);
    if (!finished && !dead) continue;
    const final = finished ? { h: match.home.score, a: match.away.score } : null;
    const week = weekKey(match?.kickoffMs || now);
    const entries = Object.entries(await store.hGetAll(K.match(matchId)));
    for (const [uid, value] of entries) {
      const [h, a] = value.split(":").map(Number);
      const recRaw = await store.hGet(K.user(uid), matchId);
      const rec = recRaw ? JSON.parse(recRaw) : { matchId, leagueId, h, a };
      if (rec.status !== "pending") continue;
      if (final) {
        const { pts, exact } = scorePrediction({ h, a }, final);
        for (const period of [week, "all"]) {
          await store.zIncrBy(K.lb(period), pts, uid);
          await store.hIncrBy(K.played(period), uid, 1);
          if (exact) await store.hIncrBy(K.exact(period), uid, 1);
        }
        Object.assign(rec, { status: "settled", pts, exact, final });
      } else {
        Object.assign(rec, { status: "void", pts: 0 });
      }
      await store.hSet(K.user(uid), matchId, JSON.stringify(rec));
    }
    for (const period of [week, "all"]) {
      await store.expire(K.lb(period), period === "all" ? 400 * DAY_SEC : 120 * DAY_SEC);
    }
    await store.zRem(K.pending, member);
    settled++;
  }
  await store.del("fifa:pred:settle:lock");
  return { settled };
}

function periodKey(period) {
  if (period === "all") return "all";
  const now = Date.now();
  return period === "lastweek" ? weekKey(now - 7 * DAY_SEC * 1000) : weekKey(now);
}

async function leaderboard(store, period, limit = 50) {
  const key = periodKey(period);
  const top = await store.zTop(K.lb(key), limit);
  const names = await store.hGetAll(K.names);
  const exact = await store.hGetAll(K.exact(key));
  const played = await store.hGetAll(K.played(key));
  const rows = [];
  let rank = 0, prevScore = null;
  top.forEach((row, i) => {
    if (row.score !== prevScore) rank = i + 1;
    prevScore = row.score;
    rows.push({
      rank, uid: row.value, name: names[row.value] || "Muxlis", points: Number(row.score),
      exact: Number(exact[row.value] || 0), played: Number(played[row.value] || 0),
    });
  });
  return { period: key, rows };
}

async function myStanding(store, uid, period) {
  const key = periodKey(period);
  const score = await store.zScore(K.lb(key), uid);
  if (score == null) return { period: key, points: 0, rank: null, exact: 0, played: 0 };
  const rank = await store.zRevRank(K.lb(key), uid);
  return {
    period: key,
    points: Number(score),
    rank: rank == null ? null : rank + 1,
    exact: Number((await store.hGet(K.exact(key), uid)) || 0),
    played: Number((await store.hGet(K.played(key), uid)) || 0),
  };
}

async function handlePredictions(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  const view = url.searchParams.get("view") || "";
  const store = await getStore();
  if (request.method === "GET" && view === "leaderboard") {
    setCorsHeaders(request, response);
    await settlePredictionsThrottled(store).catch(() => {});
    const period = ["week", "lastweek", "all"].includes(url.searchParams.get("period")) ? url.searchParams.get("period") : "week";
    const board = await leaderboard(store, period);
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
    // Reytingda Telegram ID ko'rsatilmaydi.
    return response.status(200).json({ ok: true, ...board, rows: board.rows.map(({ uid, ...row }) => ({ ...row, id: hashId(uid) })) });
  }

  // Prognozning o'z hisoblagichi bor: ilovaning boshqa so'rovlari (kino, jonli
  // reaksiyalar...) unga ta'sir qilmaydi. 120/daqiqa — odam yetolmaydi, faqat botni to'xtatadi.
  const user = await requireVerifiedUser(request, response, {
    rateLimit: { scope: request.method === "GET" ? "fifa-predict-r" : "fifa-predict-w", max: 120 },
  });
  if (!user) return;
  response.setHeader("Cache-Control", "no-store, max-age=0");
  const uid = String(request.verifiedUserId);
  try {
    if (request.method === "GET") {
      await settlePredictionsThrottled(store).catch(() => {});
      const all = Object.values(await store.hGetAll(K.user(uid))).map((v) => JSON.parse(v));
      all.sort((x, y) => y.kickoffMs - x.kickoffMs);
      const list = all.slice(0, 60);
      const dists = await readDists(store, list.filter((p) => p.status === "pending").map((p) => p.matchId));
      return response.status(200).json({
        ok: true,
        me: hashId(uid),
        predictions: list.map((p) => ({ ...p, dist: dists[p.matchId] || null })),
        week: await myStanding(store, uid, "week"),
        all: await myStanding(store, uid, "all"),
        rules: { exact: POINTS_EXACT, outcome: POINTS_OUTCOME },
      });
    }
    if (request.method === "POST") {
      const out = await savePrediction(store, user, await readBody(request));
      if (out.error) return response.status(out.status).json({ ok: false, code: out.code, error: out.error });
      return response.status(200).json({ ok: true, prediction: out.prediction, dist: out.dist });
    }
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    return response.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? "So'rov noto'g'ri." : "Server xatosi." });
  }
}

// Reytingda o'zini topish uchun barqaror, lekin Telegram ID'ni oshkor qilmaydigan belgi.
function hashId(uid) {
  return require("node:crypto").createHash("sha256").update(`fifa-pred:${uid}`).digest("hex").slice(0, 12);
}

// ---------------- Eslatmalar ----------------
const R = {
  due: "fifa:remind:due",
  user: (uid) => `fifa:remind:user:${uid}`,
  info: (mid) => `fifa:remind:info:${mid}`,
};

let telegramSender = async (chatId, text, extra) => {
  const token = process.env.BOT_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
  });
  return res.ok;
};

function webappUrl() {
  return String(process.env.WEBAPP_URL || "https://www.myplaylist.uz").trim().replace(/\/+$/, "");
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function kickoffClock(ms) {
  const d = new Date(ms + TASHKENT_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function reminderText(info, now = Date.now()) {
  const mins = Math.max(1, Math.round((info.kickoffMs - now) / 60000));
  return [
    `⏰ <b>${mins} daqiqadan so'ng o'yin boshlanadi!</b>`,
    "",
    `⚽ <b>${escapeHtml(info.home)} — ${escapeHtml(info.away)}</b>`,
    `🏆 ${escapeHtml(info.leagueName || "Futbol")} · 🕒 ${kickoffClock(info.kickoffMs)} (Toshkent)`,
    "",
    "Prognozingizni qoldirishga ulguring va jonli natijalarni kuzating 👇",
  ].join("\n");
}

async function addReminder(store, uid, body) {
  const leagueId = String(body?.leagueId || "");
  const matchId = String(body?.matchId || "");
  const match = await getMatch(store, leagueId, matchId);
  if (!match) return { status: 404, error: "O'yin topilmadi." };
  const now = Date.now();
  if (match.state !== "pre" || match.kickoffMs <= now) return { status: 409, code: "STARTED", error: "O'yin allaqachon boshlangan." };
  const info = { home: match.home.name, away: match.away.name, leagueName: match.leagueName, kickoffMs: match.kickoffMs };
  await store.set(R.info(matchId), JSON.stringify(info), 14 * DAY_SEC);
  await store.zAdd(R.due, Math.max(now, match.kickoffMs - REMIND_BEFORE_MS), `${uid}|${leagueId}|${matchId}`);
  await store.sAdd(R.user(uid), matchId);
  await store.expire(R.user(uid), 14 * DAY_SEC);
  return { status: 200, remindAt: Math.max(now, match.kickoffMs - REMIND_BEFORE_MS) };
}

async function removeReminder(store, uid, body) {
  const leagueId = String(body?.leagueId || "");
  const matchId = String(body?.matchId || "");
  await store.zRem(R.due, `${uid}|${leagueId}|${matchId}`);
  await store.sRem(R.user(uid), matchId);
  return { status: 200 };
}

// Vaqti kelgan eslatmalarni yuboradi. Har bir eslatma faqat bir marta ketadi:
// ro'yxatdan o'chirishga muvaffaq bo'lgan jarayongina uni yuboradi.
async function sendDueReminders(store, { aheadMs = 0, limit = 120 } = {}) {
  const now = Date.now();
  const due = await store.zRangeByScore(R.due, 0, now + aheadMs, limit);
  let sent = 0;
  const jobs = [];
  for (const member of due) {
    if (Number(await store.zRem(R.due, member)) !== 1) continue;
    const [uid, , matchId] = member.split("|");
    await store.sRem(R.user(uid), matchId);
    const infoRaw = await store.get(R.info(matchId));
    if (!infoRaw) continue;
    const info = JSON.parse(infoRaw);
    if (info.kickoffMs < now - 5 * 60 * 1000) continue; // juda kech — yubormaymiz
    jobs.push(async () => {
      const ok = await telegramSender(uid, reminderText(info, now), {
        reply_markup: { inline_keyboard: [[{ text: "⚽ Futbol bo'limini ochish", web_app: { url: `${webappUrl()}/?fifa=1` } }]] },
      }).catch(() => false);
      if (ok) sent++;
    });
  }
  // Telegram cheklovi (~30 xabar/soniya) ichida qolish uchun bo'laklab yuboramiz.
  for (let i = 0; i < jobs.length; i += 25) {
    await Promise.all(jobs.slice(i, i + 25).map((job) => job()));
    if (i + 25 < jobs.length) await new Promise((r) => setTimeout(r, 1000));
  }
  return { due: due.length, sent };
}

async function handleReminders(request, response) {
  const user = await requireVerifiedUser(request, response, { rateLimit: { scope: "fifa-remind", max: 120 } });
  if (!user) return;
  response.setHeader("Cache-Control", "no-store, max-age=0");
  const uid = String(request.verifiedUserId);
  const store = await getStore();
  try {
    if (request.method === "GET") {
      return response.status(200).json({ ok: true, matches: await store.sMembers(R.user(uid)) });
    }
    if (request.method === "POST" || request.method === "DELETE") {
      const body = await readBody(request);
      const out = request.method === "POST" ? await addReminder(store, uid, body) : await removeReminder(store, uid, body);
      if (out.error) return response.status(out.status).json({ ok: false, code: out.code, error: out.error });
      return response.status(200).json({ ok: true, remindAt: out.remindAt || null, matches: await store.sMembers(R.user(uid)) });
    }
    return response.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    return response.status(err.statusCode || 500).json({ ok: false, error: err.statusCode ? "So'rov noto'g'ri." : "Server xatosi." });
  }
}

// ---------------- Jonli reaksiyalar ----------------
// Vaqt 4 soniyalik bo'laklarga bo'linadi; har bo'lakda har bir emoji soni saqlanadi.
// GET javobi CDN'da 3 soniya keshlanadi — tomoshabin ko'p bo'lsa ham server yuklanmaydi.
const reactionKey = (bucket) => `fifa:react:${bucket}`;

async function handleReactions(request, response) {
  const store = await getStore();
  if (request.method === "GET") {
    setCorsHeaders(request, response);
    const now = Date.now();
    const current = Math.floor(now / REACTION_BUCKET_MS);
    const buckets = [];
    for (let b = current - REACTION_BUCKETS + 1; b <= current; b++) {
      const raw = await store.hGetAll(reactionKey(b));
      const counts = {};
      for (const e of REACTION_EMOJIS) if (Number(raw[e]) > 0) counts[e] = Number(raw[e]);
      buckets.push({ b, counts });
    }
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=3, stale-while-revalidate=3");
    return response.status(200).json({ ok: true, now, bucketMs: REACTION_BUCKET_MS, emojis: REACTION_EMOJIS, buckets });
  }
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed." });
  // Sonni sun'iy ko'paytirib bo'lmasin — faqat tasdiqlangan Telegram foydalanuvchisi.
  // Jonli efirda har ~2s yuboriladi — o'z hisoblagichi, prognozga xalaqit bermaydi.
  const user = await requireVerifiedUser(request, response, { rateLimit: { scope: "fifa-react", max: 90 } });
  if (!user) return;
  response.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const body = await readBody(request);
    const bucket = Math.floor(Date.now() / REACTION_BUCKET_MS);
    let total = 0;
    for (const e of REACTION_EMOJIS) {
      const n = Math.min(15, Math.max(0, Math.floor(Number(body?.counts?.[e]) || 0)));
      if (!n || total + n > 30) continue;
      total += n;
      await store.hIncrBy(reactionKey(bucket), e, n);
    }
    if (total) await store.expire(reactionKey(bucket), 60);
    return response.status(200).json({ ok: true, accepted: total });
  } catch (err) {
    return response.status(err.statusCode || 400).json({ ok: false, error: "So'rov noto'g'ri." });
  }
}

// ---------------- Fon ishlari ----------------
// GitHub Actions har 5 daqiqada chaqiradi (admin kaliti bilan). Bundan tashqari
// futbol bo'limiga kelgan oddiy so'rovlar ham ~20 soniyada bir marta tekshiradi,
// shunda eslatmalar o'z vaqtida ketadi.
async function runFootballJobs({ opportunistic = false } = {}) {
  const store = await getStore();
  if (opportunistic && !(await store.setNx("fifa:jobs:tick", "1", 20))) return null;
  const reminders = await sendDueReminders(store, { aheadMs: opportunistic ? 60 * 1000 : 4 * 60 * 1000, limit: opportunistic ? 60 : 300 });
  // Natijalarni tekshirish ESPN'ga murojaat qiladi — oddiy so'rovni sekinlashtirmaslik
  // uchun faqat cron'da (va prognoz sahifasi ochilganda) bajariladi.
  const predictions = opportunistic ? null : await settlePredictions(store, { maxMatches: 10 });
  return { reminders, predictions };
}

async function handleFootballCron(request, response) {
  setCorsHeaders(request, response);
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (!isAdminAuthorized(request)) return response.status(401).json({ ok: false, error: "Ruxsat yo'q." });
  const result = await runFootballJobs();
  return response.status(200).json({ ok: true, ...result });
}

module.exports = {
  handlePredictions,
  handleReminders,
  handleReactions,
  handleFootballCron,
  runFootballJobs,
  scorePrediction,
  weekKey,
  mapEspnSummary,
  reminderText,
  REACTION_EMOJIS,
  _setMatchFetcher: (fn) => { matchFetcher = fn; },
  _setTelegramSender: (fn) => { telegramSender = fn; },
  _resetMemory: () => { memory = null; },
};
