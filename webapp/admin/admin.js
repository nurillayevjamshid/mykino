// Admin Panel JavaScript - Movies, Required channels, Subscribers

// Data storage
let movies = [];
let filteredMovies = [];
let currentSearchQuery = '';
let selectedPosterDataUrl = '';

let requiredChannels = [];
let usersList = [];
let filteredUsers = [];
let userSearchQuery = '';

const SECTION_TITLES = {
  movies: 'Kinolar',
  subscription: 'Majburiy obuna',
  music: 'Musiqa',
  users: 'Obunachilar',
};

// Modal kategoriyalari uchun: tanlangan + mavjudlar ro'yxati
const selectedCategories = new Set();
let availableCategories = [];

// API base URL
const API_URL = '/api';
const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;
const POSTER_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
    const response = await fetch(`${API_URL}/movies`);
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

// Theme management - Light mode as default
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
  applyTheme(savedTheme);
  await fetchMovies();
  bindEvents();
  createSidebarOverlay();
}

function switchSection(name) {
  const sections = {
    movies: 'moviesSection',
    subscription: 'subscriptionSection',
    music: 'musicSection',
    users: 'usersSection',
  };
  const targetId = sections[name];
  if (!targetId) return;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === name);
  });
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.toggle('active', section.id === targetId);
  });

  const title = document.getElementById('pageTitle');
  if (title) title.textContent = SECTION_TITLES[name] || 'Admin';

  if (name === 'subscription') fetchRequiredChannels();
  if (name === 'users') fetchUsers();
  if (name === 'music') fetchMusic();

  if (window.innerWidth <= 768) {
    document.querySelector('.sidebar')?.classList.remove('open');
    document.getElementById('menuToggle')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  }
}

