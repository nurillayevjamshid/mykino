const DEFAULT_PLAYLIST_ID = "PLrW0WsV8cL9Rug7pLf8D8NOqEI7YeO6kE";
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3/playlistItems";

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} serverda sozlanmagan.`);
    error.statusCode = 500;
    error.code = `${name}_MISSING`;
    throw error;
  }
  return value;
}

function bestThumbnail(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    ""
  );
}

function toMovie(item) {
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const videoId = contentDetails.videoId || snippet.resourceId?.videoId || "";
  const title = snippet.title || "YouTube video";
  const publishedAt = snippet.publishedAt || contentDetails.videoPublishedAt || "";
  const year = publishedAt ? new Date(publishedAt).getFullYear() : "";

  return {
    id: videoId,
    code: videoId.slice(0, 10).toUpperCase(),
    sourceType: "youtube_playlist",
    videoId,
    youtubeVideoId: videoId,
    title,
    description: snippet.description || "",
    thumbnail: bestThumbnail(snippet.thumbnails),
    poster: bestThumbnail(snippet.thumbnails),
    publishedAt,
    year: Number.isFinite(year) ? year : "",
    genre: "YouTube",
    rating: 0,
    quality: "HD",
    isTop: false,
    isPremium: false,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`,
  };
}

function isPlayablePlaylistVideo(item) {
  const snippet = item.snippet || {};
  const contentDetails = item.contentDetails || {};
  const videoId = contentDetails.videoId || snippet.resourceId?.videoId;
  const title = String(snippet.title || "").toLowerCase();
  return Boolean(videoId && title !== "private video" && title !== "deleted video");
}

async function fetchPlaylistMovies() {
  const apiKey = getRequiredEnv("YOUTUBE_API_KEY");
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID || DEFAULT_PLAYLIST_ID;
  const maxPages = Math.max(1, Math.min(Number(process.env.YOUTUBE_MAX_PAGES || 4), 10));
  const movies = [];
  let pageToken = "";

  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(YOUTUBE_API_BASE);
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const youtubeResponse = await fetch(url);
    const payload = await youtubeResponse.json().catch(() => null);

    if (!youtubeResponse.ok || !payload) {
      const error = new Error(payload?.error?.message || "YouTube playlist yuklanmadi.");
      error.statusCode = youtubeResponse.status || 502;
      error.code = payload?.error?.status || "YOUTUBE_API_FAILED";
      throw error;
    }

    movies.push(...(payload.items || []).filter(isPlayablePlaylistVideo).map(toMovie));
    pageToken = payload.nextPageToken || "";
    if (!pageToken) break;
  }

  return movies;
}

module.exports = async function handler(request, response) {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Faqat GET ishlaydi." });
    return;
  }

  response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");

  try {
    const movies = await fetchPlaylistMovies();
    response.status(200).json(movies);
  } catch (error) {
    response.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "YOUTUBE_MOVIES_FAILED",
      error: error.message || "YouTube playlist yuklanmadi.",
    });
  }
};
