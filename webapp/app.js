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
    tvNav: "TV",
    favoritesNav: "Sevimlilar",
    profileNav: "Profil",
    settings: "Sozlamalar",
    nightMode: "Tungi rejim",
    language: "Til",
    comingSoon: "Tez kunda",
    showMore: "Batafsil",
    showLess: "Yopish",
    seeMore: "Yanada ko'proq",
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
    tvNav: "ТВ",
    favoritesNav: "Избранное",
    profileNav: "Профиль",
    settings: "Настройки",
    nightMode: "Тёмный режим",
    language: "Язык",
    comingSoon: "Скоро",
    showMore: "Подробнее",
    showLess: "Свернуть",
    seeMore: "Ещё больше",
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
    tvNav: "TV",
    favoritesNav: "Favorites",
    profileNav: "Profile",
    settings: "Settings",
    nightMode: "Dark mode",
    language: "Language",
    comingSoon: "Coming soon",
    showMore: "Show More",
    showLess: "Show Less",
    seeMore: "See more",
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
const WATCH_PROGRESS_SYNC_ENDPOINT = "/api/watch-progress";
const WATCH_PROGRESS_SYNC_DELAY_MS = 25000;
const TELEGRAM_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";
const DRIVE_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";

let movies = [];

const movieShuffleRanks = new Map();
const categoryShuffleRanks = new Map();
function getRank(map, key) {
  const k = String(key);
  if (!map.has(k)) map.set(k, Math.random());
  return map.get(k);
}
function sessionShuffleMovies(list) {
  return [...list].sort((a, b) => getRank(movieShuffleRanks, a?.id ?? "") - getRank(movieShuffleRanks, b?.id ?? ""));
}
function sessionShuffleCategories(list, keyFn) {
  return [...list].sort((a, b) => getRank(categoryShuffleRanks, keyFn(a)) - getRank(categoryShuffleRanks, keyFn(b)));
}

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
const modalDescriptionToggle = document.querySelector("#modalDescriptionToggle");
const modalDescriptionToggleLabel = modalDescriptionToggle?.querySelector(".modal-description-toggle__label") || null;
const modalDescriptionWrap = document.querySelector("#modalDescriptionWrap");
const modalRating = document.querySelector("#modalRating");
const likeButton = document.querySelector("#likeButton");
const dislikeButton = document.querySelector("#dislikeButton");
const likeCountEl = document.querySelector("#likeCount");
const dislikeCountEl = document.querySelector("#dislikeCount");
const watchButton = document.querySelector("#watchButton");
const movieLaterButton = document.querySelector(".modal-actions .ghost-button");
const profileModal = document.querySelector("#profileModal");
const profileName = document.querySelector("#profileName");
const profileUsername = document.querySelector("#profileUsername");
const profileUserId = document.querySelector("#profileUserId");
const headerAvatar = document.querySelector("#headerAvatar");
const headerAvatarPhoto = document.querySelector("#headerAvatarPhoto");
const topbarAvatarInitials = document.querySelector("#topbarAvatarInitials");
const topbarAvatarPhoto = document.querySelector("#topbarAvatarPhoto");
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
const videoBrightness = null;
const videoBrightnessOverlay = null;
const videoSpeedButton = null;
const videoSpeedLabel = null;
const videoLockButton = null;
const videoLockRelease = null;
const videoVolumeButton = document.querySelector("#videoVolumeButton");
const videoPipButton = document.querySelector("#videoPipButton");
const playerOverlay = document.querySelector("#playerOverlay");
const videoTapZoneLeft = document.querySelector("#videoTapZoneLeft");
const videoTapZoneRight = document.querySelector("#videoTapZoneRight");
const videoSkipFeedbackLeft = document.querySelector("#videoSkipFeedbackLeft");
const videoSkipFeedbackRight = document.querySelector("#videoSkipFeedbackRight");
const videoBuffering = document.querySelector("#videoBuffering");
const videoVolume = document.querySelector("#videoVolume");
const playerToast = document.querySelector("#playerToast");

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
let currentSpeed = 1;
let isPlayerLocked = false;
let controlsHideTimer = null;
let toastHideTimer = null;
let currentVolume = 1;
let lastTapTime = 0;
let lastTapSide = "";
let skipFeedbackTimer = null;
let wakeLockSentinel = null;
let videoErrorRetried = false;

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
    if (profileUserId) {
      profileUserId.textContent = "";
      profileUserId.hidden = true;
    }
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
    if (topbarAvatarInitials) {
      topbarAvatarInitials.textContent = "KI";
      topbarAvatarInitials.hidden = false;
    }
    if (topbarAvatarPhoto) {
      topbarAvatarPhoto.hidden = true;
      topbarAvatarPhoto.removeAttribute("src");
    }
    return;
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const initials = getUserInitials(user);
  profileName.textContent = displayName || t("profile");
  const username = String(user.username || "").trim();
  profileUsername.textContent = username ? `@${username}` : t("noUsername");
  if (profileUserId) {
    if (user.id) {
      profileUserId.textContent = `ID: ${user.id}`;
      profileUserId.hidden = false;
    } else {
      profileUserId.textContent = "";
      profileUserId.hidden = true;
    }
  }
  avatar.textContent = initials;
  if (headerAvatar) {
    headerAvatar.textContent = initials;
    headerAvatar.hidden = false;
  }
  if (topbarAvatarInitials) {
    topbarAvatarInitials.textContent = initials;
    topbarAvatarInitials.hidden = false;
  }
  const profileButtonLabel = displayName ? `${displayName} profili` : "Profil";
  document.querySelectorAll("[data-action='profile']").forEach((button) => setControlLabel(button, profileButtonLabel));
  const candidatePhotos = [];
  if (user.photo_url) candidatePhotos.push(String(user.photo_url));
  if (user.id) candidatePhotos.push(`/api/user-photo?userId=${encodeURIComponent(user.id)}`);
  if (candidatePhotos.length) {
    const applyPhoto = (src) => {
      avatarPhoto.src = src;
      avatarPhoto.hidden = false;
      avatar.hidden = true;
      if (headerAvatarPhoto) {
        headerAvatarPhoto.src = src;
        headerAvatarPhoto.hidden = false;
      }
      if (headerAvatar) headerAvatar.hidden = true;
      if (topbarAvatarPhoto) {
        topbarAvatarPhoto.src = src;
        topbarAvatarPhoto.hidden = false;
      }
      if (topbarAvatarInitials) topbarAvatarInitials.hidden = true;
    };
    const revertToInitials = () => {
      avatarPhoto.hidden = true;
      avatarPhoto.removeAttribute("src");
      avatar.hidden = false;
      if (headerAvatarPhoto) {
        headerAvatarPhoto.hidden = true;
        headerAvatarPhoto.removeAttribute("src");
      }
      if (headerAvatar) headerAvatar.hidden = false;
      if (topbarAvatarPhoto) {
        topbarAvatarPhoto.hidden = true;
        topbarAvatarPhoto.removeAttribute("src");
      }
      if (topbarAvatarInitials) topbarAvatarInitials.hidden = false;
    };
    const tryNext = (index) => {
      if (index >= candidatePhotos.length) {
        revertToInitials();
        return;
      }
      const src = candidatePhotos[index];
      const probe = new Image();
      probe.onload = () => applyPhoto(src);
      probe.onerror = () => tryNext(index + 1);
      probe.src = src;
    };
    tryNext(0);
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
    if (topbarAvatarPhoto) {
      topbarAvatarPhoto.hidden = true;
      topbarAvatarPhoto.removeAttribute("src");
    }
    if (topbarAvatarInitials) {
      topbarAvatarInitials.hidden = false;
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
  const poster = source.replaceAll("'", "%27").replaceAll(")", "%29").replaceAll('"', "%22");
  return `data-poster="${poster}"`;
}

const lazyPosterObserver = (() => {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const url = el.getAttribute("data-poster");
      if (url) {
        el.style.setProperty("--poster-image", `url('${url}')`);
        el.removeAttribute("data-poster");
      }
      io.unobserve(el);
    }
  }, { rootMargin: "300px 0px", threshold: 0.01 });

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.hasAttribute && node.hasAttribute("data-poster")) io.observe(node);
        const inner = node.querySelectorAll ? node.querySelectorAll("[data-poster]") : [];
        for (const child of inner) io.observe(child);
      }
    }
  });
  if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener("DOMContentLoaded", () => mo.observe(document.body, { childList: true, subtree: true }), { once: true });

  return io;
})();



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

function buildDriveStreamUrl(fileId) {
  return buildApiUrl(`/api/drive-stream/${encodeURIComponent(fileId)}`);
}

function buildDriveResolveUrl(fileId) {
  return buildApiUrl(`/api/drive-resolve/${encodeURIComponent(fileId)}`);
}

const driveDirectUrlCache = new Map();
const DRIVE_DIRECT_URL_TTL_MS = 25 * 60 * 1000;

async function resolveDriveDirectVideoUrl(fileId) {
  if (!fileId) return "";
  const cached = driveDirectUrlCache.get(fileId);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    const response = await fetch(buildDriveResolveUrl(fileId), { signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (!response.ok) return "";
    const data = await response.json();
    if (!data?.ok || !data.url) return "";
    driveDirectUrlCache.set(fileId, { url: data.url, expiresAt: Date.now() + DRIVE_DIRECT_URL_TTL_MS });
    return data.url;
  } catch {
    return "";
  }
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
  const title = String(movie?.title || "My Playlist").trim();
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
      <text x="74" y="166" fill="#f8d25c" font-size="28" font-family="Inter, Arial, sans-serif" letter-spacing="2">MY PLAYLIST</text>
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
    cdnUrl: String(movie?.cdnUrl || "").trim(),
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
  }

  if (normalized.videoUrl) normalized.videoUrl = resolveAppUrl(normalized.videoUrl);
  if (normalized.streamUrl) normalized.streamUrl = resolveAppUrl(normalized.streamUrl);
  if (normalized.thumbnail) normalized.thumbnail = resolveAppUrl(normalized.thumbnail);

  return normalized;
}

const pendingProgressSync = { upserts: {}, removeIds: new Set() };
let progressSyncTimer = null;
let progressSyncInFlight = false;
let progressBackendLoaded = false;

function getProgressUserId() {
  try {
    return getReactionUserId();
  } catch {
    return "";
  }
}

function isRealUser(userId) {
  return typeof userId === "string" && userId && !userId.startsWith("anon-");
}

function queueProgressUpsert(movieId, entry) {
  if (!movieId || !entry) return;
  pendingProgressSync.upserts[String(movieId)] = entry;
  pendingProgressSync.removeIds.delete(String(movieId));
  scheduleProgressSync();
}

function queueProgressRemove(movieId) {
  if (!movieId) return;
  const id = String(movieId);
  delete pendingProgressSync.upserts[id];
  pendingProgressSync.removeIds.add(id);
  scheduleProgressSync();
}