// ------------- Required channels -------------
async function fetchRequiredChannels() {
  const tbody = document.getElementById('channelsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Kanallar yuklanmoqda...</p>
          </div>
        </td>
      </tr>
    `;
  }

  try {
    const response = await fetch(`${API_URL}/required-channels`);
    if (!response.ok) throw new Error(`Server xatolik: ${response.status}`);
    const data = await response.json();
    requiredChannels = Array.isArray(data.channels) ? data.channels : [];
    renderRequiredChannels();
  } catch (error) {
    console.error('Error fetching channels:', error);
    requiredChannels = [];
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state error-state">
              <h3>Kanallarni yuklashda xatolik!</h3>
              <p>${escapeHtml(error.message)}</p>
              <button class="btn btn-primary" onclick="fetchRequiredChannels()" style="margin-top: 12px;">Qayta urinish</button>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function renderRequiredChannels() {
  const tbody = document.getElementById('channelsTableBody');
  if (!tbody) return;

  if (requiredChannels.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <h3>Majburiy obuna kanali hozircha yo'q</h3>
            <p>Yuqoridagi formadan kanal qo'shing.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = requiredChannels.map(ch => `
    <tr>
      <td><strong>${escapeHtml(ch.title || ch.username || '-')}</strong></td>
      <td>${ch.username ? '@' + escapeHtml(ch.username) : '-'}</td>
      <td>${escapeHtml(ch.id || '-')}</td>
      <td>${ch.inviteUrl ? `<a href="${escapeHtml(ch.inviteUrl)}" target="_blank" rel="noopener">${escapeHtml(ch.inviteUrl)}</a>` : '-'}</td>
      <td>
        <div class="actions">
          <button class="btn-icon delete" data-action="delete-channel"
            data-username="${escapeHtml(ch.username || '')}"
            data-id="${escapeHtml(ch.id || '')}"
            title="O'chirish">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function addRequiredChannel(event) {
  event.preventDefault();
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"]');

  const payload = {
    username: document.getElementById('channelUsername').value.trim().replace(/^@/, ''),
    title: document.getElementById('channelTitle').value.trim(),
    id: document.getElementById('channelChatId').value.trim(),
    inviteUrl: document.getElementById('channelInviteUrl').value.trim(),
  };

  if (!payload.username && !payload.id) {
    showNotification('Username yoki kanal ID kerak.', 'error');
    return;
  }

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saqlanmoqda...';
    }
    const response = await fetch(`${API_URL}/required-channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Kanal qo\'shilmadi.');

    requiredChannels = Array.isArray(result.channels) ? result.channels : requiredChannels;
    renderRequiredChannels();
    form.reset();
    showNotification('Kanal qo\'shildi.');
  } catch (error) {
    console.error('Add channel error:', error);
    showNotification('Xatolik: ' + error.message, 'error');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = '+ Kanal qo\'shish';
    }
  }
}

async function deleteRequiredChannel(username, chatId) {
  if (!confirm('Ushbu kanalni majburiy obuna ro\'yxatidan o\'chirasizmi?')) return;

  try {
    const response = await fetch(`${API_URL}/required-channels`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, id: chatId }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'O\'chirishda xatolik.');
    requiredChannels = Array.isArray(result.channels) ? result.channels : [];
    renderRequiredChannels();
    showNotification('Kanal o\'chirildi.');
  } catch (error) {
    console.error('Delete channel error:', error);
    showNotification('Xatolik: ' + error.message, 'error');
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

  // Required channels: add form
  document.getElementById('channelForm')?.addEventListener('submit', addRequiredChannel);

  // Required channels: delete via delegation
  document.getElementById('channelsTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete-channel"]');
    if (!btn) return;
    deleteRequiredChannel(btn.dataset.username || '', btn.dataset.id || '');
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

  // Modal closes
  document.getElementById('closeMovieModal')?.addEventListener('click', closeMovieModal);
  document.getElementById('cancelMovie')?.addEventListener('click', closeMovieModal);

  // Forms
  document.getElementById('movieForm')?.addEventListener('submit', handleMovieSubmit);
  document.getElementById('movieDescription')?.addEventListener('input', updateDescriptionCounter);

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

  document.getElementById('movieShowInHeader')?.addEventListener('change', (e) => {
    const group = document.getElementById('headerImageGroup');
    if (group) group.style.display = e.target.checked ? 'block' : 'none';
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('Tizimdan chiqishni xohlaysizmi?')) {
      localStorage.removeItem('adminAuth');
      window.location.reload();
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
  const sectionHeader = document.querySelector('#moviesSection .section-header h2');
  if (sectionHeader) {
    sectionHeader.textContent = `Kinolar ro'yxati (${movies.length})`;
  }

  tbody.innerHTML = moviesToRender.map(movie => `
    <tr data-id="${escapeHtml(movie.id)}">
      <td>
        <img src="${escapeHtml(movie.poster || 'https://via.placeholder.com/50x70/1a1f2e/ffc73a?text=No+Image')}"
             alt="${escapeHtml(movie.name)}" class="movie-poster" onerror="this.src='https://via.placeholder.com/50x70/1a1f2e/ffc73a?text=No+Image'">
      </td>
      <td>
        ${movie.headerImage ? `
          <img src="${escapeHtml(movie.headerImage)}" alt="Header" class="movie-header-preview" style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">
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

  selectedPosterDataUrl = '';
  if (posterFileInput) posterFileInput.value = '';

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
  const headerImageInput = document.getElementById('movieHeaderImage');
  if (headerImageInput) headerImageInput.value = movie.headerImage || '';

  updateDescriptionCounter();
  modal.classList.add('active');
}

function updatePosterPreview(url) {
  const img = document.getElementById('posterPreviewImg');
  const uploadArea = document.getElementById('posterUploadArea');
  if (!img || !uploadArea) return;

  if (url) {
    img.src = url;
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

        const TARGET_WIDTH = 600;
        const TARGET_HEIGHT = 900;

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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (compressedDataUrl.length > 25000) {
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        } else {
          resolve(compressedDataUrl);
        }
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
  document.getElementById('movieModal')?.classList.remove('active');
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
  const movieData = {
    name: document.getElementById('movieName').value.trim(),
    category: categoryString,
    rating: parseFloat(document.getElementById('movieRating').value) || 0,
    hd: document.getElementById('movieHd').value === 'true',
    description: document.getElementById('movieDescription').value,
    posterImage: selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim(),
    showInHeader: document.getElementById('movieShowInHeader').checked,
    headerImage: document.getElementById('movieHeaderImage').value.trim()
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
    if (finalPoster && (!currentMovie || finalPoster !== currentMovie.poster)) {
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

// Check Auth
function checkAuth() {
  const auth = localStorage.getItem('adminAuth');
  if (!auth) {
    const password = prompt('Admin panel parolini kiriting:');
    if (password === 'admin123') {
      localStorage.setItem('adminAuth', 'true');
    } else {
      alert('Noto\'g\'ri parol!');
      window.location.href = '/';
    }
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

// Initialize
checkAuth();
init();

// Expose for inline handlers / retry buttons
window.fetchMovies = fetchMovies;
window.editMovie = editMovie;
window.fetchRequiredChannels = fetchRequiredChannels;
window.fetchUsers = fetchUsers;

// ===== Musiqa =====
const MUSIC_LOCAL_KEY = 'kino_admin_music_v1';
let musicTracks = [];
let musicSearchQueryAdmin = '';

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
  let seed = [];
  try {
    const res = await fetch('/api/music');
    if (res.ok) {
      const json = await res.json();
      seed = Array.isArray(json.tracks) ? json.tracks : [];
    }
  } catch (_) {}
  const local = readLocalMusic();
  musicTracks = dedupeMusic([...seed, ...local]);
  renderMusicTable();
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
      <td><span class="badge">${escapeHtml(t.category || 'Boshqa')}</span></td>
      <td><code>${escapeHtml(t.youtubeId)}</code></td>
      <td>
        <a class="btn btn-secondary" href="https://www.youtube.com/watch?v=${escapeHtml(t.youtubeId)}" target="_blank" rel="noopener">Ochish</a>
        <button class="btn btn-danger" data-music-delete="${escapeHtml(t.youtubeId)}|${escapeHtml(t.title)}|${escapeHtml(t.artist)}">O'chirish</button>
      </td>
    </tr>
  `).join('');
}

async function addMusicTrack(payload) {
  const local = readLocalMusic();
  const next = dedupeMusic([...local, payload]);
  writeLocalMusic(next);
  try {
    await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ track: payload }),
    });
  } catch (_) {}
  await fetchMusic();
}

function deleteMusicTrack(youtubeId, title, artist) {
  const key = `${title.toLowerCase()}|${artist.toLowerCase()}|${youtubeId}`;
  const local = readLocalMusic().filter(t => `${(t.title||'').toLowerCase()}|${(t.artist||'').toLowerCase()}|${t.youtubeId}` !== key);
  writeLocalMusic(local);
  musicTracks = musicTracks.filter(t => `${t.title.toLowerCase()}|${t.artist.toLowerCase()}|${t.youtubeId}` !== key);
  renderMusicTable();
  showNotification("Qo'shiq olib tashlandi (faqat brauzer xotirasidan).");
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
  const category = document.getElementById('musicCategory').value.trim() || 'Boshqa';
  const link = document.getElementById('musicLink').value.trim();
  const youtubeId = extractYoutubeId(link);
  const hint = document.getElementById('musicLinkHint');
  if (!youtubeId) {
    if (hint) { hint.textContent = "YouTube link noto'g'ri."; hint.style.color = '#ff6b6b'; }
    return;
  }
  if (hint) { hint.textContent = `Video ID: ${youtubeId}`; hint.style.color = ''; }
  addMusicTrack({ title, artist, category, youtubeId });
  e.target.reset();
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
  const btn = e.target.closest('[data-music-delete]');
  if (!btn) return;
  const [youtubeId, title, artist] = btn.dataset.musicDelete.split('|');
  if (confirm(`O'chirilsinmi: ${title} — ${artist}?`)) deleteMusicTrack(youtubeId, title, artist);
});

window.fetchMusic = fetchMusic;
