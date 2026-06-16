// Admin Panel JavaScript - Movies, Subscribers

// Global fetch monkey-patching: inject Telegram initData + always send the
// HttpOnly admin session cookie (credentials: include). Legacy plaintext
// password header is only sent if an older client left one behind, until the
// next successful adminLogin() clears it.
(function() {
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    options = options || {};
    const urlStr = String(url);
    const isApi = urlStr.startsWith('/api/') || (window.location.origin && urlStr.startsWith(window.location.origin + '/api/'));
    if (isApi) {
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
    }
    return originalFetch(url, options);
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
  fifaLive: 'FIFA Jonli',
};

// Modal kategoriyalari uchun: tanlangan + mavjudlar ro'yxati
const selectedCategories = new Set();
let availableCategories = [];

// API base URL
const API_URL = '/api';
const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;
const POSTER_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const POSTER_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="50" height="70" viewBox="0 0 50 70"><rect width="50" height="70" fill="#1a1f2e"/><text x="25" y="38" text-anchor="middle" font-family="Arial" font-size="9" fill="#ffc73a">No Image</text></svg>');

// Eski r2.dev bepul domeni ko'p so'rovda 403 (throttle) qaytaradi va Vercel
// proxy ham r2.dev'ni o'qiydi -> admin'da ko'p rasm ko'rinmay qolardi.
// Endi custom Cloudflare domen (r2.myplaylist.uz) ulangan — DNS faqat o'zgaradi,
// rasm o'sha R2 ob'ekti, lekin Cloudflare edge keshlaydi va throttle yo'q.
const R2_OLD_HOST = 'pub-42c7619e0f49402bb099364c0b589eca.r2.dev';
const R2_NEW_HOST = 'r2.myplaylist.uz';
function proxiedPoster(url) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (u.includes(R2_OLD_HOST)) return u.split(R2_OLD_HOST).join(R2_NEW_HOST);
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
  return {
    id: String(movie.id || movie.fileId || movie.driveFileId || ''),
    name: movie.title || movie.fileName || 'Kino',
    category: movie.genre || movie.category || 'Kino',
    rating: Number(movie.rating || 0),
    hd: String(movie.quality || 'HD').toUpperCase() !== 'SD',
    poster: movie.posterImage || movie.poster || movie.thumbnail || '',
    headerImage: movie.headerImage || movie.heroPoster || movie.headerPoster || movie.heroImage || '',
    showInHeader: Boolean(movie.showInHeader || movie.heroFeatured),
    description: movie.description || '',
    year: movie.year || '',
    code: movie.code || '',
    quality: movie.quality || 'HD'
  };
}

// Fetch movies from API
async function fetchMovies() {
  const tbody = document.getElementById('moviesTableBody');
  if (tbody) {
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
    const response = await fetch(`${API_URL}/movies?t=${Date.now()}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Server xatolik: ${response.status}`);
    }
    const data = await response.json();

    movies = data.map(normalizeMovieFromApi).filter(movie => movie.id);
    filteredMovies = [...movies];

    renderMovies();
    syncAvailableCategories();
  } catch (error) {
    console.error('Error fetching movies:', error);
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
              <button class="btn btn-primary" onclick="fetchMovies()" style="margin-top: 12px;">Qayta urinish</button>
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

function applyTelegramTheme() {
  if (!tg || !tg.themeParams) return;
  const tp = tg.themeParams;
  const root = document.documentElement;
  const set = (cssVar, val) => { if (val) root.style.setProperty(cssVar, val); };
  set('--page-bg', tp.secondary_bg_color || tp.bg_color);
  set('--bg-dark', tp.secondary_bg_color || tp.bg_color);
  set('--bg-card', tp.bg_color);
  set('--bg-sidebar', tp.bg_color);
  set('--bg-shell', tp.bg_color);
  set('--bg-elevated', tp.secondary_bg_color || tp.bg_color);
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
  if (tg) {
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
  if (savedSection && savedSection !== 'movies') switchSection(savedSection);
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
    categories: 'categoriesSection',
    users: 'usersSection',
    ad: 'adSection',
    fifaLive: 'fifaLiveSection',
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
  if (name === 'categories') fetchCategories();
  if (name === 'ad') { loadAdSettings(); loadPreRollSettings(); loadPreRollDriveVideos(); }
  if (name === 'fifaLive') { loadFifaLiveMatch(); }

  if (window.innerWidth <= 768) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('menuToggle')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }
}

// ------------- Subscribers -------------
function normalizeUser(record) {
  return {
    telegram_id: record.telegram_id || record.id || record.telegramId || '',
    username: record.username || '',
    first_name: record.first_name || record.firstName || record.firstSeenName || '',
    started_at: record.started_at || (record.firstSeenAt ? String(record.firstSeenAt).slice(0, 10) : ''),
  };
}

async function fetchUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Obunachilar yuklanmoqda...</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/users`);
    if (!response.ok) throw new Error(`Server xatolik: ${response.status}`);
    const data = await response.json();
    const list = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : []);
    usersList = list.map(normalizeUser);
    filteredUsers = [...usersList];
    renderUsers();
  } catch (error) {
    console.error('Error fetching users:', error);
    usersList = [];
    filteredUsers = [];
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state error-state">
              <h3>Obunachilarni yuklashda xatolik!</h3>
              <p>${escapeHtml(error.message)}</p>
              <button class="btn btn-primary" onclick="fetchUsers()" style="margin-top: 12px;">Qayta urinish</button>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function filterUsers(query) {
  userSearchQuery = String(query || '').toLowerCase().trim();
  if (!userSearchQuery) {
    filteredUsers = [...usersList];
  } else {
    filteredUsers = usersList.filter(u => {
      const haystack = [u.first_name, u.username, String(u.telegram_id), u.started_at].join(' ').toLowerCase();
      return haystack.includes(userSearchQuery);
    });
  }
  renderUsers();
}

function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const list = userSearchQuery ? filteredUsers : usersList;

  const sectionHeader = document.querySelector('#usersSection .section-header h2');
  if (sectionHeader) {
    sectionHeader.textContent = `Obunachilar ro'yxati (${usersList.length})`;
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <h3>${userSearchQuery ? 'Qidiruv natijasi yo\'q' : 'Obunachilar hali yo\'q'}</h3>
            <p>${userSearchQuery ? `"${escapeHtml(userSearchQuery)}" bo'yicha topilmadi` : 'Foydalanuvchilar /start bosishi bilan bu yerda ko\'rinadi.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((user, index) => `
    <tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(user.first_name || '-')}</strong></td>
      <td>${user.username ? '@' + escapeHtml(user.username) : '-'}</td>
      <td><code>${escapeHtml(String(user.telegram_id || '-'))}</code></td>
      <td>${escapeHtml(user.started_at || '-')}</td>
    </tr>
  `).join('');
}

// Create sidebar overlay for mobile
function createSidebarOverlay() {
  if (document.getElementById('sidebarOverlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  overlay.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    menuToggle?.classList.remove('active');
    overlay.classList.remove('active');
  });
  document.body.appendChild(overlay);
}

// Bind Events
function bindEvents() {
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
  document.getElementById('movieSearchInput')?.addEventListener('input', (e) => {
    filterMovies(e.target.value);
  });

  // Refresh button
  document.getElementById('refreshMoviesBtn')?.addEventListener('click', async () => {
    await fetchMovies();
    showNotification('Ro\'yxat yangilandi.');
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
  document.getElementById('userSearchInput')?.addEventListener('input', (e) => {
    filterUsers(e.target.value);
  });
  document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
    await fetchUsers();
    showNotification('Ro\'yxat yangilandi.');
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
          <p class="form-hint" style="margin:0 0 12px;">Quyidagi <strong>${onlyKino.length}</strong> ta kinoda faqat "Kino" placeholder kategoriya turibdi — haqiqiy kategoriya tayinlash kerak.</p>
          <ul class="kino-category-list">
            ${onlyKino.map(m => `
              <li>
                <img src="${escapeHtml(m.poster ? proxiedPoster(m.poster) : POSTER_PLACEHOLDER)}" alt="" style="width:36px;height:48px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="retryPoster(this)">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(m.name)}</div>
                  <div class="kc-code">${escapeHtml(m.code || m.id)}</div>
                </div>
                <button type="button" class="btn btn-secondary" data-edit-kino-id="${escapeHtml(m.id)}" style="padding:6px 10px;font-size:12px;">Tahrirlash</button>
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

  // Ad tabs (Mini app reklama / Pre-roll video)
  document.querySelectorAll('.ad-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdTab(tab.dataset.adTab));
  });

  // Series search + refresh
  document.getElementById('seriesSearchInput')?.addEventListener('input', (e) => {
    filterSeries(e.target.value);
  });
  document.getElementById('refreshSeriesBtn')?.addEventListener('click', async () => {
    await fetchSeries();
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

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });
}

