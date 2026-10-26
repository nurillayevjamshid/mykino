const { authorizeRequest, requireAdmin } = require("./_lib/auth");
const {
  getDriveConfig,
  getDriveFileMetadata,
  isServiceAccountStorageQuotaError,
  listAdVideos,
  readCatalogMetadata,
  readCatalogMetadataStrict,
  updateDriveFileMetadata,
  writeCatalogMetadata,
} = require("./_lib/google-drive");

const SETTINGS_META_START = "[MY_KINO_SETTINGS]";
const SETTINGS_META_END = "[/MY_KINO_SETTINGS]";
const DRIVE_DESCRIPTION_MAX_LENGTH = 28000;

async function readRequestBody(request) {
  if (request.body && Buffer.isBuffer(request.body)) {
    return JSON.parse(request.body.toString("utf8"));
  }

  if (request.body && typeof request.body === "string") {
    return JSON.parse(request.body);
  }

  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }

  return raw ? JSON.parse(raw) : {};
}

function trimString(value) {
  return String(value || "").trim();
}

function normalizeRawUrl(value) {
  const raw = trimString(value).replace(/^["']+|["']+$/g, "");
  const protocolMatch = raw.match(/https?:\/\/.+/i);
  return protocolMatch ? protocolMatch[0].trim() : raw;
}

function normalizePublicImageUrl(value) {
  const raw = normalizeRawUrl(value);
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:[a-z0-9-]+\.)*(?:public\.)?blob\.vercel-storage\.com\//i.test(raw)) {
    return `https://${raw}`;
  }
  if (raw.startsWith("/")) return raw;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    const error = new Error("Rasm URL noto'g'ri. Vercel Blob'dan olingan https linkni kiriting.");
    error.statusCode = 400;
    throw error;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    const error = new Error("Rasm URL faqat http yoki https bo'lishi kerak.");
    error.statusCode = 400;
    throw error;
  }

  return parsed.href;
}

function readStoredPublicImageUrl(value) {
  try {
    return normalizePublicImageUrl(value);
  } catch {
    return "";
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function extractFolderSettings(description) {
  const rawDescription = String(description || "");
  const startIndex = rawDescription.indexOf(SETTINGS_META_START);
  const endIndex = rawDescription.indexOf(SETTINGS_META_END);
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) return {};

  const jsonText = rawDescription
    .slice(startIndex + SETTINGS_META_START.length, endIndex)
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    const settings = parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
    return settings && typeof settings === "object" ? settings : {};
  } catch {
    return {};
  }
}

function buildFolderDescriptionWithSettings(description, settings) {
  const rawDescription = String(description || "");
  const block = [
    SETTINGS_META_START,
    JSON.stringify({ version: 1, settings }),
    SETTINGS_META_END,
  ].join("\n");
  const startIndex = rawDescription.indexOf(SETTINGS_META_START);
  const endIndex = rawDescription.indexOf(SETTINGS_META_END);
  const hasExistingBlock = startIndex !== -1 && endIndex !== -1 && endIndex > startIndex;
  const prefix = hasExistingBlock ? rawDescription.slice(0, startIndex).trimEnd() : rawDescription.trimEnd();
  const suffix = hasExistingBlock ? rawDescription.slice(endIndex + SETTINGS_META_END.length).trimStart() : "";
  const nextDescription = [prefix, block, suffix].filter(Boolean).join("\n\n");

  if (nextDescription.length > DRIVE_DESCRIPTION_MAX_LENGTH) {
    const error = new Error("Sozlamalarni Drive papka descriptioniga saqlash uchun joy yetmadi.");
    error.statusCode = 400;
    throw error;
  }

  return nextDescription;
}

async function readFolderSettings() {
  const { folderId } = getDriveConfig();
  const folder = await getDriveFileMetadata(folderId, "id,name,description");
  return extractFolderSettings(folder.description);
}

