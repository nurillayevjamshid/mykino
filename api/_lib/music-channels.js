// YouTube qo'shiqchilar (music channels) — helper kutubxonasi.
// Admin paneldan YouTube kanal URL'i qo'shiladi, kanalning hamma videolari
// avtomatik qo'shiqlar bo'lib paydo bo'ladi (artist = kanal nomi).
// Music.js'ga delegator orqali chaqiriladi.
//
// Redis kalitlar:
//   music:channels:v1               — kanallar ro'yxati (snapshot + videos cache)
//   music:channels:view:v1:<chId>   — kanal sahifa cache (10 min)

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNELS_KEY = "music:channels:v1";
const CHANNEL_CACHE_TTL = 600;
const MAX_VIDEOS_PER_CHANNEL = 200;
const BLOB_API_BASE = "https://blob.vercel-storage.com";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

let _redisPromise = null;
async function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (_redisPromise) {
    try { const c = await _redisPromise; if (c?.isOpen) return c; } catch (_) {}
    _redisPromise = null;
  }
  _redisPromise = (async () => {
    const { createClient } = require("redis");
    const client = createClient({ url });
    client.on("error", (err) => console.error("redis (music-channels) error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await _redisPromise;
  } catch (err) {
    console.warn("redis (music-channels) ulanmadi:", err.message);
    _redisPromise = null;
    return null;
  }
}

function apiKey() {
  return String(process.env.YOUTUBE_API_KEY || "").trim();
}

async function ytFetch(path, params) {
  const key = apiKey();
  if (!key) throw new Error("YOUTUBE_API_KEY topilmadi.");
  const url = new URL(`${YT_API_BASE}/${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  url.searchParams.set("key", key);
  const r = await fetch(url.toString());
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    const err = new Error(`YouTube API ${r.status}: ${body.slice(0, 200)}`);
    err.statusCode = r.status;
    throw err;
  }
  return await r.json();
}

function parseChannelInput(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (/^UC[\w-]{20,}$/.test(raw)) return { type: "id", value: raw };
  let s = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/^(m\.|music\.)?youtube\.com\//i, "").replace(/^youtu\.be\//i, "");
  s = s.replace(/[?#].*$/, "");
  if (s.startsWith("@")) return { type: "handle", value: s };
  let m = s.match(/^channel\/(UC[\w-]{20,})/);
  if (m) return { type: "id", value: m[1] };
  m = s.match(/^c\/([\w.-]+)/);
  if (m) return { type: "search", value: m[1] };
  m = s.match(/^user\/([\w.-]+)/);
  if (m) return { type: "username", value: m[1] };
  m = s.match(/^@?([\w.-]+)/);
  if (m) return { type: "handle", value: `@${m[1]}` };
  return null;
}

function pickThumb(thumbs) {
  if (!thumbs) return "";
  return (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
}

function shapeChannel(item) {
  const sn = item.snippet || {};
  const br = item.brandingSettings?.image || {};
  const st = item.statistics || {};
  const cd = item.contentDetails || {};
  const thumbs = sn.thumbnails || {};
  const avatar = (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
  return {
    channelId: item.id,
    title: sn.title || "",
    description: sn.description || "",
    avatar,
    banner: br.bannerExternalUrl || "",
    publishedAt: sn.publishedAt || "",
    subscriberCount: Number(st.subscriberCount || 0),
    viewCount: Number(st.viewCount || 0),
    videoCount: Number(st.videoCount || 0),
    uploadsPlaylistId: cd.relatedPlaylists?.uploads || "",
    cachedAt: Date.now(),
  };
}

async function resolveChannel(input) {
  const parsed = parseChannelInput(input);
  if (!parsed) throw Object.assign(new Error("Kanal URL/handle noto'g'ri."), { statusCode: 400 });
  const partsFull = "snippet,brandingSettings,statistics,contentDetails";
  let resp;
  if (parsed.type === "id") {
    resp = await ytFetch("channels", { part: partsFull, id: parsed.value });
  } else if (parsed.type === "handle") {
    resp = await ytFetch("channels", { part: partsFull, forHandle: parsed.value });
  } else if (parsed.type === "username") {
    resp = await ytFetch("channels", { part: partsFull, forUsername: parsed.value });
  } else {
    const s = await ytFetch("search", { part: "snippet", q: parsed.value, type: "channel", maxResults: 1 });
    const id = s?.items?.[0]?.snippet?.channelId || s?.items?.[0]?.id?.channelId;
    if (!id) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
    resp = await ytFetch("channels", { part: partsFull, id });
  }
  const item = resp?.items?.[0];
  if (!item) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
  return shapeChannel(item);
}

function isoToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ""));
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

async function fetchChannelVideos(uploadsPlaylistId, maxResults = MAX_VIDEOS_PER_CHANNEL) {
  if (!uploadsPlaylistId) return [];
  const allItems = [];
  let pageToken = "";
  while (allItems.length < maxResults) {
    const batchSize = Math.min(50, maxResults - allItems.length);
    const params = { part: "snippet,contentDetails", playlistId: uploadsPlaylistId, maxResults: batchSize };
    if (pageToken) params.pageToken = pageToken;
    const pl = await ytFetch("playlistItems", params);
    const items = pl?.items || [];
    allItems.push(...items);
    pageToken = pl?.nextPageToken || "";
    if (!pageToken || !items.length) break;
  }
  const ids = allItems.map((it) => it.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const vresp = await ytFetch("videos", { part: "contentDetails,snippet,statistics", id: batch.join(","), maxResults: 50 });
    for (const v of (vresp?.items || [])) {
      const sn = v.snippet || {};
      const dur = isoToSeconds(v.contentDetails?.duration);
      // Shorts (<=60s) ni musiqa sifatida o'tkazib yuboramiz
      if (dur > 0 && dur <= 60) continue;
      videos.push({
        videoId: v.id,
        title: sn.title || "",
        thumb: pickThumb(sn.thumbnails),
        publishedAt: sn.publishedAt || "",
        durationSec: dur,
      });
    }
  }
  return videos;
}

function normalizeStored(ch) {
  if (!ch || typeof ch !== "object" || !ch.channelId) return null;
  return {
    channelId: String(ch.channelId),
    addedAt: Number(ch.addedAt || Date.now()),
    order: Number.isFinite(Number(ch.order)) ? Number(ch.order) : 0,
    customName: String(ch.customName || "").trim(),
    customImage: String(ch.customImage || "").trim(),
    snapshot: ch.snapshot || null,
    videos: Array.isArray(ch.videos) ? ch.videos : [],
    videosFetchedAt: Number(ch.videosFetchedAt || 0),
  };
}

async function readChannels() {
  const c = await getRedis();
  if (!c) return [];
  try {
    const raw = await c.get(CHANNELS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeStored).filter(Boolean) : [];
  } catch (err) {
    console.warn("music-channels read xato:", err.message);
    return [];
  }
}

async function writeChannels(list) {
  const c = await getRedis();
  if (!c) return false;
  try { await c.set(CHANNELS_KEY, JSON.stringify(list)); return true; }
  catch (err) { console.warn("music-channels write xato:", err.message); return false; }
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

// ----- Blob upload (rasm) -----
function parseDataUrl(dataUrl) {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || "").trim());
  if (!m) return null;
  return { contentType: m[1] || "application/octet-stream", buffer: Buffer.from(m[2], "base64") };
}
function extFromContentType(ct) {
  const map = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  return map[ct] || "bin";
}
async function uploadToBlob(pathname, buffer, contentType) {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (!token) { const err = new Error("BLOB_READ_WRITE_TOKEN topilmadi."); err.statusCode = 500; throw err; }
  const url = new URL(`${BLOB_API_BASE}/${pathname.replace(/^\/+/, "")}`);
  url.searchParams.set("addRandomSuffix", "1");
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "Content-Type": contentType,
      "x-content-type": contentType,
      "x-add-random-suffix": "1",
    },
    body: buffer,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.url) {
    const err = new Error(payload?.error?.message || "Blob upload muvaffaqiyatsiz.");
    err.statusCode = response.status || 502;
    throw err;
  }
  return payload.url;
}
async function handleImageUpload(body) {
  const parsed = parseDataUrl(body.dataUrl || body.image || "");
  if (!parsed) { const err = new Error("dataUrl kerak."); err.statusCode = 400; throw err; }
  if (parsed.buffer.length > MAX_IMAGE_BYTES) { const err = new Error("Rasm 6MB dan katta."); err.statusCode = 413; throw err; }
  const ext = extFromContentType(parsed.contentType);
  const baseName = String(body.name || "channel").replace(/[^a-z0-9._-]/gi, "").slice(0, 40) || "channel";
  const pathname = `music-channels/${Date.now()}-${baseName}.${ext}`;
  return await uploadToBlob(pathname, parsed.buffer, parsed.contentType);
}

// ----- Public helpers (api/music.js dan chaqiriladi) -----

// Hamma kanallarning videolarini pseudo-track ko'rinishida qaytaradi.
// Trek format: { id, title, artist, categories, category, youtubeId, source, channelId, cover }
async function loadAllChannelTracks() {
  const channels = await readChannels();
  const tracks = [];
  for (const ch of channels) {
    const artistName = ch.customName || ch.snapshot?.title || "";
    if (!artistName) continue;
    for (const v of (ch.videos || [])) {
      if (!v?.videoId || !v?.title) continue;
      tracks.push({
        id: `ytch-${v.videoId}`,
        title: String(v.title).slice(0, 200),
        artist: artistName,
        categories: ["YouTube"],
        category: "YouTube",
        youtubeId: v.videoId,
        source: "yt-channel",
        channelId: ch.channelId,
        cover: v.thumb || "",
      });
    }
  }
  return tracks;
}

// Kanal-asoslangan artist yozuvlarini qaytaradi (artists ro'yxatiga qo'shiladi).
async function loadChannelArtists() {
  const channels = await readChannels();
  return channels.map((ch) => {
    const name = ch.customName || ch.snapshot?.title || "";
    if (!name) return null;
    return {
      id: `ytch-${ch.channelId}`,
      name,
      image: ch.customImage || ch.snapshot?.avatar || "",
      link: `https://www.youtube.com/channel/${ch.channelId}`,
      order: ch.order || 0,
      source: "yt-channel",
      channelId: ch.channelId,
    };
  }).filter(Boolean);
}