// Filter movies based on search query
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

  renderMovies();
}

// Render Movies
function renderMovies() {
  const tbody = document.getElementById('moviesTableBody');
  if (!tbody) return;

  const moviesToRender = currentSearchQuery ? filteredMovies : movies;

  if (moviesToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
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

  tbody.innerHTML = moviesToRender.map(movie => `
    <tr data-id="${escapeHtml(movie.id)}">
      <td>
        <img src="${escapeHtml(movie.poster ? proxiedPoster(movie.poster) : POSTER_PLACEHOLDER)}"
             alt="${escapeHtml(movie.name)}" class="movie-poster" loading="lazy" decoding="async" onerror="retryPoster(this)">
      </td>
      <td>
        ${movie.headerImage ? `
          <img src="${escapeHtml(proxiedPoster(movie.headerImage))}" alt="Header" class="movie-header-preview" loading="lazy" decoding="async" style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);" onerror="this.style.display='none'">
        ` : '<span style="color:var(--text-muted); font-size: 11px;">Yo\'q</span>'}
      </td>
      <td><strong>${escapeHtml(movie.name)}</strong><br><small style="color:var(--text-muted)">${escapeHtml(movie.code || '')}</small></td>
      <td>${escapeHtml(movie.year || '-')}</td>
      <td>${escapeHtml(movie.category || '-')}</td>
      <td>
        <span class="rating">⭐ ${movie.rating ? movie.rating.toFixed(1) : '0.0'}</span>
      </td>
      <td>
        <span class="badge ${movie.hd ? 'badge-hd' : 'badge-sd'}">
          ${movie.hd ? 'HD' : 'SD'}
        </span>
      </td>
      <td>
        <div class="actions">
          <button class="btn-icon edit" data-action="edit" data-movie-id="${escapeHtml(movie.id)}" title="Tahrirlash">✏️</button>
        </div>
      </td>
    </tr>
  `).join('');
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
    modal.classList.remove('active');
    tgPopBack();
  }
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

    if (!currentMovie || movieData.showInHeader !== Boolean(currentMovie.showInHeader)) {
      updatePayload.showInHeader = movieData.showInHeader;
    }
    if (!currentMovie || hasMovieFieldChanged(movieData.headerImage, currentMovie.headerImage)) {
      updatePayload.headerImage = movieData.headerImage;
    }

    if (Object.keys(updatePayload).length === 1) {
      showNotification('O\'zgarish yo\'q.');
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saqlanmoqda...';
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
          if (pushResultEl) pushResultEl.innerHTML = '<span style="color:#888;">📨 Push yuborilmoqda...</span>';
          try {
            await sendMoviePush(id, movieData, finalPoster, result.movie);
            if (pushResultEl) pushResultEl.innerHTML = '<span style="color:#16a34a;">✅ Push yuborildi.</span>';
            showNotification('Kino yangilandi va push yuborildi! ✅');
          } catch (err) {
            if (pushResultEl) pushResultEl.innerHTML = `<span style="color:#dc2626;">❌ Push xato: ${err.message}</span>`;
            showNotification('Kino yangilandi, lekin push yuborilmadi: ' + err.message, 'error');
          }
          await fetchMovies();
          return;
        }
        closeMovieModal();
        showNotification('Kino bazada yangilandi! ✅');
        await fetchMovies();
      } else {
        showNotification('Xatolik: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showNotification('Serverga ulanishda xatolik!', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Saqlash';
      }
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
    tab.style.borderBottomColor = active ? 'var(--primary,#3b82f6)' : 'transparent';
    tab.style.color = active ? 'var(--text,#111)' : 'var(--text-muted,#666)';
  });
  document.querySelectorAll('.movie-tabpanel').forEach(panel => {
    panel.hidden = panel.dataset.movieTabpanel !== name;
  });
  if (name === 'series') {
    closeSeriesEditor();
    if (!seriesLoaded) fetchSeries();
  }
}

