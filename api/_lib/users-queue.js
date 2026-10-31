// Obunachilar ro'yxatini yozish navbati.
//
// Ro'yxat R2'dagi bitta faylda (settings/bot-users.json) turadi — broadcast,
// admin panel va zaxira nusxalar uni o'qiydi. Ilgari Mini App har ochilganda va
// har /start da shu faylni to'liq o'qib, bitta foydalanuvchini qo'shib, butunini
// qayta yozardi: bir vaqtda kirgan foydalanuvchilar bir-birining yozuvini
// o'chirib yuborardi (yangi obunachilar yo'qolardi), har kirish esa butun
// ro'yxatni yuklardi.
//
// Endi: so'rov faqat Redis'dagi navbatga (hash: telegram_id -> yozuv) bitta HSET
// qiladi. Faylni esa qulf (lock) olgan BITTA jarayon, yig'ilgan hamma yozuvlarni
// birga qo'shib, bir marta yozadi (eng ko'pi bilan ~15 soniyada bir marta).
// O'quvchilar (admin, broadcast) avval navbatni faylga tushiradi va ishlay
// olmasa navbatdagilarni ham qo'shib o'qiydi — hech kim tushib qolmaydi.
const kv = require("./kv");
const { getJsonFromR2SignedStrict, putJsonToR2 } = require("./r2-store");
const { readBlobJsonStrict, writeBlobJson } = require("./blob-store");

const USERS_FILE = "settings/bot-users.json";
const PENDING = "users:v1:pending";
const LOCK = "users:v1:flush:lock";
const TICK = "users:v1:flush:tick";
const FLUSH_EVERY_SEC = 15;

function backupKey(date = new Date()) {
  return `settings/bot-users-backup-${date.toISOString().slice(0, 10)}.json`;
}

// Saqlashga arziydigan maydonlar o'zgarmagan bo'lsa fayl qayta yozilmaydi.
function sameUser(a, b) {
  if (!a || !b) return false;
  return ["telegram_id", "username", "first_name", "last_name", "started_at", "last_seen_at"]
    .every((k) => String(a[k] ?? "") === String(b[k] ?? ""));
}

function mergeUser(prev, rec) {
  return {
    ...(prev || {}),
    ...rec,
    started_at: prev?.started_at || rec.started_at,
    last_name: rec.last_name || prev?.last_name || "",
  };
}

// Navbatdagi yozuvlarni ro'yxatga qo'shadi. Natija: { list, changed, added }.
function applyPending(list, pending) {
  const out = Array.isArray(list) ? list.slice() : [];
  const index = new Map(out.map((u, i) => [String(u?.telegram_id), i]));
  let changed = false;
  let added = 0;
  for (const rec of pending) {
    const key = String(rec.telegram_id);
    const i = index.get(key);
    const prev = i == null ? null : out[i];
    const merged = mergeUser(prev, rec);
    if (prev && sameUser(prev, merged)) continue;
    changed = true;
    if (i == null) {
      index.set(key, out.length);
      out.push(merged);
      added++;
    } else {
      out[i] = merged;
    }
  }
  if (changed) out.sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
  return { list: out, changed, added };
}

// Redis yo'q bo'lsa false — chaqiruvchi eski yo'l bilan yozadi.
async function queueUserUpsert(record) {
  if (!record?.telegram_id) return false;
  const store = await kv.getPersistentStore();
  if (!store) return false;
  await store.hSet(PENDING, String(record.telegram_id), JSON.stringify(record));
  return true;
}

async function readPendingUsers() {
  const store = await kv.getPersistentStore();
  if (!store) return [];
  return Object.values(await store.hGetAll(PENDING))
    .map((raw) => { try { return JSON.parse(raw); } catch { return null; } })
    .filter((u) => u && u.telegram_id);
}

// force=false — so'rov yo'lida: ~15 soniyada bir martadan ko'p emas.
// force=true — o'quvchilar oldidan (admin, broadcast).
async function flushPendingUsers({ force = false } = {}) {
  const store = await kv.getPersistentStore();
  if (!store) return null;
  if (!force && !(await store.setNx(TICK, "1", FLUSH_EVERY_SEC))) return null;
  return kv.withLock(store, LOCK, 60, async () => {
    const raw = await store.hGetAll(PENDING);
    const entries = Object.entries(raw || {});
    if (!entries.length) return { flushed: 0 };
    const pending = entries
      .map(([, v]) => { try { return JSON.parse(v); } catch { return null; } })
      .filter((u) => u && u.telegram_id);

    // Strict o'qish: xato "bo'sh fayl" deb qabul qilinsa, yozuv butun ro'yxatni
    // o'chirib yuborardi. Xato bo'lsa navbat saqlanib qoladi, keyin qayta urinamiz.
    const data = (await getJsonFromR2SignedStrict(USERS_FILE)) || { users: [] };
    const result = applyPending(Array.isArray(data.users) ? data.users : [], pending);
    if (result.changed) {
      const payload = { users: result.list, updatedAt: new Date().toISOString() };
      await putJsonToR2(USERS_FILE, payload);
      if (result.added) {
        try { await putJsonToR2(backupKey(), payload); } catch (_) {}
      }
    }
    // Vercel Blob — eski zaxira, best-effort.
    try {
      const blob = (await readBlobJsonStrict(USERS_FILE)) || { users: [] };
      const blobResult = applyPending(Array.isArray(blob.users) ? blob.users : [], pending);
      if (blobResult.changed) await writeBlobJson(USERS_FILE, { users: blobResult.list, updatedAt: new Date().toISOString() });
    } catch (_) {}

    // Faylga tushganlarini navbatdan olib tashlaymiz; shu orada yangilangani qoladi.
    const current = await store.batch(entries.map(([id]) => ["hGet", PENDING, id]));
    const drop = entries.filter(([, v], i) => current[i] === v).map(([id]) => ["hDel", PENDING, id]);
    if (drop.length) await store.batch(drop);
    return { flushed: drop.length, added: result.added };
  });
}

module.exports = {
  queueUserUpsert,
  readPendingUsers,
  flushPendingUsers,
  applyPending,
  USERS_FILE,
};
