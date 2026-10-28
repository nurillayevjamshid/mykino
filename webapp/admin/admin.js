// Admin Panel JavaScript - Movies, Subscribers

// Global fetch monkey-patching: inject Telegram initData + always send the
// HttpOnly admin session cookie (credentials: include). Legacy plaintext
// password header is only sent if an older client left one behind, until the
// next successful adminLogin() clears it.
(function() {
  const originalFetch = window.fetch;

  // Sessiya cookie'si eskirganda (7 kun) localStorage'dagi adminLoggedIn belgisi
  // qolaveradi: GET so'rovlar ishlayveradi, lekin har qanday saqlash (POST/PUT/
  // DELETE) 401 "Ruxsat berilmadi" bilan yiqiladi va panel parolni qayta
  // so'ramaydi. Shu holatda bir marta parol so'rab, qayta login qilamiz va
  // asl so'rovni takrorlaymiz. Parallel 401'lar bitta prompt'ga yig'iladi.
  let reloginPromise = null;
  function reloginOnce() {
    if (!reloginPromise) {
      reloginPromise = (async () => {
        try { localStorage.removeItem('adminLoggedIn'); } catch {}
        const password = (window.prompt("Admin sessiyasi muddati tugagan. Parolni qayta kiriting:") || '').trim();
        if (!password) return false;
        const res = await window.adminLogin(password);
        if (!res.ok) {
          alert(res.error || "Parol noto'g'ri.");
          return false;
        }
        return true;
      })().finally(() => { reloginPromise = null; });
    }
    return reloginPromise;
  }

  window.fetch = function(url, options) {
    options = options || {};
    const urlStr = String(url);
    const isApi = urlStr.startsWith('/api/') || (window.location.origin && urlStr.startsWith(window.location.origin + '/api/'));
    if (!isApi) return originalFetch(url, options);

    options.headers = options.headers || {};
    if (window.Telegram?.WebApp?.initData) {
      options.headers['X-TG-Init-Data'] = window.Telegram.WebApp.initData;
    }
    if (!options.credentials) options.credentials = 'include';
    try {
      const legacyPass = localStorage.getItem('adminPassword');
      if (legacyPass && !options.headers['X-Admin-Password']) {
        options.headers['X-Admin-Password'] = legacyPass;
      }
    } catch {}

    // Login/logout so'rovlarida 401-retry qilinmaydi (aks holda cheksiz halqa).
    const isAuthRoute = /[?&]action=admin-log(in|out)(?:&|$)/.test(urlStr);
    const requestMethod = String(options.method || 'GET').toUpperCase();
    return originalFetch(url, options).then(async (resp) => {
      if (resp.ok) invalidateAdminCachesForUrl(urlStr, requestMethod);
      if (resp.status !== 401 || isAuthRoute) return resp;
      const loggedIn = await reloginOnce();
      if (!loggedIn) return resp;
      return originalFetch(url, options).then((retryResp) => {
        if (retryResp.ok) invalidateAdminCachesForUrl(urlStr, requestMethod);
        return retryResp;
      });
    });
  };
})();

// Admin session helpers (mirror webapp/kino/kino.js)
window.adminLogin = async function adminLogin(password) {
  if (!password) return { ok: false, error: "Parol kerak" };
  try {
    const resp = await fetch(`/api/users?action=admin-login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.ok) {
      try { localStorage.removeItem("adminPassword"); } catch {}
      try { localStorage.setItem("adminLoggedIn", "1"); } catch {}
      return { ok: true };
    }
    if (resp.status === 429) return { ok: false, locked: true, error: data.error || "Juda ko'p urinish." };
    return { ok: false, error: data.error || "Parol noto'g'ri." };
  } catch (e) {
    return { ok: false, error: e?.message || "Tarmoq xatosi" };
  }
};
window.adminLogout = async function adminLogout() {
  try { await fetch(`/api/users?action=admin-logout`, { method: "POST", credentials: "include" }); } catch {}
  try { localStorage.removeItem("adminLoggedIn"); } catch {}
  try { localStorage.removeItem("adminPassword"); } catch {}
};
window.ensureAdminSession = async function ensureAdminSession(promptMsg) {
  if (localStorage.getItem("adminLoggedIn") === "1") return true;
  const password = (window.prompt(promptMsg || "Admin parolini kiriting:") || "").trim();
  if (!password) return false;
  const r = await window.adminLogin(password);
  if (!r.ok) { alert(r.error || "Kirish muvaffaqiyatsiz"); return false; }
  return true;
};

// Data storage
let movies = [];
let filteredMovies = [];
let currentSearchQuery = '';
const MOVIES_PAGE_SIZE = 30;
let moviesCurrentPage = 1;
const MUSIC_PAGE_SIZE = 30;
let musicCurrentPage = 1;
const USERS_PAGE_SIZE = 40;
let usersCurrentPage = 1;
let selectedPosterDataUrl = '';
let selectedHeaderDataUrl = '';

let usersList = [];
let filteredUsers = [];
let userSearchQuery = '';

const SECTION_TITLES = {
  movies: 'Kinolar',
  music: 'Musiqa',
  podcasts: 'Potkastlar',
  categories: 'Kategoriyalar',
  users: 'Obunachilar',
  ad: 'Reklama',
  fifa: 'Futbol',
  esportsStreams: 'Kibersport translatsiyalari',
  tv: 'TV kanallar',
};

// Modal kategoriyalari uchun: tanlangan + mavjudlar ro'yxati
const selectedCategories = new Set();
let availableCategories = [];

// API base URL
const API_URL = '/api';
const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;
const POSTER_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
function debounce(fn, wait = 280) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Section kataloglari uchun yengil stale-while-revalidate cache.
// Cache faqat tezkor UI snapshot: serverdagi haqiqiy ma'lumotni almashtirmaydi.
const ADMIN_CACHE_TTL = 5 * 60 * 1000;
const ADMIN_CACHE_PREFIX = 'mykino-admin-cache-v2:';
function readAdminCache(name) {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_PREFIX + name);
    if (!raw) return null;
    const item = JSON.parse(raw);
    if (!item || !item.savedAt || typeof item.data === 'undefined') return null;
    return { ...item, fresh: Date.now() - item.savedAt < ADMIN_CACHE_TTL };
  } catch (_) { return null; }
}
function writeAdminCache(name, data, etag = '') {
  try {
    localStorage.setItem(ADMIN_CACHE_PREFIX + name, JSON.stringify({ savedAt: Date.now(), etag, data }));
  } catch (_) { /* localStorage quota — network response still works */ }
}
function clearAdminCache(...names) {
  try { names.forEach((name) => localStorage.removeItem(ADMIN_CACHE_PREFIX + name)); } catch (_) {}
}
function invalidateAdminCachesForUrl(url, method = 'GET') {
  if (/^(GET|HEAD)$/i.test(method)) return;
  const value = String(url || '');
  if (value.includes('/movies') || value.includes('/movie-update')) clearAdminCache('movies', 'categories');
  if (value.includes('/series')) clearAdminCache('series', 'categories');
  if (value.includes('/music')) clearAdminCache('music');
  if (value.includes('/users')) clearAdminCache('users');
  if (value.includes('/podcasts')) clearAdminCache('podcasts');
  if (value.includes('/categories')) clearAdminCache('categories');
}
function cachedRequestHeaders(cached, force) {
  const headers = {};
  if (!force && cached?.etag) headers['If-None-Match'] = cached.etag;
  return headers;
}
const POSTER_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="50" height="70" viewBox="0 0 50 70"><rect width="50" height="70" fill="#1a1f2e"/><text x="25" y="38" text-anchor="middle" font-family="Arial" font-size="9" fill="#ffc73a">No Image</text></svg>');

// Cloudflare R2 domeni:
// Diqqat: r2.myplaylist.uz domenida DNS sozlanmagan (ENOTFOUND qaytaradi).
// Shuning uchun bazada r2.myplaylist.uz deb yozilgan yoki pub-xxx deb yozilgan
// barcha R2 posterlari va cdnUrl'lar ishlab turgan haqiqiy pub-42c7619e0f49402bb099364c0b589eca.r2.dev
// domeniga yo'naltiriladi.
const R2_LIVE_HOST = 'pub-42c7619e0f49402bb099364c0b589eca.r2.dev';
const R2_BROKEN_HOST = 'r2.myplaylist.uz';
function proxiedPoster(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (u.includes(R2_BROKEN_HOST)) return u.split(R2_BROKEN_HOST).join(R2_LIVE_HOST);
  return u;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Holat matnlari rangi CSS'da ([data-tone]) — har joyda alohida hex yozilmaydi.
function setTone(el, kind) {
  if (!el) return;
  if (kind === 'error' || kind === 'ok' || kind === 'warn' || kind === 'info') el.dataset.tone = kind;
  else delete el.dataset.tone;
}

// Jadval va kartalardagi amal tugmalari uchun bir xil SVG ikonlar.
const ADMIN_ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16l13-8Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg>',
};

const NATURAL_SORT_COLLATOR = new Intl.Collator('uz', { numeric: true, sensitivity: 'base' });

function stripFileExtension(value) {
  return String(value || '').replace(/\.[a-z0-9]{2,5}$/i, '');
}

function normalizeNaturalSortText(value) {
  return stripFileExtension(value)
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEpisodeSortText(entry) {
  return normalizeNaturalSortText(
    entry?.title
    || entry?.defaultTitle
    || entry?.fileName
    || ''
  );
}

function compareSeriesEpisodes(left, right) {
  const byTitle = NATURAL_SORT_COLLATOR.compare(getEpisodeSortText(left), getEpisodeSortText(right));
  if (byTitle) return byTitle;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function sameMovieId(left, right) {
  return String(left) === String(right);
}

function splitCategories(value) {
  return String(value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function joinCategories(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result.join(', ');
}

function collectKnownCategories() {
  const seen = new Set();
  const names = [];
  for (const movie of movies) {
    for (const name of splitCategories(movie.category)) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
  }
  names.sort((a, b) => a.localeCompare(b, 'uz'));
  return names;
}

function syncAvailableCategories() {
  const seen = new Set();
  const merged = [];
  const push = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(trimmed);
  };
  for (const name of collectKnownCategories()) push(name);
  for (const name of availableCategories) push(name);
  for (const name of selectedCategories) push(name);
  merged.sort((a, b) => a.localeCompare(b, 'uz'));
  availableCategories = merged;
}

function renderCategoryChips() {
  const container = document.getElementById('movieCategoryChips');
  if (!container) return;
  syncAvailableCategories();

  const selectedLower = new Set([...selectedCategories].map(name => name.toLowerCase()));
  container.innerHTML = availableCategories
    .map(name => {
      const isSelected = selectedLower.has(name.toLowerCase());
      return `<button type="button" class="category-chip${isSelected ? ' is-selected' : ''}" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
    })
    .join('');
}

function normalizeMovieFromApi(movie) {
  const headerImage = movie.headerImage !== undefined && movie.headerImage !== null
    ? String(movie.headerImage).trim()
    : String(movie.heroPoster || movie.headerPoster || movie.heroImage || '').trim();
  const showInHeader = Boolean(movie.showInHeader || movie.heroFeatured) && Boolean(headerImage);
  return {
    id: String(movie.id || movie.fileId || movie.driveFileId || ''),
    name: movie.title || movie.fileName || 'Kino',
    category: movie.genre || movie.category || 'Kino',
    rating: Number(movie.rating || 0),
    hd: String(movie.quality || 'HD').toUpperCase() !== 'SD',
    poster: movie.posterImage || movie.poster || movie.thumbnail || '',
    headerImage,
    showInHeader,
    description: movie.description || '',
    year: movie.year || '',
    code: movie.code || '',
    quality: movie.quality || 'HD'
  };
}