function switchAdTab(name) {
  if (!name) return;
  document.querySelectorAll('.ad-tab').forEach(tab => {
    const active = tab.dataset.adTab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    tab.style.borderBottomColor = active ? 'var(--primary,#3b82f6)' : 'transparent';
    tab.style.color = active ? 'var(--text,#111)' : 'var(--text-muted,#666)';
  });
  document.querySelectorAll('.ad-tab-item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.adTabItem === name);
  });
  document.querySelectorAll('.ad-tabpanel').forEach(panel => {
    panel.hidden = panel.dataset.adTabpanel !== name;
  });
  if (name === 'broadcast') initBroadcastSection();
  if (name === 'fifalive') loadFifaLiveSettings();
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

async function fetchSeries() {
  const grid = document.getElementById('seriesCardGrid');
  if (grid) {
    grid.innerHTML = `
      <div class="loading-state" style="grid-column:1/-1;">
        <div class="loading-spinner"></div>
        <p>Seriallar yuklanmoqda...</p>
      </div>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/series?t=${Date.now()}`);
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || `Server xatolik: ${response.status}`);
    }
    const data = await response.json();
    seriesList = (Array.isArray(data) ? data : []).map(normalizeSeriesFromApi).filter(s => s.id);
    filteredSeries = [...seriesList];
    seriesLoaded = true;
    renderSeries();
  } catch (error) {
    console.error('Error fetching series:', error);
    seriesList = [];
    filteredSeries = [];
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state error-state" style="grid-column:1/-1;">
          <h3>Seriallarni yuklashda xatolik!</h3>
          <p>${escapeHtml(error.message)}</p>
          <button class="btn btn-primary" onclick="fetchSeries()" style="margin-top:12px;">Qayta urinish</button>
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
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>${seriesSearchQuery ? 'Qidiruv natijasi yo\'q' : 'Hozircha seriallar yo\'q'}</h3>
        <p>${seriesSearchQuery
          ? `"${escapeHtml(seriesSearchQuery)}" bo'yicha topilmadi`
          : 'Google Drive\'dagi "seriallar" papkasiga serial papkalarini qo\'shing.'}</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(s => `
    <div class="series-card" data-series-id="${escapeHtml(s.id)}" title="Tahrirlash"
         style="cursor:pointer;border:1px solid var(--border,#e3e6ec);border-radius:14px;overflow:hidden;background:var(--surface-bg,#fff);">
      <div style="aspect-ratio:2/3;background:#1a1f2e center/cover no-repeat;background-image:url('${escapeHtml(s.poster || '')}');"></div>
      <div style="padding:10px 12px;">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.name)}</div>
        <div style="font-size:12px;color:var(--text-muted,#888);margin-top:3px;">${s.episodeCount} ta qism</div>
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
    wrap.innerHTML = `<p class="form-hint" style="padding:8px 2px;">Bu serialda hali qism (video fayl) yo'q.</p>`;
    return;
  }
  wrap.innerHTML = eps.map((ep, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border,#e3e6ec);border-radius:10px;background:var(--surface-bg,#fff);">
      <span style="flex:0 0 28px;width:28px;height:28px;border-radius:999px;background:var(--primary,#3b82f6);color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;">${i + 1}</span>
      <input type="text" class="form-input series-episode-input" data-ep-id="${escapeHtml(ep.id)}" data-default-title="${escapeHtml(ep.defaultTitle || '')}" value="${escapeHtml(ep.title || '')}" style="flex:1;margin:0;" placeholder="Qism nomi">
      <label style="display:inline-flex;align-items:center;gap:6px;margin:0;font-size:12px;color:var(--text-muted,#888);white-space:nowrap;">Fasl
        <input type="number" min="1" max="99" class="form-input series-episode-season" data-ep-id="${escapeHtml(ep.id)}" data-current-season="${escapeHtml(String(ep.season || 1))}" value="${escapeHtml(String(ep.season || 1))}" style="width:64px;margin:0;padding:6px 8px;text-align:center;">
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

  const listView = document.getElementById('seriesListAdminView');
  const editorView = document.getElementById('seriesEditorView');
  if (listView) listView.hidden = true;
  if (editorView) editorView.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeSeriesEditor() {
  const listView = document.getElementById('seriesListAdminView');
  const editorView = document.getElementById('seriesEditorView');
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

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saqlanmoqda...';
    }

    const response = await fetch(`${API_URL}/series-update`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.ok) {
      showNotification('Serial bazada yangilandi! ✅');
      await fetchSeries();
      closeSeriesEditor();
    } else {
      showNotification('Xatolik: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Series update error:', error);
    showNotification('Serverga ulanishda xatolik!', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Saqlash';
    }
  }
}

window.fetchSeries = fetchSeries;
window.editSeries = editSeries;

// Show Notification
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');

  const bgColor = type === 'error'
    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
    : 'linear-gradient(135deg, var(--primary), var(--primary-dark))';
  const textColor = type === 'error' ? '#fff' : '#0f131a';

  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: ${textColor};
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
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
    preview.innerHTML = '<div style="opacity:0.5;">Matn kiriting...</div>';
    return;
  }

  const textHtml = asHtml ? text.replace(/\n/g, '<br>') : escapeBroadcastHtml(text).replace(/\n/g, '<br>');
  const photoHtml = photo
    ? `<div style="margin-bottom:10px;border-radius:10px;overflow:hidden;"><img src="${escapeBroadcastHtml(photo)}" style="width:100%;display:block;max-height:240px;object-fit:cover;" onerror="this.style.display='none'"></div>`
    : '';
  const buttonHtml = (btnText && btnUrl)
    ? `<div style="margin-top:12px;"><div style="display:inline-block;padding:8px 16px;background:#3390ec;color:#fff;border-radius:6px;font-weight:500;font-size:13px;">${escapeBroadcastHtml(btnText)}</div></div>`
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
    resultEl.innerHTML = '<div style="color:#d33;padding:10px;background:#fee;border-radius:8px;">Matn yoki rasm kerak.</div>';
    return;
  }
  if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) {
    resultEl.innerHTML = '<div style="color:#d33;padding:10px;background:#fee;border-radius:8px;">Tugma uchun ham matn, ham URL kerak.</div>';
    return;
  }
  if (!confirm('Barcha obunachilarga yuborilsinmi? Bekor qilib bo\'lmaydi.')) return;

  const okSess = await window.ensureAdminSession('Admin parolini kiriting (xavfsizlik uchun):');
  if (!okSess) return;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Yuborilmoqda...';
  resultEl.innerHTML = '<div style="padding:10px;background:#eef5ff;border-radius:8px;">Yuborilmoqda, kuting...</div>';

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
      resultEl.innerHTML = `<div style="color:#d33;padding:10px;background:#fee;border-radius:8px;">Xato: ${escapeBroadcastHtml(data.error || 'Noma\'lum')}</div>`;
    } else {
      const errorList = Array.isArray(data.errors) && data.errors.length
        ? `<details style="margin-top:8px;"><summary>Xatolar (${data.errors.length})</summary><pre style="font-size:11px;max-height:200px;overflow:auto;">${escapeBroadcastHtml(JSON.stringify(data.errors, null, 2))}</pre></details>`
        : '';
      resultEl.innerHTML = `<div style="padding:12px;background:#e8f5e9;border-radius:8px;color:#1b5e20;">
        ✅ <strong>Tugadi.</strong> Yuborildi: <strong>${data.sent}</strong>, xato: <strong>${data.failed}</strong>, jami: ${data.total}. (${Math.round(data.elapsedMs / 100) / 10}s)
        ${errorList}
      </div>`;
    }
  } catch (error) {
    resultEl.innerHTML = `<div style="color:#d33;padding:10px;background:#fee;border-radius:8px;">Tarmoq xatosi: ${escapeBroadcastHtml(error.message)}</div>`;
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

async function fetchMusic() {
  const tbody = document.getElementById('musicTableBody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="loading-state"><div class="loading-spinner"></div><p>Yuklanmoqda...</p></div></td></tr>`;
  }
  let serverList = [];
  let storage = 'seed';
  try {
    const res = await fetch('/api/music', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      serverList = Array.isArray(json.tracks) ? json.tracks : [];
      storage = json.storage || 'seed';
    }
  } catch (_) {}
  musicTracks = dedupeMusic(serverList);
  renderMusicTable();
  renderMusicCategoryChips();
  const summary = document.getElementById('musicStorageSummary');
  if (summary) {
    const isPersistent = storage === 'redis' || storage === 'kv';
    summary.textContent = isPersistent
      ? `Persistent Redis ulangan · ${musicTracks.length} ta qo'shiq`
      : `Faqat seed (Redis sozlanmagan) · ${musicTracks.length} ta qo'shiq`;
    summary.style.color = isPersistent ? '#3ecf8e' : '#ffb84d';
  }
}

function renderMusicTable() {
  const tbody = document.getElementById('musicTableBody');
  if (!tbody) return;
  const q = musicSearchQueryAdmin.toLowerCase();
  const list = q
    ? musicTracks.filter(t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : musicTracks;
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>Qo'shiqlar yo'q</h3><p>Yangi qo'shiq qo'shing yoki qidiruvni tozalang.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(t => `
    <tr>
      <td><img src="https://i.ytimg.com/vi/${escapeHtml(t.youtubeId)}/mqdefault.jpg" alt="" style="width:60px;height:34px;object-fit:cover;border-radius:6px;"></td>
      <td><strong>${escapeHtml(t.title)}</strong></td>
      <td>${escapeHtml(t.artist)}</td>
      <td>${musicCatCellHtml(t)}</td>
      <td><code>${escapeHtml(t.youtubeId)}</code></td>
      <td>
        <a class="btn btn-secondary" href="https://www.youtube.com/watch?v=${escapeHtml(t.youtubeId)}" target="_blank" rel="noopener">Ochish</a>
        <button class="btn btn-danger" data-music-delete="${escapeHtml(t.youtubeId)}|${escapeHtml(t.title)}|${escapeHtml(t.artist)}">O'chirish</button>
      </td>
    </tr>
  `).join('');
}

async function addMusicTrack(payload) {
  try {
    const res = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: payload }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicTracks = dedupeMusic(Array.isArray(json.tracks) ? json.tracks : []);
    renderMusicTable();
    renderMusicCategoryChips();
    showNotification(`"${payload.title}" qo'shildi.`);
  } catch (err) {
    showNotification(`Qo'shishda xato: ${err.message}`, 'error');
  }
}

async function deleteMusicTrack(youtubeId, title, artist) {
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}|${youtubeId}`;
  try {
    const res = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', key }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    musicTracks = dedupeMusic(Array.isArray(json.tracks) ? json.tracks : []);
    renderMusicTable();
    showNotification("Qo'shiq o'chirildi.");
  } catch (err) {
    showNotification(`O'chirishda xato: ${err.message}`, 'error');
  }
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
    if (hint) { hint.textContent = "YouTube link noto'g'ri."; hint.style.color = '#ff6b6b'; }
    return;
  }
  const categories = [...musicFormCategories];
  const catHint = document.getElementById('musicCategoryHint');
  if (!categories.length) {
    if (catHint) { catHint.textContent = 'Kamida bitta kategoriya tanlang.'; catHint.style.color = '#ff6b6b'; }
    return;
  }
  if (catHint) { catHint.textContent = 'Kamida bitta kategoriya tanlang.'; catHint.style.color = ''; }
  if (hint) { hint.textContent = `Video ID: ${youtubeId}`; hint.style.color = ''; }
  addMusicTrack({ title, artist, categories, youtubeId });
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
  if (id) { hint.textContent = `Video ID: ${id}`; hint.style.color = ''; }
  else { hint.textContent = 'Video ID havoladan avtomatik ajratiladi.'; hint.style.color = ''; }
});

