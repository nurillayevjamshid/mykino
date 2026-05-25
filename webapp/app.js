const tg = window.Telegram?.WebApp;
const HERO_ROTATE_INTERVAL_MS = 6500;
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
  // Telegram theme almashganda — agar foydalanuvchi qo'lda toggle bosmagan bo'lsa — ergashish.
  try {
    tg.onEvent?.("themeChanged", () => {
      if (localStorage.getItem(THEME_EXPLICIT_KEY) === "1") return;
      const nextScheme = tg.colorScheme === "dark" ? "dark" : "light";
      if (document.documentElement.getAttribute("data-theme") !== nextScheme) {
        applyTheme(nextScheme);
        try { syncSidebarSettings?.(); } catch (_) {}
      }
    });
  } catch (_) {}
}

// === Haptic feedback helper ===
// Telegram WebApp HapticFeedback API'sini xavfsiz o'rab beradi.
// Helper: haptic.tap() — yengil bosish, haptic.select() — tab/pill, haptic.success(), haptic.warn()
const haptic = (() => {
  const hf = tg?.HapticFeedback;
  let lastFireAt = 0;
  // Throttle — drag/swipe bo'lganda spam bo'lmasin.
  const throttle = (fn) => (...args) => {
    const now = Date.now();
    if (now - lastFireAt < 40) return;
    lastFireAt = now;
    try { fn(...args); } catch (_) {}
  };
  if (!hf || typeof hf.impactOccurred !== "function") {
    return { tap() {}, soft() {}, medium() {}, select() {}, success() {}, warn() {}, error() {} };
  }
  return {
    tap: throttle(() => hf.impactOccurred("light")),
    soft: throttle(() => hf.impactOccurred("soft")),
    medium: throttle(() => hf.impactOccurred("medium")),
    select: throttle(() => hf.selectionChanged?.()),
    success: throttle(() => hf.notificationOccurred?.("success")),
    warn: throttle(() => hf.notificationOccurred?.("warning")),
    error: throttle(() => hf.notificationOccurred?.("error")),
  };
})();

// Theme manbai: foydalanuvchi qo'lda toggle bosgan bo'lsa — uning tanlovi.
// Aks holda Telegram colorScheme'ga ergashadi (themeChanged event'ida ham yangilanadi).
const THEME_STORAGE_KEY = "kino_theme";
const THEME_EXPLICIT_KEY = "kino_theme_explicit";
function getInitialTheme() {
  const explicit = localStorage.getItem(THEME_EXPLICIT_KEY) === "1";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (explicit && (stored === "light" || stored === "dark")) return stored;
  const tgScheme = tg?.colorScheme;
  if (tgScheme === "dark" || tgScheme === "light") return tgScheme;
  return stored === "dark" ? "dark" : "light";
}
const savedTheme = getInitialTheme();
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
const WATCH_PROGRESS_LOCAL_CAP = 500;
const WATCH_PROGRESS_BACKOFF_DELAYS_MS = [5000, 15000, 60000, 180000];
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
movieModal?.addEventListener("close", () => { tgBackUnregister("movie-modal"); });
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
profileModal?.addEventListener("close", () => { tgBackUnregister("profile-modal"); });
const __origProfileShowModal = profileModal?.showModal?.bind(profileModal);
if (profileModal && __origProfileShowModal) {
  profileModal.showModal = function patchedShowModal(...args) {
    const r = __origProfileShowModal(...args);
    tgBackRegister("profile-modal", () => { try { profileModal.close(); } catch (_) {} });
    return r;
  };
}
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