function queueProgressClearAll() {
  pendingProgressSync.upserts = {};
  pendingProgressSync.removeIds = new Set();
  pendingProgressSync.clearAll = true;
  scheduleProgressSync(0);
}

function scheduleProgressSync(delay = WATCH_PROGRESS_SYNC_DELAY_MS) {
  const userId = getProgressUserId();
  if (!isRealUser(userId)) return;
  if (progressSyncTimer) {
    clearTimeout(progressSyncTimer);
    progressSyncTimer = null;
  }
  progressSyncTimer = setTimeout(() => {
    progressSyncTimer = null;
    flushProgressSync().catch(() => {});
  }, Math.max(0, Number(delay) || 0));
}

async function flushProgressSync() {
  const userId = getProgressUserId();
  if (!isRealUser(userId)) return;
  if (progressSyncInFlight) return;

  const upserts = pendingProgressSync.upserts;
  const removeIds = Array.from(pendingProgressSync.removeIds);
  const clearAll = pendingProgressSync.clearAll === true;
  if (!clearAll && removeIds.length === 0 && Object.keys(upserts).length === 0) return;

  pendingProgressSync.upserts = {};
  pendingProgressSync.removeIds = new Set();
  pendingProgressSync.clearAll = false;

  progressSyncInFlight = true;
  try {
    await fetch(WATCH_PROGRESS_SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, items: upserts, removeIds, clearAll }),
      keepalive: true,
    });
  } catch {
    pendingProgressSync.upserts = { ...upserts, ...pendingProgressSync.upserts };
    for (const id of removeIds) pendingProgressSync.removeIds.add(id);
    if (clearAll) pendingProgressSync.clearAll = true;
  } finally {
    progressSyncInFlight = false;
  }
}

function flushProgressSyncBeacon() {
  const userId = getProgressUserId();
  if (!isRealUser(userId)) return;
  const upserts = pendingProgressSync.upserts;
  const removeIds = Array.from(pendingProgressSync.removeIds);
  const clearAll = pendingProgressSync.clearAll === true;
  if (!clearAll && removeIds.length === 0 && Object.keys(upserts).length === 0) return;

  const payload = JSON.stringify({ userId, items: upserts, removeIds, clearAll });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon(WATCH_PROGRESS_SYNC_ENDPOINT, blob);
      if (ok) {
        pendingProgressSync.upserts = {};
        pendingProgressSync.removeIds = new Set();
        pendingProgressSync.clearAll = false;
        return;
      }
    }
  } catch {}
  fetch(WATCH_PROGRESS_SYNC_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
  pendingProgressSync.upserts = {};
  pendingProgressSync.removeIds = new Set();
  pendingProgressSync.clearAll = false;
}

async function loadProgressFromBackend() {
  const userId = getProgressUserId();
  if (!isRealUser(userId)) return;
  if (progressBackendLoaded) return;
  let remote = {};
  try {
    const resp = await fetch(`${WATCH_PROGRESS_SYNC_ENDPOINT}?userId=${encodeURIComponent(userId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data?.ok || !data.items || typeof data.items !== "object") return;
    remote = data.items;
  } catch {
    return;
  }

  const localProgress = readWatchProgressStore();
  const localWatched = readWatchedMoviesStore();
  let progressChanged = false;
  let watchedChanged = false;

  for (const [id, rawEntry] of Object.entries(remote)) {
    if (!rawEntry || typeof rawEntry !== "object") continue;
    const remoteUpdated = Number(rawEntry.updatedAt || 0);
    const localEntry = localProgress[id];
    const localUpdated = Number(localEntry?.updatedAt || 0);
    if (remoteUpdated > localUpdated) {
      localProgress[id] = {
        time: Math.max(0, Math.floor(Number(rawEntry.time) || 0)),
        duration: Math.max(0, Math.floor(Number(rawEntry.duration) || 0)),
        updatedAt: remoteUpdated,
        title: String(rawEntry.title || ""),
      };
      progressChanged = true;
    }

    const watchedEntry = localWatched[id];
    if (!watchedEntry) {
      localWatched[id] = {
        id: String(id),
        title: String(rawEntry.title || "Kino"),
        poster: String(rawEntry.poster || ""),
        year: String(rawEntry.year || ""),
        genre: String(rawEntry.genre || "Kino"),
        progress: Math.max(0, Math.floor(Number(rawEntry.time) || 0)),
        watchedAt: remoteUpdated || Date.now(),
      };
      watchedChanged = true;
    } else if (remoteUpdated > Number(watchedEntry.watchedAt || 0)) {
      localWatched[id] = {
        ...watchedEntry,
        progress: Math.max(0, Math.floor(Number(rawEntry.time) || 0)),
        watchedAt: remoteUpdated,
      };
      watchedChanged = true;
    }
  }

  if (progressChanged) writeWatchProgressStore(localProgress);
  if (watchedChanged) {
    writeWatchedMoviesStore(localWatched);
    syncWatchedCount();
    try { renderProfileHistory?.(); } catch {}
  }
  progressBackendLoaded = true;
}

window.addEventListener("pagehide", flushProgressSyncBeacon);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushProgressSyncBeacon();
});

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
  queueProgressRemove(String(movieId));
}

function clearWatchedHistory() {
  localStorage.removeItem(WATCHED_MOVIES_KEY);
  localStorage.removeItem(WATCH_PROGRESS_KEY);
  queueProgressClearAll();
}

// ===== Music listening history (per Telegram user) =====
function musicHistoryKey() {
  const uid = getTelegramUser()?.id;
  return `kino_music_history_v1_${uid || "guest"}`;
}
function readMusicHistoryStore() {
  try {
    const p = JSON.parse(localStorage.getItem(musicHistoryKey()) || "{}");
    return p && typeof p === "object" ? p : {};
  } catch { return {}; }
}
function writeMusicHistoryStore(store) {
  try { localStorage.setItem(musicHistoryKey(), JSON.stringify(store)); } catch {}
}
function recordMusicListen(track) {
  if (!track?.youtubeId) return;
  const store = readMusicHistoryStore();
  store[track.youtubeId] = {
    youtubeId: track.youtubeId,
    title: track.title || "Qo'shiq",
    artist: track.artist || "",
    listenedAt: Date.now(),
  };
  writeMusicHistoryStore(store);
}
function getMusicHistoryEntries() {
  return Object.values(readMusicHistoryStore())
    .filter((e) => e && typeof e === "object" && e.youtubeId)
    .sort((a, b) => Number(b.listenedAt || 0) - Number(a.listenedAt || 0))
    .slice(0, 50);
}
function removeMusicHistoryItem(id) {
  const store = readMusicHistoryStore();
  delete store[id];
  writeMusicHistoryStore(store);
}
function clearMusicHistory() {
  localStorage.removeItem(musicHistoryKey());
}
function renderMusicHistory() {
  const listEl = document.getElementById("musicHistoryList");
  if (!listEl) return;
  const countEl = document.getElementById("musicHistoryCount");
  const emptyEl = document.getElementById("musicHistoryEmpty");
  const clearBtn = document.getElementById("clearMusicHistoryButton");
  const entries = getMusicHistoryEntries();
  if (countEl) countEl.textContent = `${entries.length} ta`;
  if (emptyEl) emptyEl.hidden = entries.length > 0;
  if (clearBtn) clearBtn.hidden = entries.length === 0;
  listEl.innerHTML = entries.map((e) => `
    <article class="profile-history__item" role="button" tabindex="0" data-music-history="${escapeHtml(e.youtubeId)}">
      <div class="profile-history__poster" style="--poster-image: url('https://i.ytimg.com/vi/${escapeHtml(e.youtubeId)}/mqdefault.jpg')"></div>
      <div class="profile-history__copy">
        <strong>${escapeHtml(e.title)}</strong>
        <span>${escapeHtml(e.artist)}</span>
      </div>
      <button class="profile-history__remove" type="button" data-music-history-remove="${escapeHtml(e.youtubeId)}" aria-label="O'chirish" title="O'chirish">
        <svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
      </button>
    </article>
  `).join("");
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
    queueProgressRemove(key);
    return;
  }

  const now = Date.now();
  store[key] = {
    time: safeTime,
    duration: safeDuration,
    updatedAt: now,
    title: movie.title || "",
  };
  writeWatchProgressStore(store);
  updateWatchedMovieProgress(movie, safeTime);
  queueProgressUpsert(key, {
    time: safeTime,
    duration: safeDuration,
    updatedAt: now,
    title: movie.title || "",
    poster: getPosterImage(movie) || "",
    year: movie.year || "",
    genre: movie.genre || "",
  });
}

function clearMovieProgress(movie) {
  if (!movie?.id) return;
  const store = readWatchProgressStore();
  delete store[String(movie.id)];
  writeWatchProgressStore(store);
  updateWatchedMovieProgress(movie, 0);
  queueProgressRemove(String(movie.id));
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

  const entries = [...map.entries()].map(([value, label]) => ({ value, label }));
  const allOption = entries.shift();
  const shuffled = sessionShuffleCategories(entries, (o) => o.value);
  return allOption ? [allOption, ...shuffled] : shuffled;
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

const HOME_ROW_PREVIEW_LIMIT = 5;

function createMoreCard(categoryValue) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "movie-card movie-card--more";
  card.setAttribute("aria-label", plainLabel(t("seeMore")));
  card.innerHTML = `
    <span class="more-card__inner">
      <span class="more-card__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>
      </span>
      <span class="more-card__label">${escapeHtml(plainLabel(t("seeMore")))}</span>
    </span>
  `;
  card.addEventListener("click", () => {
    setCategory(categoryValue);
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
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
  return sessionShuffleCategories([...groups.values()], (g) => g.value);
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
    const shownMovies = group.movies.slice(0, HOME_ROW_PREVIEW_LIMIT);
    for (const movie of shownMovies) {
      list.append(createMovieCard(movie));
    }
    if (group.movies.length > HOME_ROW_PREVIEW_LIMIT) {
      list.append(createMoreCard(group.value));
    }
    section.querySelector(".category-row__more").addEventListener("click", () => {
      setCategory(group.value);
      document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    });
    grid.append(section);
  }
  return groups.length;
}

function getCategoryLabel(value) {
  if (!value || value === "all") return "";
  for (const movie of getViewerMovies()) {
    for (const rawGenre of splitMovieGenres(movie?.genre)) {
      if (normalizeCategoryValue(rawGenre) === value) return rawGenre;
    }
  }
  return value;
}

function renderCategoryPageHeader() {
  const header = document.createElement("header");
  header.className = "category-page__head";
  header.innerHTML = `
    <button class="category-page__back" type="button" aria-label="Orqaga">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="15 6 9 12 15 18"></polyline>
      </svg>
    </button>
    <h2 class="category-page__title"></h2>
  `;
  header.querySelector(".category-page__title").textContent = getCategoryLabel(activeCategory);
  header.querySelector(".category-page__back").addEventListener("click", () => {
    setCategory("all");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
  });
  return header;
}

function renderFavoritesPageHeader() {
  const header = document.createElement("header");
  header.className = "category-page__head";
  header.innerHTML = `
    <button class="category-page__back" type="button" aria-label="Orqaga">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <polyline points="15 6 9 12 15 18"></polyline>
      </svg>
    </button>
    <h2 class="category-page__title"></h2>
  `;
  header.querySelector(".category-page__title").textContent = plainLabel(t("favoritesNav"));
  header.querySelector(".category-page__back").addEventListener("click", () => {
    setFilter("all");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
  });
  return header;
}

function renderMovies() {
  const isHomeView = activeFilter === "all" && activeCategory === "all" && !query;
  const isCategoryPage = activeFilter === "all" && activeCategory !== "all" && !query;
  const isFavoritesPage = activeFilter === "favorites" && !query;
  grid.innerHTML = "";
  grid.classList.toggle("is-category-page", isCategoryPage || isFavoritesPage);

  if (isHomeView && movieLoadState === "ready") {
    grid.classList.add("is-home");
    const rowCount = renderHomeRows();
    updateEmptyState(rowCount > 0 ? getViewerMovies() : []);
  } else {
    grid.classList.remove("is-home");
    if (isCategoryPage && movieLoadState === "ready") {
      grid.append(renderCategoryPageHeader());
    } else if (isFavoritesPage && movieLoadState === "ready") {
      grid.append(renderFavoritesPageHeader());
    }
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
        openVideoPlayer(movie);
      };
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-history-remove]")) return;
        reopenMovie();
      });
      card.addEventListener("keydown", (event) => {
        if (event.target.closest("[data-history-remove]")) return;
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
  renderMusicHistory();
}

const REACTION_STORAGE_KEY = "mykino:reactions";
const REACTION_CLIENT_ID_KEY = "mykino:clientId";

function getReactionUserId() {
  const tgId = getTelegramUser()?.id;
  if (tgId) return String(tgId);
  try {
    let id = localStorage.getItem(REACTION_CLIENT_ID_KEY);
    if (!id) {
      const rand = (crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
      id = `anon-${rand}`;
      localStorage.setItem(REACTION_CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

function readUserReactions() {
  try {
    return JSON.parse(localStorage.getItem(REACTION_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeUserReaction(movieId, reaction) {
  const map = readUserReactions();
  if (reaction) map[movieId] = reaction;
  else delete map[movieId];
  try { localStorage.setItem(REACTION_STORAGE_KEY, JSON.stringify(map)); } catch {}
}

function renderReactions(movie) {
  if (!likeCountEl || !dislikeCountEl) return;
  const likes = Number(movie.likes || 0) || 0;
  const dislikes = Number(movie.dislikes || 0) || 0;
  likeCountEl.textContent = likes;
  dislikeCountEl.textContent = dislikes;
  const reactions = readUserReactions();
  const current = reactions[movie.id];
  likeButton?.classList.toggle("is-active", current === "like");
  dislikeButton?.classList.toggle("is-active", current === "dislike");
}

async function refreshReactionCounts(movie) {
  try {
    const userId = getReactionUserId();
    const url = `/api/movie-reaction?id=${encodeURIComponent(movie.id)}${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data || data.ok === false) return;
    movie.likes = Number(data.likes || 0) || 0;
    movie.dislikes = Number(data.dislikes || 0) || 0;
    if (data.userReaction === "like" || data.userReaction === "dislike") {
      writeUserReaction(movie.id, data.userReaction);
    } else if (data.userReaction === null) {
      writeUserReaction(movie.id, null);
    }
    if (activeMovie && activeMovie.id === movie.id) renderReactions(movie);
  } catch {}
}

async function sendReaction(movie, reaction) {
  const userId = getReactionUserId();
  const reactions = readUserReactions();
  const prev = reactions[movie.id] || null;
  const next = prev === reaction ? null : reaction;
  writeUserReaction(movie.id, next);
  renderReactions({ ...movie,
    likes: (movie.likes || 0) + (next === "like" ? 1 : 0) - (prev === "like" ? 1 : 0),
    dislikes: (movie.dislikes || 0) + (next === "dislike" ? 1 : 0) - (prev === "dislike" ? 1 : 0),
  });
  try {
    const res = await fetch("/api/movie-reaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: movie.id, userId, reaction: next }),
    });
    const data = await res.json().catch(() => null);
    if (data && data.ok !== false) {
      movie.likes = Number(data.likes || 0) || 0;
      movie.dislikes = Number(data.dislikes || 0) || 0;
      renderReactions(movie);
    }
  } catch {}
}