// Fetch movies from API
async function fetchMovies(force = false) {
  const tbody = document.getElementById('moviesTableBody');
  const cached = readAdminCache('movies');
  const applyMovies = (data) => {
    movies = (Array.isArray(data) ? data : []).map(normalizeMovieFromApi).filter(movie => movie.id);
    filteredMovies = [...movies];
    renderMovies();
    syncAvailableCategories();
  };
  if (cached?.data && !force) {
    applyMovies(cached.data);
    if (cached.fresh) return movies;
  }
  if (tbody && (force || !cached?.data)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Kinolar yuklanmoqda...</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/movies`, { headers: cachedRequestHeaders(cached, force) });
    if (response.status === 304 && cached?.data) {
      writeAdminCache('movies', cached.data, cached.etag);
      return movies;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Server xatolik: ${response.status}`);
    }
    const data = await response.json();
    writeAdminCache('movies', data, response.headers.get('ETag') || '');
    applyMovies(data);
    return movies;
  } catch (error) {
    console.error('Error fetching movies:', error);
    if (cached?.data) return movies;
    movies = [];
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state error-state">
              <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <h3>Kinolarni yuklashda xatolik!</h3>
              <p>${escapeHtml(error.message)}</p>
              <button class="btn btn-primary" onclick="fetchMovies()">Qayta urinish</button>
            </div>
          </td>
        </tr>
      `;
    }
    showNotification('Kinolarni yuklashda xatolik: ' + error.message, 'error');
  }
}

// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const themeToggle = document.getElementById('themeToggle');

// ===== Telegram WebApp integration =====
const tg = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
const isMobileViewport = () => window.innerWidth <= 768;

function tgHaptic(kind = 'light') {
  try {
    if (!tg || !tg.HapticFeedback) return;
    if (kind === 'success' || kind === 'error' || kind === 'warning') tg.HapticFeedback.notificationOccurred(kind);
    else if (kind === 'selection') tg.HapticFeedback.selectionChanged();
    else tg.HapticFeedback.impactOccurred(kind);
  } catch (_) { /* ignore */ }
}

// telegram-web-app.js oddiy brauzerda ham yuklanadi — u yerda themeParams bo'sh
// bo'lib, oq fonni :root ga yozib qo'yadi va qorong'i rejimni buzadi.
const isInsideTelegram = () => Boolean(tg && tg.initData);

function applyTelegramTheme() {
  if (!isInsideTelegram() || !tg.themeParams) return;
  const tp = tg.themeParams;
  const root = document.documentElement;
  const set = (cssVar, val) => { if (val) root.style.setProperty(cssVar, val); };
  const pageBg = tp.secondary_bg_color || tp.bg_color || '#eef0f5';
  set('--page-bg', pageBg);
  set('--bg-dark', pageBg);
  set('--bg-card', tp.bg_color || '#ffffff');
  set('--card-bg', tp.bg_color || '#ffffff');
  set('--bg-sidebar', tp.bg_color || '#ffffff');
  set('--bg-shell', tp.bg_color || '#ffffff');
  set('--bg-elevated', tp.secondary_bg_color || '#f1f3f9');
  set('--surface-bg', tp.secondary_bg_color || '#f1f3f9');
  set('--text', tp.text_color);
  set('--text-secondary', tp.text_color);
  set('--text-muted', tp.hint_color);
  set('--primary', tp.button_color);
  set('--primary-dark', tp.button_color);
  if (tp.button_color) {
    root.style.setProperty('--primary-soft', hexToRgba(tp.button_color, 0.10));
    root.style.setProperty('--primary-bg', hexToRgba(tp.button_color, 0.15));
  }
  const scheme = tg.colorScheme || (tp.bg_color && isDarkColor(tp.bg_color) ? 'dark' : 'light');
  root.setAttribute('data-theme', scheme);

  try { tg.setHeaderColor?.(tp.bg_color || pageBg); } catch (_) {}
  try { tg.setBackgroundColor?.(pageBg); } catch (_) {}
  try { tg.setBottomBarColor?.(pageBg); } catch (_) {}
}

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return `rgba(61, 74, 223, ${alpha})`;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
function isDarkColor(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return false;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

// BackButton stack: latest registered handler runs on press
const tgBackStack = [];
function tgPushBack(handler) {
  if (!tg || !tg.BackButton) { tgBackStack.push(handler); return; }
  tgBackStack.push(handler);
  tg.BackButton.show();
  tg.BackButton.onClick(handleTgBack);
}
function tgPopBack() {
  tgBackStack.pop();
  if (!tg || !tg.BackButton) return;
  if (tgBackStack.length === 0) {
    try { tg.BackButton.offClick(handleTgBack); } catch (_) {}
    tg.BackButton.hide();
  }
}
function handleTgBack() {
  const fn = tgBackStack[tgBackStack.length - 1];
  if (typeof fn === 'function') { try { fn(); } catch (_) {} }
}

// MainButton helper for bottom-sheet form actions
function tgShowMainButton(text, onClick) {
  if (!tg || !tg.MainButton) return;
  tg.MainButton.setText(text);
  tg.MainButton.show();
  tg.MainButton.onClick(onClick);
  return () => { try { tg.MainButton.offClick(onClick); tg.MainButton.hide(); } catch (_) {} };
}

// Theme management - Light mode as default (used outside Telegram)
const savedTheme = localStorage.getItem('admin-theme') || 'light';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.setAttribute('data-theme', theme);
  if (tg) {
    const isDark = theme === 'dark';
    const bg = isDark ? '#0b1020' : '#eef0f5';
    const headerBg = isDark ? '#11172a' : '#ffffff';
    try { tg.setHeaderColor?.(headerBg); } catch (_) {}
    try { tg.setBackgroundColor?.(bg); } catch (_) {}
    try { tg.setBottomBarColor?.(bg); } catch (_) {}
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem('admin-theme', newTheme);
  applyTheme(newTheme);
}

// Initialize
async function init() {
  // Telegram first — overrides local theme if inside Mini App
  if (isInsideTelegram()) {
    try {
      tg.ready();
      tg.expand();
      if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
      applyTelegramTheme();
      tg.onEvent('themeChanged', applyTelegramTheme);
      tg.onEvent('viewportChanged', () => {
        document.documentElement.style.setProperty('--tg-viewport-h', `${tg.viewportHeight}px`);
      });
    } catch (_) { applyTheme(savedTheme); }
  } else {
    applyTheme(savedTheme);
  }

  await fetchMovies();
  bindEvents();
  bindBottomSheetDrag();
  createSidebarOverlay();

  const savedSection = localStorage.getItem('admin-section');
  if (savedSection === 'categories') {
    // Oldingi versiyadagi alohida sidebar bo'limini kino ichidagi tabga migrate qilamiz.
    localStorage.setItem('admin-section', 'movies');
    switchMovieTab('categories');
  } else if (savedSection && savedSection !== 'movies') {
    switchSection(savedSection);
  }
}

// ===== Bottom-sheet swipe-down to close (modals) =====
function bindBottomSheetDrag() {
  document.querySelectorAll('.modal').forEach(modal => {
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    let startY = 0, deltaY = 0, dragging = false, startTime = 0;

    const header = content.querySelector('.modal-header');
    const target = header || content;

    target.addEventListener('touchstart', (e) => {
      if (!isMobileViewport()) return;
      if (content.scrollTop > 0) return; // let content scroll
      const t = e.touches[0];
      startY = t.clientY;
      deltaY = 0;
      dragging = true;
      startTime = Date.now();
      content.style.transition = 'none';
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      deltaY = Math.max(0, t.clientY - startY);
      content.style.transform = `translateY(${deltaY}px)`;
    }, { passive: true });

    target.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      content.style.transition = 'transform 0.25s ease';
      const elapsed = Date.now() - startTime;
      const fast = elapsed < 300 && deltaY > 60;
      if (deltaY > 140 || fast) {
        content.style.transform = 'translateY(100%)';
        setTimeout(() => {
          content.style.transform = '';
          modal.classList.remove('active');
          tgPopBack();
        }, 220);
      } else {
        content.style.transform = '';
      }
    });
  });
}

function switchSection(name) {
  const sections = {
    movies: 'moviesSection',
    music: 'musicSection',
    podcasts: 'podcastsSection',
    users: 'usersSection',
    ad: 'adSection',
    fifa: 'fifaSection',
    esportsStreams: 'esportsStreamsSection',
    tv: 'tvSection',
  };
  const targetId = sections[name];
  if (!targetId) return;

  localStorage.setItem('admin-section', name);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === name);
  });
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.toggle('active', section.id === targetId);
  });

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = SECTION_TITLES[name] || 'Admin';

  if (name === 'users') fetchUsers();
  if (name === 'music') fetchMusic();
  if (name === 'podcasts') { fetchPodcasts(); fetchPodLangs(); }
  if (name === 'ad') { loadAdSettings(); loadPreRollSettings(); loadPreRollDriveVideos(); loadTickerSettings(); }
  if (name === 'fifa') { loadFifaHighlights(); loadFifaStreamsSettings(); loadFifaTvSettings(); }
  if (name === 'esportsStreams') { loadEsportsStreams(); }
  if (name === 'tv') { loadTvChannelsAdmin(); }

  if (window.innerWidth <= 768) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('menuToggle')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }
}

// ------------- Subscribers -------------
function normalizeUser(record) {
  const firstSeenAt = Number(record.firstSeenAt) || 0;
  const startedRaw = record.started_at || (firstSeenAt ? new Date(firstSeenAt).toISOString().slice(0, 10) : '');
  // last_active — bot har /start da yozadigan to'liq vaqt (ISO). Eski
  // yozuvlarda yo'q, o'shanda kunlik last_seen_at ga tushamiz.
  const lastActiveRaw = record.last_active || record.last_seen_at || '';
  return {
    telegram_id: record.telegram_id || record.id || record.telegramId || '',
    username: record.username || '',
    first_name: record.first_name || record.firstName || record.firstSeenName || '',
    last_name: record.last_name || record.lastName || '',
    started_at: String(startedRaw || '').slice(0, 10),
    last_active: lastActiveRaw,
    last_seen_at: record.last_seen_at || '',
    _sortTs: firstSeenAt || (startedRaw ? Date.parse(startedRaw) : 0),
    _activeTs: lastActiveRaw ? Date.parse(lastActiveRaw) : 0,
  };
}

// ISO vaqtni admin panel uchun o'qishli ko'rinishga keltiradi:
// "2026-09-11T13:54:53.288658+00:00" -> "2026-09-11 13:54"
function formatLastActive(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const ts = Date.parse(raw);
  if (!ts) return escapeHtml(raw.slice(0, 16).replace('T', ' '));
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// To'liq ism: "Ali Valiyev" (last_name bo'lmasa faqat first_name).
function userFullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}

let usersSortMode = 'newest';
let usersDateFrom = '';
let usersDateTo = '';
let usersStatusFilter = 'all';
let usersActivityFilter = 'all';
const USER_META_KEY = 'mykino-admin-user-meta-v1';
function readUserMeta() { try { return JSON.parse(localStorage.getItem(USER_META_KEY) || '{}'); } catch (_) { return {}; } }
function writeUserMeta(meta) { localStorage.setItem(USER_META_KEY, JSON.stringify(meta)); }
function getUserStatus(user) {
  const meta = readUserMeta()[String(user.telegram_id)] || {};
  if (meta.blocked) return 'blocked';
  const ts = user._activeTs || user._sortTs || 0;
  return ts && Date.now() - ts <= 30 * 86400000 ? 'active' : 'inactive';
}
function userStatusLabel(status) { return { active: 'Faol', inactive: 'Nofaol', blocked: 'Bloklangan' }[status] || status; }
function userStatusClass(status) { return `user-status user-status--${status}`; }
function setUsersQuickRange(range) {
  const now = new Date(); const to = now.toISOString().slice(0, 10); let from = to;
  if (range === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  else if (range === '7' || range === '30') { const d = new Date(now); d.setDate(d.getDate() - Number(range) + 1); from = d.toISOString().slice(0, 10); }
  setUsersDateRange(from, to);
  document.querySelectorAll('.users-quick-date').forEach(btn => btn.classList.toggle('is-active', btn.dataset.usersRange === range));
}
function downloadUserExport(format) {
  const data = filteredUsers.map(u => ({ name: userFullName(u), username: u.username ? '@' + u.username : '', telegram_id: u.telegram_id, started_at: u.started_at, last_active: u.last_active, status: userStatusLabel(getUserStatus(u)), segment: readUserMeta()[String(u.telegram_id)]?.segment || '' }));
  let content, type, ext;
  if (format === 'csv') { const keys = Object.keys(data[0] || { name: '', username: '', telegram_id: '', started_at: '', last_active: '', status: '', segment: '' }); const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`; content = [keys.join(','), ...data.map(row => keys.map(k => cell(row[k])).join(','))].join('\n'); type = 'text/csv;charset=utf-8'; ext = 'csv'; }
  else { content = JSON.stringify(data, null, 2); type = 'application/json;charset=utf-8'; ext = 'json'; }
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = `mykino-obunachilar-${new Date().toISOString().slice(0, 10)}.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  showNotification(`${data.length} ta obunachi ${ext.toUpperCase()} formatda yuklandi.`);
}
function openUserDrawer(user) {
  if (!user) return;
  let drawer = document.getElementById('userDetailDrawer');
  if (!drawer) { drawer = document.createElement('aside'); drawer.id = 'userDetailDrawer'; drawer.className = 'user-detail-drawer'; document.body.appendChild(drawer); }
  const meta = readUserMeta(); const id = String(user.telegram_id); const current = meta[id] || {}; const status = getUserStatus(user);
  drawer.innerHTML = `<div class="user-drawer__head"><div><small>Obunachi profili</small><h3>${escapeHtml(userFullName(user) || '@' + (user.username || id))}</h3></div><button type="button" class="modal-close" data-user-drawer-close>×</button></div><div class="user-drawer__body"><div class="user-profile-id"><strong>${user.username ? '@' + escapeHtml(user.username) : 'Username yo‘q'}</strong><code>${escapeHtml(id)}</code></div><div class="user-stat-grid"><div><small>/start sanasi</small><strong>${escapeHtml(user.started_at || '-')}</strong></div><div><small>Oxirgi faollik</small><strong>${escapeHtml(formatLastActive(user.last_active))}</strong></div></div><div class="user-detail-block"><span>Status</span><strong class="${userStatusClass(status)}">${userStatusLabel(status)}</strong></div><div class="user-detail-block"><span>Segment</span><input id="userSegmentInput" class="form-input" value="${escapeHtml(current.segment || '')}" placeholder="Masalan: VIP, reklama-2026"></div><div class="user-detail-block"><span>Ko‘rish tarixi</span><p class="form-hint">Bu foydalanuvchi uchun ko‘rish tarixi API’da mavjud bo‘lsa, shu yerda ko‘rsatiladi. Hozircha alohida tarix yozuvi topilmadi.</p></div><div class="user-detail-block"><span>Yuborilgan xabarlar</span><p class="form-hint">Broadcast tarixiga ulanish tayyorlanmagan.</p></div><div class="user-drawer__actions"><button type="button" class="btn btn-primary" data-user-segment-save>Segmentni saqlash</button><button type="button" class="btn ${status === 'blocked' ? 'btn-secondary' : 'btn-danger'}" data-user-block>${status === 'blocked' ? 'Blokdan chiqarish' : 'Bloklash'}</button></div></div>`;
  requestAnimationFrame(() => drawer.classList.add('is-open'));
  const close = () => drawer.classList.remove('is-open'); drawer.querySelector('[data-user-drawer-close]').onclick = close;
  drawer.querySelector('[data-user-segment-save]').onclick = () => { const next = readUserMeta(); next[id] = { ...(next[id] || {}), segment: drawer.querySelector('#userSegmentInput').value.trim() }; writeUserMeta(next); showNotification('Segment saqlandi.'); };
  drawer.querySelector('[data-user-block]').onclick = () => { const next = readUserMeta(); next[id] = { ...(next[id] || {}), blocked: status !== 'blocked' }; writeUserMeta(next); close(); applyUsersFilterSort(); renderUsers(); showNotification(status === 'blocked' ? 'Obunachi blokdan chiqarildi.' : 'Obunachi bloklandi.'); };
}

async function fetchUsers(force = false) {
  const tbody = document.getElementById('usersTableBody');
  const cached = readAdminCache('users');
  const applyUsers = (data) => {
    const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
    usersList = list.map(normalizeUser);
    applyUsersFilterSort();
    renderUsers();
  };
  if (cached?.data && !force) {
    applyUsers(cached.data);
    if (cached.fresh) return usersList;
  }
  if (tbody && (force || !cached?.data)) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Obunachilar yuklanmoqda...</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/users`, { headers: cachedRequestHeaders(cached, force) });
    if (response.status === 304 && cached?.data) {
      writeAdminCache('users', cached.data, cached.etag);
      return usersList;
    }
    if (!response.ok) throw new Error(`Server xatolik: ${response.status}`);
    const data = await response.json();
    writeAdminCache('users', data, response.headers.get('ETag') || '');
    applyUsers(data);
    return usersList;
  } catch (error) {
    console.error('Error fetching users:', error);
    if (cached?.data) return usersList;
    usersList = [];
    filteredUsers = [];
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state error-state">
              <h3>Obunachilarni yuklashda xatolik!</h3>
              <p>${escapeHtml(error.message)}</p>
              <button class="btn btn-primary" onclick="fetchUsers()">Qayta urinish</button>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function applyUsersFilterSort() {
  let list = [...usersList];
  if (userSearchQuery) {
    list = list.filter(u => {
      const haystack = [u.first_name, u.last_name, u.username, String(u.telegram_id), u.started_at, u.last_active]
        .join(' ').toLowerCase();
      return haystack.includes(userSearchQuery);
    });
  }
  if (usersStatusFilter !== 'all') list = list.filter(u => getUserStatus(u) === usersStatusFilter);
  if (usersActivityFilter !== 'all') {
    const days = usersActivityFilter === 'today' ? 1 : Number(usersActivityFilter);
    const since = Date.now() - days * 86400000;
    list = list.filter(u => (u._activeTs || 0) >= since);
  }
  const fromTs = usersDateFrom ? Date.parse(usersDateFrom + 'T00:00:00') : 0;
  const toTs = usersDateTo ? Date.parse(usersDateTo + 'T23:59:59') : 0;
  if (fromTs || toTs) {
    list = list.filter(u => {
      // Faol bo'lganlarni last_active, aks holda /start sanasi bo'yicha filtrlaymiz.
      const ts = u._activeTs || u._sortTs || (u.started_at ? Date.parse(u.started_at + 'T12:00:00') : 0);
      if (!ts) return false;
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }
  const nameCollator = new Intl.Collator('uz', { sensitivity: 'base' });
  switch (usersSortMode) {
    case 'oldest':
      list.sort((a, b) => (a._sortTs || 0) - (b._sortTs || 0));
      break;
    case 'name-asc':
      list.sort((a, b) => nameCollator.compare(userFullName(a), userFullName(b)));
      break;
    case 'name-desc':
      list.sort((a, b) => nameCollator.compare(userFullName(b), userFullName(a)));
      break;
    case 'active':
      list.sort((a, b) => (b._activeTs || 0) - (a._activeTs || 0));
      break;
    case 'newest':
    default:
      list.sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));
      break;
  }
  filteredUsers = list;
}

function filterUsers(query) {
  userSearchQuery = String(query || '').toLowerCase().trim();
  usersCurrentPage = 1;
  applyUsersFilterSort();
  renderUsers();
}

function setUsersSort(mode) {
  usersSortMode = mode || 'newest';
  usersCurrentPage = 1;
  applyUsersFilterSort();
  renderUsers();
}

function setUsersDateRange(from, to) {
  usersDateFrom = from || '';
  usersDateTo = to || '';
  usersCurrentPage = 1;
  applyUsersFilterSort();
  renderUsers();
}

function renderListPagination(kind, totalItems, currentPage, pageSize) {
  const wrap = document.getElementById(`${kind}Pagination`);
  const pagesWrap = document.getElementById(`${kind}PaginationPages`);
  const info = document.getElementById(`${kind}PaginationInfo`);
  if (!wrap || !pagesWrap) return;
  if (totalItems <= pageSize) {
    wrap.hidden = true;
    pagesWrap.innerHTML = '';
    if (info) info.textContent = '';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  wrap.hidden = false;
  wrap.querySelector('[data-page-action="prev"]')?.toggleAttribute('disabled', currentPage <= 1);
  wrap.querySelector('[data-page-action="next"]')?.toggleAttribute('disabled', currentPage >= totalPages);
  pagesWrap.innerHTML = buildPageList(currentPage, totalPages).map((page) =>
    page === '…'
      ? '<span class="pagination__page is-ellipsis">…</span>'
      : `<button type="button" class="pagination__page${page === currentPage ? ' is-active' : ''}" data-page="${page}">${page}</button>`
  ).join('');
  if (info) {
    const start = (currentPage - 1) * pageSize + 1;
    info.textContent = `${start}-${Math.min(totalItems, currentPage * pageSize)} / ${totalItems}`;
  }
}

function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const list = filteredUsers;
  const hasFilter = !!(userSearchQuery || usersDateFrom || usersDateTo || usersStatusFilter !== 'all' || usersActivityFilter !== 'all');

  const sectionHeader = document.querySelector('#usersSection .section-header h2');
  if (sectionHeader) {
    const total = usersList.length;
    // When a search/date filter is active, the table only shows the matching
    // subscribers, so the header must reflect that visible count (with the
    // total for context) instead of always printing the full total.
    sectionHeader.textContent = hasFilter
      ? `Obunachilar ro'yxati (${list.length} / ${total})`
      : `Obunachilar ro'yxati (${total})`;
  }

  if (list.length === 0) {
    renderListPagination('users', 0, usersCurrentPage, USERS_PAGE_SIZE);
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <h3>${hasFilter ? 'Filtr natijasi yo\'q' : 'Obunachilar hali yo\'q'}</h3>
            <p>${hasFilter ? 'Boshqa qidiruv yoki sana oralig\'ini sinab ko\'ring.' : 'Foydalanuvchilar /start bosishi bilan bu yerda ko\'rinadi.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(list.length / USERS_PAGE_SIZE));
  usersCurrentPage = Math.max(1, Math.min(totalPages, usersCurrentPage));
  const start = (usersCurrentPage - 1) * USERS_PAGE_SIZE;
  const pageSlice = list.slice(start, start + USERS_PAGE_SIZE);
  renderListPagination('users', list.length, usersCurrentPage, USERS_PAGE_SIZE);
  tbody.innerHTML = pageSlice.map((user, index) => {
    const fullName = userFullName(user) || 'Nomsiz foydalanuvchi';
    const initial = (fullName.trim()[0] || 'U').toUpperCase();
    const status = getUserStatus(user);
    return `
    <tr class="user-row user-card-row" data-user-row data-user-id="${escapeHtml(String(user.telegram_id))}" tabindex="0" aria-expanded="false">
      <td class="col-user-idx desktop-only">${start + index + 1}</td>
      <td class="col-user-avatar mobile-only">
        <div class="user-avatar-circle status-${status}">
          <span>${escapeHtml(initial)}</span>
        </div>
      </td>
      <td class="user-row__name col-user-info">
        <div class="user-info-wrap">
          <div class="user-top-line">
            <strong class="user-name">${escapeHtml(fullName)}</strong>
            <span class="${userStatusClass(status)} mobile-only">${userStatusLabel(status)}</span>
          </div>
          <div class="user-meta-line mobile-only">
            ${user.username ? `<span class="user-username">@${escapeHtml(user.username)}</span>` : ''}
            <span class="user-id-chip">ID: ${escapeHtml(String(user.telegram_id || '-'))}</span>
          </div>
          <div class="user-dates-line mobile-only">
            <span>Start: ${escapeHtml(user.started_at || '-')}</span>
            <span>Faol: ${formatLastActive(user.last_active)}</span>
          </div>
        </div>
      </td>
      <td class="user-row__username col-user-username desktop-only">${user.username ? '@' + escapeHtml(user.username) : '-'}</td>
      <td class="user-row__detail col-user-id desktop-only"><code>${escapeHtml(String(user.telegram_id || '-'))}</code></td>
      <td class="user-row__detail col-user-started desktop-only">${escapeHtml(user.started_at || '-')}</td>
      <td class="user-row__detail col-user-active desktop-only">${formatLastActive(user.last_active)}</td>
      <td class="col-user-status desktop-only"><span class="${userStatusClass(status)}">${userStatusLabel(status)}</span></td>
      <td class="col-user-expand mobile-only"><span class="user-expand-arrow">›</span></td>
    </tr>
  `;
  }).join('');
}

// Create sidebar overlay for mobile
function createSidebarOverlay() {
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);
  }
  overlay.onclick = () => {
    sidebar?.classList.remove('open');
    menuToggle?.classList.remove('active');
    overlay.classList.remove('active');
  };
}

function commandPaletteItems(query = '') {
  const q = String(query || '').toLowerCase().trim();
  const items = [
    { type: 'command', icon: '＋', label: 'Yangi kino qo\'shish', hint: 'Kinolar bo\'limi', action: () => { switchSection('movies'); showNotification('Yangi kino qo\'shish uchun Google Drive papkasiga fayl yuklang.', 'error'); } },
    { type: 'command', icon: '▣', label: 'Kinolar bo\'limini ochish', hint: 'Navigation', action: () => switchSection('movies') },
    { type: 'command', icon: '♫', label: 'Musiqa bo\'limini ochish', hint: 'Navigation', action: () => switchSection('music') },
    { type: 'command', icon: '♙', label: 'Obunachilarni ochish', hint: 'Navigation', action: () => switchSection('users') },
    { type: 'command', icon: '◈', label: 'Reklama bo\'limini ochish', hint: 'Navigation', action: () => switchSection('ad') },
  ];
  const data = [
    ...movies.map(m => ({ type: 'movie', icon: '🎬', label: m.name, hint: `${m.code || m.id} · ${m.category || 'Kino'}`, action: () => { switchSection('movies'); editMovie(m.id); }, item: m })),
    ...seriesList.map(x => ({ type: 'series', icon: '▤', label: x.name, hint: `${x.episodeCount || 0} ta qism`, action: () => { switchSection('movies'); switchMovieTab('series'); editSeries(x.id); }, item: x })),
    ...usersList.map(u => ({ type: 'user', icon: '♙', label: userFullName(u) || `@${u.username || u.telegram_id}`, hint: u.username ? `@${u.username}` : String(u.telegram_id || ''), action: () => switchSection('users'), item: u })),
    ...musicTracks.map(t => ({ type: 'music', icon: '♫', label: t.title, hint: t.artist, action: () => switchSection('music'), item: t })),
  ];
  const source = q ? [...items, ...data] : [...items, ...readRecentAdminItems()];
  return source.filter(item => !q || `${item.label} ${item.hint}`.toLowerCase().includes(q)).slice(0, 12);
}
function readRecentAdminItems() {
  try {
    return JSON.parse(localStorage.getItem('mykino-admin-recent-v1') || '[]').map(item => ({
      ...item,
      action: () => {
        const movie = movies.find(m => m.name === item.label);
        if (movie) { switchSection('movies'); editMovie(movie.id); return; }
        switchSection('movies');
      },
    }));
  } catch (_) { return []; }
}
function saveRecentAdminItem(item) {
  if (!item?.label) return;
  try {
    const next = [{ type: item.type || 'recent', icon: item.icon || '↗', label: item.label, hint: item.hint || '', action: () => switchSection('movies') }, ...readRecentAdminItems().filter(x => x.label !== item.label)].slice(0, 6);
    localStorage.setItem('mykino-admin-recent-v1', JSON.stringify(next.map(({ action, ...rest }) => rest)));
  } catch (_) {}
}
function ensureCommandPalette() {
  if (document.getElementById('commandPalette')) return;
  const modal = document.createElement('div');
  modal.className = 'modal command-palette-modal'; modal.id = 'commandPalette';
  modal.innerHTML = `<div class="modal-content command-palette-content" role="dialog" aria-modal="true" aria-labelledby="commandPaletteTitle">
    <div class="modal-header"><div><h3 id="commandPaletteTitle">Tezkor qidiruv</h3><small>Bo\'lim, buyruq, kino yoki obunachini toping</small></div><button class="modal-close" type="button" data-command-close aria-label="Yopish">&times;</button></div>
    <div class="command-search-wrap"><span>⌘</span><input id="commandPaletteInput" type="search" autocomplete="off" placeholder="Qidirish yoki buyruq yozish..."><kbd>ESC</kbd></div>
    <div id="commandPaletteResults" class="command-palette-results"></div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => { modal.classList.remove('active'); };
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-command-close]')) close(); });
  const input = modal.querySelector('#commandPaletteInput');
  const render = () => { const results = commandPaletteItems(input.value); modal.querySelector('#commandPaletteResults').innerHTML = results.length ? results.map((x, i) => `<button type="button" class="command-result" data-command-index="${i}"><span class="command-result-icon">${x.icon}</span><span><strong>${escapeHtml(x.label)}</strong><small>${escapeHtml(x.hint)}</small></span><kbd>${x.type === 'command' ? '↵' : ''}</kbd></button>`).join('') : '<div class="command-empty">Hech narsa topilmadi.</div>'; };
  input.addEventListener('input', render);
  input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); if (e.key === 'Enter') modal.querySelector('.command-result')?.click(); });
  modal.addEventListener('click', e => { const btn = e.target.closest('.command-result'); if (!btn) return; const item = commandPaletteItems(input.value)[Number(btn.dataset.commandIndex)]; if (item) { saveRecentAdminItem(item); close(); item.action(); } });
  modal._open = () => { input.value = ''; render(); modal.classList.add('active'); setTimeout(() => input.focus(), 30); };
}
function openCommandPalette() { ensureCommandPalette(); document.getElementById('commandPalette')._open(); }

// Bind Events
function bindEvents() {
  ensureCommandPalette();
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommandPalette(); }
    if (e.key === 'Escape') document.getElementById('commandPalette')?.classList.remove('active');
    if (e.key === 'Escape') document.getElementById('userDetailDrawer')?.classList.remove('is-open');
  });

  // Mobile menu toggle
  menuToggle?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    menuToggle.classList.toggle('active');
    document.getElementById('sidebarOverlay')?.classList.toggle('active');
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (sidebar && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
        menuToggle?.classList.remove('active');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
      }
    }
  });

  // Search Movies
  document.getElementById('movieSearchInput')?.addEventListener('input', debounce((e) => {
    filterMovies(e.target.value);
  }));

  // Refresh button
  document.getElementById('refreshMoviesBtn')?.addEventListener('click', async () => {
    await fetchMovies(true);
    showNotification('Ro\'yxat yangilandi.');
  });

  // "Faqat postersiz kinolar" filtri — R2 tanlagich bilan tez bog'lab chiqish uchun
  document.getElementById('missingPostersToggle')?.addEventListener('change', (e) => {
    showOnlyMissingPosters = Boolean(e.target.checked);
    filterMovies(currentSearchQuery || '');
    if (showOnlyMissingPosters) {
      showNotification(`${filteredMovies.length} ta kinoda haqiqiy ablojka yo'q.`);
    }
  });

  // O'chib ketgan posterlarni zaxira manbalardan (ko'rish tarixi, kino
  // fayllari metadata'si, Drive revisiyalari, R2 zaxira) majburiy tiklash.
  document.getElementById('restorePostersBtn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    const label = btn.querySelector('span');
    const oldText = label ? label.textContent : '';
    if (label) label.textContent = 'Tiklanmoqda...';
    try {
      const resp = await fetch('/api/movie-update?action=restoreposters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || 'Tiklash bajarilmadi.');
      showNotification(data.message || `${data.restored || 0} ta kino ma'lumoti qaytarildi.`);
      await fetchMovies();
    } catch (err) {
      showNotification(err.message || 'Tiklashda xatolik.', 'error');
    } finally {
      delete btn.dataset.busy;
      if (label) label.textContent = oldText;
    }
  });

  // Theme toggle
  themeToggle?.addEventListener('click', toggleTheme);

  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const name = item.dataset.section;
      if (name) switchSection(name);
    });
  });

  // Users search + refresh
  document.getElementById('userSearchInput')?.addEventListener('input', debounce((e) => {
    filterUsers(e.target.value);
  }));
  document.getElementById('usersTableBody')?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-user-row]');
    if (!row) return;
    const user = usersList.find(item => String(item.telegram_id) === row.dataset.userId);
    openUserDrawer(user);
  });
  document.getElementById('usersTableBody')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('[data-user-row]');
    if (!row) return;
    e.preventDefault();
    row.click();
  });
  document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
    await fetchUsers(true);
    showNotification('Ro\'yxat yangilandi.');
  });
  document.getElementById('usersSortSelect')?.addEventListener('change', (e) => {
    setUsersSort(e.target.value);
  });
  document.getElementById('usersStatusFilter')?.addEventListener('change', e => { usersStatusFilter = e.target.value; usersCurrentPage = 1; applyUsersFilterSort(); renderUsers(); });
  document.getElementById('usersActivityFilter')?.addEventListener('change', e => { usersActivityFilter = e.target.value; usersCurrentPage = 1; applyUsersFilterSort(); renderUsers(); });
  document.querySelectorAll('.users-quick-date').forEach(btn => btn.addEventListener('click', () => setUsersQuickRange(btn.dataset.usersRange)));
  document.getElementById('usersExportCsvBtn')?.addEventListener('click', () => downloadUserExport('csv'));
  document.getElementById('usersExportJsonBtn')?.addEventListener('click', () => downloadUserExport('json'));
  document.getElementById('usersDateFrom')?.addEventListener('change', (e) => {
    setUsersDateRange(e.target.value, usersDateTo);
  });
  document.getElementById('usersDateTo')?.addEventListener('change', (e) => {
    setUsersDateRange(usersDateFrom, e.target.value);
  });
  document.getElementById('usersResetFilterBtn')?.addEventListener('click', () => {
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) searchInput.value = '';
    const fromInput = document.getElementById('usersDateFrom');
    if (fromInput) fromInput.value = '';
    const toInput = document.getElementById('usersDateTo');
    if (toInput) toInput.value = '';
    const sortSelect = document.getElementById('usersSortSelect');
    if (sortSelect) sortSelect.value = 'newest';
    userSearchQuery = '';
    usersSortMode = 'newest';
    usersDateFrom = '';
    usersDateTo = '';
    usersStatusFilter = 'all';
    usersActivityFilter = 'all';
    document.getElementById('usersStatusFilter').value = 'all';
    document.getElementById('usersActivityFilter').value = 'all';
    document.querySelectorAll('.users-quick-date').forEach(btn => btn.classList.remove('is-active'));
    applyUsersFilterSort();
    renderUsers();
  });

  // Pagination click delegation
  document.getElementById('moviesPagination')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.pageAction === 'prev') { goToMoviesPage(moviesCurrentPage - 1); return; }
    if (btn.dataset.pageAction === 'next') { goToMoviesPage(moviesCurrentPage + 1); return; }
    const page = parseInt(btn.dataset.page || '', 10);
    if (Number.isFinite(page)) goToMoviesPage(page);
  });
  document.getElementById('selectAllMovies')?.addEventListener('change', (e) => {
    document.querySelectorAll('#moviesTableBody input[data-movie-select]').forEach(input => e.target.checked ? selectedMovieIds.add(input.value) : selectedMovieIds.delete(input.value));
    updateMoviesBulkToolbar();
    renderMovies();
  });
  document.getElementById('moviesTableBody')?.addEventListener('change', (e) => {
    const input = e.target.closest('input[data-movie-select]');
    if (!input) return;
    if (input.checked) selectedMovieIds.add(input.value); else selectedMovieIds.delete(input.value);
    updateMoviesBulkToolbar();
  });
  document.getElementById('bulkMovieCategoryBtn')?.addEventListener('click', bulkChangeMovieCategory);
  document.getElementById('bulkMovieRestoreBtn')?.addEventListener('click', bulkRestoreMoviePosters);
  document.getElementById('clearMovieSelectionBtn')?.addEventListener('click', clearMovieSelection);
  document.getElementById('bulkMovieDeleteBtn')?.addEventListener('click', async (e) => {
    const ids = [...selectedMovieIds];
    if (!ids.length) return showNotification('Avval kinolarni tanlang.', 'error');
    if (!confirm(`${ids.length} ta kinoni Drive trash’ga yuborish tasdiqlansinmi? 6 soniya ichida Bekor qilish mumkin.`)) return;
    const button = e.currentTarget; const removed = movies.filter(movie => selectedMovieIds.has(String(movie.id)));
    movies = movies.filter(movie => !selectedMovieIds.has(String(movie.id))); filteredMovies = [...movies]; renderMovies(); setButtonBusy(button, true, 'O‘chirilmoqda');
    try {
      const response = await fetch(`${API_URL}/movie-update?action=bulkdelete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `${data.failed || 0} ta kino o‘chirilmadi.`);
      clearMovieSelection();
      showUndoNotification(`${data.processed} ta kino trash’ga yuborildi.`, async () => {
        const restore = await fetch(`${API_URL}/movie-update?action=bulkrestore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
        const restored = await restore.json().catch(() => ({})); if (!restore.ok || !restored.ok) throw new Error(restored.error || 'Kinolarni qaytarib bo‘lmadi.');
        movies = [...movies, ...removed]; filteredMovies = [...movies]; renderMovies(); showNotification(`${restored.processed} ta kino qaytarildi.`);
      });
    } catch (err) { movies = [...movies, ...removed]; filteredMovies = [...movies]; renderMovies(); showNotification(`Bulk o‘chirishda xato: ${err.message}`, 'error'); }
    finally { setButtonBusy(button, false); }
  });

  document.getElementById('usersPagination')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
    if (btn.dataset.pageAction === 'prev') usersCurrentPage--;
    else if (btn.dataset.pageAction === 'next') usersCurrentPage++;
    else if (btn.dataset.page) usersCurrentPage = Number(btn.dataset.page);
    usersCurrentPage = Math.max(1, Math.min(totalPages, usersCurrentPage));
    renderUsers();
  });
  document.getElementById('musicPagination')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const q = musicSearchQueryAdmin.toLowerCase();
    const total = q ? musicTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)).length : musicTracks.length;
    const totalPages = Math.max(1, Math.ceil(total / MUSIC_PAGE_SIZE));
    if (btn.dataset.pageAction === 'prev') musicCurrentPage--;
    else if (btn.dataset.pageAction === 'next') musicCurrentPage++;
    else if (btn.dataset.page) musicCurrentPage = Number(btn.dataset.page);
    musicCurrentPage = Math.max(1, Math.min(totalPages, musicCurrentPage));
    renderMusicTable();
  });
  // Table row actions - event delegation (only edit, no delete)
  document.getElementById('moviesTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;

    const movieId = btn.dataset.movieId;
    const action = btn.dataset.action;
    if (!movieId || !action) return;

    if (action === 'edit') editMovie(movieId);
  });

  // "Kino" kategoriya tekshiruvi — faqat placeholder "Kino" kategoriyali kinolarni ko'rsatadi
  document.getElementById('kinoCategoryAlertBtn')?.addEventListener('click', () => {
    const onlyKino = movies.filter((m) => {
      const cats = splitCategories(m.category).map(s => s.toLowerCase());
      return cats.length === 1 && cats[0] === 'kino';
    });
    const body = document.getElementById('kinoCategoryModalBody');
    if (body) {
      if (onlyKino.length === 0) {
        body.innerHTML = `<div class="kino-category-empty">Hammasi joyida — "Kino" kategoriyali (kategoriyasi belgilanmagan) kinolar yo'q.</div>`;
      } else {
        body.innerHTML = `
          <p class="form-hint form-hint--lead">Quyidagi <strong>${onlyKino.length}</strong> ta kinoda faqat "Kino" placeholder kategoriya turibdi — haqiqiy kategoriya tayinlash kerak.</p>
          <ul class="kino-category-list">
            ${onlyKino.map(m => `
              <li>
                <img src="${escapeHtml(m.poster ? proxiedPoster(m.poster) : POSTER_PLACEHOLDER)}" alt="" class="thumb-sm" onerror="retryPoster(this)">
                <div class="kc-info">
                  <div class="kc-name">${escapeHtml(m.name)}</div>
                  <div class="kc-code">${escapeHtml(m.code || m.id)}</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" data-edit-kino-id="${escapeHtml(m.id)}">Tahrirlash</button>
              </li>
            `).join('')}
          </ul>
        `;
      }
    }
    document.getElementById('kinoCategoryModal')?.classList.add('active');
  });
  document.getElementById('closeKinoCategoryModal')?.addEventListener('click', () => {
    document.getElementById('kinoCategoryModal')?.classList.remove('active');
  });
  document.getElementById('kinoCategoryModalBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-kino-id]');
    if (!btn) return;
    document.getElementById('kinoCategoryModal')?.classList.remove('active');
    editMovie(btn.dataset.editKinoId);
  });

  // Modal closes
  document.getElementById('closeMovieModal')?.addEventListener('click', closeMovieModal);
  document.getElementById('cancelMovie')?.addEventListener('click', closeMovieModal);

  // Forms
  document.getElementById('movieForm')?.addEventListener('submit', handleMovieSubmit);
  document.getElementById('movieForm')?.addEventListener('input', markMovieFormDirty);
  document.getElementById('movieForm')?.addEventListener('change', markMovieFormDirty);
  document.getElementById('movieDescription')?.addEventListener('input', updateDescriptionCounter);

  // Push checkbox toggle
  document.getElementById('moviePushEnabled')?.addEventListener('change', (e) => {
    const panel = document.getElementById('moviePushPanel');
    if (panel) panel.style.display = e.target.checked ? 'block' : 'none';
  });
  // Push media radio toggle
  document.querySelectorAll('input[name="moviePushMedia"]').forEach(r => {
    r.addEventListener('change', (e) => {
      const v = e.target.value;
      const wrap = document.getElementById('moviePushUploadWrap');
      const file = document.getElementById('moviePushFile');
      const hint = document.getElementById('moviePushFileHint');
      if (!wrap) return;
      if (v === 'image' || v === 'video') {
        wrap.style.display = 'block';
        if (file) file.accept = v === 'video' ? 'video/*' : 'image/*';
        if (hint) hint.textContent = v === 'video' ? 'MP4 video, ≤4MB' : 'JPG/PNG, ≤4MB';
      } else {
        wrap.style.display = 'none';
        if (file) file.value = '';
      }
    });
  });

  // Kategoriya chiplari: tanlash/olib tashlash
  document.getElementById('movieCategoryChips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;
    const name = chip.dataset.category;
    if (!name) return;
    const key = name.toLowerCase();
    const match = [...selectedCategories].find(item => item.toLowerCase() === key);
    if (match) {
      selectedCategories.delete(match);
    } else {
      selectedCategories.add(name);
    }
    renderCategoryChips();
  });

  // Yangi kategoriya qo'shish
  const addCategory = () => {
    const input = document.getElementById('movieCategoryNew');
    if (!input) return;
    const name = String(input.value || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    const existing = availableCategories.find(item => item.toLowerCase() === key);
    const finalName = existing || name;
    if (!availableCategories.some(item => item.toLowerCase() === key)) {
      availableCategories.push(finalName);
    }
    selectedCategories.add(finalName);
    input.value = '';
    renderCategoryChips();
  };
  document.getElementById('addCategoryBtn')?.addEventListener('click', addCategory);
  document.getElementById('movieCategoryNew')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCategory();
    }
  });

  // Poster file upload
  document.getElementById('moviePosterFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      selectedPosterDataUrl = await readPosterFile(file);
      updatePosterPreview(selectedPosterDataUrl);
      const urlInput = document.getElementById('moviePosterUrl');
      if (urlInput) urlInput.value = '';
    } catch (error) {
      showNotification(error.message || 'Rasmni o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      selectedPosterDataUrl = '';
      updatePosterPreview('');
    }
  });

  document.getElementById('moviePosterUrl')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      const fileInput = document.getElementById('moviePosterFile');
      if (fileInput) fileInput.value = '';
      selectedPosterDataUrl = '';
      updatePosterPreview(url);
    } else {
      updatePosterPreview('');
    }
  });

  document.getElementById('movieHeaderImageFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      selectedHeaderDataUrl = await readHeaderFile(file);
      updateHeaderPreview(selectedHeaderDataUrl);
      const urlInput = document.getElementById('movieHeaderImage');
      if (urlInput) urlInput.value = '';
    } catch (error) {
      showNotification(error.message || 'Rasmni o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      selectedHeaderDataUrl = '';
      updateHeaderPreview('');
    }
  });

  document.getElementById('movieHeaderImage')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const fileInput = document.getElementById('movieHeaderImageFile');
    if (fileInput) fileInput.value = '';
    selectedHeaderDataUrl = '';
    updateHeaderPreview(url);
  });

  document.getElementById('movieShowInHeader')?.addEventListener('change', (e) => {
    const group = document.getElementById('headerImageGroup');
    if (group) group.style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('posterPickR2Btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    openR2PosterPicker();
  });

  document.getElementById('posterRemoveBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectedPosterDataUrl = '';
    const fileInput = document.getElementById('moviePosterFile');
    const urlInput = document.getElementById('moviePosterUrl');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    updatePosterPreview('');
  });

  document.getElementById('headerRemoveBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    selectedHeaderDataUrl = '';
    const fileInput = document.getElementById('movieHeaderImageFile');
    const urlInput = document.getElementById('movieHeaderImage');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    updateHeaderPreview('');
    const showInHeaderCheckbox = document.getElementById('movieShowInHeader');
    if (showInHeaderCheckbox) {
      showInHeaderCheckbox.checked = false;
      const group = document.getElementById('headerImageGroup');
      if (group) group.style.display = 'none';
    }
    markMovieFormDirty();
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Tizimdan chiqishni xohlaysizmi?')) {
      localStorage.removeItem('adminAuth');
      window.location.reload();
    }
  });

  // Movie tabs (Kinolar / Seriallar)
  document.querySelectorAll('.movie-tab').forEach(tab => {
    tab.addEventListener('click', () => switchMovieTab(tab.dataset.movieTab));
  });

  // Ad tabs (Mini app reklama / Pre-roll video / Ticker / Broadcast)
  document.querySelectorAll('.ad-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdTab(tab.dataset.adTab));
  });
  document.querySelectorAll('.ad-tab-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.ad-visibility-toggle')) return;
      switchAdTab(item.dataset.adTabItem);
    });
  });

  // Series search + refresh
  document.getElementById('seriesSearchInput')?.addEventListener('input', debounce((e) => {
    filterSeries(e.target.value);
  }));
  document.getElementById('refreshSeriesBtn')?.addEventListener('click', async () => {
    await fetchSeries(true);
    showNotification('Ro\'yxat yangilandi.');
  });

  // Series card click
  document.getElementById('seriesCardGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.series-card');
    if (card?.dataset.seriesId) editSeries(card.dataset.seriesId);
  });

  // Series editor: back / cancel / save
  document.getElementById('seriesEditorBack')?.addEventListener('click', closeSeriesEditor);
  document.getElementById('seriesCancelBtn')?.addEventListener('click', closeSeriesEditor);
  document.getElementById('seriesSaveBtn')?.addEventListener('click', () => handleSeriesSubmit());
  document.getElementById('seriesForm')?.addEventListener('submit', (e) => { e.preventDefault(); handleSeriesSubmit(); });
  document.getElementById('seriesForm')?.addEventListener('input', (e) => { e.currentTarget.dataset.dirty = '1'; });
  document.getElementById('seriesForm')?.addEventListener('change', (e) => { e.currentTarget.dataset.dirty = '1'; });
  document.getElementById('seriesDescription')?.addEventListener('input', updateSeriesDescriptionCounter);

  // Series poster upload
  document.getElementById('seriesPosterFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      selectedSeriesPosterDataUrl = await readPosterFile(file);
      updateSeriesPosterPreview(selectedSeriesPosterDataUrl);
      const urlInput = document.getElementById('seriesPosterUrl');
      if (urlInput) urlInput.value = '';
    } catch (error) {
      showNotification(error.message || 'Rasmni o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      selectedSeriesPosterDataUrl = '';
      updateSeriesPosterPreview('');
    }
  });
  document.getElementById('seriesPosterUrl')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      const fileInput = document.getElementById('seriesPosterFile');
      if (fileInput) fileInput.value = '';
      selectedSeriesPosterDataUrl = '';
      updateSeriesPosterPreview(url);
    } else {
      updateSeriesPosterPreview('');
    }
  });

  setupImageDropUpload('posterUploadArea', 'moviePosterFile', async file => { selectedPosterDataUrl = await readPosterFile(file); updatePosterPreview(selectedPosterDataUrl); const input = document.getElementById('moviePosterUrl'); if (input) input.value = ''; });
  setupImageDropUpload('headerUploadArea', 'movieHeaderImageFile', async file => { selectedHeaderDataUrl = await readHeaderFile(file); updateHeaderPreview(selectedHeaderDataUrl); const input = document.getElementById('movieHeaderImage'); if (input) input.value = ''; });
  setupImageDropUpload('seriesPosterUploadArea', 'seriesPosterFile', async file => { selectedSeriesPosterDataUrl = await readPosterFile(file); updateSeriesPosterPreview(selectedSeriesPosterDataUrl); const input = document.getElementById('seriesPosterUrl'); if (input) input.value = ''; });
  document.getElementById('moviePosterUrl')?.addEventListener('blur', e => { if (!isValidImageUrl(e.target.value.trim())) showNotification('Poster URL noto‘g‘ri. http:// yoki https:// bilan boshlanishi kerak.', 'error'); });
  document.getElementById('movieHeaderImage')?.addEventListener('blur', e => { if (!isValidImageUrl(e.target.value.trim())) showNotification('Header URL noto‘g‘ri.', 'error'); });
  document.getElementById('seriesPosterUrl')?.addEventListener('blur', e => { if (!isValidImageUrl(e.target.value.trim())) showNotification('Serial poster URL noto‘g‘ri.', 'error'); });
  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target !== modal) return;
      if (modal.id === 'movieModal') closeMovieModal();
      else modal.classList.remove('active');
    });
  });
}