function parseInitDataUser(initData) {
  try {
    if (!initData || typeof initData !== "string") return null;
    const rawUser = new URLSearchParams(initData).get("user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser);
    return parsed && parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

function getTelegramUser() {
  return (
    tg?.initDataUnsafe?.user ||
    parseInitDataUser(tg?.initData) ||
    readDebugTelegramUser() ||
    null
  );
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
  if (user.id) candidatePhotos.push(`${runtimeApiBase}/api/user-photo?userId=${encodeURIComponent(user.id)}`);
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
  const candidates = [movie?.posterImage, movie?.poster, movie?.headerImage, movie?.heroPoster];
  for (const c of candidates) {
    const s = String(c || "").trim();
    if (s && !s.startsWith("blob:")) return s;
  }
  return "";
}



function isDataImageValue(value) {
  return String(value || "").trim().startsWith("data:image/");
}

function posterStyle(movie) {
  const source = getPosterImage(movie);
  // Agar hech qanday URL yo'q bo'lsa (blob: filtrlandi yoki umuman yo'q) — canvas poster.
  const effective = source || buildGeneratedPosterDataUrl(movie);
  const safe = effective.replaceAll("'", "%27").replaceAll(")", "%29").replaceAll('"', "%22");
  // data: URL (admin yuklagan yoki generatsiya) — IO kutmasdan to'g'ridan-to'g'ri style.
  if (effective.startsWith("data:")) {
    return `style="--poster-image: url('${safe}')"`;
  }
  // https: URL — lazy load (IntersectionObserver orqali).
  return `data-poster="${safe}"`;
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
  if (raw.startsWith("blob:")) return "";
  if (/^(?:https?:|data:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return buildApiUrl(raw);
  return raw;
}

function firstUsableImage(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value && !value.startsWith("blob:")) return value;
  }
  return "";
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
  // cdnUrl R2 dagi tayyor MP4 ga ko'rsatadi — original format (mkv) muhim emas
  if (String(movie?.cdnUrl || "").trim()) return true;

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
  const rawPoster = firstUsableImage(
    movie?.posterImage,
    movie?.poster,
    movie?.thumbnail,
    fileId ? buildDriveThumbnailUrl(fileId) : "",
  );
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
    headerImage: resolveAppUrl(firstUsableImage(movie?.headerImage, movie?.heroPoster)),
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
let progressSyncFailureCount = 0;

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
  // In-flight: keyingi yangilanish bo'lsa, joriy chaqiriqdan keyin qaytadan rejalashtirish kerak.
  if (progressSyncInFlight) {
    scheduleProgressSync(2000);
    return;
  }

  const upserts = pendingProgressSync.upserts;
  const removeIds = Array.from(pendingProgressSync.removeIds);
  const clearAll = pendingProgressSync.clearAll === true;
  if (!clearAll && removeIds.length === 0 && Object.keys(upserts).length === 0) return;

  pendingProgressSync.upserts = {};
  pendingProgressSync.removeIds = new Set();
  pendingProgressSync.clearAll = false;

  progressSyncInFlight = true;
  let failed = false;
  try {
    const resp = await fetch(WATCH_PROGRESS_SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, items: upserts, removeIds, clearAll }),
      keepalive: true,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    progressSyncFailureCount = 0;
  } catch {
    failed = true;
    // Yangi keluvchi yangilanishlar ustun bo'ladi (right-hand wins in spread).
    pendingProgressSync.upserts = { ...upserts, ...pendingProgressSync.upserts };
    for (const id of removeIds) pendingProgressSync.removeIds.add(id);
    if (clearAll) pendingProgressSync.clearAll = true;
    progressSyncFailureCount += 1;
  } finally {
    progressSyncInFlight = false;
  }

  // #2: pending bor bo'lsa darrov yana schedule (in-flight paytida qo'shilgan bo'lishi mumkin).
  // #4: muvaffaqiyatsiz bo'lsa exponential backoff.
  const stillPending = pendingProgressSync.clearAll
    || pendingProgressSync.removeIds.size > 0
    || Object.keys(pendingProgressSync.upserts).length > 0;
  if (stillPending) {
    if (failed) {
      const idx = Math.min(progressSyncFailureCount - 1, WATCH_PROGRESS_BACKOFF_DELAYS_MS.length - 1);
      scheduleProgressSync(WATCH_PROGRESS_BACKOFF_DELAYS_MS[Math.max(0, idx)]);
    } else {
      scheduleProgressSync(0);
    }
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

  // #1 BOOT RECONCILIATION: lokal'da bor lekin server'da yo'q yoki eskirgan entrylarni server'ga jo'natish.
  // Bu oldingi sessiyada flushBeacon ishlamay qolgan progresslarni tiklaydi.
  let reconciledCount = 0;
  for (const [id, localEntry] of Object.entries(localProgress)) {
    if (!localEntry || typeof localEntry !== "object") continue;
    const localTime = Math.max(0, Math.floor(Number(localEntry.time) || 0));
    const localDuration = Math.max(0, Math.floor(Number(localEntry.duration) || 0));
    if (localTime <= 0 || localDuration <= 0) continue;
    const remoteEntry = remote[id];
    const remoteUpdated = Number(remoteEntry?.updatedAt || 0);
    const localUpdated = Number(localEntry.updatedAt || 0);
    if (localUpdated <= remoteUpdated) continue;
    // poster/year/genre lokal store'da yo'q — movies katalogidan olishga harakat.
    const movie = Array.isArray(movies) ? movies.find((m) => String(m?.id) === String(id)) : null;
    queueProgressUpsert(id, {
      time: localTime,
      duration: localDuration,
      updatedAt: localUpdated,
      title: String(localEntry.title || movie?.title || ""),
      poster: movie ? (getPosterImage(movie) || "") : "",
      year: movie?.year || "",
      genre: movie?.genre || "",
    });
    reconciledCount += 1;
  }
  if (reconciledCount > 0) {
    // Darrov flush — boot vaqtidagi tiklash kechiktirilmasin.
    scheduleProgressSync(0);
  }

  progressBackendLoaded = true;
}

window.addEventListener("pagehide", flushProgressSyncBeacon);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushProgressSyncBeacon();
});
// #3 pageshow: bfcache'dan qaytganda yoki forward-back navigation'da pending bo'lsa flush.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // bfcache'dan qaytgan: tarmoq qayta tayyor, pending borligini tekshiramiz.
    scheduleProgressSync(0);
  }
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
  // #5 Lokal cap: WATCH_PROGRESS_LOCAL_CAP dan oshsa, eng eski updatedAt'lilarini olib tashlash.
  let toSave = store;
  const keys = Object.keys(store || {});
  if (keys.length > WATCH_PROGRESS_LOCAL_CAP) {
    const sorted = keys
      .map((k) => [k, Number(store[k]?.updatedAt || 0)])
      .sort((a, b) => b[1] - a[1])
      .slice(0, WATCH_PROGRESS_LOCAL_CAP);
    toSave = Object.fromEntries(sorted.map(([k]) => [k, store[k]]));
  }
  localStorage.setItem(WATCH_PROGRESS_KEY, JSON.stringify(toSave));
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
  const heroSectionEl = document.getElementById("heroSection");
  if (heroSectionEl && !heroSectionEl.dataset.tapBound) {
    heroSectionEl.dataset.tapBound = "1";
    heroSectionEl.style.cursor = "pointer";
    heroSectionEl.addEventListener("click", (e) => {
      if (!heroFeaturedMovie) return;
      if (e.target.closest(".hero__play, .hero__info, .hero__dots, .hero__dot")) return;
      openMovie(heroFeaturedMovie);
    });
  }
  const heroSection = document.getElementById("heroSection");
  if (heroSection && !heroSection.dataset.swipeBound) {
    heroSection.dataset.swipeBound = "1";
    let sx = 0, sy = 0, active = false;
    heroSection.addEventListener("touchstart", (e) => {
      if (!e.touches[0] || heroSlides.length < 2) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      active = true;
      stopHeroAutoRotate();
    }, { passive: true });
    heroSection.addEventListener("touchmove", (e) => {
      if (!active || !e.touches[0]) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) active = false;
    }, { passive: true });
    const finish = (e) => {
      if (!active) { startHeroAutoRotate(); return; }
      active = false;
      const t = e.changedTouches && e.changedTouches[0];
      const dx = t ? t.clientX - sx : 0;
      if (Math.abs(dx) > 40 && heroSlides.length > 1) {
        const dir = dx < 0 ? 1 : -1;
        heroActiveIndex = (heroActiveIndex + dir + heroSlides.length) % heroSlides.length;
        renderHeroSlide(heroSlides[heroActiveIndex]);
      }
      startHeroAutoRotate();
    };
    heroSection.addEventListener("touchend", finish);
    heroSection.addEventListener("touchcancel", finish);
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
  const entries = [...groups.values()];
  if (seriesCatalogLoaded && Array.isArray(seriesCatalog) && seriesCatalog.length) {
    entries.push({ value: "__series__", isSeries: true, movies: [] });
  }
  return sessionShuffleCategories(entries, (g) => g.value);
}

function buildContinueWatchingMovies() {
  // Watched entries + progress store'dan progress/duration olib, hali tugamagan kinolarni qaytaradi.
  const watched = getWatchedMovieEntries();
  if (!watched.length || !Array.isArray(movies) || !movies.length) return [];
  const progressStore = readWatchProgressStore();
  const result = [];
  for (const entry of watched) {
    if (!entry || !entry.id) continue;
    const key = String(entry.id);
    const progressEntry = progressStore[key];
    const time = Math.max(0, Math.floor(Number(progressEntry?.time || entry.progress || 0)));
    const duration = Math.max(0, Math.floor(Number(progressEntry?.duration || 0)));
    if (time < WATCH_PROGRESS_MIN_SECONDS) continue;
    // Tugagan kinolarni qatordan chiqarish — saveMovieProgress allaqachon clear qiladi,
    // lekin watchedMovieList alohida, qo'shimcha himoya:
    if (duration > 0 && time >= duration - WATCH_PROGRESS_END_GAP) continue;
    const movie = movies.find((m) => String(m?.id) === key);
    if (!movie) continue;
    result.push({ movie, time, duration });
    if (result.length >= 12) break;
  }
  return result;
}