function setDescriptionExpanded(expanded) {
  if (!modalDescriptionWrap || !modalDescriptionToggle) return;
  modalDescriptionWrap.hidden = !expanded;
  modalDescriptionToggle.classList.toggle("is-expanded", expanded);
  modalDescriptionToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (modalDescriptionToggleLabel) {
    modalDescriptionToggleLabel.textContent = plainLabel(t(expanded ? "showLess" : "showMore"));
  }
}

function syncDescriptionToggle() {
  if (!modalDescription || !modalDescriptionToggle) return;
  const hasText = Boolean(String(modalDescription.textContent || "").trim());
  modalDescriptionToggle.hidden = !hasText;
  setDescriptionExpanded(false);
}

let preloadVideoEl = null;
let preloadVideoUrl = "";
function hideCodecError() {}

function stopMoviePreload() {
  if (!preloadVideoEl) return;
  try {
    preloadVideoEl.removeAttribute("src");
    preloadVideoEl.load();
  } catch (_) {}
  preloadVideoEl.remove();
  preloadVideoEl = null;
  preloadVideoUrl = "";
}

function startMoviePreload(movie) {
  if (!movie) return;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn?.saveData) return;
  if (conn?.effectiveType && /^(slow-2g|2g)$/.test(conn.effectiveType)) return;
  if (getYouTubeVideoUrl(movie)) return;
  if (isMobileViewingContext() && !isLaunchReadyMovie(movie)) return;

  const cdnUrl = String(movie?.cdnUrl || "").trim();
  const driveFileId = String(movie?.driveFileId || movie?.fileId || "").trim();
  if (!cdnUrl && !driveFileId) return;
  const urlPromise = cdnUrl
    ? Promise.resolve(cdnUrl)
    : resolveDriveDirectVideoUrl(driveFileId).then((u) => u || buildDriveStreamUrl(driveFileId));
  urlPromise.then((url) => {
    if (preloadVideoEl && preloadVideoUrl === url) return;
    stopMoviePreload();
    const el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.playsInline = true;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:-9999px";
    el.src = url;
    document.body.appendChild(el);
    preloadVideoEl = el;
    preloadVideoUrl = url;
  });
}

function openMovie(movie) {
  const posterImage = getPosterImage(movie);
  modalPoster.style.backgroundImage = posterImage
    ? `url('${posterImage.replaceAll("'", "%27")}'), linear-gradient(135deg, #253142, #10161f 58%, #2b1b1d)`
    : "linear-gradient(135deg, #253142, #10161f 58%, #2b1b1d)";
  const genreText = String(movie.genre || "").trim();
  const qualityText = String(movie.quality || "").trim();
  const metaItems = [genreText, qualityText].filter(Boolean).map((v) => `<span>${escapeHtml(v)}</span>`);
  modalMeta.innerHTML = metaItems.join('<span class="modal-meta__sep" aria-hidden="true">|</span>');
  const ratingValue = Number(movie.rating);
  const stars = Number.isFinite(ratingValue) && ratingValue > 0 ? Math.round(ratingValue / 2) : 0;
  if (modalRating) {
    const filled = Math.max(0, Math.min(5, stars));
    let html = "";
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="modal-rating__star${i < filled ? " is-filled" : ""}">&#9733;</span>`;
    }
    modalRating.innerHTML = html;
    modalRating.hidden = filled === 0;
  }
  modalTitle.textContent = movie.title;
  modalDescription.textContent = movie.description;
  watchButton.dataset.movieId = movie.id;
  activeMovie = movie;
  renderReactions(movie);
  syncDescriptionToggle();
  movieModal.showModal();
  movieModal.scrollTop = 0;
  movieModal.querySelector(".modal-content")?.scrollTo?.({ top: 0, left: 0 });
  document.body.classList.add("is-modal-open");
  if (!history.state || !history.state.movieDetail) {
    history.pushState({ movieDetail: true }, "");
  }
  refreshReactionCounts(movie);
  startMoviePreload(movie);
}

function setVideoLoading(isLoading) {
  if (videoLoading) videoLoading.hidden = !isLoading;
}

function setFallbackMessage() {
  videoFallback.hidden = true;
  if (videoFallbackText) {
    videoFallbackText.textContent = "";
    videoFallbackText.hidden = true;
  }
  videoExternalLink.hidden = true;
  videoExternalLink.removeAttribute("href");
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

function showSkipFeedback(side) {
  const el = side === "left" ? videoSkipFeedbackLeft : videoSkipFeedbackRight;
  if (!el) return;
  el.classList.add("is-active");
  if (skipFeedbackTimer) window.clearTimeout(skipFeedbackTimer);
  skipFeedbackTimer = window.setTimeout(() => {
    videoSkipFeedbackLeft?.classList.remove("is-active");
    videoSkipFeedbackRight?.classList.remove("is-active");
  }, 500);
}

function handleTapZone(side, event) {
  if (isPlayerLocked) return;
  event.stopPropagation();
  const now = Date.now();
  const isDoubleTap = now - lastTapTime < 320 && lastTapSide === side;
  lastTapTime = now;
  lastTapSide = side;
  if (isDoubleTap) {
    playerCore.seekBy(side === "left" ? -15 : 15);
    showSkipFeedback(side);
    setControlsVisible(true);
    return;
  }
  const visible = playerOverlay.dataset.visible !== "false";
  setControlsVisible(!visible);
}

function showBuffering(show) {
  if (!videoBuffering) return;
  videoBuffering.hidden = !show;
}

function setVolume(value) {
  const v = getActiveVideoEl();
  const normalized = Math.max(0, Math.min(1, Number(value) / 100));
  currentVolume = normalized;
  if (v) {
    v.volume = normalized;
    v.muted = normalized === 0;
  }
  if (activeYouTubePlayer) {
    activeYouTubePlayer.setVolume(Math.round(normalized * 100));
    if (normalized === 0) activeYouTubePlayer.mute();
    else activeYouTubePlayer.unMute();
  }
  if (videoVolume) {
    setRangeFill(videoVolume, Math.round(normalized * 100), 100);
  }
  updateVolumeButtonState();
}

function updateVolumeButtonState() {
  if (!videoVolumeButton) return;
  const isMuted = currentVolume === 0;
  videoVolumeButton.dataset.state = isMuted ? "off" : "on";
  videoVolumeButton.setAttribute("aria-label", isMuted ? "Ovozni yoqish" : "Ovozni o'chirish");
}

let lastNonZeroVolume = 1;
function toggleMute() {
  if (currentVolume > 0) {
    lastNonZeroVolume = currentVolume;
    setVolume(0);
    if (videoVolume) videoVolume.value = "0";
  } else {
    const restore = Math.round((lastNonZeroVolume || 1) * 100);
    setVolume(restore);
    if (videoVolume) videoVolume.value = String(restore);
  }
  if (videoVolume) setRangeFill(videoVolume, Number(videoVolume.value || 0), 100);
}

/* ====== Picture-in-Picture ====== */
function isPipSupported() {
  if (document.pictureInPictureEnabled) return true;
  const probe = document.createElement("video");
  if (typeof probe.webkitSupportsPresentationMode === "function" && probe.webkitSupportsPresentationMode("picture-in-picture")) return true;
  return false;
}

function setupPipButton() {
  if (!videoPipButton) return;
  if (!isPipSupported()) {
    videoPipButton.hidden = true;
    return;
  }
  videoPipButton.hidden = false;
}

async function togglePip() {
  const v = getActiveVideoEl();
  if (!v) return;
  try {
    if (document.pictureInPictureElement === v) {
      await document.exitPictureInPicture();
      return;
    }
    if (document.pictureInPictureEnabled && typeof v.requestPictureInPicture === "function") {
      await v.requestPictureInPicture();
      return;
    }
    if (typeof v.webkitSupportsPresentationMode === "function" && v.webkitSupportsPresentationMode("picture-in-picture")) {
      const mode = v.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
      v.webkitSetPresentationMode(mode);
    }
  } catch (err) {
    console.warn("PiP failed:", err);
  }
}

function exitPipIfActive() {
  try {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    const v = getActiveVideoEl();
    if (v && typeof v.webkitSetPresentationMode === "function" && v.webkitPresentationMode === "picture-in-picture") {
      v.webkitSetPresentationMode("inline");
    }
  } catch {}
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
  } catch {}
}