document.getElementById('musicExportBtn')?.addEventListener('click', exportMusicJSON);
document.getElementById('musicReloadBtn')?.addEventListener('click', fetchMusic);
document.getElementById('musicSearchAdminInput')?.addEventListener('input', (e) => {
  musicSearchQueryAdmin = e.target.value.trim();
  renderMusicTable();
});
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
  if (confirm(`O'chirilsinmi: ${title} — ${artist}?`)) deleteMusicTrack(youtubeId, title, artist);
});

window.fetchMusic = fetchMusic;

// ===== Qo'shiqchilar (artists) =====
let musicArtists = [];
let artistUploadedUrl = '';

function splitArtistsAdmin(name) {
  if (!name) return [];
  return String(name)
    .split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\band\b|x|×)\s*/i)
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
  const img = rec?.image ? `<img src="${escapeHtml(rec.image)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">` : '';
  const overlay = rec?.image ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.05) 0%,rgba(0,0,0,0.65) 100%);"></div>` : '';
  return `
    <button type="button" class="artist-card" data-artist-edit="${escapeHtml(name)}" style="position:relative;aspect-ratio:16/10;border-radius:14px;overflow:hidden;border:1px solid var(--border,#e3e6ec);background:#f1f3f7;padding:0;cursor:pointer;text-align:left;">
      ${img}${overlay}
      <div style="position:absolute;left:0;right:0;bottom:0;padding:10px 12px;color:${rec?.image ? '#fff' : '#111'};">
        <div style="font-weight:700;font-size:15px;line-height:1.1;">${escapeHtml(name)}</div>
        <div style="font-size:12px;opacity:0.85;margin-top:2px;">${escapeHtml(subtitle)}</div>
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
      <td><img src="https://i.ytimg.com/vi/${escapeHtml(t.youtubeId)}/mqdefault.jpg" alt="" style="width:60px;height:34px;object-fit:cover;border-radius:6px;"></td>
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
  const tab = e.target.closest('[data-music-tab]');
  if (tab) {
    document.querySelectorAll('.music-tab').forEach((t) => {
      const active = t === tab;
      t.classList.toggle('is-active', active);
      t.style.borderBottomColor = active ? 'var(--primary,#3b82f6)' : 'transparent';
      t.style.color = active ? 'var(--text,#111)' : 'var(--text-muted,#666)';
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
      ? `<img src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'yt-ch-fallback',textContent:${JSON.stringify(initial)}}));Object.assign(this.parentNode.querySelector('.yt-ch-fallback')?.style||{},{width:'64px',height:'64px',borderRadius:'50%',background:'#dbe1ea',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'700',fontSize:'24px',color:'#555',flexShrink:'0'});" style="width:64px;height:64px;border-radius:50%;object-fit:cover;background:#f1f3f7;flex-shrink:0;">`
      : `<div style="width:64px;height:64px;border-radius:50%;background:#dbe1ea;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px;color:#555;flex-shrink:0;">${escapeHtml(initial)}</div>`;
    return `
      <div class="yt-channel-card" style="border:1px solid var(--border,#e3e6ec);border-radius:14px;overflow:hidden;background:var(--card,#fff);padding:14px;">
        <div style="display:flex;gap:12px;align-items:center;">
          ${avatarHtml}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>
            <div style="font-size:12px;color:var(--text-muted,#666);margin-top:2px;">${videoCount} ta video${c.snapshot?.title && c.snapshot.title !== name ? ' · ' + escapeHtml(c.snapshot.title) : ''}${needsFix ? ' · <span style="color:#d97706;">⚠ YT ma\'lumoti yo\'q</span>' : ''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn btn-secondary" data-ytch-edit="${escapeHtml(c.channelId)}" style="flex:1;min-width:90px;">Tahrirlash</button>
          <button class="btn btn-secondary" data-ytch-refresh="${escapeHtml(c.channelId)}" style="flex:1;min-width:90px;">Yangilash</button>
          <button class="btn btn-danger" data-ytch-delete="${escapeHtml(c.channelId)}|${escapeHtml(name)}" style="flex:1;min-width:90px;">O'chirish</button>
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
  if (hint) { hint.textContent = "Yoki pastdagi URL maydoniga to'g'ridan-to'g'ri link kiriting."; hint.style.color = ''; }
}

async function fetchCategories() {
  const tbody = document.getElementById('categoriesTableBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4"><div class="loading-state"><div class="loading-spinner"></div><p>Yuklanmoqda...</p></div></td></tr>`;
  try {
    if (!movies.length) { try { await fetchMovies(); } catch (_) {} }
    const res = await fetch('/api/categories', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    categoriesList = Array.isArray(json.categories) ? json.categories : [];
    const movieCats = collectKnownCategories();
    const datalist = document.getElementById('categoryNameList');
    if (datalist) {
      datalist.innerHTML = movieCats.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
    }
    const summary = document.getElementById('categoriesStorageSummary');
    if (summary) {
      const ok = json.storage === 'redis';
      summary.textContent = ok
        ? `Redis ulangan · ${categoriesList.length} ta saqlangan, ${movieCats.length} ta kinolarda`
        : `Redis sozlanmagan · ${categoriesList.length} ta saqlangan`;
      summary.style.color = ok ? '#3ecf8e' : '#ffb84d';
    }
    renderCategoriesTable();
  } catch (err) {
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
      ? `<img src="${escapeHtml(c.image)}" alt="" style="width:60px;height:42px;object-fit:cover;border-radius:6px;">`
      : '<span style="color:var(--text-muted);font-size:11px;">Rasm yo\'q</span>';
    const statusBadge = c.source === 'movie'
      ? '<span class="badge" style="background:#fff3cd;color:#856404;">Kinolarda</span>'
      : c.source === 'saved'
        ? '<span class="badge" style="background:#d1e7dd;color:#0f5132;">Saqlangan</span>'
        : c.source === 'series'
          ? '<span class="badge" style="background:#e7d6ff;color:#5a2a99;">Seriallar</span>'
          : '<span class="badge" style="background:#cfe2ff;color:#084298;">Ikkalasi</span>';
    const editKey = c.id ? `data-cat-edit="${escapeHtml(c.id)}"` : `data-cat-attach="${escapeHtml(c.name)}"`;
    const editLabel = c.image ? 'Tahrirlash' : 'Rasm yuklash';
    const deleteBtn = c.id
      ? `<button class="btn btn-danger" data-cat-delete="${escapeHtml(c.id)}">O'chirish</button>`
      : '';
    return `
      <tr>
        <td>${imageCell}</td>
        <td><strong>${escapeHtml(c.name)}</strong> ${statusBadge}</td>
        <td><code>${escapeHtml(c.id || '—')}</code></td>
        <td>
          <button class="btn btn-secondary" ${editKey}>${editLabel}</button>
          ${deleteBtn}
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
    if (hint) { hint.textContent = 'Fayl 5MB dan katta.'; hint.style.color = '#ff6b6b'; }
    e.target.value = '';
    return;
  }
  try {
    if (hint) { hint.textContent = 'Yuklanmoqda...'; hint.style.color = ''; }
    let dataUrl = await readFileAsDataUrl(file);
    dataUrl = await compressImageDataUrl(dataUrl);
    const url = await uploadCategoryImage(dataUrl, (document.getElementById('categoryName').value || 'category').toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    categoryUploadedUrl = url;
    document.getElementById('categoryImageUrl').value = url;
    setCategoryPreview(url);
    if (hint) { hint.textContent = "Yuklandi ✅"; hint.style.color = '#3ecf8e'; }
  } catch (err) {
    if (hint) { hint.textContent = `Yuklash xatosi: ${err.message}`; hint.style.color = '#ff6b6b'; }
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
  if (btn) { btn.disabled = true; btn.textContent = 'Saqlanmoqda...'; }
  try {
    await saveCategory({ name, image }, editId);
    showNotification(editId ? 'Kategoriya yangilandi ✅' : "Kategoriya qo'shildi ✅");
    resetCategoryForm();
  } catch (err) {
    showNotification(`Xato: ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = editId ? 'Saqlash' : "+ Qo'shish"; }
  }
});