function createContinueWatchingCard({ movie, time, duration }) {
  const card = document.createElement("article");
  card.className = "movie-card continue-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${movie.title} - ${formatPlaybackTime(time)} dan davom etish`);
  const poster = getPosterImage(movie) || "";
  const posterAttr = poster ? ` style="background-image:url('${poster.replaceAll("'", "%27")}')"` : "";
  const pct = duration > 0 ? Math.min(98, Math.max(2, Math.round((time / duration) * 100))) : 8;
  card.innerHTML = `
    <span class="poster"${posterAttr}>
      <span class="continue-card__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
      </span>
      <span class="continue-card__progress" aria-hidden="true">
        <span class="continue-card__progress-fill" style="width:${pct}%"></span>
      </span>
    </span>
    <span class="card-copy">
      <h2>${escapeHtml(movie.title)}</h2>
      <p class="card-meta"><span class="card-meta__genre">${escapeHtml(formatPlaybackTime(time))} dan davom</span></p>
    </span>
  `;
  card.addEventListener("click", () => openMovie(movie));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMovie(movie);
    }
  });
  return card;
}

function renderContinueWatchingRow() {
  const items = buildContinueWatchingMovies();
  if (!items.length) return false;
  const section = document.createElement("section");
  section.className = "category-row category-row--continue";
  section.innerHTML = `
    <header class="category-row__head">
      <h3 class="category-row__title">Davom ettirish</h3>
    </header>
    <div class="category-row__list" role="list"></div>
  `;
  const list = section.querySelector(".category-row__list");
  for (const item of items) {
    list.append(createContinueWatchingCard(item));
  }
  grid.append(section);
  return true;
}

function renderHomeRows() {
  // Birinchi: "Davom ettirish" qatori (agar foydalanuvchi yarmida qoldirgan kinolari bo'lsa).
  const continueRendered = renderContinueWatchingRow();
  const groups = buildHomeCategoryGroups();
  const moreLabel = plainLabel(t("categories"));
  for (const group of groups) {
    if (group.isSeries) {
      renderHomeSeriesRow();
      continue;
    }
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
  return groups.length + (continueRendered ? 1 : 0);
}

function renderHomeSeriesRow() {
  if (!Array.isArray(seriesCatalog) || !seriesCatalog.length) return;
  const ordered = sessionShuffleCategories([...seriesCatalog], (s) => s.id);
  const section = document.createElement("section");
  section.className = "category-row";
  section.innerHTML = `
    <header class="category-row__head">
      <h3 class="category-row__title">Seriallar</h3>
      <button class="category-row__more" type="button" aria-label="Seriallar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="9 6 15 12 9 18"></polyline>
        </svg>
      </button>
    </header>
    <div class="category-row__list" role="list"></div>
  `;
  const list = section.querySelector(".category-row__list");
  const shown = ordered.slice(0, HOME_ROW_PREVIEW_LIMIT);
  for (const series of shown) {
    list.append(createSeriesCard(series));
  }
  if (ordered.length > HOME_ROW_PREVIEW_LIMIT) {
    const moreCard = document.createElement("button");
    moreCard.type = "button";
    moreCard.className = "movie-card movie-card--more";
    moreCard.setAttribute("aria-label", plainLabel(t("seeMore")));
    moreCard.innerHTML = `
      <span class="more-card__inner">
        <span class="more-card__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><polyline points="9 6 15 12 9 18"></polyline></svg>
        </span>
        <span class="more-card__label">${escapeHtml(plainLabel(t("seeMore")))}</span>
      </span>
    `;
    moreCard.addEventListener("click", () => openSeriesListView());
    list.append(moreCard);
  }
  section.querySelector(".category-row__more").addEventListener("click", () => openSeriesListView());
  grid.append(section);
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

function renderSkeletonHomeRows() {
  // 3 ta soxta category row, har biri 6 ta skeleton card.
  const ROWS = 3;
  const CARDS = 6;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < ROWS; i += 1) {
    const section = document.createElement("section");
    section.className = "category-row category-row--skeleton";
    section.setAttribute("aria-hidden", "true");
    const cards = Array.from({ length: CARDS }, () => `
      <div class="movie-card movie-card--skeleton" role="listitem">
        <div class="movie-card__poster skeleton-shimmer"></div>
        <div class="movie-card__title-line skeleton-shimmer"></div>
      </div>
    `).join("");
    section.innerHTML = `
      <header class="category-row__head">
        <div class="skeleton-shimmer skeleton-title"></div>
      </header>
      <div class="category-row__list category-row__list--skeleton" role="list">${cards}</div>
    `;
    frag.append(section);
  }
  grid.append(frag);
}

function renderMovies() {
  const isHomeView = activeFilter === "all" && activeCategory === "all" && !query;
  const isCategoryPage = activeFilter === "all" && activeCategory !== "all" && !query;
  const isFavoritesPage = activeFilter === "favorites" && !query;
  grid.innerHTML = "";
  grid.classList.toggle("is-category-page", isCategoryPage || isFavoritesPage);
  grid.classList.toggle("is-loading", movieLoadState === "loading");

  if (isHomeView && movieLoadState === "ready") {
    grid.classList.add("is-home");
    if (!seriesCatalogLoaded) loadSeriesCatalog();
    const rowCount = renderHomeRows();
    updateEmptyState(rowCount > 0 ? getViewerMovies() : []);
  } else if (movieLoadState === "loading") {
    // Skeleton: home/category/favorites — barchasi loading paytida shimmerlar.
    grid.classList.toggle("is-home", isHomeView);
    if (isHomeView) {
      renderSkeletonHomeRows();
    } else {
      // Category yoki favorites loading paytida flat skeleton grid.
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 9; i += 1) {
        const card = document.createElement("div");
        card.className = "movie-card movie-card--skeleton";
        card.setAttribute("aria-hidden", "true");
        card.innerHTML = `
          <div class="movie-card__poster skeleton-shimmer"></div>
          <div class="movie-card__title-line skeleton-shimmer"></div>
        `;
        frag.append(card);
      }
      grid.append(frag);
    }
    updateEmptyState([]);
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

// === Telegram BackButton stack manager ===
// Har bir ochilgan "view" stack'ga yoziladi. BackButton stack bo'sh emas
// bo'lganda paydo bo'ladi. Bosilganda — eng so'nggi view yopiladi.
const tgBackStack = [];
function tgBackRegister(id, closeFn) {
  const i = tgBackStack.findIndex((v) => v.id === id);
  if (i !== -1) tgBackStack.splice(i, 1);
  tgBackStack.push({ id, closeFn });
  tgBackButtonSync();
}
function tgBackUnregister(id) {
  const i = tgBackStack.findIndex((v) => v.id === id);
  if (i !== -1) {
    tgBackStack.splice(i, 1);
    tgBackButtonSync();
  }
}
function tgBackButtonSync() {
  const bb = tg?.BackButton;
  if (!bb) return;
  try {
    if (tgBackStack.length > 0) bb.show?.();
    else bb.hide?.();
  } catch (_) {}
}
(function ensureTgBackClickHandler() {
  if (!tg?.BackButton?.onClick) return;
  try {
    tg.BackButton.onClick(() => {
      const last = tgBackStack[tgBackStack.length - 1];
      if (!last) return;
      try { haptic.tap(); } catch (_) {}
      try { last.closeFn(); } catch (_) {}
    });
  } catch (_) {}
})();

// === Kino modali "Do'stga ulashish" tugmasi (poster ustida, o'ng tepada) ===
const SHARE_WEBAPP_URL = "https://kino-telegram-mini-app.vercel.app";

function buildShareUrl(movie) {
  const code = String(movie?.code || movie?.id || "").trim();
  const appLink = code ? `${SHARE_WEBAPP_URL}?movie=${encodeURIComponent(code)}` : SHARE_WEBAPP_URL;
  const title = String(movie?.title || "Kino").trim();
  const codeText = code ? `\n\nKod: ${code}` : "";
  const text = `🎬 ${title}${codeText}\n\nMY PLAYLIST mini-ilovasida tomosha qiling:`;
  return `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent(text)}`;
}

function shareActiveMovie() {
  const movie = activeMovie;
  if (!movie) return;
  try { haptic.medium(); } catch (_) {}
  const url = buildShareUrl(movie);
  try {
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank", "noopener");
  } catch (_) {
    window.open(url, "_blank", "noopener");
  }
}

document.getElementById("modalShareButton")?.addEventListener("click", (e) => {
  e.preventDefault();
  shareActiveMovie();
});

// === Resume prompt: "X:XX dan davom" + "Boshidan" ===
const watchActionsEl = document.getElementById("watchActions");
const watchResumeBadge = document.getElementById("watchResumeBadge");
const watchRestartButton = document.getElementById("watchRestartButton");

function syncResumeUiForMovie(movie) {
  const seconds = Math.max(0, Math.floor(Number(getMovieProgressSeconds(movie)) || 0));
  const hasResume = seconds >= WATCH_PROGRESS_MIN_SECONDS;
  if (watchActionsEl) watchActionsEl.classList.toggle("has-resume", hasResume);
  if (watchResumeBadge) {
    if (hasResume) {
      watchResumeBadge.textContent = formatPlaybackTime(seconds);
      watchResumeBadge.hidden = false;
    } else {
      watchResumeBadge.textContent = "";
      watchResumeBadge.hidden = true;
    }
  }
  if (watchRestartButton) watchRestartButton.hidden = !hasResume;
  if (watchButton) {
    watchButton.setAttribute(
      "aria-label",
      hasResume ? `Davom etish (${formatPlaybackTime(seconds)})` : "Tomosha qilish",
    );
  }
}

watchRestartButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!activeMovie) return;
  try { haptic.medium(); } catch (_) {}
  // Resume vaqtini bekor qilish — video boshidan ochiladi.
  // Asl progress saqlanadi (movie tugagach yana yangilanadi).
  openVideoPlayer(activeMovie, { startFromBeginning: true });
});

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
  // Resume holatini ko'rsatish: agar foydalanuvchi bu kinoni yarmida qoldirgan bo'lsa
  // — "X:XX dan davom" badge'i va "Boshidan" tugmasi paydo bo'ladi.
  syncResumeUiForMovie(movie);
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
  tgBackRegister("movie-modal", () => { try { movieModal.close(); } catch (_) {} });
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