function releaseWakeLock() {
  if (wakeLockSentinel) {
    wakeLockSentinel.release?.().catch(() => {});
    wakeLockSentinel = null;
  }
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

function getFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.webkitCurrentFullScreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
    || null;
}

function exitDocFullscreen() {
  const fn = document.exitFullscreen
    || document.webkitExitFullscreen
    || document.webkitCancelFullScreen
    || document.mozCancelFullScreen
    || document.msExitFullscreen;
  if (fn) {
    try { Promise.resolve(fn.call(document)).catch(() => {}); } catch {}
  }
}

function requestElFullscreen(el) {
  if (!el) return false;
  const fn = el.requestFullscreen
    || el.webkitRequestFullscreen
    || el.webkitRequestFullScreen
    || el.mozRequestFullScreen
    || el.msRequestFullscreen;
  if (!fn) return false;
  try {
    Promise.resolve(fn.call(el)).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

function lockLandscapeOrientation() {
  try {
    const orient = screen.orientation;
    if (orient && typeof orient.lock === "function") {
      orient.lock("landscape").catch(() => {});
    }
  } catch {}
}

function unlockOrientation() {
  try { screen.orientation?.unlock?.(); } catch {}
}

function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

function isTelegramFullscreen() {
  const tg = getTelegramWebApp();
  return Boolean(tg && tg.isFullscreen);
}

let intendedFullscreen = false;

function isPortraitOrientation() {
  return window.matchMedia("(orientation: portrait)").matches;
}

const FL_INLINE_PROPS = ["position", "top", "left", "right", "bottom", "width", "height", "transform", "transformOrigin", "inset", "zIndex", "margin", "maxWidth", "maxHeight", "background"];

function getAccurateViewport() {
  // window.innerWidth/Height = current visible WebView area (most accurate during fullscreen transition)
  const tg = getTelegramWebApp();
  const innerW = window.innerWidth || document.documentElement.clientWidth || 0;
  const innerH = window.innerHeight || document.documentElement.clientHeight || 0;
  const tgH = Number(tg?.viewportHeight || 0);
  // Use the LARGER value between innerH and tg.viewportHeight (avoids stale viewportStableHeight)
  const w = Math.max(innerW, screen.availWidth || 0, screen.width || 0) || 393;
  const h = Math.max(innerH, tgH, screen.availHeight || 0, screen.height || 0) || 800;
  return { w, h };
}

function clearInlineLandscape() {
  FL_INLINE_PROPS.forEach((p) => {
    const kebab = p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    videoPlayer.style.removeProperty(kebab);
  });
}

function applyForceLandscape(enable) {
  if (!enable) {
    videoPlayer.classList.remove("is-force-landscape");
    clearInlineLandscape();
    document.body.classList.remove("is-fake-fullscreen");
    return;
  }
  const { w, h } = getAccurateViewport();
  // Viewport is portrait (w < h). We want to display landscape video inside it via 90° rotation.
  // Pre-rotation: arrange content in LANDSCAPE (width=longSide, height=shortSide).
  // After rotate(90deg) around center: element rotates to portrait visual orientation,
  // which exactly fills the portrait viewport.
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  Object.assign(videoPlayer.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    right: "auto",
    bottom: "auto",
    width: `${longSide}px`,
    height: `${shortSide}px`,
    transform: "translate(-50%, -50%) rotate(90deg)",
    transformOrigin: "center center",
    inset: "auto",
    zIndex: "99999",
    margin: "0",
    maxWidth: "none",
    maxHeight: "none",
    background: "#000",
  });
  videoPlayer.classList.add("is-force-landscape");
  document.body.classList.add("is-fake-fullscreen");
}

function refreshLandscapeView() {
  if (!intendedFullscreen) {
    applyForceLandscape(false);
    return;
  }
  applyForceLandscape(isPortraitOrientation());
}

function isAnyFullscreen() {
  return Boolean(getFullscreenElement()) || isTelegramFullscreen() || isIOSVideoFullscreen() || intendedFullscreen;
}

async function tryLockLandscape() {
  try {
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      await screen.orientation.lock("landscape");
      return true;
    }
  } catch {}
  return false;
}

function isIOSDevice() {
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPad on iOS 13+ identifies as Mac with touch
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

function isIOSVideoFullscreen() {
  const v = getActiveVideoEl();
  return Boolean(v && v.webkitDisplayingFullscreen);
}

async function enterFullscreenAndLandscape() {
  intendedFullscreen = true;
  const v = getActiveVideoEl();

  // 1. iOS — native video fullscreen. Auto-rotates to landscape, fills entire device screen,
  //    works inside Telegram WebApp WebView. Shows iOS native controls in fullscreen.
  if (isIOSDevice() && v && typeof v.webkitEnterFullscreen === "function") {
    try {
      v.controls = true;
      const onEnd = () => {
        v.controls = false;
        intendedFullscreen = false;
        syncFullscreenButton();
        v.removeEventListener("webkitendfullscreen", onEnd);
      };
      v.addEventListener("webkitendfullscreen", onEnd);
      v.webkitEnterFullscreen();
      syncFullscreenButton();
      return;
    } catch (err) {
      console.warn("iOS native fullscreen failed:", err);
      v.controls = false;
    }
  }

  const tg = getTelegramWebApp();

  // 2. Telegram WebApp expand + fullscreen (Bot API 8.0+) — Android Telegram
  try { tg?.expand?.(); } catch {}
  if (tg && typeof tg.requestFullscreen === "function" && !tg.isFullscreen) {
    try { tg.requestFullscreen(); } catch {}
  }

  // 3. Standard browser fullscreen (desktop, Android Chrome)
  requestElFullscreen(videoPlayer);

  // 4. Android orientation lock — physically rotates device to landscape
  await tryLockLandscape();

  syncFullscreenButton();
}

function exitFullscreenAndLandscape() {
  intendedFullscreen = false;

  // iOS native video fullscreen
  const v = getActiveVideoEl();
  if (v && v.webkitDisplayingFullscreen && typeof v.webkitExitFullscreen === "function") {
    try { v.webkitExitFullscreen(); } catch {}
    v.controls = false;
  }

  const tg = getTelegramWebApp();
  if (tg && tg.isFullscreen && typeof tg.exitFullscreen === "function") {
    try { tg.exitFullscreen(); } catch {}
  }
  if (getFullscreenElement()) {
    exitDocFullscreen();
  }
  unlockOrientation();
  applyForceLandscape(false);
  syncFullscreenButton();
}

function toggleVideoFullscreen() {
  if (isAnyFullscreen()) {
    exitFullscreenAndLandscape();
  } else {
    enterFullscreenAndLandscape();
  }
}

function syncFullscreenButton() {
  const isFullscreen = isAnyFullscreen();
  setStateLabel(videoFullscreenButton, isFullscreen ? "exit" : "enter", plainLabel(isFullscreen ? t("exitFull") : t("full")));
  videoPlayer.classList.toggle("is-tg-fullscreen", isTelegramFullscreen());
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
  video.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback noplaybackrate");
  video.playsInline = true;
  video.preload = preload;
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.addEventListener("timeupdate", updateHtml5VideoControls);
  video.addEventListener("play", () => { setStateLabel(videoToggleButton, "pause", plainLabel(t("pause"))); scheduleControlsHide(); requestWakeLock(); });
  video.addEventListener("pause", () => { setStateLabel(videoToggleButton, "play", plainLabel(t("play"))); setControlsVisible(true); releaseWakeLock(); });
  video.addEventListener("ended", () => { setStateLabel(videoToggleButton, "play", plainLabel(t("play"))); setControlsVisible(true); releaseWakeLock(); });
  video.addEventListener("loadedmetadata", () => {
    video.playbackRate = currentSpeed;
    video.volume = currentVolume;
    if (pendingResumeTime >= WATCH_PROGRESS_MIN_SECONDS && pendingResumeTime < (video.duration || Infinity) - 5) {
      try { video.currentTime = pendingResumeTime; } catch {}
      pendingResumeTime = 0;
    }
    updateHtml5VideoControls();
    scheduleCodecCheck(video, movie, 3000);
  });
  video.addEventListener("resize", () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) hideCodecError();
  });
  video.addEventListener("timeupdate", () => {
    if (video.currentTime > 1.5 && video.videoWidth === 0 && video.videoHeight === 0 && !video.paused) {
      showCodecError(movie);
    }
  });
  video.addEventListener("ratechange", () => {
    if (Math.abs(video.playbackRate - currentSpeed) > 0.001 && SPEED_OPTIONS.includes(video.playbackRate)) {
      currentSpeed = video.playbackRate;
      updateSpeedLabel();
    }
  });
  video.addEventListener("waiting", () => showBuffering(true));
  video.addEventListener("stalled", () => showBuffering(true));
  video.addEventListener("canplay", () => showBuffering(false));
  video.addEventListener("playing", () => showBuffering(false));
  video.addEventListener("error", () => {
    if (videoErrorRetried) return;
    videoErrorRetried = true;
    try { video.load(); video.play().catch(() => {}); } catch {}
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
  hideCodecError();
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
  stopMoviePreload();
  hideCodecError();
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
  videoErrorRetried = false;
  if (videoVolume) { videoVolume.value = "100"; setVolume(100); }
  updateVolumeButtonState();
  setupPipButton();
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

  const cdnUrl = String(movie?.cdnUrl || "").trim();
  const driveFileId = String(movie?.driveFileId || movie?.fileId || "").trim();
  if (cdnUrl || driveFileId) {
    let playbackUrl = cdnUrl;
    if (!playbackUrl && driveFileId) {
      const directUrl = await resolveDriveDirectVideoUrl(driveFileId);
      playbackUrl = directUrl || buildDriveStreamUrl(driveFileId);
    }
    if (requestId !== activeVideoRequest) return;
    renderVideoSource(playbackUrl, movie, {
      forceVideo: true,
      originalUrl: "",
      requestId,
      fallbackMessage: DRIVE_STREAM_ERROR_MESSAGE,
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
  if (skipFeedbackTimer) { window.clearTimeout(skipFeedbackTimer); skipFeedbackTimer = null; }
  videoSkipFeedbackLeft?.classList.remove("is-active");
  videoSkipFeedbackRight?.classList.remove("is-active");
  showBuffering(false);
  releaseWakeLock();
  setPlayerLocked(false);
  if (playerToast) playerToast.hidden = true;
  if (document.pictureInPictureElement) document.exitPictureInPicture?.().catch(() => {});
  if (getFullscreenElement()) exitDocFullscreen();
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
  if (videoPipButton) videoPipButton.classList.remove("is-active");
  exitPipIfActive();
  if (isAnyFullscreen()) exitFullscreenAndLandscape();
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
  const currentTheme =
    document.documentElement.getAttribute("data-theme") ||
    themeToggle?.dataset.theme ||
    "light";
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
  if (modalDescriptionToggleLabel) {
    const expanded = modalDescriptionToggle?.classList.contains("is-expanded");
    modalDescriptionToggleLabel.textContent = plainLabel(t(expanded ? "showLess" : "showMore"));
  }
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

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = plainLabel(t(key));
  });

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

document.querySelectorAll("[data-action='artists']").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openMusicView();
    openAllArtists();
  });
});

