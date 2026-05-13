const tg = window.Telegram?.WebApp;
const DEMO_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const HERO_ROTATE_INTERVAL_MS = 3000;
const PROD_API_BASE = window.location.protocol === "file:" ? "https://kino-telegram-mini-app.vercel.app" : "";
const API_BASE_STORAGE_KEY = "kino_api_base_v1";
const DEBUG_USER_STORAGE_KEY = "kino_debug_user_v1";
const LOCAL_API_BASES = ["http://127.0.0.1:8080", "http://localhost:8080"];
const DEFAULT_DEBUG_USER = {
  id: 679291909,
  first_name: "Jamshid",
  last_name: "Nurillayev",
  username: "jam_nurillaev",
};
let runtimeApiBase = window.location.protocol === "file:" ? PROD_API_BASE : "";
let apiBaseResolutionPromise = null;
const savedLang = localStorage.getItem("kino_lang") || "uz";
let lang = savedLang;
const pageParams = new URLSearchParams(window.location.search);
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

if (tg) {
  tg.ready();
  tg.expand();
  tg.disableVerticalSwipes?.();
}

const savedTheme = localStorage.getItem("kino_theme") || "light";
const themeToggle = document.querySelector(".theme-toggle");
const WISHLIST_STORAGE_KEY = "kino_wishlist_v1";

const langDropdown = document.querySelector("#langDropdown");
if (langDropdown) {
  const trigger = langDropdown.querySelector(".lang-trigger");
  const options = langDropdown.querySelectorAll(".lang-option");
  const currentLabel = langDropdown.querySelector(".lang-current");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle("is-open");
  });

  options.forEach(option => {
    option.addEventListener("click", () => {
      lang = option.dataset.value;
      localStorage.setItem("kino_lang", lang);
      langDropdown.classList.remove("is-open");
      applyCopy();
    });
  });

  document.addEventListener("click", () => {
    langDropdown.classList.remove("is-open");
  });
}

const copy = {
  uz: {
    all: "Barchasi",
    homeNav: "Kino",
    musicNav: "Musiqa",
    top: "Top",
    premium: "Premium",
    search: "Qidirish",
    categories: "Kategoriya",
    placeholder: "Kino qidirish",
    watch: "Tomosha qilish",
    genreLabel: "Janr",
    ratingLabel: "Reyting",
    later: "Keyinroq",
    watchedLabel: "Ko'rilgan kinolar",
    clearHistory: "Tozalash",
    removeHistoryItem: "O'chirish",
    emptyTitle: "Hech narsa topilmadi",
    emptyText: "Boshqa nom, janr yoki kod bilan urinib ko'ring.",
    profile: "Kino foydalanuvchi",
    premiumStatus: "faol emas",
    historyEmpty: "Hali ko'rilgan kino yo'q.",
    noUsername: "username mavjud emas",
    loadingTitle: "Kinolar yuklanmoqda...",
    loadingText: "Katalog tayyorlanmoqda.",
    loadErrorTitle: "Katalog yuklanmadi",
    loadErrorText: "Katalogni qayta ochib ko'ring.",
    previous: "Oldingi",
    play: "Ijro",
    pause: "Pauza",
    back10: "-10s",
    forward10: "+10s",
    next: "Keyingi",
    speed: "Tezlik",
    mute: "Ovozni o'chirish",
    unmute: "Ovozni yoqish",
    full: "To'liq ekran",
    exitFull: "Chiqish",
    customPlayer: "Kino player",
    continueAt: "Davom etish",
    videoLoading: "Video yuklanmoqda...",
    openSource: "Manbani ochish",
    newMovie: "Yangi",
    footerTagline: "Eng sara kinolar mini-ilovasi",
    footerCopy: "© 2026 Kino Play. Barcha huquqlar himoyalangan.",
  },
  ru: {
    all: "Все",
    homeNav: "Kino",
    musicNav: "Музыка",
    top: "Топ",
    premium: "Премиум",
    search: "Поиск",
    categories: "Категория",
    placeholder: "Искать фильм",
    watch: "Смотреть",
    genreLabel: "Жанр",
    ratingLabel: "Рейтинг",
    later: "Позже",
    watchedLabel: "Просмотренные фильмы",
    clearHistory: "Очистить",
    removeHistoryItem: "Удалить",
    emptyTitle: "Ничего не найдено",
    emptyText: "Попробуйте другое название, жанр или код.",
    profile: "Пользователь Kino",
    premiumStatus: "не активен",
    historyEmpty: "Вы еще не смотрели фильмы.",
    noUsername: "username не указан",
    loadingTitle: "Фильмы загружаются...",
    loadingText: "Каталог готовится.",
    loadErrorTitle: "Каталог не загрузился",
    loadErrorText: "Откройте каталог заново.",
    previous: "Назад",
    play: "Воспроизвести",
    pause: "Пауза",
    back10: "-10 сек",
    forward10: "+10 сек",
    next: "Далее",
    speed: "Скорость",
    mute: "Выключить звук",
    unmute: "Включить звук",
    full: "Во весь экран",
    exitFull: "Выйти",
    customPlayer: "Кино плеер",
    continueAt: "Продолжить",
    videoLoading: "Видео загружается...",
    openSource: "Открыть источник",
    newMovie: "Новинка",
    footerTagline: "Мини-приложение лучших фильмов",
    footerCopy: "© 2026 Kino Play. Все права защищены.",
  },
  en: {
    all: "All",
    homeNav: "Kino",
    musicNav: "Music",
    top: "Top",
    premium: "Premium",
    search: "Search",
    categories: "Category",
    placeholder: "Search movies",
    watch: "Watch",
    genreLabel: "Genre",
    ratingLabel: "Rating",
    later: "Later",
    watchedLabel: "Watched movies",
    clearHistory: "Clear",
    removeHistoryItem: "Remove",
    emptyTitle: "No results",
    emptyText: "Try another title, genre, or code.",
    profile: "Kino user",
    premiumStatus: "inactive",
    historyEmpty: "No watched movies yet.",
    noUsername: "username not available",
    loadingTitle: "Movies are loading...",
    loadingText: "Preparing catalog.",
    loadErrorTitle: "Catalog did not load",
    loadErrorText: "Open the catalog again.",
    previous: "Previous",
    play: "Play",
    pause: "Pause",
    back10: "-10s",
    forward10: "+10s",
    next: "Next",
    speed: "Speed",
    mute: "Mute",
    unmute: "Unmute",
    full: "Full screen",
    exitFull: "Exit",
    customPlayer: "Movie player",
    continueAt: "Continue",
    videoLoading: "Video is loading...",
    openSource: "Open source",
    newMovie: "New",
    footerTagline: "Mini app for the best movies",
    footerCopy: "© 2026 Kino Play. All rights reserved.",
  },
};

const fallbackCopy = {
  homeNav: "Kino",
  musicNav: "Musiqa",
  loadingTitle: "Kinolar yuklanmoqda...",
  loadingText: "Katalog tayyorlanmoqda.",
  loadErrorTitle: "Katalog yuklanmadi",
  loadErrorText: "Katalogni qayta ochib ko'ring.",
  previous: "Prev",
  play: "Play",
  pause: "Pause",
  back10: "-10s",
  forward10: "+10s",
  next: "Next",
  speed: "Speed",
  mute: "Mute",
  unmute: "Unmute",
  full: "Full",
  exitFull: "Exit",
  customPlayer: "Kino player",
  continueAt: "Continue",
};

const WATCH_PROGRESS_KEY = "kino_watch_progress_v1";
const WATCHED_MOVIES_KEY = "kino_watched_movies_v1";
const WATCH_PROGRESS_MIN_SECONDS = 15;
const WATCH_PROGRESS_END_GAP = 12;
const TELEGRAM_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";
const DRIVE_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";

let movies = [];
let activeFilter = "all";
let activeCategory = "all";
let query = "";

let watchedCount = Number(localStorage.getItem("kino_watched_count") || "0");
let activeMovie = null;
let videoLoadTimer = null;
let activeVideoRequest = 0;
let movieLoadState = "loading";
let movieLoadError = "";
let youtubeApiPromise = null;
let activeYouTubePlayer = null;
let youtubeProgressTimer = null;
let isAdjustingSeek = false;
let pendingSeekTime = 0;
let youtubeAutoAdvanceTimer = null;
let pendingResumeTime = 0;
let lastSavedProgressSecond = -1;
let heroActiveIndex = 0;
let heroIntervalId = null;
const grid = document.querySelector("#movieGrid");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const topbarSearch = document.querySelector(".topbar-search");
const topbarBrand = document.querySelector(".brand");
const topbarSearchTrigger = document.querySelector(".topbar-search__trigger");

const categoryPanel = document.querySelector("#categoryPanel");
const categoryList = document.querySelector("#categoryList");
const movieModal = document.querySelector("#movieModal");
const modalPoster = document.querySelector("#modalPoster");
const modalMeta = document.querySelector("#modalMeta");
const modalTitle = document.querySelector("#modalTitle");
const modalDescription = document.querySelector("#modalDescription");
const watchButton = document.querySelector("#watchButton");
const movieLaterButton = document.querySelector(".modal-actions .ghost-button");
const profileModal = document.querySelector("#profileModal");
const profileName = document.querySelector("#profileName");
const profileUsername = document.querySelector("#profileUsername");
const headerAvatar = document.querySelector("#headerAvatar");
const headerAvatarPhoto = document.querySelector("#headerAvatarPhoto");
const avatar = document.querySelector("#avatar");
const avatarPhoto = document.querySelector("#avatarPhoto");
const viewCount = document.querySelector("#viewCount");
const watchedMovieList = document.querySelector("#watchedMovieList");
const watchedMovieCount = document.querySelector("#watchedMovieCount");
const watchedMovieEmpty = document.querySelector("#watchedMovieEmpty");
const watchedHistoryTitle = document.querySelector("#watchedHistoryTitle");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const videoPlayer = document.querySelector("#videoPlayer");
const videoMount = document.querySelector("#videoMount");
const videoLoading = document.querySelector("#videoLoading");
const videoFallback = document.querySelector("#videoFallback");
const videoFallbackText = document.querySelector("#videoFallbackText");
const videoExternalLink = document.querySelector("#videoExternalLink");
const videoTitle = document.querySelector("#videoTitle");
const videoSourceLabel = document.querySelector("#videoSourceLabel");
const videoBackButton = document.querySelector("#videoBackButton");
const videoToggleButton = document.querySelector("#videoToggleButton");
const videoForwardButton = document.querySelector("#videoForwardButton");
const videoFullscreenButton = document.querySelector("#videoFullscreenButton");
const videoSeek = document.querySelector("#videoSeek");
const videoCurrentTime = document.querySelector("#videoCurrentTime");
const videoDuration = document.querySelector("#videoDuration");
const videoBrightness = document.querySelector("#videoBrightness");
const videoBrightnessOverlay = document.querySelector("#videoBrightnessOverlay");
const videoSpeedButton = document.querySelector("#videoSpeedButton");
const videoSpeedLabel = document.querySelector("#videoSpeedLabel");
const videoLockButton = document.querySelector("#videoLockButton");
const videoLockRelease = document.querySelector("#videoLockRelease");
const videoAudioButton = document.querySelector("#videoAudioButton");
const playerOverlay = document.querySelector("#playerOverlay");
const videoTapZone = document.querySelector("#videoTapZone");
const playerToast = document.querySelector("#playerToast");

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeed = 1;
let isPlayerLocked = false;
let controlsHideTimer = null;
let toastHideTimer = null;

function t(key) {
  return copy[lang][key] || fallbackCopy[key] || key;
}