async function writeFolderSettings(nextSettings) {
  const { folderId } = getDriveConfig();
  const folder = await getDriveFileMetadata(folderId, "id,name,description");
  const currentSettings = extractFolderSettings(folder.description);
  const settings = { ...currentSettings, ...nextSettings };
  const description = buildFolderDescriptionWithSettings(folder.description, settings);

  await updateDriveFileMetadata(
    folderId,
    { description },
    "id,name,description,modifiedTime",
  );

  return settings;
}

function normalizeAdLinkUrl(value) {
  let raw = trimString(value);
  if (!raw) return "";

  // `@username` → Telegram havolasi
  if (/^@[a-z0-9_]{3,}$/i.test(raw)) {
    raw = `https://t.me/${raw.slice(1)}`;
  }

  // `tg://...` o'z holicha qabul qilinadi
  if (/^tg:\/\//i.test(raw)) {
    return raw;
  }

  // Protokolsiz yozilgan bo'lsa, https qo'shamiz (`t.me/...`, `example.com`)
  if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(raw)) {
    raw = `https://${raw.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    // Bo'sh host (masalan `https:///foo`) qabul qilinmaydi
    if (!parsed.hostname || !/\./.test(parsed.hostname)) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function isTelegramUrl(value) {
  const raw = trimString(value);
  if (!raw) return false;
  if (/^tg:\/\//i.test(raw)) return true;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return /^(?:[a-z0-9-]+\.)*(?:t|telegram)\.me$/i.test(parsed.hostname);
  } catch {
    return false;
  }
}

function normalizeAdTelegramUrl(value) {
  const raw = normalizeAdLinkUrl(value);
  if (!raw) return "";
  return isTelegramUrl(raw) ? raw : "";
}

function normalizeAdWebsiteUrl(value) {
  const raw = normalizeAdLinkUrl(value);
  if (!raw) return "";
  return isTelegramUrl(raw) ? "" : raw;
}

function normalizeAd(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  // Backward-compat: agar yangi maydonlar bo'sh bo'lsa, eski `linkUrl`dan ajratib chiqar
  const legacy = normalizeAdLinkUrl(source.linkUrl);
  const telegramUrl = normalizeAdTelegramUrl(source.telegramUrl) || (legacy && isTelegramUrl(legacy) ? legacy : "");
  const websiteUrl = normalizeAdWebsiteUrl(source.websiteUrl) || (legacy && !isTelegramUrl(legacy) ? legacy : "");
  return {
    enabled: Boolean(source.enabled),
    imageUrl: readStoredPublicImageUrl(source.imageUrl),
    telegramUrl,
    websiteUrl,
    // linkUrl — frontend qulayligi uchun (eski kod ushlasin): TG bo'lsa TG, aks holda website
    linkUrl: telegramUrl || websiteUrl,
    buttonText: trimString(source.buttonText).slice(0, 40),
  };
}

function normalizeTicker(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const speedRaw = Number(source.speed);
  const speed = Number.isFinite(speedRaw) ? Math.max(5, Math.min(120, Math.round(speedRaw))) : 20;
  const fontSizeRaw = Number(source.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? Math.max(10, Math.min(32, Math.round(fontSizeRaw))) : 14;
  return {
    enabled: Boolean(source.enabled),
    text: trimString(source.text).slice(0, 1000),
    linkUrl: normalizeAdLinkUrl(source.linkUrl),
    bgColor: trimString(source.bgColor || "linear-gradient(135deg, #e50914, #990000)").slice(0, 160),
    textColor: trimString(source.textColor || "#ffffff").slice(0, 40),
    fontFamily: trimString(source.fontFamily || "Montserrat").slice(0, 80),
    speed,
    fontSize,
    fontWeight: trimString(source.fontWeight || "600").slice(0, 20),
  };
}

function normalizePreRollVideoUrl(value) {
  const raw = trimString(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function normalizePreRollAd(raw, adCdnMap = null) {
  const source = raw && typeof raw === "object" ? raw : {};
  const skipRaw = Number(source.skipAfter);
  const skipAfter = Number.isFinite(skipRaw) ? Math.max(0, Math.min(60, Math.round(skipRaw))) : 5;
  const videoDriveId = trimString(source.videoDriveId).slice(0, 100);
  let cdnUrl = "";
  if (adCdnMap && typeof adCdnMap === "object" && videoDriveId) {
    cdnUrl = normalizePreRollVideoUrl(adCdnMap[videoDriveId]);
  }
  return {
    enabled: Boolean(source.enabled),
    videoDriveId,
    videoUrl: normalizePreRollVideoUrl(source.videoUrl),
    cdnUrl,
    linkUrl: normalizeAdLinkUrl(source.linkUrl),
    skipAfter,
  };
}

const DEFAULT_FIFA_STREAMS = [
  { id: "varzish-live", title: "Varzish TV", url: "http://server.sibfungold.info:8080/live/pacha-man1/e0VaVPskUa/48687.m3u8", enabled: true },
  { id: "youtube-live", title: "YouTube jonli efir", url: "https://www.youtube.com/live/BUEGXoCVl7w?si=TGQo6e3C51k8tWvL", enabled: false },
  { id: "vk-live", title: "VK Video jonli efir", url: "https://live.vkvideo.ru/channel30008599/stream/sl_393740", enabled: false },
];
function normalizeFifaStreamUrl(value) {
  const raw = trimString(value); if (!raw) return { url: "", provider: "" };
  const yt = raw.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([\w-]{10,12})/i);
  if (yt) return { url: `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`, provider: "youtube" };
  try { const parsed = new URL(raw); const host = parsed.hostname.toLowerCase();
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (/\.m3u8(?:$|\?)/i.test(parsed.pathname) || parsed.pathname.endsWith(".m3u8")) {
        return { url: parsed.toString().slice(0, 800), provider: "hls" };
      }
    }
    if (/\/video_ext\.php$/i.test(parsed.pathname)) return { url: parsed.toString().slice(0, 800), provider: "vk" };
    // VK Video Live: /<kanal>/stream/<efir> → /app/embed/<kanal>/stream/<efir>.
    // Efir ID'si tashlab yuborilsa embed faqat kanalning asosiy efirini ko'rsatadi
    // va boshqa efir ketayotgan bo'lsa ham "Стример не в сети" chiqadi.
    if (host === "live.vkvideo.ru" || host.endsWith(".live.vkvideo.ru")) {
      if (/^\/app\/embed\/[^/]+/i.test(parsed.pathname)) return { url: `https://live.vkvideo.ru${parsed.pathname.replace(/\/+$/, "")}`, provider: "vk" };
      const m = parsed.pathname.match(/^\/([^/]+)(?:\/stream\/([^/]+))?\/?$/i);
      if (m && m[1].toLowerCase() !== "app") return { url: `https://live.vkvideo.ru/app/embed/${encodeURIComponent(m[1])}${m[2] ? `/stream/${encodeURIComponent(m[2])}` : ""}`, provider: "vk" };
    }
    if (host.endsWith(".vkvideo.ru") || host === "vkvideo.ru" || host === "vk.com" || host.endsWith(".vk.com") || host === "vk.ru" || host.endsWith(".vk.ru")) {
      const videoMatch = parsed.pathname.match(/^\/video(-?\d+)_([0-9]+)$/i);
      if (videoMatch) {
        const ownerId = videoMatch[1].startsWith("-") ? videoMatch[1] : `-${videoMatch[1]}`;
        const params = new URLSearchParams();
        params.set("oid", ownerId);
        params.set("id", videoMatch[2]);
        if (parsed.searchParams.has("hash")) params.set("hash", parsed.searchParams.get("hash"));
        return { url: `https://vk.ru/video_ext.php?${params.toString()}`, provider: "vk" };
      }
      return { url: parsed.toString().slice(0, 800), provider: "vk" };
    }
  } catch (_) {}
  return { url: "", provider: "" };
}
function normalizeFifaStreams(raw) {
  const list = raw === undefined ? DEFAULT_FIFA_STREAMS : (Array.isArray(raw) ? raw : []);
  return list.slice(0,8).map((item,index) => { const source = typeof item === "string" ? {url:item} : (item && typeof item === "object" ? item : {}); const normalized=normalizeFifaStreamUrl(source.originalUrl || source.url || source.link); return { id:trimString(source.id || `fifa-stream-${index+1}`).slice(0,80), title:trimString(source.title || (normalized.provider === "vk" ? "VK Video jonli efir" : normalized.provider === "hls" ? "Varzish TV / HLS Live" : "YouTube jonli efir")).slice(0,120), url:normalized.url, originalUrl:trimString(source.originalUrl || source.url || source.link).slice(0,800), provider:normalized.provider, enabled:source.enabled !== false }; }).filter((item)=>item.url && item.provider && item.enabled);
}
function normalizeEsportsStartAt(value) {
  const raw = trimString(value);
  if (!raw) return "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

// Kibersport strimi uchun YouTube havolasini normallashtirish.
// Admin panelga turli ko'rinishda yozilishi mumkin:
//   https://www.youtube.com/watch?v=ID   https://youtu.be/ID
//   https://www.youtube.com/live/ID      https://www.youtube.com/embed/ID
//   https://www.youtube.com/shorts/ID    youtube.com/live/ID (sxemasiz)
//   ID (11 belgili toza video ID)
// Har qanday holatda ham kanonik "watch?v=ID" havolasi qaytariladi, aks holda "".
// Ilgari bu yerda oddiy URL validatsiyasi ishlatilardi: sxemasiz havola yoki
// toza ID "" ga aylanib, admin panelda "Saqlandi" deyilsa-da strim chiqmasdi.
function normalizeEsportsYoutubeUrl(value) {
  const raw = trimString(value);
  if (!raw) return "";

  // YouTube video ID doim 11 belgi. Faqat shu holatda toza ID deb qabul qilamiz
  // (aks holda "not-a-link" kabi matn ham ID bo'lib qolib, buzuq strim chiqadi).
  if (/^[\w-]{11}$/.test(raw)) {
    return `https://www.youtube.com/watch?v=${raw}`;
  }

  const match = raw.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([\w-]{10,12})/
  );
  if (match) return `https://www.youtube.com/watch?v=${match[1]}`;

  // YouTube'ga o'xshamaydigan havola — eski xatti-harakat saqlanadi
  // (masalan, o'z HLS/embed manzili), lekin faqat to'g'ri http(s) bo'lsa.
  return normalizePreRollVideoUrl(raw).slice(0, 500);
}

function normalizeEsportsStreams(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const defaults = [
    { key: "cs", label: "CS2" },
    { key: "pubg", label: "PUBG Mobile" },
    { key: "clash", label: "Clash of Clans" },
  ];
  return defaults.reduce((result, base) => {
    const item = source[base.key] && typeof source[base.key] === "object" ? source[base.key] : {};
    const highlights = Array.isArray(item.highlights) ? item.highlights : [];
    result[base.key] = {
      key: base.key,
      label: trimString(item.label || base.label).slice(0, 60),
      title: trimString(item.title).slice(0, 120),
      meta: trimString(item.meta).slice(0, 160),
      youtubeUrl: normalizeEsportsYoutubeUrl(item.youtubeUrl).slice(0, 500),
      startAt: normalizeEsportsStartAt(item.startAt),
      isLive: Boolean(item.isLive),
      enabled: item.enabled !== false,
      highlights: highlights.slice(0, 6).map((highlight) => ({
        title: trimString(highlight?.title).slice(0, 120),
        subtitle: trimString(highlight?.subtitle).slice(0, 160),
        youtubeUrl: normalizeEsportsYoutubeUrl(highlight?.youtubeUrl).slice(0, 500),
      })),
    };
    return result;
  }, {});
}
async function readPersistedSettings(settings) {
  if (
    hasOwn(settings, "splashImageUrl") ||
    hasOwn(settings, "ad") ||
    hasOwn(settings, "ticker") ||
    hasOwn(settings, "preRollAd") ||
    hasOwn(settings, "fifaHighlightsChannel") ||
    hasOwn(settings, "fifaStreams") ||
    hasOwn(settings, "esportsStreams")
  ) {
    return {
      splashImageUrl: readStoredPublicImageUrl(settings.splashImageUrl),
      ad: normalizeAd(settings.ad),
      ticker: normalizeTicker(settings.ticker),
      preRollAd: normalizePreRollAd(settings.preRollAd, settings.adCdn),
      fifaHighlightsChannel: trimString(settings.fifaHighlightsChannel || "").slice(0, 500),
      fifaStreams: normalizeFifaStreams(settings.fifaStreams),
      esportsStreams: normalizeEsportsStreams(settings.esportsStreams),
    };
  }

  try {
    const folderSettings = await readFolderSettings();
    return {
      splashImageUrl: readStoredPublicImageUrl(folderSettings.splashImageUrl),
      ad: normalizeAd(folderSettings.ad),
      ticker: normalizeTicker(folderSettings.ticker),
      preRollAd: normalizePreRollAd(folderSettings.preRollAd, folderSettings.adCdn),
      fifaHighlightsChannel: trimString(folderSettings.fifaHighlightsChannel || "").slice(0, 500),
      fifaStreams: normalizeFifaStreams(folderSettings.fifaStreams),
      esportsStreams: normalizeEsportsStreams(folderSettings.esportsStreams),
    };
  } catch {
    return {
      splashImageUrl: "",
      ad: normalizeAd(null),
      ticker: normalizeTicker(null),
      preRollAd: normalizePreRollAd(null),
      fifaHighlightsChannel: "https://www.youtube.com/@qsportuzbekistan/videos",
      fifaStreams: normalizeFifaStreams(undefined),
      esportsStreams: normalizeEsportsStreams(null),
    };
  }
}

module.exports = async function handler(request, response) {
  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    if (!(await requireAdmin(request, response))) return;
  } else if (!(await authorizeRequest(request, response))) {
    return;
  }

  if (request.method === "GET") {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  } else {
    response.setHeader("Cache-Control", "no-store, max-age=0");
  }

  // GET ?action=debug-r2 — R2_PUBLIC_URL domeni tekshiruvi (HTML page, telefonda ochiladi)
  if (request.method === "GET") {
    const debugUrl = new URL(request.url || "/", "http://localhost");
    if (debugUrl.searchParams.get("action") === "debug-r2") {
      const raw = String(process.env.R2_PUBLIC_URL || "").trim();
      let domain = "(bo'sh)";
      let kind = "BELGISIZ";
      try {
        const u = new URL(raw);
        domain = u.host;
        if (/\.r2\.dev$/i.test(u.host)) kind = "BEPUL r2.dev (throttle) — custom domenga ko'chiring";
        else kind = "CUSTOM domen (yaxshi) — Cache Rule qo'shsangiz to'liq tezlik";
      } catch (_) {}
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.status(200).send(
        `<!doctype html><meta name=viewport content="width=device-width">`
        + `<body style="font:16px system-ui;padding:20px;line-height:1.5">`
        + `<h2>R2 Debug</h2>`
        + `<p><b>R2_PUBLIC_URL domen:</b><br><code style="background:#eee;padding:6px;display:inline-block;word-break:break-all">${domain}</code></p>`
        + `<p><b>Holat:</b> ${kind}</p>`
        + `</body>`
      );
      return;
    }
  }

  // GET ?action=ad-videos — Drive'dagi "reklama" papkasidagi videolar ro'yxati
  if (request.method === "GET") {
    const url = new URL(request.url || "/", "http://localhost");
    if (url.searchParams.get("action") === "ad-videos") {
      try {
        // Bu endpoint javobi sezilarli o'zgarmagani uchun 60s kesh
        response.setHeader("Cache-Control", "private, max-age=0, s-maxage=60, stale-while-revalidate=300");
        const videos = await listAdVideos();
        response.status(200).json({ ok: true, videos });
      } catch (err) {
        response.status(err.statusCode || 500).json({ ok: false, error: err.message, videos: [] });
      }
      return;
    }
  }

  try {
    // POST butun katalog faylini qayta yozadi — strict o'qish shart, aks holda
    // vaqtinchalik o'qish xatosi barcha posterlar/sozlamalarni o'chirib yuboradi.
    const metadataState = request.method === "POST"
      ? await readCatalogMetadataStrict()
      : await readCatalogMetadata();
    const settings = metadataState.data.settings || {};

    if (request.method === "GET") {
      response.status(200).json(await readPersistedSettings(settings));
      return;
    }

    if (request.method === "POST") {
      if (!(await requireAdmin(request, response))) return;
      const body = await readRequestBody(request);
      const nextSettings = { ...settings };

      if (hasOwn(body, "splashImageUrl")) {
        nextSettings.splashImageUrl = normalizePublicImageUrl(body.splashImageUrl || "");
      }

      if (hasOwn(body, "ad")) {
        const incomingAd = body.ad && typeof body.ad === "object" ? body.ad : {};
        const telegramUrl = normalizeAdTelegramUrl(incomingAd.telegramUrl || "");
        const websiteUrl = normalizeAdWebsiteUrl(incomingAd.websiteUrl || "");
        nextSettings.ad = {
          enabled: Boolean(incomingAd.enabled),
          imageUrl: incomingAd.imageUrl ? normalizePublicImageUrl(incomingAd.imageUrl) : "",
          telegramUrl,
          websiteUrl,
          linkUrl: telegramUrl || websiteUrl,
          buttonText: trimString(incomingAd.buttonText).slice(0, 40),
        };
      }

      if (hasOwn(body, "ticker")) {
        nextSettings.ticker = normalizeTicker(body.ticker);
      }

      if (hasOwn(body, "preRollAd")) {
        nextSettings.preRollAd = normalizePreRollAd(body.preRollAd);
      }

      if (hasOwn(body, "fifaHighlightsChannel")) {
        nextSettings.fifaHighlightsChannel = trimString(body.fifaHighlightsChannel).slice(0, 500);
      }
      if (hasOwn(body, "fifaStreams")) {
        nextSettings.fifaStreams = normalizeFifaStreams(body.fifaStreams);
      }
      if (hasOwn(body, "esportsStreams")) {
        const incoming = body.esportsStreams && typeof body.esportsStreams === "object" ? body.esportsStreams : {};
        nextSettings.esportsStreams = normalizeEsportsStreams(incoming);
      }
      if (hasOwn(body, "esportsStreamsPatch")) {
        const patch = body.esportsStreamsPatch && typeof body.esportsStreamsPatch === "object" ? body.esportsStreamsPatch : {};
        const current = normalizeEsportsStreams(nextSettings.esportsStreams);
        Object.entries(patch).forEach(([key, value]) => {
          if (!current[key] || !value || typeof value !== "object") return;
          current[key] = { ...current[key], ...value };
          current[key].highlights = value.highlights === undefined ? current[key].highlights : value.highlights;
        });
        nextSettings.esportsStreams = normalizeEsportsStreams(current);
      }

      metadataState.data.settings = nextSettings;
      try {
        await writeCatalogMetadata(metadataState.data, metadataState.file);
      } catch (error) {
        if (!isServiceAccountStorageQuotaError(error)) {
          throw error;
        }

        await writeFolderSettings(metadataState.data.settings);
      }

      response.status(200).json({
        ok: true,
        splashImageUrl: nextSettings.splashImageUrl || "",
        ad: normalizeAd(nextSettings.ad),
        ticker: normalizeTicker(nextSettings.ticker),
        preRollAd: normalizePreRollAd(nextSettings.preRollAd),
        fifaHighlightsChannel: nextSettings.fifaHighlightsChannel || "",
        fifaStreams: normalizeFifaStreams(nextSettings.fifaStreams),
        esportsStreams: normalizeEsportsStreams(nextSettings.esportsStreams),
      });
      return;
    }

    response.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    response.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
};

module.exports.normalizeFifaStreamUrl = normalizeFifaStreamUrl;
module.exports.normalizeFifaStreams = normalizeFifaStreams;