function updateWatermarkPosition() {
  const video = videoMount ? videoMount.querySelector("video") : null;
  if (!video || !videoPlayer) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  const cw = videoMount.clientWidth || window.innerWidth;
  const ch = videoMount.clientHeight || window.innerHeight;
  const scale = Math.min(cw / vw, ch / vh);
  const renderedH = vh * scale;
  const renderedW = vw * scale;
  const bandTop = Math.round((ch - renderedH) / 2);
  const bandLeft = Math.round((cw - renderedW) / 2);
  videoPlayer.style.setProperty("--video-band-top", bandTop + "px");
  videoPlayer.style.setProperty("--video-band-left", bandLeft + "px");
}

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
    updateWatermarkPosition();
    scheduleCodecCheck(video, movie, 3000);
  });
  video.addEventListener("resize", () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) hideCodecError();
    updateWatermarkPosition();
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

  const sourceUrl = videoUrl || "";
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
    setVideoLoading(false);
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

  renderVideoSource("", movie, { isFallback: true, fallbackMessage });
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

async function openVideoPlayer(movie, options = {}) {
  if (!movie) return;
  stopMoviePreload();
  hideCodecError();
  const requestId = ++activeVideoRequest;
  activeMovie = movie;
  // startFromBeginning=true bo'lsa, resume vaqti olinmaydi (boshidan).
  pendingResumeTime = options?.startFromBeginning ? 0 : getMovieProgressSeconds(movie);
  markMovieWatched(movie, pendingResumeTime);
  syncWatchedCount();
  if (movieModal.open) movieModal.close();
  videoTitle.textContent = movie.title || "Kino";
  videoPlayer.hidden = false;
  document.body.classList.add("is-player-open");
  tgBackRegister("video-player", () => { try { closeVideoPlayer(); } catch (_) {} });
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
  tgBackUnregister("video-player");
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
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  localStorage.setItem(THEME_EXPLICIT_KEY, "1");
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

// ===== Music modul: lazy-loader + stubs =====
// Musiqa kodi alohida webapp/music.js fayliga ko'chirildi va faqat kerak bo'lganda yuklanadi.
// Bu birinchi yuklashda parse vaqtini ~50–100 ms tezlashtiradi.
let __musicModulePromise = null;
function ensureMusicModule() {
  if (window.__music) return Promise.resolve(window.__music);
  if (__musicModulePromise) return __musicModulePromise;
  __musicModulePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/static/music.js?v=20260525-musicsplit01";
    script.onload = () => resolve(window.__music);
    script.onerror = (err) => { __musicModulePromise = null; reject(err); };
    document.head.appendChild(script);
  });
  return __musicModulePromise;
}

// Stub'lar: musiqa moduli yuklanmasdan oldin ham nomi bilan chaqirsa bo'ladi.
// Open* lar moduli yuklab, keyin chaqiradi. Close* lar — agar modul yuklanmagan bo'lsa, no-op.
function openMusicView() { ensureMusicModule().then((m) => m?.openMusicView?.()).catch(() => {}); }
function closeMusicView() { window.__music?.closeMusicView?.(); }
function openAllArtists() { ensureMusicModule().then((m) => m?.openAllArtists?.()).catch(() => {}); }
function closeAllArtists() { window.__music?.closeAllArtists?.(); }
function openAllSongs() { ensureMusicModule().then((m) => m?.openAllSongs?.()).catch(() => {}); }
function closeAllSongs() { window.__music?.closeAllSongs?.(); }
function openArtistDetail(name) { ensureMusicModule().then((m) => m?.openArtistDetail?.(name)).catch(() => {}); }
function closeArtistDetail() { window.__music?.closeArtistDetail?.(); }
function playMusicTrack(track) { ensureMusicModule().then((m) => m?.playMusicTrack?.(track)).catch(() => {}); }
function scrollMusicTop() { window.__music?.scrollMusicTop?.(); }
function renderMusicList() { window.__music?.renderMusicList?.(); }

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

