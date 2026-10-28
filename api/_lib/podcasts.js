// Podcasts (YouTube channels) — helper library.
// Music.js'ga delegator orqali chaqiriladi (Vercel 12-funksiya limiti).
// Redis: podcasts:channels:v1 (kanallar massivi)
// YouTube Data API v3 (.env YOUTUBE_API_KEY)

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const CHANNELS_KEY = "podcasts:channels:v1";
// YouTube Data API kuniga 10 000 birlik beradi — 10 daqiqalik kesh uni kun yarmida tugatardi.
const CHANNEL_CACHE_TTL = 6 * 60 * 60; // 6 soat
// YouTube xato bergan (masalan kvota tugagan) bo'lsa — eski natija ko'rsatiladi, 15 daqiqadan keyin qayta urinish.
const CHANNEL_RETRY_TTL = 15 * 60;
// Oxirgi to'liq natija: YouTube ishlamay qolganda bo'sh sahifa o'rniga shu ko'rsatiladi.
const CHANNEL_LAST_GOOD_TTL = 30 * 24 * 60 * 60;

const {
  yieldToEventLoop,
  fetchWithRetry,
  fetchPlaylistItemsQueue,
  hydrateVideosQueue,
} = require("./youtube-queue");

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

async function fetchUploadedVideos(uploadsPlaylistId, maxResults = 300) {
  if (!uploadsPlaylistId) return [];
  const playlistItems = await fetchPlaylistItemsQueue({
    uploadsPlaylistId,
    ytFetch,
    maxResults,
    pageSize: 50,
  });

  const ids = playlistItems.map((it) => it.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return [];

  const videos = await hydrateVideosQueue({
    videoIds: ids,
    ytFetch,
    batchSize: 50,
    parts: "contentDetails,statistics,snippet,status",
    itemFormatter: (v) => {
      const sn = v.snippet || {};
      const cd = v.contentDetails || {};
      const st = v.statistics || {};
      const dur = isoToSeconds(cd.duration);
      return {
        videoId: v.id,
        title: sn.title || "",
        thumb: pickThumb(sn.thumbnails),
        publishedAt: sn.publishedAt || "",
        durationSec: dur,
        isShort: dur > 0 && dur <= 60,
        viewCount: Number(st.viewCount || 0),
      };
    },
  });

  return videos;
}

async function fetchPlaylists(channelId, maxResults = 25) {
  try {
    const r = await fetchWithRetry(
      () => ytFetch("playlists", {
        part: "snippet,contentDetails",
        channelId,
        maxResults,
      }),
      { maxRetries: 2, delayMs: 400 }
    );
    return (r?.items || []).map((it) => ({
      playlistId: it.id,
      title: it.snippet?.title || "",
      thumb: pickThumb(it.snippet?.thumbnails),
      itemCount: Number(it.contentDetails?.itemCount || 0),
      publishedAt: it.snippet?.publishedAt || "",
    }));
  } catch (err) {
    console.warn(`[podcasts] Playlists olishda xato (${channelId}): ${err.message}`);
    return null;
  }
}

function channelViewKeys(channelId) {
  // v3 — eski (60-cap'li) cache'larni invalid qilish
  return { fresh: `podcasts:view:v3:${channelId}`, lastGood: `podcasts:view:last:v1:${channelId}` };
}

async function getChannelView(channelId) {
  const keys = channelViewKeys(channelId);
  const redis = await getRedis();
  let lastGood = null;
  if (redis) {
    try {
      const [cached, last] = await Promise.all([redis.get(keys.fresh), redis.get(keys.lastGood)]);
      if (cached) return JSON.parse(cached);
      if (last) lastGood = JSON.parse(last);
    } catch (_) {}
  }
  const cacheFor = async (view, ttl) => {
    if (!redis) return;
    try { await redis.set(keys.fresh, JSON.stringify(view), { EX: ttl }); } catch (_) {}
  };

  // Kanal snapshot — agar stored bo'lsa ham, yangilab olamiz (banner va sub o'zgaradi)
  let chResp;
  try {
    chResp = await fetchWithRetry(
      () => ytFetch("channels", {
        part: "snippet,brandingSettings,statistics,contentDetails",
        id: channelId,
      }),
      { maxRetries: 2, delayMs: 500 }
    );
  } catch (err) {
    if (!lastGood) throw err;
    await cacheFor(lastGood, CHANNEL_RETRY_TTL);
    return lastGood;
  }
  const item = chResp?.items?.[0];
  if (!item) throw Object.assign(new Error("Kanal topilmadi."), { statusCode: 404 });
  const channel = shapeChannel(item);

  const [videosSettled, playlistsSettled] = await Promise.allSettled([
    fetchUploadedVideos(channel.uploadsPlaylistId, 300),
    fetchPlaylists(channelId, 25),
  ]);

  let videosAll = videosSettled.status === "fulfilled" ? videosSettled.value : [];
  let playlists = playlistsSettled.status === "fulfilled" ? playlistsSettled.value : null;
  // Kanalda video bor, lekin ro'yxat bo'sh keldi — YouTube xato bergan (playlistItems xatoni yutadi).
  const videosFailed = !videosAll.length && channel.videoCount > 0;
  const playlistsFailed = playlists === null;
  if (videosFailed) videosAll = [...(lastGood?.videos || []), ...(lastGood?.shorts || [])];
  if (playlistsFailed) playlists = lastGood?.playlists || [];
  const videos = videosAll.filter((v) => !v.isShort);
  const shorts = videosAll.filter((v) => v.isShort);
  const view = { channel, videos, shorts, playlists, fetchedAt: Date.now() };
  if (videosFailed || playlistsFailed) {
    // Chala natija oxirgi to'liq natijani bosib ketmaydi va uzoq keshlanmaydi.
    await cacheFor(view, CHANNEL_RETRY_TTL);
    return view;
  }
  await cacheFor(view, CHANNEL_CACHE_TTL);
  if (redis) {
    try { await redis.set(keys.lastGood, JSON.stringify(view), { EX: CHANNEL_LAST_GOOD_TTL }); } catch (_) {}
  }
  return view;
}

// ---------- HTTP handler ----------

async function handlePodcastsRequest(request, response) {
  try {
    // GET /api/podcasts?channelId=UCxxx → kanal sahifa
    if (request.method === "GET") {
      const url = new URL(request.url || "/", "http://localhost");
      const channelId = String(request.query?.channelId || url.searchParams.get("channelId") || "").trim();
      const pageParam = request.query?.page || url.searchParams.get("page");
      const limitParam = request.query?.limit || url.searchParams.get("limit");

      if (channelId) {
        const view = await getChannelView(channelId);
        if (limitParam !== undefined && limitParam !== null) {
          const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
          const limit = Math.max(1, Math.min(100, parseInt(limitParam || "20", 10) || 20));
          const allVideos = view.videos || [];
          const totalVideos = allVideos.length;
          const totalPages = Math.max(1, Math.ceil(totalVideos / limit));
          const startIndex = (page - 1) * limit;
          const pagedVideos = allVideos.slice(startIndex, startIndex + limit);

          response.setHeader("X-Total-Count", String(totalVideos));
          response.setHeader("X-Page", String(page));
          response.setHeader("X-Per-Page", String(limit));
          response.setHeader("X-Total-Pages", String(totalPages));

          response.status(200).json({
            ok: true,
            channel: view.channel,
            videos: pagedVideos,
            shorts: (view.shorts || []).slice(0, limit),
            playlists: view.playlists,
            totalVideos,
            page,
            limit,
            totalPages,
            fetchedAt: view.fetchedAt,
          });
          return;
        }

        response.status(200).json({ ok: true, ...view });
        return;
      }

      // GET /api/podcasts → kanallar ro'yxati
      const stored = await readChannels();
      stored.sort((a, b) => (a.order - b.order) || (a.addedAt - b.addedAt));
      const total = stored.length;
      response.setHeader("X-Total-Count", String(total));

      if (limitParam !== undefined && limitParam !== null) {
        const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(limitParam || "20", 10) || 20));
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const startIndex = (page - 1) * limit;
        const paged = stored.slice(startIndex, startIndex + limit);

        response.setHeader("X-Page", String(page));
        response.setHeader("X-Per-Page", String(limit));
        response.setHeader("X-Total-Pages", String(totalPages));

        response.status(200).json({
          ok: true,
          channels: paged,
          total,
          page,
          limit,
          totalPages,
        });
        return;
      }

      response.status(200).json({ ok: true, channels: stored });
      return;
    }

    if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
      const body = await readBody(request);
      const action = String(body.action || (request.method === "DELETE" ? "delete" : "add")).toLowerCase();

      if (action === "share") {
        const { requireVerifiedUser } = require("./auth");
        const user = await requireVerifiedUser(request, response);
        if (!user) return;
        const channelId = String(body.channelId || "").trim();
        const userId = String(user.id);
        if (!channelId) {
          response.status(400).json({ ok: false, error: "channelId kerak." });
          return;
        }
        const token = String(process.env.BOT_TOKEN || "").trim();
        if (!token) { response.status(500).json({ ok: false, error: "BOT_TOKEN sozlanmagan." }); return; }
        // Kanal ma'lumotini olamiz (avatar, title, sub/video count)
        const list = await readChannels();
        const stored = list.find((c) => c.channelId === channelId);
        let ch = stored?.snapshot || null;
        if (!ch) {
          try { const view = await getChannelView(channelId); ch = view.channel; } catch (_) { ch = { channelId, title: "" }; }
        }
        const title = ch.title || "";
        const subs = Number(ch.subscriberCount || 0);
        const vids = Number(ch.videoCount || 0);
        const avatar = ch.avatar || ch.banner || "";
        const podcastBotUsername = String(process.env.BOT_USERNAME || "myntv_bot").trim().replace(/^@/, "");
        const link = `https://t.me/${podcastBotUsername}?startapp=pod_${encodeURIComponent(channelId)}`;
        const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const fmt = (n) => {
          if (!n) return "0";
          if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
          if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
          return String(n);
        };
        const html = `<b>Potkast nomi:</b> ${esc(title)}\n\n` +
          `👥 ${fmt(subs)} obunachi\n` +
          `🎬 ${fmt(vids)} video\n\n` +
          `▶️ <a href="${esc(link)}">Potkastni ko'rish</a>`;
        const resultId = `pod_${channelId}_${Date.now().toString(36)}`.slice(0, 64);
        const result = avatar
          ? {
              type: "photo",
              id: resultId,
              photo_url: avatar,
              thumbnail_url: avatar,
              title,
              caption: html,
              parse_mode: "HTML",
            }
          : {
              type: "article",
              id: resultId,
              title: title || "Potkast",
              input_message_content: { message_text: html, parse_mode: "HTML" },
            };
        const tgUrl = `https://api.telegram.org/bot${token}/savePreparedInlineMessage`;
        const tgRes = await fetch(tgUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: Number(userId),
            result,
            allow_user_chats: true,
            allow_bot_chats: true,
            allow_group_chats: true,
            allow_channel_chats: true,
          }),
        });
        const tgJson = await tgRes.json().catch(() => null);
        if (!tgRes.ok || !tgJson?.ok) {
          response.status(502).json({ ok: false, error: tgJson?.description || "savePreparedInlineMessage failed" });
          return;
        }
        response.status(200).json({ ok: true, preparedMessageId: tgJson.result.id, expirationDate: tgJson.result.expiration_date });
        return;
      }

      // Boshqa barcha boshqaruv amallari (add, delete, refresh, update) faqat administrator uchun!
      const { requireAdmin } = require("./auth");
      if (!(await requireAdmin(request, response))) return;

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
          const keys = channelViewKeys(channelId);
          if (r) await r.del([keys.fresh, keys.lastGood]);
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
          if (r) await r.del(channelViewKeys(channelId).fresh);
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

module.exports = { handlePodcastsRequest, getChannelView };