// Filter movies based on search query
// Haqiqiy ablojkasi yo'q kino: poster bo'sh yoki fallback (drive-thumbnail,
// logo, placeholder) URL. Postersizlarni tez topib, R2 tanlagich bilan
// bog'lab chiqish uchun ishlatiladi.
let showOnlyMissingPosters = false;
const selectedMovieIds = new Set();
function updateMoviesBulkToolbar() {
  const toolbar = document.getElementById('moviesBulkToolbar');
  const count = document.getElementById('moviesSelectedCount');
  if (count) count.textContent = String(selectedMovieIds.size);
  if (toolbar) toolbar.hidden = selectedMovieIds.size === 0;
  const visible = [...document.querySelectorAll('#moviesTableBody input[data-movie-select]')];
  const all = visible.length > 0 && visible.every(input => selectedMovieIds.has(input.value));
  const selectAll = document.getElementById('selectAllMovies');
  if (selectAll) { selectAll.checked = all; selectAll.indeterminate = !all && visible.some(input => selectedMovieIds.has(input.value)); }
}
function updateBulkMovieCategoryOptions() {
  const select = document.getElementById('bulkMovieCategory');
  if (!select) return;
  const current = select.value;
  const categories = [...new Set(movies.flatMap(m => splitCategories(m.category)))].sort((a, b) => a.localeCompare(b));
  select.innerHTML = '<option value="">Kategoriya tanlang</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = current;
}
async function bulkChangeMovieCategory() {
  const category = document.getElementById('bulkMovieCategory')?.value.trim();
  const ids = [...selectedMovieIds];
  if (!ids.length) return showNotification('Avval kinolarni tanlang.', 'error');
  if (!category) return showNotification('Bulk kategoriya tanlang.', 'error');
  const button = document.getElementById('bulkMovieCategoryBtn');
  const snapshots = new Map(ids.map(id => [id, { ...movies.find(m => String(m.id) === id) }]));
  movies.forEach(movie => { if (selectedMovieIds.has(String(movie.id))) movie.category = category; });
  filterMovies(currentSearchQuery || '');
  setButtonBusy(button, true, 'Saqlanmoqda');
  try {
    const results = await Promise.all(ids.map(id => fetch(`${API_URL}/movie-update`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, genre: category }) }).then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`); return data; })));
    showNotification(`${results.length} ta kinoning kategoriyasi yangilandi.`);
    clearMovieSelection();
    await fetchMovies(true);
  } catch (err) {
    movies.forEach(movie => { const old = snapshots.get(String(movie.id)); if (old) Object.assign(movie, old); });
    filterMovies(currentSearchQuery || '');
    showNotification(`Bulk saqlashda xato: ${err.message}`, 'error');
  } finally { setButtonBusy(button, false); }
}
async function bulkRestoreMoviePosters() {
  const button = document.getElementById('bulkMovieRestoreBtn');
  setButtonBusy(button, true, 'Tiklanmoqda');
  try {
    const response = await fetch('/api/movie-update?action=restoreposters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'Posterlarni tiklab bo\'lmadi.');
    showNotification(data.message || `${data.restored || 0} ta poster tiklandi.`);
    await fetchMovies(true); clearMovieSelection();
  } catch (err) { showNotification(`Poster tiklashda xato: ${err.message}`, 'error'); }
  finally { setButtonBusy(button, false); }
}
function clearMovieSelection() { selectedMovieIds.clear(); updateMoviesBulkToolbar(); renderMovies(); }
function movieHasRealPoster(movie) {
  const poster = String(movie.poster || '').trim().toLowerCase();
  if (!poster) return false;
  if (poster.startsWith('data:image/svg')) return false;
  return !poster.includes('/api/drive-thumbnail')
    && !poster.includes('/static/assets/')
    && !poster.includes('my-kino-logo')
    && !poster.includes('placeholder.com');
}

function filterMovies(query) {
  currentSearchQuery = query.toLowerCase().trim();

  if (!currentSearchQuery) {
    filteredMovies = [...movies];
  } else {
    filteredMovies = movies.filter(movie => {
      const searchFields = [
        movie.name || '',
        movie.code || '',
        movie.category || '',
        movie.year || '',
        movie.description || ''
      ].join(' ').toLowerCase();
      return searchFields.includes(currentSearchQuery);
    });
  }

  if (showOnlyMissingPosters) {
    filteredMovies = filteredMovies.filter((movie) => !movieHasRealPoster(movie));
  }

  moviesCurrentPage = 1;
  renderMovies();
}

// Render Movies
function renderMovies() {
  const tbody = document.getElementById('moviesTableBody');
  if (!tbody) return;

  const moviesToRender = (currentSearchQuery || showOnlyMissingPosters) ? filteredMovies : movies;

  renderMoviesPagination(moviesToRender.length);

  if (moviesToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <h3>${currentSearchQuery ? 'Qidiruv natijalari topilmadi' : 'Hozircha kinolar yo\'q'}</h3>
            <p>${currentSearchQuery ? `"${escapeHtml(currentSearchQuery)}" bo'yicha kino topilmadi` : 'Yangi kino qo\'shish uchun "Yangi kino qo\'shish" tugmasini bosing'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Update movie count in section header
  const sectionHeader = document.getElementById('moviesListTitle');
  if (sectionHeader) {
    sectionHeader.textContent = `Kinolar ro'yxati (${movies.length})`;
  }

  const totalPages = Math.max(1, Math.ceil(moviesToRender.length / MOVIES_PAGE_SIZE));
  if (moviesCurrentPage > totalPages) moviesCurrentPage = totalPages;
  if (moviesCurrentPage < 1) moviesCurrentPage = 1;
  const startIdx = (moviesCurrentPage - 1) * MOVIES_PAGE_SIZE;
  const pageSlice = moviesToRender.slice(startIdx, startIdx + MOVIES_PAGE_SIZE);

  tbody.innerHTML = pageSlice.map(movie => `
    <tr data-id="${escapeHtml(movie.id)}" class="movie-card-row">
      <td class="col-select bulk-select-col">
        <input type="checkbox" data-movie-select value="${escapeHtml(movie.id)}" ${selectedMovieIds.has(String(movie.id)) ? 'checked' : ''} aria-label="${escapeHtml(movie.name)} tanlash">
      </td>
      <td class="col-poster">
        <img src="${escapeHtml(movie.poster ? proxiedPoster(movie.poster) : POSTER_PLACEHOLDER)}"
             alt="${escapeHtml(movie.name)}" class="movie-poster" loading="lazy" decoding="async" onerror="retryPoster(this)">
      </td>
      <td class="col-header desktop-only">
        ${movie.headerImage ? `
          <img src="${escapeHtml(proxiedPoster(movie.headerImage))}" alt="Header" class="movie-header-preview" loading="lazy" decoding="async" onerror="this.style.display='none'">
        ` : '<span class="muted">Yo\'q</span>'}
      </td>
      <td class="col-title">
        <div class="movie-title-wrap">
          <strong class="movie-name">${escapeHtml(movie.name)}</strong>
          <small class="movie-code-sub">${escapeHtml(movie.code || '')}</small>
          <div class="movie-meta-chips">
            ${movie.code ? `<span class="movie-chip code-chip">#${escapeHtml(movie.code)}</span>` : ''}
            ${movie.year ? `<span class="movie-chip">${escapeHtml(movie.year)}</span>` : ''}
            ${movie.category ? `<span class="movie-chip cat-chip">${escapeHtml(movie.category)}</span>` : ''}
            <span class="movie-chip rating-chip">★ ${movie.rating ? movie.rating.toFixed(1) : '0.0'}</span>
            <span class="badge ${movie.hd ? 'badge-hd' : 'badge-sd'}">${movie.hd ? 'HD' : 'SD'}</span>
          </div>
        </div>
      </td>
      <td class="col-year desktop-only">${escapeHtml(movie.year || '-')}</td>
      <td class="col-category desktop-only">${escapeHtml(movie.category || '-')}</td>
      <td class="col-rating desktop-only">
        <span class="rating"><span data-tone="warn">★</span> ${movie.rating ? movie.rating.toFixed(1) : '0.0'}</span>
      </td>
      <td class="col-badge desktop-only">
        <span class="badge ${movie.hd ? 'badge-hd' : 'badge-sd'}">
          ${movie.hd ? 'HD' : 'SD'}
        </span>
      </td>
      <td class="col-actions">
        <div class="actions">
          <button class="btn-icon edit" data-action="edit" data-movie-id="${escapeHtml(movie.id)}" title="Tahrirlash" aria-label="Tahrirlash">${ADMIN_ICONS.edit}</button>
        </div>
      </td>
    </tr>
  `).join('');
  updateBulkMovieCategoryOptions();
  updateMoviesBulkToolbar();
}

function renderMoviesPagination(totalItems) {
  const wrap = document.getElementById('moviesPagination');
  const pagesWrap = document.getElementById('moviesPaginationPages');
  const info = document.getElementById('moviesPaginationInfo');
  if (!wrap || !pagesWrap) return;

  if (totalItems <= MOVIES_PAGE_SIZE) {
    wrap.hidden = true;
    pagesWrap.innerHTML = '';
    if (info) info.textContent = '';
    return;
  }

  wrap.hidden = false;
  const totalPages = Math.max(1, Math.ceil(totalItems / MOVIES_PAGE_SIZE));
  if (moviesCurrentPage > totalPages) moviesCurrentPage = totalPages;
  if (moviesCurrentPage < 1) moviesCurrentPage = 1;

  const prevBtn = wrap.querySelector('[data-page-action="prev"]');
  const nextBtn = wrap.querySelector('[data-page-action="next"]');
  if (prevBtn) prevBtn.disabled = moviesCurrentPage <= 1;
  if (nextBtn) nextBtn.disabled = moviesCurrentPage >= totalPages;

  const pageNums = buildPageList(moviesCurrentPage, totalPages);
  pagesWrap.innerHTML = pageNums.map(p => {
    if (p === '…') return `<span class="pagination__page is-ellipsis">…</span>`;
    const active = p === moviesCurrentPage ? ' is-active' : '';
    return `<button type="button" class="pagination__page${active}" data-page="${p}">${p}</button>`;
  }).join('');

  if (info) {
    const start = (moviesCurrentPage - 1) * MOVIES_PAGE_SIZE + 1;
    const end = Math.min(totalItems, moviesCurrentPage * MOVIES_PAGE_SIZE);
    info.textContent = `${start}-${end} / ${totalItems}`;
  }
}

function buildPageList(current, total) {
  const pages = [];
  const window_ = 1;
  const push = (v) => { if (pages[pages.length - 1] !== v) pages.push(v); };
  push(1);
  if (current - window_ > 2) push('…');
  for (let p = Math.max(2, current - window_); p <= Math.min(total - 1, current + window_); p++) push(p);
  if (current + window_ < total - 1) push('…');
  if (total > 1) push(total);
  return pages;
}

function goToMoviesPage(page) {
  const list = (currentSearchQuery || showOnlyMissingPosters) ? filteredMovies : movies;
  const totalPages = Math.max(1, Math.ceil(list.length / MOVIES_PAGE_SIZE));
  moviesCurrentPage = Math.max(1, Math.min(totalPages, page));
  renderMovies();
  const anchor = document.getElementById('moviesListTitle');
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Open Movie Modal
function openMovieModal(movie) {
  if (!movie) return;
  const modal = document.getElementById('movieModal');
  const title = document.getElementById('movieModalTitle');
  const form = document.getElementById('movieForm');
  const posterFileInput = document.getElementById('moviePosterFile');
  const headerFileInput = document.getElementById('movieHeaderImageFile');

  selectedPosterDataUrl = '';
  selectedHeaderDataUrl = '';
  if (posterFileInput) posterFileInput.value = '';
  if (headerFileInput) headerFileInput.value = '';

  title.textContent = 'Kino tahrirlash';
  document.getElementById('movieName').value = movie.name;

  selectedCategories.clear();
  for (const name of splitCategories(movie.category)) {
    selectedCategories.add(name);
  }
  const newCategoryInput = document.getElementById('movieCategoryNew');
  if (newCategoryInput) newCategoryInput.value = '';
  renderCategoryChips();

  document.getElementById('movieRating').value = movie.rating;
  document.getElementById('movieHd').value = movie.hd.toString();
  document.getElementById('movieDescription').value = movie.description || '';
  form.dataset.editingId = movie.id;

  const poster = movie.poster || '';
  if (poster && !poster.startsWith('data:image')) {
    document.getElementById('moviePosterUrl').value = poster;
  } else if (poster) {
    selectedPosterDataUrl = poster;
  } else {
    document.getElementById('moviePosterUrl').value = '';
  }
  updatePosterPreview(poster);

  const showInHeader = Boolean(movie.showInHeader);
  const showInHeaderCheckbox = document.getElementById('movieShowInHeader');
  if (showInHeaderCheckbox) {
    showInHeaderCheckbox.checked = showInHeader;
    const group = document.getElementById('headerImageGroup');
    if (group) group.style.display = showInHeader ? 'block' : 'none';
  }
  const headerImage = movie.headerImage || '';
  const headerImageInput = document.getElementById('movieHeaderImage');
  if (headerImage && !headerImage.startsWith('data:image')) {
    if (headerImageInput) headerImageInput.value = headerImage;
  } else {
    if (headerImageInput) headerImageInput.value = '';
    if (headerImage) selectedHeaderDataUrl = headerImage;
  }
  updateHeaderPreview(headerImage);

  updateDescriptionCounter();
  form.dataset.formSnapshot = JSON.stringify({ name: movie.name, category: movie.category, rating: movie.rating, hd: movie.hd, description: movie.description || '', poster: movie.poster || '', headerImage: movie.headerImage || '', showInHeader });
  form.dataset.dirty = '0';

  // Reset push panel
  const pushEnabled = document.getElementById('moviePushEnabled');
  const pushPanel = document.getElementById('moviePushPanel');
  const pushText = document.getElementById('moviePushText');
  const pushFile = document.getElementById('moviePushFile');
  const pushResult = document.getElementById('moviePushResult');
  const pushUploadWrap = document.getElementById('moviePushUploadWrap');
  if (pushEnabled) pushEnabled.checked = false;
  if (pushPanel) pushPanel.style.display = 'none';
  if (pushText) pushText.value = `🎬 Yangi kino: ${movie.name}\n\nJanr: ${movie.category || ''}\n${movie.rating ? '⭐ ' + movie.rating + '/10' : ''}`.trim();
  if (pushFile) pushFile.value = '';
  if (pushResult) pushResult.textContent = '';
  if (pushUploadWrap) pushUploadWrap.style.display = 'none';
  document.querySelectorAll('input[name="moviePushMedia"]').forEach(r => { r.checked = r.value === 'poster'; });
  const pushBtn = document.getElementById('moviePushAddButton');
  if (pushBtn) pushBtn.checked = true;

  modal.classList.add('active');
  tgHaptic('light');
  tgPushBack(closeMovieModal);
}

// === R2 rasm tanlagich ===
// Katalogdagi poster bog'lanishi o'chib ketganda rasmning o'zi R2'da qolgan
// bo'ladi. Bu oyna bucket'dagi barcha yuklangan rasmlarni ko'rsatadi — admin
// kerakli rasmni bosib, kinoga qayta bog'laydi.
let r2ImagesCache = null;
async function openR2PosterPicker() {
  let overlay = document.getElementById('r2PickerOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'r2PickerOverlay';
    overlay.className = 'picker-overlay';
    overlay.innerHTML = `
      <div class="picker">
        <div class="picker__head">
          <strong>R2'dagi rasmlar</strong>
          <button type="button" id="r2PickerClose" class="btn btn-secondary btn-sm">Yopish</button>
        </div>
        <div id="r2PickerBody" class="picker__body">
          <div class="placeholder-text">Yuklanmoqda...</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    overlay.querySelector('#r2PickerClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
  }
  overlay.style.display = 'flex';
  const body = overlay.querySelector('#r2PickerBody');

  try {
    if (!r2ImagesCache) {
      const resp = await fetch('/api/movie-update?action=listposters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || 'Rasmlar olinmadi.');
      r2ImagesCache = data.images || [];
    }
    if (!r2ImagesCache.length) {
      body.innerHTML = '<div class="placeholder-text">R2 bucket\'da rasm topilmadi.</div>';
      return;
    }
    body.innerHTML = `
      <p class="form-hint form-hint--lead">
        Jami: ${r2ImagesCache.length} ta rasm (yangi yuklanganlari birinchi). Kerakli posterni bosing.
      </p>
      <div class="picker__grid">
        ${r2ImagesCache.map((img) => `
          <button type="button" class="r2-pick-item" data-url="${escapeHtml(img.url)}">
            <img src="${escapeHtml(img.url)}" alt="" loading="lazy" decoding="async" onerror="this.parentElement.style.display='none'">
          </button>`).join('')}
      </div>`;
    body.querySelectorAll('.r2-pick-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.url || '';
        if (!url) return;
        selectedPosterDataUrl = '';
        const urlInput = document.getElementById('moviePosterUrl');
        if (urlInput) urlInput.value = url;
        updatePosterPreview(url);
        overlay.style.display = 'none';
        tgHaptic('light');
      });
    });
  } catch (err) {
    body.innerHTML = `<div class="placeholder-text" data-tone="error">${escapeHtml(err.message || 'Xatolik')}</div>`;
  }
}

function updatePosterPreview(url) {
  const img = document.getElementById('posterPreviewImg');
  const uploadArea = document.getElementById('posterUploadArea');
  if (!img || !uploadArea) return;

  if (url) {
    img.src = proxiedPoster(url);
    img.style.display = 'block';
    uploadArea.classList.add('has-preview');
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    uploadArea.classList.remove('has-preview');
  }
}

