const fallbackMovies = require("../data/movies.json");

const CHANNEL_USERNAME = process.env.CONTENT_CHANNEL_USERNAME || "mdtsitsibtaryyarbeaa";
const CHANNEL_ID = Number(process.env.CONTENT_CHANNEL_ID || "-1003226387471");
const fallbackByMessageId = new Map(
  fallbackMovies
    .map((movie) => [Number(movie.telegramMessageId || movie.id), movie])
    .filter(([messageId]) => Number.isFinite(messageId) && messageId > 0),
);

function decodeEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function textFromHtml(value) {
  return decodeEntities(
    String(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim(),
  );
}

function toBool(value) {
  return ["1", "true", "ha", "yes", "да", "+"].includes(String(value || "").trim().toLowerCase());
}

function parseCaption(caption, fallbackTitle, messageId) {
  const keyMap = {
    nomi: "title",
    name: "title",
    title: "title",
    kino: "title",
    kod: "code",
    code: "code",
    janr: "genre",
    genre: "genre",
    yil: "year",
    year: "year",
    reyting: "rating",
    rating: "rating",
    sifat: "quality",
    quality: "quality",
    top: "isTop",
    premium: "isPremium",
    tavsif: "description",
    description: "description",
  };
  const values = {};
  const plain = [];

  for (const rawLine of String(caption || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const index = line.indexOf(":");
    const key = index === -1 ? "" : line.slice(0, index).trim().toLowerCase();
    const mapped = keyMap[key];
    if (index !== -1 && mapped) values[mapped] = line.slice(index + 1).trim();
    else plain.push(line);
  }

  const title = String(values.title || plain[0] || fallbackTitle || `Kino ${messageId}`).trim();
  const year = Number.parseInt(String(values.year || "").trim(), 10);
  const rating = Number.parseFloat(String(values.rating || "0").replace(",", "."));

  return {
    id: messageId,
    code: String(values.code || messageId).trim().toUpperCase(),
    title,
    year: Number.isFinite(year) ? year : "",
    genre: String(values.genre || "Kino").trim(),
    rating: Number.isFinite(rating) ? rating : 0,
    quality: String(values.quality || "HD").trim().toUpperCase(),
    isTop: toBool(values.isTop),
    isPremium: toBool(values.isPremium),
    poster: "",
    streamUrl: "",
    description: String(values.description || plain.slice(1).join("\n") || "Kanalga joylangan kino.").trim(),
  };
}

function parsePublicChannel(html, username) {
  const safeUsername = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockPattern = new RegExp(
    `<div class="tgme_widget_message[\\s\\S]*?data-post="${safeUsername}\\/(\\d+)"[\\s\\S]*?(?=<\\/div><\\/div><div class="tgme_widget_message_wrap|<\\/section>)`,
    "gi",
  );
  const movies = [];

  for (const match of html.matchAll(blockPattern)) {
    const messageId = Number(match[1]);
    const block = match[0];
    if (!block.includes("tgme_widget_message_video_player")) continue;

    const captionMatch = block.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/i);
    const thumbMatch = block.match(/background-image:url\('([^']+)'\)/i);
    const caption = captionMatch ? textFromHtml(captionMatch[1]) : "";
    const movie = parseCaption(caption, `Kino ${messageId}`, messageId);
    const storedMovie = fallbackByMessageId.get(messageId);
    const storedFileId =
      storedMovie?.video_file_id || storedMovie?.videoFileId || storedMovie?.telegramFileId || "";
    movie.id = storedMovie?.id || movie.id;
    movie.sourceType = "telegram_channel";
    movie.telegramChatId = CHANNEL_ID || `@${username}`;
    movie.telegramMessageId = messageId;
    movie.telegramFileId = storedFileId;
    movie.video_file_id = storedFileId;
    movie.sourceUrl = `https://t.me/${username}/${messageId}`;
    movie.poster = thumbMatch ? thumbMatch[1] : movie.poster;
    movies.push(movie);
  }

  return movies.sort((a, b) => b.telegramMessageId - a.telegramMessageId);
}

async function loadChannelMovies() {
  const response = await fetch(`https://t.me/s/${CHANNEL_USERNAME}`, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`Telegram channel fetch failed: ${response.status}`);
  return parsePublicChannel(await response.text(), CHANNEL_USERNAME);
}

module.exports = async function handler(_request, response) {
  response.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
  try {
    const channelMovies = await loadChannelMovies();
    response.status(200).json(channelMovies.length ? channelMovies : fallbackMovies);
  } catch {
    response.status(200).json(fallbackMovies);
  }
};