function buildSeriesCategoryCard() {
  const seriesCat = categoriesData.find((c) => String(c?.name || "").toLowerCase() === "seriallar");
  const bg = seriesCat && seriesCat.image
    ? `style="background-image:url('${escapeAttr(seriesCat.image).replaceAll("'", "%27")}')"`
    : "";
  const label = bg ? "" : `<span class="category-card__label">Seriallar</span>`;
  return `<button class="category-card category-card--series" type="button" data-series-entry="1" aria-label="Seriallar" ${bg}>${label}</button>`;
}

function renderCategoriesGrid() {
  if (!categoriesGrid) return;
  if (categoriesEmpty) categoriesEmpty.hidden = true;
  const cards = categoriesData
    .filter((c) => String(c?.name || "").toLowerCase() !== "seriallar")
    .map((c) => {
      const bg = c.image ? `style="background-image:url('${escapeAttr(c.image).replaceAll("'", "%27")}')"` : "";
      return `<button class="category-card" type="button" data-category-name="${escapeAttr(c.name)}" aria-label="${escapeAttr(c.name)}" ${bg}></button>`;
    });
  categoriesGrid.innerHTML = [buildSeriesCategoryCard(), ...cards].join("");
}

function openCategoriesView() {
  if (!categoriesView) return;
  closeMusicView();
  if (seriesListView) seriesListView.hidden = true;
  if (seriesDetailView) seriesDetailView.hidden = true;
  document.body.classList.remove("is-series-list", "is-series-detail");
  categoriesView.hidden = false;
  document.body.classList.add("is-categories");
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.querySelectorAll(".bottom-bar [data-action='categories-view']").forEach((b) => b.classList.add("is-active"));
  document.querySelectorAll(".bottom-bar [data-filter='all'], .bottom-bar [data-action='favorites']").forEach((b) => b.classList.remove("is-active"));
  if (!categoriesLoaded) loadCategoriesCatalog();
  tgBackRegister("categories-view", () => { try { closeCategoriesView(); setFilter("all"); } catch (_) {} });
}

function closeCategoriesView() {
  if (!categoriesView) return;
  categoriesView.hidden = true;
  document.body.classList.remove("is-categories");
  document.querySelectorAll(".bottom-bar [data-action='categories-view']").forEach((b) => b.classList.remove("is-active"));
  tgBackUnregister("categories-view");
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
  if (event.target.closest("[data-series-entry]")) {
    openSeriesListView();
    return;
  }
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
  tgBackRegister("category-detail", () => { try { closeCategoryDetailView(); } catch (_) {} });
}

function closeCategoryDetailView({ goHome = false } = {}) {
  if (!categoryDetailView) return;
  categoryDetailView.hidden = true;
  document.body.classList.remove("is-category-detail");
  tgBackUnregister("category-detail");
  if (goHome) return;
  if (categoriesView) {
    categoriesView.hidden = false;
    document.body.classList.add("is-categories");
  }
}

categoryDetailBack?.addEventListener("click", () => closeCategoryDetailView());

// ===== Seriallar (series) =====
const seriesListView = document.getElementById("seriesListView");
const seriesListGrid = document.getElementById("seriesListGrid");
const seriesListEmpty = document.getElementById("seriesListEmpty");
const seriesDetailView = document.getElementById("seriesDetailView");
const seriesDetailTitle = document.getElementById("seriesDetailTitle");
const seriesDetailBody = document.getElementById("seriesDetailBody");
let seriesCatalog = [];
let seriesCatalogLoaded = false;
let seriesCatalogLoading = false;
let activeSeries = null;

const NATURAL_SORT_COLLATOR = new Intl.Collator("uz", { numeric: true, sensitivity: "base" });

function stripFileExtension(value) {
  return String(value || "").replace(/\.[a-z0-9]{2,5}$/i, "");
}

