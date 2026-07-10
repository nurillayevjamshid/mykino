// Har kuni GitHub Actions orqali ishlaydi: production /api/users dan obunachilar
// ro'yxatini olib, data/users-backup.json bilan BIRLASHTIRIB saqlaydi.
//
// Birlashtirish (union) muhim: API vaqtincha kam son qaytarsa (masalan storage
// buzilgan payt), eski zaxiradagi yozuvlar o'chib ketmaydi — fayl faqat o'sadi.
// Git tarixi esa har kunlik holatni alohida versiya sifatida abadiy saqlaydi.
const fs = require("fs");
const path = require("path");

const API_URL = process.env.USERS_API_URL || "https://kino-telegram-mini-app.vercel.app/api/users";
const OUT_PATH = path.join(__dirname, "..", "data", "users-backup.json");

function normalize(record) {
  if (!record || typeof record !== "object") return null;
  const id = String(record.telegram_id ?? record.telegramId ?? record.id ?? "").trim();
  if (!id) return null;
  return {
    telegram_id: Number(id) || id,
    username: String(record.username || "").replace(/^@+/, ""),
    first_name: String(record.first_name || record.firstName || ""),
    started_at: String(record.started_at || "").slice(0, 10),
  };
}

async function main() {
  const headers = { Accept: "application/json" };
  if (process.env.BOT_TOKEN) headers["X-API-Key"] = process.env.BOT_TOKEN;
  if (process.env.ADMIN_PASSWORD) headers["X-Admin-Password"] = process.env.ADMIN_PASSWORD;

  const resp = await fetch(API_URL, { headers });
  if (!resp.ok) throw new Error(`API xatolik qaytardi: HTTP ${resp.status}`);
  const data = await resp.json();
  const fetched = (Array.isArray(data) ? data : data?.users || []).map(normalize).filter(Boolean);

  let existing = [];
  try {
    const prev = JSON.parse(fs.readFileSync(OUT_PATH, "utf8"));
    existing = (Array.isArray(prev) ? prev : prev?.users || []).map(normalize).filter(Boolean);
  } catch {}

  // Union: mavjud zaxira + yangi kelganlar. Ism/username yangisidan olinadi,
  // started_at esa eng ertasi saqlanadi (userning haqiqiy qo'shilgan sanasi).
  const map = new Map();
  for (const u of [...existing, ...fetched]) {
    const key = String(u.telegram_id);
    const prev = map.get(key);
    if (!prev) { map.set(key, u); continue; }
    map.set(key, {
      telegram_id: prev.telegram_id,
      username: u.username || prev.username,
      first_name: u.first_name || prev.first_name,
      started_at: [prev.started_at, u.started_at].filter(Boolean).sort()[0] || "",
    });
  }
  const users = Array.from(map.values()).sort((a, b) => Number(a.telegram_id) - Number(b.telegram_id));
  fs.writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), count: users.length, users }, null, 2) + "\n");
  console.log(`API: ${fetched.length} ta, eski zaxira: ${existing.length} ta, birlashma: ${users.length} ta -> ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((err) => {
  console.error("Zaxira olinmadi:", err.message || err);
  process.exit(1);
});