function plainLabel(value) {
  return String(value || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

function setControlLabel(node, label) {
  if (!node) return;
  node.setAttribute("aria-label", label);
  node.setAttribute("title", label);
}

function setStateLabel(node, state, label) {
  if (!node) return;
  node.dataset.state = state;
  setControlLabel(node, label);
}

function setRangeFill(node, value, maxValue) {
  if (!node) return;
  const max = Number(maxValue || node.max || 100) || 100;
  const current = Math.max(0, Math.min(max, Number(value) || 0));
  node.style.setProperty("--range-fill", `${(current / max) * 100}%`);
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (themeToggle) {
    themeToggle.dataset.theme = nextTheme;
    themeToggle.setAttribute(
      "aria-label",
      nextTheme === "dark" ? "Kunduzgi rejim" : "Kechki rejim",
    );
  }
  const headerHex = nextTheme === "light" ? "#fafafb" : "#050505";
  const bgHex = nextTheme === "light" ? "#f7f7f8" : "#050505";
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", headerHex);
  }
  if (tg) {
    try { tg.setHeaderColor(headerHex); } catch {}
    try { tg.setBackgroundColor(bgHex); } catch {}
  }
}

applyTheme(savedTheme);

function readStoredJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readDebugTelegramUser() {
  const debugUserId = Number(pageParams.get("debugUserId") || 0);
  const debugUsername = String(pageParams.get("debugUsername") || "").trim();
  const debugFirstName = String(pageParams.get("debugFirstName") || "").trim();
  const debugLastName = String(pageParams.get("debugLastName") || "").trim();

  if (Number.isFinite(debugUserId) && debugUserId > 0) {
    const queryUser = {
      ...DEFAULT_DEBUG_USER,
      id: debugUserId,
      username: debugUsername || DEFAULT_DEBUG_USER.username,
      first_name: debugFirstName || DEFAULT_DEBUG_USER.first_name,
      last_name: debugLastName || DEFAULT_DEBUG_USER.last_name,
    };
    localStorage.setItem(DEBUG_USER_STORAGE_KEY, JSON.stringify(queryUser));
    return queryUser;
  }

  const storedUser = readStoredJson(DEBUG_USER_STORAGE_KEY);
  if (storedUser?.id) return storedUser;
  if (window.location.protocol === "file:") return DEFAULT_DEBUG_USER;
  return null;
}

function getTelegramUser() {
  return tg?.initDataUnsafe?.user || readDebugTelegramUser() || null;
}

function getUserInitials(user) {
  const first = String(user?.first_name || "").trim();
  const last = String(user?.last_name || "").trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.trim();
  if (initials) return initials.toUpperCase();
  return first.slice(0, 2).toUpperCase() || "KI";
}

function applyTelegramUser() {
  const user = getTelegramUser();
  if (!user) {
    profileName.textContent = t("profile");
    profileUsername.textContent = t("noUsername");
    avatar.textContent = "KI";
    avatar.hidden = false;
    avatarPhoto.hidden = true;
    avatarPhoto.removeAttribute("src");
    if (headerAvatar) {
      headerAvatar.textContent = "KI";
      headerAvatar.hidden = false;
    }
    if (headerAvatarPhoto) {
      headerAvatarPhoto.hidden = true;
      headerAvatarPhoto.removeAttribute("src");
    }
    return;
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const initials = getUserInitials(user);
  profileName.textContent = displayName || t("profile");
  const username = String(user.username || "").trim();
  profileUsername.textContent = username ? `@${username}` : t("noUsername");
  avatar.textContent = initials;
  if (headerAvatar) {
    headerAvatar.textContent = initials;
    headerAvatar.hidden = false;
  }
  const profileButtonLabel = displayName ? `${displayName} profili` : "Profil";
  document.querySelectorAll("[data-action='profile']").forEach((button) => setControlLabel(button, profileButtonLabel));
  if (user.photo_url) {
    avatarPhoto.src = user.photo_url;
    avatarPhoto.hidden = false;
    avatar.hidden = true;
    if (headerAvatarPhoto) {
      headerAvatarPhoto.src = user.photo_url;
      headerAvatarPhoto.hidden = false;
    }
    if (headerAvatar) {
      headerAvatar.hidden = true;
    }
  } else {
    avatarPhoto.hidden = true;
    avatarPhoto.removeAttribute("src");
    avatar.hidden = false;
    if (headerAvatarPhoto) {
      headerAvatarPhoto.hidden = true;
      headerAvatarPhoto.removeAttribute("src");
    }
    if (headerAvatar) {
      headerAvatar.hidden = false;
    }
  }
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function splitMovieGenres(value) {
  return String(value || "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}

function getMovieCategory(movie) {
  return normalizeCategoryValue(movie?.genre || "kino");
}

function getMovieCategoryValues(movie) {
  const parts = splitMovieGenres(movie?.genre);
  if (!parts.length) return [normalizeCategoryValue("kino")];
  const seen = new Set();
  const values = [];
  for (const part of parts) {
    const value = normalizeCategoryValue(part);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values.length ? values : [normalizeCategoryValue("kino")];
}

function readWishlist() {
  try {
    const payload = JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]");
    return Array.isArray(payload) ? payload.map(String) : [];
  } catch {
    return [];
  }
}

function writeWishlist(ids) {
  try {
    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids));
  } catch {}
  // Telegram CloudStorage'ga ham yozamiz — sessiyalar va qurilmalar orasida saqlanadi.
  // Telegram WebView ba'zi holatlarda localStorage'ni tozalab yuboradi, shuning uchun
  // bu nusxa wishlist'ni qaytib ochilganda ham yo'qotmaslik uchun zarur.
  pushWishlistToCloud(ids);
}

function pushWishlistToCloud(ids) {
  try {
    if (tg && tg.CloudStorage && typeof tg.CloudStorage.setItem === "function") {
      tg.CloudStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(ids), () => {});
    }
  } catch {}
}

function syncWishlistFromCloud() {
  return new Promise((resolve) => {
    try {
      if (!tg || !tg.CloudStorage || typeof tg.CloudStorage.getItem !== "function") {
        resolve(false);
        return;
      }
      tg.CloudStorage.getItem(WISHLIST_STORAGE_KEY, (err, value) => {
        if (err || !value) {
          // Cloud bo'sh — lokaldagi (agar bor bo'lsa) ni cloud'ga itarib qo'yamiz
          const localIds = readWishlist();
          if (localIds.length) pushWishlistToCloud(localIds);
          resolve(false);
          return;
        }
        try {
          const cloudIds = JSON.parse(value);
          if (Array.isArray(cloudIds)) {
            const localIds = readWishlist();
            const merged = Array.from(new Set([...localIds.map(String), ...cloudIds.map(String)]));
            localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(merged));
            // Cloud bilan farq bo'lsa, yangilab qo'yamiz
            if (merged.length !== cloudIds.length) {
              pushWishlistToCloud(merged);
            }
            resolve(true);
            return;
          }
        } catch {}
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

function isInWishlist(id) {
  return readWishlist().includes(String(id));
}

function toggleWishlist(id) {
  const key = String(id);
  const list = readWishlist();
  const idx = list.indexOf(key);
  if (idx >= 0) list.splice(idx, 1);
  else list.push(key);
  writeWishlist(list);
  return idx < 0;
}

function filteredMovies() {
  const wishlistIds = activeFilter === "favorites" ? new Set(readWishlist()) : null;
  return getViewerMovies().filter((movie) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "top" && movie.isTop) ||
      (activeFilter === "premium" && movie.isPremium) ||
      (activeFilter === "favorites" && wishlistIds.has(String(movie.id)));
    const matchesCategory = activeCategory === "all" || getMovieCategoryValues(movie).includes(activeCategory);
    const haystack = `${movie.title} ${movie.genre || ""} ${movie.year || ""} ${movie.code || ""}`.toLowerCase();
    return matchesFilter && matchesCategory && haystack.includes(query.toLowerCase());
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

function toBooleanFlag(value) {
  if (value === true) return true;
  if (value === false || value === undefined || value === null) return false;
  if (typeof value === "number") return value > 0;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || ["false", "0", "no", "off", "yoq", "yo'q"].includes(normalized)) return false;
  return ["true", "1", "yes", "on", "ha"].includes(normalized);
}

function getPosterImage(movie) {
  // PosterImage asosiy, agar yo'q bo'lsa headerImage ishlatiladi (header section kinolari uchun)
  return String(movie?.posterImage || movie?.poster || movie?.headerImage || movie?.heroPoster || "").trim();
}



function isDataImageValue(value) {
  return String(value || "").trim().startsWith("data:image/");
}

function posterStyle(movie) {
  const source = getPosterImage(movie);
  if (!source) return "";
  const poster = source.replaceAll("'", "%27").replaceAll(")", "%29");
  return `style="--poster-image: url('${poster}')"`;
}



function safeUrl(value) {
  try {
    return value ? new URL(String(value), window.location.href) : null;
  } catch {
    return null;
  }
}

function resolveAppUrl(value) {
  const pasted = String(value || "").trim().replace(/^["']+|["']+$/g, "");
  const protocolMatch = pasted.match(/https?:\/\/.+/i);
  const raw = protocolMatch ? protocolMatch[0].trim() : pasted;
  if (!raw) return "";
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^(?:[a-z0-9-]+\.)*(?:public\.)?blob\.vercel-storage\.com\//i.test(raw)) {
    return `https://${raw}`;
  }
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return buildApiUrl(raw);
  return raw;
}

function sanitizePublicGenre(value) {
  const normalized = String(value || "").trim();
  return /^google drive$/i.test(normalized) ? "Kino" : normalized;
}

function sanitizePublicDescription(value) {
  const normalized = String(value || "").trim();
  return /google drive/i.test(normalized) ? "Tomosha uchun tayyor kino." : normalized;
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
  return String(
    movie?.driveFileId ||
    movie?.fileId ||
    movie?.googleDriveFileId ||
    movie?.telegramVideoFileId ||
    movie?.video_file_id ||
    movie?.videoFileId ||
    movie?.telegramFileId ||
    "",
  ).trim();
}

function getMoviePostUrl(movie) {
  return String(movie?.telegramPostUrl || movie?.webViewLink || movie?.sourceUrl || "").trim();
}

async function probeApiBase(base) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(`${base}/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function resolveApiBase() {
  if (window.location.protocol !== "file:") return runtimeApiBase;
  if (apiBaseResolutionPromise) return apiBaseResolutionPromise;

  apiBaseResolutionPromise = (async () => {
    const explicitBase = String(pageParams.get("apiBase") || "").trim().replace(/\/+$/, "");
    if (explicitBase) {
      runtimeApiBase = explicitBase;
      localStorage.setItem(API_BASE_STORAGE_KEY, runtimeApiBase);
      return runtimeApiBase;
    }

    const candidates = [];
    if (PROD_API_BASE) candidates.push(PROD_API_BASE);
    const storedBase = String(localStorage.getItem(API_BASE_STORAGE_KEY) || "").trim().replace(/\/+$/, "");
    if (storedBase) candidates.push(storedBase);
    for (const candidate of LOCAL_API_BASES) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }

    for (const candidate of candidates) {
      if (await probeApiBase(candidate)) {
        runtimeApiBase = candidate;
        localStorage.setItem(API_BASE_STORAGE_KEY, runtimeApiBase);
        return runtimeApiBase;
      }
    }

    runtimeApiBase = PROD_API_BASE;
    localStorage.setItem(API_BASE_STORAGE_KEY, runtimeApiBase);
    return runtimeApiBase;
  })();

  return apiBaseResolutionPromise;
}

function buildApiUrl(path) {
  return `${runtimeApiBase}${path}`;
}

function buildTelegramStreamUrl(fileId) {
  return buildApiUrl(`/api/stream/${encodeURIComponent(fileId)}`);
}

function buildDriveStreamUrl(fileId) {
  return buildApiUrl(`/api/drive-stream/${encodeURIComponent(fileId)}`);
}

function buildDriveThumbnailUrl(fileId) {
  return buildApiUrl(`/api/drive-thumbnail/${encodeURIComponent(fileId)}`);
}

function fileExtension(value) {
  const path = String(value || "").split("?")[0].split("#")[0];
  const match = path.match(/\.([a-z0-9]{2,6})$/i);
  return match ? match[1].toLowerCase() : "";
}

function buildGeneratedPosterDataUrl(movie) {
  const title = String(movie?.title || "My Kino").trim();
  const subtitle = [movie?.year, movie?.quality || "HD"].filter(Boolean).join(" - ") || "Cinematic streaming";
  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1080">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#221516"/>
          <stop offset="55%" stop-color="#0f1622"/>
          <stop offset="100%" stop-color="#7d5b20"/>
        </linearGradient>
        <linearGradient id="glass" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.26)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0.08)"/>
        </linearGradient>
      </defs>
      <rect width="720" height="1080" fill="url(#bg)"/>
      <circle cx="585" cy="170" r="132" fill="rgba(255,204,79,0.22)"/>
      <circle cx="162" cy="902" r="176" fill="rgba(84,130,255,0.12)"/>
      <rect x="48" y="48" width="624" height="984" rx="42" fill="rgba(12,16,24,0.28)" stroke="url(#glass)" stroke-width="2"/>
      <text x="74" y="166" fill="#f8d25c" font-size="28" font-family="Inter, Arial, sans-serif" letter-spacing="2">MY KINO</text>
      <text x="74" y="820" fill="#ffffff" font-size="62" font-weight="700" font-family="Georgia, Times New Roman, serif">${safeTitle}</text>
      <text x="74" y="888" fill="rgba(255,255,255,0.78)" font-size="28" font-family="Inter, Arial, sans-serif">${safeSubtitle}</text>
      <text x="74" y="952" fill="rgba(255,255,255,0.58)" font-size="22" font-family="Inter, Arial, sans-serif">Poster topilmaganda avtomatik cover</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function isMobileViewingContext() {
  const userAgent = navigator.userAgent || "";
  const uaLooksMobile = /Android|iPhone|iPad|iPod|Mobile|Telegram/i.test(userAgent);
  const narrowViewport = window.matchMedia?.("(max-width: 760px)")?.matches;
  return Boolean(uaLooksMobile || narrowViewport);
}

function canBrowserPlayMovie(movie) {
  const mimeType = String(movie?.mimeType || "").trim().toLowerCase();
  const ext = fileExtension(movie?.fileName || movie?.sourceUrl || movie?.videoUrl || "");

  if (mimeType.includes("matroska") || ext === "mkv") return false;
  if (mimeType.includes("avi") || ext === "avi") return false;

  if (!mimeType) return true;
  const probe = document.createElement("video");
  const result = probe.canPlayType(mimeType);
  return result === "probably" || result === "maybe";
}

function isLaunchReadyMovie(movie) {
  if (!movie) return false;
  if (getYouTubeVideoUrl(movie)) return true;

  const mimeType = String(movie?.mimeType || "").trim().toLowerCase();
  const ext = fileExtension(movie?.fileName || movie?.sourceUrl || movie?.videoUrl || "");

  if (mimeType.includes("matroska") || ext === "mkv") return false;
  if (mimeType.includes("avi") || ext === "avi") return false;
  if (mimeType.includes("webm") || ext === "webm") return false;

  if (
    mimeType.includes("mp4")
    || mimeType.includes("quicktime")
    || ext === "mp4"
    || ext === "m4v"
    || ext === "mov"
  ) {
    return true;
  }

  if (movie?.driveFileId || movie?.fileId) {
    return false;
  }

  return canBrowserPlayMovie(movie);
}

function getViewerMovies() {
  return movies;
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

function normalizeMovie(movie, index = 0) {
  const fileId = getMovieFileId(movie);
  const postUrl = getMoviePostUrl(movie);
  const safeId = String(movie?.id || movie?.code || `movie-${index + 1}`);
  const title = String(movie?.title || `Kino ${index + 1}`).trim();
  const rawPoster = String(movie?.posterImage || movie?.poster || movie?.thumbnail || (fileId ? buildDriveThumbnailUrl(fileId) : "")).trim();
  const sourceType = String(movie?.sourceType || "").trim();
  const fileName = String(movie?.fileName || movie?.name || "").trim();
  const sourceUrl = getMovieVideoUrl(movie);

  const normalized = {
    id: safeId,
    title,
    description: sanitizePublicDescription(movie?.description),
    genre: sanitizePublicGenre(movie?.genre || movie?.category),
    rating: Number(movie?.rating) || 0,
    year: movie?.year || "",
    hd: toBooleanFlag(movie?.hd ?? movie?.quality === "HD"),
    code: String(movie?.code || "").trim(),
    posterImage: resolveAppUrl(rawPoster),
    isPremium: Boolean(movie?.isPremium),
    isTop: Boolean(movie?.isTop),
    sourceType,
    fileId,
    driveFileId: String(movie?.driveFileId || movie?.fileId || movie?.googleDriveFileId || "").trim(),
    fileName,
    telegramVideoFileId: fileId,
    telegramFileId: fileId,
    video_file_id: fileId,
    telegramPostUrl: postUrl,
    sourceUrl,
    webViewLink: resolveAppUrl(String(movie?.webViewLink || "").trim()),
    mimeType: String(movie?.mimeType || "").trim(),
    headerImage: resolveAppUrl(String(movie?.headerImage || movie?.heroPoster || "").trim()),
    showInHeader: toBooleanFlag(movie?.showInHeader ?? movie?.heroFeatured),
  };

  if (!normalized.videoUrl && normalized.driveFileId) {
    normalized.videoUrl = buildDriveStreamUrl(normalized.driveFileId);
  } else if (!normalized.videoUrl && normalized.telegramVideoFileId) {
    normalized.videoUrl = buildTelegramStreamUrl(normalized.telegramVideoFileId);
  }

  if (normalized.videoUrl) normalized.videoUrl = resolveAppUrl(normalized.videoUrl);
  if (normalized.streamUrl) normalized.streamUrl = resolveAppUrl(normalized.streamUrl);
  if (normalized.thumbnail) normalized.thumbnail = resolveAppUrl(normalized.thumbnail);

  return normalized;
}

function readWatchProgressStore() {
  try {
    const payload = JSON.parse(localStorage.getItem(WATCH_PROGRESS_KEY) || "{}");
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

function writeWatchProgressStore(store) {
  localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(store));
}

function readWatchedMoviesStore() {
  try {
    const payload = JSON.parse(localStorage.getItem(WATCHED_MOVIES_KEY) || "{}");
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

function writeWatchedMoviesStore(store) {
  localStorage.setItem(WATCHED_MOVIES_KEY, JSON.stringify(store));
}

function syncWatchedCount() {
  watchedCount = getWatchedMovieEntries().length;
  localStorage.setItem("kino_watched_count", String(watchedCount));
  if (viewCount) {
    viewCount.textContent = watchedCount;
  }
}

function markMovieWatched(movie, progress = 0) {
  if (!movie?.id) return;
  const store = readWatchedMoviesStore();
  store[String(movie.id)] = {
    id: String(movie.id),
    title: movie.title || "Kino",
    poster: getPosterImage(movie),
    year: movie.year || "",
    genre: movie.genre || "Kino",
    progress: Math.max(0, Math.floor(Number(progress) || 0)),
    watchedAt: Date.now(),
  };
  writeWatchedMoviesStore(store);
}

function updateWatchedMovieProgress(movie, progress = 0) {
  if (!movie?.id) return;
  const store = readWatchedMoviesStore();
  const key = String(movie.id);
  const existing = store[key];
  if (!existing) return;
  store[key] = {
    ...existing,
    progress: Math.max(0, Math.floor(Number(progress) || 0)),
  };
  writeWatchedMoviesStore(store);
}

function getWatchedMovieEntries() {
  return Object.values(readWatchedMoviesStore())
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => Number(right.watchedAt || 0) - Number(left.watchedAt || 0));
}

function removeWatchedMovie(movieId) {
  if (!movieId) return;
  const nextWatched = readWatchedMoviesStore();
  delete nextWatched[String(movieId)];
  writeWatchedMoviesStore(nextWatched);

  const nextProgress = readWatchProgressStore();
  delete nextProgress[String(movieId)];
  writeWatchProgressStore(nextProgress);
}

function clearWatchedHistory() {
  localStorage.removeItem(WATCHED_MOVIES_KEY);
  localStorage.removeItem(WATCH_PROGRESS_KEY);
}

function getMovieProgressEntry(movie) {
  if (!movie?.id) return null;
  const entry = readWatchProgressStore()[String(movie.id)];
  return entry && typeof entry === "object" ? entry : null;
}

function getMovieProgressSeconds(movie) {
  const seconds = Number(getMovieProgressEntry(movie)?.time || 0);
  return Number.isFinite(seconds) ? seconds : 0;
}

function saveMovieProgress(movie, currentTime, duration) {
  if (!movie?.id) return;
  const safeTime = Math.max(0, Math.floor(Number(currentTime) || 0));
  const safeDuration = Math.max(0, Math.floor(Number(duration) || 0));
  const store = readWatchProgressStore();
  const key = String(movie.id);

  if (
    !safeDuration ||
    safeTime < WATCH_PROGRESS_MIN_SECONDS ||
    safeTime >= safeDuration - WATCH_PROGRESS_END_GAP
  ) {
    delete store[key];
    writeWatchProgressStore(store);
    updateWatchedMovieProgress(movie, 0);
    return;
  }

  store[key] = {
    time: safeTime,
    duration: safeDuration,
    updatedAt: Date.now(),
    title: movie.title || "",
  };
  writeWatchProgressStore(store);
  updateWatchedMovieProgress(movie, safeTime);
}

function clearMovieProgress(movie) {
  if (!movie?.id) return;
  const store = readWatchProgressStore();
  delete store[String(movie.id)];
  writeWatchProgressStore(store);
  updateWatchedMovieProgress(movie, 0);
}

function updateWatchedMovieProgress(movie, progress) {
  // Mock logic if this was previously empty
}

function setEmptyState(_title, _text) {}

function updateEmptyState(_list) {}

function buildCategoryOptions() {
  const map = new Map();
  map.set("all", plainLabel(t("all")));

  for (const movie of getViewerMovies()) {
    for (const rawGenre of splitMovieGenres(movie?.genre)) {
      const value = normalizeCategoryValue(rawGenre);
      if (!rawGenre || !value || map.has(value)) continue;
      map.set(value, rawGenre);
    }
  }

  return [...map.entries()].map(([value, label]) => ({ value, label }));
}

function renderCategories() {
  if (!categoryList) return;
  const options = buildCategoryOptions();
  categoryList.innerHTML = "";

  for (const option of options) {
    const button = document.createElement("button");
    button.className = `category-chip${option.value === activeCategory ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.category = option.value;
    button.textContent = option.label;
    categoryList.append(button);
  }
}



function syncNavButtons() {
  document.querySelectorAll('[data-filter="all"]').forEach((button) => {
    button.classList.toggle("is-active", activeFilter === "all" && activeCategory === "all" && !query);
  });

  document.querySelectorAll('[data-action="search"]').forEach((button) => {
    button.classList.toggle("is-active", (searchPanel && !searchPanel.hidden) || Boolean(query));
  });

  document.querySelectorAll('[data-action="categories"]').forEach((button) => {
    button.classList.toggle("is-active", (categoryPanel && !categoryPanel.hidden) || activeCategory !== "all");
  });

  document.querySelectorAll('[data-action="favorites"]').forEach((button) => {
    button.classList.toggle("is-active", activeFilter === "favorites");
  });
}

let heroFeaturedMovie = null;
let heroSlides = [];

function pickHeroSlides() {
  return movies.filter((m) => m && m.showInHeader && (m.headerImage || getPosterImage(m)));
}

function renderHeroSlide(movie) {
  if (!movie) return;
  heroFeaturedMovie = movie;

  const heroBackdrop = document.getElementById("heroBackdrop");
  const heroShimmer = document.getElementById("heroShimmer");
  const heroTitle = document.getElementById("heroTitle");
  const heroDescription = document.getElementById("heroDescription");
  const heroPlayLabel = document.getElementById("heroPlayLabel");

  const imageUrl = String(movie.headerImage || getPosterImage(movie) || "").trim();
  if (heroBackdrop) {
    if (imageUrl) {
      const safeUrlValue = imageUrl.replaceAll("'", "%27");
      heroBackdrop.classList.remove("is-loaded");
      const probe = new Image();
      probe.onload = () => {
        heroBackdrop.style.backgroundImage = `url('${safeUrlValue}')`;
        heroBackdrop.classList.add("is-loaded");
      };
      probe.onerror = () => {
        heroBackdrop.style.backgroundImage = `url('${safeUrlValue}')`;
        heroBackdrop.classList.add("is-loaded");
      };
      probe.src = imageUrl;
    } else {
      heroBackdrop.style.backgroundImage = "linear-gradient(135deg, #1f1f1f, #050505)";
      heroBackdrop.classList.add("is-loaded");
    }
  }
  if (heroShimmer) heroShimmer.hidden = false;
  if (heroTitle) heroTitle.textContent = movie.title || "";
  if (heroDescription) {
    const desc = String(movie.description || "").trim();
    const fallback = [movie.genre, movie.year].filter(Boolean).join(" · ");
    heroDescription.textContent = desc || fallback;
  }
  if (heroPlayLabel) heroPlayLabel.textContent = plainLabel(t("watch"));

  renderHeroDots();
}

function renderHeroDots() {
  const heroSection = document.getElementById("heroSection");
  if (!heroSection) return;
  let dots = heroSection.querySelector(".hero__dots");
  if (heroSlides.length <= 1) {
    if (dots) dots.remove();
    return;
  }
  if (!dots) {
    dots = document.createElement("div");
    dots.className = "hero__dots";
    heroSection.append(dots);
  }
  dots.innerHTML = heroSlides
    .map((_, idx) => `<span class="hero__dot${idx === heroActiveIndex ? " is-active" : ""}"></span>`)
    .join("");
}

function startHeroAutoRotate() {
  stopHeroAutoRotate();
  if (heroSlides.length <= 1) return;
  heroIntervalId = window.setInterval(() => {
    heroActiveIndex = (heroActiveIndex + 1) % heroSlides.length;
    renderHeroSlide(heroSlides[heroActiveIndex]);
  }, HERO_ROTATE_INTERVAL_MS);
}

function stopHeroAutoRotate() {
  if (heroIntervalId) {
    window.clearInterval(heroIntervalId);
    heroIntervalId = null;
  }
}

function renderHeroCarousel() {
  const heroSection = document.getElementById("heroSection");
  if (!heroSection) return;

  const isHomeView = activeFilter === "all" && activeCategory === "all" && !query;
  const slides = pickHeroSlides();

  if (!slides.length || !isHomeView || movieLoadState !== "ready") {
    heroSection.hidden = true;
    heroFeaturedMovie = null;
    heroSlides = [];
    stopHeroAutoRotate();
    return;
  }

  heroSlides = slides;
  if (heroActiveIndex >= heroSlides.length) heroActiveIndex = 0;
  heroSection.hidden = false;
  renderHeroSlide(heroSlides[heroActiveIndex]);
  startHeroAutoRotate();
}

function attachHeroBindings() {
  const heroPlay = document.getElementById("heroPlayButton");
  const heroInfo = document.getElementById("heroInfoButton");
  if (heroPlay && !heroPlay.dataset.bound) {
    heroPlay.dataset.bound = "1";
    heroPlay.addEventListener("click", () => {
      if (heroFeaturedMovie) openVideoPlayer(heroFeaturedMovie);
    });
  }
  if (heroInfo && !heroInfo.dataset.bound) {
    heroInfo.dataset.bound = "1";
    heroInfo.addEventListener("click", () => {
      if (heroFeaturedMovie) openMovie(heroFeaturedMovie);
    });
  }
}

function createMovieCard(movie) {
  const card = document.createElement("article");
  card.className = "movie-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", movie.title);
  const ratingText = formatRating(movie.rating);
  const genreText = String(movie.genre || "").trim();
  const yearText = String(movie.year || "").trim();
  const metaParts = [];
  if (ratingText && ratingText !== "0.0") metaParts.push(`<span class="card-meta__star">&#9733;</span><span>${escapeHtml(ratingText)}</span>`);
  if (genreText) metaParts.push(`<span class="card-meta__sep">·</span><span class="card-meta__genre">${escapeHtml(genreText)}</span>`);
  else if (yearText) metaParts.push(`<span class="card-meta__sep">·</span><span class="card-meta__genre">${escapeHtml(yearText)}</span>`);

  const inWishlist = isInWishlist(movie.id);
  card.innerHTML = `
    <span class="poster" ${posterStyle(movie)}>
      <span class="card-badges">
        <span class="badge">${escapeHtml(movie.quality || "HD")}</span>
        <span class="rating"><span>&#9733;</span> ${escapeHtml(ratingText)}</span>
      </span>
      <button class="wishlist-toggle${inWishlist ? " is-active" : ""}" type="button" aria-pressed="${inWishlist ? "true" : "false"}" aria-label="Sevimlilarga qo'shish" data-wishlist-id="${escapeHtml(movie.id)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
      </button>
    </span>
    <span class="card-copy">
      <h2>${escapeHtml(movie.title)}</h2>
      <p class="card-meta">${metaParts.join("")}</p>
    </span>
  `;
  const wishlistBtn = card.querySelector(".wishlist-toggle");
  wishlistBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    const isActive = toggleWishlist(movie.id);
    wishlistBtn.classList.toggle("is-active", isActive);
    wishlistBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    if (activeFilter === "favorites") {
      renderMovies();
    }
  });
  card.addEventListener("click", () => openMovie(movie));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMovie(movie);
    }
  });
  return card;
}

function buildHomeCategoryGroups() {
  const groups = new Map();
  for (const movie of getViewerMovies()) {
    const parts = splitMovieGenres(movie?.genre);
    const list = parts.length ? parts : ["Kino"];
    for (const rawGenre of list) {
      const value = normalizeCategoryValue(rawGenre || "kino");
      if (!value) continue;
      const label = rawGenre || "Kino";
      if (!groups.has(value)) groups.set(value, { value, label, movies: [] });
      groups.get(value).movies.push(movie);
    }
  }
  return [...groups.values()];
}

function renderHomeRows() {
  const groups = buildHomeCategoryGroups();
  const moreLabel = plainLabel(t("categories"));
  for (const group of groups) {
    if (!group.movies.length) continue;
    const section = document.createElement("section");
    section.className = "category-row";
    section.innerHTML = `
      <header class="category-row__head">
        <h3 class="category-row__title">${escapeHtml(group.label)}</h3>
        <button class="category-row__more" type="button" data-category="${escapeHtml(group.value)}" aria-label="${escapeHtml(group.label)} - ${escapeHtml(moreLabel)}">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="9 6 15 12 9 18"></polyline>
          </svg>
        </button>
      </header>
      <div class="category-row__list" role="list"></div>
    `;
    const list = section.querySelector(".category-row__list");
    for (const movie of group.movies) {
      list.append(createMovieCard(movie));
    }
    section.querySelector(".category-row__more").addEventListener("click", () => {
      setCategory(group.value);
      document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    grid.append(section);
  }
  return groups.length;
}

function renderMovies() {
  const isHomeView = activeFilter === "all" && activeCategory === "all" && !query;
  grid.innerHTML = "";

  if (isHomeView && movieLoadState === "ready") {
    grid.classList.add("is-home");
    const rowCount = renderHomeRows();
    updateEmptyState(rowCount > 0 ? getViewerMovies() : []);
  } else {
    grid.classList.remove("is-home");
    const list = movieLoadState === "ready" ? filteredMovies() : [];
    updateEmptyState(list);
    for (const movie of list) {
      grid.append(createMovieCard(movie));
    }
  }

  renderCategories();
  syncNavButtons();
  renderHeroCarousel();
}

function renderProfileHistory() {
  if (!watchedMovieList || !watchedMovieCount || !watchedMovieEmpty) return;
  const entries = getWatchedMovieEntries();
  watchedMovieList.innerHTML = "";
  watchedMovieCount.textContent = String(entries.length);
  watchedMovieEmpty.hidden = entries.length > 0;

  for (const entry of entries) {
    const movie = movies.find((item) => String(item.id) === String(entry.id));
    const card = document.createElement("article");
    card.className = "profile-history__item";
    card.tabIndex = movie ? 0 : -1;
    card.setAttribute("role", movie ? "button" : "article");
    if (movie) {
      card.setAttribute("aria-label", `${entry.title || "Kino"} ${plainLabel(t("watch"))}`);
    }
    card.innerHTML = `
      <div class="profile-history__poster" style="--poster-image: url('${String(entry.poster || buildGeneratedPosterDataUrl({ title: entry.title, year: entry.year, quality: "HD" })).replaceAll("'", "%27").replaceAll(")", "%29")}')"></div>
      <div class="profile-history__copy">
        <strong>${escapeHtml(entry.title || "Kino")}</strong>
        <span>${escapeHtml([entry.year || "", entry.genre || ""].filter(Boolean).join(" - ") || "Kino")}</span>
        <small>${entry.progress >= WATCH_PROGRESS_MIN_SECONDS ? `${t("continueAt")} ${formatPlaybackTime(entry.progress)}` : plainLabel(t("watch"))}</small>
      </div>
      <button class="profile-history__remove" type="button" data-history-remove="${escapeHtml(entry.id)}" aria-label="${escapeHtml(t("removeHistoryItem"))}" title="${escapeHtml(t("removeHistoryItem"))}">
        <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </button>
    `;

    if (movie) {
      const reopenMovie = () => {
        profileModal.close();
        openMovie(movie);
      };
      card.addEventListener("click", reopenMovie);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          reopenMovie();
        }
      });
    }

    watchedMovieList.append(card);
  }
}

function renderProfileModal() {
  const user = getTelegramUser();
  applyTelegramUser();
  if (watchedHistoryTitle) {
    watchedHistoryTitle.textContent = t("watchedLabel");
  }
  if (clearHistoryButton) {
    clearHistoryButton.textContent = t("clearHistory");
    clearHistoryButton.hidden = getWatchedMovieEntries().length === 0;
  }
  if (watchedMovieEmpty) {
    watchedMovieEmpty.textContent = t("historyEmpty");
  }
  viewCount.textContent = watchedCount;
  renderProfileHistory();
}

function openMovie(movie) {
  const posterImage = getPosterImage(movie);
  modalPoster.style.backgroundImage = posterImage
    ? `linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,.32) 100%), url('${posterImage.replaceAll("'", "%27")}'), linear-gradient(135deg, #253142, #10161f 58%, #2b1b1d)`
    : "linear-gradient(135deg, #253142, #10161f 58%, #2b1b1d)";
  modalMeta.innerHTML = `
    <span><b>${escapeHtml(t("genreLabel"))}</b>${escapeHtml(movie.genre || "Kino")}</span>
    <span><b>${escapeHtml(t("ratingLabel"))}</b>${escapeHtml(formatRating(movie.rating))}</span>
  `;
  modalTitle.textContent = movie.title;
  modalDescription.textContent = movie.description;
  watchButton.textContent = plainLabel(t("watch"));
  watchButton.dataset.movieId = movie.id;
  activeMovie = movie;
  movieModal.showModal();
  movieModal.scrollTop = 0;
  movieModal.querySelector(".modal-content")?.scrollTo?.({ top: 0, left: 0 });
  document.body.classList.add("is-modal-open");
}

function setVideoLoading(isLoading) {
  videoLoading.hidden = !isLoading;
}

function setFallbackMessage(message = "Tomosha uchun manba tayyorlanmoqda.", sourceUrl = "") {
  const hasMessage = Boolean(String(message || "").trim());
  const hasLink = Boolean(String(sourceUrl || "").trim());
  videoFallback.hidden = !hasMessage && !hasLink;
  if (videoFallbackText) {
    videoFallbackText.textContent = hasMessage ? message : "";
    videoFallbackText.hidden = !hasMessage;
  }
  if (sourceUrl) {
    videoExternalLink.href = sourceUrl;
    videoExternalLink.textContent = t("openSource");
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

function clearYouTubeProgressTimer() {
  if (youtubeProgressTimer) {
    window.clearInterval(youtubeProgressTimer);
    youtubeProgressTimer = null;
  }
}

function clearYouTubeAutoAdvanceTimer() {
  if (youtubeAutoAdvanceTimer) {
    window.clearTimeout(youtubeAutoAdvanceTimer);
    youtubeAutoAdvanceTimer = null;
  }
}

function setCustomVideoMode(isActive) {
  videoMount.classList.toggle("is-youtube-custom", isActive);
  if (!isActive) {
    setControlLabel(videoBackButton, "-10s");
    setStateLabel(videoToggleButton, "play", plainLabel(t("play")));
    setControlLabel(videoForwardButton, "+10s");
    setStateLabel(videoFullscreenButton, document.fullscreenElement ? "exit" : "enter", plainLabel(document.fullscreenElement ? t("exitFull") : t("full")));
    videoSeek.value = "0";
    videoCurrentTime.textContent = "0:00";
    videoDuration.textContent = "0:00";
    setRangeFill(videoSeek, 0, 1000);
    isAdjustingSeek = false;
    pendingSeekTime = 0;
  }
}

function formatPlaybackTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function syncFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);
  setStateLabel(videoFullscreenButton, isFullscreen ? "exit" : "enter", plainLabel(isFullscreen ? t("exitFull") : t("full")));
}

function syncPlaylistNavigationButtons() {
  // playlist navigation removed (no prev/next buttons in new player UI)
}

function syncSpeedOptions() {
  updateSpeedLabel();
}

function updateSpeedLabel() {
  if (!videoSpeedLabel) return;
  const formatted = Number.isInteger(currentSpeed) ? `${currentSpeed}x` : `${currentSpeed}x`;
  videoSpeedLabel.textContent = `(${formatted})`;
}

function cycleSpeed() {
  const idx = SPEED_OPTIONS.indexOf(currentSpeed);
  const nextIdx = (idx + 1) % SPEED_OPTIONS.length;
  currentSpeed = SPEED_OPTIONS[nextIdx];
  playerCore.setRate(currentSpeed);
  updateSpeedLabel();
  showPlayerToast(`${currentSpeed}x`);
}

function getActiveVideoEl() {
  return videoMount.querySelector("video");
}

const playerCore = {
  isYouTube() { return Boolean(activeYouTubePlayer); },
  el() { return getActiveVideoEl(); },
  togglePlay() {
    if (this.isYouTube()) return toggleYouTubePlayback();
    const v = this.el();
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  },
  seekBy(delta) {
    if (this.isYouTube()) return seekYouTubeBy(delta);
    const v = this.el();
    if (!v) return;
    const duration = Number(v.duration) || 0;
    const next = Math.max(0, duration ? Math.min(duration, v.currentTime + delta) : v.currentTime + delta);
    v.currentTime = next;
  },
  setRate(rate) {
    if (this.isYouTube()) { activeYouTubePlayer?.setPlaybackRate?.(rate); return; }
    const v = this.el();
    if (v) v.playbackRate = rate;
  },
  getCurrent() {
    if (this.isYouTube()) return Number(activeYouTubePlayer?.getCurrentTime?.() || 0);
    return Number(this.el()?.currentTime || 0);
  },
  getDuration() {
    if (this.isYouTube()) return Number(activeYouTubePlayer?.getDuration?.() || 0);
    return Number(this.el()?.duration || 0);
  },
  seekTo(seconds) {
    if (this.isYouTube()) { activeYouTubePlayer?.seekTo?.(seconds, true); return; }
    const v = this.el();
    if (v) v.currentTime = seconds;
  },
  isPaused() {
    if (this.isYouTube()) {
      const state = Number(activeYouTubePlayer?.getPlayerState?.() ?? -1);
      return state !== 1;
    }
    const v = this.el();
    return !v || v.paused;
  },
};

function updateHtml5VideoControls() {
  const v = getActiveVideoEl();
  if (!v || activeYouTubePlayer) return;
  const duration = Number(v.duration) || 0;
  const currentTime = isAdjustingSeek ? pendingSeekTime : Number(v.currentTime) || 0;
  const progressValue = duration ? Math.max(0, Math.min(1000, Math.round((currentTime / duration) * 1000))) : 0;
  if (!isAdjustingSeek) videoSeek.value = String(progressValue);
  videoCurrentTime.textContent = formatPlaybackTime(currentTime);
  videoDuration.textContent = formatPlaybackTime(duration);
  setRangeFill(videoSeek, progressValue, 1000);
  const isPlaying = !v.paused && !v.ended;
  setStateLabel(videoToggleButton, isPlaying ? "pause" : "play", plainLabel(isPlaying ? t("pause") : t("play")));
  syncFullscreenButton();
  if (activeMovie && duration) {
    const rounded = Math.floor(currentTime);
    if (rounded !== lastSavedProgressSecond && rounded % 5 === 0) {
      lastSavedProgressSecond = rounded;
      saveMovieProgress(activeMovie, currentTime, duration);
    }
  }
}

function applyBrightness(value) {
  const normalized = Math.max(0.2, Math.min(1, Number(value) / 100));
  videoPlayer.style.setProperty("--player-brightness", String(normalized));
}

function setPlayerLocked(locked) {
  isPlayerLocked = Boolean(locked);
  videoPlayer.classList.toggle("is-locked", isPlayerLocked);
  if (videoLockRelease) videoLockRelease.hidden = !isPlayerLocked;
  if (isPlayerLocked) {
    setControlsVisible(false);
  } else {
    setControlsVisible(true);
    scheduleControlsHide();
  }
}

function setControlsVisible(visible) {
  if (!playerOverlay) return;
  playerOverlay.dataset.visible = visible ? "true" : "false";
  if (visible) scheduleControlsHide();
}

function scheduleControlsHide() {
  if (controlsHideTimer) window.clearTimeout(controlsHideTimer);
  controlsHideTimer = window.setTimeout(() => {
    if (!isPlayerLocked && !playerCore.isPaused()) {
      setControlsVisible(false);
    }
  }, 3500);
}

function showPlayerToast(message) {
  if (!playerToast) return;
  playerToast.textContent = message;
  playerToast.hidden = false;
  if (toastHideTimer) window.clearTimeout(toastHideTimer);
  toastHideTimer = window.setTimeout(() => { playerToast.hidden = true; }, 1200);
}

function syncActiveMovieProgress(force = false) {
  if (!activeYouTubePlayer || !activeMovie || !window.YT?.PlayerState) return;
  const state = activeYouTubePlayer.getPlayerState();
  const currentTime = Number(activeYouTubePlayer.getCurrentTime?.() || 0);
  const duration = Number(activeYouTubePlayer.getDuration?.() || 0);
  const rounded = Math.floor(currentTime);

  if (!force) {
    if (state !== window.YT.PlayerState.PLAYING && state !== window.YT.PlayerState.PAUSED) return;
    if (rounded === lastSavedProgressSecond || rounded % 5 !== 0) return;
  }

  lastSavedProgressSecond = rounded;
  saveMovieProgress(activeMovie, currentTime, duration);
}

function updateYouTubeControls() {
  if (!activeYouTubePlayer || !window.YT?.PlayerState) return;

  const state = activeYouTubePlayer.getPlayerState();
  const duration = Number(activeYouTubePlayer.getDuration?.() || 0);
  const currentTime = isAdjustingSeek ? pendingSeekTime : Number(activeYouTubePlayer.getCurrentTime?.() || 0);
  const progressValue = duration ? Math.max(0, Math.min(1000, Math.round((currentTime / duration) * 1000))) : 0;
  const isPlaying = state === window.YT.PlayerState.PLAYING;
  const currentVolume = Number(activeYouTubePlayer.getVolume?.() || 0);
  const isMuted = Boolean(activeYouTubePlayer.isMuted?.()) || currentVolume === 0;

  if (!isAdjustingSeek) videoSeek.value = String(progressValue);
  videoCurrentTime.textContent = formatPlaybackTime(currentTime);
  videoDuration.textContent = formatPlaybackTime(duration);
  setRangeFill(videoSeek, progressValue, 1000);
  setStateLabel(videoToggleButton, isPlaying ? "pause" : "play", plainLabel(isPlaying ? t("pause") : t("play")));
  syncFullscreenButton();
  const ytRate = Number(activeYouTubePlayer.getPlaybackRate?.() || 1);
  if (Math.abs(ytRate - currentSpeed) > 0.001 && SPEED_OPTIONS.includes(ytRate)) {
    currentSpeed = ytRate;
    updateSpeedLabel();
  }
  syncActiveMovieProgress();
}

function startYouTubeProgressTimer() {
  clearYouTubeProgressTimer();
  youtubeProgressTimer = window.setInterval(updateYouTubeControls, 400);
}

function destroyYouTubePlayer() {
  syncActiveMovieProgress(true);
  clearYouTubeProgressTimer();
  clearYouTubeAutoAdvanceTimer();
  if (activeYouTubePlayer?.destroy) {
    try {
      activeYouTubePlayer.destroy();
    } catch { }
  }
  activeYouTubePlayer = null;
  lastSavedProgressSecond = -1;
  pendingResumeTime = 0;
  setCustomVideoMode(false);
}

function ensureYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-youtube-iframe-api="1"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.dataset.youtubeIframeApi = "1";
      script.onerror = () => reject(new Error("YouTube iframe API yuklanmadi."));
      document.head.append(script);
    }

    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };

    window.setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT);
    }, 0);
  });

  return youtubeApiPromise;
}