function readPosterFile(file) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Faqat rasm fayl tanlang (JPG, PNG, WEBP, GIF).'));
  }

  if (file.size > POSTER_MAX_FILE_SIZE) {
    return Promise.reject(new Error('Rasm fayli hajmi juda katta. Maksimal: 5MB.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Rasmni o\'qib bo\'lmadi.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const image = new Image();
      image.onerror = () => resolve(dataUrl);
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // R2 ga yuklanadi — JSON'ga embed bo'lmaydi, shuning uchun sifatni yuqori
        // saqlaymiz: 800x1200, JPEG q=0.85. Mini app'da poster yetarlicha o'tkir
        // ko'rinadi, fayl hajmi ~150-250KB atrofida — R2 uchun mayda.
        const TARGET_WIDTH = 800;
        const TARGET_HEIGHT = 1200;

        let width = image.width;
        let height = image.height;

        if (width > TARGET_WIDTH || height > TARGET_HEIGHT) {
          const scale = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function isValidImageUrl(value) {
  if (!value) return true;
  try { const url = new URL(value, window.location.origin); return ['http:', 'https:'].includes(url.protocol); } catch (_) { return false; }
}
function setupImageDropUpload(areaId, inputId, processFile) {
  const area = document.getElementById(areaId); const input = document.getElementById(inputId);
  if (!area || !input || area.dataset.dropReady) return;
  area.dataset.dropReady = '1';
  const progress = document.createElement('div'); progress.className = 'poster-upload-progress'; progress.innerHTML = '<span></span>'; progress.hidden = true; area.appendChild(progress);
  const bar = progress.querySelector('span');
  const handle = async file => { if (!file) return; progress.hidden = false; bar.style.width = '18%'; try { bar.style.width = '55%'; await processFile(file); bar.style.width = '100%'; setTimeout(() => { progress.hidden = true; bar.style.width = '0'; }, 240); } catch (err) { progress.hidden = true; bar.style.width = '0'; throw err; } };
  ['dragenter', 'dragover'].forEach(name => area.addEventListener(name, e => { e.preventDefault(); area.classList.add('is-dragover'); }));
  ['dragleave', 'drop'].forEach(name => area.addEventListener(name, e => { e.preventDefault(); area.classList.remove('is-dragover'); }));
  area.addEventListener('drop', async e => { try { await handle(e.dataTransfer.files?.[0]); } catch (err) { showNotification(err.message || 'Rasm yuklanmadi.', 'error'); } });
}
function updateHeaderPreview(url) {
  const img = document.getElementById('headerPreviewImg');
  const uploadArea = document.getElementById('headerUploadArea');
  if (!img || !uploadArea) return;

  if (url) {
    img.src = proxiedPoster(url);
    img.style.display = 'block';
    uploadArea.classList.add('has-preview');
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    uploadArea.classList.remove('has-preview');
  }
}

function readHeaderFile(file) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Faqat rasm fayl tanlang (JPG, PNG, WEBP, GIF).'));
  }

  if (file.size > POSTER_MAX_FILE_SIZE) {
    return Promise.reject(new Error('Rasm fayli hajmi juda katta. Maksimal: 5MB.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Rasmni o\'qib bo\'lmadi.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const image = new Image();
      image.onerror = () => resolve(dataUrl);
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        const TARGET_WIDTH = 1280;
        const TARGET_HEIGHT = 720;

        let width = image.width;
        let height = image.height;

        if (width > TARGET_WIDTH || height > TARGET_HEIGHT) {
          const scale = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function updateDescriptionCounter() {
  const textarea = document.getElementById('movieDescription');
  const counter = document.getElementById('movieDescriptionCounter');
  if (!textarea || !counter) return;

  const length = textarea.value.length;
  counter.textContent = `${length}/${MOVIE_DESCRIPTION_MAX_LENGTH}`;
  counter.classList.toggle('is-over', length > MOVIE_DESCRIPTION_MAX_LENGTH);
}

function showDescriptionLimitError() {
  showNotification(`Tavsif juda uzun. Maksimal: ${MOVIE_DESCRIPTION_MAX_LENGTH} ta belgi.`, 'error');
}

function hasMovieFieldChanged(nextValue, currentValue) {
  return String(nextValue ?? '') !== String(currentValue ?? '');
}

function hasRatingChanged(nextValue, currentValue) {
  const next = Number(nextValue || 0);
  const current = Number(currentValue || 0);
  return Math.abs(next - current) > 0.001;
}

// Close Movie Modal
function closeMovieModal() {
  const modal = document.getElementById('movieModal');
  if (modal && modal.classList.contains('active')) {
    const form = document.getElementById('movieForm');
    if (form?.dataset.dirty === '1' && !confirm('Saqlanmagan o‘zgarishlar bor. Formani yopmoqchimisiz?')) return;
    modal.classList.remove('active');
    tgPopBack();
  }
}
function markMovieFormDirty() {
  const form = document.getElementById('movieForm');
  if (!form || !form.dataset.formSnapshot) return;
  const current = JSON.stringify({ name: document.getElementById('movieName')?.value || '', category: joinCategories([...selectedCategories]), rating: Number(document.getElementById('movieRating')?.value || 0), hd: document.getElementById('movieHd')?.value === 'true', description: document.getElementById('movieDescription')?.value || '', poster: selectedPosterDataUrl || document.getElementById('moviePosterUrl')?.value || '', headerImage: selectedHeaderDataUrl || document.getElementById('movieHeaderImage')?.value || '', showInHeader: Boolean(document.getElementById('movieShowInHeader')?.checked) });
  form.dataset.dirty = current === form.dataset.formSnapshot ? '0' : '1';
}

// Handle Movie Submit (edit only - movies originate from Google Drive)
async function handleMovieSubmit(e) {
  e.preventDefault();

  const form = e.target;
  if (!form.dataset.editingId) {
    showNotification('Yangi kino qo\'shish faqat Google Drive papkasiga fayl yuklash orqali amalga oshiriladi.', 'error');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const categoryString = joinCategories([...selectedCategories]);
  if (!categoryString) {
    showNotification('Kamida bitta kategoriya tanlang.', 'error');
    return;
  }
  const posterValue = selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim();
  const headerValue = selectedHeaderDataUrl || document.getElementById('movieHeaderImage').value.trim();
  const movieData = {
    name: document.getElementById('movieName').value.trim(),
    category: categoryString,
    rating: parseFloat(document.getElementById('movieRating').value) || 0,
    hd: document.getElementById('movieHd').value === 'true',
    description: document.getElementById('movieDescription').value,
    posterImage: posterValue,
    showInHeader: document.getElementById('movieShowInHeader').checked,
    headerImage: headerValue
  };

  {
    const id = form.dataset.editingId;
    const currentMovie = movies.find(movie => sameMovieId(movie.id, id));
    const updatePayload = { id };
    const nextQuality = movieData.hd ? 'HD' : 'SD';
    const currentQuality = currentMovie?.hd ? 'HD' : 'SD';

    if (!currentMovie || hasMovieFieldChanged(movieData.name, currentMovie.name)) {
      updatePayload.title = movieData.name;
    }
    if (!currentMovie || hasMovieFieldChanged(movieData.category, currentMovie.category)) {
      updatePayload.genre = movieData.category;
    }
    if (!currentMovie || hasRatingChanged(movieData.rating, currentMovie.rating)) {
      updatePayload.rating = movieData.rating;
    }
    if (!currentMovie || nextQuality !== currentQuality) {
      updatePayload.quality = nextQuality;
    }
    const descriptionChanged = !currentMovie || hasMovieFieldChanged(movieData.description, currentMovie.description);
    if (descriptionChanged) {
      if (movieData.description.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
        updateDescriptionCounter();
        showDescriptionLimitError();
        return;
      }
      updatePayload.description = movieData.description;
    }
    const finalPoster = selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim();
    if (!currentMovie || finalPoster !== currentMovie.poster) {
      updatePayload.posterImage = finalPoster;
    }

    const isShowInHeaderChecked = Boolean(document.getElementById('movieShowInHeader')?.checked);
    const rawHeaderInput = (selectedHeaderDataUrl || document.getElementById('movieHeaderImage')?.value || '').trim();
    const finalHeader = isShowInHeaderChecked ? rawHeaderInput : '';

    if (!finalHeader) {
      const prevHeader = currentMovie?.headerImage || currentMovie?.heroPoster || '';
      updatePayload.headerImage = '';
      updatePayload.heroPoster = '';
      updatePayload.headerPoster = '';
      updatePayload.heroImage = '';
      updatePayload.showInHeader = false;
      if (prevHeader) {
        updatePayload.deletedHeaderImage = prevHeader;
      }
    } else {
      if (!currentMovie || hasMovieFieldChanged(finalHeader, currentMovie.headerImage)) {
        updatePayload.headerImage = finalHeader;
      }
      updatePayload.showInHeader = true;
    }

    if (Object.keys(updatePayload).length === 1) {
      showNotification('O\'zgarish yo\'q.');
      return;
    }

    const previousMovie = currentMovie ? { ...currentMovie } : null;
    try {
      setButtonBusy(submitButton, true, 'Saqlanmoqda');
      if (currentMovie) {
        Object.assign(currentMovie, normalizeMovieFromApi({ ...currentMovie, ...movieData, title: movieData.name, genre: movieData.category, quality: nextQuality, posterImage: finalPoster, headerImage: finalHeader, showInHeader: Boolean(finalHeader && movieData.showInHeader) }));
        if (!finalHeader) {
          currentMovie.headerImage = '';
          currentMovie.heroPoster = '';
          currentMovie.headerPoster = '';
          currentMovie.heroImage = '';
          currentMovie.showInHeader = false;
          currentMovie.heroFeatured = false;
          currentMovie.headerCrop = null;
        }
        renderMovies();
      }

      const response = await fetch(`${API_URL}/movie-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      const result = await response.json();

      if (result.ok) {
        // Push xabar yuborish (agar yoqilgan bo'lsa)
        const pushEnabled = document.getElementById('moviePushEnabled')?.checked;
        if (pushEnabled) {
          const pushResultEl = document.getElementById('moviePushResult');
          if (pushResultEl) { pushResultEl.textContent = 'Push yuborilmoqda...'; setTone(pushResultEl, ''); }
          try {
            await sendMoviePush(id, movieData, finalPoster, result.movie);
            if (pushResultEl) { pushResultEl.textContent = 'Push yuborildi.'; setTone(pushResultEl, 'ok'); }
            showNotification('Kino yangilandi va push yuborildi! ✅');
          } catch (err) {
            if (pushResultEl) { pushResultEl.textContent = `Push xato: ${err.message}`; setTone(pushResultEl, 'error'); }
            showNotification('Kino yangilandi, lekin push yuborilmadi: ' + err.message, 'error');
          }
          await fetchMovies();
          return;
        }
        form.dataset.dirty = '0';
        closeMovieModal();
      showNotification('Kino bazada yangilandi! ✅');
        await fetchMovies();
      } else {
        if (currentMovie && previousMovie) Object.assign(currentMovie, previousMovie);
        renderMovies();
        showNotification('Xatolik: ' + result.error, 'error');
      }
    } catch (error) {
      if (currentMovie && previousMovie) Object.assign(currentMovie, previousMovie);
      renderMovies();
      console.error('Update error:', error);
      showNotification('Serverga ulanishda xatolik!', 'error');
    } finally {
      setButtonBusy(submitButton, false);
    }
  }
}

// Edit Movie
function editMovie(id) {
  const movie = movies.find(m => sameMovieId(m.id, id));
  if (movie) openMovieModal(movie);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

async function sendMoviePush(movieId, movieData, posterValue, savedMovie) {
  const ok = await window.ensureAdminSession('Admin parolini kiriting (push uchun):');
  if (!ok) throw new Error("Parol kerak");

  const text = (document.getElementById('moviePushText')?.value || '').trim();
  const mediaKind = document.querySelector('input[name="moviePushMedia"]:checked')?.value || 'poster';
  const addButton = document.getElementById('moviePushAddButton')?.checked;

  const payload = { text };
  if (addButton) {
    payload.buttonText = "🎬 Ko'rish";
    payload.buttonUrl = `${window.location.origin}/?movie=${encodeURIComponent(movieId)}`;
    payload.buttonAsWebApp = true; // Telegram mini app sifatida ochilsin (tashqi browser emas)
  }

  if (mediaKind === 'poster') {
    const url = posterValue;
    if (url && /^https?:\/\//i.test(url)) {
      payload.photoUrl = url;
    } else if (url && url.startsWith('data:')) {
      payload.mediaDataUrl = url;
      payload.mediaKind = 'photo';
    }
  } else if (mediaKind === 'image' || mediaKind === 'video') {
    const file = document.getElementById('moviePushFile')?.files?.[0];
    if (!file) throw new Error("Fayl tanlanmagan");
    if (file.size > 4 * 1024 * 1024) throw new Error("Fayl 4MB dan oshmasin");
    const dataUrl = await readFileAsDataUrl(file);
    payload.mediaDataUrl = dataUrl;
    payload.mediaKind = mediaKind === 'video' ? 'video' : 'photo';
  }
  // 'none' — faqat matn

  const resp = await fetch('/api/broadcast', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 401) { localStorage.removeItem('adminPassword'); localStorage.removeItem('adminLoggedIn'); }
  if (!data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  return data;
}

// ------------- Series (seriallar) -------------
let seriesList = [];
let filteredSeries = [];
let seriesSearchQuery = '';
let selectedSeriesPosterDataUrl = '';
let seriesLoaded = false;

function switchMovieTab(name) {
  if (!name) return;
  document.querySelectorAll('.movie-tab').forEach(tab => {
    const active = tab.dataset.movieTab === name;
    tab.classList.toggle('is-active', active);
  });
  document.querySelectorAll('.movie-tabpanel').forEach(panel => {
    panel.hidden = panel.dataset.movieTabpanel !== name;
  });
  if (name === 'series') {
    closeSeriesEditor();
    if (!seriesLoaded) fetchSeries();
  }
  if (name === 'categories') fetchCategories();
}

function switchAdTab(name) {
  if (!name) return;
  document.querySelectorAll('.ad-tab').forEach(tab => {
    const active = tab.dataset.adTab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.ad-tab-item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.adTabItem === name);
  });
  document.querySelectorAll('.ad-tabpanel').forEach(panel => {
    panel.hidden = panel.dataset.adTabpanel !== name;
  });
  if (name === 'broadcast') initBroadcastSection();
  if (name === 'fifalive') loadFifaLiveSettings();
  if (name === 'ticker') loadTickerSettings();
}

function normalizeSeriesFromApi(item) {
  const episodes = Array.isArray(item.episodes) ? item.episodes : [];
  const orderedEpisodes = episodes.map((ep, i) => {
    const rawSeason = Number(ep.season);
    return {
      id: String(ep.id || ''),
      title: String(ep.title || `Qism ${i + 1}`),
      defaultTitle: String(ep.defaultTitle || ep.title || `Qism ${i + 1}`),
      fileName: String(ep.fileName || ''),
      season: Number.isFinite(rawSeason) && rawSeason > 0 ? rawSeason : 1,
    };
  }).filter(ep => ep.id).sort(compareSeriesEpisodes);
  return {
    id: String(item.id || item.folderId || ''),
    name: item.title || item.folderName || 'Serial',
    folderName: item.folderName || '',
    description: item.description || '',
    poster: item.posterImage || item.poster || '',
    hasCustomPoster: Boolean(item.hasCustomPoster),
    episodeCount: Number(item.episodeCount || orderedEpisodes.length || 0),
    episodes: orderedEpisodes,
  };
}

async function fetchSeries(force = false) {
  const grid = document.getElementById('seriesCardGrid');
  const cached = readAdminCache('series');
  const applySeries = (data) => {
    seriesList = (Array.isArray(data) ? data : []).map(normalizeSeriesFromApi).filter(s => s.id);
    filteredSeries = [...seriesList];
    seriesLoaded = true;
    renderSeries();
  };
  if (cached?.data && !force) {
    applySeries(cached.data);
    if (cached.fresh) return seriesList;
  }
  if (grid && (force || !cached?.data)) {
    grid.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Seriallar yuklanmoqda...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/series`, { headers: cachedRequestHeaders(cached, force) });
    if (response.status === 304 && cached?.data) {
      writeAdminCache('series', cached.data, cached.etag);
      return seriesList;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Server xatolik: ${response.status}`);
    }
    const data = await response.json();
    writeAdminCache('series', data, response.headers.get('ETag') || '');
    applySeries(data);
    return seriesList;
  } catch (error) {
    console.error('Error fetching series:', error);
    if (cached?.data) return seriesList;
    seriesList = [];
    filteredSeries = [];
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state error-state">
          <h3>Seriallarni yuklashda xatolik!</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="fetchSeries()">Qayta urinish</button>
        </div>
      `;
    }
    showNotification('Seriallarni yuklashda xatolik: ' + error.message, 'error');
  }
}

function filterSeries(query) {
  seriesSearchQuery = String(query || '').toLowerCase().trim();
  if (!seriesSearchQuery) {
    filteredSeries = [...seriesList];
  } else {
    filteredSeries = seriesList.filter(s =>
      [s.name, s.folderName, s.description].join(' ').toLowerCase().includes(seriesSearchQuery)
    );
  }
  renderSeries();
}

function renderSeries() {
  const grid = document.getElementById('seriesCardGrid');
  if (!grid) return;

  const list = seriesSearchQuery ? filteredSeries : seriesList;

  const header = document.querySelector('#moviesSection [data-movie-tabpanel="series"] .section-header h2');
  if (header) header.textContent = `Seriallar ro'yxati (${seriesList.length})`;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>${seriesSearchQuery ? 'Qidiruv natijasi yo\'q' : 'Hozircha seriallar yo\'q'}</h3>
        <p>${seriesSearchQuery
          ? `"${escapeHtml(seriesSearchQuery)}" bo'yicha topilmadi`
          : 'Google Drive\'dagi "seriallar" papkasiga serial papkalarini qo\'shing.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(s => `
    <div class="series-card media-card" data-series-id="${escapeHtml(s.id)}" title="Tahrirlash">
      <div class="media-card__thumb" style="background-image:url('${escapeHtml(s.poster || '')}');"></div>
      <div class="media-card__body">
        <div class="media-card__title">${escapeHtml(s.name)}</div>
        <div class="media-card__meta">${s.episodeCount} ta qism</div>
      </div>
    </div>
  `).join('');
}

function updateSeriesPosterPreview(url) {
  const preview = document.getElementById('seriesPosterPreview');
  if (!preview) return;
  preview.style.backgroundImage = url ? `url('${String(proxiedPoster(url)).replace(/'/g, "%27")}')` : '';
}

function updateSeriesDescriptionCounter() {
  const textarea = document.getElementById('seriesDescription');
  const counter = document.getElementById('seriesDescriptionCounter');
  if (!textarea || !counter) return;

  const length = textarea.value.length;
  counter.textContent = `${length}/${MOVIE_DESCRIPTION_MAX_LENGTH}`;
  counter.classList.toggle('is-over', length > MOVIE_DESCRIPTION_MAX_LENGTH);
}

function renderSeriesEpisodes(series) {
  const wrap = document.getElementById('seriesEpisodesList');
  if (!wrap) return;
  const eps = Array.isArray(series.episodes) ? series.episodes : [];
  if (!eps.length) {
    wrap.innerHTML = `<p class="placeholder-text">Bu serialda hali qism (video fayl) yo'q.</p>`;
    return;
  }
  wrap.innerHTML = eps.map((ep, i) => `
    <div class="list-row series-episode-row">
      <span class="list-row__num">${i + 1}</span>
      <input type="text" class="form-input series-episode-input" data-ep-id="${escapeHtml(ep.id)}" data-default-title="${escapeHtml(ep.defaultTitle || '')}" value="${escapeHtml(ep.title || '')}" placeholder="Qism nomi">
      <label class="list-row__season">Fasl
        <input type="number" min="1" max="99" class="form-input series-episode-season" data-ep-id="${escapeHtml(ep.id)}" data-current-season="${escapeHtml(String(ep.season || 1))}" value="${escapeHtml(String(ep.season || 1))}">
      </label>
    </div>
  `).join('');
}

function openSeriesEditor(series) {
  if (!series) return;
  const form = document.getElementById('seriesForm');
  const posterFileInput = document.getElementById('seriesPosterFile');

  selectedSeriesPosterDataUrl = '';
  if (posterFileInput) posterFileInput.value = '';

  const titleEl = document.getElementById('seriesEditorTitle');
  if (titleEl) titleEl.textContent = series.name || 'Serial';
  document.getElementById('seriesName').value = series.name || '';

  const folderHint = document.getElementById('seriesFolderHint');
  if (folderHint) folderHint.textContent = series.folderName ? `Drive papkasi: ${series.folderName}` : '';

  document.getElementById('seriesEpisodeCount').value = `${series.episodeCount} ta qism`;
  document.getElementById('seriesDescription').value = series.description || '';
  if (form) form.dataset.editingId = series.id;

  const customPoster = series.hasCustomPoster ? series.poster : '';
  const posterUrlInput = document.getElementById('seriesPosterUrl');
  if (posterUrlInput) {
    posterUrlInput.value = (customPoster && !customPoster.startsWith('data:image')) ? customPoster : '';
  }
  updateSeriesPosterPreview(series.poster || '');
  updateSeriesDescriptionCounter();
  renderSeriesEpisodes(series);
  if (form) { form.dataset.formSnapshot = JSON.stringify({ name: series.name || '', description: series.description || '', poster: customPoster || '', episodes: (series.episodes || []).map(ep => [ep.id, ep.title || '', ep.season || 1]) }); form.dataset.dirty = '0'; }

  const listView = document.getElementById('seriesListAdminView');
  const editorView = document.getElementById('seriesEditorView');
  if (listView) listView.hidden = true;
  if (editorView) editorView.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSeriesEditor() {
  const listView = document.getElementById('seriesListAdminView');
  const editorView = document.getElementById('seriesEditorView');
  const form = document.getElementById('seriesForm');
  if (form?.dataset.dirty === '1' && !confirm('Saqlanmagan o‘zgarishlar bor. Formani yopmoqchimisiz?')) return;
  if (editorView) editorView.hidden = true;
  if (listView) listView.hidden = false;
}

function editSeries(id) {
  const series = seriesList.find(s => String(s.id) === String(id));
  if (series) openSeriesEditor(series);
}

async function handleSeriesSubmit() {
  const form = document.getElementById('seriesForm');
  const id = form?.dataset.editingId;
  if (!id) return;

  const current = seriesList.find(s => String(s.id) === String(id));
  const saveBtn = document.getElementById('seriesSaveBtn');

  const name = document.getElementById('seriesName').value.trim();
  const description = document.getElementById('seriesDescription').value;
  const posterUrl = document.getElementById('seriesPosterUrl').value.trim();
  const finalPoster = selectedSeriesPosterDataUrl || posterUrl;

  if (!name) {
    showNotification('Serial nomini kiriting.', 'error');
    return;
  }
  if (description.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
    updateSeriesDescriptionCounter();
    showDescriptionLimitError();
    return;
  }

  const payload = { id };
  if (!current || name !== current.name) payload.title = name;
  if (!current || description !== (current.description || '')) payload.description = description;
  const currentPoster = current && current.hasCustomPoster ? current.poster : '';
  if (finalPoster && finalPoster !== currentPoster) payload.posterImage = finalPoster;

  // Qism nomlari
  const episodeUpdates = {};
  let episodesChanged = false;
  const currentEpisodes = (current && Array.isArray(current.episodes)) ? current.episodes : [];
  document.querySelectorAll('#seriesEpisodesList .series-episode-input').forEach(input => {
    const epId = input.dataset.epId;
    if (!epId) return;
    const value = input.value.trim();
    const defaultTitle = input.dataset.defaultTitle || '';
    const currentEp = currentEpisodes.find(e => String(e.id) === String(epId));
    const currentTitle = currentEp ? currentEp.title : '';
    if (value !== currentTitle) episodesChanged = true;
    // Standart nom bilan bir xil bo'lsa override saqlanmaydi (bo'sh yuboriladi)
    episodeUpdates[epId] = (value && value !== defaultTitle) ? value : '';
  });
  if (episodesChanged) payload.episodes = episodeUpdates;

  // Fasl raqamlari
  const seasonUpdates = {};
  let seasonsChanged = false;
  document.querySelectorAll('#seriesEpisodesList .series-episode-season').forEach(input => {
    const epId = input.dataset.epId;
    if (!epId) return;
    const raw = Number(input.value);
    const season = Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
    const currentEp = currentEpisodes.find(e => String(e.id) === String(epId));
    const currentSeason = currentEp && Number(currentEp.season) > 0 ? Number(currentEp.season) : 1;
    if (season !== currentSeason) seasonsChanged = true;
    seasonUpdates[epId] = String(season);
  });
  if (seasonsChanged) payload.episodeSeasons = seasonUpdates;

  if (Object.keys(payload).length === 1) {
    showNotification('O\'zgarish yo\'q.');
    return;
  }

  const previousSeries = current ? { ...current, episodes: current.episodes?.map(ep => ({ ...ep })) } : null;
  try {
    setButtonBusy(saveBtn, true, 'Saqlanmoqda');
    if (current) { current.name = name; current.description = description; if (finalPoster) current.poster = finalPoster; renderSeries(); }

    const response = await fetch(`${API_URL}/series-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.ok) {
      showNotification('Serial bazada yangilandi! ✅');
      await fetchSeries();
      form.dataset.dirty = '0';
      closeSeriesEditor();
    } else {
      if (current && previousSeries) Object.assign(current, previousSeries);
      renderSeries();
      showNotification('Xatolik: ' + result.error, 'error');
    }
  } catch (error) {
    if (current && previousSeries) Object.assign(current, previousSeries);
    renderSeries();
    console.error('Series update error:', error);
    showNotification('Serverga ulanishda xatolik!', 'error');
  } finally {
    setButtonBusy(saveBtn, false);
  }
}

window.fetchSeries = fetchSeries;
window.editSeries = editSeries;

// Show Notification
function showNotification(message, type = 'success') {
  const text = String(message || 'Noma’lum xatolik.').trim();
  if (!text) return;
  const existing = [...document.querySelectorAll('.admin-toast')].find(node => node.dataset.message === text && node.dataset.type === type);
  if (existing) { existing.classList.remove('is-visible'); requestAnimationFrame(() => existing.classList.add('is-visible')); return; }
  const notification = document.createElement('div');
  notification.className = `admin-toast admin-toast-${type} is-visible`;
  notification.dataset.message = text; notification.dataset.type = type;
  notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
  notification.innerHTML = `<span class="admin-toast-icon">${type === 'error' ? '!' : type === 'warning' ? '!' : '✓'}</span><span class="admin-toast-message"></span><button type="button" class="admin-toast-close" aria-label="Yopish">×</button>`;
  notification.querySelector('.admin-toast-message').textContent = text;
  notification.querySelector('.admin-toast-close').addEventListener('click', () => notification.remove());
  let stack = document.querySelector('.admin-toast-stack');
  if (!stack) { stack = document.createElement('div'); stack.className = 'admin-toast-stack'; stack.setAttribute('aria-live', 'polite'); document.body.appendChild(stack); }
  stack.appendChild(notification);
  setTimeout(() => notification.classList.add('is-leaving'), type === 'error' ? 6000 : 3500);
  setTimeout(() => notification.remove(), type === 'error' ? 6350 : 3850);
}
window.addEventListener('error', (event) => {
  if (event?.message && !String(event.message).includes('ResizeObserver')) showNotification('Kutilmagan xatolik: ' + event.message, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  if (reason) showNotification('So‘rov bajarilmadi: ' + (reason.message || String(reason)), 'error');
});

function setButtonBusy(button, busy, label = '') {
  if (!button) return;
  if (busy) {
    if (button.dataset.busy === '1') return;
    button.dataset.busy = '1';
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="admin-button-spinner" aria-hidden="true"></span>${label ? `<span>${escapeHtml(label)}</span>` : ''}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalHtml || button.innerHTML;
    delete button.dataset.busy;
    delete button.dataset.originalHtml;
  }
}
function showUndoNotification(message, onUndo) {
  const notification = document.createElement('div');
  notification.className = 'admin-undo-toast';
  notification.innerHTML = `<span>${escapeHtml(message)}</span><button type="button">Bekor qilish</button>`;
  document.body.appendChild(notification);
  let closed = false;
  const close = () => { if (!closed) { closed = true; notification.remove(); } };
  notification.querySelector('button')?.addEventListener('click', async () => { close(); try { await onUndo?.(); } catch (err) { showNotification(`Bekor qilishda xato: ${err.message}`, 'error'); } });
  setTimeout(close, 6000);
}

// Check Auth — backend bilan tekshiramiz (hardcoded "admin123" tekshiruvi olib tashlandi)
async function checkAuth() {
  if (localStorage.getItem('adminLoggedIn') === '1') return;
  const password = (prompt('Admin panel parolini kiriting:') || '').trim();
  if (!password) { window.location.href = '/'; return; }
  const r = await window.adminLogin(password);
  if (!r.ok) {
    alert(r.error || "Noto'g'ri parol!");
    window.location.href = '/';
  }
}

// Add keyframe animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// ------------- Broadcast (xabar yuborish) -------------
let broadcastInited = false;

function escapeBroadcastHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function renderBroadcastPreview() {
  const preview = document.getElementById('broadcastPreview');
  if (!preview) return;
  const text = document.getElementById('broadcastText').value.trim();
  const photo = document.getElementById('broadcastPhotoUrl').value.trim();
  const btnText = document.getElementById('broadcastButtonText').value.trim();
  const btnUrl = document.getElementById('broadcastButtonUrl').value.trim();
  const asHtml = document.getElementById('broadcastParseHtml').checked;

  if (!text && !photo) {
    preview.innerHTML = '<div class="tg-preview__placeholder">Matn kiriting...</div>';
    return;
  }

  const textHtml = asHtml ? text.replace(/\n/g, '<br>') : escapeBroadcastHtml(text).replace(/\n/g, '<br>');
  const photoHtml = photo
    ? `<div class="tg-preview__photo"><img src="${escapeBroadcastHtml(photo)}" alt="" onerror="this.style.display='none'"></div>`
    : '';
  const buttonHtml = (btnText && btnUrl)
    ? `<div class="tg-preview__button">${escapeBroadcastHtml(btnText)}</div>`
    : '';
  preview.innerHTML = `${photoHtml}<div>${textHtml}</div>${buttonHtml}`;
}

function updateBroadcastCharCount() {
  const el = document.getElementById('broadcastText');
  const count = document.getElementById('broadcastTextCount');
  if (el && count) count.textContent = el.value.length;
}

async function loadBroadcastUserCount() {
  const el = document.getElementById('broadcastUserCount');
  if (!el) return;
  try {
    const resp = await fetch('/api/users', { headers: { Accept: 'application/json' } });
    const data = await resp.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
    el.textContent = String(list.length);
  } catch {
    el.textContent = '?';
  }
}

async function submitBroadcast(event) {
  event.preventDefault();
  const sendBtn = document.getElementById('broadcastSendBtn');
  const resultEl = document.getElementById('broadcastResult');
  const text = document.getElementById('broadcastText').value.trim();
  const photoUrl = document.getElementById('broadcastPhotoUrl').value.trim();
  const buttonText = document.getElementById('broadcastButtonText').value.trim();
  const buttonUrl = document.getElementById('broadcastButtonUrl').value.trim();
  const parseMode = document.getElementById('broadcastParseHtml').checked ? 'HTML' : '';
  const silent = document.getElementById('broadcastSilent').checked;
  const disablePreview = document.getElementById('broadcastDisablePreview').checked;

  if (!text && !photoUrl) {
    resultEl.innerHTML = '<div class="alert alert--error">Matn yoki rasm kerak.</div>';
    return;
  }
  if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
    resultEl.innerHTML = '<div class="alert alert--error">Tugma uchun ham matn, ham URL kerak.</div>';
    return;
  }
  if (!confirm('Barcha obunachilarga yuborilsinmi? Bekor qilib bo\'lmaydi.')) return;

  const okSess = await window.ensureAdminSession('Admin parolini kiriting (xavfsizlik uchun):');
  if (!okSess) return;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Yuborilmoqda...';
  resultEl.innerHTML = '<div class="alert alert--info">Yuborilmoqda, kuting...</div>';

  try {
    const resp = await fetch('/api/broadcast', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, photoUrl, buttonText, buttonUrl, parseMode, silent, disablePreview }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      if (resp.status === 401) { localStorage.removeItem('adminPassword'); localStorage.removeItem('adminLoggedIn'); }
      resultEl.innerHTML = `<div class="alert alert--error">Xato: ${escapeBroadcastHtml(data.error || 'Noma\'lum')}</div>`;
    } else {
      const errorList = Array.isArray(data.errors) && data.errors.length
        ? `<details><summary>Xatolar (${data.errors.length})</summary><pre>${escapeBroadcastHtml(JSON.stringify(data.errors, null, 2))}</pre></details>`
        : '';
      resultEl.innerHTML = `<div class="alert alert--success">
        <strong>Tugadi.</strong> Yuborildi: <strong>${data.sent}</strong>, xato: <strong>${data.failed}</strong>, jami: ${data.total}. (${Math.round(data.elapsedMs / 100) / 10}s)
        ${errorList}
      </div>`;
    }
  } catch (error) {
    resultEl.innerHTML = `<div class="alert alert--error">Tarmoq xatosi: ${escapeBroadcastHtml(error.message)}</div>`;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Yuborish';
  }
}

function initBroadcastSection() {
  if (broadcastInited) { loadBroadcastUserCount(); return; }
  broadcastInited = true;
  const form = document.getElementById('broadcastForm');
  const previewBtn = document.getElementById('broadcastPreviewBtn');
  const text = document.getElementById('broadcastText');
  const inputs = ['broadcastText', 'broadcastPhotoUrl', 'broadcastButtonText', 'broadcastButtonUrl', 'broadcastParseHtml'];
  inputs.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderBroadcastPreview);
    if (el) el.addEventListener('change', renderBroadcastPreview);
  });
  if (text) text.addEventListener('input', updateBroadcastCharCount);
  if (previewBtn) previewBtn.addEventListener('click', renderBroadcastPreview);
  if (form) form.addEventListener('submit', submitBroadcast);
  renderBroadcastPreview();
  updateBroadcastCharCount();
  loadBroadcastUserCount();
}

// Initialize
checkAuth();
init();

// Expose for inline handlers / retry buttons
window.fetchMovies = fetchMovies;
window.POSTER_PLACEHOLDER = POSTER_PLACEHOLDER;

// r2.dev burst'da ba'zi rasmlarni throttle qiladi -> darhol taslim bo'lmay
// biroz kutib qayta urinamiz, faqat 2 marta uddasidan chiqmasa placeholder.
function retryPoster(img) {
  if (!img || !img.dataset) return;
  const original = img.dataset.src || img.getAttribute('src');
  if (original && original.indexOf('data:image') === 0) return; // placeholder, urinmaymiz
  const tries = Number(img.dataset.retry || 0);
  if (tries >= 2) {
    img.onerror = null;
    img.src = POSTER_PLACEHOLDER;
    return;
  }
  img.dataset.retry = String(tries + 1);
  img.dataset.src = original;
  setTimeout(() => {
    // cache-bust qo'shib qayta so'raymiz (throttle bo'lgan so'rovni yangilash uchun)
    img.src = original + (original.indexOf('?') === -1 ? '?' : '&') + 'r=' + (tries + 1);
  }, 600 * (tries + 1));
}
window.retryPoster = retryPoster;
window.editMovie = editMovie;
window.fetchUsers = fetchUsers;

// ===== Musiqa =====
const MUSIC_LOCAL_KEY = 'kino_admin_music_v1';
let musicTracks = [];
let musicSearchQueryAdmin = '';
const musicFormCategories = new Set();

function trackCats(t) {
  if (Array.isArray(t.categories) && t.categories.length) return t.categories;
  if (t.category) return [t.category];
  return [];
}

function collectMusicCategories() {
  const seen = new Set();
  const out = [];
  const push = (name) => {
    const n = String(name || '').trim();
    if (!n) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  for (const t of musicTracks) for (const c of trackCats(t)) push(c);
  for (const c of musicFormCategories) push(c);
  out.sort((a, b) => a.localeCompare(b, 'uz'));
  return out;
}

function renderMusicCategoryChips() {
  const container = document.getElementById('musicCategoryChips');
  if (!container) return;
  const sel = new Set([...musicFormCategories].map((x) => x.toLowerCase()));
  const cats = collectMusicCategories();
  container.innerHTML = cats.length
    ? cats.map((name) => {
        const on = sel.has(name.toLowerCase());
        return `<button type="button" class="category-chip${on ? ' is-selected' : ''}" data-music-cat-chip="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
      }).join('')
    : `<span class="form-hint">Hali kategoriya yo'q — pastdan qo'shing.</span>`;
}

function musicTrackKey(t) {
  return `${String(t.title).toLowerCase()}|${String(t.artist).toLowerCase()}|${t.youtubeId}`;
}

function musicCatCellHtml(t) {
  const cats = trackCats(t);
  const available = collectMusicCategories().filter((c) => !cats.some((x) => x.toLowerCase() === c.toLowerCase()));
  const chips = cats.map((c) =>
    `<span class="music-cat-chip">${escapeHtml(c)}<button type="button" data-mcat-remove="${escapeHtml(c)}" aria-label="O'chirish">&times;</button></span>`
  ).join('') || `<span class="music-cat-empty">—</span>`;
  const opts = available.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  return `<div class="music-cat-cell" data-mcat-yt="${escapeHtml(t.youtubeId)}">
    <div class="music-cat-chips">${chips}</div>
    <select class="music-cat-select" data-mcat-add>
      <option value="">+ kategoriya</option>
      ${opts}
      <option value="__new__">✏️ Yangi...</option>
    </select>
  </div>`;
}

async function updateMusicCategories(youtubeId, categories) {
  const track = musicTracks.find((t) => t.youtubeId === youtubeId);
  if (!track) return;
  try {
    const res = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', key: musicTrackKey(track), categories }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicTracks = dedupeMusic(Array.isArray(json.tracks) ? json.tracks : []);
    renderMusicTable();
    renderMusicCategoryChips();
    showNotification('Kategoriya yangilandi.');
  } catch (err) {
    showNotification(`Yangilashda xato: ${err.message}`, 'error');
  }
}

function extractYoutubeId(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/^[\w-]{10,12}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([\w-]{10,12})/,
    /youtu\.be\/([\w-]{10,12})/,
    /youtube\.com\/embed\/([\w-]{10,12})/,
    /youtube\.com\/shorts\/([\w-]{10,12})/,
    /music\.youtube\.com\/watch\?v=([\w-]{10,12})/,
  ];
  for (const re of patterns) {
    const m = re.exec(value);
    if (m) return m[1];
  }
  return '';
}

function readLocalMusic() {
  try {
    const raw = localStorage.getItem(MUSIC_LOCAL_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}

function writeLocalMusic(list) {
  try { localStorage.setItem(MUSIC_LOCAL_KEY, JSON.stringify(list)); } catch (_) {}
}

function dedupeMusic(list) {
  const seen = new Map();
  for (const t of list) {
    if (!t || !t.title || !t.artist || !t.youtubeId) continue;
    const key = `${String(t.title).toLowerCase()}|${String(t.artist).toLowerCase()}|${t.youtubeId}`;
    if (!seen.has(key)) seen.set(key, t);
  }
  return Array.from(seen.values());
}

async function fetchMusic(force = false) {
  const tbody = document.getElementById('musicTableBody');
  const cached = readAdminCache('music');
  const applyMusic = (payload) => {
    const serverList = Array.isArray(payload?.tracks) ? payload.tracks : (Array.isArray(payload) ? payload : []);
    musicTracks = dedupeMusic(serverList);
    renderMusicTable();
    renderMusicCategoryChips();
    const summary = document.getElementById('musicStorageSummary');
    if (summary) {
      const storage = payload?.storage || 'seed';
      const isPersistent = storage === 'redis' || storage === 'kv';
      summary.textContent = isPersistent
        ? `Persistent Redis ulangan · ${musicTracks.length} ta qo'shiq`
        : `Faqat seed (Redis sozlanmagan) · ${musicTracks.length} ta qo'shiq`;
      setTone(summary, isPersistent ? 'ok' : 'warn');
    }
  };
  if (cached?.data && !force) {
    applyMusic(cached.data);
    if (cached.fresh) return musicTracks;
  }
  if (tbody && (force || !cached?.data)) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="loading-state"><div class="loading-spinner"></div><p>Yuklanmoqda...</p></div></td></tr>`;
  }
  try {
    const res = await fetch('/api/music', { cache: 'no-store', headers: cachedRequestHeaders(cached, force) });
    if (res.status === 304 && cached?.data) {
      writeAdminCache('music', cached.data, cached.etag);
      return musicTracks;
    }
    if (res.ok) {
      const json = await res.json();
      writeAdminCache('music', json, res.headers.get('ETag') || '');
      applyMusic(json);
      return musicTracks;
    }
  } catch (_) {}
  if (cached?.data) return musicTracks;
  musicTracks = [];
  renderMusicTable();
  renderMusicCategoryChips();
}

function renderMusicTable() {
  const tbody = document.getElementById('musicTableBody');
  if (!tbody) return;
  const q = musicSearchQueryAdmin.toLowerCase();
  const list = q
    ? musicTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : musicTracks;
  if (!list.length) {
    renderListPagination('music', 0, musicCurrentPage, MUSIC_PAGE_SIZE);
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>Qo'shiqlar yo'q</h3><p>Yangi qo'shiq qo'shing yoki qidiruvni tozalang.</p></div></td></tr>`;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / MUSIC_PAGE_SIZE));
  musicCurrentPage = Math.max(1, Math.min(totalPages, musicCurrentPage));
  const start = (musicCurrentPage - 1) * MUSIC_PAGE_SIZE;
  const pageSlice = list.slice(start, start + MUSIC_PAGE_SIZE);
  renderListPagination('music', list.length, musicCurrentPage, MUSIC_PAGE_SIZE);
  tbody.innerHTML = pageSlice.map(t => `
    <tr class="music-card-row">
      <td class="col-cover">
        <img src="https://i.ytimg.com/vi/${escapeHtml(t.youtubeId)}/mqdefault.jpg" alt="" class="music-cover-img" loading="lazy">
      </td>
      <td class="col-title">
        <div class="music-info-wrap">
          <strong class="music-title">${escapeHtml(t.title)}</strong>
          <div class="music-artist-name mobile-only">${escapeHtml(t.artist)}</div>
          <div class="music-mobile-cats mobile-only">${musicCatCellHtml(t)}</div>
        </div>
      </td>
      <td class="col-artist desktop-only">${escapeHtml(t.artist)}</td>
      <td class="col-cat desktop-only">${musicCatCellHtml(t)}</td>
      <td class="col-ytid desktop-only"><code>${escapeHtml(t.youtubeId)}</code></td>
      <td class="col-actions">
        <div class="actions">
          <a class="btn-icon view" href="https://www.youtube.com/watch?v=${escapeHtml(t.youtubeId)}" target="_blank" rel="noopener" title="YouTube'da ochish" aria-label="YouTube'da ochish">${ADMIN_ICONS.play}</a>
          <button class="btn-icon delete" data-music-delete="${escapeHtml(t.youtubeId)}|${escapeHtml(t.title)}|${escapeHtml(t.artist)}" title="O'chirish" aria-label="O'chirish">${ADMIN_ICONS.trash}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function addMusicTrack(payload, button) {
  const previousTracks = [...musicTracks];
  musicTracks = dedupeMusic([...musicTracks, payload]);
  renderMusicTable();
  setButtonBusy(button, true, "Qo'shilmoqda");
  try {
    const res = await fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: payload }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicTracks = dedupeMusic(Array.isArray(json.tracks) ? json.tracks : musicTracks);
    renderMusicTable(); renderMusicCategoryChips();
    showNotification(`"${payload.title}" qo'shildi.`);
  } catch (err) {
    musicTracks = previousTracks; renderMusicTable();
    showNotification(`Qo'shishda xato: ${err.message}`, 'error');
  } finally { setButtonBusy(button, false); }
}
async function deleteMusicTrack(youtubeId, title, artist, button) {
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}|${youtubeId}`;
  const removed = musicTracks.find(t => t.youtubeId === youtubeId);
  const previousTracks = [...musicTracks];
  musicTracks = musicTracks.filter(t => t.youtubeId !== youtubeId); renderMusicTable();
  setButtonBusy(button, true, "O'chirilmoqda");
  try {
    const res = await fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', key }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicTracks = dedupeMusic(Array.isArray(json.tracks) ? json.tracks : musicTracks); renderMusicTable();
    showUndoNotification("Qo'shiq o'chirildi.", async () => {
      if (!removed) return;
      const restore = await fetch('/api/music', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ track: removed }) });
      if (!restore.ok) throw new Error("Qo'shiqni qaytarib bo'lmadi");
      const data = await restore.json(); musicTracks = dedupeMusic(Array.isArray(data.tracks) ? data.tracks : [...musicTracks, removed]); renderMusicTable(); showNotification("Qo'shiq qaytarildi.");
    });
  } catch (err) {
    musicTracks = previousTracks; renderMusicTable(); showNotification(`O'chirishda xato: ${err.message}`, 'error');
  } finally { setButtonBusy(button, false); }
}
function exportMusicJSON() {
  const json = JSON.stringify(musicTracks, null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(
      () => showNotification('JSON clipboardga nusxalandi.'),
      () => fallbackDownloadJson(json),
    );
  } else {
    fallbackDownloadJson(json);
  }
}

function fallbackDownloadJson(json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'music.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById('musicForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('musicTitle').value.trim();
  const artist = document.getElementById('musicArtist').value.trim();
  const link = document.getElementById('musicLink').value.trim();
  const youtubeId = extractYoutubeId(link);
  const hint = document.getElementById('musicLinkHint');
  if (!youtubeId) {
    if (hint) { hint.textContent = "YouTube link noto'g'ri."; setTone(hint, 'error'); }
    return;
  }
  const categories = [...musicFormCategories];
  const catHint = document.getElementById('musicCategoryHint');
  if (!categories.length) {
    if (catHint) { catHint.textContent = 'Kamida bitta kategoriya tanlang.'; setTone(catHint, 'error'); }
    return;
  }
  if (catHint) { catHint.textContent = 'Kamida bitta kategoriya tanlang.'; setTone(catHint, ''); }
  if (hint) { hint.textContent = `Video ID: ${youtubeId}`; setTone(hint, ''); }
  addMusicTrack({ title, artist, categories, youtubeId }, e.target.querySelector('button[type="submit"]'));
  e.target.reset();
  musicFormCategories.clear();
  renderMusicCategoryChips();
});

// --- Music form category multiselect ---
document.getElementById('musicCategoryChips')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-music-cat-chip]');
  if (!chip) return;
  const name = chip.dataset.musicCatChip;
  const match = [...musicFormCategories].find((x) => x.toLowerCase() === name.toLowerCase());
  if (match) musicFormCategories.delete(match);
  else musicFormCategories.add(name);
  renderMusicCategoryChips();
});
function addMusicFormCategory() {
  const input = document.getElementById('musicCategoryNew');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  const existing = collectMusicCategories().find((x) => x.toLowerCase() === name.toLowerCase());
  musicFormCategories.add(existing || name);
  input.value = '';
  renderMusicCategoryChips();
}
document.getElementById('musicAddCategoryBtn')?.addEventListener('click', addMusicFormCategory);
document.getElementById('musicCategoryNew')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addMusicFormCategory(); }
});

// --- Music table inline category editor ---
document.getElementById('musicTableBody')?.addEventListener('change', (e) => {
  const select = e.target.closest('[data-mcat-add]');
  if (!select) return;
  const cell = select.closest('[data-mcat-yt]');
  const youtubeId = cell?.dataset.mcatYt;
  if (!youtubeId) return;
  let value = select.value;
  select.value = '';
  if (!value) return;
  if (value === '__new__') {
    value = (prompt('Yangi kategoriya nomi:') || '').trim();
    if (!value) return;
  }
  const track = musicTracks.find((t) => t.youtubeId === youtubeId);
  if (!track) return;
  const cats = trackCats(track);
  if (cats.some((c) => c.toLowerCase() === value.toLowerCase())) return;
  updateMusicCategories(youtubeId, [...cats, value]);
});

document.getElementById('musicLink')?.addEventListener('input', (e) => {
  const hint = document.getElementById('musicLinkHint');
  if (!hint) return;
  const id = extractYoutubeId(e.target.value);
  if (id) { hint.textContent = `Video ID: ${id}`; setTone(hint, ''); }
  else { hint.textContent = 'Video ID havoladan avtomatik ajratiladi.'; setTone(hint, ''); }
});

document.getElementById('musicExportBtn')?.addEventListener('click', exportMusicJSON);
document.getElementById('musicReloadBtn')?.addEventListener('click', () => fetchMusic(true));
document.getElementById('musicSearchAdminInput')?.addEventListener('input', debounce((e) => {
  musicSearchQueryAdmin = e.target.value.trim();
  musicCurrentPage = 1;
  renderMusicTable();
}));
document.getElementById('musicTableBody')?.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-mcat-remove]');
  if (rm) {
    const cell = rm.closest('[data-mcat-yt]');
    const youtubeId = cell?.dataset.mcatYt;
    const track = youtubeId && musicTracks.find((t) => t.youtubeId === youtubeId);
    if (!track) return;
    const cats = trackCats(track);
    const next = cats.filter((c) => c.toLowerCase() !== rm.dataset.mcatRemove.toLowerCase());
    if (!next.length) { showNotification('Kamida bitta kategoriya qolishi kerak.', 'error'); return; }
    updateMusicCategories(youtubeId, next);
    return;
  }
  const btn = e.target.closest('[data-music-delete]');
  if (!btn) return;
  const [youtubeId, title, artist] = btn.dataset.musicDelete.split('|');
  if (confirm(`O'chirilsinmi: ${title} — ${artist}?`)) deleteMusicTrack(youtubeId, title, artist, btn);
});

window.fetchMusic = fetchMusic;

// ===== Qo'shiqchilar (artists) =====
let musicArtists = [];
let artistUploadedUrl = '';

function splitArtistsAdmin(name) {
  if (!name) return [];
  return String(name)
    .split(/\s*(?:&|,)\s*|\s+(?:feat\.?|ft\.?|and|x|×)\s+/i)
    .map((s) => s.trim()).filter(Boolean);
}

function eligibleArtistNames() {
  const counts = new Map();
  musicTracks.forEach((t) => {
    splitArtistsAdmin(t.artist).forEach((a) => {
      const k = a.trim();
      if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    });
  });
  const result = [];
  const seen = new Set();
  // 1) Saqlangan qo'shiqchilar (manuallarsiz YT kanal-artistlar ham) — har doim ko'rinadi
  for (const a of musicArtists) {
    const name = String(a?.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, count: counts.get(name) || 0 });
  }
  // 2) 4+ qo'shig'i bo'lganlar
  for (const [name, n] of counts.entries()) {
    if (n < 4) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ name, count: n });
  }
  return result.sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, 'uz'));
}

async function fetchArtists() {
  try {
    const res = await fetch('/api/music?resource=artists', { cache: 'no-store' });
    const json = await res.json();
    musicArtists = Array.isArray(json.artists) ? json.artists : [];
  } catch (_) {
    musicArtists = [];
  }
}

function findArtistRecord(name) {
  const t = String(name || '').toLowerCase();
  return musicArtists.find((a) => a.name.toLowerCase() === t) || null;
}

function artistCardHtml(name, subtitle, rec) {
  const img = rec?.image ? `<img class="artist-card__img" src="${escapeHtml(rec.image)}" alt="">` : '';
  const overlay = rec?.image ? `<div class="artist-card__shade"></div>` : '';
  return `
    <button type="button" class="artist-card${rec?.image ? ' artist-card--image' : ''}" data-artist-edit="${escapeHtml(name)}">
      ${img}${overlay}
      <div class="artist-card__text">
        <div class="artist-card__name">${escapeHtml(name)}</div>
        <div class="artist-card__meta">${escapeHtml(subtitle)}</div>
      </div>
    </button>`;
}

async function renderArtistsCardGrid() {
  const grid = document.getElementById('artistsCardGrid');
  if (!grid) return;
  try { await fetchMusic(); } catch (_) {}
  await fetchArtists();
  const eligible = eligibleArtistNames();
  const allRec = findArtistRecord('Hammasi');
  const allCard = artistCardHtml('Hammasi', `Barcha musiqalar cardi${allRec ? ' · saqlangan' : ''}`, allRec);
  const artistCards = eligible.map(({ name, count }) =>
    artistCardHtml(name, `${count} ta qo'shiq${findArtistRecord(name) ? ' · saqlangan' : ''}`, findArtistRecord(name))
  ).join('');
  grid.innerHTML = allCard + artistCards;
}

function setArtistPreview(url) {
  const preview = document.getElementById('artistImagePreview');
  if (!preview) return;
  preview.style.backgroundImage = url ? `url('${String(proxiedPoster(url)).replaceAll("'", '%27')}')` : 'none';
}

function showArtistsListView() {
  document.getElementById('artistsListView').hidden = false;
  document.getElementById('artistsEditorView').hidden = true;
}

function showArtistsEditorView() {
  document.getElementById('artistsListView').hidden = true;
  document.getElementById('artistsEditorView').hidden = false;
}

