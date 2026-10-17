const { Readable } = require("stream");
const { setCorsHeaders } = require("./_lib/auth");

let ytdl = null;
try {
  ytdl = require("@distube/ytdl-core");
} catch (_) {}

const INVIDIOUS_FALLBACKS = [
  "https://invidious.f5.si",
  "https://yt.chocolatemoo53.com",
  "https://invidious.nerdvpn.de",
  "https://inv.nadeko.net",
  "https://invidious.tiekoetter.com"
];

function extractVideoId(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (/^[\w-]{10,12}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([\w-]{10,12})/,
    /youtu\.be\/([\w-]{10,12})/,
    /youtube\.com\/embed\/([\w-]{10,12})/,
    /youtube\.com\/shorts\/([\w-]{10,12})/,
    /music\.youtube\.com\/watch\?v=([\w-]{10,12})/
  ];
  for (const re of patterns) {
    const m = re.exec(value);
    if (m) return m[1];
  }
  return "";
}

async function resolveViaInvidious(videoId) {
  for (const base of INVIDIOUS_FALLBACKS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}?local=true`, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.adaptiveFormats) continue;
      const m4a = data.adaptiveFormats.find(f => f.container === "m4a" || (f.type && f.type.includes("audio/mp4")));
      if (m4a?.url) return m4a.url;
      const anyAudio = data.adaptiveFormats.find(f => f.type && f.type.includes("audio"));
      if (anyAudio?.url) return anyAudio.url;
    } catch (_) {}
  }
  return null;
}

module.exports = async function handler(request, response) {
  setCorsHeaders(request, response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.status(405).json({ ok: false, error: "Faqat GET/HEAD." });
    return;
  }

  const rawId = request.query?.id || request.query?.v || request.query?.videoId || "";
  const videoId = extractVideoId(rawId);
  const directUrl = request.query?.url || "";

  if (directUrl && /\.(mp3|m4a|aac|ogg|wav)(\?.*)?$/i.test(directUrl)) {
    response.setHeader("Location", directUrl);
    response.status(302).end();
    return;
  }

  if (!videoId) {
    response.status(400).json({ ok: false, error: "YouTube video ID kerak." });
    return;
  }

  const wantsJson = request.query?.resolve === "1" || request.query?.format === "json";

  // 1. Agar @distube/ytdl-core mavjud bo'lsa
  if (ytdl && typeof ytdl.getInfo === "function") {
    try {
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const info = await ytdl.getInfo(ytUrl);
      const format = ytdl.chooseFormat(info.formats, {
        filter: "audioonly",
        quality: "highestaudio"
      });

      if (format && format.url) {
        if (wantsJson) {
          response.status(200).json({
            ok: true,
            videoId,
            audioUrl: format.url,
            container: format.container || "m4a",
            mimeType: format.mimeType || "audio/mp4"
          });
          return;
        }

        // To'g'ridan-to'g'ri audio stream redirect yoki Range-mos pipe
        if (request.query?.proxy === "1") {
          const mimeType = format.mimeType || "audio/mp4";
          const rangeHeader = request.headers.range;
          const contentLength = Number(format.contentLength || format.filesize || 0);

          if (rangeHeader) {
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10) || 0;
            const end = parts[1] ? parseInt(parts[1], 10) : (contentLength > 0 ? contentLength - 1 : undefined);

            const streamOptions = {
              filter: "audioonly",
              quality: "highestaudio",
              range: end !== undefined ? { start, end } : { start },
            };

            response.status(206);
            response.setHeader("Content-Type", mimeType);
            response.setHeader("Accept-Ranges", "bytes");
            response.setHeader("Cache-Control", "public, max-age=3600");
            if (contentLength > 0 && end !== undefined) {
              const chunksize = (end - start) + 1;
              response.setHeader("Content-Range", `bytes ${start}-${end}/${contentLength}`);
              response.setHeader("Content-Length", String(chunksize));
            }

            const stream = ytdl(ytUrl, streamOptions);
            stream.pipe(response);
            return;
          }

          response.setHeader("Content-Type", mimeType);
          response.setHeader("Accept-Ranges", "bytes");
          if (contentLength > 0) response.setHeader("Content-Length", contentLength);
          response.setHeader("Cache-Control", "public, max-age=3600");
          const stream = ytdl(ytUrl, { filter: "audioonly", quality: "highestaudio" });
          stream.pipe(response);
          return;
        }

        response.setHeader("Location", format.url);
        response.setHeader("Cache-Control", "public, max-age=3600");
        response.status(302).end();
        return;
      }
    } catch (err) {
      console.warn("ytdl-core error for", videoId, err.message);
    }
  }

  // 2. Invidious fallback
  try {
    const streamUrl = await resolveViaInvidious(videoId);
    if (streamUrl) {
      if (wantsJson) {
        response.status(200).json({ ok: true, videoId, audioUrl: streamUrl });
        return;
      }
      response.setHeader("Location", streamUrl);
      response.setHeader("Cache-Control", "public, max-age=1800");
      response.status(302).end();
      return;
    }
  } catch (err) {
    console.warn("Invidious fallback error:", err.message);
  }

  response.status(502).json({
    ok: false,
    code: "AUDIO_STREAM_UNAVAILABLE",
    error: "Trek audiosini yuklab bo'lmadi."
  });
};