function normalizeNaturalSortText(value) {
  return stripFileExtension(value)
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEpisodeSortText(entry) {
  return normalizeNaturalSortText(
    entry?.title
    || entry?.defaultTitle
    || entry?.fileName
    || "",
  );
}

function compareSeriesEpisodes(left, right) {
  const byTitle = NATURAL_SORT_COLLATOR.compare(getEpisodeSortText(left), getEpisodeSortText(right));
  if (byTitle) return byTitle;
  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function normalizeSeriesEntry(raw) {
  const episodes = Array.isArray(raw?.episodes) ? raw.episodes : [];
  const orderedEpisodes = episodes.map((ep, i) => ({
    id: String(ep?.id || ""),
    title: String(ep?.title || `Qism ${i + 1}`).trim(),
    defaultTitle: String(ep?.defaultTitle || ep?.title || `Qism ${i + 1}`).trim(),
    fileName: String(ep?.fileName || "").trim(),
    mimeType: String(ep?.mimeType || "").trim(),
    cdnUrl: String(ep?.cdnUrl || "").trim(),
  })).filter((ep) => ep.id).sort(compareSeriesEpisodes);
  return {
    id: String(raw?.id || raw?.folderId || ""),
    title: String(raw?.title || raw?.folderName || "Serial").trim(),
    description: String(raw?.description || "").trim(),
    posterImage: resolveAppUrl(firstUsableImage(raw?.posterImage, raw?.poster)),
    episodeCount: Number(raw?.episodeCount || orderedEpisodes.length || 0),
    episodes: orderedEpisodes,
  };
}

async function loadSeriesCatalog() {
  if (seriesCatalogLoading) return;
  seriesCatalogLoading = true;
  try {
    const res = await fetch("/api/series", { cache: "no-store" });
    const json = await res.json();
    const parsed = (Array.isArray(json) ? json : []).map(normalizeSeriesEntry).filter((s) => s.id);
    seriesCatalog = sessionShuffleCategories(parsed, (s) => s.id);
  } catch (_) {
    seriesCatalog = [];
  }
  seriesCatalogLoaded = true;
  seriesCatalogLoading = false;
  renderSeriesListGrid();
  // Asosiy sahifa ochiq bo'lsa, "Seriallar" qatori ko'rinishi uchun qayta render
  try {
    const onHome = activeFilter === "all" && activeCategory === "all" && !query;
    if (onHome && typeof renderMovies === "function") renderMovies();
  } catch (_) {}
}

function createSeriesCard(series) {
  const card = document.createElement("article");
  card.className = "movie-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", series.title);
  const poster = String(series.posterImage || "");
  const safeSeriesPoster = poster.startsWith("blob:") ? "" : poster;
  const posterAttr = safeSeriesPoster ? ` style="background-image:url('${safeSeriesPoster.replaceAll("'", "%27")}')"` : "";
  card.innerHTML = `
    <span class="poster"${posterAttr}>
      <span class="card-badges">
        <span class="badge">${escapeHtml(String(series.episodeCount))} qism</span>
      </span>
    </span>
    <span class="card-copy">
      <h2>${escapeHtml(series.title)}</h2>
      <p class="card-meta"><span class="card-meta__genre">Serial</span></p>
    </span>
  `;
  const open = () => openSeriesDetailView(series);
  card.addEventListener("click", open);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return card;
}

function renderSeriesListGrid() {
  if (!seriesListGrid) return;
  seriesListGrid.innerHTML = "";
  if (!seriesCatalog.length) {
    if (seriesListEmpty) {
      seriesListEmpty.hidden = false;
      seriesListEmpty.textContent = "Seriallar hali qo'shilmagan.";
    }
    return;
  }
  if (seriesListEmpty) seriesListEmpty.hidden = true;
  for (const series of seriesCatalog) {
    try { seriesListGrid.append(createSeriesCard(series)); } catch (_) {}
  }
}

function openSeriesListView() {
  if (!seriesListView) return;
  if (categoriesView) categoriesView.hidden = true;
  if (seriesDetailView) seriesDetailView.hidden = true;
  seriesListView.hidden = false;
  document.body.classList.add("is-series-list");
  document.body.classList.remove("is-series-detail", "is-categories");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (!seriesCatalogLoaded) {
    if (seriesListGrid) seriesListGrid.innerHTML = "";
    if (seriesListEmpty) {
      seriesListEmpty.hidden = false;
      seriesListEmpty.textContent = "Yuklanmoqda...";
    }
    loadSeriesCatalog();
  } else {
    renderSeriesListGrid();
  }
  tgBackRegister("series-list", () => {
    try {
      closeSeriesListView();
      if (categoriesView) { categoriesView.hidden = false; document.body.classList.add("is-categories"); }
    } catch (_) {}
  });
}

function closeSeriesListView() {
  if (!seriesListView) return;
  seriesListView.hidden = true;
  document.body.classList.remove("is-series-list");
  tgBackUnregister("series-list");
}

function openSeriesDetailView(series) {
  if (!seriesDetailView || !series) return;
  const eps = Array.isArray(series.episodes) ? [...series.episodes].sort(compareSeriesEpisodes) : [];
  activeSeries = { ...series, episodes: eps };
  if (seriesDetailTitle) seriesDetailTitle.textContent = activeSeries.title;
  const poster = String(series.posterImage || "");
  const safeDetailPoster = poster.startsWith("blob:") ? "" : poster;
  const posterStyleAttr = safeDetailPoster ? `background-image:url('${safeDetailPoster.replaceAll("'", "%27")}')` : "";
  const epHtml = eps.length
    ? `<ol class="episode-list">${eps.map((ep, i) => `
        <li><button class="episode-row" type="button" data-ep-index="${i}">
          <span class="episode-row__num">${i + 1}</span>
          <span class="episode-row__title">${escapeHtml(ep.title || ("Qism " + (i + 1)))}</span>
          <svg class="episode-row__play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
        </button></li>`).join("")}</ol>`
    : `<p class="episode-empty">Bu serialda hali qism yo'q.</p>`;
  if (seriesDetailBody) {
    seriesDetailBody.innerHTML = `
      <div class="series-hero">
        <div class="series-hero__poster" style="${posterStyleAttr}"></div>
        <div class="series-hero__info">
          <p class="series-hero__count">${escapeHtml(String(eps.length))} ta qism</p>
          ${series.description ? `<p class="series-hero__desc">${escapeHtml(series.description)}</p>` : ""}
        </div>
      </div>
      ${epHtml}
    `;
  }
  if (seriesListView) seriesListView.hidden = true;
  seriesDetailView.hidden = false;
  document.body.classList.add("is-series-detail");
  document.body.classList.remove("is-series-list");
  window.scrollTo({ top: 0, behavior: "smooth" });
  tgBackRegister("series-detail", () => { try { closeSeriesDetailView(); } catch (_) {} });
}

function closeSeriesDetailView() {
  if (!seriesDetailView) return;
  seriesDetailView.hidden = true;
  document.body.classList.remove("is-series-detail");
  tgBackUnregister("series-detail");
  if (seriesListView) {
    seriesListView.hidden = false;
    document.body.classList.add("is-series-list");
  }
}

function playSeriesEpisode(series, episode, index) {
  if (!episode || !episode.id) return;
  const epMovie = {
    id: `series-${series.id}-ep-${episode.id}`,
    title: `${series.title} — ${episode.title || ("Qism " + (index + 1))}`,
    driveFileId: episode.id,
    fileId: episode.id,
    fileName: episode.fileName || "",
    mimeType: episode.mimeType || "video/mp4",
    cdnUrl: episode.cdnUrl || "",
    posterImage: series.posterImage || "",
    description: series.description || "",
  };
  openVideoPlayer(epMovie);
}

seriesDetailBody?.addEventListener("click", (event) => {
  const row = event.target.closest(".episode-row");
  if (!row || !activeSeries) return;
  const index = Number(row.dataset.epIndex);
  const episode = activeSeries.episodes[index];
  if (episode) playSeriesEpisode(activeSeries, episode, index);
});

document.getElementById("seriesListBack")?.addEventListener("click", () => {
  closeSeriesListView();
  if (categoriesView) {
    categoriesView.hidden = false;
    document.body.classList.add("is-categories");
  }
});

document.getElementById("seriesDetailBack")?.addEventListener("click", () => closeSeriesDetailView());

document.querySelectorAll(".bottom-bar [data-filter='all'], .bottom-bar [data-action='favorites']").forEach((b) => {
  b.addEventListener("click", () => {
    closeSeriesDetailView();
    closeSeriesListView();
  });
});

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
    // is-music klassi qo'shilgan bo'lsa, music moduli allaqachon yuklangan.
    window.__music?.setQuery?.(query);
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
    tgBackRegister("sidebar", () => { try { setSidebarOpen(false); } catch (_) {} });
  } else {
    tgBackUnregister("sidebar");
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
  const id = item.dataset.musicHistory;
  // Musiqa moduli yuklanmagan bo'lsa — yuklab keyin chaqiramiz.
  ensureMusicModule().then((m) => {
    let track = m?.findTrackById?.(id);
    if (!track) {
      const entry = getMusicHistoryEntries().find((e) => e.youtubeId === id);
      if (entry) track = { youtubeId: entry.youtubeId, title: entry.title, artist: entry.artist };
    }
    if (track) {
      try { profileModal.close(); } catch (_) {}
      m?.playMusicTrack?.(track);
    }
  }).catch(() => {});
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

window.addEventListener("resize", () => { if (intendedFullscreen) refreshLandscapeView(); updateWatermarkPosition(); });

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
    // SW + CDN SWR ishlatadi — `no-store` ni olib tashladik, ETag/Cache-Control faollashadi.
    const response = await fetch(buildApiUrl("/api/movies"), {
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
// Faqat sahifa ko'rinib turganida poll qilamiz — batareya tejaladi.
let moviesPollTimer = 0;
function startMoviesPolling() {
  const tick = () => { if (!document.hidden) silentReloadMovies(); };
  const start = () => {
    if (moviesPollTimer) return;
    moviesPollTimer = window.setInterval(tick, 60000);
  };
  const stop = () => {
    if (!moviesPollTimer) return;
    window.clearInterval(moviesPollTimer);
    moviesPollTimer = 0;
  };
  start();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stop();
    } else {
      // Sahifa qayta ochildi — darrov yangilab, keyin poll davom etadi.
      silentReloadMovies();
      start();
    }
  });
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

let pendingAd = null;

async function loadAppSettings() {
  let timeoutId = 0;
  try {
    await resolveApiBase();
    const controller = new AbortController();
    timeoutId = window.setTimeout(() => controller.abort(), 3500);
    const response = await fetch(buildApiUrl("/api/settings"), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.ad && data.ad.enabled && data.ad.imageUrl) {
        pendingAd = data.ad;
      } else {
        pendingAd = null;
      }
    }
  } catch (e) {
    // Ignore error, use default
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function showAdModal(ad) {
  const modal = document.getElementById("adModal");
  const img = document.getElementById("adModalImage");
  const link = document.getElementById("adModalLink");
  const cta = document.getElementById("adModalCta");
  if (!modal || !img || !ad || !ad.imageUrl) return;

  img.src = ad.imageUrl;
  img.alt = ad.buttonText || "Reklama";

  if (ad.linkUrl) {
    link.href = ad.linkUrl;
    link.setAttribute("data-has-link", "1");
  } else {
    link.removeAttribute("href");
    link.removeAttribute("data-has-link");
  }

  if (ad.linkUrl && (ad.buttonText || "").trim()) {
    cta.innerHTML = '<span class="ad-modal__cta-label"></span><span class="ad-modal__cta-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>';
    cta.querySelector('.ad-modal__cta-label').textContent = ad.buttonText.trim();
    cta.href = ad.linkUrl;
    cta.hidden = false;
  } else {
    cta.hidden = true;
    cta.removeAttribute("href");
  }

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("ad-modal-open");

  const openLink = (url) => {
    try {
      if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (_) {
      window.open(url, "_blank", "noopener");
    }
  };

  const close = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("ad-modal-open");
  };

  modal.querySelectorAll("[data-ad-close]").forEach((el) => {
    el.addEventListener("click", (e) => { e.preventDefault(); close(); }, { once: true });
  });

  if (link.getAttribute("data-has-link")) {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openLink(ad.linkUrl);
      close();
    }, { once: true });
  } else {
    link.addEventListener("click", (e) => { e.preventDefault(); }, { once: true });
  }

  if (!cta.hidden) {
    cta.addEventListener("click", (e) => {
      e.preventDefault();
      openLink(ad.linkUrl);
      close();
    }, { once: true });
  }
}