function toggleYouTubePlayback() {
  if (!activeYouTubePlayer || !window.YT?.PlayerState) return;
  const state = activeYouTubePlayer.getPlayerState();
  if (state === window.YT.PlayerState.PLAYING) activeYouTubePlayer.pauseVideo();
  else activeYouTubePlayer.playVideo();
  window.setTimeout(updateYouTubeControls, 50);
}

function toggleYouTubeMute() {
  if (!activeYouTubePlayer) return;
  if (activeYouTubePlayer.isMuted?.()) {
    if (Number(activeYouTubePlayer.getVolume?.() || 0) === 0) activeYouTubePlayer.setVolume(100);
    activeYouTubePlayer.unMute();
  } else {
    activeYouTubePlayer.mute();
  }
  updateYouTubeControls();
}

function seekYouTubeBy(deltaSeconds) {
  if (!activeYouTubePlayer) return;
  const current = Number(activeYouTubePlayer.getCurrentTime?.() || 0);
  const duration = Number(activeYouTubePlayer.getDuration?.() || 0);
  const nextTime = Math.max(0, Math.min(duration || current + deltaSeconds, current + deltaSeconds));
  activeYouTubePlayer.seekTo(nextTime, true);
  pendingSeekTime = nextTime;
  isAdjustingSeek = false;
  updateYouTubeControls();
}