document.getElementById('categoryResetBtn')?.addEventListener('click', resetCategoryForm);
document.getElementById('categoriesReloadBtn')?.addEventListener('click', fetchCategories);

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
    try {
      await deleteCategory(id);
      showNotification("Kategoriya o'chirildi.");
    } catch (err) {
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
  el.style.color = kind === 'error' ? '#dc3545' : (kind === 'ok' ? '#3ecf8e' : 'var(--text-muted)');
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
  saveAdSettings({ revertOnFail: true });
});
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
});

// ===== Pre-roll video reklama (kino oldidan) =====
function setPreRollStatus(msg, kind) {
  const el = document.getElementById('preRollAdSaveStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = kind === 'error' ? '#dc3545' : (kind === 'ok' ? '#3ecf8e' : 'var(--text-muted)');
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
  el.style.color = kind === 'error' ? '#dc3545' : (kind === 'ok' ? '#3ecf8e' : 'var(--text-muted)');
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
    container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:8px;">Drive'da "reklama" papkasi yoki video topilmadi. Drive katalog ildizida <strong>"reklama"</strong> nomli papka oching va u yerga mp4 yuklang, keyin "Yangilash"ni bosing.</div>`;
    return;
  }
  container.innerHTML = preRollAdVideos.map((v) => {
    const dur = formatDurationMs(v.durationMs);
    const size = formatBytes(v.size);
    return `
      <label class="preroll-video-item" data-id="${v.id}" style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;cursor:pointer;background:#fff;border:1px solid var(--border,#e3e6ec);transition:border-color .15s,background .15s;">
        <input type="radio" name="preRollAdVideoRadio" value="${v.id}" style="width:18px;height:18px;cursor:pointer;flex-shrink:0;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(v.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            ${dur ? `⏱ ${dur} · ` : ''}${size}${v.modifiedTime ? ` · ${new Date(v.modifiedTime).toLocaleDateString()}` : ''}
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

async function fetchPodcasts() {
  const grid = document.getElementById('podcastsListGrid');
  const summary = document.getElementById('podcastsStorageSummary');
  if (grid) grid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Kanallar yuklanmoqda...</p></div>';
  try {
    const r = await fetch(`${API_URL}/podcasts?t=${Date.now()}`);
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'Yuklab bo\'lmadi.');
    podcastChannels = Array.isArray(data.channels) ? data.channels : [];
    renderPodcasts();
    if (summary) summary.textContent = `${podcastChannels.length} ta kanal qo'shilgan.`;
  } catch (err) {
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
    const banner = s.banner ? `background:url('${escapeHtml(s.banner)}') center/cover no-repeat;` : 'background:linear-gradient(135deg,#3d4adf,#7c4ad4);';
    return `
      <div class="podcast-admin-card" style="border:1px solid var(--border,#e3e6ec);border-radius:14px;overflow:hidden;background:var(--card,#fff);">
        <div style="height:80px;${banner}"></div>
        <div style="display:flex;gap:12px;padding:14px;align-items:flex-start;margin-top:-30px;">
          <img src="${escapeHtml(s.avatar || '')}" alt="" style="width:56px;height:56px;border-radius:50%;border:3px solid var(--card,#fff);object-fit:cover;background:#eee;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:15px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(s.title || c.channelId)}</div>
            <div style="font-size:12px;color:var(--text-muted,#666);margin-top:2px;">${escapeHtml(s.handle || '')}</div>
            <div style="font-size:12px;color:var(--text-muted,#666);margin-top:4px;">${formatCount(s.subscriberCount)} obunachi · ${formatCount(s.videoCount)} video</div>
          </div>
        </div>
        <div style="padding:0 14px 14px;display:flex;flex-direction:column;gap:8px;">
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text-muted,#666);margin-bottom:4px;">Kategoriya (til)</div>
            <div class="pod-lang-row">
              ${['uz','ru','en'].map((l) => `<button type="button" class="pod-lang-mini${(c.lang || '') === l ? ' is-active' : ''}" data-pod-set-lang="${escapeHtml(c.channelId)}|${l}">${POD_LANG_LABEL[l]}</button>`).join('')}
            </div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;user-select:none;">
            <input type="checkbox" ${c.featured ? 'checked' : ''} data-pod-featured="${escapeHtml(c.channelId)}" style="width:18px;height:18px;accent-color:var(--primary,#3b82f6);cursor:pointer;">
            <span>Header sectionda ko'rsatish</span>
          </label>
          <div style="display:flex;gap:8px;">
            <a class="btn btn-secondary" href="https://www.youtube.com/channel/${escapeHtml(c.channelId)}" target="_blank" rel="noopener" style="flex:1;text-align:center;font-size:13px;padding:8px;">YouTube</a>
            <button class="btn btn-secondary" data-pod-refresh="${escapeHtml(c.channelId)}" style="font-size:13px;padding:8px 12px;">↻</button>
            <button class="btn btn-danger" data-pod-delete="${escapeHtml(c.channelId)}|${escapeHtml(s.title || c.channelId)}" style="font-size:13px;padding:8px 12px;">O'chirish</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function addPodcastChannel(input) {
  const btn = document.getElementById('podcastSubmitBtn');
  const hint = document.getElementById('podcastInputHint');
  if (btn) { btn.disabled = true; btn.textContent = 'Qo\'shilmoqda...'; }
  if (hint) { hint.textContent = 'YouTube\'dan ma\'lumot olinmoqda...'; hint.style.color = ''; }
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
    if (hint) { hint.textContent = `Qo'shildi: ${data.channel?.snapshot?.title || ''}`; hint.style.color = '#28a745'; }
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; hint.style.color = '#ff6b6b'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '+ Kanal qo\'shish'; }
  }
}