function fillArtistTracks(name) {
  const tbody = document.getElementById('artistTracksBody');
  if (!tbody) return;
  const target = name.toLowerCase();
  const list = musicTracks.filter((t) => splitArtistsAdmin(t.artist).some((a) => a.toLowerCase() === target));
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>Qo'shiq topilmadi.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((t) => `
    <tr>
      <td><img src="https://i.ytimg.com/vi/${escapeHtml(t.youtubeId)}/mqdefault.jpg" alt="" class="music-cover-img" loading="lazy"></td>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td><span class="badge">${escapeHtml(t.category || 'Boshqa')}</span></td>
      <td><code>${escapeHtml(t.youtubeId)}</code></td>
    </tr>`).join('');
}

async function openArtistEditor(name) {
  const rec = findArtistRecord(name);
  const isAll = name.toLowerCase() === 'hammasi';
  document.getElementById('artistEditId').value = rec?.id || '';
  document.getElementById('artistEditOrigName').value = name;
  document.getElementById('artistName').value = rec?.name || name;
  document.getElementById('artistLink').value = rec?.link || '';
  document.getElementById('artistImageUrl').value = rec?.image || '';
  document.getElementById('artistEditorTitle').textContent = name;
  document.getElementById('artistDeleteBtn').hidden = !rec;
  const purgeBtn = document.getElementById('artistPurgeBtn');
  if (purgeBtn) {
    const target = name.toLowerCase();
    const trackCount = isAll ? 0 : musicTracks.filter((t) => splitArtistsAdmin(t.artist).some((a) => a.toLowerCase() === target)).length;
    purgeBtn.hidden = isAll || (!rec && trackCount === 0);
    purgeBtn.dataset.purgeName = name;
    purgeBtn.dataset.purgeCount = String(trackCount);
  }
  artistUploadedUrl = rec?.image || '';
  setArtistPreview(rec?.image || '');
  const tracksSection = document.getElementById('artistTracksSection');
  if (tracksSection) tracksSection.hidden = isAll;
  if (!isAll) fillArtistTracks(name);
  showArtistsEditorView();
}

async function saveArtist(e) {
  e.preventDefault();
  const id = document.getElementById('artistEditId').value.trim();
  const name = document.getElementById('artistName').value.trim();
  const link = document.getElementById('artistLink').value.trim();
  const urlInput = document.getElementById('artistImageUrl').value.trim();
  const image = artistUploadedUrl || urlInput;
  if (!name) { showNotification('Nom kerak.', 'error'); return; }
  const action = id ? 'update' : 'create';
  try {
    const res = await fetch('/api/music?resource=artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, name, link, image }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicArtists = Array.isArray(json.artists) ? json.artists : musicArtists;
    showNotification('Saqlandi.');
    showArtistsListView();
    renderArtistsCardGrid();
  } catch (err) {
    showNotification(`Saqlashda xato: ${err.message}`, 'error');
  }
}

async function deleteArtist() {
  const id = document.getElementById('artistEditId').value.trim();
  if (!id) return;
  if (!confirm("Qo'shiqchini o'chirilsinmi?")) return;
  try {
    const res = await fetch('/api/music?resource=artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicArtists = Array.isArray(json.artists) ? json.artists : [];
    showNotification("O'chirildi.");
    showArtistsListView();
    renderArtistsCardGrid();
  } catch (err) {
    showNotification(`O'chirishda xato: ${err.message}`, 'error');
  }
}

async function purgeArtistWithTracks() {
  const btn = document.getElementById('artistPurgeBtn');
  const name = btn?.dataset.purgeName || document.getElementById('artistEditOrigName').value.trim();
  const id = document.getElementById('artistEditId').value.trim();
  if (!name) return;
  const target = name.toLowerCase();
  const tracks = musicTracks.filter((t) => splitArtistsAdmin(t.artist).some((a) => a.toLowerCase() === target));
  const msg = `"${name}" qo'shiqchi va uning ${tracks.length} ta qo'shig'i butunlay o'chirilsinmi?\n\nBu amal qaytarib bo'lmaydi.`;
  if (!confirm(msg)) return;
  btn.disabled = true;
  const prevText = btn.textContent;
  btn.textContent = "O'chirilmoqda...";
  try {
    const deletions = tracks.map((t) => {
      const key = `${String(t.title).toLowerCase()}|${String(t.artist).toLowerCase()}|${t.youtubeId}`;
      return fetch('/api/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key }),
      }).then((r) => r.json().catch(() => ({}))).then((j) => { if (!j || j.ok === false) throw new Error(j?.error || 'qo\'shiq o\'chmadi'); });
    });
    await Promise.all(deletions);
    if (id) {
      const res = await fetch('/api/music?resource=artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      musicArtists = Array.isArray(json.artists) ? json.artists : musicArtists.filter((a) => a.id !== id);
    }
    await fetchMusic();
    showNotification(`"${name}" va ${tracks.length} ta qo'shiq o'chirildi.`);
    showArtistsListView();
    renderArtistsCardGrid();
  } catch (err) {
    showNotification(`O'chirishda xato: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = prevText;
  }
}

async function uploadArtistImageFile(file) {
  try {
    const raw = await readFileAsDataUrl(file);
    const compressed = await compressImageDataUrl(raw, 1600, 900, 0.86);
    const res = await fetch('/api/music?resource=artists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload', dataUrl: compressed, name: document.getElementById('artistName').value.trim() || 'artist' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) throw new Error(json.error || `HTTP ${res.status}`);
    artistUploadedUrl = json.url;
    document.getElementById('artistImageUrl').value = json.url;
    setArtistPreview(json.url);
    showNotification('Rasm yuklandi.');
  } catch (err) {
    showNotification(`Rasm yuklashda xato: ${err.message}`, 'error');
  }
}

document.addEventListener('click', (e) => {
  // Futbol bo'limi tablari: bir vaqtda faqat tanlangan karta ko'rinadi.
  const fifaTab = e.target.closest('[data-fifa-tab]');
  if (fifaTab) {
    document.querySelectorAll('[data-fifa-tab]').forEach((t) => {
      const active = t === fifaTab;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-fifa-tabpanel]').forEach((p) => {
      p.hidden = p.dataset.fifaTabpanel !== fifaTab.dataset.fifaTab;
    });
    return;
  }
  const tab = e.target.closest('[data-music-tab]');
  if (tab) {
    document.querySelectorAll('.music-tab[data-music-tab]').forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-music-tabpanel]').forEach((p) => {
      p.hidden = p.dataset.musicTabpanel !== tab.dataset.musicTab;
    });
    if (tab.dataset.musicTab === 'artists') {
      showArtistsListView();
      renderArtistsCardGrid();
    }
    if (tab.dataset.musicTab === 'ytchannels') {
      fetchYtChannels();
    }
    return;
  }
  const card = e.target.closest('[data-artist-edit]');
  if (card) {
    openArtistEditor(card.dataset.artistEdit);
  }
});

document.getElementById('artistForm')?.addEventListener('submit', saveArtist);
document.getElementById('artistEditorBack')?.addEventListener('click', () => { showArtistsListView(); renderArtistsCardGrid(); });
document.getElementById('artistDeleteBtn')?.addEventListener('click', deleteArtist);
document.getElementById('artistPurgeBtn')?.addEventListener('click', purgeArtistWithTracks);
document.getElementById('artistImageFile')?.addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (f) uploadArtistImageFile(f);
});
document.getElementById('artistImageUrl')?.addEventListener('input', (e) => {
  artistUploadedUrl = '';
  setArtistPreview(e.target.value.trim());
});

// ===== YouTube qo'shiqchilar (music channels) =====
let ytChannels = [];
let ytChannelUploadedUrl = '';

function setYtChannelPreview(url) {
  const el = document.getElementById('ytChannelImagePreview');
  if (!el) return;
  el.style.backgroundImage = url ? `url('${String(url).replaceAll("'", '%27')}')` : 'none';
}

async function fetchYtChannels() {
  const grid = document.getElementById('ytChannelsListGrid');
  const summary = document.getElementById('ytChannelsSummary');
  if (grid) grid.innerHTML = '<div class="empty-state"><p>Yuklanmoqda...</p></div>';
  try {
    const r = await fetch(`/api/music?resource=music-channels&t=${Date.now()}`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    ytChannels = Array.isArray(data.channels) ? data.channels : [];
    renderYtChannels();
    if (summary) summary.textContent = `${ytChannels.length} ta qo'shiqchi qo'shilgan.`;
  } catch (err) {
    console.error('yt-channels fetch:', err);
    if (grid) grid.innerHTML = `<div class="empty-state"><p>Xato: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderYtChannels() {
  const grid = document.getElementById('ytChannelsListGrid');
  if (!grid) return;
  if (!ytChannels.length) {
    grid.innerHTML = `<div class="empty-state"><p>Hali qo'shiqchi qo'shilmagan.</p></div>`;
    return;
  }
  grid.innerHTML = ytChannels.map((c) => {
    const name = c.customName || c.snapshot?.title || c.channelId;
    const image = c.customImage || c.snapshot?.avatar || '';
    const videoCount = (c.videos || []).length;
    const initial = (name && name[0] ? name[0] : '?').toUpperCase();
    const needsFix = !c.snapshot?.title || !c.snapshot?.avatar;
    const avatarHtml = image
      ? `<img class="avatar" src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar',textContent:${escapeHtml(JSON.stringify(initial))}}));">`
      : `<div class="avatar">${escapeHtml(initial)}</div>`;
    return `
      <div class="yt-channel-card entity-card">
        <div class="entity-card__head">
          ${avatarHtml}
          <div class="entity-card__info">
            <div class="entity-card__title">${escapeHtml(name)}</div>
            <div class="entity-card__meta">${videoCount} ta video${c.syncStatus === 'syncing' ? ' · <span data-tone="info">Navbatda yuklanmoqda...</span>' : ''}${c.snapshot?.title && c.snapshot.title !== name ? ' · ' + escapeHtml(c.snapshot.title) : ''}${needsFix ? ' · <span data-tone="warn">YT ma\'lumoti yo\'q</span>' : ''}</div>
          </div>
        </div>
        <div class="entity-card__actions">
          <button class="btn btn-secondary btn-sm" data-ytch-edit="${escapeHtml(c.channelId)}">Tahrirlash</button>
          <button class="btn btn-secondary btn-sm" data-ytch-refresh="${escapeHtml(c.channelId)}">Yangilash</button>
          <button class="btn btn-danger-soft btn-sm" data-ytch-delete="${escapeHtml(c.channelId)}|${escapeHtml(name)}">O'chirish</button>
        </div>
      </div>`;
  }).join('');
}

async function addYtChannel(input, customName, customImage) {
  const btn = document.getElementById('ytChannelSubmitBtn');
  const hint = document.getElementById('ytChannelInputHint');
  if (btn) { btn.disabled = true; btn.textContent = "Qo'shilmoqda..."; }
  if (hint) hint.textContent = "YouTube'dan ma'lumot olinmoqda...";
  try {
    const r = await fetch('/api/music?resource=music-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', input, customName, customImage }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    ytChannels = Array.isArray(data.channels) ? data.channels : ytChannels;
    renderYtChannels();
    document.getElementById('ytChannelInput').value = '';
    document.getElementById('ytChannelCustomName').value = '';
    document.getElementById('ytChannelCustomImageUrl').value = '';
    ytChannelUploadedUrl = '';
    setYtChannelPreview('');
    showNotification("Qo'shiqchi qo'shildi.");
    if (hint) hint.textContent = "@handle, /channel/UC..., /c/Name yoki to'liq URL — barchasi ishlaydi.";
  } catch (err) {
    if (hint) hint.textContent = `Xato: ${err.message}`;
    showNotification(`Xato: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "+ Qo'shiqchi qo'shish"; }
  }
}

async function deleteYtChannel(channelId, name) {
  if (!confirm(`O'chirilsinmi: ${name}?`)) return;
  try {
    const r = await fetch('/api/music?resource=music-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', channelId }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    ytChannels = Array.isArray(data.channels) ? data.channels : ytChannels.filter((c) => c.channelId !== channelId);
    renderYtChannels();
    showNotification("O'chirildi.");
  } catch (err) {
    showNotification(`Xato: ${err.message}`, 'error');
  }
}

async function refreshYtChannel(channelId) {
  try {
    const r = await fetch('/api/music?resource=music-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', channelId }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    const idx = ytChannels.findIndex((c) => c.channelId === channelId);
    if (idx >= 0 && data.channel) ytChannels[idx] = data.channel;
    renderYtChannels();
    showNotification('Yangilandi.');
  } catch (err) {
    showNotification(`Xato: ${err.message}`, 'error');
  }
}

async function editYtChannel(channelId) {
  const ch = ytChannels.find((c) => c.channelId === channelId);
  if (!ch) return;
  const currName = ch.customName || ch.snapshot?.title || '';
  const newName = prompt("Qo'shiqchi nomi:", currName);
  if (newName === null) return;
  const currImg = ch.customImage || '';
  const newImg = prompt("Rasm URL (bo'sh = kanal avatari):", currImg);
  if (newImg === null) return;
  try {
    const r = await fetch('/api/music?resource=music-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', channelId, customName: newName.trim(), customImage: newImg.trim() }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
    const idx = ytChannels.findIndex((c) => c.channelId === channelId);
    if (idx >= 0 && data.channel) ytChannels[idx] = data.channel;
    renderYtChannels();
    showNotification('Saqlandi.');
  } catch (err) {
    showNotification(`Xato: ${err.message}`, 'error');
  }
}

async function uploadYtChannelImage(file) {
  try {
    const raw = await readFileAsDataUrl(file);
    const compressed = await compressImageDataUrl(raw, 800, 800, 0.86);
    const res = await fetch('/api/music?resource=music-channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload', dataUrl: compressed, name: document.getElementById('ytChannelCustomName').value.trim() || 'channel' }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.url) throw new Error(json.error || `HTTP ${res.status}`);
    ytChannelUploadedUrl = json.url;
    document.getElementById('ytChannelCustomImageUrl').value = json.url;
    setYtChannelPreview(json.url);
    showNotification('Rasm yuklandi.');
  } catch (err) {
    showNotification(`Rasm yuklashda xato: ${err.message}`, 'error');
  }
}

document.getElementById('ytChannelForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('ytChannelInput').value.trim();
  const customName = document.getElementById('ytChannelCustomName').value.trim();
  const urlInput = document.getElementById('ytChannelCustomImageUrl').value.trim();
  const customImage = ytChannelUploadedUrl || urlInput;
  if (!input) return;
  addYtChannel(input, customName, customImage);
});
document.getElementById('ytChannelReloadBtn')?.addEventListener('click', () => fetchYtChannels());
document.getElementById('ytChannelRefreshAllBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('ytChannelRefreshAllBtn');
  if (!btn || btn.disabled) return;
  if (!ytChannels.length) { showNotification('Kanallar yo\'q.'); return; }
  if (!confirm(`${ytChannels.length} ta kanalning rasm, nom va video ro'yxati YouTube'dan qaytadan tortib olinsin?`)) return;
  btn.disabled = true;
  const orig = btn.textContent;
  let ok = 0, fail = 0;
  for (let i = 0; i < ytChannels.length; i++) {
    const c = ytChannels[i];
    btn.textContent = `Yangilanmoqda ${i + 1}/${ytChannels.length}...`;
    try {
      const r = await fetch('/api/music?resource=music-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', channelId: c.channelId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`);
      if (data.channel) {
        const idx = ytChannels.findIndex((x) => x.channelId === c.channelId);
        if (idx >= 0) ytChannels[idx] = data.channel;
      }
      ok++;
    } catch (err) {
      console.warn('refresh fail', c.channelId, err.message);
      fail++;
    }
    renderYtChannels();
  }
  btn.disabled = false;
  btn.textContent = orig;
  showNotification(`Yangilandi: ${ok}${fail ? ` · xato: ${fail}` : ''}`);
});
document.getElementById('ytChannelImageFile')?.addEventListener('change', (e) => {
  const f = e.target.files?.[0]; if (f) uploadYtChannelImage(f);
});
document.getElementById('ytChannelCustomImageUrl')?.addEventListener('input', (e) => {
  ytChannelUploadedUrl = '';
  setYtChannelPreview(e.target.value.trim());
});
document.getElementById('ytChannelsListGrid')?.addEventListener('click', (e) => {
  const del = e.target.closest('[data-ytch-delete]');
  if (del) {
    const [id, name] = del.dataset.ytchDelete.split('|');
    deleteYtChannel(id, name);
    return;
  }
  const ref = e.target.closest('[data-ytch-refresh]');
  if (ref) { refreshYtChannel(ref.dataset.ytchRefresh); return; }
  const ed = e.target.closest('[data-ytch-edit]');
  if (ed) { editYtChannel(ed.dataset.ytchEdit); return; }
});

// ===== Kategoriyalar =====
let categoriesList = [];
let categoryUploadedUrl = '';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Faylni o'qib bo'lmadi."));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function compressImageDataUrl(dataUrl, maxW = 1200, maxH = 800, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) {
        const s = Math.min(maxW / w, maxH / h);
        w = Math.round(w * s); h = Math.round(h * s);
      }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

async function uploadCategoryImage(dataUrl, name) {
  const resp = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload', dataUrl, folder: 'categories', name }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.url) throw new Error(json.error || `HTTP ${resp.status}`);
  return json.url;
}

function setCategoryPreview(url) {
  const preview = document.getElementById('categoryImagePreview');
  if (!preview) return;
  if (url) {
    preview.style.backgroundImage = `url('${String(proxiedPoster(url)).replaceAll("'", "%27")}')`;
  } else {
    preview.style.backgroundImage = 'none';
  }
}

function resetCategoryForm() {
  const form = document.getElementById('categoryForm');
  if (form) form.reset();
  document.getElementById('categoryEditId').value = '';
  categoryUploadedUrl = '';
  setCategoryPreview('');
  const btn = document.getElementById('categorySubmitBtn');
  if (btn) btn.textContent = "+ Qo'shish";
  const hint = document.getElementById('categoryImageHint');
  if (hint) { hint.textContent = "Yoki pastdagi URL maydoniga to'g'ridan-to'g'ri link kiriting."; setTone(hint, ''); }
}

async function fetchCategories(force = false) {
  const tbody = document.getElementById('categoriesTableBody');
  const cached = readAdminCache('categories');
  const applyCategories = (json) => {
    categoriesList = Array.isArray(json?.categories) ? json.categories : [];
    const movieCats = collectKnownCategories();
    const datalist = document.getElementById('categoryNameList');
    if (datalist) datalist.innerHTML = movieCats.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
    const summary = document.getElementById('categoriesStorageSummary');
    if (summary) {
      const ok = json?.storage === 'redis';
      summary.textContent = ok
        ? `Redis ulangan · ${categoriesList.length} ta saqlangan, ${movieCats.length} ta kinolarda`
        : `Redis sozlanmagan · ${categoriesList.length} ta saqlangan`;
      setTone(summary, ok ? 'ok' : 'warn');
    }
    renderCategoriesTable();
  };
  if (cached?.data && !force) {
    if (!movies.length) { try { await fetchMovies(); } catch (_) {} }
    applyCategories(cached.data);
    if (cached.fresh) return categoriesList;
  }
  if (tbody && (force || !cached?.data)) tbody.innerHTML = `<tr><td colspan="4"><div class="loading-state"><div class="loading-spinner"></div><p>Yuklanmoqda...</p></div></td></tr>`;
  try {
    if (!movies.length) { try { await fetchMovies(); } catch (_) {} }
    const res = await fetch('/api/categories', { cache: 'no-store', headers: cachedRequestHeaders(cached, force) });
    if (res.status === 304 && cached?.data) {
      writeAdminCache('categories', cached.data, cached.etag);
      return categoriesList;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    writeAdminCache('categories', json, res.headers.get('ETag') || '');
    applyCategories(json);
    return categoriesList;
  } catch (err) {
    if (cached?.data) return categoriesList;
    if (tbody) tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state error-state"><h3>Xatolik</h3><p>${escapeHtml(err.message)}</p></div></td></tr>`;
  }
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categoriesTableBody');
  if (!tbody) return;
  const savedByKey = new Map(categoriesList.map((c) => [c.name.toLowerCase(), c]));
  const movieCats = collectKnownCategories();
  const rows = [];
  const seriesKey = 'seriallar';
  if (savedByKey.has(seriesKey)) {
    rows.push({ ...savedByKey.get(seriesKey), source: 'series' });
    savedByKey.delete(seriesKey);
  } else {
    rows.push({ id: '', name: 'Seriallar', image: '', source: 'series' });
  }
  for (const name of movieCats) {
    const key = name.toLowerCase();
    if (key === seriesKey) continue;
    if (savedByKey.has(key)) {
      rows.push({ ...savedByKey.get(key), source: 'both' });
      savedByKey.delete(key);
    } else {
      rows.push({ id: '', name, image: '', source: 'movie' });
    }
  }
  for (const c of savedByKey.values()) rows.push({ ...c, source: 'saved' });
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><h3>Kategoriyalar yo'q</h3><p>Avval kinolar admin paneldan kategoriya bilan qo'shilishi kerak, yoki yuqoridagi formadan qo'lda kategoriya qo'shing.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((c) => {
    const imageCell = c.image
      ? `<img src="${escapeHtml(c.image)}" alt="" class="cat-cover-img" loading="lazy">`
      : '<span class="cat-no-image">Rasm yo\'q</span>';
    const statusBadge = c.source === 'movie'
      ? '<span class="badge badge-cat badge-cat-movie">Kinolarda</span>'
      : c.source === 'saved'
        ? '<span class="badge badge-cat badge-cat-saved">Saqlangan</span>'
        : c.source === 'series'
          ? '<span class="badge badge-cat badge-cat-series">Seriallar</span>'
          : '<span class="badge badge-cat badge-cat-both">Ikkalasi</span>';
    const editKey = c.id ? `data-cat-edit="${escapeHtml(c.id)}"` : `data-cat-attach="${escapeHtml(c.name)}"`;
    const editLabel = c.image ? 'Tahrirlash' : 'Rasm yuklash';
    const deleteBtn = c.id
      ? `<button class="btn btn-danger" data-cat-delete="${escapeHtml(c.id)}">O'chirish</button>`
      : '';
    return `
      <tr class="category-card-row">
        <td class="col-cat-img">${imageCell}</td>
        <td class="col-cat-info">
          <div class="cat-info-wrap">
            <div class="cat-title-line">
              <strong class="cat-name">${escapeHtml(c.name)}</strong>
              ${statusBadge}
            </div>
            ${c.id ? `<small class="cat-id-chip">ID: ${escapeHtml(c.id)}</small>` : ''}
          </div>
        </td>
        <td class="col-cat-id desktop-only"><code>${escapeHtml(c.id || '—')}</code></td>
        <td class="col-cat-actions">
          <div class="actions">
            <button class="btn btn-secondary" ${editKey}>${editLabel}</button>
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function saveCategory(payload, editId) {
  const method = editId ? 'PUT' : 'POST';
  const body = editId ? { ...payload, id: editId, action: 'update' } : payload;
  const res = await fetch('/api/categories', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  categoriesList = Array.isArray(json.categories) ? json.categories : [];
  renderCategoriesTable();
}

async function deleteCategory(id) {
  const res = await fetch('/api/categories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  categoriesList = Array.isArray(json.categories) ? json.categories : [];
  renderCategoriesTable();
}

document.getElementById('categoryImageFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  const hint = document.getElementById('categoryImageHint');
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    if (hint) { hint.textContent = 'Fayl 5MB dan katta.'; setTone(hint, 'error'); }
    e.target.value = '';
    return;
  }
  try {
    if (hint) { hint.textContent = 'Yuklanmoqda...'; setTone(hint, ''); }
    let dataUrl = await readFileAsDataUrl(file);
    dataUrl = await compressImageDataUrl(dataUrl);
    const url = await uploadCategoryImage(dataUrl, (document.getElementById('categoryName').value || 'category').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    categoryUploadedUrl = url;
    document.getElementById('categoryImageUrl').value = url;
    setCategoryPreview(url);
    if (hint) { hint.textContent = "Yuklandi ✅"; setTone(hint, 'ok'); }
  } catch (err) {
    if (hint) { hint.textContent = `Yuklash xatosi: ${err.message}`; setTone(hint, 'error'); }
  }
});

document.getElementById('categoryImageUrl')?.addEventListener('input', (e) => {
  setCategoryPreview(e.target.value.trim());
});

document.getElementById('categoryForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('categoryName').value.trim();
  const image = document.getElementById('categoryImageUrl').value.trim() || categoryUploadedUrl;
  const editId = document.getElementById('categoryEditId').value;
  if (!name) return;
  const btn = document.getElementById('categorySubmitBtn');
  const previousCategories = [...categoriesList];
  const optimistic = { id: editId || `pending-${Date.now()}`, name, image };
  if (editId) {
    const index = categoriesList.findIndex(c => c.id === editId);
    if (index >= 0) categoriesList[index] = { ...categoriesList[index], ...optimistic };
  } else categoriesList = [optimistic, ...categoriesList];
  renderCategoriesTable();
  setButtonBusy(btn, true, 'Saqlanmoqda');
  try {
    await saveCategory({ name, image }, editId);
    showNotification(editId ? 'Kategoriya yangilandi ✅' : "Kategoriya qo'shildi ✅");
    resetCategoryForm();
  } catch (err) {
    categoriesList = previousCategories;
    renderCategoriesTable();
    showNotification(`Xato: ${err.message}`, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
});

document.getElementById('categoryResetBtn')?.addEventListener('click', resetCategoryForm);
document.getElementById('categoriesReloadBtn')?.addEventListener('click', () => fetchCategories(true));

document.getElementById('categoriesTableBody')?.addEventListener('click', async (e) => {
  const attachBtn = e.target.closest('[data-cat-attach]');
  if (attachBtn) {
    const name = attachBtn.dataset.catAttach || '';
    document.getElementById('categoryEditId').value = '';
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryImageUrl').value = '';
    categoryUploadedUrl = '';
    setCategoryPreview('');
    const submit = document.getElementById('categorySubmitBtn');
    if (submit) submit.textContent = "+ Rasm bilan saqlash";
    document.getElementById('categoryImageFile')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const editBtn = e.target.closest('[data-cat-edit]');
  const delBtn = e.target.closest('[data-cat-delete]');
  if (editBtn) {
    const id = editBtn.dataset.catEdit;
    const cat = categoriesList.find((c) => c.id === id);
    if (!cat) return;
    document.getElementById('categoryEditId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryImageUrl').value = cat.image || '';
    categoryUploadedUrl = cat.image || '';
    setCategoryPreview(cat.image || '');
    const submit = document.getElementById('categorySubmitBtn');
    if (submit) submit.textContent = 'Saqlash';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (delBtn) {
    const id = delBtn.dataset.catDelete;
    const cat = categoriesList.find((c) => c.id === id);
    if (!confirm(`O'chirilsinmi: ${cat?.name || id}?`)) return;
    const previousCategories = [...categoriesList];
    categoriesList = categoriesList.filter(c => c.id !== id);
    renderCategoriesTable();
    try {
      await deleteCategory(id);
      showUndoNotification("Kategoriya o'chirildi.", async () => {
        if (!cat) return;
        const restore = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: cat.name, image: cat.image || '' }) });
        if (!restore.ok) throw new Error("Kategoriyani qaytarib bo'lmadi");
        const data = await restore.json(); categoriesList = Array.isArray(data.categories) ? data.categories : [...categoriesList, cat]; renderCategoriesTable(); showNotification('Kategoriya qaytarildi.');
      });
    } catch (err) {
      categoriesList = previousCategories;
      renderCategoriesTable();
      showNotification(`Xato: ${err.message}`, 'error');
    }
  }
});

window.fetchCategories = fetchCategories;

// ===== Reklama (modal mini-app oynasi) =====
let adUploadedUrl = '';
let adSettingsLoaded = false;
let lastSavedAdEnabled = false;
let lastSavedPreRollEnabled = false;

function setAdPreview(url) {
  const img = document.getElementById('adImagePreview');
  const area = document.getElementById('adUploadArea');
  if (!img || !area) return;
  if (url) {
    img.src = proxiedPoster(url);
    img.style.display = 'block';
    area.classList.add('has-preview');
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    area.classList.remove('has-preview');
  }
}

function setAdStatus(msg, kind) {
  const el = document.getElementById('adSaveStatus');
  if (!el) return;
  el.textContent = msg || '';
  setTone(el, kind);
}
function updateAdLivePreview() {
  const image = (document.getElementById('adImageUrl')?.value || adUploadedUrl || '').trim();
  const tg = (document.getElementById('adTelegramUrl')?.value || '').trim();
  const web = (document.getElementById('adWebsiteUrl')?.value || '').trim();
  const btn = (document.getElementById('adButtonText')?.value || 'Batafsil').trim() || 'Batafsil';
  const enabled = Boolean(document.getElementById('adEnabled')?.checked);
  const img = document.getElementById('adLivePreviewImage'); if (img) { img.src = image ? proxiedPoster(image) : ''; img.style.opacity = image ? '1' : '0'; }
  const button = document.getElementById('adLivePreviewButton'); if (button) button.textContent = btn;
  const status = document.getElementById('adCampaignStatus'); if (status) { status.textContent = enabled && image ? 'ON · faol' : 'OFF · yashirin'; status.className = enabled && image ? 'is-on' : 'is-off'; }
  const destination = document.getElementById('adCampaignDestination'); if (destination) destination.textContent = tg || web || 'Havola kiritilmagan';
}
function validateAdUrl(value, label) {
  if (!value) return true;
  try { const url = new URL(value); if (!['http:', 'https:', 'tg:'].includes(url.protocol)) throw new Error(); return true; } catch (_) { setAdStatus(`${label} URL noto‘g‘ri. To‘liq https:// havola kiriting.`, 'error'); return false; }
}

async function loadAdSettings() {
  if (adSettingsLoaded) return;
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const ad = json.ad || {};
    const enabledEl = document.getElementById('adEnabled');
    const urlEl = document.getElementById('adImageUrl');
    const tgEl = document.getElementById('adTelegramUrl');
    const webEl = document.getElementById('adWebsiteUrl');
    const btnEl = document.getElementById('adButtonText');
    if (enabledEl) enabledEl.checked = Boolean(ad.enabled);
    lastSavedAdEnabled = Boolean(ad.enabled);
    if (urlEl) urlEl.value = ad.imageUrl || '';
    // Backward-compat: eski `linkUrl` bo'lsa, uni mos maydonga joylashtir
    const legacyLink = ad.linkUrl || '';
    const isTgLink = (u) => /^(https?:\/\/(t|telegram)\.me\/|tg:\/\/)/i.test(String(u || ''));
    if (tgEl) tgEl.value = ad.telegramUrl || (isTgLink(legacyLink) ? legacyLink : '');
    if (webEl) webEl.value = ad.websiteUrl || (legacyLink && !isTgLink(legacyLink) ? legacyLink : '');
    if (btnEl) btnEl.value = ad.buttonText || '';
    adUploadedUrl = ad.imageUrl || '';
    setAdPreview(ad.imageUrl || '');
    updateAdLivePreview();
    adSettingsLoaded = true;
  } catch (err) {
    setAdStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

async function saveAdSettings(options = {}) {
  const enabledEl = document.getElementById('adEnabled');
  const enabled = enabledEl?.checked || false;
  const imageUrl = (document.getElementById('adImageUrl')?.value || adUploadedUrl || '').trim();
  const telegramUrl = (document.getElementById('adTelegramUrl')?.value || '').trim();
  const websiteUrl = (document.getElementById('adWebsiteUrl')?.value || '').trim();
  const buttonText = (document.getElementById('adButtonText')?.value || '').trim();

  if (enabled && !imageUrl) {
    if (options.revertOnFail && enabledEl) enabledEl.checked = lastSavedAdEnabled;
    setAdStatus("Mini app reklamani ON qilish uchun avval rasm yuklang yoki URL kiriting.", 'error');
    return false;
  }

  setAdStatus('Saqlanmoqda...');
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad: { enabled, imageUrl, telegramUrl, websiteUrl, buttonText } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

    // Server qaytargan normalize qilingan qiymatlarni qaytarib ko'rsatamiz —
    // shunda foydalanuvchi qaysi URL haqiqatan saqlanganini darhol ko'radi
    const savedAd = (json && json.ad) || {};
    const tgEl = document.getElementById('adTelegramUrl');
    const webEl = document.getElementById('adWebsiteUrl');
    if (tgEl) tgEl.value = savedAd.telegramUrl || '';
    if (webEl) webEl.value = savedAd.websiteUrl || '';
    lastSavedAdEnabled = Boolean(savedAd.enabled);
    if (enabledEl) enabledEl.checked = lastSavedAdEnabled;

    // Agar foydalanuvchi URL yozgan-u, server uni rad etgan bo'lsa — ogohlantiramiz
    if (telegramUrl && !savedAd.telegramUrl && !savedAd.websiteUrl) {
      setAdStatus("Telegram havola noto'g'ri — to'liq URL kiriting (masalan: https://t.me/kanal_nomi yoki @kanal_nomi).", 'error');
    } else if (websiteUrl && !savedAd.websiteUrl && !savedAd.telegramUrl) {
      setAdStatus("Website havola noto'g'ri — to'liq URL kiriting (masalan: https://example.com).", 'error');
    } else {
      setAdStatus(lastSavedAdEnabled ? "Saqlandi. Mini app reklama ON - mini appda ko'rinadi." : "Saqlandi. Mini app reklama OFF - mini appda ko'rinmaydi.", 'ok');
    }
    return true;
  } catch (err) {
    if (options.revertOnFail && enabledEl) enabledEl.checked = lastSavedAdEnabled;
    setAdStatus(`Xato: ${err.message}`, 'error');
    return false;
  }
}

document.getElementById('adImageFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  setAdStatus('Rasm yuklanmoqda...');
  try {
    const raw = await readFileAsDataUrl(file);
    const dataUrl = await compressImageDataUrl(raw, 1080, 1920, 0.85);
    const url = await uploadCategoryImage(dataUrl, 'ad-' + Date.now().toString(36));
    adUploadedUrl = url;
    document.getElementById('adImageUrl').value = url;
    setAdPreview(url);
    setAdStatus('Rasm yuklandi. Saqlashni unutmang.', 'ok');
  } catch (err) {
    setAdStatus(`Yuklashda xato: ${err.message}`, 'error');
  } finally {
    e.target.value = '';
  }
});

document.getElementById('adImageUrl')?.addEventListener('input', (e) => {
  setAdPreview(e.target.value.trim());
});

document.getElementById('adSaveBtn')?.addEventListener('click', saveAdSettings);
document.getElementById('adEnabled')?.addEventListener('change', () => {
  updateAdLivePreview();
  saveAdSettings({ revertOnFail: true });
});
['adImageUrl','adTelegramUrl','adWebsiteUrl','adButtonText'].forEach(id => document.getElementById(id)?.addEventListener('input', updateAdLivePreview));
['adTelegramUrl','adWebsiteUrl'].forEach(id => document.getElementById(id)?.addEventListener('blur', e => validateAdUrl(e.target.value.trim(), id === 'adTelegramUrl' ? 'Telegram' : 'Website')));
document.getElementById('adUploadArea')?.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('is-dragover'); });
document.getElementById('adUploadArea')?.addEventListener('dragleave', e => { e.preventDefault(); e.currentTarget.classList.remove('is-dragover'); });
document.getElementById('adUploadArea')?.addEventListener('drop', e => { e.preventDefault(); e.currentTarget.classList.remove('is-dragover'); const file = e.dataTransfer.files?.[0]; const input = document.getElementById('adImageFile'); if (file && input) { const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); } });
document.getElementById('adClearBtn')?.addEventListener('click', () => {
  if (!confirm('Reklama maydonlari tozalansinmi?')) return;
  const enabledEl = document.getElementById('adEnabled');
  if (enabledEl) enabledEl.checked = false;
  document.getElementById('adImageUrl').value = '';
  const tgEl = document.getElementById('adTelegramUrl'); if (tgEl) tgEl.value = '';
  const webEl = document.getElementById('adWebsiteUrl'); if (webEl) webEl.value = '';
  document.getElementById('adButtonText').value = '';
  adUploadedUrl = '';
  setAdPreview('');
  setAdStatus('');
  updateAdLivePreview();
});