document.querySelectorAll("[data-action='categories']").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (button.closest(".bottom-bar")) {
      event.preventDefault();
      // Musiqa tugmasi — har doim musiqa bosh sahifasiga qaytaradi
      closeArtistDetail();
      closeAllSongs();
      closeAllArtists();
      openMusicView();
      scrollMusicTop();
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

function ensureMusicSplash() {
  let el = document.getElementById("musicSplash");
  if (el) return el;
  el = document.createElement("div");
  el.id = "musicSplash";
  el.className = "music-splash";
  el.hidden = true;
  el.innerHTML = `
    <div class="music-splash__spinner" aria-hidden="true"></div>
    <div class="music-splash__brand">
      <span class="music-splash__logo" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14.4" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
          <path d="M13 11.4 22.2 16 13 20.6Z" fill="currentColor"></path>
        </svg>
      </span>
      <span class="music-splash__name">
        <b>MY</b><span>PLAYLIST</span>
      </span>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}
function showMusicSplash() { ensureMusicSplash().hidden = false; }
function hideMusicSplash() {
  const el = document.getElementById("musicSplash");
  if (el) el.hidden = true;
}

async function loadMusicCatalog() {
  showMusicSplash();
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
    hideMusicSplash();
    return;
  }
  const local = readLocalMusic();
  musicAllTracks = dedupeTracks([...seed, ...local]);
  renderMusicCarousel();
  renderMusicFilters();
  renderMusicList();
  hideMusicSplash();
}

function uniqSorted(values) {
  const set = new Set(values.filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function splitArtists(name) {
  if (!name) return [];
  return String(name)
    .split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\band\b|x|×)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function trackHasArtist(track, artist) {
  if (!track || !artist) return false;
  const list = splitArtists(track.artist);
  const target = artist.toLowerCase();
  return list.some((a) => a.toLowerCase() === target);
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

let musicArtistsData = [];
function findArtistImage(name) {
  const t = String(name || "").toLowerCase();
  const rec = musicArtistsData.find((a) => String(a.name || "").toLowerCase() === t);
  return rec?.image || "";
}
function musicArtistCardHtml(name, value = name, label = name) {
  const active = musicArtist === value;
  const img = findArtistImage(name);
  if (img) {
    return `<button class="music-artist-card ${active ? "is-active" : ""}" type="button" data-music-artist="${escapeMusicHtml(value)}" style="background-image:url('${img.replaceAll("'", "%27")}')">
      <span class="music-artist-card__shade"></span>
      <span class="music-artist-card__label">${escapeMusicHtml(label)}</span>
    </button>`;
  }
  return musicChipHtml({ active, dataAttr: "data-music-artist", value, label, icon: MUSIC_ARTIST_ICON });
}

async function fetchMusicArtists() {
  try {
    const res = await fetch("/api/music?resource=artists", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    musicArtistsData = Array.isArray(json.artists) ? json.artists : [];
  } catch (_) {}
}

function trackCategories(t) {
  if (Array.isArray(t.categories) && t.categories.length) return t.categories;
  if (t.category) return [t.category];
  return [];
}

function renderMusicFilters() {
  if (musicCategoryRow) {
    const cats = uniqSorted(musicAllTracks.flatMap(trackCategories));
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
    const eligible = eligibleArtistNames().sort((x, y) => x.localeCompare(y));
    const items = [
      musicArtistCardHtml("Hammasi", "all", "Hammasi"),
    ].concat(eligible.map((a) => musicArtistCardHtml(a)));
    musicArtistRow.innerHTML = items.join("");
  }
}

function filteredMusicTracks() {
  const q = musicQuery.toLowerCase();
  return musicAllTracks.filter((t) => {
    if (musicCategory !== "all" && !trackCategories(t).some((c) => c === musicCategory)) return false;
    if (musicArtist !== "all" && !trackHasArtist(t, musicArtist)) return false;
    if (q && !(t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))) return false;
    return true;
  });
}

const MUSIC_PAGE_SIZE = 20;

function musicRowHtml(t, playlist) {
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
}

function renderMusicList() {
  if (!musicListEl) return;
  const list = filteredMusicTracks();
  if (!list.length) { showMusicState("empty"); return; }
  showMusicState("data");
  const playlist = readMusicPlaylist();
  const shown = list.slice(0, MUSIC_PAGE_SIZE);
  musicListEl.innerHTML = shown.map((t) => musicRowHtml(t, playlist)).join("");
  if (list.length > MUSIC_PAGE_SIZE) {
    musicListEl.insertAdjacentHTML("beforeend", `
      <li class="music-more">
        <button class="music-more__btn" type="button" data-music-more>Ko'proq ko'rish (${list.length - MUSIC_PAGE_SIZE})</button>
      </li>`);
  }
}

// ----- Hamma musiqalar (all songs page) -----
function ensureAllSongsDom() {
  if (!musicView) return null;
  let panel = document.getElementById("musicAllSongs");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "musicAllSongs";
  panel.className = "music-allsongs";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="music-artist-detail__head">
      <button class="music-artist-detail__back" type="button" data-allsongs-back aria-label="Orqaga">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
      </button>
      <h1 class="music-artist-detail__name">Hamma musiqalar</h1>
    </header>
    <div class="music-filters">
      <div class="music-filter-label">Kategoriya</div>
      <div class="music-card-row" id="allSongsCategoryRow"></div>
    </div>
    <ol class="music-list" id="allSongsList"></ol>
    <div class="music-view__spacer"></div>
  `;
  musicView.appendChild(panel);
  panel.addEventListener("click", (event) => {
    if (event.target.closest("[data-allsongs-back]")) { closeAllSongs(); return; }
    const catBtn = event.target.closest("[data-music-cat]");
    if (catBtn) {
      musicCategory = catBtn.dataset.musicCat;
      renderAllSongs();
      return;
    }
    const addBtn = event.target.closest("[data-music-add]");
    if (addBtn) {
      toggleMusicPlaylist(addBtn.dataset.musicAdd);
      renderAllSongs();
      return;
    }
    const row = event.target.closest("[data-music-row]");
    if (row) {
      const track = musicAllTracks.find((t) => t.youtubeId === row.dataset.musicRow);
      if (track) playMusicTrack(track);
    }
  });
  return panel;
}

function renderAllSongs() {
  ensureAllSongsDom();
  const catRow = document.getElementById("allSongsCategoryRow");
  if (catRow) {
    const cats = uniqSorted(musicAllTracks.flatMap(trackCategories));
    catRow.innerHTML = [
      musicChipHtml({ active: musicCategory === "all", dataAttr: "data-music-cat", value: "all", label: "Hammasi", icon: musicCategoryIcon("all") }),
    ].concat(cats.map((c) => musicChipHtml({
      active: musicCategory === c, dataAttr: "data-music-cat", value: c, label: c, icon: musicCategoryIcon(c),
    }))).join("");
  }
  const listEl = document.getElementById("allSongsList");
  if (listEl) {
    const playlist = readMusicPlaylist();
    const list = filteredMusicTracks();
    listEl.innerHTML = list.length
      ? list.map((t) => musicRowHtml(t, playlist)).join("")
      : `<li class="music-state music-state--empty"><span>Hech narsa topilmadi</span></li>`;
  }
}

