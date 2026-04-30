// Admin Panel JavaScript

// Data storage
let movies = [];
let categories = [];
let selectedPosterDataUrl = '';

// API base URL
const API_URL = '/api';
const POSTER_MAX_WIDTH = 720;
const POSTER_MAX_HEIGHT = 1080;

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
  header: 'Header sozlamalari'
};

// Initialize
async function init() {
  applyTheme(localStorage.getItem('adminTheme') || 'dark');
  loadCategories();
  await fetchMovies();
  renderCategories();
  updateCategorySelect();
  bindEvents();
  loadHeaderSettings();
}

function applyTheme(theme) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem('adminTheme', nextTheme);
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
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
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

  // Header settings
  document.getElementById('saveHeader')?.addEventListener('click', saveHeaderSettings);
  document.getElementById('resetHeader')?.addEventListener('click', loadHeaderSettings);

  // Color picker
  document.getElementById('primaryColor')?.addEventListener('input', (e) => {
    document.querySelector('.color-value').textContent = e.target.value;
  });

  // Poster URL input - live preview
  document.getElementById('moviePoster')?.addEventListener('input', (e) => {
    selectedPosterDataUrl = '';
    updatePosterPreview(e.target.value);
  });

  document.getElementById('moviePosterFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      selectedPosterDataUrl = await readPosterFile(file);
      document.getElementById('moviePoster').value = '';
      updatePosterPreview(selectedPosterDataUrl);
    } catch (error) {
      showNotification(error.message || 'Rasmni o\'qib bo\'lmadi.', 'error');
      e.target.value = '';
      selectedPosterDataUrl = '';
    }
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

  // Close mobile sidebar
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
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
            <div class="empty-state-icon">🎬</div>
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
        <div class="empty-state-icon">📁</div>
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
  selectedPosterDataUrl = '';
  if (posterFileInput) posterFileInput.value = '';
  updateCategorySelect(movie?.category || '');

  if (movie) {
    title.textContent = 'Kino tahrirlash';
    document.getElementById('movieName').value = movie.name;
    document.getElementById('movieCategory').value = movie.category;
    document.getElementById('movieRating').value = movie.rating;
    document.getElementById('movieHd').value = movie.hd.toString();
    selectedPosterDataUrl = String(movie.poster || '').startsWith('data:image/') ? movie.poster : '';
    document.getElementById('moviePoster').value = selectedPosterDataUrl ? '' : movie.poster;
    document.getElementById('movieVideo').value = movie.video;
    document.getElementById('movieDescription').value = movie.description;
    form.dataset.editingId = movie.id;
    
    // Show poster preview
    updatePosterPreview(movie.poster);
  } else {
    title.textContent = 'Yangi kino qo\'shish';
    form.reset();
    delete form.dataset.editingId;
    updatePosterPreview('');
  }

  modal.classList.add('active');
}

// Update poster preview
function updatePosterPreview(url) {
  const img = document.getElementById('posterPreviewImg');
  const placeholder = document.getElementById('posterPlaceholder');
  
  if (url) {
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

function readPosterFile(file) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Faqat rasm fayl tanlang.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Rasmni o\'qib bo\'lmadi.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => resolve(String(reader.result || ''));
      image.onload = () => {
        const scale = Math.min(1, POSTER_MAX_WIDTH / image.width, POSTER_MAX_HEIGHT / image.height);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(String(reader.result || ''));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
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
  const posterValue = selectedPosterDataUrl || document.getElementById('moviePoster').value.trim();
  const movieData = {
    name: document.getElementById('movieName').value.trim(),
    category: document.getElementById('movieCategory').value,
    rating: parseFloat(document.getElementById('movieRating').value) || 0,
    hd: document.getElementById('movieHd').value === 'true',
    poster: posterValue,
    video: document.getElementById('movieVideo').value,
    description: document.getElementById('movieDescription').value
  };

  if (form.dataset.editingId) {
    // Edit existing - call API
    const id = form.dataset.editingId;
    
    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saqlanmoqda...';
      }

      const response = await fetch(`${API_URL}/movie-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: id,
          title: movieData.name,
          genre: movieData.category,
          rating: movieData.rating,
          quality: movieData.hd ? 'HD' : 'SD',
          posterImage: movieData.poster,
          description: movieData.description
        })
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

// Load Header Settings
function loadHeaderSettings() {
  const settings = JSON.parse(localStorage.getItem('headerSettings') || '{}');
  
  document.getElementById('logoUrl').value = settings.logoUrl || '';
  document.getElementById('headerTitle').value = settings.title || 'My Kino';
  document.getElementById('headerSubtitle').value = settings.subtitle || '';
  document.getElementById('primaryColor').value = settings.primaryColor || '#ffc73a';
  document.querySelector('.color-value').textContent = settings.primaryColor || '#ffc73a';
}

// Save Header Settings
function saveHeaderSettings() {
  const settings = {
    logoUrl: document.getElementById('logoUrl').value,
    title: document.getElementById('headerTitle').value,
    subtitle: document.getElementById('headerSubtitle').value,
    primaryColor: document.getElementById('primaryColor').value
  };

  localStorage.setItem('headerSettings', JSON.stringify(settings));
  showNotification('Sozlamalar saqlandi!');
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
window.updatePosterPreview = updatePosterPreview;