// ===== Yuruvchi matn (Marquee Ticker) sozlamalari =====
const TICKER_FONT_GROUPS = [
  {
    category: "Sans-Serif (Zamonaviy & Aniq)",
    fonts: [
      "Montserrat", "Roboto", "Open Sans", "Lato", "Poppins", "Inter", "Oswald",
      "Raleway", "Nunito", "Rubik", "Work Sans", "DM Sans", "Quicksand", "Manrope",
      "Plus Jakarta Sans", "Outfit", "Space Grotesk", "Cabin", "Ubuntu", "Kanit",
      "Barlow", "Heebo", "Fira Sans", "Mukta", "PT Sans", "Overpass", "Urbanist",
      "Syne", "Jost", "Sora", "Lexend", "Karla", "Exo 2", "Titillium Web", "Maven Pro"
    ]
  },
  {
    category: "Display & Bold (E'lon & Sarlavhalar)",
    fonts: [
      "Bebas Neue", "Anton", "Righteous", "Permanent Marker", "Russo One", "Bangers",
      "Bungee", "Audiowide", "Orbitron", "Faster One", "Black Han Sans", "Alfa Slab One",
      "Abril Fatface", "Concert One", "Monoton", "Press Start 2P", "Silkscreen",
      "Rubik Glitch", "Creepster", "Shrikhand", "Fredoka", "Comfortaa", "Carter One",
      "Passion One", "Changa One", "Fugaz One", "Ultra", "Titan One", "Archivo Black", "Racing Sans One"
    ]
  },
  {
    category: "Serif (Klassik & Elegant)",
    fonts: [
      "Playfair Display", "Merriweather", "Lora", "PT Serif", "Cinzel",
      "Cormorant Garamond", "Bodoni Moda", "EB Garamond", "Libre Baskerville", "Spectral",
      "Bitter", "Prata", "DM Serif Display", "Frank Ruhl Libre", "Cardo", "Rozha One",
      "Castoro", "Vollkorn", "Cinzel Decorative", "Domine", "Alice", "Yeseva One",
      "Marcellus", "Arvo", "Faustina"
    ]
  },
  {
    category: "Script & Qo'lyozma (Chiroyli)",
    fonts: [
      "Dancing Script", "Pacifico", "Caveat", "Great Vibes", "Satisfy", "Sacramento",
      "Shadows Into Light", "Lobster", "Lobster Two", "Kaushan Script", "Yellowtail",
      "Courgette", "Parisienne", "Bad Script", "Marck Script", "Tangerine", "Cookie",
      "Alex Brush", "Allura", "Reenie Beanie"
    ]
  },
  {
    category: "Monospace & Retro (Kod & Texnik)",
    fonts: [
      "Space Mono", "Fira Code", "JetBrains Mono", "Roboto Mono", "Source Code Pro",
      "VT323", "Share Tech Mono", "Inconsolata", "Major Mono Display", "Ubuntu Mono"
    ]
  }
];

let tickerFontsPopulated = false;
const loadedGoogleFontsInAdmin = new Set();

function ensureGoogleFontInAdmin(fontName) {
  if (!fontName) return;
  const clean = String(fontName).trim();
  if (!clean || loadedGoogleFontsInAdmin.has(clean)) return;
  loadedGoogleFontsInAdmin.add(clean);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(clean).replace(/%20/g, "+")}:wght@400;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

function populateTickerFonts(selectedFont = "Montserrat") {
  const select = document.getElementById("tickerFontFamily");
  if (!select) return;
  if (!tickerFontsPopulated) {
    select.innerHTML = "";
    let totalCount = 0;
    TICKER_FONT_GROUPS.forEach(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.category;
      group.fonts.forEach(font => {
        totalCount++;
        const opt = document.createElement("option");
        opt.value = font;
        opt.textContent = font;
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });
    const countBadge = document.getElementById("tickerFontCountBadge");
    if (countBadge) countBadge.textContent = `${totalCount}+ shrift`;
    tickerFontsPopulated = true;
  }
  if (selectedFont) {
    select.value = selectedFont;
  }
}

let tickerSettingsLoaded = false;
let lastSavedTickerEnabled = false;

function setTickerStatus(msg, kind = 'info') {
  const el = document.getElementById('tickerSaveStatus');
  if (!el) return;
  el.textContent = msg;
  setTone(el, kind);
}

function updateTickerLivePreview() {
  const enabledEl = document.getElementById('tickerEnabled');
  const enabled = Boolean(enabledEl?.checked);
  const textRaw = document.getElementById('tickerText')?.value || '';
  const text = textRaw.trim() || "🚀 Premyeralar faqat NTV da tomosha qiling!";
  const linkUrl = (document.getElementById('tickerLinkUrl')?.value || '').trim();
  const bgColor = (document.getElementById('tickerBgColor')?.value || 'linear-gradient(135deg, #e50914, #990000)').trim();
  const textColor = (document.getElementById('tickerTextColor')?.value || '#ffffff').trim();
  const fontFamily = (document.getElementById('tickerFontFamily')?.value || 'Montserrat').trim();
  const fontSize = parseInt(document.getElementById('tickerFontSize')?.value || '14', 10) || 14;
  const fontWeight = (document.getElementById('tickerFontWeight')?.value || '600').trim();
  const speed = parseInt(document.getElementById('tickerSpeed')?.value || '20', 10) || 20;

  ensureGoogleFontInAdmin(fontFamily);

  const card = document.getElementById('tickerLivePreviewCard');
  if (card) {
    card.style.background = bgColor;
    card.style.color = textColor;
    card.style.opacity = enabled ? '1' : '0.4';
  }

  const track = document.getElementById('tickerLivePreviewTrack');
  if (track) {
    track.style.fontFamily = `"${fontFamily}", sans-serif`;
    track.style.fontSize = `${fontSize}px`;
    track.style.fontWeight = fontWeight;
    track.style.animationDuration = `${speed}s`;
  }

  const t1 = document.getElementById('tickerLivePreviewText1');
  const t2 = document.getElementById('tickerLivePreviewText2');
  if (t1) t1.textContent = text;
  if (t2) t2.textContent = text;

  const statusLabel = document.getElementById('tickerStatusLabel');
  if (statusLabel) {
    statusLabel.textContent = enabled ? 'ON · faol' : "OFF · o'chirilgan";
    setTone(statusLabel, enabled ? 'ok' : 'error');
  }

  const fontLabel = document.getElementById('tickerFontLabel');
  if (fontLabel) {
    fontLabel.textContent = fontFamily;
    fontLabel.style.fontFamily = `"${fontFamily}", sans-serif`;
  }

  const linkLabel = document.getElementById('tickerLinkLabel');
  if (linkLabel) {
    if (linkUrl) {
      linkLabel.innerHTML = `<a href="${escapeHtml(linkUrl)}" target="_blank" rel="noopener">${escapeHtml(linkUrl)}</a> (faol)`;
    } else {
      linkLabel.textContent = "Mavjud emas (bosganda havola ochilmaydi)";
    }
  }

  const fontHint = document.getElementById('tickerFontPreviewHint');
  if (fontHint) {
    fontHint.textContent = 'Tanlangan shrift: ';
    const strong = document.createElement('strong');
    strong.textContent = fontFamily;
    strong.style.fontFamily = `"${fontFamily}", sans-serif`;
    fontHint.appendChild(strong);
  }
}

function setTickerBgMode(mode) {
  const solidTab = document.getElementById('tickerBgTabSolid');
  const gradTab = document.getElementById('tickerBgTabGradient');
  const solidPanel = document.getElementById('tickerBgSolidPanel');
  const gradPanel = document.getElementById('tickerBgGradientPanel');

  if (mode === 'solid') {
    solidTab?.classList.add('is-active');
    gradTab?.classList.remove('is-active');
    if (solidPanel) solidPanel.style.display = 'block';
    if (gradPanel) gradPanel.style.display = 'none';
  } else {
    gradTab?.classList.add('is-active');
    solidTab?.classList.remove('is-active');
    if (gradPanel) gradPanel.style.display = 'block';
    if (solidPanel) solidPanel.style.display = 'none';
  }
}

async function loadTickerSettings(force = false) {
  if (tickerSettingsLoaded && !force) return;
  populateTickerFonts();
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const ticker = json.ticker || {};

    const enabledEl = document.getElementById('tickerEnabled');
    if (enabledEl) enabledEl.checked = Boolean(ticker.enabled);
    lastSavedTickerEnabled = Boolean(ticker.enabled);

    const textEl = document.getElementById('tickerText');
    if (textEl && ticker.text !== undefined && ticker.text !== '') {
      textEl.value = ticker.text;
    } else if (textEl && !textEl.value.trim()) {
      textEl.value = "🚀 Premyeralar faqat NTV da tomosha qiling!";
    }

    const linkEl = document.getElementById('tickerLinkUrl');
    if (linkEl && ticker.linkUrl !== undefined) linkEl.value = ticker.linkUrl || '';

    const bgEl = document.getElementById('tickerBgColor');
    if (bgEl && ticker.bgColor) bgEl.value = ticker.bgColor;

    const bgPicker = document.getElementById('tickerBgColorPicker');
    const hexDisplay = document.getElementById('tickerSolidHexDisplay');
    const isSolid = (ticker.bgColor || '').trim().startsWith('#');
    if (bgPicker && isSolid) {
      bgPicker.value = ticker.bgColor.trim();
    }
    if (hexDisplay && isSolid) {
      hexDisplay.textContent = ticker.bgColor.trim();
    }
    setTickerBgMode(isSolid ? 'solid' : 'gradient');

    const textColEl = document.getElementById('tickerTextColor');
    if (textColEl && ticker.textColor) textColEl.value = ticker.textColor;

    const textPicker = document.getElementById('tickerTextColorPicker');
    if (textPicker && (ticker.textColor || '').startsWith('#')) {
      textPicker.value = ticker.textColor;
    }

    const fontEl = document.getElementById('tickerFontFamily');
    if (fontEl && ticker.fontFamily) {
      populateTickerFonts(ticker.fontFamily);
      fontEl.value = ticker.fontFamily;
    }

    const sizeEl = document.getElementById('tickerFontSize');
    if (sizeEl && ticker.fontSize) sizeEl.value = String(ticker.fontSize);

    const weightEl = document.getElementById('tickerFontWeight');
    if (weightEl && ticker.fontWeight) weightEl.value = String(ticker.fontWeight);

    const speedEl = document.getElementById('tickerSpeed');
    if (speedEl && ticker.speed) speedEl.value = String(ticker.speed);

    tickerSettingsLoaded = true;
    updateTickerLivePreview();
  } catch (err) {
    setTickerStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

async function saveTickerSettings(options = {}) {
  const enabledEl = document.getElementById('tickerEnabled');
  const enabled = Boolean(enabledEl?.checked);
  let text = (document.getElementById('tickerText')?.value || '').trim();
  if (enabled && !text) {
    text = "🚀 Premyeralar faqat NTV da tomosha qiling!";
    const textEl = document.getElementById('tickerText');
    if (textEl) textEl.value = text;
  }
  const linkUrl = (document.getElementById('tickerLinkUrl')?.value || '').trim();
  const bgColor = (document.getElementById('tickerBgColor')?.value || 'linear-gradient(135deg, #e50914, #990000)').trim();
  const textColor = (document.getElementById('tickerTextColor')?.value || '#ffffff').trim();
  const fontFamily = (document.getElementById('tickerFontFamily')?.value || 'Montserrat').trim();
  const fontSize = parseInt(document.getElementById('tickerFontSize')?.value || '14', 10) || 14;
  const fontWeight = (document.getElementById('tickerFontWeight')?.value || '600').trim();
  const speed = parseInt(document.getElementById('tickerSpeed')?.value || '20', 10) || 20;

  setTickerStatus('Saqlanmoqda...');
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: {
          enabled,
          text,
          linkUrl,
          bgColor,
          textColor,
          fontFamily,
          fontSize,
          fontWeight,
          speed,
        }
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const savedTicker = json.ticker || {};
    lastSavedTickerEnabled = Boolean(savedTicker.enabled);
    if (enabledEl) enabledEl.checked = lastSavedTickerEnabled;
    const linkEl = document.getElementById('tickerLinkUrl');
    if (linkEl && savedTicker.linkUrl) linkEl.value = savedTicker.linkUrl;
    setTickerStatus(lastSavedTickerEnabled ? "Saqlandi. Yuruvchi matn ON — mini appda ko'rinadi." : "Saqlandi. Yuruvchi matn OFF — mini appda ko'rinmaydi.", 'ok');
    updateTickerLivePreview();
    return true;
  } catch (err) {
    if (options.revertOnFail && enabledEl) enabledEl.checked = lastSavedTickerEnabled;
    setTickerStatus(`Xato: ${err.message}`, 'error');
    return false;
  }
}

function testOpenTickerLink() {
  const raw = (document.getElementById('tickerLinkUrl')?.value || '').trim();
  if (!raw) {
    alert("Havola kiritilmagan. Avval 'Havola' maydoniga havola kiriting (masalan: https://t.me/kanal_nomi yoki @kanal_nomi).");
    return;
  }
  let target = raw;
  if (/^@[a-z0-9_]{3,}$/i.test(target)) {
    target = `https://t.me/${target.slice(1)}`;
  } else if (!/^[a-z][a-z0-9+.\-]*:\/\//i.test(target)) {
    target = `https://${target}`;
  }
  window.open(target, '_blank', 'noopener,noreferrer');
}

// Ticker event listeners
document.getElementById('tickerSaveBtn')?.addEventListener('click', () => saveTickerSettings());
document.getElementById('tickerTestLinkBtn')?.addEventListener('click', testOpenTickerLink);
document.getElementById('tickerLivePreviewCard')?.addEventListener('click', testOpenTickerLink);
document.getElementById('tickerEnabled')?.addEventListener('change', () => {
  updateTickerLivePreview();
  saveTickerSettings({ revertOnFail: true });
});

['tickerText', 'tickerLinkUrl', 'tickerBgColor', 'tickerTextColor', 'tickerFontSize', 'tickerFontWeight', 'tickerSpeed'].forEach(id => {
  document.getElementById(id)?.addEventListener('input', updateTickerLivePreview);
  document.getElementById(id)?.addEventListener('change', updateTickerLivePreview);
});

document.getElementById('tickerFontFamily')?.addEventListener('change', () => {
  const font = document.getElementById('tickerFontFamily')?.value;
  ensureGoogleFontInAdmin(font);
  updateTickerLivePreview();
});

(() => {
  const bgPicker = document.getElementById('tickerBgColorPicker');
  const bgInput = document.getElementById('tickerBgColor');
  const hexDisplay = document.getElementById('tickerSolidHexDisplay');

  document.getElementById('tickerBgTabSolid')?.addEventListener('click', () => {
    setTickerBgMode('solid');
    if (bgInput && !bgInput.value.trim().startsWith('#')) {
      const solidVal = bgPicker?.value || '#2563eb';
      bgInput.value = solidVal;
      if (hexDisplay) hexDisplay.textContent = solidVal;
      updateTickerLivePreview();
    }
  });

  document.getElementById('tickerBgTabGradient')?.addEventListener('click', () => {
    setTickerBgMode('gradient');
    if (bgInput && bgInput.value.trim().startsWith('#')) {
      bgInput.value = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
      updateTickerLivePreview();
    }
  });

  if (bgPicker && bgInput) {
    bgPicker.addEventListener('input', (e) => {
      bgInput.value = e.target.value;
      if (hexDisplay) hexDisplay.textContent = e.target.value;
      setTickerBgMode('solid');
      updateTickerLivePreview();
    });
    bgInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(val)) {
        bgPicker.value = val;
        if (hexDisplay) hexDisplay.textContent = val;
        setTickerBgMode('solid');
      } else if (val.includes('gradient')) {
        setTickerBgMode('gradient');
      }
    });
  }

  const textPicker = document.getElementById('tickerTextColorPicker');
  const textInput = document.getElementById('tickerTextColor');
  if (textPicker && textInput) {
    textPicker.addEventListener('input', (e) => {
      textInput.value = e.target.value;
      updateTickerLivePreview();
    });
    textInput.addEventListener('input', (e) => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value.trim())) {
        textPicker.value = e.target.value.trim();
      }
    });
  }

  document.querySelectorAll('.ticker-color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const bg = btn.dataset.bg;
      if (bg && bgInput) {
        bgInput.value = bg;
        if (bg.startsWith('#')) {
          if (bgPicker) bgPicker.value = bg;
          if (hexDisplay) hexDisplay.textContent = bg;
          setTickerBgMode('solid');
        } else {
          setTickerBgMode('gradient');
        }
        updateTickerLivePreview();
      }
    });
  });

  document.querySelectorAll('.ticker-text-color-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      if (color && textInput) {
        textInput.value = color;
        if (color.startsWith('#') && textPicker) textPicker.value = color;
        updateTickerLivePreview();
      }
    });
  });

  document.getElementById('tickerResetBtn')?.addEventListener('click', () => {
    if (!confirm("Barcha sozlamalar standart (default) holatiga qaytarilsinmi?")) return;
    const textEl = document.getElementById('tickerText'); if (textEl) textEl.value = "🚀 Premyeralar faqat NTV da tomosha qiling!";
    const linkEl = document.getElementById('tickerLinkUrl'); if (linkEl) linkEl.value = "";
    if (bgInput) bgInput.value = "linear-gradient(135deg, #e50914, #990000)";
    if (bgPicker) bgPicker.value = "#e50914";
    if (hexDisplay) hexDisplay.textContent = "#e50914";
    setTickerBgMode('gradient');
    if (textInput) textInput.value = "#ffffff";
    if (textPicker) textPicker.value = "#ffffff";
    const fontEl = document.getElementById('tickerFontFamily'); if (fontEl) fontEl.value = "Montserrat";
    const sizeEl = document.getElementById('tickerFontSize'); if (sizeEl) sizeEl.value = "14";
    const weightEl = document.getElementById('tickerFontWeight'); if (weightEl) weightEl.value = "600";
    const speedEl = document.getElementById('tickerSpeed'); if (speedEl) speedEl.value = "20";
    updateTickerLivePreview();
    setTickerStatus("Standart sozlamalar tiklandi. Saqlash uchun 'Saqlash' tugmasini bosing.", 'ok');
  });

  populateTickerFonts();
  updateTickerLivePreview();
})();

// ===== Pre-roll video reklama (kino oldidan) =====
function setPreRollStatus(msg, kind) {
  const el = document.getElementById('preRollAdSaveStatus');
  if (!el) return;
  el.textContent = msg || '';
  setTone(el, kind);
}

let preRollAdVideos = [];
let preRollAdSelectedId = '';

function buildPreRollPlayUrl(driveId) {
  if (!driveId) return '';
  return `/api/drive-stream/${encodeURIComponent(driveId)}`;
}

function setPreRollListStatus(msg, kind) {
  const el = document.getElementById('preRollAdListStatus');
  if (!el) return;
  el.textContent = msg || '';
  setTone(el, kind);
}

function setPreRollVideoPreview(url) {
  const wrap = document.getElementById('preRollAdVideoPreviewWrap');
  const video = document.getElementById('preRollAdVideoPreview');
  if (!wrap || !video) return;
  if (url) {
    video.src = url;
    wrap.style.display = 'block';
  } else {
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
    wrap.style.display = 'none';
  }
}

function selectPreRollDriveVideo(driveId, options = {}) {
  const autoEnable = options.autoEnable !== false;
  preRollAdSelectedId = String(driveId || '');
  const hiddenId = document.getElementById('preRollAdVideoDriveId');
  const hiddenUrl = document.getElementById('preRollAdVideoUrl');
  if (hiddenId) hiddenId.value = preRollAdSelectedId;
  if (hiddenUrl) hiddenUrl.value = preRollAdSelectedId ? buildPreRollPlayUrl(preRollAdSelectedId) : '';
  // Visual selection
  document.querySelectorAll('.preroll-video-item').forEach((el) => {
    el.classList.toggle('is-selected', el.dataset.id === preRollAdSelectedId);
    const radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = el.dataset.id === preRollAdSelectedId;
  });
  setPreRollVideoPreview(preRollAdSelectedId ? buildPreRollPlayUrl(preRollAdSelectedId) : '');
  // Video tanlandi — avtomatik "yoqish" chekboksini ham yoqamiz
  const enabledEl = document.getElementById('preRollAdEnabled');
  if (enabledEl && preRollAdSelectedId && autoEnable) enabledEl.checked = true;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(2)} MB`;
}

function formatDurationMs(ms) {
  const sec = Math.round(Number(ms) / 1000) || 0;
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function renderPreRollVideoList() {
  const container = document.getElementById('preRollAdVideoList');
  if (!container) return;
  if (!preRollAdVideos.length) {
    container.innerHTML = `<div class="placeholder-text">Drive'da "reklama" papkasi yoki video topilmadi. Drive katalog ildizida <strong>"reklama"</strong> nomli papka oching va u yerga mp4 yuklang, keyin "Yangilash"ni bosing.</div>`;
    return;
  }
  container.innerHTML = preRollAdVideos.map((v) => {
    const dur = formatDurationMs(v.durationMs);
    const size = formatBytes(v.size);
    return `
      <label class="preroll-video-item" data-id="${v.id}">
        <input type="radio" name="preRollAdVideoRadio" value="${v.id}">
        <div class="list-row__info">
          <div class="list-row__title">${escapeHtml(v.name)}</div>
          <div class="list-row__meta">
            ${dur ? `${dur} · ` : ''}${size}${v.modifiedTime ? ` · ${new Date(v.modifiedTime).toLocaleDateString()}` : ''}
          </div>
        </div>
      </label>
    `;
  }).join('');
  // Wire clicks
  container.querySelectorAll('.preroll-video-item').forEach((el) => {
    el.addEventListener('click', () => selectPreRollDriveVideo(el.dataset.id));
  });
  // Re-apply selection
  if (preRollAdSelectedId) selectPreRollDriveVideo(preRollAdSelectedId, { autoEnable: false });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

async function loadPreRollDriveVideos() {
  setPreRollListStatus('Drive yuklanmoqda...');
  try {
    const res = await fetch('/api/settings?action=ad-videos', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    preRollAdVideos = Array.isArray(json.videos) ? json.videos : [];
    renderPreRollVideoList();
    setPreRollListStatus(`${preRollAdVideos.length} ta video topildi.`, 'ok');
  } catch (err) {
    setPreRollListStatus(`Xato: ${err.message}`, 'error');
  }
}

async function loadPreRollSettings() {
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const pr = json.preRollAd || {};
    const enabledEl = document.getElementById('preRollAdEnabled');
    const videoEl = document.getElementById('preRollAdVideoUrl');
    const linkEl = document.getElementById('preRollAdLinkUrl');
    const skipEl = document.getElementById('preRollAdSkipAfter');
    if (enabledEl) enabledEl.checked = Boolean(pr.enabled);
    lastSavedPreRollEnabled = Boolean(pr.enabled);
    if (videoEl) videoEl.value = pr.videoUrl || '';
    if (linkEl) linkEl.value = pr.linkUrl || '';
    if (skipEl) skipEl.value = Number.isFinite(Number(pr.skipAfter)) ? Number(pr.skipAfter) : 5;
    // Saqlangan Drive ID ni belgilash (agar bor bo'lsa) — list keyin yuklanganda highlight bo'ladi
    preRollAdSelectedId = String(pr.videoDriveId || '');
    const hiddenId = document.getElementById('preRollAdVideoDriveId');
    if (hiddenId) hiddenId.value = preRollAdSelectedId;
    if (preRollAdSelectedId) {
      setPreRollVideoPreview(buildPreRollPlayUrl(preRollAdSelectedId));
    } else {
      setPreRollVideoPreview(pr.videoUrl || '');
    }
  } catch (err) {
    setPreRollStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

async function savePreRollSettings(options = {}) {
  const videoDriveId = (document.getElementById('preRollAdVideoDriveId')?.value || preRollAdSelectedId || '').trim();
  const linkUrl = (document.getElementById('preRollAdLinkUrl')?.value || '').trim();
  const skipAfter = Math.max(0, Math.min(60, parseInt(document.getElementById('preRollAdSkipAfter')?.value || '5', 10) || 0));
  const enabledEl = document.getElementById('preRollAdEnabled');
  const enabled = Boolean(enabledEl?.checked);

  if (enabled && !videoDriveId) {
    if (options.revertOnFail && enabledEl) enabledEl.checked = lastSavedPreRollEnabled;
    setPreRollStatus("Pre-roll reklamani ON qilish uchun avval Drive'dan video tanlang.", 'error');
    return false;
  }

  setPreRollStatus('Saqlanmoqda...');
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preRollAd: { enabled, videoDriveId, videoUrl: '', linkUrl, skipAfter } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const savedPreRoll = (json && json.preRollAd) || {};
    lastSavedPreRollEnabled = Boolean(savedPreRoll.enabled);
    if (enabledEl) enabledEl.checked = lastSavedPreRollEnabled;
    if (lastSavedPreRollEnabled) {
      setPreRollStatus("Saqlandi. Pre-roll reklama ON - mini app'da kinoga play bosilsa chiqadi.", 'ok');
    } else {
      setPreRollStatus("Saqlandi. Pre-roll reklama OFF - mini appda ko'rinmaydi.", 'ok');
    }
    return true;
  } catch (err) {
    if (options.revertOnFail && enabledEl) enabledEl.checked = lastSavedPreRollEnabled;
    setPreRollStatus(`Xato: ${err.message}`, 'error');
    return false;
  }
}

document.getElementById('preRollAdSaveBtn')?.addEventListener('click', savePreRollSettings);
document.getElementById('preRollAdEnabled')?.addEventListener('change', () => {
  savePreRollSettings({ revertOnFail: true });
});
document.getElementById('preRollAdClearBtn')?.addEventListener('click', () => {
  if (!confirm('Pre-roll reklama tanlovi tozalansinmi?')) return;
  const enabledEl = document.getElementById('preRollAdEnabled');
  if (enabledEl) enabledEl.checked = false;
  selectPreRollDriveVideo('', { autoEnable: false });
  const l = document.getElementById('preRollAdLinkUrl'); if (l) l.value = '';
  const s = document.getElementById('preRollAdSkipAfter'); if (s) s.value = '5';
  setPreRollStatus('');
});

document.getElementById('preRollAdReloadBtn')?.addEventListener('click', () => loadPreRollDriveVideos());

// ============ POTKASTLAR ============
let podcastChannels = [];
let podcastNewLang = 'uz';
const POD_LANG_LABEL = { uz: "🇺🇿 O'zbekcha", ru: '🇷🇺 Ruscha', en: '🇬🇧 Inglizcha' };

function formatCount(n) {
  const x = Number(n || 0);
  if (x >= 1_000_000) return (x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (x >= 1_000) return (x / 1_000).toFixed(x >= 10_000 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(x);
}

async function fetchPodcasts(force = false) {
  const grid = document.getElementById('podcastsListGrid');
  const summary = document.getElementById('podcastsStorageSummary');
  const cached = readAdminCache('podcasts');
  const applyPodcasts = (data) => {
    podcastChannels = Array.isArray(data?.channels) ? data.channels : (Array.isArray(data) ? data : []);
    renderPodcasts();
    if (summary) summary.textContent = `${podcastChannels.length} ta kanal qo'shilgan.`;
  };
  if (cached?.data && !force) {
    applyPodcasts(cached.data);
    if (cached.fresh) return podcastChannels;
  }
  if (grid && (force || !cached?.data)) grid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Kanallar yuklanmoqda...</p></div>';
  try {
    const r = await fetch(`${API_URL}/podcasts`, { headers: cachedRequestHeaders(cached, force) });
    if (r.status === 304 && cached?.data) {
      writeAdminCache('podcasts', cached.data, cached.etag);
      return podcastChannels;
    }
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yuklab bo\'lmadi.');
    writeAdminCache('podcasts', data, r.headers.get('ETag') || '');
    applyPodcasts(data);
    return podcastChannels;
  } catch (err) {
    if (cached?.data) return podcastChannels;
    console.error('podcasts fetch:', err);
    if (grid) grid.innerHTML = `<div class="empty-state error-state"><h3>Kanallarni yuklab bo'lmadi</h3><p>${escapeHtml(err.message)}</p></div>`;
    if (summary) summary.textContent = 'Xatolik: ' + err.message;
  }
}

function renderPodcasts() {
  const grid = document.getElementById('podcastsListGrid');
  if (!grid) return;
  if (!podcastChannels.length) {
    grid.innerHTML = '<div class="empty-state"><p>Hali kanal qo\'shilmagan.</p></div>';
    return;
  }
  grid.innerHTML = podcastChannels.map((c) => {
    const s = c.snapshot || {};
    const bannerStyle = s.banner ? ` style="background-image:url('${escapeHtml(s.banner)}')"` : '';
    return `
      <div class="podcast-admin-card">
        <div class="podcast-admin-card__banner"${bannerStyle}></div>
        <div class="podcast-admin-card__head">
          <img class="avatar" src="${escapeHtml(s.avatar || '')}" alt="">
          <div class="entity-card__info">
            <div class="entity-card__title">${escapeHtml(s.title || c.channelId)}</div>
            <div class="entity-card__meta">${escapeHtml(s.handle || '')}</div>
          </div>
        </div>
        <div class="podcast-admin-card__body">
          <div class="entity-card__meta">${formatCount(s.subscriberCount)} obunachi · ${formatCount(s.videoCount)} video</div>
          <div>
            <p class="field-sublabel">Kategoriya (til)</p>
            <div class="pod-lang-row">
              ${['uz','ru','en'].map((l) => `<button type="button" class="pod-lang-mini${(c.lang || '') === l ? ' is-active' : ''}" data-pod-set-lang="${escapeHtml(c.channelId)}|${l}">${POD_LANG_LABEL[l]}</button>`).join('')}
            </div>
          </div>
          <label class="check">
            <input type="checkbox" ${c.featured ? 'checked' : ''} data-pod-featured="${escapeHtml(c.channelId)}">
            <span>Header sectionda ko'rsatish</span>
          </label>
          <div class="entity-card__actions">
            <a class="btn btn-secondary btn-sm" href="https://www.youtube.com/channel/${escapeHtml(c.channelId)}" target="_blank" rel="noopener">YouTube</a>
            <button class="btn btn-secondary btn-sm" data-pod-refresh="${escapeHtml(c.channelId)}" title="Yangilash">${ADMIN_ICONS.refresh}</button>
            <button class="btn btn-danger-soft btn-sm" data-pod-delete="${escapeHtml(c.channelId)}|${escapeHtml(s.title || c.channelId)}">O'chirish</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function addPodcastChannel(input) {
  const btn = document.getElementById('podcastSubmitBtn');
  const hint = document.getElementById('podcastInputHint');
  setButtonBusy(btn, true, "Qo'shilmoqda");
  if (hint) { hint.textContent = 'YouTube\'dan ma\'lumot olinmoqda...'; setTone(hint, ''); }
  try {
    const r = await fetch(`${API_URL}/podcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', input, lang: podcastNewLang }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Qo\'shib bo\'lmadi.');
    podcastChannels = Array.isArray(data.channels) ? data.channels : podcastChannels;
    renderPodcasts();
    document.getElementById('podcastInput').value = '';
    if (hint) { hint.textContent = `Qo'shildi: ${data.channel?.snapshot?.title || ''}`; setTone(hint, 'ok'); }
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; setTone(hint, 'error'); }
  } finally {
    setButtonBusy(btn, false);
  }
}

async function deletePodcastChannel(channelId, title) {
  if (!confirm(`O'chirilsinmi: ${title}?`)) return;
  const removed = podcastChannels.find(c => c.channelId === channelId);
  const previousChannels = [...podcastChannels];
  podcastChannels = podcastChannels.filter(c => c.channelId !== channelId);
  renderPodcasts();
  try {
    const r = await fetch(`${API_URL}/podcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', channelId }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'O\'chirib bo\'lmadi.');
    podcastChannels = Array.isArray(data.channels) ? data.channels : podcastChannels.filter((c) => c.channelId !== channelId);
    renderPodcasts();
    showUndoNotification("Podcast kanali o'chirildi.", async () => {
      if (!removed) return;
      const restore = await fetch(`${API_URL}/podcasts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'add', input: removed.channelId, lang: removed.lang || 'uz' }) });
      if (!restore.ok) throw new Error("Podcast kanalini qaytarib bo'lmadi");
      const restored = await restore.json(); podcastChannels = Array.isArray(restored.channels) ? restored.channels : [...podcastChannels, removed]; renderPodcasts();
    });
  } catch (err) {
    podcastChannels = previousChannels;
    renderPodcasts();
    showNotification('Xato: ' + err.message, 'error');
  }
}

