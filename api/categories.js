const { setCors } = require("./_lib/google-drive");
const { uploadImageToR2 } = require("./_lib/r2-store");

const REDIS_KEY = "categories:v1";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

let redisPromise = null;
async function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (redisPromise) {
    try { const c = await redisPromise; if (c?.isOpen) return c; } catch (_) {}
    redisPromise = null;
  }
  redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.error("redis error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await redisPromise;
  } catch (err) {
    console.warn("redis ulanmadi:", err.message);
    redisPromise = null;
    return null;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "kategoriya";
}

function normalize(cat) {
  if (!cat || typeof cat !== "object") return null;
  const name = String(cat.name || "").trim();
  if (!name) return null;
  const image = String(cat.image || "").trim();
  const id = String(cat.id || slugify(name)).slice(0, 64);
  const order = Number(cat.order || 0);
  return { id, name, image, order: Number.isFinite(order) ? order : 0 };
}

async function readAll() {
  const client = await getRedis();
  if (!client) return [];
  try {
    const raw = await client.get(REDIS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalize).filter(Boolean) : [];
  } catch (err) {
    console.warn("redis get categories xato:", err.message);
    return [];
  }
}

async function writeAll(list) {
  const client = await getRedis();
  if (!client) return false;
  try {
    await client.set(REDIS_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn("redis set categories xato:", err.message);
    return false;
  }
}

async function readBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  let raw = "";
  if (Buffer.isBuffer(request.body)) raw = request.body.toString("utf8");
  else if (typeof request.body === "string") raw = request.body;
  else {
    for await (const chunk of request) raw += chunk;
  }
  return raw ? JSON.parse(raw) : {};
}

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL || process.env.KV_URL);
}

function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) return null;
  return { contentType: m[1] || "application/octet-stream", buffer: Buffer.from(m[2], "base64") };
}

async function handleUpload(body) {
  const dataUrl = String(body.dataUrl || body.image || "").trim();
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const err = new Error("dataUrl (base64 image) kerak."); err.statusCode = 400; throw err;
  }
  if (parsed.buffer.length > MAX_IMAGE_BYTES) {
    const err = new Error("Rasm 6MB dan katta."); err.statusCode = 413; throw err;
  }
  const baseName = String(body.name || "category").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "category";
  const { directUrl } = await uploadImageToR2(dataUrl, `category-${baseName}`);
  return directUrl;
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  if (request.method === "GET") {
    response.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } else {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  }

  if (request.method === "GET") {
    try {
      const categories = await readAll();
      categories.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, categories, storage: isRedisEnabled() ? "redis" : "none" });
    } catch (err) {
      response.status(500).json({ ok: false, error: err.message || "Yuklab bo'lmadi." });
    }
    return;
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    try {
      const body = await readBody(request);
      const action = body.action || (request.method === "DELETE" ? "delete" : (request.method === "PUT" ? "update" : "create"));

      if (action === "upload") {
        const url = await handleUpload(body);
        response.status(200).json({ ok: true, url });
        return;
      }

      if (!isRedisEnabled()) {
        response.status(503).json({ ok: false, error: "Vercel Redis sozlanmagan." });
        return;
      }

      let list = await readAll();

      if (action === "delete") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        list = list.filter((c) => c.id !== id);
      } else if (action === "update") {
        const id = String(body.id || "");
        if (!id) { response.status(400).json({ ok: false, error: "id kerak." }); return; }
        const idx = list.findIndex((c) => c.id === id);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        const merged = normalize({ ...list[idx], ...body, id });
        if (!merged) { response.status(400).json({ ok: false, error: "Noto'g'ri ma'lumot." }); return; }
        list[idx] = merged;
      } else if (action === "reorder" && Array.isArray(body.ids)) {
        const map = new Map(list.map((c) => [c.id, c]));
        const ordered = [];
        body.ids.forEach((id, i) => {
          const c = map.get(String(id));
          if (c) { ordered.push({ ...c, order: i }); map.delete(c.id); }
        });
        list = [...ordered, ...map.values()];
      } else {
        const created = normalize(body);
        if (!created) { response.status(400).json({ ok: false, error: "name kerak." }); return; }
        if (list.some((c) => c.id === created.id)) {
          created.id = `${created.id}-${Date.now().toString(36)}`;
        }
        created.order = list.length;
        list.push(created);
      }

      const ok = await writeAll(list);
      if (!ok) { response.status(500).json({ ok: false, error: "Saqlash muvaffaqiyatsiz." }); return; }
      list.sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, "uz"));
      response.status(200).json({ ok: true, categories: list });
    } catch (err) {
      response.status(err.statusCode || 400).json({ ok: false, error: err.message || "Yaroqsiz so'rov." });
    }
    return;
  }

  response.status(405).json({ ok: false, error: "Method not allowed." });
};
