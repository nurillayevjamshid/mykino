const tg = window.Telegram?.WebApp;
const DEMO_VIDEO_URL = "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const HERO_ROTATE_INTERVAL_MS = 3000;
const PROD_API_BASE = window.location.protocol === "file:" ? "https://kino-telegram-mini-app.vercel.app" : "";
const API_BASE_STORAGE_KEY = "kino_api_base_v1";
const DEBUG_USER_STORAGE_KEY = "kino_debug_user_v1";
const LOCAL_API_BASES = ["http://127.0.0.1:8080", "http://localhost:8080"];
const MAX_SHARED_POSTER_DATA_URL_LENGTH = 140000;
const MAX_ADMIN_IMAGE_FILE_SIZE = 25000000;
const ADMIN_POSTER_CROP_SIZE = { width: 720, height: 1080 };
const POSTER_COMPRESSION_STEPS = [
  { width: 720, height: 1080, quality: 0.9 },
  { width: 640, height: 960, quality: 0.86 },
  { width: 540, height: 810, quality: 0.82 },
  { width: 420, height: 630, quality: 0.76 },
  { width: 320, height: 480, quality: 0.7 },
  { width: 240, height: 360, quality: 0.62 },
];
const HERO_POSTER_COMPRESSION_STEPS = [
  { width: 1280, height: 720, quality: 0.86 },
  { width: 1080, height: 608, quality: 0.82 },
  { width: 900, height: 506, quality: 0.78 },
  { width: 720, height: 405, quality: 0.74 },
  { width: 560, height: 315, quality: 0.68 },
];
const DEFAULT_DEBUG_ADMIN_USER = {
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
  tg.setHeaderColor("#0f131a");
  tg.setBackgroundColor("#0b1018");
}

const savedTheme = localStorage.getItem("kino_theme") || "dark";
const themeToggle = document.querySelector(".theme-toggle");

const langSelect = document.querySelector(".lang-select");
if (langSelect) {
  langSelect.value = savedLang;
}

const copy = {
  uz: {
    all: "Barchasi",
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
    adminPanel: "Admin panel",
    edit: "Tahrirlash",
    save: "Saqlash",
    saving: "Saqlanmoqda...",
  },
  ru: {
    all: "Все",
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
    adminPanel: "Админ панель",
    edit: "Редактировать",
    save: "Сохранить",
    saving: "Сохраняется...",
  },
  en: {
    all: "All",
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
    adminPanel: "Admin panel",
    edit: "Edit",
    save: "Save",
    saving: "Saving...",
  },
};

const fallbackCopy = {
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
const ADMIN_USER_IDS = new Set([679291909]);
const LOCAL_USER_TRACK_KEY = "kino_local_user_stats_v1";
const TELEGRAM_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";
const DRIVE_STREAM_ERROR_MESSAGE =
  "Tomosha uchun manba tayyorlanmoqda.";
const DRIVE_UNSUPPORTED_FORMAT_MESSAGE =
  "Tomosha uchun player tayyorlanmoqda.";

let movies = [];
let activeFilter = "all";
let activeCategory = "all";
let query = "";
let heroCarouselMovies = [];
let heroCarouselIndex = 0;
let heroCarouselTimer = null;
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
let adminDashboardMovies = [];
let selectedAdminMovieId = "";
let pendingAdminPosterDataUrl = "";
let pendingAdminHeroPosterDataUrl = "";
let pendingAdminPosterSourceDataUrl = "";
let pendingAdminHeroPosterReadyPromise = null;
let hasTrackedTelegramUser = false;

const grid = document.querySelector("#movieGrid");
const emptyState = document.querySelector("#emptyState");
const searchPanel = document.querySelector("#searchPanel");
const searchInput = document.querySelector("#searchInput");
const heroCarousel = document.querySelector("#heroCarousel");
const heroCarouselTrack = document.querySelector("#heroCarouselTrack");
const heroCarouselTitle = document.querySelector("#heroCarouselTitle");
const heroCarouselDots = document.querySelector("#heroCarouselDots");
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
const profileAdminButton = document.querySelector(".profile-admin-button");
const adminModal = document.querySelector("#adminModal");
const adminCard = document.querySelector(".admin-card");
const adminEditModal = document.querySelector("#adminEditModal");
const adminMovieForm = document.querySelector("#adminMovieForm");
const adminMovieList = document.querySelector("#adminMovieList");
const adminMovieCount = document.querySelector("#adminMovieCount");
const adminUsersCount = document.querySelector("#adminUsersCount");
const adminReadyCount = document.querySelector("#adminReadyCount");
const adminLibraryHint = document.querySelector("#adminLibraryHint");
const adminHeaderHint = document.querySelector("#adminHeaderHint");
const adminLibraryOpen = document.querySelector("#adminLibraryOpen");
const adminListPage = document.querySelector("#adminListPage");
const adminListBack = document.querySelector("#adminListBack");
const adminEditorTitle = document.querySelector("#adminEditorTitle");
const adminEditorMeta = document.querySelector("#adminEditorMeta");
const adminMovieIdInput = document.querySelector("#adminMovieId");
const adminTitleInput = document.querySelector("#adminTitle");
const adminGenreSelect = document.querySelector("#adminGenreSelect");
const adminGenreCustomInput = document.querySelector("#adminGenreCustom");
const adminPosterInput = document.querySelector("#adminPoster");
const adminPosterFileInput = document.querySelector("#adminPosterFile");
const adminPosterCrop = document.querySelector("#adminPosterCrop");
const adminPosterCropPreview = document.querySelector("#adminPosterCropPreview");
const adminPosterZoomInput = document.querySelector("#adminPosterZoom");
const adminPosterXInput = document.querySelector("#adminPosterX");
const adminPosterYInput = document.querySelector("#adminPosterY");
const adminHeroPosterInput = document.querySelector("#adminHeroPoster");
const adminHeroPosterFileInput = document.querySelector("#adminHeroPosterFile");
const adminHeroPosterFileStatus = document.querySelector("#adminHeroPosterFileStatus");
const adminRatingInput = document.querySelector("#adminRating");
const adminQualityInput = document.querySelector("#adminQuality");
const adminHeroFeaturedInput = document.querySelector("#adminHeroFeatured");
const adminDescriptionInput = document.querySelector("#adminDescription");
const adminSaveButton = document.querySelector("#adminSaveButton");
const adminResetButton = document.querySelector("#adminResetButton");
const videoPlayer = document.querySelector("#videoPlayer");
const videoMount = document.querySelector("#videoMount");
const videoLoading = document.querySelector("#videoLoading");
const videoFallback = document.querySelector("#videoFallback");
const videoFallbackText = document.querySelector("#videoFallbackText");
const videoExternalLink = document.querySelector("#videoExternalLink");
const videoTitle = document.querySelector("#videoTitle");
const videoSourceLabel = document.querySelector("#videoSourceLabel");
const videoControls = document.querySelector("#videoControls");
const videoCenterAction = document.querySelector("#videoCenterAction");
const videoPrevButton = document.querySelector("#videoPrevButton");
const videoBackButton = document.querySelector("#videoBackButton");
const videoToggleButton = document.querySelector("#videoToggleButton");
const videoForwardButton = document.querySelector("#videoForwardButton");
const videoNextButton = document.querySelector("#videoNextButton");
const videoSpeed = document.querySelector("#videoSpeed");
const videoMuteButton = document.querySelector("#videoMuteButton");
const videoFullscreenButton = document.querySelector("#videoFullscreenButton");
const videoSeek = document.querySelector("#videoSeek");
const videoCurrentTime = document.querySelector("#videoCurrentTime");
const videoDuration = document.querySelector("#videoDuration");
const videoVolume = document.querySelector("#videoVolume");
const videoVolumeValue = document.querySelector("#videoVolumeValue");

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

function isLocalApiBaseValue(base) {
  const normalized = String(base || "").trim();
  return LOCAL_API_BASES.some((candidate) => normalized.startsWith(candidate));
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Poster image load failed."));
    image.src = src;
  });
}