function updateYouTubeVolume(value) {
  if (!activeYouTubePlayer) return;
  const safeVolume = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  activeYouTubePlayer.setVolume(safeVolume);
  if (safeVolume === 0) activeYouTubePlayer.mute();
  else activeYouTubePlayer.unMute();
  updateYouTubeControls();
}

function findMovieIndex(movie) {
  if (!movie) return -1;
  return getViewerMovies().findIndex((item) => String(item.id) === String(movie.id));
}

function playMovieAtIndex(index) {
  const visibleMovies = getViewerMovies();
  if (index < 0 || index >= visibleMovies.length) return false;
  openVideoPlayer(visibleMovies[index]);
  return true;
}

function playNextMovie() {
  const currentIndex = findMovieIndex(activeMovie);
  if (currentIndex === -1) return false;
  return playMovieAtIndex(currentIndex + 1);
}

function toggleVideoFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
    return;
  }
  videoPlayer.requestFullscreen?.();
}

async function mountYouTubePlayer(videoUrl, movie, options = {}) {
  const { requestId = activeVideoRequest } = options;
  const parsed = safeUrl(videoUrl);
  const videoId =
    getYouTubeVideoId(movie) ||
    parsed?.searchParams.get("v") ||
    parsed?.pathname.split("/").filter(Boolean).pop() ||
    "";

  if (!videoId) {
    renderVideoSource("", movie, { errorOnly: true, originalUrl: videoUrl });
    return;
  }

  destroyYouTubePlayer();
  setCustomVideoMode(true);
  videoSourceLabel.textContent = t("customPlayer");

  const mountNode = document.createElement("div");
  mountNode.id = `youtube-player-${requestId}`;
  mountNode.className = "youtube-player-host";
  videoMount.replaceChildren(mountNode);

  try {
    const YT = await ensureYouTubeApi();
    if (requestId !== activeVideoRequest || videoPlayer.hidden) return;

    activeYouTubePlayer = new YT.Player(mountNode, {
      host: "https://www.youtube-nocookie.com",
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        fs: 0,
        iv_load_policy: 3,
        playsinline: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
          clearVideoLoadTimer();
          setVideoLoading(false);
          lastSavedProgressSecond = -1;
          startYouTubeProgressTimer();
          activeYouTubePlayer.setVolume(100);
          syncSpeedOptions();
          syncPlaylistNavigationButtons();
          if (pendingResumeTime >= WATCH_PROGRESS_MIN_SECONDS) {
            activeYouTubePlayer.seekTo(pendingResumeTime, true);
          }
          activeYouTubePlayer.playVideo();
          updateYouTubeControls();
        },
        onStateChange: () => {
          if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
          clearYouTubeAutoAdvanceTimer();
          if (activeYouTubePlayer.getPlayerState?.() === window.YT.PlayerState.ENDED) {
            clearMovieProgress(activeMovie);
            youtubeAutoAdvanceTimer = window.setTimeout(() => {
              if (!playNextMovie()) updateYouTubeControls();
            }, 350);
          }
          updateYouTubeControls();
        },
        onPlaybackRateChange: () => {
          if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
          syncSpeedOptions();
        },
        onError: () => {
          if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
          clearVideoLoadTimer();
          destroyYouTubePlayer();
          setVideoLoading(false);
          setFallbackMessage("");
        },
      },
    });
  } catch {
    if (requestId !== activeVideoRequest || videoPlayer.hidden) return;
    destroyYouTubePlayer();
    setVideoLoading(false);
    setFallbackMessage("");
  }
}