function scrollMusicTop() {
  try { document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
  try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
}

function openAllSongs() {
  const panel = ensureAllSongsDom();
  if (!panel) return;
  renderAllSongs();
  document.body.classList.add("is-music-all-songs");
  panel.hidden = false;
  scrollMusicTop();
}

function closeAllSongs() {
  const panel = document.getElementById("musicAllSongs");
  if (panel) panel.hidden = true;
  document.body.classList.remove("is-music-all-songs");
}

// ----- Barcha qo'shiqchilar (all artists page) -----
function ensureAllArtistsDom() {
  if (!musicView) return null;
  let panel = document.getElementById("musicAllArtists");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "musicAllArtists";
  panel.className = "music-allartists";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="music-artist-detail__head">
      <button class="music-artist-detail__back" type="button" data-allartists-back aria-label="Orqaga">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
      </button>
      <h1 class="music-artist-detail__name">Barcha qo'shiqchilar</h1>
    </header>
    <div class="music-allartists__grid" id="allArtistsGrid"></div>
    <div class="music-view__spacer"></div>
  `;
  musicView.appendChild(panel);
  panel.addEventListener("click", (event) => {
    if (event.target.closest("[data-allartists-back]")) { closeAllArtists(); return; }
    const card = event.target.closest("[data-music-artist]");
    if (card) {
      const name = card.dataset.musicArtist;
      if (name && name !== "all") openArtistDetail(name);
    }
  });
  return panel;
}

function renderAllArtists() {
  ensureAllArtistsDom();
  const grid = document.getElementById("allArtistsGrid");
  if (!grid) return;
  const eligible = eligibleArtistNames().sort((x, y) => x.localeCompare(y));
  grid.innerHTML = eligible.length
    ? eligible.map((a) => musicArtistCardHtml(a)).join("")
    : `<div class="music-state music-state--empty"><span>Qo'shiqchi topilmadi</span></div>`;
}

function openAllArtists() {
  const panel = ensureAllArtistsDom();
  if (!panel) return;
  renderAllArtists();
  document.body.classList.add("is-music-all-artists");
  panel.hidden = false;
  scrollMusicTop();
}

function closeAllArtists() {
  const panel = document.getElementById("musicAllArtists");
  if (panel) panel.hidden = true;
  document.body.classList.remove("is-music-all-artists");
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

function eligibleArtistNames() {
  const counts = new Map();
  musicAllTracks.forEach((t) => {
    splitArtists(t.artist).forEach((a) => {
      const k = a.trim();
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .filter(([, n]) => n >= 4)
    .map(([a]) => a);
}

function pickArtistFallbackImage(name) {
  const target = name.toLowerCase();
  const track = musicAllTracks.find((t) => splitArtists(t.artist).some((a) => a.toLowerCase() === target));
  return track ? `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg` : "";
}

function renderMusicCarousel() {
  if (!musicCarouselTrack || !musicCarouselDots) return;
  const eligible = eligibleArtistNames();
  const withImages = eligible
    .map((name) => ({ name, image: findArtistImage(name) || pickArtistFallbackImage(name) }))
    .filter((x) => x.image);
  musicCarouselItems = withImages.slice(0, 5);
  if (!musicCarouselItems.length) {
    musicCarouselTrack.innerHTML = "";
    musicCarouselDots.innerHTML = "";
    return;
  }
  musicCarouselIndex = Math.min(musicCarouselIndex, musicCarouselItems.length - 1);
  musicCarouselTrack.innerHTML = musicCarouselItems.map((item, i) => `
    <button class="music-slide ${i === musicCarouselIndex ? "is-active" : ""}" type="button" data-music-slide-artist="${escapeMusicHtml(item.name)}">
      <span class="music-slide__bg" style="background-image:url('${item.image.replaceAll("'", "%27")}')"></span>
      <span class="music-slide__gradient"></span>
      <span class="music-slide__inner">
        <span class="music-slide__title">${escapeMusicHtml(item.name)}</span>
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

function ensureArtistDetailDom() {
  if (!musicView) return null;
  let panel = document.getElementById("musicArtistDetail");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "musicArtistDetail";
  panel.className = "music-artist-detail";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="music-artist-detail__head">
      <button class="music-artist-detail__back" type="button" data-artist-detail-back aria-label="Orqaga">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
      </button>
      <h1 class="music-artist-detail__name" id="musicArtistDetailName"></h1>
    </header>
    <div class="music-artist-detail__card" id="musicArtistDetailCard">
      <div class="music-artist-detail__shade"></div>
      <span class="music-artist-detail__title" id="musicArtistDetailTitle"></span>
    </div>
    <ol class="music-list" id="musicArtistDetailList"></ol>
  `;
  musicView.appendChild(panel);
  panel.addEventListener("click", (event) => {
    if (event.target.closest("[data-artist-detail-back]")) {
      closeArtistDetail();
      return;
    }
    const row = event.target.closest("[data-music-row]");
    if (row) {
      const id = row.dataset.musicRow;
      const track = musicAllTracks.find((t) => t.youtubeId === id);
      if (track) playMusicTrack(track);
    }
  });
  return panel;
}

function renderArtistDetailTracks(name) {
  const list = document.getElementById("musicArtistDetailList");
  if (!list) return;
  const target = name.toLowerCase();
  const tracks = musicAllTracks.filter((t) => splitArtists(t.artist).some((a) => a.toLowerCase() === target));
  const playlist = readMusicPlaylist();
  list.innerHTML = tracks.map((t) => {
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

function openArtistDetail(name) {
  const panel = ensureArtistDetailDom();
  if (!panel) return;
  document.getElementById("musicArtistDetailName").textContent = name;
  document.getElementById("musicArtistDetailTitle").textContent = name;
  const card = document.getElementById("musicArtistDetailCard");
  const img = findArtistImage(name) || pickArtistFallbackImage(name);
  if (card) card.style.backgroundImage = img ? `url('${img.replaceAll("'", "%27")}')` : "none";
  renderArtistDetailTracks(name);
  // boshqa overlay sahifalarni yopamiz — aks holda CSS detail panelni yashiradi
  const allArtists = document.getElementById("musicAllArtists");
  if (allArtists) allArtists.hidden = true;
  const allSongs = document.getElementById("musicAllSongs");
  if (allSongs) allSongs.hidden = true;
  document.body.classList.remove("is-music-all-artists", "is-music-all-songs");
  document.body.classList.add("is-music-artist-detail");
  panel.hidden = false;
  scrollMusicTop();
}

function closeArtistDetail() {
  const panel = document.getElementById("musicArtistDetail");
  if (panel) panel.hidden = true;
  document.body.classList.remove("is-music-artist-detail");
}

function openMusicView() {
  if (!musicView) return;
  if (!musicAllTracks.length) loadMusicCatalog();
  fetchMusicArtists().then(() => { renderMusicFilters(); renderMusicCarousel(); });
  try { ensureYouTubeApi?.(); } catch (_) {}
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
  closeArtistDetail();
  closeAllSongs();
  closeAllArtists();
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
          if (e.data === S.ENDED) { try { autoAdvance(); } catch (_) {} }
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
      if (musicFullPlayerBarFill && dur > 0) {
        const pct = Math.min(100, (cur / dur) * 100);
        musicFullPlayerBarFill.style.width = `${pct}%`;
        if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = `${pct}%`;
      }
    } catch (_) {}
  }, 500);
}

function playMusicTrack(track) {
  if (!track) return;
  musicCurrentTrackKey = trackKey(track);
  recordMusicListen(track);
  if (miniPlayerTitle) miniPlayerTitle.textContent = track.title;
  if (miniPlayerArtistEl) miniPlayerArtistEl.textContent = track.artist;
  const miniArt = document.getElementById("miniPlayerArt");
  if (miniArt) miniArt.src = `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
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
    try { ensureYouTubeApi?.(); } catch (_) {}
  }
  startMiniProgress();
  renderMusicList();
  if (document.getElementById("musicAllSongs") && !document.getElementById("musicAllSongs").hidden) renderAllSongs();
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
    const val = artBtn.dataset.musicArtist;
    if (val === "all") {
      openAllArtists();
    } else {
      openArtistDetail(val);
    }
    return;
  }
  if (event.target.closest("[data-music-more]")) {
    openAllSongs();
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
const musicFullPlayerArtFallback = document.getElementById("musicFullPlayerArtFallback");
const musicFullPlayerYtSlot = document.getElementById("musicFullPlayerYtSlot");
const musicFullPlayerAlbum = document.getElementById("musicFullPlayerAlbum");
const musicFullPlayerTitle = document.getElementById("musicFullPlayerTitle");
const musicFullPlayerArtist = document.getElementById("musicFullPlayerArtist");
const musicFullPlayerCur = document.getElementById("musicFullPlayerCur");
const musicFullPlayerDur = document.getElementById("musicFullPlayerDur");
const musicFullPlayerBar = document.getElementById("musicFullPlayerBar");
const musicFullPlayerBarFill = document.getElementById("musicFullPlayerBarFill");
const musicFullPlayerBarThumb = document.getElementById("musicFullPlayerBarThumb");
const musicFullPlayerToggle = document.getElementById("musicFullPlayerToggle");
const musicFullPlayerShuffle = document.getElementById("musicFullPlayerShuffle");
const musicFullPlayerRepeat = document.getElementById("musicFullPlayerRepeat");
const musicFullPlayerLike = document.getElementById("musicFullPlayerLike");
const miniPlayerYtHost = document.getElementById("miniPlayerYt");

let musicShuffle = false;
let musicRepeat = "off"; // "off" | "all" | "one"

function moveYtIntoFullPlayer() {
  musicFullPlayerArt?.classList.add("has-video");
}
function moveYtBackToMini() {
  // no-op: iframe stays pinned in full-player slot so audio is not interrupted
}

function openMusicFullPlayer(track) {
  if (!musicFullPlayer || !track) return;
  document.body.classList.add("fullplayer-open");
  if (musicFullPlayerArtFallback) musicFullPlayerArtFallback.style.backgroundImage = `url('https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg')`;
  if (musicFullPlayerAlbum) musicFullPlayerAlbum.textContent = (track.category && track.category !== "all") ? track.category : "Music";
  if (musicFullPlayerTitle) musicFullPlayerTitle.textContent = track.title;
  if (musicFullPlayerArtist) musicFullPlayerArtist.textContent = track.artist;
  if (musicFullPlayerBarFill) musicFullPlayerBarFill.style.width = "0%";
  if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = "0%";
  if (musicFullPlayerCur) musicFullPlayerCur.textContent = "0:00";
  if (musicFullPlayerDur) musicFullPlayerDur.textContent = "0:00";
  if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
  if (musicFullPlayerLike) {
    const inPl = readMusicPlaylist().includes(track.youtubeId);
    musicFullPlayerLike.setAttribute("aria-pressed", inPl ? "true" : "false");
    musicFullPlayerLike.dataset.id = track.youtubeId;
  }
  musicFullPlayer.hidden = false;
  requestAnimationFrame(() => musicFullPlayer.setAttribute("aria-hidden", "false"));
  moveYtIntoFullPlayer();
}

function closeMusicFullPlayer() {
  if (!musicFullPlayer) return;
  musicFullPlayer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("fullplayer-open");
  // Keep musicFullPlayer rendered (no display:none) so YT iframe inside keeps playing audio
}

function currentTrackIndex() {
  const list = filteredMusicTracks();
  return list.findIndex((t) => trackKey(t) === musicCurrentTrackKey);
}
function playRelative(offset) {
  const list = filteredMusicTracks();
  if (!list.length) return;
  const cur = currentTrackIndex();
  let nextIdx;
  if (musicShuffle && list.length > 1) {
    do { nextIdx = Math.floor(Math.random() * list.length); } while (nextIdx === cur);
  } else {
    nextIdx = cur < 0 ? 0 : (cur + offset + list.length) % list.length;
  }
  playMusicTrack(list[nextIdx]);
}

function autoAdvance() {
  if (musicRepeat === "one") {
    try { ytPlayer?.seekTo?.(0, true); ytPlayer?.playVideo?.(); } catch (_) {}
    return;
  }
  const list = filteredMusicTracks();
  if (!list.length) return;
  const cur = currentTrackIndex();
  if (musicRepeat === "off" && !musicShuffle && cur >= list.length - 1) return;
  playRelative(1);
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
  if (e.target.closest("[data-music-fp-shuffle]")) {
    musicShuffle = !musicShuffle;
    if (musicFullPlayerShuffle) musicFullPlayerShuffle.setAttribute("aria-pressed", musicShuffle ? "true" : "false");
    return;
  }
  if (e.target.closest("[data-music-fp-repeat]")) {
    musicRepeat = musicRepeat === "off" ? "all" : musicRepeat === "all" ? "one" : "off";
    if (musicFullPlayerRepeat) {
      musicFullPlayerRepeat.dataset.repeat = musicRepeat;
      musicFullPlayerRepeat.setAttribute("aria-pressed", musicRepeat === "off" ? "false" : "true");
    }
    return;
  }
  if (e.target.closest("#musicFullPlayerLike")) {
    const id = musicFullPlayerLike?.dataset.id;
    if (id) {
      toggleMusicPlaylist(id);
      const inPl = readMusicPlaylist().includes(id);
      musicFullPlayerLike.setAttribute("aria-pressed", inPl ? "true" : "false");
      renderMusicList();
    }
    return;
  }
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
  const artistSlide = e.target.closest("[data-music-slide-artist]");
  if (artistSlide) {
    openArtistDetail(artistSlide.dataset.musicSlideArtist);
    return;
  }
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
document.getElementById("miniPlayerPrev")?.addEventListener("click", () => playRelative(-1));
document.getElementById("miniPlayerNext")?.addEventListener("click", () => playRelative(1));
document.getElementById("miniPlayerExpand")?.addEventListener("click", () => {
  const track = musicAllTracks.find((t) => trackKey(t) === musicCurrentTrackKey);
  if (track) openMusicFullPlayer(track);
});

document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.addEventListener("click", closeMusicView));
// Profil — modal, shuning uchun musiqa rejimini yopmaymiz (musiqa tarixi ko'rinishi uchun)
document.querySelectorAll(".bottom-bar [data-action='favorites'], .bottom-bar [data-action='catalog']").forEach((b) => b.addEventListener("click", closeMusicView));

// ===== Categories view (bottom-bar) =====
const categoriesView = document.getElementById("categoriesView");
const categoriesGrid = document.getElementById("categoriesGrid");
const categoriesEmpty = document.getElementById("categoriesEmpty");
let categoriesLoaded = false;
let categoriesData = [];

async function loadCategoriesCatalog() {
  try {
    const res = await fetch("/api/categories", { cache: "no-store" });
    const json = await res.json();
    categoriesData = Array.isArray(json.categories) ? json.categories : [];
  } catch (_) {
    categoriesData = [];
  }
  renderCategoriesGrid();
  categoriesLoaded = true;
}

function escapeAttr(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderCategoriesGrid() {
  if (!categoriesGrid) return;
  if (!categoriesData.length) {
    categoriesGrid.innerHTML = "";
    if (categoriesEmpty) categoriesEmpty.hidden = false;
    return;
  }
  if (categoriesEmpty) categoriesEmpty.hidden = true;
  categoriesGrid.innerHTML = categoriesData.map((c) => {
    const bg = c.image ? `style="background-image:url('${escapeAttr(c.image).replaceAll("'", "%27")}')"` : "";
    return `<button class="category-card" type="button" data-category-name="${escapeAttr(c.name)}" aria-label="${escapeAttr(c.name)}" ${bg}></button>`;
  }).join("");
}

function openCategoriesView() {
  if (!categoriesView) return;
  closeMusicView();
  categoriesView.hidden = false;
  document.body.classList.add("is-categories");
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".bottom-bar [data-action='categories-view']").forEach((b) => b.classList.add("is-active"));
  document.querySelectorAll(".bottom-bar [data-filter='all'], .bottom-bar [data-action='favorites']").forEach((b) => b.classList.remove("is-active"));
  if (!categoriesLoaded) loadCategoriesCatalog();
}

function closeCategoriesView() {
  if (!categoriesView) return;
  categoriesView.hidden = true;
  document.body.classList.remove("is-categories");
  document.querySelectorAll(".bottom-bar [data-action='categories-view']").forEach((b) => b.classList.remove("is-active"));
}

document.querySelectorAll("[data-action='categories-view']").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    openCategoriesView();
  });
});