function renderPosterDataUrl(image, step) {
  const naturalWidth = Number(image.naturalWidth || image.width || step.width || 240) || 240;
  const naturalHeight = Number(image.naturalHeight || image.height || step.height || 360) || 360;
  const scale = Math.min(1, step.width / naturalWidth, step.height / naturalHeight);
  const width = Math.max(120, Math.round(naturalWidth * scale));
  const height = Math.max(180, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return "";
  ctx.fillStyle = "#101521";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", step.quality);
}

async function compressPosterDataUrl(dataUrl, steps = POSTER_COMPRESSION_STEPS) {
  const normalized = String(dataUrl || "").trim();
  if (!normalized.startsWith("data:image/")) return normalized;
  if (normalized.length <= MAX_SHARED_POSTER_DATA_URL_LENGTH) return normalized;

  try {
    const image = await loadImageElement(normalized);
    let candidate = normalized;
    for (const step of steps) {
      const nextValue = renderPosterDataUrl(image, step);
      if (!nextValue) continue;
      candidate = nextValue;
      if (candidate.length <= MAX_SHARED_POSTER_DATA_URL_LENGTH) {
        return candidate;
      }
    }
    return candidate;
  } catch {
    return normalized;
  }
}

async function preparePosterForSharedStorage(poster, steps = POSTER_COMPRESSION_STEPS) {
  const normalized = String(poster || "").trim();
  if (!normalized.startsWith("data:image/")) return normalized;
  return compressPosterDataUrl(normalized, steps);
}

function imageMimeFromFile(file) {
  const type = String(file?.type || "").trim().toLowerCase();
  if (type === "image/jpeg" || type === "image/png" || type === "image/webp") return type;

  const name = String(file?.name || "").trim().toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

function isImageFile(file) {
  return Boolean(imageMimeFromFile(file));
}

function normalizeImageDataUrlForFile(dataUrl, file) {
  const source = String(dataUrl || "");
  const mime = imageMimeFromFile(file);
  if (!mime || source.startsWith("data:image/")) return source;
  return source.replace(/^data:[^;,]*(;base64,)/, `data:${mime}$1`);
}

function getCropControls(kind) {
  return {
    crop: adminPosterCrop,
    preview: adminPosterCropPreview,
    zoom: adminPosterZoomInput,
    x: adminPosterXInput,
    y: adminPosterYInput,
    size: ADMIN_POSTER_CROP_SIZE,
  };
}

function getCropState(kind) {
  const controls = getCropControls(kind);
  return {
    zoom: Math.max(1, Math.min(2.2, Number(controls.zoom?.value || 100) / 100)),
    x: Math.max(-100, Math.min(100, Number(controls.x?.value || 0))),
    y: Math.max(-100, Math.min(100, Number(controls.y?.value || 0))),
  };
}

function updateAdminCropPreview(kind) {
  const controls = getCropControls(kind);
  const source = pendingAdminPosterSourceDataUrl;
  if (!controls.crop || !controls.preview) return;
  controls.crop.hidden = !source;
  if (!source) {
    controls.preview.style.removeProperty("--crop-image");
    return;
  }

  const state = getCropState(kind);
  controls.preview.style.setProperty("--crop-image", `url('${source.replaceAll("'", "%27").replaceAll(")", "%29")}')`);
  controls.preview.style.setProperty("--crop-size", `${Math.round(state.zoom * 100)}%`);
  controls.preview.style.setProperty("--crop-x", `${50 + state.x / 2}%`);
  controls.preview.style.setProperty("--crop-y", `${50 + state.y / 2}%`);
}

function resetAdminCrop(kind) {
  const controls = getCropControls(kind);
  pendingAdminPosterSourceDataUrl = "";

  if (controls.zoom) controls.zoom.value = "100";
  if (controls.x) controls.x.value = "0";
  if (controls.y) controls.y.value = "0";
  updateAdminCropPreview(kind);
}

async function cropImageDataUrl(dataUrl, kind) {
  const source = String(dataUrl || "").trim();
  if (!source.startsWith("data:image/")) return source;

  const { size } = getCropControls(kind);
  const state = getCropState(kind);
  const image = await loadImageElement(source);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return source;

  const naturalWidth = Number(image.naturalWidth || image.width || 1) || 1;
  const naturalHeight = Number(image.naturalHeight || image.height || 1) || 1;
  const coverScale = Math.max(size.width / naturalWidth, size.height / naturalHeight) * state.zoom;
  const drawWidth = naturalWidth * coverScale;
  const drawHeight = naturalHeight * coverScale;
  const overflowX = Math.max(0, drawWidth - size.width);
  const overflowY = Math.max(0, drawHeight - size.height);
  const dx = (size.width - drawWidth) / 2 + (state.x / 100) * (overflowX / 2);
  const dy = (size.height - drawHeight) / 2 + (state.y / 100) * (overflowY / 2);

  ctx.fillStyle = "#101521";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", kind === "hero" ? 0.9 : 0.88);
}

async function prepareAdminImageForSave(kind, fallbackValue) {
  const source = pendingAdminPosterSourceDataUrl;
  const adjusted = source ? await cropImageDataUrl(source, kind) : String(fallbackValue || "").trim();
  return preparePosterForSharedStorage(adjusted);
}

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (themeToggle) {
    themeToggle.dataset.theme = nextTheme;
  }
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", nextTheme === "light" ? "#faf7ff" : "#0f131a");
  }
  if (tg) {
    tg.setHeaderColor(nextTheme === "light" ? "#faf7ff" : "#0f131a");
    tg.setBackgroundColor(nextTheme === "light" ? "#f7f3ff" : "#0b1018");
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
  const debugUserId = Number(pageParams.get("debugUserId") || pageParams.get("adminId") || 0);
  const debugUsername = String(pageParams.get("debugUsername") || "").trim();
  const debugFirstName = String(pageParams.get("debugFirstName") || "").trim();
  const debugLastName = String(pageParams.get("debugLastName") || "").trim();

  if (Number.isFinite(debugUserId) && debugUserId > 0) {
    const queryUser = {
      ...DEFAULT_DEBUG_ADMIN_USER,
      id: debugUserId,
      username: debugUsername || DEFAULT_DEBUG_ADMIN_USER.username,
      first_name: debugFirstName || DEFAULT_DEBUG_ADMIN_USER.first_name,
      last_name: debugLastName || DEFAULT_DEBUG_ADMIN_USER.last_name,
    };
    localStorage.setItem(DEBUG_USER_STORAGE_KEY, JSON.stringify(queryUser));
    return queryUser;
  }

  const storedUser = readStoredJson(DEBUG_USER_STORAGE_KEY);
  if (storedUser?.id) return storedUser;
  if (window.location.protocol === "file:") return DEFAULT_DEBUG_ADMIN_USER;
  return null;
}

function getTelegramUser() {
  return tg?.initDataUnsafe?.user || readDebugTelegramUser() || null;
}

function isAdminUser(user = getTelegramUser()) {
  const userId = Number(user?.id);
  return Number.isFinite(userId) && ADMIN_USER_IDS.has(userId);
}

function getAdminRequestHeaders() {
  const user = getTelegramUser();
  const adminId = Number(user?.id);
  return Number.isFinite(adminId) ? { "X-Admin-Id": String(adminId) } : {};
}

async function trackTelegramUser() {
  if (hasTrackedTelegramUser) return;
  const user = getTelegramUser();
  if (!user?.id) return;
  hasTrackedTelegramUser = true;
  trackUserLocally(user);

  try {
    await resolveApiBase();
    await fetch(buildApiUrl("/api/admin/track-user"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user }),
    });
  } catch {
    hasTrackedTelegramUser = false;
  }
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

  trackTelegramUser();
}

function normalizeCategoryValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function getMovieCategory(movie) {
  return normalizeCategoryValue(movie?.genre || "kino");
}