let splashHideRequested = false;
let splashAlreadyHidden = false;

function hideSplashNow() {
  if (splashAlreadyHidden) return;
  splashAlreadyHidden = true;
  const splashScreen = document.getElementById("splashScreen");
  const appShell = document.getElementById("appShell");
  if (!splashScreen || !appShell) {
    if (pendingAd) { try { showAdModal(pendingAd); } catch (_) {} pendingAd = null; }
    return;
  }
  splashScreen.classList.add("fade-out");
  appShell.style.opacity = "1";
  appShell.style.pointerEvents = "auto";
  setTimeout(() => {
    splashScreen.classList.add("hidden");
    if (pendingAd) { try { showAdModal(pendingAd); } catch (_) {} pendingAd = null; }
  }, 500);
}

// Splash: minimum 800ms (brend ko'rinishi uchun), maksimum 1500ms.
// Movies tayyor bo'lsa min vaqtdan keyin darrov yopiladi.
function initSplashScreen() {
  const MIN_MS = 800;
  const MAX_MS = 1500;
  const startedAt = Date.now();

  const tryHide = () => {
    if (splashHideRequested) return;
    splashHideRequested = true;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, MIN_MS - elapsed);
    setTimeout(hideSplashNow, wait);
  };

  setTimeout(tryHide, MAX_MS);
  return { tryHide };
}

// === Deep link: ?movie=CODE yoki Telegram startapp parametri orqali kelganda
// ko'rsatilgan kinoni avtomatik ochish (movie code yoki ID match). ===
function findMovieByDeepLinkParam(rawParam) {
  const param = String(rawParam || "").trim();
  if (!param || !Array.isArray(movies) || !movies.length) return null;
  // "movie_<code>" yoki "movie-<code>" prefiks bo'lsa olib tashlash.
  const cleaned = param.replace(/^movie[_-]/i, "").trim();
  if (!cleaned) return null;
  const lc = cleaned.toLowerCase();
  return movies.find((m) => {
    const code = String(m?.code || "").toLowerCase();
    const id = String(m?.id || "").toLowerCase();
    return code === lc || id === lc;
  }) || null;
}

function getDeepLinkMovieParam() {
  // 1) URL query: ?movie=CODE
  const fromQuery = String(pageParams.get("movie") || "").trim();
  if (fromQuery) return fromQuery;
  // 2) Telegram startapp: t.me/bot/app?startapp=movie_CODE
  const fromTg = String(tg?.initDataUnsafe?.start_param || "").trim();
  if (fromTg) return fromTg;
  return "";
}

let deepLinkHandled = false;
function tryHandleDeepLink() {
  if (deepLinkHandled) return;
  const param = getDeepLinkMovieParam();
  if (!param) { deepLinkHandled = true; return; }
  const movie = findMovieByDeepLinkParam(param);
  if (!movie) return; // movies hali yuklanmagan bo'lishi mumkin — keyingi chaqirig'ida urinamiz.
  deepLinkHandled = true;
  // Splash/animatsiyalar tugashi uchun kichik kechikish.
  setTimeout(() => {
    try { openMovie(movie); } catch (_) {}
  }, 300);
}

async function initApp() {
  await loadAppSettings();
  const splash = initSplashScreen();
  // Movies tayyor bo'lishi bilanoq splash yopiladi (min 800ms cheklov bilan).
  loadMovies().finally(() => {
    try { splash?.tryHide?.(); } catch (_) {}
    try { tryHandleDeepLink(); } catch (_) {}
  });
  startMoviesPolling();
  loadProgressFromBackend().catch(() => {});
  // Musiqa modulini idle paytda fonda yuklab qo'yamiz — foydalanuvchi
  // birinchi marta musiqa tugmasini bosganda kutmasin.
  const preloadMusic = () => { ensureMusicModule().catch(() => {}); };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(preloadMusic, { timeout: 4000 });
  } else {
    window.setTimeout(preloadMusic, 2500);
  }
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

    // Haptic: bottom-bar — selection (tab almashish), boshqalar — tap.
    if (target.classList.contains('bottom-bar__button')) {
      haptic.select();
    } else {
      haptic.tap();
    }
  }, { passive: true });
})();
// === /nav-icon-click-anim ===