// ----- HTTP handler -----

async function handleMusicChannelsRequest(request, response) {
  try {
    if (request.method === "GET") {
      const channelId = String(request.query?.channelId || "").trim();
      if (channelId) {
        const list = await readChannels();
        const entry = list.find((c) => c.channelId === channelId);
        if (!entry) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        response.status(200).json({ ok: true, channel: entry });
        return;
      }
      const list = await readChannels();
      list.sort((a, b) => (a.order - b.order) || (a.addedAt - b.addedAt));
      response.status(200).json({ ok: true, channels: list });
      return;
    }

    if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
      const body = await readBody(request);
      const action = String(body.action || (request.method === "DELETE" ? "delete" : "add")).toLowerCase();

      if (action === "upload") {
        const url = await handleImageUpload(body);
        response.status(200).json({ ok: true, url });
        return;
      }

      if (action === "delete") {
        const channelId = String(body.channelId || "");
        if (!channelId) { response.status(400).json({ ok: false, error: "channelId kerak." }); return; }
        const list = await readChannels();
        const next = list.filter((c) => c.channelId !== channelId);
        const ok = await writeChannels(next);
        if (!ok) { response.status(503).json({ ok: false, error: "Redis sozlanmagan." }); return; }
        try { const r = await getRedis(); if (r) await r.del(`music:channels:view:v1:${channelId}`); } catch (_) {}
        response.status(200).json({ ok: true, channels: next });
        return;
      }

      if (action === "add") {
        const input = String(body.input || body.url || body.handle || "").trim();
        if (!input) { response.status(400).json({ ok: false, error: "Kanal URL yoki @handle kerak." }); return; }
        const snapshot = await resolveChannel(input);
        const list = await readChannels();
        if (list.some((c) => c.channelId === snapshot.channelId)) {
          response.status(409).json({ ok: false, error: "Bu kanal allaqachon qo'shilgan.", channelId: snapshot.channelId });
          return;
        }
        const videos = await fetchChannelVideos(snapshot.uploadsPlaylistId);
        const entry = normalizeStored({
          channelId: snapshot.channelId,
          addedAt: Date.now(),
          order: list.length,
          customName: String(body.customName || "").trim(),
          customImage: String(body.customImage || "").trim(),
          snapshot,
          videos,
          videosFetchedAt: Date.now(),
        });
        list.push(entry);
        const ok = await writeChannels(list);
        if (!ok) { response.status(503).json({ ok: false, error: "Redis sozlanmagan." }); return; }
        response.status(200).json({ ok: true, channel: entry, channels: list });
        return;
      }

      if (action === "refresh") {
        const channelId = String(body.channelId || "");
        if (!channelId) { response.status(400).json({ ok: false, error: "channelId kerak." }); return; }
        const snapshot = await resolveChannel(channelId);
        const videos = await fetchChannelVideos(snapshot.uploadsPlaylistId);
        const list = await readChannels();
        const idx = list.findIndex((c) => c.channelId === channelId);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        list[idx] = normalizeStored({ ...list[idx], snapshot, videos, videosFetchedAt: Date.now() });
        await writeChannels(list);
        response.status(200).json({ ok: true, channel: list[idx], channels: list });
        return;
      }

      if (action === "update") {
        const channelId = String(body.channelId || "");
        if (!channelId) { response.status(400).json({ ok: false, error: "channelId kerak." }); return; }
        const list = await readChannels();
        const idx = list.findIndex((c) => c.channelId === channelId);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        if (body.customName !== undefined) list[idx].customName = String(body.customName || "").trim();
        if (body.customImage !== undefined) list[idx].customImage = String(body.customImage || "").trim();
        if (body.order !== undefined) list[idx].order = Number(body.order) || 0;
        await writeChannels(list);
        response.status(200).json({ ok: true, channel: list[idx], channels: list });
        return;
      }

      response.status(400).json({ ok: false, error: "action noma'lum." });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed." });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error("music-channels handler xato:", err.message);
    response.status(status).json({ ok: false, error: err.message || "Server xatolik." });
  }
}

module.exports = {
  handleMusicChannelsRequest,
  loadAllChannelTracks,
  loadChannelArtists,
};