document.querySelectorAll(".bottom-bar [data-filter='all'], .bottom-bar [data-action='favorites'], .bottom-bar [data-action='profile']").forEach((b) => {
  b.addEventListener("click", closeCategoriesView);
});

categoriesGrid?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-category-name]");
  if (!card) return;
  const name = card.dataset.categoryName || "";
  if (!name) return;
  openCategoryDetailView(name);
});

// ===== Category detail page =====
const categoryDetailView = document.getElementById("categoryDetailView");
const categoryDetailGrid = document.getElementById("categoryDetailGrid");
const categoryDetailTitle = document.getElementById("categoryDetailTitle");
const categoryDetailEmpty = document.getElementById("categoryDetailEmpty");
const categoryDetailBack = document.getElementById("categoryDetailBack");

function openCategoryDetailView(name) {
  if (!categoryDetailView || !categoryDetailGrid) return;
  const targetValue = normalizeCategoryValue(name);
  if (categoryDetailTitle) categoryDetailTitle.textContent = name;
  categoryDetailGrid.innerHTML = "";
  const matched = (Array.isArray(movies) ? movies : []).filter((m) => {
    if (!m) return false;
    const values = getMovieCategoryValues(m);
    return values.includes(targetValue);
  });
  if (!matched.length) {
    if (categoryDetailEmpty) categoryDetailEmpty.hidden = false;
  } else {
    if (categoryDetailEmpty) categoryDetailEmpty.hidden = true;
    for (const movie of matched) {
      try { categoryDetailGrid.append(createMovieCard(movie)); } catch (_) {}
    }
  }
  if (categoriesView) categoriesView.hidden = true;
  categoryDetailView.hidden = false;
  document.body.classList.add("is-category-detail");
  document.body.classList.remove("is-categories");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeCategoryDetailView({ goHome = false } = {}) {
  if (!categoryDetailView) return;
  categoryDetailView.hidden = true;
  document.body.classList.remove("is-category-detail");
  if (goHome) return;
  if (categoriesView) {
    categoriesView.hidden = false;
    document.body.classList.add("is-categories");
  }
}

categoryDetailBack?.addEventListener("click", () => closeCategoryDetailView());

document.querySelectorAll(".bottom-bar [data-filter='all'], .bottom-bar [data-action='favorites'], .bottom-bar [data-action='profile']").forEach((b) => {
  b.addEventListener("click", () => closeCategoryDetailView({ goHome: true }));
});

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

/* ============================================================
   Sidebar drawer
   ============================================================ */
const appSidebar = document.getElementById("appSidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const topbarMenuButton = document.getElementById("topbarMenuButton");
const sidebarThemeSwitch = document.getElementById("sidebarThemeSwitch");
const sidebarLangPills = document.getElementById("sidebarLangPills");

function syncSidebarSettings() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  if (sidebarThemeSwitch) {
    sidebarThemeSwitch.setAttribute("aria-checked", cur === "dark" ? "true" : "false");
  }
  if (sidebarLangPills) {
    const curLang = localStorage.getItem("kino_lang") || (typeof lang !== "undefined" ? lang : "uz");
    sidebarLangPills.querySelectorAll(".lang-pill").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.lang === curLang);
    });
  }
}
syncSidebarSettings();