function createVideoElement(src, movie, options = {}) {
  destroyYouTubePlayer();
  const normalizedOptions = typeof options === "boolean" ? { isFallback: options } : options;
  const {
    isFallback = false,
    fallbackUrl = "",
    fallbackMessage = "Tomosha uchun manba tayyorlanmoqda.",
    fallbackEmbedUrl = "",
    sourceLabel = t("customPlayer"),
    startupTimeout = 9000,
    preload = "auto",
  } = normalizedOptions;
  const video = document.createElement("video");
  video.src = src;
  video.controls = false;
  video.playsInline = true;
  video.preload = preload;
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("controlsList", "nodownload");
  video.addEventListener("timeupdate", updateHtml5VideoControls);
  video.addEventListener("play", () => { setStateLabel(videoToggleButton, "pause", plainLabel(t("pause"))); scheduleControlsHide(); });
  video.addEventListener("pause", () => { setStateLabel(videoToggleButton, "play", plainLabel(t("play"))); setControlsVisible(true); });
  video.addEventListener("ended", () => { setStateLabel(videoToggleButton, "play", plainLabel(t("play"))); setControlsVisible(true); });
  video.addEventListener("loadedmetadata", () => { video.playbackRate = currentSpeed; updateHtml5VideoControls(); });
  video.addEventListener("ratechange", () => {
    if (Math.abs(video.playbackRate - currentSpeed) > 0.001 && SPEED_OPTIONS.includes(video.playbackRate)) {
      currentSpeed = video.playbackRate;
      updateSpeedLabel();
    }
  });
  let startupDone = false;
  let fallbackMounted = false;
  const finishStartup = () => {
    startupDone = true;
    setVideoLoading(false);
    videoFallback.hidden = true;
  };
  const mountEmbedFallback = () => {
    if (fallbackMounted || !fallbackEmbedUrl) return false;
    fallbackMounted = true;
    window.clearTimeout(startupTimer);
    videoSourceLabel.textContent = sourceLabel;
    videoFallback.hidden = true;
    setVideoLoading(true);
    createIframeElement(fallbackEmbedUrl, movie.title);
    return true;
  };
  const startupTimer = window.setTimeout(() => {
    if (startupDone) return;
    if (mountEmbedFallback()) return;
    setVideoLoading(false);
    setFallbackMessage(fallbackMessage, isFallback ? "" : fallbackUrl || movie.sourceUrl || src);
  }, startupTimeout);
  const onReady = () => {
    window.clearTimeout(startupTimer);
    finishStartup();
  };
  video.addEventListener("loadedmetadata", onReady, { once: true });
  video.addEventListener("loadeddata", onReady, { once: true });
  video.addEventListener("canplay", onReady, { once: true });
  video.addEventListener("playing", onReady, { once: true });
  video.addEventListener(
    "error",
    () => {
      window.clearTimeout(startupTimer);
      if (mountEmbedFallback()) return;
      setVideoLoading(false);
      setFallbackMessage(fallbackMessage, isFallback ? "" : fallbackUrl || movie.sourceUrl || src);
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
  destroyYouTubePlayer();
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
  const {
    isFallback = false,
    originalUrl = "",
    forceVideo = false,
    forceIframe = false,
    errorOnly = false,
    requestId = activeVideoRequest,
    fallbackMessage = "Tomosha uchun manba tayyorlanmoqda.",
  } = options;
  destroyYouTubePlayer();
  clearVideoLoadTimer();
  videoMount.replaceChildren();
  videoFallback.hidden = true;
  videoExternalLink.hidden = true;
  if (videoFallbackText) videoFallbackText.textContent = "";
  videoExternalLink.textContent = t("openSource");
  setVideoLoading(true);

  const sourceUrl = videoUrl || DEMO_VIDEO_URL;
  const parsed = safeUrl(sourceUrl);
  const externalUrl = originalUrl || (movie?.sourceType === "google_drive" ? "" : movie.sourceUrl || "");

  if (errorOnly) {
    videoSourceLabel.textContent = t("customPlayer");
    setVideoLoading(false);
    setFallbackMessage(fallbackMessage, externalUrl);
    return;
  }

  if (!videoUrl || isFallback) {
    setFallbackMessage(fallbackMessage, externalUrl);
    videoSourceLabel.textContent = t("customPlayer");
    createVideoElement(DEMO_VIDEO_URL, movie, { isFallback: true });
    return;
  }

  if (forceIframe && parsed) {
    videoSourceLabel.textContent = t("customPlayer");
    videoLoadTimer = window.setTimeout(() => {
      setVideoLoading(false);
      setFallbackMessage("", externalUrl || parsed.href);
    }, 10000);
    createIframeElement(parsed.href, movie.title);
    return;
  }

  if (forceVideo && parsed) {
    videoSourceLabel.textContent = getInlineSourceLabel(movie);
    createVideoElement(parsed.href, movie, {
      fallbackUrl: externalUrl,
      fallbackMessage,
      sourceLabel: t("customPlayer"),
      preload: "auto",
    });
    return;
  }

  if (isDirectVideoUrl(sourceUrl)) {
    videoSourceLabel.textContent = getInlineSourceLabel(movie);
    createVideoElement(parsed.href, movie, {
      fallbackUrl: externalUrl,
      fallbackMessage,
      sourceLabel: t("customPlayer"),
      preload: "auto",
    });
    return;
  }

  if (isYouTubeUrl(sourceUrl)) {
    const embedUrl = toYouTubeEmbed(sourceUrl);
    if (embedUrl) {
      videoLoadTimer = window.setTimeout(() => {
        setVideoLoading(false);
        setFallbackMessage(fallbackMessage, "");
      }, 7000);
      mountYouTubePlayer(sourceUrl, movie, { requestId });
      return;
    }
  }

  if (isTelegramPostUrl(sourceUrl)) {
    videoSourceLabel.textContent = t("customPlayer");
    setVideoLoading(false);
    setFallbackMessage(fallbackMessage, sourceUrl);
    return;
  }

  if (parsed) {
    videoSourceLabel.textContent = t("customPlayer");
    videoLoadTimer = window.setTimeout(() => {
      setVideoLoading(false);
      setFallbackMessage(fallbackMessage, parsed.href);
    }, 7000);
    createIframeElement(parsed.href, movie.title);
    return;
  }

  renderVideoSource(DEMO_VIDEO_URL, movie, { isFallback: true, fallbackMessage });
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

function getInlineSourceLabel(movie) {
  if (movie?.telegramVideoFileId || movie?.telegramFileId) return "Kino video";
  return "Kino player";
}

async function openVideoPlayer(movie) {
  if (!movie) return;
  const requestId = ++activeVideoRequest;
  activeMovie = movie;
  pendingResumeTime = getMovieProgressSeconds(movie);
  markMovieWatched(movie, pendingResumeTime);
  syncWatchedCount();
  if (movieModal.open) movieModal.close();
  videoTitle.textContent = movie.title || "Kino";
  videoPlayer.hidden = false;
  document.body.classList.add("is-player-open");
  currentSpeed = 1;
  updateSpeedLabel();
  setPlayerLocked(false);
  if (videoBrightness) { videoBrightness.value = "100"; applyBrightness(100); }
  setControlsVisible(true);

  const youtubeUrl = getYouTubeVideoUrl(movie);
  if (youtubeUrl) {
    renderVideoSource(youtubeUrl, movie, { requestId });
    return;
  }

  if (isMobileViewingContext() && !isLaunchReadyMovie(movie)) {
    renderVideoSource("", movie, {
      errorOnly: true,
      originalUrl: "",
      requestId,
      fallbackMessage: "Bu kino telefon uchun MP4 formatda tayyorlanishi kerak.",
    });
    return;
  }

  const driveFileId = String(movie?.driveFileId || movie?.fileId || "").trim();
  if (driveFileId) {
    renderVideoSource(buildDriveStreamUrl(driveFileId), movie, {
      forceVideo: true,
      originalUrl: "",
      requestId,
      fallbackMessage: DRIVE_STREAM_ERROR_MESSAGE,
    });
    return;
  }

  const fileId = getMovieFileId(movie);
  if (fileId) {
    const streamUrl = buildTelegramStreamUrl(fileId);
    renderVideoSource(streamUrl, movie, {
      forceVideo: true,
      originalUrl: getMoviePostUrl(movie),
      requestId,
      fallbackMessage: TELEGRAM_STREAM_ERROR_MESSAGE,
    });
    return;
  }

  const videoUrl = getMovieVideoUrl(movie);
  if (isTelegramPostUrl(videoUrl) && !hasPlayableEmbedSource(movie)) {
    renderVideoSource("", movie, {
      errorOnly: true,
      originalUrl: videoUrl,
      requestId,
      fallbackMessage: TELEGRAM_STREAM_ERROR_MESSAGE,
    });
    return;
  }

  renderVideoSource(videoUrl, movie, { requestId });
}

function closeVideoPlayer() {
  activeVideoRequest += 1;
  clearVideoLoadTimer();
  if (controlsHideTimer) { window.clearTimeout(controlsHideTimer); controlsHideTimer = null; }
  if (toastHideTimer) { window.clearTimeout(toastHideTimer); toastHideTimer = null; }
  setPlayerLocked(false);
  if (playerToast) playerToast.hidden = true;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  destroyYouTubePlayer();
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
  if (videoFallbackText) videoFallbackText.textContent = "";
  videoExternalLink.textContent = t("openSource");
  setVideoLoading(false);
  videoPlayer.hidden = true;
  document.body.classList.remove("is-player-open");
}

function setFilter(filter) {
  activeFilter = filter;
  if (filter === "all" || filter === "favorites") {
    activeCategory = "all";
    query = "";
    if (searchInput) searchInput.value = "";
    setSearchPanelOpen(false);
    if (categoryPanel) categoryPanel.hidden = true;
  }
  renderMovies();
}

function setCategory(category) {
  activeCategory = category;
  activeFilter = "all";
  renderMovies();
}

function toggleTheme() {
  const currentTheme = themeToggle?.dataset.theme || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  localStorage.setItem("kino_theme", newTheme);
}

function syncTopbarSearchLayout() {
  if (!topbarSearch || !topbarSearchTrigger) return;
  const fallbackWidth = 168;
  const triggerWidth = topbarSearchTrigger.offsetWidth || 32;
  let panelWidth = fallbackWidth;

  if (topbarBrand) {
    const brandRect = topbarBrand.getBoundingClientRect();
    const triggerRect = topbarSearchTrigger.getBoundingClientRect();
    panelWidth = Math.round(triggerRect.right - brandRect.right - 10);
  }

  panelWidth = Math.max(triggerWidth + 88, panelWidth);
  topbarSearch.style.setProperty("--topbar-search-panel-width", `${panelWidth}px`);
}

function setSearchPanelOpen(nextState) {
  if (!searchPanel) return;
  searchPanel.hidden = !nextState;
  topbarSearch?.classList.toggle("is-open", nextState);
}

function toggleSearchPanel(forceOpen) {
  if (!searchPanel) return;
  const nextState = typeof forceOpen === "boolean" ? forceOpen : searchPanel.hidden;
  if (nextState) syncTopbarSearchLayout();
  setSearchPanelOpen(nextState);
  if (nextState) {
    if (categoryPanel) categoryPanel.hidden = true;
    if (searchInput) searchInput.focus();
  }
  syncNavButtons();
}

function toggleCategoryPanel(forceOpen) {
  if (!categoryPanel) return;
  const nextState = typeof forceOpen === "boolean" ? forceOpen : categoryPanel.hidden;
  categoryPanel.hidden = !nextState;
  if (nextState) {
    setSearchPanelOpen(false);
  }
  syncNavButtons();
}

function applyCopy() {
  const allLabel = plainLabel(t("all"));
  const homeNavLabel = plainLabel(t("homeNav"));
  const musicNavLabel = plainLabel(t("musicNav"));
  const searchLabel = plainLabel(t("search"));
  const categoriesLabel = plainLabel(t("categories"));

  const allTabLabel = document.querySelector('.quick-tabs [data-filter="all"] .tab__label');
  const searchTabLabel = document.querySelector('.quick-tabs [data-action="search"] .tab__label');
  const categoriesTabLabel = document.querySelector('.quick-tabs [data-action="categories"] .tab__label');

  if (allTabLabel) allTabLabel.textContent = allLabel;
  if (searchTabLabel) searchTabLabel.textContent = searchLabel;
  if (categoriesTabLabel) categoriesTabLabel.textContent = categoriesLabel;

  document.querySelectorAll('.bottom-bar [data-filter="all"]').forEach((button) => {
    setControlLabel(button, homeNavLabel);
    const label = button.querySelector(".bottom-bar__label");
    if (label) label.textContent = homeNavLabel;
  });
  document.querySelectorAll('[data-action="search"]').forEach((button) => setControlLabel(button, searchLabel));
  document.querySelectorAll('[data-action="categories"]').forEach((button) => {
    if (button.closest(".bottom-bar")) return;
    setControlLabel(button, categoriesLabel);
  });
  document.querySelectorAll('.bottom-bar [data-action="categories"]').forEach((button) => {
    setControlLabel(button, musicNavLabel);
    const label = button.querySelector(".bottom-bar__label");
    if (label) label.textContent = musicNavLabel;
  });
  if (langDropdown) {
    const currentLabel = langDropdown.querySelector(".lang-current");
    const options = langDropdown.querySelectorAll(".lang-option");
    if (currentLabel) {
      currentLabel.textContent = lang.toUpperCase() === "EN" ? "ENG" : lang.toUpperCase();
    }
    options.forEach(opt => {
      opt.classList.toggle("is-active", opt.dataset.value === lang);
    });
  }

  if (searchInput) searchInput.placeholder = plainLabel(t("placeholder"));
  if (movieLaterButton) movieLaterButton.textContent = plainLabel(t("later"));
  if (videoLoading) {
    const label = videoLoading.querySelector("b");
    if (label) label.textContent = t("videoLoading");
  }
  if (videoExternalLink) videoExternalLink.textContent = t("openSource");
  setControlLabel(videoBackButton, "-10s");
  setStateLabel(videoToggleButton, videoToggleButton.dataset.state || "play", plainLabel(t("play")));
  setControlLabel(videoForwardButton, "+10s");
  syncFullscreenButton();
  const footerTagline = document.querySelector("#footerTagline");
  if (footerTagline) footerTagline.textContent = plainLabel(t("footerTagline"));
  const footerCopy = document.querySelector("#footerCopy");
  if (footerCopy) footerCopy.textContent = plainLabel(t("footerCopy"));
  profileName.textContent = plainLabel(t("profile"));
  document.documentElement.lang = lang;
  setRangeFill(videoSeek, Number(videoSeek.value || 0), 1000);

  applyTelegramUser();
  renderCategories();
  renderProfileModal();
  renderMovies();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll("[data-action='search']").forEach((button) => {
  button.addEventListener("click", () => toggleSearchPanel());
});

document.querySelectorAll("[data-action='catalog']").forEach((button) => {
  button.addEventListener("click", () => {
    setFilter("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-action='categories']").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (button.closest(".bottom-bar")) {
      event.preventDefault();
      openMusicView();
      return;
    }
    toggleCategoryPanel();
  });
});

// ===== Music view (curated catalog + YouTube IFrame player) =====
const MUSIC_LOCAL_KEY = "kino_admin_music_v1";
const musicView = document.getElementById("musicView");
const musicSearchBtn = document.getElementById("musicSearchBtn");
const musicSearchBar = document.getElementById("musicSearchBar");
const musicSearchInput = document.getElementById("musicSearchInput");
const musicSearchClear = document.getElementById("musicSearchClear");
const musicCategoryRow = document.getElementById("musicCategoryRow");
const musicArtistRow = document.getElementById("musicArtistRow");
const musicListEl = document.getElementById("musicList");
const musicLoadingEl = document.getElementById("musicLoading");
const musicErrorEl = document.getElementById("musicError");
const musicErrorText = document.getElementById("musicErrorText");
const musicEmptyEl = document.getElementById("musicEmpty");
const musicRetryBtn = document.getElementById("musicRetryBtn");

const miniPlayer = document.getElementById("miniPlayer");
const miniPlayerTitle = document.getElementById("miniPlayerTitle");
const miniPlayerArtistEl = document.getElementById("miniPlayerArtist");
const miniPlayerToggle = document.getElementById("miniPlayerToggle");
const miniPlayerClose = document.getElementById("miniPlayerClose");
const miniPlayerBarFill = document.getElementById("miniPlayerBarFill");
const miniPlayerTime = document.getElementById("miniPlayerTime");

let musicAllTracks = [];
let musicCategory = "all";
let musicArtist = "all";
let musicQuery = "";
let musicSearchDebounce = null;
let musicCurrentTrackKey = "";

function trackKey(t) {
  return `${(t.title || "").toLowerCase()}|${(t.artist || "").toLowerCase()}|${t.youtubeId || ""}`;
}

function dedupeTracks(list) {
  const seen = new Map();
  for (const t of list) {
    if (!t || !t.title || !t.artist || !t.youtubeId) continue;
    const key = trackKey(t);
    if (!seen.has(key)) seen.set(key, t);
  }
  return Array.from(seen.values());
}

function readLocalMusic() {
  try {
    const raw = localStorage.getItem(MUSIC_LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}

function escapeMusicHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

function formatMusicTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function showMusicState(name) {
  [musicLoadingEl, musicErrorEl, musicEmptyEl].forEach((el) => { if (el) el.hidden = true; });
  if (musicListEl) musicListEl.hidden = false;
  if (name === "loading" && musicLoadingEl) { musicLoadingEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
  if (name === "error" && musicErrorEl) { musicErrorEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
  if (name === "empty" && musicEmptyEl) { musicEmptyEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
}

async function loadMusicCatalog() {
  showMusicState("loading");
  let seed = [];
  try {
    const res = await fetch("/api/music", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    seed = Array.isArray(json.tracks) ? json.tracks : [];
  } catch (err) {
    if (musicErrorText) musicErrorText.textContent = err.message || "Yuklab bo'lmadi.";
    showMusicState("error");
    return;
  }
  const local = readLocalMusic();
  musicAllTracks = dedupeTracks([...seed, ...local]);
  renderMusicCarousel();
  renderMusicFilters();
  renderMusicList();
}

function uniqSorted(values) {
  const set = new Set(values.filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const MUSIC_CATEGORY_ICONS = {
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  pop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><circle cx="12" cy="14" r="6"/><path d="M8 2h8"/></svg>',
  rap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="3" height="8" rx="1"/><rect x="10" y="4" width="3" height="14" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg>',
  rock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l3 6-3 12 6-6 6 6-3-12 3-6-6 4z"/></svg>',
  jazz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v10"/><circle cx="10" cy="15" r="4"/><path d="M14 3l6 3"/></svg>',
  classic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-6m4 6v-6m4 6v-6"/></svg>',
  electronic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
  uzbek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6h6l-5 4 2 7-5.5-4-5.5 4 2-7-5-4h6z"/></svg>',
  folk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V8l10-3v10"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="15" r="3"/></svg>',
  hiphop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="3" height="8" rx="1"/><rect x="10" y="4" width="3" height="14" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg>',
};

const MUSIC_ARTIST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
const MUSIC_DEFAULT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

function musicCategoryIcon(value) {
  const key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  return MUSIC_CATEGORY_ICONS[key] || MUSIC_DEFAULT_ICON;
}

function musicChipHtml({ active, dataAttr, value, label, icon }) {
  return `<button class="music-chip ${active ? "is-active" : ""}" type="button" ${dataAttr}="${escapeMusicHtml(value)}">
    <span class="music-chip__icon" aria-hidden="true">${icon}</span>
    <span class="music-chip__label">${escapeMusicHtml(label)}</span>
  </button>`;
}

function renderMusicFilters() {
  if (musicCategoryRow) {
    const cats = uniqSorted(musicAllTracks.map((t) => t.category));
    const items = [
      musicChipHtml({ active: musicCategory === "all", dataAttr: "data-music-cat", value: "all", label: "Hammasi", icon: musicCategoryIcon("all") }),
    ].concat(cats.map((c) => musicChipHtml({
      active: musicCategory === c,
      dataAttr: "data-music-cat",
      value: c,
      label: c,
      icon: musicCategoryIcon(c),
    })));
    musicCategoryRow.innerHTML = items.join("");
  }
  if (musicArtistRow) {
    const artists = uniqSorted(musicAllTracks.map((t) => t.artist));
    const items = [
      musicChipHtml({ active: musicArtist === "all", dataAttr: "data-music-artist", value: "all", label: "Hammasi", icon: MUSIC_ARTIST_ICON }),
    ].concat(artists.map((a) => musicChipHtml({
      active: musicArtist === a,
      dataAttr: "data-music-artist",
      value: a,
      label: a,
      icon: MUSIC_ARTIST_ICON,
    })));
    musicArtistRow.innerHTML = items.join("");
  }
}

function filteredMusicTracks() {
  const q = musicQuery.toLowerCase();
  return musicAllTracks.filter((t) => {
    if (musicCategory !== "all" && t.category !== musicCategory) return false;
    if (musicArtist !== "all" && t.artist !== musicArtist) return false;
    if (q && !(t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))) return false;
    return true;
  });
}

function renderMusicList() {
  if (!musicListEl) return;
  const list = filteredMusicTracks();
  if (!list.length) { showMusicState("empty"); return; }
  showMusicState("data");
  const playlist = readMusicPlaylist();
  musicListEl.innerHTML = list.map((t) => {
    const id = escapeMusicHtml(t.youtubeId);
    const inPl = playlist.includes(t.youtubeId);
    return `
    <li class="music-item">
      <div class="music-row ${trackKey(t) === musicCurrentTrackKey ? "is-playing" : ""}">
        <button class="music-row__main" type="button" data-music-row="${id}">
          <span class="music-row__cover" style="background-image:url('https://i.ytimg.com/vi/${id}/mqdefault.jpg')"></span>
          <span class="music-row__meta">
            <span class="music-row__title">${escapeMusicHtml(t.title)}</span>
            <span class="music-row__sub">${escapeMusicHtml(t.artist)}</span>
          </span>
        </button>
        <div class="music-row__actions">
          <button class="music-row__btn music-row__btn--add ${inPl ? "is-added" : ""}" type="button" data-music-add="${id}" aria-label="Playlistga qo'shish">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
          </button>
          <button class="music-row__btn music-row__btn--play" type="button" data-music-row="${id}" aria-label="Play">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z"></path></svg>
          </button>
        </div>
      </div>
    </li>`;
  }).join("");
}

const MUSIC_PLAYLIST_KEY = "kino_music_playlist_v1";
function readMusicPlaylist() {
  try { return JSON.parse(localStorage.getItem(MUSIC_PLAYLIST_KEY) || "[]"); } catch { return []; }
}
function writeMusicPlaylist(ids) {
  try { localStorage.setItem(MUSIC_PLAYLIST_KEY, JSON.stringify(ids)); } catch {}
}
function toggleMusicPlaylist(id) {
  const list = readMusicPlaylist();
  const idx = list.indexOf(id);
  if (idx >= 0) list.splice(idx, 1); else list.push(id);
  writeMusicPlaylist(list);
}

const musicCarouselTrack = document.getElementById("musicCarouselTrack");
const musicCarouselDots = document.getElementById("musicCarouselDots");
let musicCarouselIndex = 0;
let musicCarouselTimer = null;
let musicCarouselItems = [];

function renderMusicCarousel() {
  if (!musicCarouselTrack || !musicCarouselDots) return;
  musicCarouselItems = musicAllTracks.slice(0, 5);
  if (!musicCarouselItems.length) {
    musicCarouselTrack.innerHTML = "";
    musicCarouselDots.innerHTML = "";
    return;
  }
  musicCarouselIndex = Math.min(musicCarouselIndex, musicCarouselItems.length - 1);
  musicCarouselTrack.innerHTML = musicCarouselItems.map((t, i) => `
    <button class="music-slide ${i === musicCarouselIndex ? "is-active" : ""}" type="button" data-music-slide="${escapeMusicHtml(t.youtubeId)}">
      <span class="music-slide__bg" style="background-image:url('https://i.ytimg.com/vi/${escapeMusicHtml(t.youtubeId)}/hqdefault.jpg')"></span>
      <span class="music-slide__gradient"></span>
      <span class="music-slide__inner">
        <span class="music-slide__eyebrow">Featured</span>
        <span class="music-slide__title">${escapeMusicHtml(t.title)}</span>
        <span class="music-slide__artist">${escapeMusicHtml(t.artist)}</span>
      </span>
    </button>
  `).join("");
  musicCarouselDots.innerHTML = musicCarouselItems.map((_, i) => `
    <button class="music-dot ${i === musicCarouselIndex ? "is-active" : ""}" type="button" data-music-dot="${i}" aria-label="Slayd ${i + 1}"></button>
  `).join("");
  startMusicCarouselTimer();
}

function setMusicCarouselIndex(i) {
  if (!musicCarouselItems.length) return;
  musicCarouselIndex = (i + musicCarouselItems.length) % musicCarouselItems.length;
  musicCarouselTrack?.querySelectorAll(".music-slide").forEach((el, idx) => el.classList.toggle("is-active", idx === musicCarouselIndex));
  musicCarouselDots?.querySelectorAll(".music-dot").forEach((el, idx) => el.classList.toggle("is-active", idx === musicCarouselIndex));
}

function startMusicCarouselTimer() {
  stopMusicCarouselTimer();
  if (musicCarouselItems.length < 2) return;
  musicCarouselTimer = setInterval(() => setMusicCarouselIndex(musicCarouselIndex + 1), 4500);
}
function stopMusicCarouselTimer() {
  if (musicCarouselTimer) { clearInterval(musicCarouselTimer); musicCarouselTimer = null; }
}

function openMusicView() {
  if (!musicView) return;
  if (!musicAllTracks.length) loadMusicCatalog();
  musicView.hidden = false;
  document.body.classList.add("is-music");
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".bottom-bar [data-action='categories']").forEach((b) => b.classList.add("is-active"));
  document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.classList.remove("is-active"));
}

function closeMusicView() {
  if (!musicView) return;
  musicView.hidden = true;
  document.body.classList.remove("is-music");
  stopMusicCarouselTimer();
  closeMusicFullPlayer();
}

// ----- YouTube IFrame Player -----
let ytPlayer = null;
let ytReady = false;
let ytPendingId = null;
let ytProgressTimer = null;

window.onYouTubeIframeAPIReady = function () {
  try {
    ytPlayer = new YT.Player("ytPlayer", {
      height: "100%", width: "100%",
      playerVars: { playsinline: 1, controls: 0, autoplay: 0, modestbranding: 1, rel: 0, iv_load_policy: 3 },
      events: {
        onReady: () => {
          ytReady = true;
          if (ytPendingId) {
            try {
              ytPlayer.loadVideoById(ytPendingId);
              ytPlayer.playVideo?.();
            } catch (_) {}
            ytPendingId = null;
          }
        },
        onStateChange: (e) => {
          if (!window.YT) return;
          const S = YT.PlayerState;
          const state = (e.data === S.PLAYING) ? "pause" : ((e.data === S.PAUSED || e.data === S.ENDED) ? "play" : null);
          if (state) {
            if (miniPlayerToggle) miniPlayerToggle.dataset.state = state;
            if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = state;
          }
        },
        onError: (e) => {
          console.warn("YT player error", e?.data);
          if (musicErrorText) musicErrorText.textContent = "Bu trekni o'ynatib bo'lmadi (embed cheklangan). Boshqasini tanlang.";
        },
      },
    });
  } catch (_) {}
};

function startMiniProgress() {
  if (ytProgressTimer) return;
  ytProgressTimer = setInterval(() => {
    if (!ytReady || !ytPlayer?.getCurrentTime) return;
    try {
      const cur = ytPlayer.getCurrentTime() || 0;
      const dur = ytPlayer.getDuration() || 0;
      if (miniPlayerTime) miniPlayerTime.textContent = formatMusicTime(cur);
      if (miniPlayerBarFill && dur > 0) miniPlayerBarFill.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
      if (musicFullPlayerCur) musicFullPlayerCur.textContent = formatMusicTime(cur);
      if (musicFullPlayerDur && dur > 0) musicFullPlayerDur.textContent = `-${formatMusicTime(Math.max(0, dur - cur))}`;
      if (musicFullPlayerBarFill && dur > 0) musicFullPlayerBarFill.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
    } catch (_) {}
  }, 500);
}

function playMusicTrack(track) {
  if (!track) return;
  musicCurrentTrackKey = trackKey(track);
  if (miniPlayerTitle) miniPlayerTitle.textContent = track.title;
  if (miniPlayerArtistEl) miniPlayerArtistEl.textContent = track.artist;
  if (miniPlayerBarFill) miniPlayerBarFill.style.width = "0%";
  if (miniPlayerTime) miniPlayerTime.textContent = "0:00";
  showMiniPlayer();
  openMusicFullPlayer(track);
  if (ytReady && ytPlayer?.loadVideoById) {
    try {
      ytPlayer.loadVideoById(track.youtubeId);
      if (ytPlayer.playVideo) ytPlayer.playVideo();
    } catch (_) {}
  } else {
    ytPendingId = track.youtubeId;
  }
  startMiniProgress();
  renderMusicList();
}

function showMiniPlayer() {
  if (!miniPlayer) return;
  miniPlayer.removeAttribute("hidden");
  requestAnimationFrame(() => miniPlayer.setAttribute("aria-hidden", "false"));
}

function hideMiniPlayer() {
  if (!miniPlayer) return;
  miniPlayer.setAttribute("aria-hidden", "true");
  try { if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo(); } catch (_) {}
}

musicView?.addEventListener("click", (event) => {
  const catBtn = event.target.closest("[data-music-cat]");
  if (catBtn) {
    musicCategory = catBtn.dataset.musicCat;
    renderMusicFilters();
    renderMusicList();
    return;
  }
  const artBtn = event.target.closest("[data-music-artist]");
  if (artBtn) {
    musicArtist = artBtn.dataset.musicArtist;
    renderMusicFilters();
    renderMusicList();
    return;
  }
  const row = event.target.closest("[data-music-row]");
  if (row) {
    const id = row.dataset.musicRow;
    const track = musicAllTracks.find((t) => t.youtubeId === id);
    if (track) playMusicTrack(track);
  }
});

musicSearchBtn?.addEventListener("click", () => {
  if (!musicSearchBar) return;
  const willOpen = musicSearchBar.hidden;
  musicSearchBar.hidden = !willOpen;
  if (willOpen) musicSearchInput?.focus();
});
musicSearchInput?.addEventListener("input", (e) => {
  clearTimeout(musicSearchDebounce);
  musicSearchDebounce = setTimeout(() => {
    musicQuery = e.target.value.trim();
    renderMusicList();
  }, 200);
});
musicSearchClear?.addEventListener("click", () => {
  if (musicSearchInput) musicSearchInput.value = "";
  musicQuery = "";
  renderMusicList();
});
musicRetryBtn?.addEventListener("click", loadMusicCatalog);

const musicFullPlayer = document.getElementById("musicFullPlayer");
const musicFullPlayerArt = document.getElementById("musicFullPlayerArt");
const musicFullPlayerTitle = document.getElementById("musicFullPlayerTitle");
const musicFullPlayerArtist = document.getElementById("musicFullPlayerArtist");
const musicFullPlayerCur = document.getElementById("musicFullPlayerCur");
const musicFullPlayerDur = document.getElementById("musicFullPlayerDur");
const musicFullPlayerBar = document.getElementById("musicFullPlayerBar");
const musicFullPlayerBarFill = document.getElementById("musicFullPlayerBarFill");
const musicFullPlayerToggle = document.getElementById("musicFullPlayerToggle");

function openMusicFullPlayer(track) {
  if (!musicFullPlayer || !track) return;
  if (musicFullPlayerArt) musicFullPlayerArt.style.backgroundImage = `url('https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg')`;
  if (musicFullPlayerTitle) musicFullPlayerTitle.textContent = track.title;
  if (musicFullPlayerArtist) musicFullPlayerArtist.textContent = track.artist;
  if (musicFullPlayerBarFill) musicFullPlayerBarFill.style.width = "0%";
  if (musicFullPlayerCur) musicFullPlayerCur.textContent = "0:00";
  if (musicFullPlayerDur) musicFullPlayerDur.textContent = "0:00";
  if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
  musicFullPlayer.hidden = false;
  requestAnimationFrame(() => musicFullPlayer.setAttribute("aria-hidden", "false"));
}

function closeMusicFullPlayer() {
  if (!musicFullPlayer) return;
  musicFullPlayer.setAttribute("aria-hidden", "true");
  setTimeout(() => { musicFullPlayer.hidden = true; }, 280);
  try { if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo(); } catch (_) {}
  if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "play";
}

function currentTrackIndex() {
  const list = filteredMusicTracks();
  return list.findIndex((t) => trackKey(t) === musicCurrentTrackKey);
}
function playRelative(offset) {
  const list = filteredMusicTracks();
  if (!list.length) return;
  const cur = currentTrackIndex();
  const next = cur < 0 ? 0 : (cur + offset + list.length) % list.length;
  playMusicTrack(list[next]);
}

musicFullPlayer?.addEventListener("click", (e) => {
  if (e.target.closest("[data-music-fp-close]")) { closeMusicFullPlayer(); return; }
  if (e.target.closest("[data-music-fp-toggle]")) {
    if (!ytReady || !ytPlayer) return;
    try {
      const s = ytPlayer.getPlayerState();
      if (s === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
    } catch (_) {}
    return;
  }
  if (e.target.closest("[data-music-fp-prev]")) { playRelative(-1); return; }
  if (e.target.closest("[data-music-fp-next]")) { playRelative(1); return; }
});

musicFullPlayerBar?.addEventListener("click", (e) => {
  if (!ytReady || !ytPlayer?.getDuration) return;
  try {
    const rect = musicFullPlayerBar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = ytPlayer.getDuration() || 0;
    if (dur > 0) ytPlayer.seekTo(dur * pct, true);
  } catch (_) {}
});

musicCarouselTrack?.addEventListener("click", (e) => {
  const slide = e.target.closest("[data-music-slide]");
  if (!slide) return;
  const id = slide.dataset.musicSlide;
  const track = musicAllTracks.find((t) => t.youtubeId === id);
  if (track) playMusicTrack(track);
});
musicCarouselDots?.addEventListener("click", (e) => {
  const dot = e.target.closest("[data-music-dot]");
  if (!dot) return;
  setMusicCarouselIndex(parseInt(dot.dataset.musicDot, 10) || 0);
  startMusicCarouselTimer();
});

musicView?.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-music-add]");
  if (addBtn) {
    e.stopPropagation();
    toggleMusicPlaylist(addBtn.dataset.musicAdd);
    renderMusicList();
  }
});

miniPlayerToggle?.addEventListener("click", () => {
  if (!ytReady || !ytPlayer) return;
  try {
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  } catch (_) {}
});
miniPlayerClose?.addEventListener("click", hideMiniPlayer);

document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.addEventListener("click", closeMusicView));
document.querySelectorAll(".bottom-bar [data-action='favorites'], .bottom-bar [data-action='catalog'], .bottom-bar [data-action='profile']").forEach((b) => b.addEventListener("click", closeMusicView));

categoryList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  setCategory(button.dataset.category || "all");
});







document.querySelector(".theme-toggle")?.addEventListener("click", toggleTheme);

// Custom dropdown handles language changes via click listeners defined above

searchInput?.addEventListener("input", (event) => {
  query = event.target.value.trim();
  renderMovies();
  if (document.body.classList.contains("is-music")) {
    musicQuery = query;
    if (musicSearchInput) musicSearchInput.value = query;
    renderMusicList();
  }
});

window.addEventListener("resize", syncTopbarSearchLayout);
window.addEventListener("orientationchange", syncTopbarSearchLayout);
syncTopbarSearchLayout();

document.addEventListener("click", (event) => {
  if (searchPanel.hidden || !topbarSearch) return;
  if (topbarSearch.contains(event.target) || event.target.closest("[data-action='search']")) return;
  setSearchPanelOpen(false);
  syncNavButtons();
});

document.querySelectorAll("[data-action='profile']").forEach((button) => {
  button.addEventListener("click", () => {
    renderProfileModal();
    profileModal.showModal();
  });
});

document.querySelectorAll("[data-action='favorites']").forEach((button) => {
  button.addEventListener("click", () => {
    setFilter("favorites");
    setSearchPanelOpen(false);
    if (categoryPanel) categoryPanel.hidden = true;
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
  });
});

attachHeroBindings();

clearHistoryButton?.addEventListener("click", () => {
  clearWatchedHistory();
  syncWatchedCount();
  renderProfileModal();
});

watchedMovieList?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-history-remove]");
  if (!removeButton) return;
  event.stopPropagation();
  removeWatchedMovie(removeButton.dataset.historyRemove || "");
  syncWatchedCount();
  renderProfileModal();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => movieModal.close());
});

