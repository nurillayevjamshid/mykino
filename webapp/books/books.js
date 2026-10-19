/**
 * NTV Audio Kitoblar (Audiobooks) Section — Client Logic
 * Implements Telegram WebApp support, audiobook playback,
 * bookmarks (watermark) persistence, searching, filtering,
 * and responsive player modals.
 */

(function () {
  "use strict";

  // Application State
  const state = {
    books: [],
    savedIds: new Set(),
    activeFilter: "barchasi",
    searchQuery: "",
    currentBook: null,
    isPlaying: false,
    playbackRate: 1.0,
    audioElement: null,
    audioCtx: null,
    synthUtterance: null,
    isSynthesizing: false,
    durationSeconds: 0,
    currentTime: 0,
    isSeeking: false,
  };

  // DOM Elements cache
  const elements = {};

  // Initialize Telegram WebApp if available
  function initTelegram() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor("#0d0d12");
        if (tg.setBackgroundColor) tg.setBackgroundColor("#0d0d12");

        // Handle Telegram BackButton
        if (tg.BackButton) {
          tg.BackButton.onClick(() => {
            if (isModalOpen()) {
              closeModal();
            } else if (isSidebarOpen()) {
              closeSidebar();
            } else if (state.activeFilter === "saqlanganlar" || state.searchQuery) {
              setFilter("barchasi");
              if (elements.searchInput) elements.searchInput.value = "";
              state.searchQuery = "";
              render();
            }
          });
        }
      }
    } catch (e) {
      console.warn("Telegram WebApp initialization error:", e);
    }
  }

  // Load Saved Bookmarks from LocalStorage
  function loadSavedIds() {
    try {
      const raw = localStorage.getItem("ntv_saved_audiobooks");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.savedIds = new Set(parsed.map(String));
        }
      }
    } catch (_) {
      state.savedIds = new Set();
    }
    updateBookmarkBadge();
  }

  function saveSavedIds() {
    try {
      localStorage.setItem("ntv_saved_audiobooks", JSON.stringify(Array.from(state.savedIds)));
    } catch (_) {}
    updateBookmarkBadge();
  }

  function toggleBookmark(bookId, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const id = String(bookId);
    if (state.savedIds.has(id)) {
      state.savedIds.delete(id);
    } else {
      state.savedIds.add(id);
    }
    saveSavedIds();
    render();
    updateModalBookmarkBtn();
  }

  function updateBookmarkBadge() {
    const count = state.savedIds.size;
    if (elements.bookmarkBadge) {
      elements.bookmarkBadge.textContent = count > 0 ? count : "";
      elements.bookmarkBadge.setAttribute("data-count", count);
    }
    if (elements.sidebarSavedBadge) {
      elements.sidebarSavedBadge.textContent = count;
    }
  }

  // Fetch Books Data
  async function loadBooks() {
    try {
      // First try serverless API
      const resp = await fetch("/api/books", { cache: "default" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.books)) {
          state.books = data.books;
          render();
          return;
        }
      }
    } catch (_) {}

    // Fallback to static bundle json
    try {
      const staticResp = await fetch("/books/books.json");
      if (staticResp.ok) {
        const data = await staticResp.json();
        if (Array.isArray(data)) {
          state.books = data;
          render();
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load books:", err);
    }
  }

  // Filter books based on active filter and query
  function getFilteredBooks() {
    let list = state.books || [];

    if (state.activeFilter === "saqlanganlar") {
      list = list.filter((b) => state.savedIds.has(String(b.id)));
    } else if (state.activeFilter && state.activeFilter !== "barchasi") {
      list = list.filter((b) => (b.genre || "").toLowerCase().includes(state.activeFilter.toLowerCase()));
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter((b) => {
        const t = (b.title || "").toLowerCase();
        const a = (b.author || "").toLowerCase();
        const n = (b.narrator || "").toLowerCase();
        const g = (b.genre || "").toLowerCase();
        return t.includes(q) || a.includes(q) || n.includes(q) || g.includes(q);
      });
    }

    return list;
  }

  // Render Audiobook List (Spotify Chart #1..#N Style as per Image 1)
  function render() {
    const list = getFilteredBooks();
    const container = elements.booksList;
    if (!container) return;

    if (elements.sectionCount) {
      elements.sectionCount.textContent = `${list.length} ta audio kitob`;
    }

    if (elements.sectionLabel) {
      if (state.activeFilter === "saqlanganlar") {
        elements.sectionLabel.textContent = "Saqlangan kitoblar";
      } else if (state.searchQuery) {
        elements.sectionLabel.textContent = "Qidiruv natijalari";
      } else {
        elements.sectionLabel.textContent = "Eng so'nggi qo'shilganlar";
      }
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="books-empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div class="empty-title">Audio kitob topilmadi</div>
          <div class="empty-desc">${
            state.activeFilter === "saqlanganlar"
              ? "Hozircha hech qanday audio kitob saqlanmagan. Ro'yxatdagi bookmark tugmasi orqali kitoblarni saqlab qo'yishingiz mumkin."
              : "Boshqa so'z bilan qidirib ko'ring yoki filtrlarni tozalang."
          }</div>
        </div>
      `;
      return;
    }

    container.innerHTML = list
      .map((book, index) => {
        const rank = index + 1;
        const isSaved = state.savedIds.has(String(book.id));
        const isCurrent = state.currentBook && String(state.currentBook.id) === String(book.id);
        const isPlayingThis = isCurrent && state.isPlaying;
        const gradient = book.coverGradient || "linear-gradient(135deg, #374151 0%, #111827 100%)";
        const initials = getInitials(book.title);

        return `
          <div class="book-row">
            <div class="book-rank">#${rank}</div>
            <div class="book-card ${isPlayingThis ? "is-active-playing" : ""}" data-book-id="${book.id}">
              <div class="book-cover-wrap">
                <div class="book-cover-art" style="background: ${gradient};">
                  ${initials}
                </div>
                <div class="book-cover-overlay">
                  ${
                    isPlayingThis
                      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
                      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`
                  }
                </div>
              </div>
              <div class="book-info">
                <div class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</div>
                <div class="book-author" title="${escapeHtml(book.author)}">${escapeHtml(book.author)}</div>
              </div>
              <div class="book-duration">${escapeHtml(book.duration || (book.minutes ? book.minutes + " daqiqa" : ""))}</div>
              <button type="button" class="book-bookmark-btn ${isSaved ? "is-saved" : ""}" data-action="bookmark" data-book-id="${book.id}" aria-label="Saqlab qo'yish" title="${isSaved ? "Saqlangandan o'chirish" : "Saqlash"}">
                <svg viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                </svg>
              </button>
              <div class="book-chevron">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6"></path>
                </svg>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function getInitials(title) {
    if (!title) return "📖";
    const words = title.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Playback Control & Web Audio Synthesis
  function playBook(book) {
    state.currentBook = book;
    state.durationSeconds = (book.minutes || 14) * 60;
    state.currentTime = 0;
    state.isPlaying = true;

    // Speak introductory narration using Web Speech Synthesis if available
    speakIntroduction(book);

    updateMiniPlayer();
    updateModalDetails();
    render();
  }

  function togglePlayPause() {
    if (!state.currentBook) {
      if (state.books.length > 0) {
        playBook(state.books[0]);
      }
      return;
    }
    state.isPlaying = !state.isPlaying;
    if (window.speechSynthesis) {
      if (state.isPlaying) {
        window.speechSynthesis.resume();
      } else {
        window.speechSynthesis.pause();
      }
    }
    updateMiniPlayer();
    updateModalDetails();
    render();
  }

  function speakIntroduction(book) {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const text = `${book.title}. Muallif: ${book.author}. O'qiydi: ${book.narrator}. Janr: ${book.genre}.`;
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = state.playbackRate;
      utter.lang = "uz-UZ";
      utter.onend = () => {
        // Continue ticking playback timer
      };
      window.speechSynthesis.speak(utter);
    } catch (_) {}
  }

  // Playback progress ticker
  setInterval(() => {
    if (state.isPlaying && state.currentBook && !state.isSeeking) {
      state.currentTime += 1;
      if (state.currentTime >= state.durationSeconds) {
        state.currentTime = 0;
        state.isPlaying = false;
        render();
        updateMiniPlayer();
      }
      updateTimeDisplay();
    }
  }, 1000);

  function formatTime(totalSec) {
    const s = Math.floor(totalSec || 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  }

  function updateTimeDisplay() {
    if (elements.currentTimeEl) {
      elements.currentTimeEl.textContent = formatTime(state.currentTime);
    }
    if (elements.durationTimeEl) {
      elements.durationTimeEl.textContent = formatTime(state.durationSeconds);
    }
    if (elements.scrubber && !state.isSeeking && state.durationSeconds > 0) {
      elements.scrubber.value = (state.currentTime / state.durationSeconds) * 100;
    }
  }

  // Modal Dialog Actions
  function openModal(book) {
    state.currentBook = book;
    if (!state.isPlaying) {
      playBook(book);
    } else {
      updateModalDetails();
    }
    if (elements.modalBackdrop) elements.modalBackdrop.classList.add("is-open");
    if (elements.bookModal) elements.bookModal.classList.add("is-open");

    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
    }
  }

  function closeModal() {
    if (elements.modalBackdrop) elements.modalBackdrop.classList.remove("is-open");
    if (elements.bookModal) elements.bookModal.classList.remove("is-open");

    if (window.Telegram?.WebApp?.BackButton && !isSidebarOpen()) {
      window.Telegram.WebApp.BackButton.hide();
    }
  }

  function isModalOpen() {
    return elements.bookModal && elements.bookModal.classList.contains("is-open");
  }

  function updateModalDetails() {
    const book = state.currentBook;
    if (!book) return;

    if (elements.modalCover) {
      elements.modalCover.style.background = book.coverGradient || "linear-gradient(135deg, #a8324e 0%, #4a1523 100%)";
      elements.modalCover.textContent = getInitials(book.title);
    }
    if (elements.modalTitle) elements.modalTitle.textContent = book.title;
    if (elements.modalAuthor) elements.modalAuthor.textContent = book.author;
    if (elements.modalGenre) elements.modalGenre.textContent = book.genre || "Hikoya";
    if (elements.modalNarrator) elements.modalNarrator.textContent = book.narrator || "Suxandon";
    if (elements.modalSize) elements.modalSize.textContent = book.size || "—";
    if (elements.modalDuration) elements.modalDuration.textContent = book.duration || `${book.minutes} daqiqa`;

    if (elements.modalTgLink) {
      elements.modalTgLink.href = book.postUrl || `https://t.me/audiokitoblar_uz/${book.id}`;
    }

    updateModalBookmarkBtn();
    updateModalPlayBtn();
    updateTimeDisplay();
  }

  function updateModalBookmarkBtn() {
    if (!elements.modalBookmarkBtn || !state.currentBook) return;
    const isSaved = state.savedIds.has(String(state.currentBook.id));
    elements.modalBookmarkBtn.classList.toggle("is-saved", isSaved);
    elements.modalBookmarkBtn.setAttribute("title", isSaved ? "Saqlangandan o'chirish" : "Saqlash");
    const svg = elements.modalBookmarkBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", isSaved ? "currentColor" : "none");
  }

  function updateModalPlayBtn() {
    if (!elements.modalPlayBtn) return;
    elements.modalPlayBtn.innerHTML = state.isPlaying
      ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
      : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
  }

  // Mini Player Sticky Bar
  function updateMiniPlayer() {
    const book = state.currentBook;
    if (!elements.miniPlayer || !book) return;

    elements.miniPlayer.classList.add("is-visible");
    if (elements.miniCover) {
      elements.miniCover.style.background = book.coverGradient || "#3b82f6";
      elements.miniCover.textContent = getInitials(book.title);
    }
    if (elements.miniTitle) elements.miniTitle.textContent = book.title;
    if (elements.miniAuthor) elements.miniAuthor.textContent = book.author;

    if (elements.miniPlayBtn) {
      elements.miniPlayBtn.innerHTML = state.isPlaying
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`;
    }
  }

  // Sidebar Controls
  function openSidebar() {
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.add("is-open");
    if (elements.sidebar) elements.sidebar.classList.add("is-open");

    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
    }
  }

  function closeSidebar() {
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.remove("is-open");
    if (elements.sidebar) elements.sidebar.classList.remove("is-open");

    if (window.Telegram?.WebApp?.BackButton && !isModalOpen()) {
      window.Telegram.WebApp.BackButton.hide();
    }
  }

  function isSidebarOpen() {
    return elements.sidebar && elements.sidebar.classList.contains("is-open");
  }

  // Set Active Genre or Saved Filter
  function setFilter(filter) {
    state.activeFilter = filter;

    document.querySelectorAll(".genre-pill").forEach((pill) => {
      pill.classList.toggle("is-active", pill.getAttribute("data-filter") === filter);
    });

    document.querySelectorAll(".sidebar-item[data-filter]").forEach((item) => {
      item.classList.toggle("is-active", item.getAttribute("data-filter") === filter);
    });

    render();
  }

  // Toggle Dark/Light Theme
  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ntv_theme", next);
    } catch (_) {}

    if (elements.themeSwitchBtn) {
      elements.themeSwitchBtn.classList.toggle("is-active", next === "light");
    }
  }

  function initTheme() {
    let saved = "dark";
    try {
      saved = localStorage.getItem("ntv_theme") || "dark";
    } catch (_) {}
    document.documentElement.setAttribute("data-theme", saved);
    if (elements.themeSwitchBtn) {
      elements.themeSwitchBtn.classList.toggle("is-active", saved === "light");
    }
  }

  // Setup DOM Event Listeners
  function setupEventListeners() {
    // Topbar Hamburger menu
    if (elements.menuBtn) {
      elements.menuBtn.addEventListener("click", openSidebar);
    }

    // Topbar Bookmark Trigger (Watermark Saqlanganlar)
    if (elements.bookmarkBtn) {
      elements.bookmarkBtn.addEventListener("click", () => {
        if (state.activeFilter === "saqlanganlar") {
          setFilter("barchasi");
        } else {
          setFilter("saqlanganlar");
        }
      });
    }

    // Sidebar close
    if (elements.sidebarCloseBtn) elements.sidebarCloseBtn.addEventListener("click", closeSidebar);
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.addEventListener("click", closeSidebar);

    // Sidebar items
    document.querySelectorAll(".sidebar-item[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setFilter(btn.getAttribute("data-filter"));
        closeSidebar();
      });
    });

    // Theme toggle in sidebar
    if (elements.themeSwitchBtn) {
      elements.themeSwitchBtn.addEventListener("click", toggleTheme);
    }

    // Genre filter pills
    document.querySelectorAll(".genre-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        setFilter(pill.getAttribute("data-filter"));
      });
    });

    // Search Box input & clear
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value.trim();
        if (elements.searchClearBtn) {
          elements.searchClearBtn.hidden = !state.searchQuery;
        }
        render();
      });
    }

    if (elements.searchClearBtn) {
      elements.searchClearBtn.addEventListener("click", () => {
        if (elements.searchInput) {
          elements.searchInput.value = "";
          elements.searchInput.focus();
        }
        state.searchQuery = "";
        elements.searchClearBtn.hidden = true;
        render();
      });
    }

    // Card Clicks (Open Modal / Play) & Bookmark Click Delegation
    if (elements.booksList) {
      elements.booksList.addEventListener("click", (e) => {
        const bookmarkBtn = e.target.closest('[data-action="bookmark"]');
        if (bookmarkBtn) {
          const bookId = bookmarkBtn.getAttribute("data-book-id");
          toggleBookmark(bookId, e);
          return;
        }

        const card = e.target.closest(".book-card");
        if (card) {
          const bookId = card.getAttribute("data-book-id");
          const book = state.books.find((b) => String(b.id) === String(bookId));
          if (book) {
            openModal(book);
          }
        }
      });
    }

    // Modal controls
    if (elements.modalCloseBtn) elements.modalCloseBtn.addEventListener("click", closeModal);
    if (elements.modalBackdrop) elements.modalBackdrop.addEventListener("click", closeModal);

    if (elements.modalPlayBtn) {
      elements.modalPlayBtn.addEventListener("click", togglePlayPause);
    }

    if (elements.modalBookmarkBtn) {
      elements.modalBookmarkBtn.addEventListener("click", (e) => {
        if (state.currentBook) {
          toggleBookmark(state.currentBook.id, e);
        }
      });
    }

    // Player Skip Buttons (-15s / +15s)
    if (elements.btnRewind) {
      elements.btnRewind.addEventListener("click", () => {
        state.currentTime = Math.max(0, state.currentTime - 15);
        updateTimeDisplay();
      });
    }

    if (elements.btnForward) {
      elements.btnForward.addEventListener("click", () => {
        state.currentTime = Math.min(state.durationSeconds, state.currentTime + 15);
        updateTimeDisplay();
      });
    }

    // Scrubber drag / input
    if (elements.scrubber) {
      elements.scrubber.addEventListener("input", (e) => {
        state.isSeeking = true;
        const pct = parseFloat(e.target.value) / 100;
        state.currentTime = Math.floor(pct * state.durationSeconds);
        if (elements.currentTimeEl) {
          elements.currentTimeEl.textContent = formatTime(state.currentTime);
        }
      });
      elements.scrubber.addEventListener("change", () => {
        state.isSeeking = false;
      });
    }

    // Speed toggle
    if (elements.btnSpeed) {
      elements.btnSpeed.addEventListener("click", () => {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        const nextIdx = (speeds.indexOf(state.playbackRate) + 1) % speeds.length;
        state.playbackRate = speeds[nextIdx];
        elements.btnSpeed.textContent = `${state.playbackRate}x`;
      });
    }

    // Mini Player bar click -> open modal
    if (elements.miniPlayer) {
      elements.miniPlayer.addEventListener("click", (e) => {
        if (e.target.closest(".mini-play-btn")) {
          e.stopPropagation();
          togglePlayPause();
          return;
        }
        if (state.currentBook) {
          openModal(state.currentBook);
        }
      });
    }
  }

  // Cache elements on load
  function cacheElements() {
    elements.menuBtn = document.getElementById("booksMenuBtn");
    elements.bookmarkBtn = document.getElementById("booksBookmarkBtn");
    elements.bookmarkBadge = document.getElementById("bookmarkBadge");
    elements.searchInput = document.getElementById("booksSearchInput");
    elements.searchClearBtn = document.getElementById("booksSearchClearBtn");
    elements.booksList = document.getElementById("booksList");
    elements.sectionLabel = document.getElementById("sectionLabel");
    elements.sectionCount = document.getElementById("sectionCount");

    elements.sidebar = document.getElementById("booksSidebar");
    elements.sidebarBackdrop = document.getElementById("sidebarBackdrop");
    elements.sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
    elements.sidebarSavedBadge = document.getElementById("sidebarSavedBadge");
    elements.themeSwitchBtn = document.getElementById("sidebarThemeSwitch");

    elements.modalBackdrop = document.getElementById("modalBackdrop");
    elements.bookModal = document.getElementById("bookModal");
    elements.modalCloseBtn = document.getElementById("modalCloseBtn");
    elements.modalCover = document.getElementById("modalCover");
    elements.modalTitle = document.getElementById("modalTitle");
    elements.modalAuthor = document.getElementById("modalAuthor");
    elements.modalGenre = document.getElementById("modalGenre");
    elements.modalNarrator = document.getElementById("modalNarrator");
    elements.modalSize = document.getElementById("modalSize");
    elements.modalDuration = document.getElementById("modalDuration");
    elements.modalPlayBtn = document.getElementById("modalPlayBtn");
    elements.modalBookmarkBtn = document.getElementById("modalBookmarkBtn");
    elements.modalTgLink = document.getElementById("modalTgLink");
    elements.scrubber = document.getElementById("playerScrubber");
    elements.currentTimeEl = document.getElementById("playerCurrentTime");
    elements.durationTimeEl = document.getElementById("playerDurationTime");
    elements.btnRewind = document.getElementById("btnRewind");
    elements.btnForward = document.getElementById("btnForward");
    elements.btnSpeed = document.getElementById("btnSpeed");

    elements.miniPlayer = document.getElementById("miniPlayer");
    elements.miniCover = document.getElementById("miniCover");
    elements.miniTitle = document.getElementById("miniTitle");
    elements.miniAuthor = document.getElementById("miniAuthor");
    elements.miniPlayBtn = document.getElementById("miniPlayBtn");
  }

  // Document Ready Initialization
  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    initTelegram();
    initTheme();
    loadSavedIds();
    setupEventListeners();
    loadBooks();
  });
})();
