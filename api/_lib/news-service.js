// Tezkor News Service — fetches and caches news from @tezkorofficial_uz channel
// Supports real-time webhook updates, historical pagination (?before=),
// search, category filters, and media formatting.

const CHANNEL_USERNAME = "tezkorofficial_uz";
const CHANNEL_URL = `https://t.me/s/${CHANNEL_USERNAME}`;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes for latest news
const HISTORICAL_TTL_MS = 60 * 60 * 1000; // 1 hour for old pages

// In-memory cache structures
let _latestPostsCache = { timestamp: 0, posts: [] };
const _pageCache = new Map(); // key: before_id -> { timestamp, posts, nextBefore }
const _postIndex = new Map(); // key: id -> full post object

/**
 * Infer category from text & emojis
 */
function inferCategory(text) {
  const lower = (text || "").toLowerCase();
  if (/⚡|tezkor|shoshilinch|диққат|тезкор|шошилинч|diqqat|rasman|расман/.test(lower)) {
    return "⚡ Tezkor";
  }
  if (/\b(sport|futbol|спорт|футбол|uefa|fifa|boxing|boks|ufc|messi|ronaldo|ronaldu|chempion)\b|o'yin|hisob/i.test(lower)) {
    return "Sport";
  }
  if (/texnologiya|apple|iphone|android|ai|sun'iy intellekt|starlink|mask|ilon mask|tesla|gadjet|texnika/.test(lower)) {
    return "Texnologiya";
  }
  if (/dollar|so'm|som|narx|benzin|metan|bank|kredit|soliq|inflyatsiya|iqtisod|valyuta|savdo/.test(lower)) {
    return "Iqtisod";
  }
  if (/aqsh|rossiya|ukraina|eron|isroil|xitoy|fransiya|turkiya|tramp|bayden|putin|urush|nato|bmt|dunyo/.test(lower)) {
    return "Dunyo";
  }
  if (/toshkent|samarqand|buxoro|andijon|farg'ona|namangan|viloyat|maktab|bog'cha|talaba|pensiya|jarima|yo'l|ob-havo|qor|yomg'ir|jamiyat/.test(lower)) {
    return "Jamiyat";
  }
  return "Umumiy";
}

/**
 * Format relative time in Uzbek (Tashkent timezone UTC+5)
 */
