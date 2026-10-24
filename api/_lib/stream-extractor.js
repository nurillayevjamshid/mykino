/**
 * Universal Football Stream Extractor & Web Scraper for MyKino
 * -------------------------------------------------------------
 * Barcha turdagi translatsiya manzillarini tahlil qiladi:
 * 1. YouTube Live / Shorts / Watch
 * 2. HLS (.m3u8) va Cloudflare WHEP (WebRTC)
 * 3. <iframe> kodi yoki embed player URL
 * 4. Uchinchi tomon veb-sayt havolalari (masalan, world-cup.su, Liveball, LiveTV va h.k.)
 */

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'uz-UZ,uz;q=0.9,ru-RU,ru;q=0.8,en-US;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache'
};

const AD_DOMAINS = [
  'googleads', 'doubleclick', 'googlesyndication', 'adservice', 'yandex.ru/ads',
  'adsystem', 'banner', 'popads', 'propellerads', 'exoclick', 'counter', 'analytics', 'tutbet'
];

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch (_) {
    return relative;
  }
}

function extractYouTube(input) {
  if (!input || typeof input !== 'string') return null;
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{6,20})/i);
  if (match && match[1]) {
    const videoId = match[1];
    return {
      success: true,
      type: 'youtube',
      stream_url: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
      video_id: videoId,
      original_url: input
    };
  }
  return null;
}

function extractDirectHls(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/\.m3u8(\?.*)?$/i.test(trimmed) || /https?:\/\/[^\s"'<>]+\.m3u8(\?[^\s"'<>]*)?/i.test(trimmed)) {
    const m = trimmed.match(/(https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/i);
    return {
      success: true,
      type: 'hls',
      stream_url: m ? m[1] : trimmed,
      original_url: input
    };
  }
  return null;
}

function extractDirectWhep(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/\/webRTC\/play(\?.*)?$/i.test(trimmed)) {
    return {
      success: true,
      type: 'whep',
      stream_url: trimmed,
      original_url: input
    };
  }
  return null;
}

/**
 * VK Video Live (live.vkvideo.ru) va VK Embed havolalarini tahlil qilish
 * To'g'ridan-to'g'ri toza HLS (.m3u8) oqimini ajratib oladi (VPN va mobil cheklovsiz ishlashi uchun)
 */
