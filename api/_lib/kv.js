// Bitta umumiy Redis ulanishi va kichik "store" qatlami.
//
// Ko'p foydalanuvchi bir vaqtda o'zgartiradigan ma'lumotlar (ko'rish tarixi,
// like, izoh, playlist...) ilgari bitta katta JSON faylga (Drive katalog yoki
// R2) "o'qi -> o'zgartir -> butunini yoz" usulida saqlanardi. Ikki so'rov ustma-ust
// kelsa, keyingisi oldingisining o'zgarishini o'chirib yuborardi, har bir yozuv
// esa butun faylni qayta yuklardi. Redis'da har bir foydalanuvchi / kino o'z
// kalitiga ega va HSET/HINCRBY kabi buyruqlar atomar — ustma-ustlik yo'q.
//
// REDIS_URL / KV_URL bo'lmasa (lokal, testlar) getPersistentStore() null
// qaytaradi va chaqiruvchi eski yo'lga o'tadi; memoryStore() faqat vaqtinchalik
// holat (rate-limit, o'yinlar) uchun.

let clientPromise = null;

function redisUrl() {
  return process.env.REDIS_URL || process.env.KV_URL || "";
}

async function getRedisClient() {
  const url = redisUrl();
  if (!url) return null;
  if (clientPromise) {
    try {
      const c = await clientPromise;
      if (c?.isOpen) return c;
    } catch (_) {}
    clientPromise = null;
  }
  clientPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.warn("redis error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await clientPromise;
  } catch (_) {
    clientPromise = null;
    return null;
  }
}

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
  const store = {
    async get(k) { return alive(k)?.v ?? null; },
    async set(k, v, ttlSec) { data.set(k, { v: String(v), exp: ttlSec ? Date.now() + ttlSec * 1000 : 0 }); },
    async setNx(k, v, ttlSec) { if (alive(k)) return false; data.set(k, { v: String(v), exp: Date.now() + ttlSec * 1000 }); return true; },
    async del(k) { data.delete(k); },
    async expire(k, sec) { const e = alive(k); if (e) e.exp = Date.now() + sec * 1000; },
    async hGet(k, f) { return alive(k)?.v.get(String(f)) ?? null; },
    async hSet(k, f, v) { ensure(k, () => new Map()).set(String(f), String(v)); },
    async hSetNx(k, f, v) { const m = ensure(k, () => new Map()); if (m.has(String(f))) return false; m.set(String(f), String(v)); return true; },
    async hDel(k, f) { return alive(k)?.v.delete(String(f)) ? 1 : 0; },
    async hGetSet(k, f, v) {
      const m = ensure(k, () => new Map());
      const prev = m.get(String(f)) ?? null;
      if (v == null || v === "") m.delete(String(f)); else m.set(String(f), String(v));
      return prev;
    },
    async hLen(k) { return alive(k)?.v.size || 0; },
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
    async sIsMember(k, member) { return Boolean(alive(k)?.v.has(String(member))); },
    async sMembers(k) { return [...(alive(k)?.v || [])]; },
    async lPush(k, v) { const l = ensure(k, () => []); l.unshift(String(v)); return l.length; },
    async lRange(k, start, stop) { const l = alive(k)?.v || []; return l.slice(start, stop < 0 ? l.length + stop + 1 : stop + 1); },
    async lTrim(k, start, stop) { const e = alive(k); if (e) e.v = e.v.slice(start, stop < 0 ? e.v.length + stop + 1 : stop + 1); },
    async lRem(k, count, v) {
      const e = alive(k);
      if (!e) return 0;
      const i = e.v.indexOf(String(v));
      if (i < 0) return 0;
      e.v.splice(i, 1);
      return 1;
    },
    async lLen(k) { return (alive(k)?.v || []).length; },
    async batch(ops) {
      const out = [];
      for (const [op, ...args] of ops) out.push(await store[op](...args));
      return out;
    },
  };
  return store;
}