function syncSidebarMusicItem() {
  const item = document.getElementById("sidebarMusicItem");
  if (!item) return;
  const isMusic = document.body.classList.contains("is-music");
  if (isMusic) {
    item.dataset.sidebarAction = "kino-back";
    item.innerHTML = `
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="14.4" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
        <path d="M13 11.4 22.2 16 13 20.6Z" fill="currentColor"></path>
      </svg>
      <span>Kino</span>`;
  } else {
    item.dataset.sidebarAction = "music";
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
      </svg>
      <span data-i18n="musicNav">Musiqa</span>
      <span class="beta-badge" aria-hidden="true">Beta versiya</span>`;
  }
}

function setSidebarOpen(open) {
  if (!appSidebar || !sidebarBackdrop) return;
  if (open) {
    syncSidebarMusicItem();
    sidebarBackdrop.hidden = false;
    requestAnimationFrame(() => {
      appSidebar.classList.add("is-open");
      sidebarBackdrop.classList.add("is-open");
    });
    appSidebar.setAttribute("aria-hidden", "false");
    topbarMenuButton?.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  } else {
    appSidebar.classList.remove("is-open");
    sidebarBackdrop.classList.remove("is-open");
    appSidebar.setAttribute("aria-hidden", "true");
    topbarMenuButton?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setTimeout(() => {
      if (!appSidebar.classList.contains("is-open")) sidebarBackdrop.hidden = true;
    }, 320);
  }
}

document.querySelectorAll("[data-action='sidebar-open']").forEach((b) =>
  b.addEventListener("click", () => setSidebarOpen(true))
);
document.querySelectorAll("[data-action='sidebar-close']").forEach((b) =>
  b.addEventListener("click", () => setSidebarOpen(false))
);
sidebarBackdrop?.addEventListener("click", () => setSidebarOpen(false));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && appSidebar?.classList.contains("is-open")) setSidebarOpen(false);
});

document.querySelectorAll("[data-sidebar-action]").forEach((el) => {
  el.addEventListener("click", (e) => {
    const action = el.dataset.sidebarAction;
    if (action === "tv") {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    if (action === "music") {
      openMusicView();
      setSidebarOpen(false);
      return;
    }
    if (action === "kino-back") {
      closeMusicView();
      setFilter("all");
      document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
      setSidebarOpen(false);
      return;
    }
    if (action === "favorites") {
      setFilter("favorites");
      document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "profile") {
      renderProfileModal();
      profileModal.showModal();
    }
    setSidebarOpen(false);
  });
});

sidebarThemeSwitch?.addEventListener("click", () => {
  toggleTheme();
  syncSidebarSettings();
});

sidebarLangPills?.querySelectorAll(".lang-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    const next = pill.dataset.lang;
    if (!next) return;
    lang = next;
    localStorage.setItem("kino_lang", next);
    try { applyCopy(); } catch (_) {}
    syncSidebarSettings();
  });
});

const _origApplyTheme = applyTheme;
applyTheme = function (t) {
  _origApplyTheme(t);
  syncSidebarSettings();
};

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

document.getElementById("clearMusicHistoryButton")?.addEventListener("click", () => {
  clearMusicHistory();
  renderMusicHistory();
});

document.getElementById("musicHistoryList")?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-music-history-remove]");
  if (removeButton) {
    event.stopPropagation();
    removeMusicHistoryItem(removeButton.dataset.musicHistoryRemove || "");
    renderMusicHistory();
    return;
  }
  const item = event.target.closest("[data-music-history]");
  if (!item) return;
  const track = musicAllTracks.find((t) => t.youtubeId === item.dataset.musicHistory);
  if (track) {
    try { profileModal.close(); } catch (_) {}
    playMusicTrack(track);
  }
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => movieModal.close());
});

modalDescriptionToggle?.addEventListener("click", () => {
  const expanded = !modalDescriptionToggle.classList.contains("is-expanded");
  setDescriptionExpanded(expanded);
  if (expanded) {
    requestAnimationFrame(() => {
      modalDescriptionWrap?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }
});

likeButton?.addEventListener("click", () => {
  if (!activeMovie) return;
  sendReaction(activeMovie, "like");
});

dislikeButton?.addEventListener("click", () => {
  if (!activeMovie) return;
  sendReaction(activeMovie, "dislike");
});

movieModal?.addEventListener("close", () => {
  stopMoviePreload();
  document.body.classList.remove("is-modal-open");
  movieModal.scrollTop = 0;
  movieModal.querySelector(".modal-content")?.scrollTo?.({ top: 0, left: 0 });
  if (history.state && history.state.movieDetail) {
    history.back();
  }
});

window.addEventListener("popstate", () => {
  if (movieModal?.open) movieModal.close();
});

document.querySelector("[data-close-profile]").addEventListener("click", () => profileModal.close());
videoToggleButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.togglePlay(); setControlsVisible(true); });
videoBackButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.seekBy(-15); showSkipFeedback("left"); setControlsVisible(true); });
videoForwardButton.addEventListener("click", (e) => { e.stopPropagation(); playerCore.seekBy(15); showSkipFeedback("right"); setControlsVisible(true); });
videoFullscreenButton.addEventListener("click", (e) => { e.stopPropagation(); toggleVideoFullscreen(); setControlsVisible(true); });
videoVolumeButton?.addEventListener("click", (e) => { e.stopPropagation(); toggleMute(); setControlsVisible(true); });
videoPipButton?.addEventListener("click", (e) => { e.stopPropagation(); togglePip(); setControlsVisible(true); });
videoVolume?.addEventListener("input", () => {
  setVolume(videoVolume.value);
  setControlsVisible(true);
});
videoTapZoneLeft?.addEventListener("click", (e) => handleTapZone("left", e));
videoTapZoneRight?.addEventListener("click", (e) => handleTapZone("right", e));
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
document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
document.addEventListener("mozfullscreenchange", syncFullscreenButton);
document.addEventListener("MSFullscreenChange", syncFullscreenButton);

try {
  const tgWebApp = window.Telegram?.WebApp;
  if (tgWebApp && typeof tgWebApp.onEvent === "function") {
    tgWebApp.onEvent("fullscreenChanged", () => { syncFullscreenButton(); refreshLandscapeView(); });
    tgWebApp.onEvent("fullscreenFailed", () => {
      showPlayerToast("Fullscreen qo'llab-quvvatlanmaydi");
      syncFullscreenButton();
    });
    tgWebApp.onEvent("viewportChanged", () => { refreshLandscapeView(); });
  }
} catch {}

window.addEventListener("resize", () => { if (intendedFullscreen) refreshLandscapeView(); });

try {
  const portraitMQ = window.matchMedia("(orientation: portrait)");
  const onOrientChange = () => { refreshLandscapeView(); syncFullscreenButton(); };
  if (typeof portraitMQ.addEventListener === "function") {
    portraitMQ.addEventListener("change", onOrientChange);
  } else if (typeof portraitMQ.addListener === "function") {
    portraitMQ.addListener(onOrientChange);
  }
  window.addEventListener("orientationchange", onOrientChange);
} catch {}

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
  if (videoPlayer.hidden) return;
  const target = event.target;
  const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
  if (isTyping && event.key !== "Escape") return;
  if (event.key === "Escape") { closeVideoPlayer(); return; }
  if (isPlayerLocked) return;
  switch (event.key) {
    case " ":
    case "k":
    case "K":
      event.preventDefault();
      playerCore.togglePlay();
      setControlsVisible(true);
      break;
    case "ArrowLeft":
    case "j":
    case "J":
      event.preventDefault();
      playerCore.seekBy(-15);
      showSkipFeedback("left");
      setControlsVisible(true);
      break;
    case "ArrowRight":
    case "l":
    case "L":
      event.preventDefault();
      playerCore.seekBy(15);
      showSkipFeedback("right");
      setControlsVisible(true);
      break;
    case "ArrowUp":
      event.preventDefault();
      setVolume(Math.min(100, Math.round(currentVolume * 100) + 5));
      setControlsVisible(true);
      break;
    case "ArrowDown":
      event.preventDefault();
      setVolume(Math.max(0, Math.round(currentVolume * 100) - 5));
      setControlsVisible(true);
      break;
    case "f":
    case "F":
      event.preventDefault();
      toggleVideoFullscreen();
      break;
    case "m":
    case "M":
      event.preventDefault();
      setVolume(currentVolume > 0 ? 0 : 100);
      setControlsVisible(true);
      break;
    default:
      break;
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
    movies = sessionShuffleMovies(payload.map((movie, index) => normalizeMovie(movie, index)));
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

    const newMovies = sessionShuffleMovies(payload.map((movie, index) => normalizeMovie(movie, index)));

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
      await response.json();
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
  loadProgressFromBackend().catch(() => {});
}

initApp();

// === nav-icon-click-anim (revertable: delete this block) ===
(function attachNavClickAnim() {
  const SELECTOR = '.sidebar__item, .icon-button, .bottom-bar__button';
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest(SELECTOR);
    if (!target) return;
    target.classList.remove('is-clicked');
    void target.offsetWidth;
    target.classList.add('is-clicked');
    setTimeout(() => target.classList.remove('is-clicked'), 420);

    const ripple = document.createElement('span');
    ripple.className = 'nav-click-ripple';
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  }, { passive: true });
})();
// === /nav-icon-click-anim ===

// === swipe-gestures (revertable: delete this block) ===
(function attachSwipeGestures() {
  const SWIPE_THRESHOLD = 55;
  const DIRECTION_LOCK = 10;
  const MAX_OFF_AXIS_RATIO = 0.7;

  function hasScrollableAncestor(node, stopAt, axis) {
    let el = node;
    while (el && el !== stopAt && el.nodeType === 1) {
      const style = getComputedStyle(el);
      if (axis === "x") {
        if (/(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1) return true;
      } else {
        if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function setupSwipe(target, { onCommit, onDrag, onCancel, axis = "x" }) {
    if (!target) return;
    let startX = 0, startY = 0, dragging = false, locked = false, decided = false, accept = false;

    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("input, textarea, [contenteditable='true']")) return;
      if (hasScrollableAncestor(e.target, target, axis)) return;
      startX = e.clientX; startY = e.clientY;
      dragging = true; locked = false; decided = false; accept = false;
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!decided) {
        const ax = Math.abs(dx), ay = Math.abs(dy);
        if (ax < DIRECTION_LOCK && ay < DIRECTION_LOCK) return;
        decided = true;
        accept = axis === "x" ? ax > ay : ay > ax;
        locked = accept;
      }
      if (!accept) return;
      const primary = axis === "x" ? dx : dy;
      const offAxis = axis === "x" ? dy : dx;
      if (Math.abs(offAxis) > Math.abs(primary) * MAX_OFF_AXIS_RATIO + 30) {
        accept = false;
        onCancel?.();
        return;
      }
      onDrag?.(primary, e);
    };
    const onUp = (e) => {
      if (!dragging) return;
      const wasAccepted = accept;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const primary = axis === "x" ? dx : dy;
      dragging = false; locked = false; decided = false; accept = false;
      if (!wasAccepted) { onCancel?.(); return; }
      if (Math.abs(primary) >= SWIPE_THRESHOLD) {
        onCommit?.(primary > 0 ? 1 : -1, primary, e);
      } else {
        onCancel?.();
      }
    };
    const onCancelEvent = () => {
      if (!dragging) return;
      dragging = false; locked = false; decided = false; accept = false;
      onCancel?.();
    };
    target.addEventListener("pointerdown", onDown, { passive: true });
    target.addEventListener("pointermove", onMove, { passive: true });
    target.addEventListener("pointerup", onUp, { passive: true });
    target.addEventListener("pointercancel", onCancelEvent, { passive: true });
    target.addEventListener("pointerleave", onCancelEvent, { passive: true });
  }

  // Tab swipe on #appShell disabled — sections only change via bottom-bar.

  // --- Theme switch drag-to-toggle ---
  const themeSwitch = document.getElementById("sidebarThemeSwitch");
  if (themeSwitch) {
    const knob = themeSwitch.querySelector(".theme-switch__knob");
    let dragMoved = false;
    setupSwipe(themeSwitch, {
      axis: "x",
      onDrag: (dx) => {
        dragMoved = true;
        if (knob) {
          knob.style.transition = "none";
          knob.style.transform = `translateX(${Math.max(-12, Math.min(12, dx * 0.4))}px)`;
        }
      },
      onCommit: (dir) => {
        const cur = document.documentElement.getAttribute("data-theme") || "light";
        const wantsDark = dir > 0 ? false : true;
        if ((wantsDark && cur !== "dark") || (!wantsDark && cur !== "light")) {
          toggleTheme?.();
          syncSidebarSettings?.();
        }
        if (knob) {
          knob.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
          knob.style.transform = "";
        }
        setTimeout(() => { dragMoved = false; }, 50);
      },
      onCancel: () => {
        if (knob) {
          knob.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
          knob.style.transform = "";
        }
        setTimeout(() => { dragMoved = false; }, 50);
      },
    });
    themeSwitch.addEventListener("click", (e) => {
      if (dragMoved) { e.stopImmediatePropagation(); e.preventDefault(); dragMoved = false; }
    }, true);
  }

  // --- Language pills swipe ---
  const langPills = document.getElementById("sidebarLangPills");
  if (langPills) {
    const LANGS = ["uz", "ru", "en"];
    let dragMoved = false;
    setupSwipe(langPills, {
      axis: "x",
      onDrag: (dx) => {
        dragMoved = Math.abs(dx) > DIRECTION_LOCK;
        langPills.style.transition = "none";
        langPills.style.transform = `translateX(${Math.max(-20, Math.min(20, dx * 0.4))}px)`;
      },
      onCommit: (dir) => {
        langPills.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
        langPills.style.transform = "";
        const cur = localStorage.getItem("kino_lang") || (typeof lang !== "undefined" ? lang : "uz");
        let i = LANGS.indexOf(cur);
        if (i < 0) i = 0;
        const next = (i + (dir > 0 ? -1 : 1) + LANGS.length) % LANGS.length;
        const pill = langPills.querySelector(`.lang-pill[data-lang='${LANGS[next]}']`);
        pill?.click();
        setTimeout(() => { dragMoved = false; }, 50);
      },
      onCancel: () => {
        langPills.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
        langPills.style.transform = "";
        setTimeout(() => { dragMoved = false; }, 50);
      },
    });
    langPills.addEventListener("click", (e) => {
      if (dragMoved) { e.stopImmediatePropagation(); e.preventDefault(); dragMoved = false; }
    }, true);
  }
})();
// === /swipe-gestures ===