async function deletePodcastChannel(channelId, title) {
  if (!confirm(`O'chirilsinmi: ${title}?`)) return;
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
  } catch (err) {
    alert('Xato: ' + err.message);
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
    alert('Xato: ' + err.message);
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
      ? `<img src="${escapeHtml(e.image)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<span style="color:#999;font-size:12px;">Rasm yo'q</span>`;
    return `
      <div class="pod-lang-card" data-pod-lang-card="${k}" style="border:1px solid var(--border,#e3e6ec);border-radius:14px;padding:14px;background:var(--card,#fff);display:flex;flex-direction:column;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:54px;height:54px;border-radius:14px;overflow:hidden;background:#f1f3f7;display:flex;align-items:center;justify-content:center;flex:0 0 auto;" data-pod-lang-preview>${img}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#666);font-weight:700;">${k.toUpperCase()}</div>
            <input type="text" class="form-input" data-pod-lang-name value="${escapeHtml(e.name || '')}" placeholder="Nomi" style="margin-top:4px;">
          </div>
        </div>
        <label class="btn btn-secondary" style="font-size:13px;padding:8px 10px;text-align:center;cursor:pointer;">
          Rasm yuklash
          <input type="file" accept="image/*" data-pod-lang-file style="display:none;">
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
    if (hint) { hint.textContent = 'Yuklandi'; hint.style.color = ''; }
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; hint.style.color = '#ff6b6b'; }
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
      if (hint) { hint.textContent = 'Rasm yuklanmoqda...'; hint.style.color = ''; }
      const url = await uploadPodLangImage(fileInput.files[0]);
      const urlInput = card.querySelector('[data-pod-lang-url]');
      if (urlInput) urlInput.value = url;
      const preview = card.querySelector('[data-pod-lang-preview]');
      if (preview) preview.innerHTML = `<img src="${escapeHtml(url)}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
      if (hint) { hint.textContent = 'Rasm yuklandi. "Saqlash" tugmasini bosing.'; hint.style.color = '#28a745'; }
    } catch (err) {
      if (hint) { hint.textContent = 'Xato: ' + err.message; hint.style.color = '#ff6b6b'; }
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
      ? `<img src="${escapeHtml(val)}" alt="" style="width:100%;height:100%;object-fit:cover;">`
      : `<span style="color:#999;font-size:12px;">Rasm yo'q</span>`;
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
    if (hint) { hint.textContent = 'Saqlandi ✅'; hint.style.color = '#28a745'; }
    showNotification('Til kategoriyalari saqlandi');
  } catch (err) {
    if (hint) { hint.textContent = 'Xato: ' + err.message; hint.style.color = '#ff6b6b'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Saqlash'; }
  }
});

