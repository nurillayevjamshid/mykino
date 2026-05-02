// Admin Panel JavaScript

// Data storage
let movies = [];
let categories = [];
let headerSection = []; // Alohida header section data
let selectedPosterDataUrl = '';
let selectedHeaderImageDataUrl = '';
let headerCropState = null;
let headerCropPreviewFrame = 0;

// Edit header modal state
let editHeaderSelectedImageDataUrl = '';
let editHeaderCropState = null;
let editHeaderCropPreviewFrame = 0;
let deleteTargetMovieId = '';

// API base URL
const API_URL = '/api';
const HEADER_IMAGE_RATIO = 16 / 9;
const HEADER_IMAGE_MAX_WIDTH = 1920; // Full HD quality
const HEADER_IMAGE_MAX_HEIGHT = 1080; // Full HD quality
const HEADER_IMAGE_MAX_DATA_URL_LENGTH = 250000; // Increased for HD quality
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
    updateHeaderMovieSelect();
    // Headerlarni alohida yuklash
    await fetchHeaderSection();
  } catch (error) {
    console.error('Error fetching movies:', error);
    showNotification('Kinolarni yuklashda xatolik!', 'error');
  }
}

// Fetch header section from separate API
async function fetchHeaderSection() {
  try {
    const response = await fetch(`${API_URL}/header-section`);
    if (!response.ok) {
      console.error('Failed to fetch header section');
      headerSection = [];
      return;
    }
    const data = await response.json();
    headerSection = data.headers || [];
    renderHeaderMovies();
  } catch (error) {
    console.error('Error fetching header section:', error);
    headerSection = [];
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
  header: 'Header Section'
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
  renderCategories();
  updateCategorySelect();
  bindEvents();
  loadHeaderSettings();
  createSidebarOverlay();
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

  // Header settings
  document.getElementById('saveHeader')?.addEventListener('click', saveHeaderSettings);
  document.getElementById('resetHeader')?.addEventListener('click', loadHeaderSettings);
  document.getElementById('headerMovieSelect')?.addEventListener('change', (e) => {
    const movie = movies.find(item => sameMovieId(item.id, e.target.value));
    selectedHeaderImageDataUrl = movie?.headerImage || '';
    // Reset inputs
    const fileInput = document.getElementById('headerImageFile');
    const urlInput = document.getElementById('headerImageUrl');
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = (selectedHeaderImageDataUrl.startsWith('http') ? selectedHeaderImageDataUrl : '');
    
    clearHeaderCropState();
    updateHeaderImagePreview(selectedHeaderImageDataUrl);
  });

  document.getElementById('headerImageFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Clear URL input
      const urlInput = document.getElementById('headerImageUrl');
      if (urlInput) urlInput.value = '';
      
      await startHeaderCrop(file);
      renderHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Header rasmini o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      selectedHeaderImageDataUrl = '';
      clearHeaderCropState();
      updateHeaderImagePreview('');
    }
  });

  document.getElementById('headerImageUrl')?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      // Clear file input and crop state
      const fileInput = document.getElementById('headerImageFile');
      if (fileInput) fileInput.value = '';
      clearHeaderCropState();
      selectedHeaderImageDataUrl = url;
      updateHeaderImagePreview(url);
    } else {
      updateHeaderImagePreview('');
    }
  });
  ['headerCropZoom', 'headerCropX', 'headerCropY'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', scheduleHeaderCropRender);
  });

  document.getElementById('clearAllHeadersBtn')?.addEventListener('click', async () => {
    if (!confirm('DIQQAT: Barcha header kinolarini tozalab tashlamoqchimisiz? Buni ortga qaytarib bo\'lmaydi.')) return;
    
    try {
      const response = await fetch(`${API_URL}/header-section`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });
      
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.error || 'Tozalashda xatolik.');
      
      showNotification('Barcha headerlar tozalandi.');
      await fetchHeaderSection();
      renderHeaderMovies();
    } catch (error) {
      showNotification(error.message || 'Xatolik!', 'error');
    }
  });
  document.getElementById('applyHeaderCrop')?.addEventListener('click', () => {
    if (!headerCropState) return;
    renderHeaderCrop({ notify: true });
  });
  document.getElementById('headerMoviesList')?.addEventListener('click', async (e) => {
    const button = e.target.closest('[data-header-action]');
    if (!button) return;
    const movieId = button.dataset.movieId;
    if (!movieId) return;

    const action = button.dataset.headerAction;
    if (action === 'remove') {
      // Delete confirmation modal ochish
      deleteTargetMovieId = movieId;
      document.getElementById('deleteConfirmMovieId').value = movieId;
      document.getElementById('deleteConfirmModal').classList.add('active');
    } else if (action === 'edit') {
      // Edit modal ochish
      openEditHeaderModal(movieId);
    }
  });

  // Delete confirmation modal
  document.getElementById('closeDeleteConfirmModal')?.addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteConfirmModal);
  document.getElementById('confirmDelete')?.addEventListener('click', async () => {
    if (!deleteTargetMovieId) return;
    const button = document.querySelector(`[data-header-action="remove"][data-movie-id="${deleteTargetMovieId}"]`);
    await confirmRemoveHeaderMovie(deleteTargetMovieId, button);
    closeDeleteConfirmModal();
  });

  // Edit header modal
  document.getElementById('closeEditHeaderModal')?.addEventListener('click', closeEditHeaderModal);
  document.getElementById('cancelEditHeader')?.addEventListener('click', closeEditHeaderModal);
  document.getElementById('editHeaderForm')?.addEventListener('submit', handleEditHeaderSubmit);
  document.getElementById('editHeaderImageFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await startEditHeaderCrop(file);
      renderEditHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Header rasmini o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      editHeaderSelectedImageDataUrl = '';
      clearEditHeaderCropState();
      updateEditHeaderImagePreview('');
    }
  });
  ['editHeaderCropZoom', 'editHeaderCropX', 'editHeaderCropY'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', scheduleEditHeaderCropRender);
  });
  document.getElementById('editApplyHeaderCrop')?.addEventListener('click', () => {
    if (!editHeaderCropState) return;
    renderEditHeaderCrop({ notify: true });
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

function getHeaderCropRect() {
  const image = headerCropState.image;
  const zoom = Math.max(1, Number(document.getElementById('headerCropZoom')?.value || 1));
  const panX = Number(document.getElementById('headerCropX')?.value || 0) / 100;
  const panY = Number(document.getElementById('headerCropY')?.value || 0) / 100;
  const sourceRatio = image.width / image.height;
  let cropWidth = image.width;
  let cropHeight = image.height;

  if (sourceRatio > HEADER_IMAGE_RATIO) {
    cropWidth = image.height * HEADER_IMAGE_RATIO;
  } else if (sourceRatio < HEADER_IMAGE_RATIO) {
    cropHeight = image.width / HEADER_IMAGE_RATIO;
  }

  cropWidth /= zoom;
  cropHeight /= zoom;
  const maxX = Math.max(0, image.width - cropWidth);
  const maxY = Math.max(0, image.height - cropHeight);
  const x = Math.min(maxX, Math.max(0, maxX / 2 + panX * maxX / 2));
  const y = Math.min(maxY, Math.max(0, maxY / 2 + panY * maxY / 2));

  return { x, y, width: cropWidth, height: cropHeight };
}

function encodeHeaderCrop() {
  if (!headerCropState?.image) {
    throw new Error('Avval rasm tanlang.');
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Brauzer rasmni crop qila olmadi.');

  const crop = getHeaderCropRect();
  // Full HD quality header image sizes with enhanced format support
  const widths = [1920, 1600, 1280, 1024, 800];
  const formats = [
    { mime: 'image/webp', qualities: [0.95, 0.92, 0.88, 0.84, 0.80, 0.76, 0.70] },
    { mime: 'image/jpeg', qualities: [0.94, 0.90, 0.86, 0.82, 0.78, 0.74, 0.68] },
    { mime: 'image/png', qualities: [0.92, 0.88, 0.84, 0.80, 0.76, 0.72] } // For transparency support
  ];

  let fallback = '';
  for (const width of widths) {
    canvas.width = width;
    canvas.height = Math.round(width / HEADER_IMAGE_RATIO);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      headerCropState.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    for (const format of formats) {
      for (const quality of format.qualities) {
        const dataUrl = canvas.toDataURL(format.mime, quality);
        if (!dataUrl.startsWith(`data:${format.mime}`)) continue;
        fallback = dataUrl;
        if (dataUrl.length <= HEADER_IMAGE_MAX_DATA_URL_LENGTH) {
          return dataUrl;
        }
      }
    }
  }

  if (fallback && fallback.length <= 300000) return fallback;
  throw new Error('Header rasmi hajmi katta. Kichikroq rasm tanlang yoki cropni yaqinroq qiling.');
}

function updateHeaderCropSize(dataUrl) {
  const size = document.getElementById('headerCropSize');
  if (!size) return;
  const kb = Math.ceil(dataUrl.length / 1024);
  const format = dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
  size.textContent = `${format}, ${kb} KB, 16:9`;
}

function renderHeaderCrop(options = {}) {
  if (!headerCropState) return;
  selectedHeaderImageDataUrl = encodeHeaderCrop();
  updateHeaderImagePreview(selectedHeaderImageDataUrl);
  updateHeaderCropSize(selectedHeaderImageDataUrl);
  if (options.notify) showNotification('Crop qo\'llandi.');
}

function scheduleHeaderCropRender() {
  window.cancelAnimationFrame(headerCropPreviewFrame);
  headerCropPreviewFrame = window.requestAnimationFrame(() => {
    try {
      renderHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Crop qilishda xatolik.', 'error');
    }
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

function getHeaderCropSettings() {
  if (!headerCropState?.image) return null;

  const zoom = Number(document.getElementById('headerCropZoom')?.value || 1);
  const panX = Number(document.getElementById('headerCropX')?.value || 0);
  const panY = Number(document.getElementById('headerCropY')?.value || 0);
  const crop = getHeaderCropRect();

  return {
    ratio: '16:9',
    source: {
      width: Math.round(headerCropState.width),
      height: Math.round(headerCropState.height)
    },
    crop: {
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height)
    },
    transform: {
      zoom: Number(zoom.toFixed(2)),
      x: Math.round(panX),
      y: Math.round(panY)
    }
  };
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
    posterImage: selectedPosterDataUrl || document.getElementById('moviePosterUrl').value.trim()
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

function updateHeaderMovieSelect(preferredValue = '') {
  const select = document.getElementById('headerMovieSelect');
  if (!select) return;

  const currentValue = preferredValue || select.value || movies.find(movie => movie.showInHeader)?.id || '';
  select.innerHTML = '<option value="">Kino tanlang</option>' +
    movies.map(movie => {
      const title = movie.name || movie.code || 'Kino';
      const code = movie.code ? ` (${movie.code})` : '';
      const marker = movie.showInHeader ? ' - Header' : '';
      return `<option value="${escapeHtml(movie.id)}">${escapeHtml(title + code + marker)}</option>`;
    }).join('');

  select.value = movies.some(movie => sameMovieId(movie.id, currentValue)) ? currentValue : '';
}

// Header section dan faqat active headerlarni olish (movie ma'lumotlari bilan)
function getHeaderMovies() {
  return headerSection
    .filter(header => header.isActive !== false && header.headerImageUrl)
    .map(header => {
      // Movie ma'lumotlarini topish
      const movie = movies.find(m => sameMovieId(m.id, header.movieId));
      return {
        ...header,
        movieId: header.movieId,
        id: header.movieId, // Compatibility uchun
        name: header.title || movie?.name || 'Kino',
        headerImage: header.headerImageUrl,
        year: header.year || movie?.year || '',
        category: header.category || movie?.category || '',
        quality: movie?.quality || 'HD',
        cropSettings: header.cropSettings,
      };
    });
}

function renderHeaderMovies() {
  const list = document.getElementById('headerMoviesList');
  const count = document.getElementById('headerMoviesCount');
  if (!list) return;

  const headerMovies = getHeaderMovies();
  if (count) count.textContent = `${headerMovies.length} ta`;

  if (!headerMovies.length) {
    list.innerHTML = `
      <div class="header-empty-state">
        <strong>Hozircha kino yo'q</strong>
        <span>Kino tanlab 16:9 rasm yuklang va saqlang.</span>
      </div>
    `;
    return;
  }

  list.innerHTML = headerMovies.map(header => `
    <article class="header-movie-card">
      <img class="header-movie-thumb" src="${escapeHtml(header.headerImage)}" alt="${escapeHtml(header.name)}">
      <div class="header-movie-info">
        <strong>${escapeHtml(header.name || 'Kino')}</strong>
        <span>${escapeHtml([header.year || '', header.category || header.quality || 'HD'].filter(Boolean).join(' - '))}</span>
      </div>
      <div class="header-movie-actions">
        <button
          type="button"
          class="btn-icon header-edit"
          data-header-action="edit"
          data-movie-id="${escapeHtml(header.movieId)}"
          title="Tahrirlash"
          aria-label="${escapeHtml(header.name || 'Kino')}ni tahrirlash"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button
          type="button"
          class="btn-icon header-remove"
          data-header-action="remove"
          data-movie-id="${escapeHtml(header.movieId)}"
          title="Headerdan olib tashlash"
          aria-label="${escapeHtml(header.name || 'Kino')}ni headerdan olib tashlash"
        >
          &times;
        </button>
      </div>
    </article>
  `).join('');
}

// Load Header Settings
function loadHeaderSettings() {
  const selectedMovie = movies.find(movie => movie.showInHeader && movie.headerImage)
    || movies.find(movie => movie.showInHeader)
    || null;
  const selectedMovieId = selectedMovie?.id || document.getElementById('headerMovieSelect')?.value || '';

  updateHeaderMovieSelect(selectedMovieId);
  selectedHeaderImageDataUrl = selectedMovie?.headerImage || '';
  clearHeaderCropState();
  updateHeaderImagePreview(selectedHeaderImageDataUrl);

  const fileInput = document.getElementById('headerImageFile');
  if (fileInput) fileInput.value = '';
  renderHeaderMovies();
}

// Save Header Settings
async function saveHeaderSettings() {
  const select = document.getElementById('headerMovieSelect');
  const saveButton = document.getElementById('saveHeader');
  const movieId = select?.value || '';
  const movie = movies.find(item => sameMovieId(item.id, movieId));
  const urlValue = document.getElementById('headerImageUrl')?.value.trim();

  if (!movie) {
    showNotification('Avval kino tanlang.', 'error');
    return;
  }

  if (!selectedHeaderImageDataUrl && !urlValue) {
    showNotification('16:9 header rasmini tanlang yoki URL kiriting.', 'error');
    return;
  }

  if (headerCropState) {
    try {
      renderHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Crop qilishda xatolik.', 'error');
      return;
    }
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saqlanmoqda...';
    }

    // Yangi header-section API ishlatish
    const updatePayload = {
      movieId: movie.id,
      title: movie.name || '',
      year: movie.year || '',
      category: movie.category || '',
      rating: movie.rating || '',
      isActive: true,
      headerImage: selectedHeaderImageDataUrl.startsWith('data:') ? selectedHeaderImageDataUrl : null,
      headerImageUrl: urlValue || (selectedHeaderImageDataUrl.startsWith('http') ? selectedHeaderImageDataUrl : null)
    };

    const headerCrop = getHeaderCropSettings();
    if (headerCrop) updatePayload.cropSettings = headerCrop;

    // Yangi header-section API
    const response = await fetch(`${API_URL}/header-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Header Section saqlanmadi.');
    }

    showNotification('Header saqlandi (rasm alohida storage ga)!');
    console.log('[DEBUG] Header saved, fileId:', result?.header?.headerImageFileId);

    // Headerlarni qayta yuklash
    await fetchHeaderSection();

    renderHeaderMovies();

    // Formani tozalash - yangi kino qo'shishga tayyorlash
    const select = document.getElementById('headerMovieSelect');
    const fileInput = document.getElementById('headerImageFile');

    // Selectni tozalash - avval options yangilab, keyin bo'sh qiymat qo'yish
    if (select) {
      select.innerHTML = '<option value="">Kino tanlang</option>' +
        movies.map(movie => {
          const title = movie.name || movie.code || 'Kino';
          const code = movie.code ? ` (${movie.code})` : '';
          const marker = movie.showInHeader ? ' - Header' : '';
          return `<option value="${escapeHtml(movie.id)}">${escapeHtml(title + code + marker)}</option>`;
        }).join('');
      select.value = '';
    }

    // File inputni tozalash
    if (fileInput) fileInput.value = '';

    // Rasm state'ini tozalash
    selectedHeaderImageDataUrl = '';
    clearHeaderCropState();
    updateHeaderImagePreview('');
  } catch (error) {
    showNotification(error.message || 'Header Section saqlashda xatolik!', 'error');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Saqlash';
    }
  }
}

async function removeHeaderMovie(movieId, button) {
  // Bu funksiya endi ishlatilmaydi - o'rniga delete confirmation modal ishlatiladi
  const movie = movies.find(item => sameMovieId(item.id, movieId));
  if (!movie) return;

  deleteTargetMovieId = movieId;
  document.getElementById('deleteConfirmMovieId').value = movieId;
  document.getElementById('deleteConfirmModal').classList.add('active');
}

function closeDeleteConfirmModal() {
  document.getElementById('deleteConfirmModal').classList.remove('active');
  deleteTargetMovieId = '';
}

async function confirmRemoveHeaderMovie(movieId, button) {
  if (!confirm('Ushbu kinoni headerdan olib tashlamoqchimisiz?')) return;
  
  try {
    if (button) button.disabled = true;

    // Yangi header-section API dan foydalanib o'chirish (soft delete)
    const response = await fetch(`${API_URL}/header-section`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movieId: movieId
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Kino headerdan olib tashlanmadi.');
    }

    showNotification('Kino headerdan olib tashlandi (isActive=false).');
    await fetchHeaderSection();  // Header-section ni qayta yuklash
    renderHeaderMovies();
  } catch (error) {
    showNotification(error.message || 'Headerni yangilashda xatolik!', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

// Edit Header Modal Functions
function openEditHeaderModal(movieId) {
  const movie = movies.find(item => sameMovieId(item.id, movieId));
  if (!movie) return;

  document.getElementById('editHeaderMovieId').value = movieId;
  document.getElementById('editHeaderMovieName').textContent = movie.name || 'Kino';
  document.getElementById('editHeaderModalTitle').textContent = `${movie.name || 'Kino'} - Header rasmini tahrirlash`;

  // Hozirgi rasmni ko'rsatish
  editHeaderSelectedImageDataUrl = movie.headerImage || '';
  updateEditHeaderImagePreview(editHeaderSelectedImageDataUrl);

  // Formani tozalash
  const fileInput = document.getElementById('editHeaderImageFile');
  const urlInput = document.getElementById('editHeaderImageUrl');
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = (editHeaderSelectedImageDataUrl.startsWith('http') ? editHeaderSelectedImageDataUrl : '');
  
  clearEditHeaderCropState();

  document.getElementById('editHeaderModal').classList.add('active');
}

function closeEditHeaderModal() {
  document.getElementById('editHeaderModal').classList.remove('active');
  editHeaderSelectedImageDataUrl = '';
  clearEditHeaderCropState();
}

function updateEditHeaderImagePreview(url) {
  const img = document.getElementById('editHeaderImagePreviewImg');
  const placeholder = document.getElementById('editHeaderImagePlaceholder');
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

async function startEditHeaderCrop(file) {
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

  editHeaderCropState = { image, width: image.width, height: image.height };
  resetEditHeaderCropControls();
  const controls = document.getElementById('editHeaderCropControls');
  if (controls) controls.hidden = false;
}

function clearEditHeaderCropState() {
  editHeaderCropState = null;
  window.cancelAnimationFrame(editHeaderCropPreviewFrame);
  editHeaderCropPreviewFrame = 0;
  const controls = document.getElementById('editHeaderCropControls');
  if (controls) controls.hidden = true;
  const size = document.getElementById('editHeaderCropSize');
  if (size) size.textContent = '16:9 crop tayyor';
}

function resetEditHeaderCropControls() {
  const zoom = document.getElementById('editHeaderCropZoom');
  const x = document.getElementById('editHeaderCropX');
  const y = document.getElementById('editHeaderCropY');
  if (zoom) zoom.value = '1';
  if (x) x.value = '0';
  if (y) y.value = '0';
}

function getEditHeaderCropRect() {
  const image = editHeaderCropState.image;
  const zoom = Math.max(1, Number(document.getElementById('editHeaderCropZoom')?.value || 1));
  const panX = Number(document.getElementById('editHeaderCropX')?.value || 0) / 100;
  const panY = Number(document.getElementById('editHeaderCropY')?.value || 0) / 100;
  const sourceRatio = image.width / image.height;
  let cropWidth = image.width;
  let cropHeight = image.height;

  if (sourceRatio > HEADER_IMAGE_RATIO) {
    cropWidth = image.height * HEADER_IMAGE_RATIO;
  } else if (sourceRatio < HEADER_IMAGE_RATIO) {
    cropHeight = image.width / HEADER_IMAGE_RATIO;
  }

  cropWidth /= zoom;
  cropHeight /= zoom;
  const maxX = Math.max(0, image.width - cropWidth);
  const maxY = Math.max(0, image.height - cropHeight);
  const x = Math.min(maxX, Math.max(0, maxX / 2 + panX * maxX / 2));
  const y = Math.min(maxY, Math.max(0, maxY / 2 + panY * maxY / 2));

  return { x, y, width: cropWidth, height: cropHeight };
}

function encodeEditHeaderCrop() {
  if (!editHeaderCropState?.image) {
    throw new Error('Avval rasm tanlang.');
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Brauzer rasmni crop qila olmadi.');

  const crop = getEditHeaderCropRect();
  // Full HD quality header image sizes with enhanced format support
  const widths = [1920, 1600, 1280, 1024, 800];
  const formats = [
    { mime: 'image/webp', qualities: [0.95, 0.92, 0.88, 0.84, 0.80, 0.76, 0.70] },
    { mime: 'image/jpeg', qualities: [0.94, 0.90, 0.86, 0.82, 0.78, 0.74, 0.68] },
    { mime: 'image/png', qualities: [0.92, 0.88, 0.84, 0.80, 0.76, 0.72] } // For transparency support
  ];

  let fallback = '';
  for (const width of widths) {
    canvas.width = width;
    canvas.height = Math.round(width / HEADER_IMAGE_RATIO);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      editHeaderCropState.image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    for (const format of formats) {
      for (const quality of format.qualities) {
        const dataUrl = canvas.toDataURL(format.mime, quality);
        if (!dataUrl.startsWith(`data:${format.mime}`)) continue;
        fallback = dataUrl;
        if (dataUrl.length <= HEADER_IMAGE_MAX_DATA_URL_LENGTH) {
          return dataUrl;
        }
      }
    }
  }

  if (fallback && fallback.length <= 300000) return fallback;
  throw new Error('Header rasmi hajmi katta. Kichikroq rasm tanlang yoki cropni yaqinroq qiling.');
}

function updateEditHeaderCropSize(dataUrl) {
  const size = document.getElementById('editHeaderCropSize');
  if (!size) return;
  const kb = Math.ceil(dataUrl.length / 1024);
  const format = dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG';
  size.textContent = `${format}, ${kb} KB, 16:9`;
}

function renderEditHeaderCrop(options = {}) {
  if (!editHeaderCropState) return;
  editHeaderSelectedImageDataUrl = encodeEditHeaderCrop();
  updateEditHeaderImagePreview(editHeaderSelectedImageDataUrl);
  updateEditHeaderCropSize(editHeaderSelectedImageDataUrl);
  if (options.notify) showNotification('Crop qo\'llandi.');
}

function scheduleEditHeaderCropRender() {
  window.cancelAnimationFrame(editHeaderCropPreviewFrame);
  editHeaderCropPreviewFrame = window.requestAnimationFrame(() => {
    try {
      renderEditHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Crop qilishda xatolik.', 'error');
    }
  });
}

function getEditHeaderCropSettings() {
  if (!editHeaderCropState?.image) return null;

  const zoom = Number(document.getElementById('editHeaderCropZoom')?.value || 1);
  const panX = Number(document.getElementById('editHeaderCropX')?.value || 0);
  const panY = Number(document.getElementById('editHeaderCropY')?.value || 0);
  const crop = getEditHeaderCropRect();

  return {
    ratio: '16:9',
    source: {
      width: Math.round(editHeaderCropState.width),
      height: Math.round(editHeaderCropState.height)
    },
    crop: {
      x: Math.round(crop.x),
      y: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height)
    },
    transform: {
      zoom: Number(zoom.toFixed(2)),
      x: Math.round(panX),
      y: Math.round(panY)
    }
  };
}

async function handleEditHeaderSubmit(e) {
  e.preventDefault();

  const movieId = document.getElementById('editHeaderMovieId')?.value || '';
  const movie = movies.find(item => sameMovieId(item.id, movieId));
  if (!movie) {
    showNotification('Kino topilmadi.', 'error');
    return;
  }

  const saveButton = document.getElementById('saveEditHeader');
  const urlValue = document.getElementById('editHeaderImageUrl')?.value.trim();

  // Yangi rasm tanlangan bo'lsa crop qilish
  if (editHeaderCropState) {
    try {
      renderEditHeaderCrop();
    } catch (error) {
      showNotification(error.message || 'Crop qilishda xatolik.', 'error');
      return;
    }
  }

  // Agar yangi rasm tanlanmagan bo'lsa va hozirgi rasm ham yo'q bo'lsa xato
  if (!editHeaderSelectedImageDataUrl && !urlValue && !movie.headerImage) {
    showNotification('Header rasmini tanlang yoki URL kiriting.', 'error');
    return;
  }

  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saqlanmoqda...';
    }

    // Yangi header-section API ishlatish
    const updatePayload = {
      movieId: movie.id,
      title: movie.name || '',
      year: movie.year || '',
      category: movie.category || '',
      rating: movie.rating || '',
      isActive: true,
      headerImage: editHeaderSelectedImageDataUrl.startsWith('data:') ? editHeaderSelectedImageDataUrl : null,
      headerImageUrl: urlValue || (editHeaderSelectedImageDataUrl.startsWith('http') ? editHeaderSelectedImageDataUrl : null)
    };

    const headerCrop = getEditHeaderCropSettings();
    if (headerCrop) updatePayload.cropSettings = headerCrop;

    // Yangi header-section API
    const response = await fetch(`${API_URL}/header-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || 'Header rasmi saqlanmadi.');
    }

    showNotification('Header rasmi saqlandi (alohida storage)!');
    await fetchHeaderSection();  // Yangi header-section dan yuklash
    renderHeaderMovies();
    closeEditHeaderModal();
  } catch (error) {
    showNotification(error.message || 'Header rasmini saqlashda xatolik!', 'error');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = 'Saqlash';
    }
  }
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

// Initialize
checkAuth();
init();

// Expose functions for inline handlers
window.editMovie = editMovie;
window.deleteMovie = deleteMovie;