// === haptic for key interactions ===
(function attachHapticHooks() {
  // Movie kartochka bosilganda — yengil tap.
  // Wishlist (yurak) — soft. Modal play tugmasi — medium.
  // Lang pill — selection.
  const TAP_SELECTORS = [
    '.movie-card',
    '.hero__play',
    '.hero__info',
    '.modal-close',
    '.watch-button',
    '.player-back-btn',
    '.player-icon-btn',
    '.player-skip-btn',
    '.player-play-btn',
    '.music-fullplayer__ctl',
    '.music-fullplayer__close',
    '.music-fullplayer__like',
    '.mini-player__btn',
    '.ad-modal__close',
    '.ad-modal__cta',
    '.profile-history__clear',
    '.category-detail-view__back',
    '[data-music-fp-toggle]',
    '[data-music-fp-prev]',
    '[data-music-fp-next]',
    '[data-music-fp-shuffle]',
    '[data-music-fp-repeat]',
  ].join(', ');
  const SELECT_SELECTORS = '.lang-pill, .theme-switch, .reaction-btn, [data-reaction]';
  const MEDIUM_SELECTORS = '.watch-button, .hero__play, [data-music-fp-toggle], .player-play-btn';
  const SOFT_SELECTORS = '.wishlist-btn, [data-wishlist-toggle], .music-fullplayer__like';

  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!t || t.nodeType !== 1) return;
    // Modal/overlay sirtidagi bo'sh joy bosilganda haptic kerak emas.
    if (t.matches?.(SOFT_SELECTORS) || t.closest?.(SOFT_SELECTORS)) { haptic.soft(); return; }
    if (t.matches?.(MEDIUM_SELECTORS) || t.closest?.(MEDIUM_SELECTORS)) { haptic.medium(); return; }
    if (t.matches?.(SELECT_SELECTORS) || t.closest?.(SELECT_SELECTORS)) { haptic.select(); return; }
    if (t.matches?.(TAP_SELECTORS) || t.closest?.(TAP_SELECTORS)) { haptic.tap(); return; }
  }, { passive: true, capture: true });
})();
// === /haptic for key interactions ===

// === Pull-to-refresh ===
// Foydalanuvchi sahifa tepasida pastga tortsa, kinolarni yangilash.
(function attachPullToRefresh() {
  // Faqat touch qurilmalarda.
  if (!("ontouchstart" in window)) return;

  const THRESHOLD = 72;            // px — qaytarish chegarasi
  const MAX_PULL = 120;            // px — maksimal cho'zilish
  const RESISTANCE = 0.55;         // tortish "og'irlik" effekti

  const indicator = document.createElement("div");
  indicator.className = "ptr-indicator";
  indicator.setAttribute("aria-hidden", "true");
  indicator.innerHTML = `<span class="ptr-spinner"></span>`;
  document.body.appendChild(indicator);

  let startY = 0;
  let lastY = 0;
  let pulling = false;
  let refreshing = false;
  let armed = false;

  const setOffset = (px) => {
    indicator.style.transform = `translate3d(-50%, ${Math.min(MAX_PULL, Math.max(0, px))}px, 0)`;
    indicator.style.opacity = String(Math.min(1, px / THRESHOLD));
  };

  const reset = () => {
    indicator.classList.add("ptr-snap");
    indicator.style.transform = "";
    indicator.style.opacity = "";
    setTimeout(() => indicator.classList.remove("ptr-snap"), 320);
  };

  // Scroll'ning ANIQ tepasi (iOS rubber band/momentum'ni hisobga olgan holda).
  const isAtTop = () => {
    const sy = window.scrollY || document.documentElement.scrollTop || document.body?.scrollTop || 0;
    return sy <= 0;
  };

  const cancelPull = () => {
    if (!pulling) return;
    pulling = false;
    armed = false;
    if (!refreshing) reset();
  };

  // Recent scroll activity tracker — momentum/inertial scroll tugashi kutilishi kerak.
  let lastScrollAt = 0;
  const SCROLL_QUIET_MS = 250;
  window.addEventListener("scroll", () => {
    lastScrollAt = Date.now();
    // Agar PTR boshlangan bo'lsa, lekin sahifa scroll qilinyapti — bekor qilish.
    if (pulling && !armed) cancelPull();
  }, { passive: true });

  const onTouchStart = (e) => {
    if (refreshing) return;
    // Faqat sahifa tepasida — boshqa scroll konteynerlar uchun ishlamasin.
    if (!isAtTop()) return;
    // So'nggi scroll faolligi yaqin bo'lsa (momentum/inertia) — kuting.
    if (Date.now() - lastScrollAt < SCROLL_QUIET_MS) return;
    // Modal/dialog/video player ochiq bo'lsa — bekor.
    if (document.body.classList.contains("is-modal-open")
      || document.body.classList.contains("is-player-open")
      || document.body.classList.contains("ad-modal-open")) return;
    // Touch ichki scroll konteyner ustida bo'lsa (modal-content, music-list,
    // category-row__list va h.k.) — PTR ishga tushmasin.
    const target = e.target;
    if (target && target.nodeType === 1 && target.closest?.(
      ".modal-content, .modal-poster, .music-list, .music-fullplayer, " +
      ".profile-card, .category-row__list, .music-carousel, " +
      ".category-detail-view__grid, .video-player, .ad-modal, " +
      "input, textarea, select, button, a"
    )) return;
    const t = e.touches?.[0];
    if (!t) return;
    startY = t.clientY;
    lastY = startY;
    pulling = true;
    armed = false;
  };

  const onTouchMove = (e) => {
    if (!pulling || refreshing) return;
    // Har touchmove'da scroll tepada turibdimi tekshirish — armed bo'lguncha.
    if (!armed && !isAtTop()) {
      cancelPull();
      return;
    }
    const t = e.touches?.[0];
    if (!t) return;
    lastY = t.clientY;
    const delta = lastY - startY;
    if (delta <= 0) {
      // Yuqoriga (scroll yo'nalishi) — PTR'ni armed bo'lishidan oldin bekor qilish.
      if (!armed) cancelPull();
      return;
    }
    // Foydalanuvchi haqiqatan pastga tortyapti — endi PTR aktiv.
    if (!armed && delta > 16) armed = true;
    if (!armed) return;
    // Scroll'ni to'xtatish va indicator ko'rsatish.
    e.preventDefault();
    setOffset(delta * RESISTANCE);
  };

  const onTouchEnd = () => {
    if (!pulling) return;
    pulling = false;
    if (refreshing) return;
    const delta = (lastY - startY) * RESISTANCE;
    if (armed && delta >= THRESHOLD) {
      refreshing = true;
      indicator.classList.add("ptr-loading");
      indicator.style.transform = `translate3d(-50%, ${THRESHOLD}px, 0)`;
      indicator.style.opacity = "1";
      try { haptic.medium(); } catch (_) {}
      const refresh = (typeof silentReloadMovies === "function" ? silentReloadMovies : null);
      const done = () => {
        refreshing = false;
        indicator.classList.remove("ptr-loading");
        reset();
        try { haptic.success(); } catch (_) {}
      };
      if (refresh) {
        Promise.resolve(refresh()).catch(() => {}).finally(() => {
          // Min 600ms — foydalanuvchi spinner'ni ko'rsin.
          setTimeout(done, 600);
        });
      } else {
        setTimeout(done, 600);
      }
    } else {
      reset();
    }
  };

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
})();
// === /Pull-to-refresh ===

// === swipe-gestures (revertable: delete this block) ===
// Idle vaqtda init — birinchi paint blok qilinmaydi.
const __initSwipeGestures = function attachSwipeGestures() {
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
};
if ("requestIdleCallback" in window) {
  window.requestIdleCallback(__initSwipeGestures, { timeout: 2000 });
} else {
  setTimeout(__initSwipeGestures, 600);
}
// === /swipe-gestures ===

