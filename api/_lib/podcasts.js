// Podcasts (YouTube channels) — helper library.
// Music.js'ga delegator orqali chaqiriladi (Vercel 12-funksiya limiti).
// Redis: podcasts:channels:v1 (kanallar massivi)
// YouTube Data API v3 (.env YOUTUBE_API_KEY)

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNELS_KEY = "podcasts:channels:v1";
const CHANNEL_CACHE_TTL = 600; // 10 daqiqa

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
    client.on("error", (err) => console.error("redis (podcasts) error:", err.message));
    await client.connect();
    return client;
  })();
  try {
    return await _redisPromise;
  } catch (err) {
    console.warn("redis (podcasts) ulanmadi:", err.message);
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

// "@OnlineKINGG", "youtube.com/@OnlineKINGG", "youtube.com/channel/UCxxx",
// "youtube.com/c/Name", "UCxxx" — barchasini @handle / channelId ga tushiramiz.
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
    // search bilan: c/Name shaklini topish
    const s = await ytFetch("search", { part: "snippet", q: parsed.value, type: "channel", maxResults: 1 });
    const id = s?.items?.[0]?.snippet?.channelId || s?.items?.[0]?.id?.channelId;
    if (!id) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
    resp = await ytFetch("channels", { part: partsFull, id });
  }
  const item = resp?.items?.[0];
  if (!item) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
  return shapeChannel(item);
}

function shapeChannel(item) {
  const sn = item.snippet || {};
  const br = item.brandingSettings?.image || {};
  const brCh = item.brandingSettings?.channel || {};
  const st = item.statistics || {};
  const cd = item.contentDetails || {};
  const thumbs = sn.thumbnails || {};
  const avatar = (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
  const banner = br.bannerExternalUrl || "";
  return {
    channelId: item.id,
    title: sn.title || "",
    handle: brCh.unsubscribedTrailer ? "" : (sn.customUrl ? (sn.customUrl.startsWith("@") ? sn.customUrl : `@${sn.customUrl}`) : ""),
    description: sn.description || "",
    avatar,
    banner,
    publishedAt: sn.publishedAt || "",
    country: sn.country || "",
    subscriberCount: Number(st.subscriberCount || 0),
    viewCount: Number(st.viewCount || 0),
    videoCount: Number(st.videoCount || 0),
    uploadsPlaylistId: cd.relatedPlaylists?.uploads || "",
    cachedAt: Date.now(),
  };
}

const LANG_ALLOWED = ["uz", "ru", "en"];
function normalizeLang(v) {
  const s = String(v || "").toLowerCase().trim();
  return LANG_ALLOWED.includes(s) ? s : "";
}

function normalizeStored(ch) {
  if (!ch || typeof ch !== "object" || !ch.channelId) return null;
  return {
    channelId: String(ch.channelId),
    addedAt: Number(ch.addedAt || Date.now()),
    order: Number.isFinite(Number(ch.order)) ? Number(ch.order) : 0,
    snapshot: ch.snapshot || null,
    featured: Boolean(ch.featured),
    lang: normalizeLang(ch.lang),
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
    console.warn("podcasts read xato:", err.message);
    return [];
  }
}

async function writeChannels(list) {
  const c = await getRedis();
  if (!c) return false;
  try { await c.set(CHANNELS_KEY, JSON.stringify(list)); return true; }
  catch (err) { console.warn("podcasts write xato:", err.message); return false; }
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

// ---------- Kanal kontenti (videos / shorts / playlists) ----------

// ISO 8601 duration (PT1M30S) → seconds
function isoToSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso || ""));
  if (!m) return 0;
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
}

function pickThumb(thumbs) {
  if (!thumbs) return "";
  return (thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
}

async function fetchUploadedVideos(uploadsPlaylistId, maxResults = 9999) {
  if (!uploadsPlaylistId) return [];
  const allItems = [];
  let pageToken = "";
  // YouTube API har safar max 50 qaytaradi — pagination bilan hammasini olamiz
  while (allItems.length < maxResults) {
    const batchSize = Math.min(50, maxResults - allItems.length);
    const params = {
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: batchSize,
    };
    if (pageToken) params.pageToken = pageToken;
    const pl = await ytFetch("playlistItems", params);
    const items = pl?.items || [];
    allItems.push(...items);
    pageToken = pl?.nextPageToken || "";
    if (!pageToken || !items.length) break;
  }
  const ids = allItems.map((it) => it.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];
  // Durations + statistics — 50 tadan bo'lib chaqiramiz
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const vresp = await ytFetch("videos", {
      part: "contentDetails,statistics,snippet",
      id: batch.join(","),
      maxResults: 50,
    });
    for (const v of (vresp?.items || [])) {
      const sn = v.snippet || {};
      const dur = isoToSeconds(v.contentDetails?.duration);
      videos.push({
        videoId: v.id,
        title: sn.title || "",
        thumb: pickThumb(sn.thumbnails),
        publishedAt: sn.publishedAt || "",
        durationSec: dur,
        isShort: dur > 0 && dur <= 60,
        viewCount: Number(v.statistics?.viewCount || 0),
      });
    }
  }
  return videos;
}

