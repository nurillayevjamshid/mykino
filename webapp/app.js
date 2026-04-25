const tg = window.Telegram?.WebApp;
const DEMO_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor("#101820");
  tg.setBackgroundColor("#070807");
}

const copy = {
  uz: {
    all: "🎬 Barchasi",
    top: "🔥 TOP",
    premium: "💎 Premium",
    search: "🔍 Qidirish",
    placeholder: "Kino qidirish",
    watch: "Tomosha qilish",
    later: "Keyinroq",
    emptyTitle: "Hech narsa topilmadi",
    emptyText: "Boshqa nom, janr yoki kod bilan urinib ko'ring.",
    profile: "Kino foydalanuvchi",
    premiumStatus: "faol emas",
  },
  ru: {
    all: "🎬 Все",
    top: "🔥 ТОП",
    premium: "💎 Премиум",
    search: "🔍 Поиск",
    placeholder: "Поиск фильма",
    watch: "Смотреть",
    later: "Позже",
    emptyTitle: "Ничего не найдено",
    emptyText: "Попробуйте другое название, жанр или код.",
    profile: "Пользователь Kino",
    premiumStatus: "не активен",
  },
  en: {
    all: "🎬 All",
    top: "🔥 TOP",
    premium: "💎 Premium",
    search: "🔍 Search",
    placeholder: "Search movies",
    watch: "Watch",
    later: "Later",
    emptyTitle: "No results",
    emptyText: "Try another title, genre, or code.",
    profile: "Kino user",
    premiumStatus: "inactive",
  },
};

const fallbackCopy = {
  loadingTitle: "Kinolar yuklanmoqda...",
  loadingText: "YouTube playlist tekshirilmoqda.",
  loadErrorTitle: "YouTube playlist yuklanmadi",
  loadErrorText: "API key va playlist sozlamasini tekshiring.",
};

let movies = [];
let lang = "uz";
let activeFilter = location.hash === "#top" ? "top" : location.hash === "#premium" ? "premium" : "all";
let query = "";
let watchedCount = Number(localStorage.getItem("kino_watched_count") || "0");
let activeMovie = null;
let videoLoadTimer = null;
let activeVideoRequest = 0;
let movieLoadState = "loading";
let movieLoadError = "";

const grid = document.querySelector("#movieGrid");
const emptyState = document.querySelector("#emptyState");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const movieModal = document.querySelector("#movieModal");
const modalPoster = document.querySelector("#modalPoster");
const modalMeta = document.querySelector("#modalMeta");
const modalTitle = document.querySelector("#modalTitle");
const modalDescription = document.querySelector("#modalDescription");
const watchButton = document.querySelector("#watchButton");
const profileModal = document.querySelector("#profileModal");
const profileName = document.querySelector("#profileName");
const avatar = document.querySelector("#avatar");
const viewCount = document.querySelector("#viewCount");
const videoPlayer = document.querySelector("#videoPlayer");
const videoMount = document.querySelector("#videoMount");
const videoLoading = document.querySelector("#videoLoading");
const videoFallback = document.querySelector("#videoFallback");
const videoExternalLink = document.querySelector("#videoExternalLink");
const videoTitle = document.querySelector("#videoTitle");
const videoSourceLabel = document.querySelector("#videoSourceLabel");

function t(key) {
  return copy[lang][key] || fallbackCopy[key] || key;
}

function applyTelegramUser() {
  const user = tg?.initDataUnsafe?.user;
  if (!user) return;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  profileName.textContent = displayName || t("profile");
  avatar.textContent = (user.first_name || "K").slice(0, 2).toUpperCase();
}

function filteredMovies() {
  return movies.filter((movie) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "top" && movie.isTop) ||
      (activeFilter === "premium" && movie.isPremium);
    const haystack = `${movie.title} ${movie.genre} ${movie.year} ${movie.code}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });
}

function formatRating(rating) {
  const value = Number(rating);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : "0.0";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function posterStyle(movie) {
  if (!movie.poster) return "";
  const poster = String(movie.poster).replaceAll("'", "%27").replaceAll(")", "%29");
  return `style="--poster-image: url('${poster}')"`;
}

function safeUrl(value) {
  try {
    return value ? new URL(String(value), window.location.href) : null;
  } catch {
    return null;
  }
}

function isDirectVideoUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?.*)?$/i.test(parsed.pathname);
}

function isYouTubeUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.replace(/^www\./, "");
  return host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
}

function toYouTubeEmbed(url) {
  const parsed = safeUrl(url);
  if (!parsed) return "";
  const host = parsed.hostname.replace(/^www\./, "");
  let videoId = "";
  if (host === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (parsed.pathname.startsWith("/embed/")) {
    videoId = parsed.pathname.split("/").filter(Boolean)[1] || "";
  } else {
    videoId = parsed.searchParams.get("v") || "";
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0` : "";
}

function isTelegramPostUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.replace(/^www\./, "");
  return host === "t.me" || host === "telegram.me";
}

function getYouTubeVideoId(movie) {
  return String(movie?.youtubeVideoId || movie?.videoId || "").trim();
}

function getYouTubeVideoUrl(movie) {
  const videoId = getYouTubeVideoId(movie);
  return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : "";
}

function getMovieVideoUrl(movie) {
  const localSources = readLocalVideoSources();
  const youtubeUrl = getYouTubeVideoUrl(movie);
  return (
    localSources[movie.id] ||
    localSources[movie.code] ||
    movie.videoUrl ||
    movie.video_url ||
    movie.streamUrl ||
    movie.embedUrl ||
    movie.trailerUrl ||
    youtubeUrl ||
    movie.sourceUrl ||
    ""
  );
}

function getMovieFileId(movie) {
  return String(movie?.video_file_id || movie?.videoFileId || movie?.telegramFileId || "").trim();
}

async function resolveTelegramVideoUrl(fileId) {
  const response = await fetch(`/api/video-url/${encodeURIComponent(fileId)}`, {
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.videoUrl) {
    throw new Error(payload?.error || "Video URL olinmadi.");
  }
  return payload.videoUrl;
}

function hasPlayableEmbedSource(movie) {
  const localSources = readLocalVideoSources();
  return Boolean(
    localSources[movie.id] ||
      localSources[movie.code] ||
      movie.videoUrl ||
      movie.video_url ||
      movie.streamUrl ||
      movie.embedUrl ||
      movie.trailerUrl,
  );
}

function readLocalVideoSources() {
  try {
    const payload = JSON.parse(localStorage.getItem("kino_video_sources") || "{}");
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

function setEmptyState(title, text) {
  emptyState.querySelector("strong").textContent = title;
  emptyState.querySelector("span").textContent = text;
}

function updateEmptyState(list) {
  if (movieLoadState === "loading") {
    emptyState.hidden = false;
    setEmptyState(t("loadingTitle"), t("loadingText"));
    return;
  }

  if (movieLoadState === "error") {
    emptyState.hidden = false;
    setEmptyState(t("loadErrorTitle"), movieLoadError || t("loadErrorText"));
    return;
  }

  emptyState.hidden = list.length > 0;
  if (!list.length) setEmptyState(t("emptyTitle"), t("emptyText"));
}

function renderMovies() {
  const list = movieLoadState === "ready" ? filteredMovies() : [];
  grid.innerHTML = "";
  updateEmptyState(list);

  for (const movie of list) {
    const card = document.createElement("article");
    card.className = `movie-card${movie.isPremium ? " is-premium" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", movie.title);
    card.innerHTML = `
      <span class="poster" ${posterStyle(movie)}></span>
      <span class="card-badges">
        <span class="badge">${escapeHtml(movie.quality || "HD")}</span>
        <span class="rating"><span>★</span> ${formatRating(movie.rating)}</span>
      </span>
      <span class="play-float">▶</span>
      <span class="card-copy">
        <h2>${escapeHtml(movie.title)}</h2>
        <p>${escapeHtml(movie.year || "Yangi")} ·</p>
        <p>${escapeHtml(movie.genre || "Kino")}</p>
        ${movie.isPremium ? `<p class="watch-inline">${t("watch")} →</p>` : ""}
      </span>
    `;
    card.querySelector(".card-copy").insertAdjacentHTML(
      "beforeend",
      `<button class="card-watch-button" type="button">в–¶ ${t("watch")}</button>`,
    );
    card.addEventListener("click", () => openMovie(movie));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openMovie(movie);
      }
    });
    card.querySelector(".card-watch-button").addEventListener("click", (event) => {
      event.stopPropagation();
      openVideoPlayer(movie);
    });
    grid.append(card);
  }

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === activeFilter);
  });
}

function openMovie(movie) {
  modalPoster.style.backgroundImage = movie.poster
    ? `linear-gradient(180deg, transparent, rgba(0,0,0,.76)), url('${String(movie.poster).replaceAll("'", "%27")}'), radial-gradient(circle at 28% 20%, rgba(255, 193, 44, 0.56), transparent 24%), linear-gradient(135deg, #311312, #0b0d0f 58%, #947322)`
    : "radial-gradient(circle at 28% 20%, rgba(255, 193, 44, 0.56), transparent 24%), linear-gradient(135deg, #311312, #0b0d0f 58%, #947322)";
  modalMeta.textContent = `${movie.year || "Yangi"} · ${movie.genre || "Kino"} · ${movie.quality || "HD"} · ⭐ ${formatRating(movie.rating)}`;
  modalTitle.textContent = movie.title;
  modalDescription.textContent = movie.description;
  watchButton.textContent = `▶ ${t("watch")}`;
  watchButton.dataset.movieId = movie.id;
  activeMovie = movie;
  movieModal.showModal();

  watchedCount += 1;
  localStorage.setItem("kino_watched_count", String(watchedCount));
  viewCount.textContent = watchedCount;
}

function setVideoLoading(isLoading) {
  videoLoading.hidden = !isLoading;
}

function setFallbackMessage(sourceUrl = "") {
  videoFallback.hidden = false;
  if (sourceUrl) {
    videoExternalLink.href = sourceUrl;
    videoExternalLink.hidden = false;
  } else {
    videoExternalLink.hidden = true;
    videoExternalLink.removeAttribute("href");
  }
}

function clearVideoLoadTimer() {
  if (videoLoadTimer) {
    window.clearTimeout(videoLoadTimer);
    videoLoadTimer = null;
  }
}

function createVideoElement(src, movie, options = {}) {
  const normalizedOptions = typeof options === "boolean" ? { isFallback: options } : options;
  const { isFallback = false, fallbackUrl = "" } = normalizedOptions;
  const video = document.createElement("video");
  video.src = src;
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.autoplay = true;
  video.poster = movie.poster || "";
  video.setAttribute("controlsList", "nodownload");
  video.addEventListener("loadedmetadata", () => setVideoLoading(false), { once: true });
  video.addEventListener("canplay", () => setVideoLoading(false), { once: true });
  video.addEventListener(
    "error",
    () => {
      setVideoLoading(false);
      setFallbackMessage(isFallback ? "" : fallbackUrl || movie.sourceUrl || src);
    },
    { once: true },
  );
  videoMount.replaceChildren(video);
  const playAttempt = video.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      setVideoLoading(false);
    });
  }
}

function createIframeElement(src, label) {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = label;
  iframe.loading = "eager";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  iframe.addEventListener(
    "load",
    () => {
      clearVideoLoadTimer();
      setVideoLoading(false);
    },
    { once: true },
  );
  videoMount.replaceChildren(iframe);
}

function renderVideoSource(videoUrl, movie, options = {}) {
  const { isFallback = false, originalUrl = "", forceVideo = false, errorOnly = false } = options;
  clearVideoLoadTimer();
  videoMount.replaceChildren();
  videoFallback.hidden = true;
  videoExternalLink.hidden = true;
  setVideoLoading(true);

  const sourceUrl = videoUrl || DEMO_VIDEO_URL;
  const parsed = safeUrl(sourceUrl);
  const externalUrl = originalUrl || movie.sourceUrl || "";

  if (errorOnly) {
    videoSourceLabel.textContent = "Video manba";
    setVideoLoading(false);
    setFallbackMessage(externalUrl);
    return;
  }

  if (!videoUrl || isFallback) {
    setFallbackMessage(externalUrl);
    videoSourceLabel.textContent = "Demo fallback video";
    createVideoElement(DEMO_VIDEO_URL, movie, { isFallback: true });
    return;
  }

  if (forceVideo && parsed) {
    videoSourceLabel.textContent = "Telegram video";
    createVideoElement(parsed.href, movie, { fallbackUrl: externalUrl });
    return;
  }

  if (isDirectVideoUrl(sourceUrl)) {
    videoSourceLabel.textContent = "Video fayl";
    createVideoElement(parsed.href, movie, { fallbackUrl: externalUrl });
    return;
  }

  if (isYouTubeUrl(sourceUrl)) {
    const embedUrl = toYouTubeEmbed(sourceUrl);
    if (embedUrl) {
      videoSourceLabel.textContent = "YouTube player";
      videoLoadTimer = window.setTimeout(() => {
        setVideoLoading(false);
        setFallbackMessage(sourceUrl);
      }, 7000);
      createIframeElement(embedUrl, movie.title);
      return;
    }
  }

  if (isTelegramPostUrl(sourceUrl)) {
    videoSourceLabel.textContent = "Telegram manba";
    setVideoLoading(false);
    setFallbackMessage(sourceUrl);
    return;
  }

  if (parsed) {
    videoSourceLabel.textContent = "Embed player";
    videoLoadTimer = window.setTimeout(() => {
      setVideoLoading(false);
      setFallbackMessage(parsed.href);
    }, 7000);
    createIframeElement(parsed.href, movie.title);
    return;
  }

  renderVideoSource(DEMO_VIDEO_URL, movie, { isFallback: true });
}

function openTelegramSource(url) {
  if (!url) return false;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return true;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
  return true;
}

async function openVideoPlayer(movie) {
  if (!movie) return;
  const requestId = ++activeVideoRequest;
  if (movieModal.open) movieModal.close();
  videoTitle.textContent = movie.title || "Kino";
  videoPlayer.hidden = false;
  document.body.classList.add("is-player-open");

  const youtubeUrl = getYouTubeVideoUrl(movie);
  if (youtubeUrl) {
    renderVideoSource(youtubeUrl, movie);
    return;
  }

  const fileId = getMovieFileId(movie);
  if (fileId) {
    clearVideoLoadTimer();
    videoMount.replaceChildren();
    videoFallback.hidden = true;
    videoExternalLink.hidden = true;
    videoSourceLabel.textContent = "Telegram video";
    setVideoLoading(true);
    try {
      const resolvedUrl = await resolveTelegramVideoUrl(fileId);
      if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
      renderVideoSource(resolvedUrl, movie, { forceVideo: true, originalUrl: movie.sourceUrl || "" });
    } catch {
      if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
      renderVideoSource("", movie, { errorOnly: true, originalUrl: movie.sourceUrl || "" });
    }
    return;
  }

  const videoUrl = getMovieVideoUrl(movie);
  if (isTelegramPostUrl(videoUrl) && !hasPlayableEmbedSource(movie)) {
    renderVideoSource("", movie, { errorOnly: true, originalUrl: videoUrl });
    return;
  }

  renderVideoSource(videoUrl, movie);
}

function closeVideoPlayer() {
  activeVideoRequest += 1;
  clearVideoLoadTimer();
  const video = videoMount.querySelector("video");
  const iframe = videoMount.querySelector("iframe");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  if (iframe) iframe.src = "about:blank";
  videoMount.replaceChildren();
  videoFallback.hidden = true;
  videoExternalLink.hidden = true;
  setVideoLoading(false);
  videoPlayer.hidden = true;
  document.body.classList.remove("is-player-open");
}

function setFilter(filter) {
  activeFilter = filter;
  location.hash = filter === "all" ? "" : filter;
  renderMovies();
}

function openSearch() {
  searchPanel.hidden = false;
  searchInput.focus();
}

function applyCopy() {
  document.querySelector('[data-filter="all"]').textContent = t("all");
  document.querySelector('[data-filter="top"]').textContent = t("top");
  document.querySelector('[data-filter="premium"]').textContent = t("premium");
  document.querySelector('[data-action="search"]').textContent = t("search");
  searchInput.placeholder = t("placeholder");
  document.querySelector("[data-close]").textContent = "×";
  document.querySelector(".ghost-button").textContent = t("later");
  emptyState.querySelector("strong").textContent = t("emptyTitle");
  emptyState.querySelector("span").textContent = t("emptyText");
  profileName.textContent = t("profile");
  document.documentElement.lang = lang;
  applyTelegramUser();
  renderMovies();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll("[data-action='search']").forEach((button) => {
  button.addEventListener("click", openSearch);
});

document.querySelector("[data-action='profile']").addEventListener("click", () => {
  viewCount.textContent = watchedCount;
  profileModal.showModal();
});

document.querySelectorAll(".lang").forEach((button) => {
  button.addEventListener("click", () => {
    lang = button.dataset.lang;
    document.querySelectorAll(".lang").forEach((item) => item.classList.toggle("is-active", item === button));
    applyCopy();
  });
});

searchInput.addEventListener("input", (event) => {
  query = event.target.value.trim();
  renderMovies();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => movieModal.close());
});

document.querySelector("[data-close-profile]").addEventListener("click", () => profileModal.close());

document.querySelector("[data-premium]").addEventListener("click", () => {
  profileModal.close();
  setFilter("premium");
});

document.addEventListener("click", (event) => {
  const watchTarget = event.target.closest("#watchButton");
  if (watchTarget) {
    const movieId = watchTarget.dataset.movieId || "";
    const movie = movies.find((item) => String(item.id) === movieId) || activeMovie;
    openVideoPlayer(movie);
    return;
  }

  if (event.target.closest("[data-video-close]")) {
    closeVideoPlayer();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !videoPlayer.hidden) {
    closeVideoPlayer();
  }
});

async function loadMovies() {
  movieLoadState = "loading";
  movieLoadError = "";
  renderMovies();

  try {
    const response = await fetch("/api/youtube/movies", {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error || "YouTube playlist yuklanmadi.");
    }
    movies = payload;
    movieLoadState = "ready";
  } catch {
    movies = [];
    movieLoadState = "error";
    movieLoadError = t("loadErrorText");
  }
  viewCount.textContent = watchedCount;
  applyCopy();

  if (location.hash === "#profile") {
    profileModal.showModal();
  }
}

loadMovies();