movieModal?.addEventListener("close", () => {
  document.body.classList.remove("is-modal-open");
  movieModal.scrollTop = 0;
  movieModal.querySelector(".modal-content")?.scrollTo?.({ top: 0, left: 0 });
});

document.querySelector("[data-close-profile]").addEventListener("click", () => profileModal.close());
videoToggleButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.togglePlay(); setControlsVisible(true); });
videoBackButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.seekBy(-10); setControlsVisible(true); });
videoForwardButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.seekBy(10); setControlsVisible(true); });
videoFullscreenButton.addEventListener("click", (e) => { e.stopPropagation(); toggleVideoFullscreen(); setControlsVisible(true); });
videoSpeedButton?.addEventListener("click", (e) => { e.stopPropagation(); cycleSpeed(); setControlsVisible(true); });
videoLockButton?.addEventListener("click", (e) => { e.stopPropagation(); setPlayerLocked(true); showPlayerToast("Bloklandi"); });
videoLockRelease?.addEventListener("click", (e) => { e.stopPropagation(); setPlayerLocked(false); });
videoAudioButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  setControlsVisible(true);
  const v = getActiveVideoEl();
  const textTracks = v?.textTracks;
  const tracks = textTracks ? Array.from(textTracks) : [];
  if (!tracks.length) {
    showPlayerToast("Audio/subtitle tayyor emas");
    return;
  }
  let activeIdx = tracks.findIndex((tr) => tr.mode === "showing");
  if (activeIdx >= 0) tracks[activeIdx].mode = "disabled";
  const nextIdx = (activeIdx + 1) % (tracks.length + 1);
  if (nextIdx < tracks.length) {
    tracks[nextIdx].mode = "showing";
    showPlayerToast(tracks[nextIdx].label || tracks[nextIdx].language || `Track ${nextIdx + 1}`);
  } else {
    showPlayerToast("Subtitle: o'chirildi");
  }
});
videoBrightness?.addEventListener("input", () => {
  applyBrightness(videoBrightness.value);
  setControlsVisible(true);
});
videoTapZone?.addEventListener("click", (e) => {
  if (isPlayerLocked) return;
  e.stopPropagation();
  const visible = playerOverlay.dataset.visible !== "false";
  setControlsVisible(!visible);
});
videoSeek.addEventListener("input", () => {
  setRangeFill(videoSeek, Number(videoSeek.value || 0), 1000);
  setControlsVisible(true);
  const duration = playerCore.getDuration();
  if (!duration) return;
  isAdjustingSeek = true;
  pendingSeekTime = (Number(videoSeek.value) / 1000) * duration;
  videoCurrentTime.textContent = formatPlaybackTime(pendingSeekTime);
  videoDuration.textContent = formatPlaybackTime(duration);
});
videoSeek.addEventListener("change", () => {
  const duration = playerCore.getDuration();
  if (!duration) { isAdjustingSeek = false; return; }
  pendingSeekTime = (Number(videoSeek.value) / 1000) * duration;
  playerCore.seekTo(pendingSeekTime);
  isAdjustingSeek = false;
  if (activeYouTubePlayer) updateYouTubeControls();
  else updateHtml5VideoControls();
});
document.addEventListener("fullscreenchange", syncFullscreenButton);

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