function formatUzbekTime(isoString) {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Hozirgina";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} daqiqa oldin`;
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} soat oldin`;
    }

    // Format day and time in Asia/Tashkent
    const formatter = new Intl.DateTimeFormat("uz-UZ", {
      timeZone: "Asia/Tashkent",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date);
  } catch (_) {
    return "";
  }
}

/**
 * Clean and parse raw Telegram message block
 */
function parseMessageBlock(block) {
  const postIdMatch = block.match(/data-post="([^"]+)"/);
  if (!postIdMatch) return null;
  const postFullId = postIdMatch[1]; // e.g. "tezkorofficial_uz/1182"
  const id = parseInt(postFullId.split("/")[1] || "0", 10);
  if (!id) return null;

  // Datetime
  const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/);
  const datetime = timeMatch ? timeMatch[1] : null;

  // Views
  const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/);
  const views = viewsMatch ? viewsMatch[1].trim() : "0";

  // Raw HTML content
  const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
  let rawHtml = textMatch ? textMatch[1] : "";

  // Remove Telegram channel links from rawHtml so they become unlinked text
  rawHtml = rawHtml
    .replace(/<a\b[^>]*href=["']https?:\/\/(?:t|telegram)\.me\/[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<a\b[^>]*href=["']https?:\/\/t\.me[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, "$1");

  // Plain text
  let plainText = rawHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  // Strip Telegram channel promo links and handles from text
  plainText = plainText
    .replace(/https?:\/\/(?:t|telegram)\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/https?:\/\/t\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/\bt\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/@tezkorofficial_uz\b/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  // Clean lines & extract title
  const rawLines = plainText.split("\n").map((l) => l.trim()).filter(Boolean);
  let title = "Tezkor xabar";
  if (rawLines.length > 0) {
    title = rawLines[0]
      .replace(/^[🔊🔴⚡️🔥🌤⚽️🚨👉📌📢\s]+/, "")
      .trim();
    if (title.length > 120) {
      const cut = title.slice(0, 115);
      const lastSpace = cut.lastIndexOf(" ");
      title = (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
    }
  }

  // Extract lead (first 2-3 lines for card preview)
  const lead = rawLines.slice(0, 3).join(" ").slice(0, 220);

  // Photos (extract from photo wrap only to avoid emoji badges)
  const photos = [];
  const photoWrapRegex = /tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:url\('([^']+)'\)/g;
  let pm;
  while ((pm = photoWrapRegex.exec(block)) !== null) {
    const url = pm[1];
    if (!url.includes("telegram.org/img/emoji") && !photos.includes(url)) {
      photos.push(url);
    }
  }

  // Video
  const videoMatch = block.match(/<video[^>]*src="([^"]+)"/);
  const videoUrl = videoMatch ? videoMatch[1] : null;

  // Video thumbnail / duration
  const videoThumbMatch = block.match(/tgme_widget_message_video_thumb[\s\S]*?background-image:url\('([^']+)'\)/i);
  const videoThumb = videoThumbMatch ? videoThumbMatch[1] : null;

  const videoDurationMatch = block.match(/message_video_duration[^>]*>([^<]+)<\/time>/i);
  const videoDuration = videoDurationMatch ? videoDurationMatch[1].trim() : null;

  // Link preview
  let linkPreview = null;
  const linkPreviewMatch = block.match(/<a class="tgme_widget_message_link_preview"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (linkPreviewMatch) {
    const url = linkPreviewMatch[1];
    const siteNameMatch = linkPreviewMatch[2].match(/<div class="link_preview_site_name"[^>]*>([^<]+)<\/div>/);
    const titleMatch = linkPreviewMatch[2].match(/<div class="link_preview_title"[^>]*>([^<]+)<\/div>/);
    const descMatch = linkPreviewMatch[2].match(/<div class="link_preview_description"[^>]*>([^<]+)<\/div>/);
    // Discard preview if it points to a Telegram channel
    if (!/https?:\/\/(?:t|telegram)\.me/i.test(url)) {
      linkPreview = {
        url,
        siteName: siteNameMatch ? siteNameMatch[1].trim() : "",
        title: titleMatch ? titleMatch[1].trim() : "",
        description: descMatch ? descMatch[1].trim() : "",
      };
    }
  }

  // Extract hashtags
  const tags = [...plainText.matchAll(/#([a-zA-Z0-9_а-яА-ЯўқғҳЎҚҒҲ]+)/g)].map((m) => `#${m[1]}`);

  const category = inferCategory(plainText);
  const timeFormatted = formatUzbekTime(datetime);

  return {
    id,
    postFullId,
    title,
    lead,
    text: plainText,
    html: rawHtml,
    photos,
    videoUrl,
    videoThumb,
    videoDuration,
    linkPreview,
    datetime,
    timeFormatted,
    views,
    category,
    tags,
    telegramUrl: `https://t.me/${postFullId}`,
    sourceChannel: CHANNEL_USERNAME,
  };
}

/**
 * Fetch and parse posts from Telegram public web preview
 */
async function fetchTelegramPosts(beforeId = null) {
  const url = beforeId ? `${CHANNEL_URL}?before=${beforeId}` : CHANNEL_URL;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "uz,en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error(`Telegram channel preview HTTP ${res.status}`);
  }

  const html = await res.text();
  const blocks = html.split(/<div class="tgme_widget_message_wrap[^"]*"[^>]*>/);
  const posts = [];

  for (let i = 1; i < blocks.length; i++) {
    const post = parseMessageBlock(blocks[i]);
    if (post) {
      posts.push(post);
      _postIndex.set(post.id, post);
    }
  }

  // Sort descending by ID (newest first)
  posts.sort((a, b) => b.id - a.id);

  // Determine next older post ID for pagination
  let nextBefore = null;
  if (posts.length > 0) {
    const oldestId = posts[posts.length - 1].id;
    nextBefore = oldestId > 1 ? oldestId : null;
  }

  return { posts, nextBefore };
}

/**
 * Ingest live post from Telegram Webhook (update.channel_post)
 */
