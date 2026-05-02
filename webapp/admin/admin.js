// Admin Panel JavaScript

// Data storage
let movies = [];
let categories = [];
let users = [];
let selectedPosterDataUrl = '';
let deleteTargetMovieId = '';

// API base URL
const API_URL = '/api';
const MOVIE_DESCRIPTION_MAX_LENGTH = 4000;

// Maximum file size in bytes (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const POSTER_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit for poster images

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
    headerCrop: movie.headerCrop || null,
    video: movie.streamUrl || movie.videoUrl || movie.telegramFileId || '',
    description: movie.description || '',
    year: movie.year || '',
    code: movie.code || '',
    sourceType: movie.sourceType || '',
    telegramUrl: movie.telegramPostUrl || movie.sourceUrl || movie.webViewLink || '',
    quality: movie.quality || 'HD'
  };
}

// Fetch movies from API
async function fetchMovies() {
  try {
    const response = await fetch(`${API_URL}/movies`);
    if (!response.ok) throw new Error('Failed to fetch movies');
    const data = await response.json();

    movies = data.map(normalizeMovieFromApi).filter(movie => movie.id);
    syncCategoriesFromMovies();

    renderMovies();
  } catch (error) {
    console.error('Error fetching movies:', error);
    showNotification('Kinolarni yuklashda xatolik!', 'error');
  }
}



// Load categories from localStorage or set defaults
function loadCategories() {
  const saved = localStorage.getItem('categories');
  if (saved) {
    categories = JSON.parse(saved);
  } else {
    categories = [
      { id: 1, name: "Action", icon: "🚀", count: 0 },
      { id: 2, name: "Comedy", icon: "😂", count: 0 },
      { id: 3, name: "Horror", icon: "💀", count: 0 },
      { id: 4, name: "Drama", icon: "🎬", count: 0 }
    ];
  }
  updateCategoryCounts();
}

// Update category counts based on movies
function updateCategoryCounts() {
  categories.forEach(cat => {
    cat.count = movies.filter(m => 
      String(m.category || '').toLowerCase().includes(String(cat.name || '').toLowerCase())
    ).length;
  });
  localStorage.setItem('categories', JSON.stringify(categories));
}

function syncCategoriesFromMovies() {
  const existing = new Map();
  for (const category of categories) {
    const name = String(category.name || '').trim();
    if (name) existing.set(name.toLowerCase(), { ...category, name });
  }

  for (const movie of movies) {
    const name = String(movie.category || 'Kino').trim();
    if (!name || existing.has(name.toLowerCase())) continue;
    existing.set(name.toLowerCase(), {
      id: name,
      name,
      icon: '🎬',
      count: 0
    });
  }

  categories = [...existing.values()];
  updateCategoryCounts();
}

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');
const themeToggle = document.getElementById('themeToggle');

// Section titles
const sectionTitles = {
  movies: 'Kinolar',
  categories: 'Kategoriyalar',
  subscribers: 'Obunachilar',
  settings: 'Sozlamalar'
};

// Theme management - Light mode as default
const savedTheme = localStorage.getItem('admin-theme') || 'light';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.setAttribute('data-theme', theme);
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
  applyTheme(savedTheme);
  loadCategories();
  await fetchMovies();
  await fetchUsers();
  await loadSplashSettings();
  renderCategories();
  updateCategorySelect();
  bindEvents();
  createSidebarOverlay();
}