videoExternalLink?.addEventListener("click", (event) => {
  const href = videoExternalLink.getAttribute("href");
  if (!href) return;
  event.preventDefault();
  openTelegramSource(href);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !videoPlayer.hidden) {
    closeVideoPlayer();
  }
});

async function loadMovies() {
  await resolveApiBase();
  // Wishlist'ni Telegram CloudStorage'dan tiklash — sessiyalar orasida saqlanishi uchun.
  // Bu loadMovies bilan parallel ketishi mumkin; render qilishdan oldin tugashi yetarli.
  const wishlistSyncPromise = syncWishlistFromCloud();
  movieLoadState = "loading";
  movieLoadError = "";
  renderMovies();

  try {
    const response = await fetch(buildApiUrl("/api/movies"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error || "Katalog yuklanmadi.");
    }
    movies = payload.map((movie, index) => normalizeMovie(movie, index));
    movieLoadState = "ready";
    renderHeroCarousel();
  } catch (error) {
    movies = [];
    movieLoadState = "error";
    movieLoadError = t("loadErrorText");
  }

  syncWatchedCount();
  applyCopy();
  renderMovies();

  // Wishlist cloud sync tugagach, agar yangi qiziqlar qo'shilgan bo'lsa
  // — kartochkalardagi yurak ikonkalarini va favorites ro'yxatini yangilab qo'yamiz.
  wishlistSyncPromise.then((didMerge) => {
    if (didMerge) {
      renderMovies();
    }
  }).catch(() => {});

  if (location.hash === "#profile") {
    renderProfileModal();
    profileModal.showModal();
  }
}