document.getElementById('podLangsReloadBtn')?.addEventListener('click', () => fetchPodLangs());

document.getElementById('podcastReloadBtn')?.addEventListener('click', () => fetchPodcasts());
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

// ===================== FIFA Jonli (promo card) =====================
let fifaLiveLoaded = false;
let fifaLiveUploadedUrl = '';

function setFifaLiveStatus(msg, kind) {
  const el = document.getElementById('fifaLiveSaveStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = kind === 'error' ? '#dc3545' : (kind === 'ok' ? '#3ecf8e' : 'var(--text-muted)');
}

function setFifaLivePreview(url) {
  const img = document.getElementById('fifaLiveImagePreview');
  const content = document.getElementById('fifaLiveUploadContent');
  if (!img || !content) return;
  if (url) {
    img.src = url;
    img.style.display = 'block';
    content.style.display = 'none';
  } else {
    img.src = '';
    img.style.display = 'none';
    content.style.display = '';
  }
}

function fifaLiveIsoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadFifaLiveMatch() {
  if (fifaLiveLoaded) return;
  try {
    const res = await fetch('/api/categories?type=fifa-live', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    const m = json.match || {};
    const coverEl = document.getElementById('fifaLiveCoverUrl');
    const titleEl = document.getElementById('fifaLiveTitle');
    const tgEl = document.getElementById('fifaLiveTelegramUrl');
    const startEl = document.getElementById('fifaLiveStartsAt');
    const liveEl = document.getElementById('fifaLiveIsLive');
    if (coverEl) coverEl.value = m.coverUrl || '';
    if (titleEl) titleEl.value = m.title || '';
    if (tgEl) tgEl.value = m.telegramUrl || '';
    if (startEl) startEl.value = fifaLiveIsoToLocalInput(m.startsAt);
    if (liveEl) liveEl.checked = Boolean(m.isLive);
    fifaLiveUploadedUrl = m.coverUrl || '';
    setFifaLivePreview(m.coverUrl || '');
    fifaLiveLoaded = true;
  } catch (err) {
    setFifaLiveStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
}

async function saveFifaLiveMatch() {
  const title = (document.getElementById('fifaLiveTitle')?.value || '').trim();
  const coverUrl = (document.getElementById('fifaLiveCoverUrl')?.value || fifaLiveUploadedUrl || '').trim();
  const telegramUrl = (document.getElementById('fifaLiveTelegramUrl')?.value || '').trim();
  const startsAtLocal = (document.getElementById('fifaLiveStartsAt')?.value || '').trim();
  const isLive = document.getElementById('fifaLiveIsLive')?.checked || false;

  if (!title) { setFifaLiveStatus("O'yin nomini kiriting.", 'error'); return; }
  if (!telegramUrl) { setFifaLiveStatus("OBS stream havolasini (.m3u8) kiriting.", 'error'); return; }

  const startsAt = startsAtLocal ? new Date(startsAtLocal).toISOString() : '';

  setFifaLiveStatus('Saqlanmoqda...');
  try {
    const res = await fetch('/api/categories?type=fifa-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, coverUrl, telegramUrl, startsAt, isLive }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    setFifaLiveStatus(isLive ? "Saqlandi. Card mini app'da JONLI badge bilan ko'rinadi." : 'Saqlandi.', 'ok');
  } catch (err) {
    setFifaLiveStatus(`Xato: ${err.message}`, 'error');
  }
}

async function deleteFifaLiveMatch() {
  if (!confirm("FIFA Jonli card ma'lumotlarini o'chirishni xohlaysizmi?")) return;
  setFifaLiveStatus("O'chirilmoqda...");
  try {
    const res = await fetch('/api/categories?type=fifa-live', { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    ['fifaLiveTitle', 'fifaLiveTelegramUrl', 'fifaLiveCoverUrl', 'fifaLiveStartsAt'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const liveEl = document.getElementById('fifaLiveIsLive'); if (liveEl) liveEl.checked = false;
    fifaLiveUploadedUrl = '';
    setFifaLivePreview('');
    setFifaLiveStatus("O'chirildi. Mini app'da card ko'rinmaydi.", 'ok');
  } catch (err) {
    setFifaLiveStatus(`Xato: ${err.message}`, 'error');
  }
}

document.getElementById('fifaLiveImageFile')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0]; if (!file) return;
  setFifaLiveStatus('Rasm yuklanmoqda...');
  try {
    const raw = await readFileAsDataUrl(file);
    const dataUrl = await compressImageDataUrl(raw, 1600, 900, 0.85);
    const url = await uploadCategoryImage(dataUrl, 'fifa-live-' + Date.now().toString(36));
    fifaLiveUploadedUrl = url;
    const urlEl = document.getElementById('fifaLiveCoverUrl');
    if (urlEl) urlEl.value = url;
    setFifaLivePreview(url);
    setFifaLiveStatus('Rasm yuklandi. Saqlashni unutmang.', 'ok');
  } catch (err) {
    setFifaLiveStatus(`Yuklashda xato: ${err.message}`, 'error');
  }
});

document.getElementById('fifaLiveCoverUrl')?.addEventListener('input', (e) => {
  const v = (e.target.value || '').trim();
  fifaLiveUploadedUrl = v;
  setFifaLivePreview(v);
});

document.getElementById('fifaLiveSaveBtn')?.addEventListener('click', saveFifaLiveMatch);
document.getElementById('fifaLiveDeleteBtn')?.addEventListener('click', deleteFifaLiveMatch);