// Fetch users from API
async function fetchUsers() {
  try {
    const response = await fetch(`${API_URL}/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    const data = await response.json();

    users = Array.isArray(data) ? data : [];
    renderUsers();
  } catch (error) {
    console.error('Error fetching users:', error);
    // Don't show notification on error, just leave empty
    users = [];
    renderUsers();
  }
}

// Create sidebar overlay for mobile
function createSidebarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebarOverlay';
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    menuToggle?.classList.remove('active');
    overlay.classList.remove('active');
  });
  document.body.appendChild(overlay);
}

// Bind Events
function bindEvents() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      switchSection(section);
    });
  });

  // Mobile menu toggle
  menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    menuToggle.classList.toggle('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
      overlay.classList.toggle('active');
    }
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
        menuToggle?.classList.remove('active');
        const overlay = document.getElementById('sidebarOverlay');
        if (overlay) overlay.classList.remove('active');
      }
    }
  });

  // Add Movie
  document.getElementById('addMovieBtn')?.addEventListener('click', () => {
    openMovieModal();
  });

  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme || 'dark';
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });

  // Table row actions - event delegation
  document.getElementById('moviesTableBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-icon');
    if (!btn) return;
    
    const movieId = btn.dataset.movieId;
    const action = btn.dataset.action;
    
    if (!movieId || !action) return;
    
    console.log(`Button clicked: ${action} for movie ${movieId}`);
    
    if (action === 'edit') {
      editMovie(movieId);
    } else if (action === 'delete') {
      deleteMovie(movieId);
    }
  });

  // Add Category
  document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
    openCategoryModal();
  });

  // Modal closes
  document.getElementById('closeMovieModal')?.addEventListener('click', closeMovieModal);
  document.getElementById('cancelMovie')?.addEventListener('click', closeMovieModal);
  document.getElementById('closeCategoryModal')?.addEventListener('click', closeCategoryModal);
  document.getElementById('cancelCategory')?.addEventListener('click', closeCategoryModal);
  document.getElementById('closeWatchedMoviesModal')?.addEventListener('click', closeWatchedMoviesModal);

  // Forms
  document.getElementById('movieForm')?.addEventListener('submit', handleMovieSubmit);
  document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);
  document.getElementById('movieDescription')?.addEventListener('input', updateDescriptionCounter);

  // Poster file upload
  document.getElementById('moviePosterFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      selectedPosterDataUrl = await readPosterFile(file);
      updatePosterPreview(selectedPosterDataUrl);
      // File tanlanganda URL inputni tozalash
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
      // URL kiritilganda File inputni tozalash
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
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Splash image settings
  document.getElementById('splashImageUrl')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    const preview = document.getElementById('splashPreview');
    const previewImg = document.getElementById('splashPreviewImg');
    if (url && previewImg) {
      previewImg.src = url;
      if (preview) preview.style.display = 'block';
    } else {
      if (preview) preview.style.display = 'none';
    }
  });

  document.getElementById('saveSplashBtn')?.addEventListener('click', saveSplashSettings);
}

// Switch Section
function switchSection(section) {
  // Update nav
  navItems.forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === section) {
      item.classList.add('active');
    }
  });

  // Update content
  contentSections.forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(section + 'Section')?.classList.add('active');

  // Update title
  pageTitle.textContent = sectionTitles[section];

  // Close mobile sidebar and overlay
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    menuToggle?.classList.remove('active');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('active');
  }
}

// Render Movies
function renderMovies() {
  const tbody = document.getElementById('moviesTableBody');
  if (!tbody) return;

  if (movies.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2.18"></rect>
              <line x1="7" y1="2" x2="7" y2="22"></line>
              <line x1="17" y1="2" x2="17" y2="22"></line>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="2" y1="7" x2="7" y2="7"></line>
              <line x1="2" y1="17" x2="7" y2="17"></line>
              <line x1="17" y1="17" x2="22" y2="17"></line>
              <line x1="17" y1="7" x2="22" y2="7"></line>
            </svg>
            <h3>Hozircha kinolar yo'q</h3>
            <p>Yangi kino qo'shish uchun "Yangi kino qo'shish" tugmasini bosing</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = movies.map(movie => `
    <tr data-id="${escapeHtml(movie.id)}">
      <td>
        <img src="${escapeHtml(movie.poster || 'https://via.placeholder.com/50x70/1a1f2e/ffc73a?text=No+Image')}" 
             alt="${escapeHtml(movie.name)}" class="movie-poster">
      </td>
      <td>
        ${movie.headerImage ? `
          <img src="${escapeHtml(movie.headerImage)}" alt="Header" class="movie-header-preview" style="width: 80px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border);">
        ` : '<span style="color:var(--text-muted); font-size: 11px;">Yo\'q</span>'}
      </td>
      <td><strong>${escapeHtml(movie.name)}</strong><br><small style="color:var(--text-muted)">${escapeHtml(movie.code || '')}</small></td>
      <td>${escapeHtml(movie.year || '-')}</td>
      <td>${escapeHtml(getCategoryName(movie.category))}</td>
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
          <button class="btn-icon edit" data-action="edit" data-movie-id="${escapeHtml(movie.id)}" title="Tahrirlash">
            ✏️
          </button>
          <button class="btn-icon delete" data-action="delete" data-movie-id="${escapeHtml(movie.id)}" title="O'chirish">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render Categories
function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;

  if (categories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        </svg>
        <h3>Hozircha kategoriyalar yo'q</h3>
        <p>Yangi kategoriya qo'shish uchun tugmani bosing</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = categories.map(cat => `
    <div class="category-card" data-id="${escapeHtml(cat.id)}">
      <div class="category-icon">${escapeHtml(cat.icon)}</div>
      <div class="category-name">${escapeHtml(cat.name)}</div>
      <div class="category-count">${cat.count} ta kino</div>
    </div>
  `).join('');
}

// Render Users (Subscribers)
function renderUsers() {
  const tbody = document.getElementById('subscribersTableBody');
  const countBadge = document.getElementById('subscribersCount');
  const sidebarCountBadge = document.getElementById('sidebarSubscribersCount');
  if (!tbody) return;

  // Update count badges
  if (countBadge) {
    countBadge.textContent = `${users.length} ta obunachi`;
  }
  if (sidebarCountBadge) {
    sidebarCountBadge.textContent = users.length;
  }

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h3>Hozircha obunachilar yo'q</h3>
            <p>Foydalanuvchilar botni ishlatganlarida shu yerda ko'rinadi</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }


  tbody.innerHTML = users.map(user => {
    const userId = String(user.id || '');
    const username = user.username || '';
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || '-';
    const phone = user.phone || '';
    const watchedMovies = user.watchedMovies || user.watched_movies || [];
    const watchedCount = watchedMovies.length;

    // Format date
    const lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).toLocaleString('uz-UZ') : '-';

    // Create username link if available
    const usernameDisplay = username
      ? `<a href="https://t.me/${escapeHtml(username)}" target="_blank" class="username-link">@${escapeHtml(username)}</a>`
      : '-';

    return `
    <tr data-user-id="${escapeHtml(userId)}">
      <td><small style="color:var(--text-muted)">${escapeHtml(userId)}</small></td>
      <td>${usernameDisplay}</td>
      <td><strong>${escapeHtml(fullName)}</strong></td>
      <td>${phone ? `<code>${escapeHtml(phone)}</code>` : '<span style="color:var(--text-muted)">-</span>'}</td>
      <td>
        <button class="btn-watched" onclick="showWatchedMovies('${escapeHtml(userId)}')" title="Ko'rgan kinolarni ko'rish">
          ${watchedCount} ta kino
        </button>
      </td>
      <td><small style="color:var(--text-muted)">${escapeHtml(lastSeen)}</small></td>
    </tr>
  `}).join('');
}


// Show Watched Movies Modal
window.showWatchedMovies = function(userId) {
  const user = users.find(u => u.id === userId || String(u.id) === String(userId));
  if (!user) return;

  const modal = document.getElementById('watchedMoviesModal');
  const title = document.getElementById('watchedMoviesTitle');
  const list = document.getElementById('watchedMoviesList');

  if (!modal || !title || !list) return;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${user.id}`;
  title.textContent = `${escapeHtml(fullName)} - Ko'rgan kinolar`;

  const watchedMovies = user.watchedMovies || [];

  if (watchedMovies.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18"></rect>
          <line x1="7" y1="2" x2="7" y2="22"></line>
          <line x1="17" y1="2" x2="17" y2="22"></line>
          <line x1="2" y1="12" x2="22" y2="12"></line>
        </svg>
        <h3>Hali kino ko'rmagan</h3>
        <p>Bu foydalanuvchi hali hech qanday kino ko'rmagan</p>
      </div>
    `;
  } else {
    list.innerHTML = watchedMovies.map(movie => `
      <div class="watched-movie-item">
        <img src="${escapeHtml(movie.poster || 'https://via.placeholder.com/60x90/1a1f2e/ffc73a?text=No+Image')}" alt="${escapeHtml(movie.title || 'Kino')}" class="watched-movie-poster">
        <div class="watched-movie-info">
          <h4>${escapeHtml(movie.title || 'Noma\'lum kino')}</h4>
          <p>${movie.year ? escapeHtml(String(movie.year)) : ''} ${movie.genre ? '· ' + escapeHtml(movie.genre) : ''}</p>
          <span class="badge ${movie.quality === 'HD' ? 'badge-hd' : 'badge-sd'}">${escapeHtml(movie.quality || 'HD')}</span>
        </div>
      </div>
    `).join('');
  }

  modal.classList.add('active');
}


// Close Watched Movies Modal
window.closeWatchedMoviesModal = function() {
  const modal = document.getElementById('watchedMoviesModal');
  if (modal) modal.classList.remove('active');
}

// Get Category Name
function getCategoryName(id) {
  const value = String(id || '').trim();
  const cat = categories.find(c => String(c.id) === value || c.name.toLowerCase() === value.toLowerCase());
  return cat ? cat.name : value;
}

// Open Movie Modal
function openMovieModal(movie = null) {
  const modal = document.getElementById('movieModal');
  const title = document.getElementById('movieModalTitle');
  const form = document.getElementById('movieForm');
  const posterFileInput = document.getElementById('moviePosterFile');
  updateCategorySelect(movie?.category || '');

  // Reset poster state
  selectedPosterDataUrl = '';
  if (posterFileInput) posterFileInput.value = '';

  if (movie) {
    title.textContent = 'Kino tahrirlash';
    document.getElementById('movieName').value = movie.name;
    document.getElementById('movieCategory').value = movie.category;
    document.getElementById('movieRating').value = movie.rating;
    document.getElementById('movieHd').value = movie.hd.toString();
    document.getElementById('movieDescription').value = movie.description || '';
    form.dataset.editingId = movie.id;

    const poster = movie.posterImage || movie.poster || '';
    if (poster && !poster.startsWith('data:image')) {
      document.getElementById('moviePosterUrl').value = poster;
    } else if (poster) {
      selectedPosterDataUrl = poster;
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
    if (headerImageInput) headerImageInput.value = headerImage;
  } else {
    title.textContent = 'Yangi kino q\'oshish';
    form.reset();
    delete form.dataset.editingId;
    updatePosterPreview('');
  }

  updateDescriptionCounter();
  modal.classList.add('active');
}

function updateHeaderImagePreview(url) {
  const img = document.getElementById('headerImagePreviewImg');
  const placeholder = document.getElementById('headerImagePlaceholder');
  if (!img || !placeholder) return;

  if (url) {
    img.src = url;
    img.hidden = false;
    placeholder.hidden = true;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    placeholder.hidden = false;
  }
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

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Rasm fayli ochilmadi.'));
    image.onload = () => resolve(image);
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file, errorMessage) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(errorMessage));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
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

        // Poster uchun optimal o'lchamlar (Metadata sig'ishi uchun)
        const TARGET_WIDTH = 600;
        const TARGET_HEIGHT = 900;

        let width = image.width;
        let height = image.height;

        // Proporsiyani saqlab qolgan holda kichraytirish
        if (width > TARGET_WIDTH || height > TARGET_HEIGHT) {
          const scale = Math.min(TARGET_WIDTH / width, TARGET_HEIGHT / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        // JPEG formatida kuchliroq siqish (0.7 sifat - yetarli darajada tiniq va hajmi kichik)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        // Agar hali ham juda katta bo'lsa (masalan 20KB dan oshsa), yanada siqish
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

function clearHeaderCropState() {
  headerCropState = null;
  window.cancelAnimationFrame(headerCropPreviewFrame);
  headerCropPreviewFrame = 0;
  const controls = document.getElementById('headerCropControls');
  if (controls) controls.hidden = true;
  const size = document.getElementById('headerCropSize');
  if (size) size.textContent = '16:9 crop tayyor';
}

function resetHeaderCropControls() {
  const zoom = document.getElementById('headerCropZoom');
  const x = document.getElementById('headerCropX');
  const y = document.getElementById('headerCropY');
  if (zoom) zoom.value = '1';
  if (x) x.value = '0';
  if (y) y.value = '0';
}

async function startHeaderCrop(file) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Faqat rasm fayl tanlang.'));
  }

  // Check file size (10MB limit)
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new Error('Rasm hajmi juda katta. Maksimal hajm: 10MB.'));
  }

  const dataUrl = await readFileAsDataUrl(file, 'Header rasmini o\'qib bo\'lmadi.');
  const image = await loadImageFromDataUrl(dataUrl);
  if (image.width <= image.height) {
    throw new Error('Faqat gorizontal rasm tanlang.');
  }

  headerCropState = { image, width: image.width, height: image.height };
  resetHeaderCropControls();
  const controls = document.getElementById('headerCropControls');
  if (controls) controls.hidden = false;
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
  document.getElementById('movieModal').classList.remove('active');
}

// Handle Movie Submit
async function handleMovieSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitButton = form.querySelector('button[type="submit"]');
  const movieData = {
    name: document.getElementById('movieName').value.trim(),
    category: document.getElementById('movieCategory').value,
    rating: parseFloat(document.getElementById('movieRating').value) || 0,
    hd: document.getElementById('movieHd').value === 'true',
    description: document.getElementById('movieDescription').value,
    posterImage: selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim(),
    showInHeader: document.getElementById('movieShowInHeader').checked,
    headerImage: document.getElementById('movieHeaderImage').value.trim()
  };

  if (form.dataset.editingId) {
    // Edit existing - call API
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
    // Add posterImage if changed or new
    const finalPoster = selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim();
    if (finalPoster && (!currentMovie || finalPoster !== (currentMovie.posterImage || currentMovie.poster))) {
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
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Saqlash';
        }
        closeMovieModal();
        showNotification('Kino bazada yangilandi!');
        await fetchMovies();
        renderCategories();
        return;
        // Update local data
        const index = movies.findIndex(m => m.id === id);
        if (index !== -1) {
          movies[index] = { ...movies[index], ...movieData };
        }
        showNotification('Kino bazada yangilandi! ✅');
      } else {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Saqlash';
        }
        showNotification('Xatolik: ' + result.error, 'error');
        return;
      }
    } catch (error) {
      console.error('Update error:', error);
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Saqlash';
      }
      showNotification('Serverga ulanishda xatolik!', 'error');
      return;
    }
  } else {
    if (movieData.description.length > MOVIE_DESCRIPTION_MAX_LENGTH) {
      updateDescriptionCounter();
      showDescriptionLimitError();
      return;
    }

    // Add new
    const numericIds = movies.map(m => Number(m.id)).filter(Number.isFinite);
    const newId = Math.max(...numericIds, 0) + 1;
    movies.push({ id: newId, ...movieData });
    showNotification('Kino qo\'shildi! (lokal)');
  }

  updateCategoryCounts();
  renderMovies();
  renderCategories();
  closeMovieModal();
}

// Edit Movie
function editMovie(id) {
  const movie = movies.find(m => sameMovieId(m.id, id));
  if (movie) {
    openMovieModal(movie);
  }
}

// Delete Movie
function deleteMovie(id) {
  if (confirm('Bu kinoni o\'chirishni xohlaysizmi?')) {
    movies = movies.filter(m => !sameMovieId(m.id, id));
    updateCategoryCounts();
    renderMovies();
    renderCategories();
    showNotification('Kino o\'chirildi!');
  }
}

// Open Category Modal
function openCategoryModal() {
  document.getElementById('categoryModal').classList.add('active');
}

// Close Category Modal
function closeCategoryModal() {
  document.getElementById('categoryModal').classList.remove('active');
  document.getElementById('categoryForm').reset();
}

// Handle Category Submit
function handleCategorySubmit(e) {
  e.preventDefault();

  const name = document.getElementById('categoryName').value;
  const icon = document.getElementById('categoryIcon').value;

  const categoryIds = categories.map(c => Number(c.id)).filter(Number.isFinite);
  const newId = Math.max(...categoryIds, 0) + 1;
  categories.push({ id: newId, name, icon, count: 0 });

  renderCategories();
  updateCategorySelect();
  closeCategoryModal();
  showNotification('Kategoriya qo\'shildi!');
}

// Update Category Select in Movie Form
function updateCategorySelect(preferredValue = '') {
  const select = document.getElementById('movieCategory');
  if (!select) return;

  const currentValue = preferredValue || select.value;
  if (currentValue && !categories.some(c => c.name.toLowerCase() === String(currentValue).toLowerCase())) {
    categories.push({ id: currentValue, name: currentValue, icon: '🎬', count: 0 });
  }

  select.innerHTML = '<option value="">Tanlang</option>' +
    categories.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  select.value = currentValue;
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

// Check Auth (simple)
function checkAuth() {
  const auth = localStorage.getItem('adminAuth');
  if (!auth) {
    const password = prompt('Admin panel parolini kiriting:');
    if (password === 'admin123') { // Change this in production!
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

// Splash Settings
async function loadSplashSettings() {
  try {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) return;
    const data = await response.json();
    const splashUrl = data.splashImageUrl || '';
    const input = document.getElementById('splashImageUrl');
    if (input && splashUrl) {
      input.value = splashUrl;
      const preview = document.getElementById('splashPreview');
      const previewImg = document.getElementById('splashPreviewImg');
      if (previewImg) {
        previewImg.src = splashUrl;
        if (preview) preview.style.display = 'block';
      }
    }
  } catch (e) {
    console.log('Settings not available:', e.message);
  }
}

async function saveSplashSettings() {
  const url = document.getElementById('splashImageUrl')?.value.trim() || '';
  const btn = document.getElementById('saveSplashBtn');

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saqlanmoqda...';
    }

    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ splashImageUrl: url })
    });

    const result = await response.json();
    if (result.ok) {
      showNotification('Sozlamalar saqlandi!');
    } else {
      showNotification('Xatolik: ' + (result.error || 'Noma\'lum'), 'error');
    }
  } catch (e) {
    console.error('Save settings error:', e);
    showNotification('Serverga ulanishda xatolik!', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Saqlash';
    }
  }
}

// Initialize
checkAuth();
init();

// Expose functions for inline handlers
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;
window.showWatchedMovies = showWatchedMovies;
window.closeWatchedMoviesModal = closeWatchedMoviesModal;
