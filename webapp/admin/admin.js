// Admin Panel JavaScript - Movies only

// Data storage
let movies = [];
let filteredMovies = [];
let currentSearchQuery = '';
let selectedPosterDataUrl = '';

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