async function fetchPlaylists(channelId, maxResults = 25) {
  const r = await ytFetch("playlists", {
    part: "snippet,contentDetails",
    channelId,
    maxResults,
  });
  return (r?.items || []).map((it) => ({
    playlistId: it.id,
    title: it.snippet?.title || "",
    thumb: pickThumb(it.snippet?.thumbnails),
    itemCount: Number(it.contentDetails?.itemCount || 0),
    publishedAt: it.snippet?.publishedAt || "",
  }));
}

async function getChannelView(channelId) {
  const cacheKey = `podcasts:view:${channelId}`;
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
  }
  // Kanal snapshot — agar stored bo'lsa ham, yangilab olamiz (banner va sub o'zgaradi)
  const chResp = await ytFetch("channels", {
    part: "snippet,brandingSettings,statistics,contentDetails",
    id: channelId,
  });
  const item = chResp?.items?.[0];
  if (!item) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
  const channel = shapeChannel(item);
  const [videosAll, playlists] = await Promise.all([
    fetchUploadedVideos(channel.uploadsPlaylistId, 9999),
    fetchPlaylists(channelId, 25),
  ]);
  const videos = videosAll.filter((v) => !v.isShort);
  const shorts = videosAll.filter((v) => v.isShort);
  const view = { channel, videos, shorts, playlists, fetchedAt: Date.now() };
  if (redis) {
    try { await redis.set(cacheKey, JSON.stringify(view), { EX: CHANNEL_CACHE_TTL }); } catch (_) {}
  }
  return view;
}

// ---------- HTTP handler ----------

async function handlePodcastsRequest(request, response) {
  try {
    // GET /api/podcasts?channelId=UCxxx → kanal sahifa
    if (request.method === "GET") {
      const channelId = String(request.query?.channelId || "").trim();
      if (channelId) {
        const view = await getChannelView(channelId);
        response.status(200).json({ ok: true, ...view });
        return;
      }
      // GET /api/podcasts → kanallar ro'yxati
      const stored = await readChannels();
      stored.sort((a, b) => (a.order - b.order) || (a.addedAt - b.addedAt));
      response.status(200).json({ ok: true, channels: stored });
      return;
    }

    if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
      const body = await readBody(request);
      const action = String(body.action || (request.method === "DELETE" ? "delete" : "add")).toLowerCase();

      if (action === "delete") {
        const channelId = String(body.channelId || "");
        if (!channelId) {
          response.status(400).json({ ok: false, error: "channelId kerak." });
          return;
        }
        const list = await readChannels();
        const next = list.filter((c) => c.channelId !== channelId);
        const ok = await writeChannels(next);
        if (!ok) { response.status(503).json({ ok: false, error: "Redis sozlanmagan." }); return; }
        // Cache'ni ham tozalash
        try {
          const r = await getRedis();
          if (r) await r.del(`podcasts:view:${channelId}`);
        } catch (_) {}
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
        const entry = {
          channelId: snapshot.channelId,
          addedAt: Date.now(),
          order: list.length,
          snapshot,
          lang: normalizeLang(body.lang),
        };
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
        const list = await readChannels();
        const idx = list.findIndex((c) => c.channelId === channelId);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        list[idx] = { ...list[idx], snapshot };
        await writeChannels(list);
        try {
          const r = await getRedis();
          if (r) await r.del(`podcasts:view:${channelId}`);
        } catch (_) {}
        response.status(200).json({ ok: true, channel: list[idx] });
        return;
      }

      if (action === "update") {
        const channelId = String(body.channelId || "");
        if (!channelId) { response.status(400).json({ ok: false, error: "channelId kerak." }); return; }
        const list = await readChannels();
        const idx = list.findIndex((c) => c.channelId === channelId);
        if (idx < 0) { response.status(404).json({ ok: false, error: "Topilmadi." }); return; }
        if (body.featured !== undefined) list[idx].featured = Boolean(body.featured);
        if (body.order !== undefined) list[idx].order = Number(body.order);
        if (body.lang !== undefined) list[idx].lang = normalizeLang(body.lang);
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
    console.error("podcasts handler xato:", err.message);
    response.status(status).json({ ok: false, error: err.message || "Server xatolik." });
  }
}

module.exports = { handlePodcastsRequest };