// Silent background reload for polling (doesn't show loading state)
async function silentReloadMovies() {
  await resolveApiBase();

  try {
    const response = await fetch(buildApiUrl("/api/movies"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error || "Katalog yuklanmadi.");
    }

    const newMovies = payload.map((movie, index) => normalizeMovie(movie, index));

    movies = newMovies;
    renderHeroCarousel();
    renderMovies();
    syncWatchedCount();
    applyCopy();
  } catch (error) {
    // Background refresh should never disturb the viewing experience.
  }
}

// Keep the catalog fresh without forcing users to reopen the app.
function startMoviesPolling() {
  window.setInterval(() => {
    silentReloadMovies();
  }, 60000);
}

function waitForImageReady(image, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (!image) {
      resolve(false);
      return;
    }

    if (image.complete && image.naturalWidth > 0) {
      resolve(true);
      return;
    }

    let settled = false;
    let timeoutId = 0;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      image.removeEventListener("load", onLoad);
      image.removeEventListener("error", onError);
      resolve(ok);
    };
    const onLoad = () => finish(true);
    const onError = () => finish(false);

    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    timeoutId = window.setTimeout(() => finish(false), timeoutMs);
  });
}

async function loadAppSettings() {
  let timeoutId = 0;
  try {
    await resolveApiBase();
    const controller = new AbortController();
    timeoutId = window.setTimeout(() => controller.abort(), 3500);
    const response = await fetch(buildApiUrl("/api/settings"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.ok) {
      const data = await response.json();
      const splashImageUrl = resolveAppUrl(data.splashImageUrl || "");
      if (splashImageUrl) {
        const splashImg = document.querySelector("#splashScreen img");
        if (splashImg) {
          splashImg.src = splashImageUrl;
          await waitForImageReady(splashImg);
        }
      }
    }
  } catch (e) {
    // Ignore error, use default
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function initSplashScreen() {
  const splashScreen = document.getElementById("splashScreen");
  const appShell = document.getElementById("appShell");
  
  if (splashScreen && appShell) {
    // Splash screen showing for 2.5 seconds
    setTimeout(() => {
      splashScreen.classList.add("fade-out");
      appShell.style.opacity = "1";
      appShell.style.pointerEvents = "auto";
      
      // Remove splash screen from DOM after fade-out (0.5s)
      setTimeout(() => {
        splashScreen.classList.add("hidden");
      }, 500);
    }, 2500);
  }
}

async function initApp() {
  await loadAppSettings();
  initSplashScreen();
  loadMovies();
  startMoviesPolling();
}

initApp();