async function refreshPodcastChannel(channelId) {
  try {
    const r = await fetch(`${API_URL}/podcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', channelId }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yangilab bo\'lmadi.');
    const idx = podcastChannels.findIndex((c) => c.channelId === channelId);
    if (idx >= 0 && data.channel) podcastChannels[idx] = data.channel;
    renderPodcasts();
  } catch (err) {
    showNotification('Xato: ' + err.message, 'error');
  }
}

async function togglePodcastFeatured(channelId, featured) {
  try {
    const r = await fetch(`${API_URL}/podcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', channelId, featured }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yangilab bo\'lmadi.');
    const idx = podcastChannels.findIndex((c) => c.channelId === channelId);
    if (idx >= 0 && data.channel) podcastChannels[idx] = data.channel;
    showNotification(featured ? 'Header sectionda ko\'rsatiladi ✅' : 'Header sectiondan olib tashlandi');
  } catch (err) {
    showNotification('Xato: ' + err.message, 'error');
    renderPodcasts();
  }
}

document.getElementById('podcastForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('podcastInput')?.value.trim();
  if (input) addPodcastChannel(input);
});
document.getElementById('podcastLangPicker')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pod-lang]');
  if (!btn) return;
  podcastNewLang = btn.dataset.podLang;
  document.querySelectorAll('#podcastLangPicker .pod-lang-opt').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.podLang === podcastNewLang);
  });
});

async function setPodcastLang(channelId, lang) {
  try {
    const r = await fetch(`${API_URL}/podcasts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', channelId, lang }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yangilab bo\'lmadi.');
    const idx = podcastChannels.findIndex((c) => c.channelId === channelId);
    if (idx >= 0 && data.channel) podcastChannels[idx] = data.channel;
    renderPodcasts();
    showNotification(`Kategoriya: ${POD_LANG_LABEL[lang] || lang}`);
  } catch (err) {
    showNotification('Xato: ' + err.message, 'error');
  }
}
// ---- Til kategoriyalari (Mini app podcast Kategoriyalar) ----
const POD_LANG_KEYS = ['uz', 'ru', 'en'];
const POD_LANG_DEFAULTS = {
  uz: { name: "O'zbekcha", image: '' },
  ru: { name: 'Ruscha', image: '' },
  en: { name: 'Inglizcha', image: '' },
};
let podLangsState = JSON.parse(JSON.stringify(POD_LANG_DEFAULTS));

function renderPodLangsEditor() {
  const root = document.getElementById('podLangsEditor');
  if (!root) return;
  root.innerHTML = POD_LANG_KEYS.map((k) => {
    const e = podLangsState[k] || POD_LANG_DEFAULTS[k];
    const img = e.image
      ? `<img src="${escapeHtml(e.image)}" alt="">`
      : `<span>Rasm yo'q</span>`;
    return `
      <div class="pod-lang-card" data-pod-lang-card="${k}">
        <div class="pod-lang-card__head">
          <div class="pod-lang-card__thumb" data-pod-lang-preview>${img}</div>
          <div class="entity-card__info">
            <div class="pod-lang-card__code">${k.toUpperCase()}</div>
            <input type="text" class="form-input" data-pod-lang-name value="${escapeHtml(e.name || '')}" placeholder="Nomi">
          </div>
        </div>
        <label class="btn btn-secondary btn-sm">
          Rasm yuklash
          <input type="file" accept="image/*" data-pod-lang-file hidden>
        </label>
        <input type="text" class="form-input" data-pod-lang-url value="${escapeHtml(e.image || '')}" placeholder="https://... (yoki yuklashdan keyin avto)">
      </div>
    `;
  }).join('');
}

async function fetchPodLangs() {
  const hint = document.getElementById('podLangsHint');
  try {
    const r = await fetch(`${API_URL}/categories?type=podcast-langs`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yuklab bo\'lmadi.');
    POD_LANG_KEYS.forEach((k) => {
      const e = (data.langs && data.langs[k]) || POD_LANG_DEFAULTS[k];
      podLangsState[k] = { name: e.name || POD_LANG_DEFAULTS[k].name, image: e.image || '' };
    });
    renderPodLangsEditor();
    if (hint) { hint.textContent = 'Yuklandi'; setTone(hint, ''); }
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; setTone(hint, 'error'); }
  }
}

function readPodLangsFromInputs() {
  const root = document.getElementById('podLangsEditor');
  if (!root) return podLangsState;
  POD_LANG_KEYS.forEach((k) => {
    const card = root.querySelector(`[data-pod-lang-card="${k}"]`);
    if (!card) return;
    const name = card.querySelector('[data-pod-lang-name]')?.value.trim() || POD_LANG_DEFAULTS[k].name;
    const image = card.querySelector('[data-pod-lang-url]')?.value.trim() || '';
    podLangsState[k] = { name, image };
  });
  return podLangsState;
}

async function uploadPodLangImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Faylni o\'qib bo\'lmadi.'));
    fr.readAsDataURL(file);
  });
  const r = await fetch(`${API_URL}/categories?type=podcast-langs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upload', dataUrl, name: 'pod-lang' }),
  });
  const data = await r.json();
  if (!r.ok || !data.ok) throw new Error(data.error || 'Yuklab bo\'lmadi.');
  return data.url;
}

document.getElementById('podLangsEditor')?.addEventListener('change', async (e) => {
  const fileInput = e.target.closest('[data-pod-lang-file]');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const card = fileInput.closest('[data-pod-lang-card]');
    const hint = document.getElementById('podLangsHint');
    try {
      if (hint) { hint.textContent = 'Rasm yuklanmoqda...'; setTone(hint, ''); }
      const url = await uploadPodLangImage(fileInput.files[0]);
      const urlInput = card.querySelector('[data-pod-lang-url]');
      if (urlInput) urlInput.value = url;
      const preview = card.querySelector('[data-pod-lang-preview]');
      if (preview) preview.innerHTML = `<img src="${escapeHtml(url)}" alt="">`;
      if (hint) { hint.textContent = 'Rasm yuklandi. "Saqlash" tugmasini bosing.'; setTone(hint, 'ok'); }
    } catch (err) {
      if (hint) { hint.textContent = 'Xato: ' + err.message; setTone(hint, 'error'); }
    } finally {
      fileInput.value = '';
    }
  }
});

document.getElementById('podLangsEditor')?.addEventListener('input', (e) => {
  const urlInput = e.target.closest('[data-pod-lang-url]');
  if (!urlInput) return;
  const card = urlInput.closest('[data-pod-lang-card]');
  const preview = card?.querySelector('[data-pod-lang-preview]');
  const val = urlInput.value.trim();
  if (preview) {
    preview.innerHTML = val
      ? `<img src="${escapeHtml(val)}" alt="">`
      : `<span>Rasm yo'q</span>`;
  }
});