function ingestWebhookPost(channelPost) {
  if (!channelPost || !channelPost.message_id) return null;

  const id = channelPost.message_id;
  const text = channelPost.text || channelPost.caption || "";
  const dateIso = channelPost.date ? new Date(channelPost.date * 1000).toISOString() : new Date().toISOString();

  // Extract photos
  const photos = [];
  if (Array.isArray(channelPost.photo) && channelPost.photo.length > 0) {
    // Note: webhook provides file_id; we can form proxy/cdn link or use getFile if bot token present
    const bestPhoto = channelPost.photo[channelPost.photo.length - 1];
    if (bestPhoto.file_id) {
      photos.push(`/api/news?media=photo&fileId=${bestPhoto.file_id}`);
    }
  }

  // Extract video
  let videoUrl = null;
  if (channelPost.video?.file_id) {
    videoUrl = `/api/news?media=video&fileId=${channelPost.video.file_id}`;
  }

  const cleanText = text
    .replace(/https?:\/\/(?:t|telegram)\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/https?:\/\/t\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/\bt\.me\/[a-zA-Z0-9_+/]+/gi, "")
    .replace(/@tezkorofficial_uz\b/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  const rawLines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
  let title = rawLines[0] || "Tezkor xabar";
  title = title.replace(/^[🔊🔴⚡️🔥🌤⚽️🚨👉📌📢\s]+/, "").trim();
  if (title.length > 120) title = title.slice(0, 115) + "...";

  const post = {
    id,
    postFullId: `${CHANNEL_USERNAME}/${id}`,
    title,
    lead: rawLines.slice(0, 3).join(" ").slice(0, 220),
    text: cleanText,
    html: cleanText.replace(/\n/g, "<br>"),
    photos,
    videoUrl,
    videoThumb: null,
    videoDuration: channelPost.video?.duration ? `${channelPost.video.duration}s` : null,
    linkPreview: null,
    datetime: dateIso,
    timeFormatted: formatUzbekTime(dateIso),
    views: "1",
    category: inferCategory(cleanText),
    tags: [...cleanText.matchAll(/#([a-zA-Z0-9_а-яА-ЯўқғҳЎҚҒҲ]+)/g)].map((m) => `#${m[1]}`),
    telegramUrl: `https://t.me/${CHANNEL_USERNAME}/${id}`,
    sourceChannel: CHANNEL_USERNAME,
  };

  _postIndex.set(post.id, post);

  // Prepend to latest cache if exists
  if (_latestPostsCache.posts.length > 0) {
    const existingIdx = _latestPostsCache.posts.findIndex((p) => p.id === id);
    if (existingIdx >= 0) {
      _latestPostsCache.posts[existingIdx] = post;
    } else {
      _latestPostsCache.posts.unshift(post);
    }
  }

  return post;
}

/**
 * Main query function for news
 */
async function getNews({ before = null, limit = 15, q = "", category = "", id = null, force = false } = {}) {
  // If specific post requested by ID
  if (id) {
    const numericId = parseInt(id, 10);
    if (_postIndex.has(numericId) && !force) {
      return { ok: true, post: _postIndex.get(numericId) };
    }
    // Fetch latest and check
    const { posts } = await fetchTelegramPosts();
    const found = _postIndex.get(numericId) || posts.find((p) => p.id === numericId) || null;
    return { ok: !!found, post: found };
  }

  let posts = [];
  let nextBefore = null;
  const now = Date.now();

  if (before) {
    const cacheKey = `before_${before}`;
    const cached = _pageCache.get(cacheKey);
    if (cached && !force && now - cached.timestamp < HISTORICAL_TTL_MS) {
      posts = cached.posts;
      nextBefore = cached.nextBefore;
    } else {
      const res = await fetchTelegramPosts(before);
      posts = res.posts;
      nextBefore = res.nextBefore;
      _pageCache.set(cacheKey, { timestamp: now, posts, nextBefore });
    }
  } else {
    // Latest posts
    if (!force && now - _latestPostsCache.timestamp < CACHE_TTL_MS && _latestPostsCache.posts.length > 0) {
      posts = _latestPostsCache.posts;
      nextBefore = _latestPostsCache.nextBefore;
    } else {
      const res = await fetchTelegramPosts();
      posts = res.posts;
      nextBefore = res.nextBefore;
      _latestPostsCache = { timestamp: now, posts, nextBefore };
    }
  }

  // Filter by search query if provided
  if (q && q.trim()) {
    const query = q.trim().toLowerCase();
    posts = posts.filter((p) =>
      p.title.toLowerCase().includes(query) ||
      p.text.toLowerCase().includes(query) ||
      p.tags.some((t) => t.toLowerCase().includes(query))
    );
  }

  // Filter by category if provided
  if (category && category.trim() && category !== "Barchasi") {
    const cat = category.trim().toLowerCase();
    posts = posts.filter((p) => p.category.toLowerCase().includes(cat));
  }

  // Apply limit
  const numLimit = Math.min(Math.max(parseInt(limit, 10) || 15, 1), 50);
  const slicedPosts = posts.slice(0, numLimit);

  return {
    ok: true,
    channel: CHANNEL_USERNAME,
    channelTitle: "Tezkor uz | Расмий канал",
    channelUrl: `https://t.me/${CHANNEL_USERNAME}`,
    posts: slicedPosts,
    totalCount: posts.length,
    nextBefore,
    hasMore: Boolean(nextBefore && posts.length >= numLimit),
    cachedAt: new Date().toISOString(),
  };
}

module.exports = {
  getNews,
  ingestWebhookPost,
  inferCategory,
  formatUzbekTime,
  CHANNEL_USERNAME,
};