async function extractVkVideo(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // live.vkvideo.ru (masalan, https://live.vkvideo.ru/channel36642664/stream/sl_396583 yoki embed)
  if (trimmed.includes('live.vkvideo.ru')) {
    let target = trimmed;
    if (target.includes('<iframe')) {
      const m = target.match(/src=["']([^"']+)["']/i);
      if (m && m[1]) target = m[1].trim();
    }
    if (target.includes('/app/embed/')) {
      target = target.replace('/app/embed/', '/');
    }
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(target, {
        signal: controller.signal,
        headers: {
          'User-Agent': DEFAULT_HEADERS['User-Agent'],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://live.vkvideo.ru/'
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const html = await res.text();
        const m = html.match(/"type"\s*:\s*"live_hls"\s*,\s*"url"\s*:\s*"([^"]+)"/i)
               || html.match(/"url"\s*:\s*"([^"]+)"\s*,\s*"type"\s*:\s*"live_hls"/i)
               || html.match(/(https?:\\\/\\\/[a-zA-Z0-9_\-\.]+\.okcdn\.ru\\\/hls\\\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/i)
               || html.match(/(https?:\/\/[a-zA-Z0-9_\-\.]+\.okcdn\.ru\/hls\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/i);

        if (m && m[1]) {
          const directM3u8 = m[1].replace(/\\u002F/g, '/').replace(/\\/g, '');
          return {
            success: true,
            type: 'hls',
            stream_url: directM3u8,
            original_url: input
          };
        }
      }
    } catch (e) {
      console.warn('[VK Extractor] HTML tahlilida xato:', e.message);
    }

    // Agar jonli hls topilmasa, embed URL ga o'tamiz
    const chanMatch = trimmed.match(/live\.vkvideo\.ru\/(?:app\/embed\/)?([a-zA-Z0-9_.-]+)/i);
    return {
      success: true,
      type: 'iframe',
      stream_url: chanMatch && chanMatch[1] ? `https://live.vkvideo.ru/app/embed/${chanMatch[1]}?autoplay=true` : target,
      original_url: input
    };
  }

  // vk.com yoki vkvideo.ru video_ext.php embed
  if (trimmed.includes('vk.com/video_ext.php') || trimmed.includes('vkvideo.ru/video_ext.php')) {
    return {
      success: true,
      type: 'iframe',
      stream_url: trimmed,
      original_url: input
    };
  }

  return null;
}

function extractIframe(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // <iframe src="..."> kodi tashlangan bo'lsa
  if (trimmed.startsWith('<iframe') || trimmed.includes('<iframe')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let src = srcMatch[1].trim();
      if (src.startsWith('//')) src = 'https:' + src;

      const yt = extractYouTube(src);
      if (yt) return yt;

      const hls = extractDirectHls(src);
      if (hls) return hls;

      return {
        success: true,
        type: 'iframe',
        stream_url: src,
        original_url: input
      };
    }
  }

  // Tayyor embed / player URL
  if (/^(https?:\/\/[^\s"'<>]+(?:\/embed\/|\/player\/|\/player\.html|\/iframe\/|\/\?id=)[^\s"'<>]*)/i.test(trimmed)) {
    return {
      success: true,
      type: 'iframe',
      stream_url: trimmed,
      original_url: input
    };
  }

  return null;
}

function findM3u8InText(text, baseUrl = '') {
  if (!text || typeof text !== 'string') return null;

  // 1. To'g'ridan-to'g'ri .m3u8 manzili
  const m3u8Regex = /https?:\/\/[a-zA-Z0-9_\-\.\/:]+?\.(?:m3u8|mpd)(?:\?[a-zA-Z0-9_\-\.=&%~+]+)?/gi;
  const matches = text.match(m3u8Regex);
  if (matches && matches.length > 0) {
    for (const m of matches) {
      const isAd = AD_DOMAINS.some(ad => m.toLowerCase().includes(ad));
      if (!isAd) return m;
    }
  }

  // 2. Player konfiguratsiya scriptlari (Clappr, JWPlayer, Plyr, Video.js)
  const configRegexes = [
    /(?:file|source|src|url|hls|streamUrl|hlsUrl|stream_url)\s*[:=]\s*["'](?<url>https?:\/\/[^"']+\.(?:m3u8|mpd)[^"']*)["']/i,
    /(?:file|source|src|url|hls)\s*[:=]\s*["'](?<url>\/[^"']+\.(?:m3u8|mpd)[^"']*)["']/i,
    /var\s+(?:stream|hlsUrl|source|videoUrl)\s*=\s*["'](?<url>[^"']+\.(?:m3u8|mpd)[^"']*)["']/i
  ];

  for (const regex of configRegexes) {
    const match = text.match(regex);
    if (match && match.groups && match.groups.url) {
      let foundUrl = match.groups.url;
      if (foundUrl.startsWith('/') && baseUrl) {
        foundUrl = resolveUrl(baseUrl, foundUrl);
      }
      return foundUrl;
    }
  }

  // 3. Base64 orqali shifrlangan m3u8
  const base64Regex = /["']([A-Za-z0-9+/=]{24,})["']/g;
  let b64Match;
  while ((b64Match = base64Regex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(b64Match[1], 'base64').toString('utf-8');
      if (decoded.includes('.m3u8') || decoded.includes('.mpd')) {
        const found = decoded.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/i);
        if (found) return found[0];
      }
    } catch (_) {}
  }

  return null;
}

/**
 * 3-tomon veb-sayt sahifasidan video oqimini chuqur ajratib olish
 */
async function extractFromWebPage(pageUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(pageUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Referer': pageUrl
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    if (!html || typeof html !== 'string') return null;

    // a) Sahifadagi <video> va <source> teglari
    const videoSrcRegex = /<(?:video|source)[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
    let vMatch;
    while ((vMatch = videoSrcRegex.exec(html)) !== null) {
      let vSrc = vMatch[1];
      if (vSrc.includes('.m3u8') || vSrc.includes('.mpd')) {
        return {
          success: true,
          type: 'hls',
          stream_url: resolveUrl(pageUrl, vSrc),
          original_url: pageUrl
        };
      }
    }

    // b) Script va HTML ichidan to'g'ridan-to'g'ri .m3u8 qidirish
    const scriptM3u8 = findM3u8InText(html, pageUrl);
    if (scriptM3u8) {
      return {
        success: true,
        type: 'hls',
        stream_url: scriptM3u8,
        original_url: pageUrl
      };
    }

    // c) Iframe teglari
    const iframeRegex = /<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
    let ifMatch;
    const candidates = [];
    while ((ifMatch = iframeRegex.exec(html)) !== null) {
      let iSrc = ifMatch[1].trim();
      if (iSrc.startsWith('//')) iSrc = 'https:' + iSrc;
      const absSrc = resolveUrl(pageUrl, iSrc);

      const isAd = AD_DOMAINS.some(ad => absSrc.toLowerCase().includes(ad));
      if (!isAd) {
        let score = 0;
        const lower = absSrc.toLowerCase();
        if (lower.includes('player') || lower.includes('stream') || lower.includes('embed') || 
            lower.includes('cdn') || lower.includes('live') || lower.includes('wcp.su') || lower.includes('channel')) {
          score += 10;
        }
        candidates.push({ src: absSrc, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      const bestIframe = candidates[0].src;

      // Agar iframe'ning o'zi YouTube yoki HLS bo'lsa
      const yt = extractYouTube(bestIframe);
      if (yt) return yt;
      const hls = extractDirectHls(bestIframe);
      if (hls) return hls;

      // Iframe sahifasi ichiga chuqurroq kirib .m3u8 qidirish (1-darajali rekursiya)
      try {
        const nestedController = new AbortController();
        const nestedTimeout = setTimeout(() => nestedController.abort(), 4000);
        const ifRes = await fetch(bestIframe, {
          headers: { ...DEFAULT_HEADERS, 'Referer': pageUrl },
          signal: nestedController.signal
        });
        clearTimeout(nestedTimeout);
        if (ifRes.ok) {
          const ifHtml = await ifRes.text();
          const nestedM3u8 = findM3u8InText(ifHtml, bestIframe);
          if (nestedM3u8) {
            return {
              success: true,
              type: 'hls',
              stream_url: nestedM3u8,
              original_url: pageUrl
            };
          }
        }
      } catch (_) {}

      // Nested iframe ichida m3u8 bo'lmasa, toza player iframe URL'ini qaytaradi
      return {
        success: true,
        type: 'iframe',
        stream_url: bestIframe,
        original_url: pageUrl
      };
    }

    return null;
  } catch (err) {
    console.warn(`[StreamExtractor] Scraper xatosi: ${err.message}`);
    return null;
  }
}

/**
 * ASOSIY FUNKSIYA: Har qanday turdagi strim havolasini avtomatik aniqlash va ajratish
 */
async function extractStream(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string' || !inputUrl.trim()) {
    return {
      success: false,
      error: "Havola kiritilmadi.",
      original_url: inputUrl || ""
    };
  }

  const clean = inputUrl.trim();

  // 1. YouTube
  const yt = extractYouTube(clean);
  if (yt) return yt;

  // 1.5. VK Video Live (live.vkvideo.ru yoki vk.com/video_ext.php)
  const vk = extractVkVideo(clean);
  if (vk) return vk;

  // 2. To'g'ridan-to'g'ri HLS (.m3u8)
  const hls = extractDirectHls(clean);
  if (hls) return hls;

  // 3. Cloudflare WHEP (WebRTC)
  const whep = extractDirectWhep(clean);
  if (whep) return whep;

  // 4. Iframe kodi yoki embed URL
  const iframe = extractIframe(clean);
  if (iframe) return iframe;

  // 5. 3-tomon striming veb-sayt sahifasi (masalan: https://f8.world-cup.su/... yoki Liveball)
  let targetUrl = clean;
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const webResult = await extractFromWebPage(targetUrl);
  if (webResult && webResult.stream_url) {
    return webResult;
  }

  // Agar aniq video player topilmasa, veb-saytning o'zini iframe sifatida qabul qilamiz
  return {
    success: true,
    type: 'iframe',
    stream_url: targetUrl,
    original_url: clean
  };
}

module.exports = {
  extractStream,
  extractYouTube,
  extractVkVideo,
  extractDirectHls,
  extractDirectWhep,
  extractIframe,
  findM3u8InText
};