function filteredMovies() {
  return getViewerMovies().filter((movie) => {
    const matchesFilter =
      activeFilter === "all" ||
      (activeFilter === "top" && movie.isTop) ||
      (activeFilter === "premium" && movie.isPremium);
    const matchesCategory = activeCategory === "all" || getMovieCategory(movie) === activeCategory;
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

function posterStyle(movie) {
  if (!movie.poster) return "";
  const poster = String(movie.poster).replaceAll("'", "%27").replaceAll(")", "%29");
  return `style="--poster-image: url('${poster}')"`;
}

function heroPosterStyle(movie) {
  // Use heroPoster first, fallback to regular poster
  const source = movie?.heroPoster || movie?.poster || "";
  if (!source) return "";
  const poster = String(source).replaceAll("'", "%27").replaceAll(")", "%29");
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
  const raw = String(value || "").trim();
  if (!raw) return "";
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

function isLocalRuntimeApiBase() {
  return isLocalApiBaseValue(runtimeApiBase);
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

function buildDrivePreviewUrl(fileId) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
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

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
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

function getLaunchWarning(movie) {
  if (isLaunchReadyMovie(movie)) return "";
  return "iPhone uchun MP4 tavsiya etiladi";
}

function isHeaderReadyMovie(movie) {
  return Boolean(movie?.heroFeatured && movie?.heroPoster);
}

function getViewerMovies() {
  const launchReadyMovies = movies.filter((movie) => isLaunchReadyMovie(movie));
  if (isMobileViewingContext()) return launchReadyMovies;
  return isAdminUser() ? movies : launchReadyMovies;
}

function shouldSkipInlinePlayback(movie) {
  if (!isAppleMobile()) return false;
  return !canBrowserPlayMovie(movie);
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

function readLocalTrackedUsers() {
  const payload = readStoredJson(LOCAL_USER_TRACK_KEY);
  return payload && typeof payload === "object" ? payload : {};
}

function writeLocalTrackedUsers(store) {
  localStorage.setItem(LOCAL_USER_TRACK_KEY, JSON.stringify(store));
}

function trackUserLocally(user) {
  const userId = Number(user?.id || 0);
  if (!Number.isFinite(userId) || userId <= 0) return 0;
  const store = readLocalTrackedUsers();
  store[String(userId)] = {
    id: userId,
    username: String(user?.username || "").trim(),
    firstName: String(user?.first_name || "").trim(),
    lastName: String(user?.last_name || "").trim(),
    updatedAt: new Date().toISOString(),
  };
  writeLocalTrackedUsers(store);
  return Object.keys(store).length;
}

function readAdminMovieOverrideStore() {
  const payload = readStoredJson("kino_admin_movie_overrides_v1");
  return payload && typeof payload === "object" ? payload : {};
}

function writeAdminMovieOverrideStore(store) {
  localStorage.setItem("kino_admin_movie_overrides_v1", JSON.stringify(store));
}

function saveAdminMovieOverrideLocally(payload) {
  const fileId = String(payload?.fileId || "").trim();
  if (!fileId) return;
  const store = readAdminMovieOverrideStore();
  store[fileId] = {
    title: String(payload.title || "").trim(),
    genre: String(payload.genre || payload.category || "").trim(),
    poster: String(payload.poster || "").trim(),
    heroPoster: String(payload.heroPoster || "").trim(),
    rating: Number(payload.rating || 0),
    quality: String(payload.quality || "HD").trim(),
    description: String(payload.description || "").trim(),
    heroFeatured: Boolean(payload.heroFeatured),
    updatedAt: new Date().toISOString(),
  };
  writeAdminMovieOverrideStore(store);
}

function removeAdminMovieOverride(fileId) {
  const normalizedFileId = String(fileId || "").trim();
  if (!normalizedFileId) return;
  const store = readAdminMovieOverrideStore();
  if (!(normalizedFileId in store)) return;
  delete store[normalizedFileId];
  writeAdminMovieOverrideStore(store);
}

function applyAdminMovieOverrides(list = []) {
  const store = readAdminMovieOverrideStore();
  return list.map((movie, index) => {
    const override = store[String(movie?.id || "")] || store[String(movie?.fileId || "")] || null;
    return override ? normalizeMovie({ ...movie, ...override }, index) : movie;
  });
}

function replaceMovieInList(list = [], nextMovie) {
  const targetId = String(nextMovie?.id || nextMovie?.fileId || "");
  if (!targetId) return list;
  let replaced = false;
  const nextList = list.map((movie, index) => {
    const movieId = String(movie?.id || movie?.fileId || "");
    if (movieId !== targetId) return movie;
    replaced = true;
    return normalizeMovie({ ...movie, ...nextMovie }, index);
  });
  return replaced ? nextList : [...nextList, normalizeMovie(nextMovie, nextList.length)];
}

async function syncAdminOverridesToServer() {
  if (!isAdminUser()) return { synced: 0, pending: 0 };
  await resolveApiBase();
  if (isLocalRuntimeApiBase()) return { synced: 0, pending: 0 };

  const store = readAdminMovieOverrideStore();
  const entries = Object.entries(store);
  if (!entries.length) return { synced: 0, pending: 0 };

  let synced = 0;
  const nextStore = { ...store };
  const adminId = Number(getTelegramUser()?.id || 0);

  for (const [fileId, override] of entries) {
    const sharedPoster = await preparePosterForSharedStorage(override?.poster || "");
    const sharedHeroPoster = await preparePosterForSharedStorage(override?.heroPoster || "", HERO_POSTER_COMPRESSION_STEPS);
    const payload = {
      adminId,
      fileId,
      title: String(override?.title || "").trim(),
      genre: String(override?.genre || "").trim(),
      poster: sharedPoster,
      heroPoster: sharedHeroPoster,
      rating: Number(override?.rating || 0),
      quality: String(override?.quality || "HD").trim(),
      description: String(override?.description || "").trim(),
      heroFeatured: Boolean(override?.heroFeatured),
    };

    if (!payload.title || !payload.genre) continue;

    try {
      const response = await fetch(buildApiUrl("/api/admin/movies"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...getAdminRequestHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        continue;
      }
      delete nextStore[fileId];
      synced += 1;
    } catch {
      continue;
    }
  }

  writeAdminMovieOverrideStore(nextStore);
  return {
    synced,
    pending: Object.keys(nextStore).length,
  };
}

function normalizeMovie(movie, index = 0) {
  const fileId = getMovieFileId(movie);
  const postUrl = getMoviePostUrl(movie);
  const safeId = String(movie?.id || movie?.code || `movie-${index + 1}`);
  const title = String(movie?.title || `Kino ${index + 1}`).trim();
  const rawPoster = String(movie?.poster || movie?.thumbnail || (fileId ? buildDriveThumbnailUrl(fileId) : "")).trim();
  const description = sanitizePublicDescription(movie?.description || "Kino tavsifi kiritilmagan.");
  const sourceType = String(movie?.sourceType || (fileId ? "catalog" : "catalog")).trim();
  const isDriveSource = sourceType === "google_drive" || Boolean(movie?.driveFileId || movie?.fileId || movie?.googleDriveFileId);
  const genre = sanitizePublicGenre(movie?.genre || "Kino");
  const quality = String(movie?.quality || "HD").trim().toUpperCase();
  const rating = Number(movie?.rating || 0);
  const fileName = String(movie?.fileName || movie?.name || "").trim();
  const sourceUrl = resolveAppUrl(postUrl || movie?.sourceUrl || movie?.webViewLink || "");
  const poster = resolveAppUrl(rawPoster) || buildGeneratedPosterDataUrl({ title, year: movie?.year || "", quality });
  const heroPoster = resolveAppUrl(String(movie?.heroPoster || movie?.headerPoster || movie?.heroImage || "").trim());
  const normalized = {
    ...movie,
    id: safeId,
    code: String(movie?.code || safeId).trim().toUpperCase(),
    title,
    poster,
    heroPoster,
    description,
    genre,
    quality,
    rating: Number.isFinite(rating) ? rating : 0,
    year: movie?.year || "",
    isTop: Boolean(movie?.isTop),
    isPremium: Boolean(movie?.isPremium),
    heroFeatured: Boolean(movie?.heroFeatured || movie?.isHero || movie?.showInHeader),
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
    poster: movie.poster || "",
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
  const viewerMovieIds = new Set(getViewerMovies().map((movie) => String(movie.id)));
  return Object.values(readWatchedMoviesStore())
    .filter((entry) => entry && typeof entry === "object")
    .filter((entry) => isAdminUser() || viewerMovieIds.has(String(entry.id || "")))
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

function getAdminMoviesForOptions() {
  return adminDashboardMovies.length ? adminDashboardMovies : movies;
}

function populateAdminGenreSelect(selectedGenre = "") {
  if (!adminGenreSelect) return;
  const selected = String(selectedGenre || "").trim();
  const genres = [...new Set(
    getAdminMoviesForOptions()
      .map((movie) => String(movie?.genre || "").trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));

  if (selected && !genres.includes(selected)) {
    genres.unshift(selected);
  }

  adminGenreSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = lang === "ru" ? "Выберите категорию" : lang === "en" ? "Choose category" : "Kategoriya tanlang";
  adminGenreSelect.append(placeholder);

  for (const genre of genres) {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    adminGenreSelect.append(option);
  }

  adminGenreSelect.value = selected;
}

function closeAdminEditor() {
  if (adminEditModal) adminEditModal.hidden = true;
  pendingAdminPosterDataUrl = "";
  pendingAdminHeroPosterDataUrl = "";
  pendingAdminHeroPosterReadyPromise = null;
  if (adminPosterFileInput) adminPosterFileInput.value = "";
  if (adminHeroPosterFileInput) adminHeroPosterFileInput.value = "";
  if (adminHeroPosterFileStatus) adminHeroPosterFileStatus.textContent = "16:9 gorizontal rasm tanlanmagan.";
  resetAdminCrop("poster");
}

function clearAdminEditor() {
  selectedAdminMovieId = "";
  pendingAdminPosterDataUrl = "";
  pendingAdminHeroPosterDataUrl = "";
  pendingAdminPosterSourceDataUrl = "";
  pendingAdminHeroPosterReadyPromise = null;
  if (adminMovieForm) adminMovieForm.reset();
  if (adminMovieIdInput) adminMovieIdInput.value = "";
  if (adminGenreCustomInput) adminGenreCustomInput.value = "";
  if (adminPosterFileInput) adminPosterFileInput.value = "";
  if (adminHeroPosterFileInput) adminHeroPosterFileInput.value = "";
  populateAdminGenreSelect("");
  closeAdminEditor();
  if (adminEditorTitle) adminEditorTitle.textContent = "Kino tanlanmagan";
  if (adminEditorMeta) {
    adminEditorMeta.textContent = "Kategoriya, ablojka, tavsif va reytingni o'zgartiring.";
  }
}

function openAdminMovieListPage() {
  if (!adminListPage) return;
  adminListPage.hidden = false;
  adminCard?.classList.add("is-list-open");
  renderAdminMovieList(adminDashboardMovies);
  adminCard?.scrollTo?.({ top: 0, left: 0 });
}

function closeAdminMovieListPage() {
  if (adminListPage) adminListPage.hidden = true;
  adminCard?.classList.remove("is-list-open");
  adminCard?.scrollTo?.({ top: 0, left: 0 });
}

function openAdminEditor(movie) {
  if (!movie) {
    clearAdminEditor();
    return;
  }

  selectedAdminMovieId = String(movie.id);
  resetAdminCrop("poster");
  pendingAdminPosterDataUrl = String(movie.poster || "").startsWith("data:image/") ? String(movie.poster) : "";
  pendingAdminHeroPosterDataUrl = String(movie.heroPoster || "").startsWith("data:image/") ? String(movie.heroPoster) : "";
  pendingAdminHeroPosterReadyPromise = null;
  if (adminMovieForm) adminMovieForm.reset();
  if (adminMovieIdInput) adminMovieIdInput.value = selectedAdminMovieId;
  if (adminTitleInput) adminTitleInput.value = movie.title || "";
  populateAdminGenreSelect(movie.genre || "");
  if (adminGenreCustomInput) adminGenreCustomInput.value = "";
  if (adminPosterInput) {
    const poster = String(movie.poster || "");
    adminPosterInput.value = poster && !poster.startsWith("/api/") && !poster.startsWith("data:") ? poster : "";
  }
  if (adminPosterFileInput) adminPosterFileInput.value = "";
  if (adminHeroPosterInput) {
    const heroPoster = String(movie.heroPoster || "");
    adminHeroPosterInput.value = heroPoster && !heroPoster.startsWith("/api/") && !heroPoster.startsWith("data:") ? heroPoster : "";
  }
  if (adminHeroPosterFileInput) adminHeroPosterFileInput.value = "";
  if (adminHeroPosterFileStatus) {
    adminHeroPosterFileStatus.textContent = movie.heroPoster
      ? "Header ablojka saqlangan. Yangi 16:9 rasm tanlasangiz almashtiriladi."
      : "16:9 gorizontal rasm tanlanmagan.";
  }
  if (adminRatingInput) adminRatingInput.value = Number.isFinite(Number(movie.rating)) ? String(movie.rating) : "";
  if (adminQualityInput) adminQualityInput.value = movie.quality || "";
  if (adminHeroFeaturedInput) adminHeroFeaturedInput.checked = Boolean(movie.heroFeatured);
  if (adminDescriptionInput) adminDescriptionInput.value = movie.description || "";
  if (adminEditorTitle) adminEditorTitle.textContent = movie.title || "Kino";
  if (adminEditorMeta) {
    const warning = getLaunchWarning(movie);
    const headerLabel = isHeaderReadyMovie(movie) ? "Header slider" : movie.heroFeatured ? "Header rasmi yo'q" : "Header off";
    adminEditorMeta.textContent = warning
      ? `${movie.quality || "HD"} - ${warning} - ${headerLabel}`
      : `${movie.quality || "HD"} - Launch-ready - ${headerLabel}`;
  }
  if (adminEditModal) adminEditModal.hidden = false;
  adminTitleInput?.focus();
}

function renderAdminMovieList(items = adminDashboardMovies) {
  if (!adminMovieList || !adminMovieCount) return;
  adminMovieList.innerHTML = "";
  adminMovieCount.textContent = `${items.length} ta`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "admin-movie-item";
    empty.innerHTML = "<div><strong>Katalog hozircha bo'sh</strong><span>Kutubxonaga video qo'shing.</span></div>";
    adminMovieList.append(empty);
    clearAdminEditor();
    return;
  }

  for (const movie of items) {
    const item = document.createElement("article");
    const isActive = String(movie.id) === selectedAdminMovieId;
    const warning = getLaunchWarning(movie);
    item.className = `admin-movie-item${isActive ? " is-active" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(movie.title)}</strong>
        <span>${escapeHtml(movie.genre || "Kategoriya yo'q")}</span>
        <span>${escapeHtml(`${movie.quality || "HD"} - ${movie.rating || 0}`)}</span>
        ${isHeaderReadyMovie(movie) ? '<span class="admin-movie-item__ready">Header slider</span>' : movie.heroFeatured ? '<span class="admin-movie-item__warning">Header rasmi yo&#039;q</span>' : ""}
        ${warning
          ? `<span class="admin-movie-item__warning">${escapeHtml(warning)}</span>`
          : '<span class="admin-movie-item__ready">Launch-ready</span>'}
      </div>
      <button type="button" data-admin-edit="${escapeHtml(String(movie.id))}">${escapeHtml(t("edit"))}</button>
    `;
    adminMovieList.append(item);
  }
}

async function loadAdminDashboard() {
  await resolveApiBase();
  const response = await fetch(`${buildApiUrl("/api/admin/dashboard")}?adminId=${encodeURIComponent(String(getTelegramUser()?.id || ""))}`, {
    headers: {
      Accept: "application/json",
      ...getAdminRequestHeaders(),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Admin panel yuklanmadi.");
  }
  adminDashboardMovies = Array.isArray(payload.movies)
    ? applyAdminMovieOverrides(payload.movies.map((movie, index) => normalizeMovie(movie, index)))
    : [];
  const readyCount = adminDashboardMovies.filter((movie) => isLaunchReadyMovie(movie)).length;
  const headerCount = adminDashboardMovies.filter((movie) => isHeaderReadyMovie(movie)).length;
  const localTrackedUsers = Object.keys(readLocalTrackedUsers()).length;
  if (adminUsersCount) {
    adminUsersCount.textContent = String(Math.max(Number(payload.stats?.botUsers ?? 0), localTrackedUsers));
  }
  if (adminReadyCount) {
    adminReadyCount.textContent = String(readyCount);
  }
  if (adminLibraryHint) {
    adminLibraryHint.textContent = `${readyCount}/${adminDashboardMovies.length} ta kino launch-ready`;
  }
  if (adminHeaderHint) {
    adminHeaderHint.textContent = headerCount
      ? `${headerCount} ta kino header sliderda ko'rsatiladi.`
      : "Header uchun 16:9 rasm yuklang.";
  }
  closeAdminMovieListPage();
  renderAdminMovieList(adminDashboardMovies);
}

async function openAdminPanel() {
  if (!isAdminUser()) return;
  await resolveApiBase();
  profileModal.close();
  clearAdminEditor();
  if (adminUsersCount) adminUsersCount.textContent = "…";
  if (adminMovieCount) adminMovieCount.textContent = "…";
  if (adminReadyCount) adminReadyCount.textContent = "…";
  if (adminLibraryHint) adminLibraryHint.textContent = "Yuklanmoqda...";
  if (adminHeaderHint) adminHeaderHint.textContent = "Header section sozlamalari yuklanmoqda...";
  closeAdminMovieListPage();
  adminModal.showModal();
  try {
    const syncState = await syncAdminOverridesToServer();
    await loadAdminDashboard();
    if (adminLibraryHint && syncState.synced > 0) {
      adminLibraryHint.textContent = `${syncState.synced} ta local edit hammaga sync qilindi`;
    }
  } catch (error) {
    adminDashboardMovies = applyAdminMovieOverrides([...movies]);
    if (adminUsersCount) {
      adminUsersCount.textContent = String(Object.keys(readLocalTrackedUsers()).length);
    }
    if (adminMovieCount) {
      adminMovieCount.textContent = `${adminDashboardMovies.length} ta`;
    }
    if (adminReadyCount) {
      adminReadyCount.textContent = String(adminDashboardMovies.filter((movie) => isLaunchReadyMovie(movie)).length);
    }
    if (adminHeaderHint) {
      const headerCount = adminDashboardMovies.filter((movie) => isHeaderReadyMovie(movie)).length;
      adminHeaderHint.textContent = headerCount
        ? `${headerCount} ta kino header sliderda ko'rsatiladi.`
        : "Header uchun 16:9 rasm yuklang.";
    }
    if (adminLibraryHint) {
      adminLibraryHint.textContent = "Local rejim. Server bilan ulanish yo'q.";
    }
    renderAdminMovieList(adminDashboardMovies);
  }
}

function closeAdminPanel() {
  closeAdminEditor();
  closeAdminMovieListPage();
  adminModal.close();
}

async function saveAdminMovie(formData) {
  await resolveApiBase();
  if (pendingAdminHeroPosterReadyPromise) {
    await pendingAdminHeroPosterReadyPromise;
  }
  const fileId = String(formData.get("fileId") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const genre = String(formData.get("genreCustom") || formData.get("genreSelect") || "").trim();
  if (!fileId || !title || !genre) return { ok: false };
  const poster = await prepareAdminImageForSave("poster", pendingAdminPosterDataUrl || String(formData.get("poster") || "").trim());
  const heroPoster = await preparePosterForSharedStorage(
    pendingAdminHeroPosterDataUrl || String(formData.get("heroPoster") || "").trim(),
    HERO_POSTER_COMPRESSION_STEPS,
  );

  const payload = {
    adminId: Number(getTelegramUser()?.id || 0),
    fileId,
    title,
    genre,
    poster,
    heroPoster,
    rating: Number(formData.get("rating") || 0),
    quality: String(formData.get("quality") || "").trim() || "HD",
    description: String(formData.get("description") || "").trim(),
    heroFeatured: Boolean(heroPoster) && formData.get("heroFeatured") === "on",
  };

  pendingAdminPosterDataUrl = poster.startsWith("data:image/") ? poster : "";
  pendingAdminHeroPosterDataUrl = heroPoster.startsWith("data:image/") ? heroPoster : "";
  saveAdminMovieOverrideLocally(payload);
  const localBaseMovie =
    adminDashboardMovies.find((movie) => String(movie.id) === fileId)
    || movies.find((movie) => String(movie.id) === fileId)
    || { id: fileId, fileId };
  const localUpdatedMovie = normalizeMovie({ ...localBaseMovie, ...payload, id: fileId }, 0);
  adminDashboardMovies = replaceMovieInList(adminDashboardMovies, localUpdatedMovie);
  movies = replaceMovieInList(movies, localUpdatedMovie);
  renderAdminMovieList(adminDashboardMovies);
  if (adminHeaderHint) {
    const headerCount = adminDashboardMovies.filter((movie) => isHeaderReadyMovie(movie)).length;
    adminHeaderHint.textContent = headerCount
      ? `${headerCount} ta kino header sliderda ko'rsatiladi.`
      : "Header uchun 16:9 rasm yuklang.";
  }
  renderHeroCarousel(payload.heroFeatured ? fileId : "");
  closeAdminEditor();
  renderMovies();

  try {
    const response = await fetch(buildApiUrl("/api/admin/movies"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getAdminRequestHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || "Saqlab bo'lmadi.");
    }

    adminDashboardMovies = Array.isArray(result.movies)
      ? applyAdminMovieOverrides(result.movies.map((movie, index) => normalizeMovie(movie, index)))
      : adminDashboardMovies;
    movies = adminDashboardMovies.length ? [...adminDashboardMovies] : movies;
    removeAdminMovieOverride(fileId);
    renderAdminMovieList(adminDashboardMovies);
    if (adminHeaderHint) {
      const headerCount = adminDashboardMovies.filter((movie) => isHeaderReadyMovie(movie)).length;
      adminHeaderHint.textContent = headerCount
        ? `${headerCount} ta kino header sliderda ko'rsatiladi.`
        : "Header uchun 16:9 rasm yuklang.";
    }
    renderHeroCarousel(payload.heroFeatured ? fileId : "");
    renderMovies();
    return { ok: true, mode: "remote" };
  } catch (error) {
    const isSharedWrite = !isLocalRuntimeApiBase();
    return {
      ok: true,
      mode: "local",
      shared: !isSharedWrite,
      message: isSharedWrite
        ? "Faqat shu qurilmada ko'rinyapti. Hamma userlar uchun hali sync bo'lmadi."
        : "Serverga yozilmadi, local saqlandi.",
    };
  }
}

function setEmptyState(title, text) {
  emptyState.querySelector("strong").textContent = title;
  emptyState.querySelector("span").textContent = text;
}

function updateEmptyState(list) {
  if (movieLoadState === "loading") {
    emptyState.hidden = false;
    emptyState.classList.add("loading-state");
    setEmptyState(t("loadingTitle"), t("loadingText"));
    return;
  }

  emptyState.classList.remove("loading-state");

  if (movieLoadState === "error") {
    emptyState.hidden = false;
    setEmptyState(t("loadErrorTitle"), movieLoadError || t("loadErrorText"));
    return;
  }

  emptyState.hidden = list.length > 0;
  if (!list.length) setEmptyState(t("emptyTitle"), t("emptyText"));
}

function buildCategoryOptions() {
  const map = new Map();
  map.set("all", plainLabel(t("all")));

  for (const movie of getViewerMovies()) {
    const rawGenre = String(movie?.genre || "").trim();
    const value = normalizeCategoryValue(rawGenre);
    if (!rawGenre || !value || map.has(value)) continue;
    map.set(value, rawGenre);
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

function clearHeroCarouselTimer() {
  if (heroCarouselTimer) {
    window.clearInterval(heroCarouselTimer);
    heroCarouselTimer = null;
  }
}

function getHeroCarouselSourceMovies() {
  const sourceMovies = getViewerMovies();
  // First priority: featured movies with hero poster
  const featuredMovies = sourceMovies.filter((movie) => movie?.heroFeatured && movie?.heroPoster);
  if (featuredMovies.length) return featuredMovies.slice(0, 6);

  // Second priority: movies with any poster (hero or regular)
  const moviesWithPoster = sourceMovies.filter((movie) => Boolean(movie?.heroPoster || movie?.poster));
  if (moviesWithPoster.length) return moviesWithPoster.slice(0, 6);

  // Third priority: any available movies (for all users to see the header)
  return sourceMovies.slice(0, 6);
}

function updateHeroCarouselView() {
  if (!heroCarousel || !heroCarouselTitle || !heroCarouselDots) return;
  const activeMovie = heroCarouselMovies[heroCarouselIndex] || null;

  if (!activeMovie) {
    heroCarousel.hidden = true;
    heroCarouselTitle.textContent = "";
    heroCarousel.setAttribute("aria-label", "Tavsiya etilgan kinolar");
    return;
  }

  heroCarousel.hidden = false;
  heroCarouselTitle.textContent = activeMovie.title || "My Kino";
  heroCarousel.setAttribute("aria-label", `${activeMovie.title || "Kino"} ${plainLabel(t("watch"))}`);

  heroCarouselTrack?.querySelectorAll(".hero-carousel__slide").forEach((slide, index) => {
    slide.classList.toggle("is-active", index === heroCarouselIndex);
  });

  heroCarouselDots?.querySelectorAll("[data-hero-index]").forEach((button, index) => {
    const isActive = index === heroCarouselIndex;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function startHeroCarouselTimer() {
  clearHeroCarouselTimer();
  if (heroCarouselMovies.length <= 1) return;
  heroCarouselTimer = window.setInterval(() => {
    heroCarouselIndex = (heroCarouselIndex + 1) % heroCarouselMovies.length;
    updateHeroCarouselView();
  }, HERO_ROTATE_INTERVAL_MS);
}

function renderHeroCarousel(preferredMovieId = "") {
  if (!heroCarousel || !heroCarouselTrack || !heroCarouselDots) return;

  const nextMovies = movieLoadState === "ready" ? getHeroCarouselSourceMovies() : [];
  const activeMovieId = preferredMovieId || heroCarouselMovies[heroCarouselIndex]?.id;
  heroCarouselMovies = nextMovies;

  if (!heroCarouselMovies.length) {
    heroCarousel.hidden = true;
    heroCarouselTrack.innerHTML = "";
    heroCarouselDots.innerHTML = "";
    clearHeroCarouselTimer();
    return;
  }

  const preservedIndex = heroCarouselMovies.findIndex((movie) => String(movie.id) === String(activeMovieId || ""));
  heroCarouselIndex = preservedIndex >= 0 ? preservedIndex : Math.min(heroCarouselIndex, heroCarouselMovies.length - 1);

  heroCarouselTrack.innerHTML = heroCarouselMovies.map((movie, index) => `
    <span class="hero-carousel__slide${index === heroCarouselIndex ? " is-active" : ""}" ${heroPosterStyle(movie)}></span>
  `).join("");

  heroCarouselDots.innerHTML = heroCarouselMovies.map((movie, index) => `
    <button
      class="hero-carousel__dot${index === heroCarouselIndex ? " is-active" : ""}"
      type="button"
      data-hero-index="${index}"
      aria-label="${escapeHtml(movie.title || `Kino ${index + 1}`)}"
      aria-current="${index === heroCarouselIndex ? "true" : "false"}"
    ></button>
  `).join("");

  updateHeroCarouselView();
  startHeroCarouselTimer();
}

function syncNavButtons() {
  document.querySelectorAll('[data-filter="all"]').forEach((button) => {
    button.classList.toggle("is-active", activeFilter === "all" && activeCategory === "all" && !query);
  });

  document.querySelectorAll('[data-action="search"]').forEach((button) => {
    button.classList.toggle("is-active", !searchPanel.hidden || Boolean(query));
  });

  document.querySelectorAll('[data-action="categories"]').forEach((button) => {
    button.classList.toggle("is-active", !categoryPanel.hidden || activeCategory !== "all");
  });
}

function renderMovies() {
  const list = movieLoadState === "ready" ? filteredMovies() : [];
  grid.innerHTML = "";
  updateEmptyState(list);

  for (const movie of list) {
    const card = document.createElement("article");
    card.className = "movie-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", movie.title);
    card.innerHTML = `
      <span class="poster" ${posterStyle(movie)}></span>
      <span class="card-badges">
        <span class="badge">${escapeHtml(movie.quality || "HD")}</span>
        <span class="rating"><span>&#9733;</span> ${formatRating(movie.rating)}</span>
      </span>
      <span class="play-float">&#9654;</span>
      <span class="card-copy">
        <h2>${escapeHtml(movie.title)}</h2>
      </span>
    `;
    card.querySelector(".card-copy").insertAdjacentHTML("beforeend", '<button class="card-watch-button" type="button"></button>');
    card.querySelector(".card-watch-button").textContent = plainLabel(t("watch"));
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

  renderCategories();
  syncNavButtons();
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
  if (profileAdminButton) {
    profileAdminButton.hidden = !isAdminUser(user);
  }
  viewCount.textContent = watchedCount;
  renderProfileHistory();
}

function openMovie(movie) {
  modalPoster.style.backgroundImage = movie.poster
    ? `linear-gradient(180deg, rgba(0,0,0,0) 48%, rgba(0,0,0,.32) 100%), url('${String(movie.poster).replaceAll("'", "%27")}'), linear-gradient(135deg, #253142, #10161f 58%, #2b1b1d)`
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
  videoControls.hidden = !isActive;
  videoCenterAction.hidden = !isActive;
  if (!isActive) {
    setControlLabel(videoPrevButton, plainLabel(t("previous")));
    videoPrevButton.disabled = true;
    setControlLabel(videoBackButton, plainLabel(t("back10")));
    setStateLabel(videoToggleButton, "play", plainLabel(t("play")));
    setControlLabel(videoForwardButton, plainLabel(t("forward10")));
    setControlLabel(videoNextButton, plainLabel(t("next")));
    videoNextButton.disabled = true;
    setStateLabel(videoMuteButton, "sound", plainLabel(t("mute")));
    setStateLabel(videoFullscreenButton, document.fullscreenElement ? "exit" : "enter", plainLabel(document.fullscreenElement ? t("exitFull") : t("full")));
    setControlLabel(videoCenterAction, plainLabel(t("play")));
    videoSeek.value = "0";
    videoSpeed.innerHTML = '<option value="1">1x</option>';
    videoSpeed.setAttribute("aria-label", plainLabel(t("speed")));
    videoVolume.value = "100";
    videoVolumeValue.textContent = "100%";
    videoCurrentTime.textContent = "0:00";
    videoDuration.textContent = "0:00";
    setRangeFill(videoSeek, 0, 1000);
    setRangeFill(videoVolume, 100, 100);
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
  const currentIndex = findMovieIndex(activeMovie);
  const visibleMovies = getViewerMovies();
  videoPrevButton.disabled = currentIndex <= 0;
  videoNextButton.disabled = currentIndex === -1 || currentIndex >= visibleMovies.length - 1;
  setControlLabel(videoPrevButton, plainLabel(t("previous")));
  setControlLabel(videoNextButton, plainLabel(t("next")));
}

function syncSpeedOptions() {
  const rates = activeYouTubePlayer?.getAvailablePlaybackRates?.() || [1];
  const uniqueRates = [...new Set(rates.map((rate) => Number(rate)).filter((rate) => Number.isFinite(rate) && rate > 0))];
  const safeRates = uniqueRates.length ? uniqueRates.sort((a, b) => a - b) : [1];
  const currentRate = Number(activeYouTubePlayer?.getPlaybackRate?.() || 1);
  const existingValues = [...videoSpeed.options].map((option) => option.value);
  const nextValues = safeRates.map((rate) => String(rate));

  if (existingValues.join("|") === nextValues.join("|")) {
    videoSpeed.value = nextValues.includes(String(currentRate)) ? String(currentRate) : nextValues[0];
    return;
  }

  videoSpeed.innerHTML = "";
  for (const rate of safeRates) {
    const option = document.createElement("option");
    option.value = String(rate);
    option.textContent = `${rate}x`;
    if (Math.abs(rate - currentRate) < 0.001) option.selected = true;
    videoSpeed.append(option);
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
  videoVolume.value = String(currentVolume);
  videoVolumeValue.textContent = `${currentVolume}%`;
  videoCurrentTime.textContent = formatPlaybackTime(currentTime);
  videoDuration.textContent = formatPlaybackTime(duration);
  setRangeFill(videoSeek, progressValue, 1000);
  setRangeFill(videoVolume, currentVolume, 100);
  setControlLabel(videoBackButton, plainLabel(t("back10")));
  setStateLabel(videoToggleButton, isPlaying ? "pause" : "play", plainLabel(isPlaying ? t("pause") : t("play")));
  setControlLabel(videoForwardButton, plainLabel(t("forward10")));
  setControlLabel(videoCenterAction, plainLabel(t("play")));
  videoCenterAction.hidden = isPlaying;
  setStateLabel(videoMuteButton, isMuted ? "mute" : "sound", plainLabel(isMuted ? t("unmute") : t("mute")));
  syncFullscreenButton();
  syncPlaylistNavigationButtons();
  if ([...videoSpeed.options].some((option) => option.value === String(Number(activeYouTubePlayer.getPlaybackRate?.() || 1)))) {
    videoSpeed.value = String(Number(activeYouTubePlayer.getPlaybackRate?.() || 1));
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
  videoVolume.value = String(safeVolume);
  videoVolumeValue.textContent = `${safeVolume}%`;
  setRangeFill(videoVolume, safeVolume, 100);
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
  videoMount.requestFullscreen?.();
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
          activeYouTubePlayer.setVolume(Number(videoVolume.value || 100));
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
  video.controls = true;
  video.playsInline = true;
  video.preload = preload;
  video.autoplay = true;
  video.poster = movie.poster || "";
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("controlsList", "nodownload");
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

function getDrivePreviewUrl(movie) {
  const driveFileId = String(movie?.driveFileId || movie?.fileId || "").trim();
  return driveFileId ? buildDrivePreviewUrl(driveFileId) : "";
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
  if (filter === "all") {
    activeCategory = "all";
    searchPanel.hidden = true;
    categoryPanel.hidden = true;
    query = "";
    searchInput.value = "";
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

function toggleSearchPanel(forceOpen) {
  const nextState = typeof forceOpen === "boolean" ? forceOpen : searchPanel.hidden;
  searchPanel.hidden = !nextState;
  if (nextState) {
    categoryPanel.hidden = true;
    searchInput.focus();
  }
  syncNavButtons();
}

function toggleCategoryPanel(forceOpen) {
  const nextState = typeof forceOpen === "boolean" ? forceOpen : categoryPanel.hidden;
  categoryPanel.hidden = !nextState;
  if (nextState) {
    searchPanel.hidden = true;
  }
  syncNavButtons();
}

function applyCopy() {
  const allLabel = plainLabel(t("all"));
  const searchLabel = plainLabel(t("search"));
  const categoriesLabel = plainLabel(t("categories"));

  const allTabLabel = document.querySelector('.quick-tabs [data-filter="all"] .tab__label');
  const searchTabLabel = document.querySelector('.quick-tabs [data-action="search"] .tab__label');
  const categoriesTabLabel = document.querySelector('.quick-tabs [data-action="categories"] .tab__label');

  if (allTabLabel) allTabLabel.textContent = allLabel;
  if (searchTabLabel) searchTabLabel.textContent = searchLabel;
  if (categoriesTabLabel) categoriesTabLabel.textContent = categoriesLabel;

  document.querySelectorAll('.bottom-bar [data-filter="all"]').forEach((button) => setControlLabel(button, allLabel));
  document.querySelectorAll('[data-action="search"]').forEach((button) => setControlLabel(button, searchLabel));
  document.querySelectorAll('[data-action="categories"]').forEach((button) => setControlLabel(button, categoriesLabel));
  if (langSelect) {
    langSelect.value = lang;
    langSelect.setAttribute("aria-label", lang === "ru" ? "Язык" : lang === "en" ? "Language" : "Til");
  }

  searchInput.placeholder = plainLabel(t("placeholder"));
  if (movieLaterButton) movieLaterButton.textContent = plainLabel(t("later"));
  if (profileAdminButton) profileAdminButton.textContent = t("adminPanel");
  if (adminSaveButton) adminSaveButton.textContent = t("save");
  if (adminResetButton) adminResetButton.textContent = t("clearHistory");
  if (videoLoading) {
    const label = videoLoading.querySelector("b");
    if (label) label.textContent = t("videoLoading");
  }
  if (videoExternalLink) videoExternalLink.textContent = t("openSource");
  setControlLabel(videoPrevButton, plainLabel(t("previous")));
  setControlLabel(videoBackButton, plainLabel(t("back10")));
  setStateLabel(videoToggleButton, videoToggleButton.dataset.state || "play", plainLabel(t("play")));
  setControlLabel(videoCenterAction, plainLabel(t("play")));
  setControlLabel(videoForwardButton, plainLabel(t("forward10")));
  setControlLabel(videoNextButton, plainLabel(t("next")));
  setStateLabel(videoMuteButton, videoMuteButton.dataset.state || "sound", plainLabel(t("mute")));
  videoSpeed.setAttribute("aria-label", plainLabel(t("speed")));
  syncFullscreenButton();
  emptyState.querySelector("strong").textContent = plainLabel(t("emptyTitle"));
  emptyState.querySelector("span").textContent = plainLabel(t("emptyText"));
  profileName.textContent = plainLabel(t("profile"));
  document.documentElement.lang = lang;
  setRangeFill(videoSeek, Number(videoSeek.value || 0), 1000);
  setRangeFill(videoVolume, Number(videoVolume.value || 100), 100);
  updateHeroCarouselView();
  applyTelegramUser();
  renderCategories();
  if (adminModal?.open) renderAdminMovieList(adminDashboardMovies);
  renderProfileModal();
  renderMovies();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

document.querySelectorAll("[data-action='search']").forEach((button) => {
  button.addEventListener("click", () => toggleSearchPanel());
});

document.querySelectorAll("[data-action='categories']").forEach((button) => {
  button.addEventListener("click", () => toggleCategoryPanel());
});

categoryList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  setCategory(button.dataset.category || "all");
});

heroCarousel?.addEventListener("click", (event) => {
  const dotButton = event.target.closest("[data-hero-index]");
  if (dotButton) {
    heroCarouselIndex = Number(dotButton.dataset.heroIndex || 0) || 0;
    updateHeroCarouselView();
    startHeroCarouselTimer();
    return;
  }

  const movie = heroCarouselMovies[heroCarouselIndex];
  if (movie) openMovie(movie);
});

heroCarousel?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const movie = heroCarouselMovies[heroCarouselIndex];
    if (movie) openMovie(movie);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearHeroCarouselTimer();
    return;
  }
  startHeroCarouselTimer();
});

document.querySelector(".theme-toggle")?.addEventListener("click", toggleTheme);

document.querySelector(".lang-select")?.addEventListener("change", (event) => {
  lang = event.target.value;
  localStorage.setItem("kino_lang", lang);
  applyCopy();
});

searchInput.addEventListener("input", (event) => {
  query = event.target.value.trim();
  renderMovies();
});

document.querySelectorAll("[data-action='profile']").forEach((button) => {
  button.addEventListener("click", () => {
    renderProfileModal();
    profileModal.showModal();
  });
});

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
document.querySelectorAll("[data-admin-open]").forEach((button) => {
  button.addEventListener("click", openAdminPanel);
});
document.querySelectorAll("[data-admin-close]").forEach((button) => {
  button.addEventListener("click", closeAdminPanel);
});
document.querySelectorAll("[data-admin-edit-close]").forEach((button) => {
  button.addEventListener("click", closeAdminEditor);
});

adminEditModal?.addEventListener("click", (event) => {
  if (event.target === adminEditModal) {
    closeAdminEditor();
  }
});

adminLibraryOpen?.addEventListener("click", openAdminMovieListPage);

adminListBack?.addEventListener("click", closeAdminMovieListPage);

adminModal?.addEventListener("click", (event) => {
  if (event.target.closest("#adminLibraryOpen")) {
    openAdminMovieListPage();
  }
  if (event.target.closest("#adminListBack")) {
    closeAdminMovieListPage();
  }
});

[adminPosterZoomInput, adminPosterXInput, adminPosterYInput]
  .filter(Boolean)
  .forEach((input) => input.addEventListener("input", () => updateAdminCropPreview("poster")));

adminPosterFileInput?.addEventListener("change", () => {
  const file = adminPosterFileInput.files?.[0];
  pendingAdminPosterDataUrl = "";
  pendingAdminPosterSourceDataUrl = "";
  updateAdminCropPreview("poster");
  if (!file) return;
  if (!isImageFile(file)) {
    adminPosterFileInput.value = "";
    if (adminLibraryHint) adminLibraryHint.textContent = "Faqat rasm fayl tanlang.";
    return;
  }
  if (file.size > MAX_ADMIN_IMAGE_FILE_SIZE) {
    adminPosterFileInput.value = "";
    if (adminLibraryHint) adminLibraryHint.textContent = "Oblojka rasmi 25 MB dan kichik bo'lsin.";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const rawPoster = normalizeImageDataUrlForFile(typeof reader.result === "string" ? reader.result : "", file);
    pendingAdminPosterSourceDataUrl = rawPoster;
    pendingAdminPosterDataUrl = rawPoster;
    if (rawPoster && adminPosterInput) adminPosterInput.value = "";
    updateAdminCropPreview("poster");
    if (adminLibraryHint) {
      adminLibraryHint.textContent = "Oblojka joylashuvini sozlang va saqlashni bosing.";
    }
  });
  reader.addEventListener("error", () => {
    pendingAdminPosterDataUrl = "";
    pendingAdminPosterSourceDataUrl = "";
    updateAdminCropPreview("poster");
    if (adminLibraryHint) adminLibraryHint.textContent = "Rasmni o'qib bo'lmadi.";
  });
  reader.readAsDataURL(file);
});

adminHeroPosterFileInput?.addEventListener("change", () => {
  const file = adminHeroPosterFileInput.files?.[0];
  pendingAdminHeroPosterDataUrl = "";
  pendingAdminHeroPosterReadyPromise = null;
  if (!file) return;
  if (!isImageFile(file)) {
    adminHeroPosterFileInput.value = "";
    if (adminHeroPosterFileStatus) adminHeroPosterFileStatus.textContent = "Rasm fayli tanlanmadi. Faqat JPG, PNG yoki WEBP tanlang.";
    if (adminHeaderHint) adminHeaderHint.textContent = "Faqat rasm fayl tanlang.";
    return;
  }
  if (file.size > MAX_ADMIN_IMAGE_FILE_SIZE) {
    adminHeroPosterFileInput.value = "";
    if (adminHeroPosterFileStatus) adminHeroPosterFileStatus.textContent = "Fayl juda katta. 25 MB dan kichik JPG, PNG yoki WEBP tanlang.";
    if (adminHeaderHint) adminHeaderHint.textContent = "Header ablojka 25 MB dan kichik bo'lsin.";
    return;
  }

  if (adminHeroPosterFileStatus) {
    adminHeroPosterFileStatus.textContent = `Tanlandi: ${file.name || "header rasm"}. Tayyorlanmoqda...`;
  }
  const reader = new FileReader();
  pendingAdminHeroPosterReadyPromise = new Promise((resolve) => {
    reader.addEventListener("load", async () => {
      const rawPoster = normalizeImageDataUrlForFile(typeof reader.result === "string" ? reader.result : "", file);
      try {
        pendingAdminHeroPosterDataUrl = await preparePosterForSharedStorage(rawPoster, HERO_POSTER_COMPRESSION_STEPS);
        if (rawPoster && adminHeroPosterInput) adminHeroPosterInput.value = "";
        if (rawPoster && adminHeroFeaturedInput) adminHeroFeaturedInput.checked = true;
        if (adminHeroPosterFileStatus) {
          adminHeroPosterFileStatus.textContent = `Tanlandi: ${file.name || "header rasm"}. Saqlashni bosing.`;
        }
        if (adminHeaderHint) {
          adminHeaderHint.textContent = "Header ablojka 16:9 formatda tayyor. Endi saqlashni bosing.";
        }
      } catch {
        pendingAdminHeroPosterDataUrl = rawPoster;
        if (rawPoster && adminHeroPosterInput) adminHeroPosterInput.value = "";
        if (rawPoster && adminHeroFeaturedInput) adminHeroFeaturedInput.checked = true;
        if (adminHeroPosterFileStatus) {
          adminHeroPosterFileStatus.textContent = `Tanlandi: ${file.name || "header rasm"}. Saqlashni bosing.`;
        }
        if (adminHeaderHint) {
          adminHeaderHint.textContent = "Header ablojka tayyor. Endi saqlashni bosing.";
        }
      } finally {
        resolve();
      }
    });
    reader.addEventListener("error", () => {
      pendingAdminHeroPosterDataUrl = "";
      if (adminHeroPosterFileStatus) adminHeroPosterFileStatus.textContent = "Rasmni o'qib bo'lmadi. Boshqa rasm tanlang.";
      if (adminHeaderHint) adminHeaderHint.textContent = "Rasmni o'qib bo'lmadi.";
      resolve();
    });
  });
  reader.readAsDataURL(file);
});

adminResetButton?.addEventListener("click", () => {
  const selected = adminDashboardMovies.find((movie) => String(movie.id) === selectedAdminMovieId);
  if (selected) {
    openAdminEditor(selected);
  } else {
    clearAdminEditor();
  }
});

adminMovieForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(adminMovieForm);
  const originalLabel = adminSaveButton?.textContent || t("save");
  if (adminSaveButton) {
    adminSaveButton.disabled = true;
    adminSaveButton.textContent = t("saving");
  }
  saveAdminMovie(formData)
    .then((result) => {
      if (!result?.ok) {
        if (adminLibraryHint) adminLibraryHint.textContent = "Nomi va kategoriya majburiy.";
        return;
      }
      if (adminLibraryHint) {
        adminLibraryHint.textContent = result.mode === "local"
          ? (result.message || "Faqat local saqlandi.")
          : "O'zgarish saqlandi";
      }
    })
    .catch((error) => {
      if (adminLibraryHint) {
        adminLibraryHint.textContent = error?.message || "Saqlash bajarilmadi";
      }
    })
    .finally(() => {
      if (adminSaveButton) {
        adminSaveButton.disabled = false;
        adminSaveButton.textContent = originalLabel;
      }
    });
});

adminMovieList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-admin-edit]");
  if (!button) return;
  const movie = adminDashboardMovies.find((item) => String(item.id) === String(button.dataset.adminEdit || ""));
  openAdminEditor(movie || null);
  renderAdminMovieList(adminDashboardMovies);
});

videoToggleButton.addEventListener("click", toggleYouTubePlayback);
videoCenterAction.addEventListener("click", toggleYouTubePlayback);
videoPrevButton.addEventListener("click", () => playMovieAtIndex(findMovieIndex(activeMovie) - 1));
videoBackButton.addEventListener("click", () => seekYouTubeBy(-10));
videoForwardButton.addEventListener("click", () => seekYouTubeBy(10));
videoNextButton.addEventListener("click", () => playNextMovie());
videoMuteButton.addEventListener("click", toggleYouTubeMute);
videoFullscreenButton.addEventListener("click", toggleVideoFullscreen);
videoSeek.addEventListener("input", () => {
  setRangeFill(videoSeek, Number(videoSeek.value || 0), 1000);
  if (!activeYouTubePlayer) return;
  const duration = Number(activeYouTubePlayer.getDuration?.() || 0);
  if (!duration) return;
  isAdjustingSeek = true;
  pendingSeekTime = (Number(videoSeek.value) / 1000) * duration;
  videoCurrentTime.textContent = formatPlaybackTime(pendingSeekTime);
  videoDuration.textContent = formatPlaybackTime(duration);
});
videoSeek.addEventListener("change", () => {
  if (!activeYouTubePlayer) {
    isAdjustingSeek = false;
    return;
  }
  const duration = Number(activeYouTubePlayer.getDuration?.() || 0);
  if (!duration) {
    isAdjustingSeek = false;
    return;
  }
  pendingSeekTime = (Number(videoSeek.value) / 1000) * duration;
  activeYouTubePlayer.seekTo(pendingSeekTime, true);
  isAdjustingSeek = false;
  updateYouTubeControls();
});
videoVolume.addEventListener("input", () => {
  setRangeFill(videoVolume, Number(videoVolume.value || 0), 100);
  updateYouTubeVolume(videoVolume.value);
});
videoSpeed.addEventListener("change", () => {
  if (!activeYouTubePlayer) return;
  activeYouTubePlayer.setPlaybackRate(Number(videoSpeed.value));
  syncSpeedOptions();
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
  if (event.key === "Escape" && adminEditModal && !adminEditModal.hidden) {
    closeAdminEditor();
    return;
  }
  if (event.key === "Escape" && !videoPlayer.hidden) {
    closeVideoPlayer();
  }
});

async function loadMovies() {
  await resolveApiBase();
  movieLoadState = "loading";
  movieLoadError = "";
  renderMovies();

  try {
    const response = await fetch(buildApiUrl("/api/movies"), {
      headers: { Accept: "application/json" },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error || "Katalog yuklanmadi.");
    }
    movies = applyAdminMovieOverrides(payload.map((movie, index) => normalizeMovie(movie, index)));
    movieLoadState = "ready";
  } catch (error) {
    movies = [];
    movieLoadState = "error";
    movieLoadError = t("loadErrorText");
  }
  renderHeroCarousel();
  syncWatchedCount();
  applyCopy();

  if (adminModal?.open && isAdminUser()) {
    loadAdminDashboard().catch(() => {});
  }

  if (location.hash === "#profile") {
    renderProfileModal();
    profileModal.showModal();
  }
}

loadMovies();