document.getElementById('podLangsSaveBtn')?.addEventListener('click', async () => {
  const hint = document.getElementById('podLangsHint');
  const btn = document.getElementById('podLangsSaveBtn');
  const langs = readPodLangsFromInputs();
  if (btn) { btn.disabled = true; btn.textContent = 'Saqlanmoqda...'; }
  try {
    const r = await fetch(`${API_URL}/categories?type=podcast-langs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ langs }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Saqlab bo\'lmadi.');
    if (hint) { hint.textContent = 'Saqlandi ✅'; setTone(hint, 'ok'); }
    showNotification('Til kategoriyalari saqlandi');
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; setTone(hint, 'error'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Saqlash'; }
  }
});

document.getElementById('podLangsReloadBtn')?.addEventListener('click', () => fetchPodLangs());

document.getElementById('podcastReloadBtn')?.addEventListener('click', () => fetchPodcasts(true));
document.getElementById('podcastsListGrid')?.addEventListener('click', (e) => {
  const del = e.target.closest('[data-pod-delete]');
  if (del) {
    const [id, title] = del.dataset.podDelete.split('|');
    deletePodcastChannel(id, title);
    return;
  }
  const ref = e.target.closest('[data-pod-refresh]');
  if (ref) { refreshPodcastChannel(ref.dataset.podRefresh); return; }
  const setLang = e.target.closest('[data-pod-set-lang]');
  if (setLang) {
    const [id, lang] = setLang.dataset.podSetLang.split('|');
    setPodcastLang(id, lang);
  }
});
document.getElementById('podcastsListGrid')?.addEventListener('change', (e) => {
  const cb = e.target.closest('[data-pod-featured]');
  if (cb) togglePodcastFeatured(cb.dataset.podFeatured, cb.checked);
});

// ============================================================
// Futbol YouTube Highlights (O'yinlar sharhi)
let fifaHighlightsLoaded = false;

function setFifaHighlightsStatus(msg, kind) {
  const el = document.getElementById('fifaHighlightsStatus');
  if (!el) return;
  el.textContent = msg || '';
  setTone(el, kind);
}

function renderFifaHighlightsPreview(videos) {
  const wrap = document.getElementById('fifaHighlightsPreviewWrap');
  const grid = document.getElementById('fifaHighlightsPreviewGrid');
  const countBadge = document.getElementById('fifaHighlightsCountBadge');
  if (!wrap || !grid) return;

  const list = Array.isArray(videos) ? videos : [];
  if (!list.length) {
    wrap.hidden = true;
    grid.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  if (countBadge) countBadge.textContent = `${list.length} ta video`;

  grid.innerHTML = list.map((v) => {
    const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
    return `
      <div class="video-card">
        <div class="video-card__thumb">
          <img src="${escapeHtml(thumb)}" alt="" loading="lazy">
          ${v.duration ? `<span class="video-card__tag video-card__tag--duration">${escapeHtml(v.duration)}</span>` : ''}
          ${v.timeAgo ? `<span class="video-card__tag video-card__tag--age">${escapeHtml(v.timeAgo)}</span>` : ''}
        </div>
        <div class="video-card__body">
          <div class="video-card__title" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</div>
          <a class="video-card__link" href="https://www.youtube.com/watch?v=${escapeHtml(v.videoId)}" target="_blank" rel="noopener">YouTube'da ko'rish ↗</a>
        </div>
      </div>
    `;
  }).join('');
}

async function loadFifaHighlights() {
  if (fifaHighlightsLoaded) return;
  try {
    const res = await fetch('/api/categories?type=fifa-highlights', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const input = document.getElementById('fifaHighlightsChannelUrl');
    if (input) input.value = json.channelUrl || '';
    renderFifaHighlightsPreview(json.videos || []);
    fifaHighlightsLoaded = true;
  } catch (err) {
    setFifaHighlightsStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

async function saveFifaHighlights() {
  const input = document.getElementById('fifaHighlightsChannelUrl');
  const quickInput = document.getElementById('fifaHighlightsQuickImport');
  const channelUrl = (input?.value || '').trim();
  const rawText = (quickInput?.value || '').trim();

  if (!channelUrl && !rawText) {
    setFifaHighlightsStatus("YouTube kanal havolasini yoki video havolalarini kiriting.", 'error');
    return;
  }

  setFifaHighlightsStatus("Videolar tekshirilmoqda va saqlanmoqda...", 'info');
  try {
    const res = await fetch('/api/categories?type=fifa-highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelUrl, rawText }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    renderFifaHighlightsPreview(json.videos || []);
    if (quickInput && rawText) quickInput.value = '';
    const count = json.count || (json.videos || []).length;
    if (count > 0) {
      setFifaHighlightsStatus(`Muvaffaqiyatli saqlandi! ${count} ta o'yin videosi mini app'da ko'rinadi.`, 'ok');
    } else {
      setFifaHighlightsStatus("Kanal saqlandi. O'yinlar sharhi videolari tez orada mini app'da avtomatik yangilanadi.", 'info');
    }
  } catch (err) {
    setFifaHighlightsStatus(`Xato: ${err.message}`, 'error');
  }
}

async function deleteFifaHighlights() {
  if (!confirm("YouTube highlights kanalini o'chirmoqchimisiz? Mini app'da o'yinlar sharhi card'lari ko'rinmay qoladi.")) return;
  setFifaHighlightsStatus("O'chirilmoqda...", 'info');
  try {
    const res = await fetch('/api/categories?type=fifa-highlights', { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const input = document.getElementById('fifaHighlightsChannelUrl');
    if (input) input.value = '';
    renderFifaHighlightsPreview([]);
    setFifaHighlightsStatus("O'chirildi. Mini app'da highlight card'lari yashirildi.", 'ok');
  } catch (err) {
    setFifaHighlightsStatus(`Xato: ${err.message}`, 'error');
  }
}

document.getElementById('fifaHighlightsSaveBtn')?.addEventListener('click', saveFifaHighlights);
document.getElementById('fifaHighlightsDeleteBtn')?.addEventListener('click', deleteFifaHighlights);


// ============================================================
// Futbol translyatsiyasi (VK Video / YouTube Live pleyerli card)
let fifaStreamsLoaded = false;
let fifaStreamsDraft = [];
function setFifaStreamsStatus(text, kind = "") {
  const el = document.getElementById("fifaStreamsStatus"); if (!el) return;
  el.textContent = text || ""; setTone(el, kind);
}
function renderFifaStreamsForm() {
  const wrap = document.getElementById("fifaStreamsForm"); if (!wrap) return;
  if (!fifaStreamsDraft.length) fifaStreamsDraft = [{ id: `fifa-stream-${Date.now()}`, url: "", title: "", enabled: true }];
  wrap.innerHTML = fifaStreamsDraft.map((item, index) => `<div class="fifa-admin-stream-row" data-fifa-stream-row="${index}">
    <div class="fifa-admin-stream-row__top"><strong>Translyatsiya ${index + 1}</strong><button type="button" class="btn btn-danger-soft btn-sm" data-fifa-stream-remove="${index}" ${fifaStreamsDraft.length === 1 ? "disabled" : ""}>O'chirish</button></div>
    <div class="form-row"><div class="form-group"><label>Nom</label><input class="form-input" data-fifa-field="title" data-index="${index}" value="${escapeHtml(item.title || "")}" placeholder="Masalan: Real Madrid — Barcelona" maxlength="120"></div><div class="form-group"><label>YouTube Live yoki VK linki</label><input class="form-input" data-fifa-field="url" data-index="${index}" value="${escapeHtml(item.originalUrl || item.url || "")}" placeholder="https://www.youtube.com/live/..., https://m.vkvideo.ru/... yoki https://.../stream.m3u8" type="url"><small class="form-hint">VK Video (masalan https://vksport.m.vkvideo.ru/video-221212132_456248840) yoki YouTube Live linki futbol bo'limida pleyerli video card bo'lib chiqadi. VK Video Live (live.vkvideo.ru) efiri telefonda card ichida o'ynamaydi — u yerda bosilganda VK'da ochiladi.</small></div></div>
  </div>`).join("");
  wrap.querySelectorAll("[data-fifa-field]").forEach((el) => el.addEventListener("input", () => {
    const i = Number(el.dataset.index); const field = el.dataset.fifaField;
    fifaStreamsDraft[i][field] = el.type === "checkbox" ? el.checked : el.value;
    // Input foydalanuvchi kiritgan asl linkni ko'rsatadi — uni originalUrl'da ham saqlaymiz.
    if (field === "url") fifaStreamsDraft[i].originalUrl = el.value;
  }));
  wrap.querySelectorAll("[data-fifa-stream-remove]").forEach((el) => el.addEventListener("click", () => { fifaStreamsDraft.splice(Number(el.dataset.fifaStreamRemove), 1); renderFifaStreamsForm(); }));
}
async function loadFifaStreamsSettings() {
  if (fifaStreamsLoaded) return;
  try { const res = await fetch("/api/settings", { cache: "no-store" }); const data = await res.json(); fifaStreamsDraft = Array.isArray(data.fifaStreams) ? data.fifaStreams : []; fifaStreamsLoaded = true; renderFifaStreamsForm(); }
  catch (err) { setFifaStreamsStatus(`Yuklashda xato: ${err.message}`, "error"); renderFifaStreamsForm(); }
}
async function saveFifaStreams() {
  // API `url` ni embed manzilga aylantirib qaytaradi, asl link esa `originalUrl` da.
  // Asl linkni yuboramiz — aks holda qayta saqlashda "VK Video'da ochish" tugmasi
  // VK sahifasi o'rniga embed pleyerni ochadigan bo'lib qoladi.
  const rows = fifaStreamsDraft.map((item) => ({ id: item.id, enabled: true, url: String(item.originalUrl || item.url || "").trim(), title: String(item.title || "").trim() })).filter((item) => item.url);
  if (rows.some((item) => !/^https?:\/\//i.test(item.url))) { setFifaStreamsStatus("Har bir link https:// bilan boshlanishi kerak.", "error"); return; }
  if (rows.some((item) => !/(youtube\.com|youtu\.be|vk\.com|vk\.ru|vkvideo\.ru|\.m3u8|:\d+\/)/i.test(item.url))) { setFifaStreamsStatus("Faqat YouTube, VK Video yoki HLS (.m3u8) linklari qabul qilinadi.", "error"); return; }
  setFifaStreamsStatus("Stream sozlamalari saqlanmoqda…");
  try { const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fifaStreams: rows }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`); fifaStreamsDraft = data.fifaStreams || rows; renderFifaStreamsForm(); setFifaStreamsStatus("Saqlandi. Stream cardlari futbol bo'limida ko'rinadi.", "ok"); }
  catch (err) { setFifaStreamsStatus(`Xato: ${err.message}`, "error"); }
}
async function deleteFifaStreams() {
  if (!confirm("Barcha futbol translyatsiya kartalarini o'chirmoqchimisiz?")) return;
  try { const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fifaStreams: [] }) }); if (!res.ok) throw new Error(`HTTP ${res.status}`); fifaStreamsDraft = []; renderFifaStreamsForm(); setFifaStreamsStatus("Barcha kartalar o'chirildi.", "ok"); }
  catch (err) { setFifaStreamsStatus(`Xato: ${err.message}`, "error"); }
}
document.getElementById("fifaStreamsAddBtn")?.addEventListener("click", () => { fifaStreamsDraft.push({ id: `fifa-stream-${Date.now()}`, url: "", title: "", enabled: true }); renderFifaStreamsForm(); });
document.getElementById("fifaStreamsSaveBtn")?.addEventListener("click", saveFifaStreams);
document.getElementById("fifaStreamsDeleteBtn")?.addEventListener("click", deleteFifaStreams);
// ============================================================
// Kibersport YouTube translatsiyalari
const esportsStreamDefaults = [
  { key: 'cs', label: 'CS2' },
  { key: 'pubg', label: 'PUBG Mobile' },
  { key: 'clash', label: 'Clash of Clans' },
];
let esportsStreamsLoaded = false;
function setEsportsStreamsStatus(text, kind = '') {
  const el = document.getElementById('esportsStreamsStatus');
  if (el) { el.textContent = text; setTone(el, kind); }
}
function esportsLocalDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function renderEsportsStreams(items) {
  const wrap = document.getElementById('esportsStreamsForm');
  if (!wrap) return;
  const activeKey = wrap.dataset.activeKey || items[0]?.key || 'cs';
  wrap.innerHTML = `
    <div class="tabs tabs--inner" role="tablist">
      ${items.map((item) => `<button type="button" class="tab${item.key === activeKey ? ' is-active' : ''}" role="tab" data-esports-tab="${item.key}">${escapeHtml(item.label)}</button>`).join('')}
    </div>
    ${items.map((item) => `
      <div data-esports-panel="${item.key}" ${item.key !== activeKey ? 'hidden' : ''}>
        <div class="card-head">
          <h3>${escapeHtml(item.label)} translatsiyasi</h3>
        </div>
          <div class="form-row">
            <div class="form-group"><label>Bo‘lim nomi</label><input class="form-input" data-esports-field="label" data-esports-key="${item.key}" value="${escapeHtml(item.label)}" maxlength="60"></div>
            <div class="form-group"><label>YouTube linki</label><input class="form-input" data-esports-field="youtubeUrl" data-esports-key="${item.key}" value="${escapeHtml(item.youtubeUrl || '')}" placeholder="https://youtube.com/live/..." type="url"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Stream sarlavhasi</label><input class="form-input" data-esports-field="title" data-esports-key="${item.key}" value="${escapeHtml(item.title || '')}" placeholder="Masalan: CS2 Grand Final"></div>
            <div class="form-group"><label>Qo‘shimcha ma’lumot</label><input class="form-input" data-esports-field="meta" data-esports-key="${item.key}" value="${escapeHtml(item.meta || '')}" placeholder="Grand Final"></div>
          </div>
          <div class="form-row form-row--end">
            <div class="form-group"><label>Boshlanish vaqti</label><input class="form-input" data-esports-field="startAt" data-esports-key="${item.key}" value="${esportsLocalDate(item.startAt)}" type="datetime-local"><small class="form-hint">Bo‘sh qoldirilsa, hozir boshlanadi.</small></div>
            <div class="form-group"><button type="button" class="btn btn-secondary" data-esports-start-now="${item.key}">Hozir boshlash</button><small class="form-hint">&nbsp;</small></div>
          </div>
          <div class="check-list">
            <label class="check"><input type="checkbox" data-esports-field="isLive" data-esports-key="${item.key}" ${item.isLive ? 'checked' : ''}> Hozir jonli efirda</label>
            <label class="check"><input type="checkbox" data-esports-field="enabled" data-esports-key="${item.key}" ${item.enabled !== false ? 'checked' : ''}> Foydalanuvchilarga ko‘rsatish</label>
          </div>
          <h4 class="subsection-title">So‘nggi haylaytlar</h4>
          <div>
            ${Array.from({ length: 3 }, (_, index) => {
              const highlight = Array.isArray(item.highlights) ? (item.highlights[index] || {}) : {};
              return `<div class="subcard">
                <div class="subcard__title">${index + 1}-haylayt</div>
                <div class="form-row">
                  <div class="form-group"><label>Sarlavha</label><input class="form-input" data-esports-highlight-field="title" data-esports-highlight-index="${index}" data-esports-key="${item.key}" value="${escapeHtml(highlight.title || '')}" placeholder="Haylayt nomi" maxlength="120"></div>
                  <div class="form-group"><label>Izoh</label><input class="form-input" data-esports-highlight-field="subtitle" data-esports-highlight-index="${index}" data-esports-key="${item.key}" value="${escapeHtml(highlight.subtitle || '')}" placeholder="Bugun · 05 daqiqa" maxlength="160"></div>
                </div>
                <div class="form-group"><label>YouTube video linki</label><input class="form-input" data-esports-highlight-field="youtubeUrl" data-esports-highlight-index="${index}" data-esports-key="${item.key}" value="${escapeHtml(highlight.youtubeUrl || '')}" placeholder="https://youtu.be/..." type="url"></div>
              </div>`;
            }).join('')}
          </div>
      </div>`).join('')}`;
  wrap.dataset.activeKey = activeKey;
  wrap.querySelectorAll('[data-esports-tab]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.esportsTab;
    wrap.dataset.activeKey = key;
    wrap.querySelectorAll('[data-esports-tab]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.dataset.esportsTab === key);
    });
    wrap.querySelectorAll('[data-esports-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.esportsPanel !== key;
    });
  }));
  wrap.querySelectorAll('[data-esports-start-now]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.esportsStartNow;
    const field = wrap.querySelector(`[data-esports-field="startAt"][data-esports-key="${key}"]`);
    const live = wrap.querySelector(`[data-esports-field="isLive"][data-esports-key="${key}"]`);
    if (field) field.value = esportsLocalDate(new Date().toISOString());
    if (live) live.checked = true;
    setEsportsStreamsStatus(`${key.toUpperCase()} ishga tushirilmoqda...`);
    saveEsportsStreams();
  }));
}

async function loadEsportsStreams() {
  if (esportsStreamsLoaded) return;
  try {
    const res = await fetch('/api/settings', { cache: 'no-store' });
    const json = await res.json();
    const incoming = json.esportsStreams || {};
    const items = esportsStreamDefaults.map((base) => ({ ...base, ...(incoming[base.key] || {}) }));
    renderEsportsStreams(items);
    esportsStreamsLoaded = true;
  } catch (err) { setEsportsStreamsStatus(`Yuklashda xato: ${err.message}`, 'error'); }
}
async function saveEsportsStreams() {
  const result = {};
  document.querySelectorAll('[data-esports-field]').forEach((el) => {
    const key = el.dataset.esportsKey;
    const field = el.dataset.esportsField;
    result[key] ||= { key };
    if (field === 'enabled' || field === 'isLive') {
      result[key][field] = el.checked;
    } else if (field === 'startAt') {
      const localDate = el.value.trim();
      result[key][field] = localDate ? new Date(localDate).toISOString() : '';
    } else {
      result[key][field] = el.value.trim();
    }
  });
  setEsportsStreamsStatus('Saqlanmoqda...');
  try {
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ esportsStreamsPatch: result }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    esportsStreamsLoaded = false;
    setEsportsStreamsStatus('Saqlandi. Kibersport sahifasida yangilanadi.', 'ok');
  } catch (err) { setEsportsStreamsStatus(`Saqlashda xato: ${err.message}`, 'error'); }
}
document.getElementById('esportsStreamsSaveBtn')?.addEventListener('click', saveEsportsStreams);
async function saveEsportsHighlights() {
  const result = {};
  document.querySelectorAll('[data-esports-highlight-field]').forEach((el) => {
    const key = el.dataset.esportsKey;
    const index = Number(el.dataset.esportsHighlightIndex);
    const field = el.dataset.esportsHighlightField;
    result[key] ||= { key, highlights: [] };
    result[key].highlights[index] ||= {};
    result[key].highlights[index][field] = el.value.trim();
  });
  setEsportsStreamsStatus('Haylaytlar saqlanmoqda...');
  try {
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ esportsStreamsPatch: result }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    esportsStreamsLoaded = false;
    setEsportsStreamsStatus('Haylaytlar saqlandi.', 'ok');
  } catch (err) { setEsportsStreamsStatus(`Saqlashda xato: ${err.message}`, 'error'); }
}
document.getElementById('esportsHighlightsSaveBtn')?.addEventListener('click', saveEsportsHighlights);

// ============================================================
// TV kanallar bo'limi — ro'yxat, tahrirlash, o'chirish, qo'shish.
// Saqlangan ro'yxat Redis'da (/api/categories?type=tv-channels);
// bo'sh bo'lsa default /static/tv/tv-channels.json ko'rsatiladi.
// ============================================================
let tvChannelsAdmin = [];
let tvChannelsLoadedAdmin = false;
let tvChannelsIsDefault = false;

function tvChSetStatus(text, kind) {
  const el = document.getElementById('tvChStatus');
  if (!el) return;
  el.textContent = text || '';
  setTone(el, kind);
}

function tvChEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadTvChannelsAdmin(force) {
  if (tvChannelsLoadedAdmin && !force) { renderTvChannelsAdmin(); return; }
  tvChSetStatus('Yuklanmoqda...');
  try {
    const res = await fetch('/api/categories?type=tv-channels', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    if (Array.isArray(json.channels)) {
      tvChannelsAdmin = json.channels;
      tvChannelsIsDefault = false;
    } else {
      const defRes = await fetch('/static/tv/tv-channels.json', { cache: 'no-store' });
      const def = await defRes.json();
      tvChannelsAdmin = Array.isArray(def.channels) ? def.channels : [];
      tvChannelsIsDefault = true;
    }
    tvChannelsLoadedAdmin = true;
    tvChSetStatus(tvChannelsIsDefault
      ? "Default ro'yxat ko'rsatilmoqda (hali o'zgartirilmagan)."
      : "Admin saqlagan ro'yxat ko'rsatilmoqda.");
    fillTvGroupFilter();
    renderTvChannelsAdmin();
  } catch (err) {
    tvChSetStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

function fillTvGroupFilter() {
  const sel = document.getElementById('tvChGroupFilter');
  if (!sel) return;
  const cur = sel.value;
  const groups = [...new Set(tvChannelsAdmin.map((c) => c.group || 'General'))];
  sel.innerHTML = '<option value="">Barcha guruhlar</option>' +
    groups.map((g) => `<option value="${tvChEsc(g)}">${tvChEsc(g)}</option>`).join('');
  if (groups.includes(cur)) sel.value = cur;
}

function renderTvChannelsAdmin() {
  const list = document.getElementById('tvChList');
  const countEl = document.getElementById('tvChCount');
  if (!list) return;
  const q = (document.getElementById('tvChSearch')?.value || '').trim().toLowerCase();
  const grp = document.getElementById('tvChGroupFilter')?.value || '';
  const rows = tvChannelsAdmin
    .map((ch, idx) => ({ ch, idx }))
    .filter(({ ch }) => (!q || ch.name.toLowerCase().includes(q)) && (!grp || (ch.group || 'General') === grp));
  if (countEl) countEl.textContent = `${rows.length} / ${tvChannelsAdmin.length} kanal`;
  list.innerHTML = rows.map(({ ch, idx }) => `
    <div class="list-row">
      <img class="list-row__logo" src="${tvChEsc(ch.logo)}" alt="" referrerpolicy="no-referrer" loading="lazy"
           onerror="this.style.visibility='hidden'">
      <div class="list-row__info">
        <div class="list-row__title">${tvChEsc(ch.name)}</div>
        <div class="list-row__meta">${tvChEsc(ch.group || 'General')} · ${tvChEsc(ch.url)}</div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-tv-edit="${idx}">Tahrirlash</button>
      <button type="button" class="btn btn-danger-soft btn-sm" data-tv-del="${idx}">O'chirish</button>
    </div>
  `).join('') || '<div class="placeholder-text">Kanal topilmadi.</div>';

  list.querySelectorAll('[data-tv-edit]').forEach((b) =>
    b.addEventListener('click', () => openTvChForm(Number(b.dataset.tvEdit))));
  list.querySelectorAll('[data-tv-del]').forEach((b) =>
    b.addEventListener('click', () => deleteTvChannel(Number(b.dataset.tvDel))));
}

function openTvChForm(index) {
  const form = document.getElementById('tvChForm');
  if (!form) return;
  const ch = Number.isInteger(index) && index >= 0 ? tvChannelsAdmin[index] : null;
  document.getElementById('tvChFormIndex').value = ch ? String(index) : '';
  document.getElementById('tvChFormName').value = ch?.name || '';
  document.getElementById('tvChFormGroup').value = ch?.group || 'General';
  document.getElementById('tvChFormLogo').value = ch?.logo || '';
  document.getElementById('tvChFormUrl').value = ch?.url || '';
  syncTvChLogoPreview();
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTvChForm() {
  const form = document.getElementById('tvChForm');
  if (form) form.hidden = true;
}

function syncTvChLogoPreview() {
  const url = (document.getElementById('tvChFormLogo')?.value || '').trim();
  const img = document.getElementById('tvChFormLogoPreview');
  if (!img) return;
  if (/^https?:\/\//i.test(url)) {
    // Rasm yuklanmasa (masalan Wikipedia sahifa havolasi qo'yilgan bo'lsa,
    // to'g'ridan-to'g'ri rasm URL emas) — foydalanuvchini darhol ogohlantiramiz.
    img.onerror = () => {
      img.style.display = 'none';
      tvChSetStatus("Logo rasmi ochilmadi — sahifa havolasi emas, to'g'ridan-to'g'ri rasm havolasini (.png/.jpg/.svg) qo'ying. Rasm ustiga bosib «Rasm manzilini nusxalash» ni tanlang.", 'error');
    };
    img.onload = () => { tvChSetStatus('', ''); };
    img.src = url;
    img.style.display = 'inline-block';
  } else {
    img.style.display = 'none';
  }
}

async function saveTvChannelsToServer(next, successMsg) {
  tvChSetStatus('Saqlanmoqda...');
  const res = await fetch('/api/categories?type=tv-channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels: next }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
  tvChannelsAdmin = json.channels;
  tvChannelsIsDefault = false;
  fillTvGroupFilter();
  renderTvChannelsAdmin();
  tvChSetStatus(successMsg || 'Saqlandi.', 'ok');
}

async function submitTvChForm() {
  const idxRaw = document.getElementById('tvChFormIndex').value;
  const name = (document.getElementById('tvChFormName')?.value || '').trim();
  const group = document.getElementById('tvChFormGroup')?.value || 'General';
  const logo = (document.getElementById('tvChFormLogo')?.value || '').trim();
  const url = (document.getElementById('tvChFormUrl')?.value || '').trim();
  if (!name) { tvChSetStatus('Kanal nomini kiriting.', 'error'); return; }
  if (!/^https:\/\//i.test(url)) { tvChSetStatus("Stream havolasi https:// bilan boshlanishi kerak.", 'error'); return; }
  const entry = { name, group, logo, url };
  const next = tvChannelsAdmin.slice();
  if (idxRaw === '') next.unshift(entry);
  else next[Number(idxRaw)] = entry;
  try {
    await saveTvChannelsToServer(next, idxRaw === '' ? "Kanal qo'shildi." : 'Kanal yangilandi.');
    closeTvChForm();
  } catch (err) {
    tvChSetStatus(`Saqlashda xato: ${err.message}`, 'error');
  }
}

async function deleteTvChannel(index) {
  const ch = tvChannelsAdmin[index];
  if (!ch) return;
  if (!confirm(`"${ch.name}" kanalini o'chirasizmi?`)) return;
  const next = tvChannelsAdmin.slice();
  next.splice(index, 1);
  try {
    await saveTvChannelsToServer(next, "Kanal o'chirildi.");
  } catch (err) {
    tvChSetStatus(`O'chirishda xato: ${err.message}`, 'error');
  }
}

async function resetTvChannels() {
  if (!confirm("Barcha TV kanallarini public va admin paneldan tozalaysizmi?")) return;
  tvChSetStatus('Kanallar tozalanmoqda...');
  try {
    const res = await fetch('/api/categories?type=tv-channels', { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
    tvChannelsLoadedAdmin = false;
    await loadTvChannelsAdmin(true);
    tvChSetStatus("Barcha TV kanallari tozalandi.", 'ok');
  } catch (err) {
    tvChSetStatus(`Xato: ${err.message}`, 'error');
  }
}

document.getElementById('tvChAddBtn')?.addEventListener('click', () => openTvChForm(-1));
document.getElementById('tvChFormCancel')?.addEventListener('click', closeTvChForm);
document.getElementById('tvChFormSave')?.addEventListener('click', submitTvChForm);
document.getElementById('tvChResetBtn')?.addEventListener('click', resetTvChannels);
document.getElementById('tvChSearch')?.addEventListener('input', () => renderTvChannelsAdmin());
document.getElementById('tvChGroupFilter')?.addEventListener('change', () => renderTvChannelsAdmin());
document.getElementById('tvChFormLogo')?.addEventListener('input', syncTvChLogoPreview);

// ============================================================
// Futbol: M3U pleylistdan TV kanallar. Butun ro'yxat shu yerda o'qiladi,
// serverga faqat pleylist linki va yoqilgan bitta kanal saqlanadi (fifaTv).
const FIFA_TV_DEFAULT_PLAYLIST = "https://iptv-org.github.io/iptv/categories/sports.m3u";
// Pleylistdan faqat oxirgi 1–2 yilda futbol ko'rsatgan bepul/rasmiy kanallar qoladi
// (2026-oktabr holatiga internetdan tekshirilgan). Kalit — tvg-id, qiymat — dalil.
// Pullik kanallar (beIN Turk, ESPN, S Sport, Eurosport, TyC, Tigo, DAZN va h.k.)
// pleylistda bo'lsa ham norasmiy retranslyatsiya — ataylab kiritilmagan.
const FIFA_TV_FOOTBALL_CHANNELS = {
  "FIFAPlus.uk@English": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@French": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@German": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@HispanicAmerica": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@Italy": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@Portuguese": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@Spain": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlus.uk@UnitedStates": "FIFA+ — dunyo ligalari, jonli o'yinlar",
  "FIFAPlusWomen.uk@English": "FIFA+ — ayollar futboli",
  "ASpor.tr@SD": "Turkiya kubogi (2025-26)",
  "TRTSpor.tr@SD": "TFF 1. Lig, UEFA kubogi o'yinlari (2025-26)",
  "HTSporTV.tr@SD": "TFF 2. va 3. Lig (2024-25)",
  "Sportitalia.it@SD": "Saudiya Pro Ligasi, Argentina, Primavera (2025-26)",
  "SportitaliaSolocalcio.it@SD": "Saudiya Pro Ligasi, Afrika kubogi 2025",
  "CBSSportsGolazoNetwork.us@SD": "Jonli o'yinlar, Baller League (2026)",
  "GolazoNetwork.us@SD": "Jonli o'yinlar, Baller League (2026)",
  "beINSPORTSXTRA.us@SD": "Süper Lig, Ligue 1 — tanlangan o'yinlar",
  "RealMadridTV.es@SD": "Real Madrid Castilla o'yinlari",
  "LazioStyleChannel.it@HD": "Lazio Primavera, o'rtoqlik o'yinlari (2025)",
  "DDSports.in@SD": "Indian Football League (2025-26)",
  "DDSports.in@HD": "Indian Football League (2025-26)",
  "TSports.bd@SD": "Jahon chempionati 2026, futzal ligasi",
  "LEquipe.fr@SD": "JCh-2026 saralash o'yinlari",
  "Belarus5.by@SD": "Belarus chempionati, terma jamoa",
  "Belarus5.by@Internet": "Belarus chempionati, terma jamoa",
  "Sport.uz@SD": "O'zbekiston Superligasi, U-17 JCh 2025",
  "TurkmenistanSport.tm@SD": "Turkmaniston Ýokary Ligasi",
  "Sport.kg@SD": "Jahon chempionati 2026",
  "CBCSport.az@HD": "Ozarbayjon Premyer-ligasi (2025-26)",
  "MNBSport.mn@SD": "Jahon chempionati 2026",
  "VarzeshTV.ir@SD": "Eron Pro Ligasi (2025-26)",
  "KTVSport.kw@SD": "Fors ko'rfazi kubogi 2024, Quvayt ligasi",
  "KTVSportPlus.kw@SD": "Fors ko'rfazi kubogi 2024, Quvayt ligasi",
  "OmanSportsTV.om@SD": "Ummon Pro Ligasi, Fors ko'rfazi kubogi 2026",
  "BahrainSports1.bh@SD": "Bahrayn Premyer-ligasi (2025-26)",
  "BahrainSports2.bh@SD": "Bahrayn Premyer-ligasi (2025-26)",
  "SharjahSports.ae@SD": "BAA Pro Ligasi, Prezident kubogi (2025-26)",
  "AlIraqiaSport.iq@SD": "Iroq Yulduzlar Ligasi (2025-26)",
  "CCTV5Plus.cn@SD": "Jahon chempionati 2026",
  "SukanRTM.my@SD": "Malayziya Superligasi (2024-25)",
  "TSports7.th@SD": "SEA Games 2025",
  "MRTVSports.mm@SD": "Myanma Milliy Ligasi",
  "HTVSports.vn@SD": "V.League (2026-27)",
  "VTV6.vn@HD": "V.League (2026-27)",
  "SanMarinoRTVSport.sm@SD": "San-Marino chempionati",
  "Teledeporte.es@SD": "LaLiga, Qirol kubogi (2025-26)",
  "Esport3.es@SD": "Barça ayollar jamoasi, Chempionlar Ligasi",
  "PlutoTVEsportes.us@BR": "Ayollar Libertadores kubogi 2025",
  "FuboSportsNetwork.us@SD": "Millatlar Ligasi (2024-25)",
  "CRTVSportsandEntertainment.cm@SD": "Kamerun Elite One",
  "NSports.br@SD": "Braziliya Serie B, shtat chempionatlari",
  "TDMSports.mo@SD": "Jahon chempionati 2026",
};
// Pleylistdan qat'i nazar doim ro'yxatda turadigan bepul kanallar (to'g'ridan-to'g'ri havolalar).
// http://185.121.1.163:8083/FootballHD ataylab yo'q — http oqimni https mini ilova o'ynata olmaydi.
const FIFA_TV_EXTRA_CHANNELS = [
  { name: "CBS Sports Golazo (720p)", url: "https://dai.google.com/linear/hls/event/7f3Wv6f7QEKfQna22jHqLQ/master.m3u8", tvgId: "CBSSportsGolazoNetwork.us@SD", footballNote: "Jonli o'yinlar, Baller League (2026)" },
  { name: "TRT 1", url: "https://tv-trt1.medya.trt.com.tr/master.m3u8", tvgId: "TRT1.tr@SD", footballNote: "UEFA Chempionlar Ligasi o'yinlari" },
  { name: "TRT 1 (zaxira)", url: "https://trt.daioncdn.net/trt-1/master.m3u8?app=web", tvgId: "TRT1.tr@SD", footballNote: "UEFA Chempionlar Ligasi — zaxira oqim" },
  { name: "TRT Spor", url: "https://corestream.siteyaptim.live/trt-spor/index.m3u8", tvgId: "TRTSpor.tr@SD", footballNote: "TFF 1. Lig, UEFA kubogi o'yinlari (2025-26)" },
  { name: "Varzish TV (Tojikiston, 1080p)", url: "https://live.teleradiocom.tj/8/3m.m3u8", tvgId: "Varzish.tj@SD", footballNote: "Tojikiston ligasi, terma jamoa" },
].map((ch) => ({ ...ch, logo: "", group: "Sports", needsOptions: false, isHttp: false, id: ch.url }));
// «Hammasini tekshirish» ishlamagan deb topgan kanallar shu brauzerda 24 soat yashirin turadi.
const FIFA_TV_DEAD_KEY = "fifa_tv_dead_v1";
const FIFA_TV_DEAD_TTL_MS = 24 * 60 * 60 * 1000;
let fifaTvState = { playlistUrl: "", active: null, allChannels: [], channels: [], query: "", loadedOnce: false, busy: false };
let fifaTvHls = null;
let fifaTvHlsLib = null;

function setFifaTvStatus(text, kind = "") {
  const el = document.getElementById("fifaTvStatus"); if (!el) return;
  el.textContent = text || "";
  setTone(el, kind);
}

function parseM3uPlaylist(text) {
  const channels = [];
  const seen = new Set();
  let pending = null;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const attrs = {};
      line.replace(/([\w-]+)="([^"]*)"/g, (_, key, value) => { attrs[key.toLowerCase()] = value; return ""; });
      const quoteEnd = line.lastIndexOf('",');
      const name = (quoteEnd !== -1 ? line.slice(quoteEnd + 2) : line.slice(line.indexOf(",") + 1)).trim();
      pending = { name: name || attrs["tvg-name"] || "Kanal", logo: attrs["tvg-logo"] || "", group: attrs["group-title"] || "", tvgId: attrs["tvg-id"] || "", needsOptions: false };
      continue;
    }
    if (line.startsWith("#EXTVLCOPT") || line.startsWith("#KODIPROP")) { if (pending) pending.needsOptions = true; continue; }
    if (line.startsWith("#")) continue;
    if (!pending || !/^https?:\/\//i.test(line) || seen.has(line)) { pending = null; continue; }
    seen.add(line);
    channels.push({ ...pending, id: line, url: line, isHttp: line.toLowerCase().startsWith("http://") });
    pending = null;
  }
  return channels;
}

// Mini ilovadagi efir kartasining standart sarlavhasi va posteri (webapp/fifa/fifa.js bilan bir xil).
const FIFA_TV_CARD_DEFAULT_TITLE = "NTV Futbol stream";
const FIFA_TV_CARD_DEFAULT_POSTER = "/static/assets/fifa-live-poster.webp";

function renderFifaTvActive() {
  const el = document.getElementById("fifaTvActive"); if (!el) return;
  const active = fifaTvState.active;
  el.hidden = !active;
  if (!active) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="fifa-tv-admin__active-row"><span class="fifa-tv-admin__live-dot" aria-hidden="true"></span><div><strong>Efirda: ${escapeHtml(active.name)}</strong><small>Futbol bo'limida shu kanal ko'rinmoqda</small></div><button type="button" class="btn btn-secondary" data-fifa-tv-off>O'chirish</button></div>
    <div class="fifa-tv-card-editor">
      <div class="fifa-tv-card-editor__fields">
        <div class="form-group">
          <label for="fifaTvCardTitle">Kartadagi sarlavha</label>
          <input class="form-input" id="fifaTvCardTitle" type="text" maxlength="120" placeholder="Masalan: Arsenal — Liverpool" value="${escapeHtml(active.title || "")}" autocomplete="off">
          <small class="form-hint">Bo'sh qolsa «${escapeHtml(FIFA_TV_CARD_DEFAULT_TITLE)}» chiqadi.</small>
        </div>
        <div class="form-group">
          <label for="fifaTvCardPoster">Poster rasmi</label>
          <div class="fifa-tv-card-editor__poster">
            <input class="form-input" id="fifaTvCardPoster" type="url" placeholder="https://… rasm linki" value="${escapeHtml(active.poster || "")}" autocomplete="off">
            <label class="btn btn-secondary">Yuklash<input type="file" id="fifaTvCardPosterFile" accept="image/*" hidden></label>
            <button type="button" class="btn btn-secondary" id="fifaTvCardPosterReset" title="Standart posterga qaytarish">Standart</button>
          </div>
          <small class="form-hint">Link qo'ying yoki rasm yuklang — 16:9 o'lchamdagisi eng yaxshi chiqadi. Bo'sh qolsa standart poster chiqadi.</small>
        </div>
        <div class="fifa-tv-card-editor__actions">
          <button type="button" class="btn btn-primary" id="fifaTvCardSave">Saqlash</button>
          <span class="status-text" id="fifaTvCardStatus"></span>
        </div>
      </div>
      <div class="fifa-tv-card-editor__preview-wrap">
        <span class="fifa-tv-card-editor__preview-label">Mini ilovada shunday ko'rinadi</span>
        <article class="fifa-tv-card-preview" aria-label="Mini ilovadagi efir kartasi ko'rinishi">
          <div class="fifa-tv-card-preview__head"><div><span class="fifa-tv-card-preview__kicker">TV kanal</span><h4 id="fifaTvCardPreviewTitle"></h4></div><span class="fifa-tv-card-preview__live"><i></i> LIVE</span></div>
          <div class="fifa-tv-card-preview__player" id="fifaTvCardPreviewPlayer"><span class="fifa-tv-card-preview__play" aria-hidden="true"></span><span class="fifa-tv-card-preview__error" id="fifaTvCardPreviewError" hidden>Rasm ochilmadi — linkni tekshiring</span></div>
        </article>
      </div>
    </div>`;
  updateFifaTvCardPreview();
}

function updateFifaTvCardPreview() {
  const titleEl = document.getElementById("fifaTvCardPreviewTitle");
  const player = document.getElementById("fifaTvCardPreviewPlayer");
  const errorEl = document.getElementById("fifaTvCardPreviewError");
  if (!titleEl || !player) return;
  titleEl.textContent = document.getElementById("fifaTvCardTitle")?.value.trim() || FIFA_TV_CARD_DEFAULT_TITLE;
  const poster = document.getElementById("fifaTvCardPoster")?.value.trim() || FIFA_TV_CARD_DEFAULT_POSTER;
  // Rasm haqiqatan ochilishini tekshiramiz — buzuq link bo'lsa admin darhol ko'radi.
  const img = new Image();
  img.onload = () => {
    if (errorEl) errorEl.hidden = true;
    player.style.backgroundImage = `url("${poster.replaceAll('"', "%22")}")`;
  };
  img.onerror = () => {
    if (errorEl) errorEl.hidden = false;
    player.style.backgroundImage = "";
  };
  img.src = poster;
}

function setFifaTvCardStatus(text, kind = "") {
  const el = document.getElementById("fifaTvCardStatus"); if (!el) return;
  el.textContent = text || "";
  setTone(el, kind);
}

async function uploadFifaTvCardPoster(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { setFifaTvCardStatus("Faqat rasm fayl yuklash mumkin.", "error"); return; }
  setFifaTvCardStatus("Rasm yuklanmoqda…");
  try {
    const compressed = await compressImageDataUrl(await readFileAsDataUrl(file), 1280, 720, 0.86);
    const url = proxiedPoster(await uploadCategoryImage(compressed, "fifa-tv-poster"));
    const input = document.getElementById("fifaTvCardPoster");
    if (input) input.value = url;
    updateFifaTvCardPreview();
    setFifaTvCardStatus("Rasm yuklandi. Ko'rinishni tekshirib «Saqlash»ni bosing.", "ok");
  } catch (err) {
    setFifaTvCardStatus(`Rasm yuklanmadi: ${err.message}`, "error");
  }
}

async function saveFifaTvCard() {
  const active = fifaTvState.active;
  if (!active || fifaTvState.busy) return;
  const title = document.getElementById("fifaTvCardTitle")?.value.trim() || "";
  const poster = document.getElementById("fifaTvCardPoster")?.value.trim() || "";
  if (poster && !poster.startsWith("https://")) { setFifaTvCardStatus("Rasm linki https:// bilan boshlanishi kerak.", "error"); return; }
  setFifaTvCardStatus("Saqlanmoqda…");
  await saveFifaTv({ ...active, title, poster });
  setFifaTvCardStatus(fifaTvState.active ? "Saqlandi — mini ilovada yangi sarlavha va poster chiqadi." : "Saqlanmadi.", fifaTvState.active ? "ok" : "error");
}

function renderFifaTvList() {
  const list = document.getElementById("fifaTvList"); if (!list) return;
  const search = document.getElementById("fifaTvSearch");
  if (search) search.hidden = !fifaTvState.channels.length;
  const q = fifaTvState.query.trim().toLowerCase();
  const activeUrl = fifaTvState.active?.url || "";
  const rows = fifaTvState.channels
    .filter((ch) => !q || `${ch.name} ${ch.group} ${ch.tvgId} ${ch.footballNote}`.toLowerCase().includes(q))
    // Yoqilgan kanal doim tepada.
    .sort((a, b) => (b.url === activeUrl) - (a.url === activeUrl));
  list.innerHTML = rows.map((ch) => {
    const on = ch.url === activeUrl;
    const badges = [
      ch.footballNote ? `<span class="fifa-tv-badge fifa-tv-badge--football">⚽ ${escapeHtml(ch.footballNote)}</span>` : (ch.group ? `<span class="fifa-tv-badge">${escapeHtml(ch.group)}</span>` : ""),
      ch.needsOptions ? `<span class="fifa-tv-badge" title="Pleylistda maxsus header talab qilingan — brauzerda ochilmasligi mumkin">Maxsus header</span>` : "",
    ].join("");
    const logo = ch.logo ? `<img class="fifa-tv-row__logo" src="${escapeHtml(ch.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : `<span class="fifa-tv-row__logo"></span>`;
    return `<div class="fifa-tv-row${on ? " is-on" : ""}">${logo}<div class="fifa-tv-row__info"><span class="fifa-tv-row__name">${escapeHtml(ch.name)}</span><div class="fifa-tv-row__meta">${badges}</div></div><button type="button" class="btn btn-secondary fifa-tv-row__try" data-fifa-tv-try="${escapeHtml(ch.url)}">Sinash</button><label class="fifa-tv-switch" title="Futbol bo'limida ko'rsatish"><input type="checkbox" role="switch" data-fifa-tv-toggle="${escapeHtml(ch.url)}" ${on ? "checked" : ""} aria-label="${escapeHtml(ch.name)}"><span></span></label></div>`;
  }).join("");
  if (fifaTvState.channels.length && !rows.length) list.innerHTML = `<div class="fifa-tv-row"><span class="fifa-tv-row__name">Hech narsa topilmadi</span></div>`;
}

async function saveFifaTv(active) {
  fifaTvState.busy = true;
  try {
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fifaTv: { playlistUrl: fifaTvState.playlistUrl, active } }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    fifaTvState.active = data.fifaTv?.active || null;
    if (active && !fifaTvState.active) throw new Error("kanal saqlanmadi (faqat https oqimlar qabul qilinadi)");
    setFifaTvStatus(fifaTvState.active ? `«${fifaTvState.active.name}» futbol bo'limida efirda.` : "TV kanal o'chirildi.", "ok");
  } catch (err) {
    setFifaTvStatus(`Xato: ${err.message}`, "error");
  } finally {
    fifaTvState.busy = false;
    renderFifaTvActive();
    renderFifaTvList();
  }
}

function readFifaTvDead() {
  try {
    const raw = JSON.parse(localStorage.getItem(FIFA_TV_DEAD_KEY) || "{}");
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => now - Number(at) < FIFA_TV_DEAD_TTL_MS));
  } catch (_) {
    return {};
  }
}

function writeFifaTvDead(dead) {
  try { localStorage.setItem(FIFA_TV_DEAD_KEY, JSON.stringify(dead)); } catch (_) {}
}

// Yoqilgan kanal ishlamasa ham ko'rinib tursin — aks holda uni o'chirib bo'lmaydi.
function applyFifaTvDead() {
  const dead = readFifaTvDead();
  const activeUrl = fifaTvState.active?.url || "";
  fifaTvState.channels = fifaTvState.allChannels.filter((ch) => ch.url === activeUrl || !dead[ch.url]);
  return fifaTvState.allChannels.length - fifaTvState.channels.length;
}

function setFifaTvChannels(channels) {
  // Qo'shimcha kanallar tepada; pleylistda ham bo'lsa takrorlanmaydi.
  const extraUrls = new Set(FIFA_TV_EXTRA_CHANNELS.map((ch) => ch.url));
  fifaTvState.allChannels = [...FIFA_TV_EXTRA_CHANNELS, ...channels.filter((ch) => !extraUrls.has(ch.url))];
  return applyFifaTvDead();
}

async function checkAllFifaTvChannels() {
  if (fifaTvState.busy || !fifaTvState.allChannels.length) return;
  const btn = document.getElementById("fifaTvCheckBtn");
  fifaTvState.busy = true;
  if (btn) btn.disabled = true;
  const queue = [...fifaTvState.allChannels];
  const total = queue.length;
  const dead = {};
  let checked = 0;
  // Bir vaqtda 3 tadan — brauzer o'nlab video oqimini birdan ochib qotib qolmasin.
  const worker = async () => {
    while (queue.length) {
      const channel = queue.shift();
      const works = await probeFifaTvStream(channel.url, 12000);
      if (!works) dead[channel.url] = Date.now();
      checked += 1;
      setFifaTvStatus(`Tekshirilmoqda: ${checked}/${total}…`);
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
    writeFifaTvDead(dead);
    const hidden = applyFifaTvDead();
    const deadCount = Object.keys(dead).length;
    const activeDead = Boolean(fifaTvState.active && dead[fifaTvState.active.url]);
    setFifaTvStatus(`${total - deadCount} ta kanal ishlayapti, ${hidden} ta ishlamaydigani yashirildi.${activeDead ? ` Diqqat: yoqilgan «${fifaTvState.active.name}» ishlamayapti — boshqasini yoqing.` : ""}`, activeDead ? "error" : "ok");
  } finally {
    fifaTvState.busy = false;
    if (btn) btn.disabled = false;
    renderFifaTvList();
  }
}

async function loadFifaTvPlaylist() {
  const input = document.getElementById("fifaTvPlaylistUrl");
  const url = String(input?.value || "").trim() || FIFA_TV_DEFAULT_PLAYLIST;
  if (!/^https?:\/\//i.test(url)) { setFifaTvStatus("Pleylist linki http(s):// bilan boshlanishi kerak.", "error"); return; }
  setFifaTvStatus("Pleylist yuklanmoqda…");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = parseM3uPlaylist(await res.text());
    // http oqimni https mini ilova o'ynata olmaydi — ro'yxatdan butunlay olib tashlaymiz.
    const playable = all.filter((ch) => !ch.isHttp);
    if (!playable.length) throw new Error("pleylistda https kanal topilmadi");
    const football = playable
      .filter((ch) => FIFA_TV_FOOTBALL_CHANNELS[ch.tvgId])
      .map((ch) => ({ ...ch, footballNote: FIFA_TV_FOOTBALL_CHANNELS[ch.tvgId] }));
    // Boshqa (o'zingizning) pleylistda tekshirilgan kanal bo'lmasa — barcha https kanallar.
    const channels = football.length ? football : playable.map((ch) => ({ ...ch, footballNote: "" }));
    const changed = url !== fifaTvState.playlistUrl;
    fifaTvState.playlistUrl = url;
    const hidden = setFifaTvChannels(channels);
    const hiddenNote = hidden ? ` ${hidden} tasi oxirgi tekshiruvda ishlamagani uchun yashirin.` : "";
    setFifaTvStatus(football.length
      ? `${fifaTvState.channels.length} ta futbol kanali (${all.length} tadan: http va futbol ko'rsatmaydiganlar olib tashlandi).${hiddenNote}`
      : `${fifaTvState.channels.length} ta https kanal yuklandi (tekshirilgan futbol kanallari ro'yxatida yo'q).${hiddenNote}`, "ok");
    renderFifaTvList();
    if (changed) await saveFifaTv(fifaTvState.active);
  } catch (err) {
    // Pleylist ochilmasa ham qo'shimcha kanallar ro'yxatda qoladi.
    setFifaTvChannels([]);
    renderFifaTvList();
    setFifaTvStatus(`Pleylistni yuklab bo'lmadi: ${err.message}. Link to'g'ri va CORS ochiq ekanini tekshiring. Qo'shimcha kanallar ko'rsatildi.`, "error");
  }
}

async function loadFifaTvSettings() {
  if (fifaTvState.loadedOnce) return;
  fifaTvState.loadedOnce = true;
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    const data = await res.json();
    fifaTvState.playlistUrl = data.fifaTv?.playlistUrl || FIFA_TV_DEFAULT_PLAYLIST;
    fifaTvState.active = data.fifaTv?.active || null;
  } catch (_) {
    fifaTvState.playlistUrl = FIFA_TV_DEFAULT_PLAYLIST;
  }
  const input = document.getElementById("fifaTvPlaylistUrl");
  if (input) input.value = fifaTvState.playlistUrl;
  renderFifaTvActive();
  loadFifaTvPlaylist();
}

function loadFifaTvHlsLib() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (fifaTvHlsLib) return fifaTvHlsLib;
  fifaTvHlsLib = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    s.onload = () => resolve(window.Hls);
    s.onerror = () => { fifaTvHlsLib = null; reject(new Error("hls.js yuklanmadi")); };
    document.head.appendChild(s);
  });
  return fifaTvHlsLib;
}

// Kanal yoqilishidan oldin oqim haqiqatan o'ynashini tekshiradi: birinchi kadr kelsa — ishlaydi.
// O'lik, geobloklangan yoki maxsus header talab qiladigan oqimlar shu yerda to'xtaydi.
function probeFifaTvStream(url, timeoutMs = 15000) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  return new Promise((resolve) => {
    let hls = null;
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    video.addEventListener("loadeddata", () => finish(true), { once: true });
    video.addEventListener("error", () => finish(false), { once: true });
    (async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else {
        const Hls = await loadFifaTvHlsLib();
        if (!Hls?.isSupported()) { finish(false); return; }
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_, data) => { if (data?.fatal) finish(false); });
        hls.loadSource(url);
        hls.attachMedia(video);
      }
      video.play().catch(() => {});
    })().catch(() => finish(false));
  });
}

function closeFifaTvPreview() {
  const wrap = document.getElementById("fifaTvPreview");
  const video = document.getElementById("fifaTvPreviewVideo");
  if (fifaTvHls) { fifaTvHls.destroy(); fifaTvHls = null; }
  if (video) { video.pause(); video.removeAttribute("src"); video.load(); }
  if (wrap) wrap.hidden = true;
}

async function previewFifaTvChannel(url) {
  const channel = fifaTvState.channels.find((ch) => ch.url === url);
  const wrap = document.getElementById("fifaTvPreview");
  const video = document.getElementById("fifaTvPreviewVideo");
  if (!channel || !wrap || !video) return;
  closeFifaTvPreview();
  wrap.hidden = false;
  document.getElementById("fifaTvPreviewName").textContent = channel.name;
  const onFail = () => setFifaTvStatus(`«${channel.name}» ochilmadi — oqim o'chgan yoki geobloklangan bo'lishi mumkin.`, "error");
  try {
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("error", onFail, { once: true });
    } else {
      const Hls = await loadFifaTvHlsLib();
      if (!Hls?.isSupported()) { video.src = url; return; }
      fifaTvHls = new Hls();
      fifaTvHls.on(Hls.Events.ERROR, (_, data) => { if (data?.fatal) onFail(); });
      fifaTvHls.loadSource(url);
      fifaTvHls.attachMedia(video);
    }
    await video.play().catch(() => {});
  } catch (_) {
    onFail();
  }
}

document.getElementById("fifaTvLoadBtn")?.addEventListener("click", loadFifaTvPlaylist);
document.getElementById("fifaTvCheckBtn")?.addEventListener("click", checkAllFifaTvChannels);
document.getElementById("fifaTvPlaylistUrl")?.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); loadFifaTvPlaylist(); } });
document.getElementById("fifaTvSearch")?.addEventListener("input", (event) => { fifaTvState.query = event.target.value; renderFifaTvList(); });
document.getElementById("fifaTvPreviewClose")?.addEventListener("click", closeFifaTvPreview);
document.getElementById("fifaTvActive")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-fifa-tv-off]") && !fifaTvState.busy) saveFifaTv(null);
  if (event.target.closest("#fifaTvCardSave")) saveFifaTvCard();
  if (event.target.closest("#fifaTvCardPosterReset")) {
    const input = document.getElementById("fifaTvCardPoster");
    if (input) input.value = "";
    updateFifaTvCardPreview();
  }
});
document.getElementById("fifaTvActive")?.addEventListener("input", (event) => {
  if (event.target.id === "fifaTvCardTitle" || event.target.id === "fifaTvCardPoster") updateFifaTvCardPreview();
});
document.getElementById("fifaTvActive")?.addEventListener("change", (event) => {
  if (event.target.id === "fifaTvCardPosterFile") {
    uploadFifaTvCardPoster(event.target.files?.[0]);
    event.target.value = "";
  }
});
document.getElementById("fifaTvList")?.addEventListener("click", (event) => {
  const tryBtn = event.target.closest("[data-fifa-tv-try]");
  if (tryBtn) previewFifaTvChannel(tryBtn.dataset.fifaTvTry);
});
document.getElementById("fifaTvList")?.addEventListener("change", async (event) => {
  const toggle = event.target.closest("[data-fifa-tv-toggle]");
  if (!toggle) return;
  if (fifaTvState.busy) { toggle.checked = !toggle.checked; return; }
  const channel = fifaTvState.channels.find((ch) => ch.url === toggle.dataset.fifaTvToggle);
  if (!channel) return;
  if (!toggle.checked) { setFifaTvStatus("O'chirilmoqda…"); saveFifaTv(null); return; }
  // Yoqishdan oldin oqimni sinaymiz — ishlamaydigan kanal foydalanuvchilarga chiqmasin.
  fifaTvState.busy = true;
  setFifaTvStatus(`«${channel.name}» tekshirilmoqda… (15 soniyagacha)`);
  const works = await probeFifaTvStream(channel.url);
  fifaTvState.busy = false;
  if (!works) {
    toggle.checked = false;
    setFifaTvStatus(`«${channel.name}» ishlamayapti — oqim o'chgan, geobloklangan yoki maxsus header talab qiladi. Boshqa kanalni tanlang.`, "error");
    return;
  }
  // Faqat bitta kanal: yoqilgani boshqasini avtomatik o'chiradi.
  setFifaTvStatus(`«${channel.name}» yoqilmoqda…`);
  // Boshqa kanalga (masalan zaxira oqimga) o'tilsa ham kartadagi sarlavha va poster saqlanib qoladi.
  saveFifaTv({ id: channel.tvgId || channel.url, name: channel.name, url: channel.url, logo: channel.logo, group: channel.group, title: fifaTvState.active?.title || "", poster: fifaTvState.active?.poster || "" });
});