// store.batch() uchun: bir nechta buyruq Redis'ga bitta round-trip'da (MULTI) ketadi.
const BATCH_OPS = {
  get: (m, k) => m.get(k),
  set: (m, k, v, ttlSec) => (ttlSec ? m.set(k, String(v), { EX: ttlSec }) : m.set(k, String(v))),
  del: (m, k) => m.del(k),
  hGet: (m, k, f) => m.hGet(k, String(f)),
  hSet: (m, k, f, v) => m.hSet(k, String(f), String(v)),
  hSetNx: (m, k, f, v) => m.hSetNX(k, String(f), String(v)),
  hDel: (m, k, f) => m.hDel(k, String(f)),
  hGetAll: (m, k) => m.hGetAll(k),
  hIncrBy: (m, k, f, n) => m.hIncrBy(k, String(f), n),
  expire: (m, k, sec) => m.expire(k, sec),
  zAdd: (m, k, score, member) => m.zAdd(k, { score: Number(score), value: String(member) }),
  sAdd: (m, k, member) => m.sAdd(k, String(member)),
  sIsMember: (m, k, member) => m.sIsMember(k, String(member)),
  sMembers: (m, k) => m.sMembers(k),
  lPush: (m, k, v) => m.lPush(k, String(v)),
  lTrim: (m, k, start, stop) => m.lTrim(k, start, stop),
  lRange: (m, k, start, stop) => m.lRange(k, start, stop),
};

const HGETSET_LUA = `local prev = redis.call('HGET', KEYS[1], ARGV[1])
if ARGV[2] == '' then redis.call('HDEL', KEYS[1], ARGV[1]) else redis.call('HSET', KEYS[1], ARGV[1], ARGV[2]) end
return prev`;

function redisStore(client) {
  return {
    get: (k) => client.get(k),
    set: (k, v, ttlSec) => (ttlSec ? client.set(k, String(v), { EX: ttlSec }) : client.set(k, String(v))),
    setNx: async (k, v, ttlSec) => (await client.set(k, String(v), { NX: true, EX: ttlSec })) === "OK",
    del: (k) => client.del(k),
    expire: (k, sec) => client.expire(k, sec),
    hGet: (k, f) => client.hGet(k, String(f)),
    hSet: (k, f, v) => client.hSet(k, String(f), String(v)),
    hSetNx: async (k, f, v) => Boolean(await client.hSetNX(k, String(f), String(v))),
    hDel: (k, f) => client.hDel(k, String(f)),
    // Maydonning eski qiymatini qaytarib, yangisini yozadi (bo'sh — o'chiradi). Atomar.
    hGetSet: async (k, f, v) => {
      const prev = await client.eval(HGETSET_LUA, { keys: [k], arguments: [String(f), v == null ? "" : String(v)] });
      return prev == null || prev === false ? null : prev;
    },
    hLen: (k) => client.hLen(k),
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
    sIsMember: async (k, member) => Boolean(await client.sIsMember(k, String(member))),
    sMembers: (k) => client.sMembers(k),
    lPush: (k, v) => client.lPush(k, String(v)),
    lRange: (k, start, stop) => client.lRange(k, start, stop),
    lTrim: (k, start, stop) => client.lTrim(k, start, stop),
    lRem: (k, count, v) => client.lRem(k, count, String(v)),
    lLen: (k) => client.lLen(k),
    batch: (ops) => {
      const m = client.multi();
      for (const [op, ...args] of ops) BATCH_OPS[op](m, ...args);
      return m.exec();
    },
  };
}

// Doimiy saqlash uchun: Redis bo'lsa uning store'i, bo'lmasa null (eski yo'l).
// Testlar uchun almashtirish mumkin: _setPersistentStore(memoryStore()).
let persistentOverride;
async function getPersistentStore() {
  if (persistentOverride !== undefined) return persistentOverride;
  const client = await getRedisClient();
  return client ? redisStore(client) : null;
}

// Faqat bitta jarayon bajarishi kerak bo'lgan ish (masalan, umumiy faylni
// qayta yozish). Qulf olinmasa fn chaqirilmaydi va undefined qaytadi.
async function withLock(store, key, ttlSec, fn) {
  if (!(await store.setNx(key, "1", ttlSec))) return undefined;
  try {
    return await fn();
  } finally {
    try { await store.del(key); } catch (_) {}
  }
}

// HGETALL MULTI ichida ba'zi klient versiyalarida [k, v, k, v] massiv qaytaradi.
function hashFromReply(raw) {
  if (!raw) return {};
  if (!Array.isArray(raw)) return raw;
  const out = {};
  for (let i = 0; i + 1 < raw.length; i += 2) out[raw[i]] = raw[i + 1];
  return out;
}

module.exports = {
  getRedisClient,
  getPersistentStore,
  memoryStore,
  redisStore,
  withLock,
  hashFromReply,
  _setPersistentStore: (store) => { persistentOverride = store; },
};
