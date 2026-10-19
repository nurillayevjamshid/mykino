/**
 * NTV Audio Kitoblar (Audiobooks) Section — Client Logic
 * Implements Telegram WebApp SDK, Spotify Charts layout,
 * bookmarking (watermark) persistence, live search, genre filters,
 * responsive modal bottom sheets, and native Telegram audio playback.
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
  };

  // DOM Elements cache
  const elements = {};

  function initElements() {
    elements.booksList = document.getElementById("booksList");
    elements.sectionCount = document.getElementById("sectionCount");
    elements.sectionLabel = document.getElementById("sectionLabel");
    elements.searchInput = document.getElementById("booksSearchInput");
    elements.searchClearBtn = document.getElementById("booksSearchClearBtn");
    elements.genrePills = document.querySelectorAll(".genre-pill");

    elements.menuBtn = document.getElementById("booksMenuBtn");
    elements.topbarBookmarkBtn = document.getElementById("booksBookmarkBtn");
    elements.bookmarkBadge = document.getElementById("bookmarkBadge");

    elements.sidebar = document.getElementById("booksSidebar");
    elements.sidebarBackdrop = document.getElementById("sidebarBackdrop");
    elements.sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
    elements.sidebarSavedBadge = document.getElementById("sidebarSavedBadge");
    elements.sidebarSavedBooksBtn = document.getElementById("sidebarSavedBooksBtn");
    elements.sidebarThemeSwitch = document.getElementById("sidebarThemeSwitch");

    elements.modalBackdrop = document.getElementById("modalBackdrop");
    elements.bookModal = document.getElementById("bookModal");
    elements.modalCloseBtn = document.getElementById("modalCloseBtn");
    elements.modalCoverImg = document.getElementById("modalCoverImg");
    elements.modalCoverFallback = document.getElementById("modalCoverFallback");
    elements.modalTitle = document.getElementById("modalTitle");
    elements.modalAuthor = document.getElementById("modalAuthor");
    elements.modalGenre = document.getElementById("modalGenre");
    elements.modalNarrator = document.getElementById("modalNarrator");
    elements.modalSize = document.getElementById("modalSize");
    elements.modalDuration = document.getElementById("modalDuration");
    elements.modalDescBox = document.getElementById("modalDescBox");
    elements.modalDescText = document.getElementById("modalDescText");
    elements.modalListenTgBtn = document.getElementById("modalListenTgBtn");
    elements.modalBookmarkBtn = document.getElementById("modalBookmarkBtn");

    elements.miniPlayer = document.getElementById("miniPlayer");
    elements.miniCover = document.getElementById("miniCover");
    elements.miniTitle = document.getElementById("miniTitle");
    elements.miniAuthor = document.getElementById("miniAuthor");
    elements.miniListenBtn = document.getElementById("miniListenBtn");
  }

  // Telegram WebApp Initialization
  function initTelegram() {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor("#0b0e14");
        if (tg.setBackgroundColor) tg.setBackgroundColor("#0b0e14");

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
      console.warn("Telegram WebApp init:", e);
    }
  }

  // Bookmarks (Watermark) Persistence via LocalStorage
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
    updateBookmarkBadges();
  }

  function saveSavedIds() {
    try {
      localStorage.setItem("ntv_saved_audiobooks", JSON.stringify(Array.from(state.savedIds)));
    } catch (_) {}
    updateBookmarkBadges();
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

  function updateBookmarkBadges() {
    const count = state.savedIds.size;
    if (elements.bookmarkBadge) {
      elements.bookmarkBadge.textContent = count > 0 ? count : "";
      elements.bookmarkBadge.setAttribute("data-count", count);
    }
    if (elements.sidebarSavedBadge) {
      elements.sidebarSavedBadge.textContent = count;
    }
  }

  // Load Audiobooks from Serverless API or Static Fallback
  async function loadBooks() {
    try {
      const resp = await fetch("/api/books", { cache: "default" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && Array.isArray(data.books) && data.books.length > 0) {
          state.books = data.books;
          render();
          return;
        }
      }
    } catch (_) {}

    try {
      const staticResp = await fetch("/books/books.json?v=" + Date.now());
      if (staticResp.ok) {
        const data = await staticResp.json();
        if (Array.isArray(data) && data.length > 0) {
          state.books = data;
          render();
          return;
        }
      }
    } catch (err) {
      console.error("Failed to load books.json:", err);
    }
  }

  // Filter Audiobooks
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

  function setFilter(filterName) {
    state.activeFilter = filterName;
    elements.genrePills.forEach((btn) => {
      const active = btn.getAttribute("data-filter") === filterName;
      btn.classList.toggle("is-active", active);
    });

    if (elements.sectionLabel) {
      if (filterName === "saqlanganlar") {
        elements.sectionLabel.textContent = "Saqlangan audio kitoblar";
      } else if (filterName !== "barchasi") {
        elements.sectionLabel.textContent = `${filterName} janridagi kitoblar`;
      } else {
        elements.sectionLabel.textContent = "Kanal bo'yicha so'nggi qo'shilganlar";
      }
    }

    render();
  }

  // Render Spotify Charts Audiobook List
  function render() {
    if (!elements.booksList) return;

    const list = getFilteredBooks();

    if (elements.sectionCount) {
      elements.sectionCount.textContent = `${list.length} ta kitob`;
    }

    if (list.length === 0) {
      if (state.activeFilter === "saqlanganlar") {
        elements.booksList.innerHTML = `
          <div class="books-empty">
            <div class="books-empty-icon">🔖</div>
            <div class="books-empty-title">Saqlangan audio kitoblar yo'q</div>
            <div class="books-empty-hint">O'zingizga yoqqan audio kitoblar yonidagi saqlash (watermark) belgisini bosing.</div>
          </div>
        `;
      } else {
        elements.booksList.innerHTML = `
          <div class="books-empty">
            <div class="books-empty-icon">🔍</div>
            <div class="books-empty-title">Audio kitob topilmadi</div>
            <div class="books-empty-hint">Boshqa so'z bilan qidirib ko'ring yoki boshqa janrni tanlang.</div>
          </div>
        `;
      }
      return;
    }

    elements.booksList.innerHTML = list
      .map((book, index) => {
        const rank = index + 1;
        const isSaved = state.savedIds.has(String(book.id));
        const initials = getInitials(book.title);
        const gradient = book.coverGradient || "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
        const coverImg = book.coverImage
          ? `<img src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.title)}" loading="lazy" onerror="this.remove()" />`
          : "";

        const rankClass = rank === 1 ? "is-top1" : rank === 2 ? "is-top2" : rank === 3 ? "is-top3" : "";

        // Format duration display
        const durationText = book.duration || `${book.minutes || 14} daqiqa`;

        return `
          <div class="book-chart-row" data-id="${book.id}">
            <!-- Rank Number Badge OUTSIDE the card -->
            <div class="chart-rank ${rankClass}">#${rank}</div>

            <!-- Dark Rounded Card Container -->
            <div class="chart-card" data-action="open" data-id="${book.id}">
              <!-- Square Cover Art -->
              <div class="chart-cover" style="background: ${gradient};">
                ${coverImg}
                <span>${initials}</span>
              </div>

              <!-- Middle Info: Title and Author -->
              <div class="chart-info">
                <div class="chart-title">${escapeHtml(book.title)}</div>
                <div class="chart-author">${escapeHtml(book.author)}</div>
                <div class="chart-narrator-pill">🎙️ ${escapeHtml(book.narrator)}</div>
              </div>

              <!-- Right Actions: Duration spaced exactly 80px before Watermark/Bookmark Icon, then Next Icon -->
              <div class="chart-actions">
                <span class="chart-duration">${escapeHtml(durationText)}</span>

                <button type="button" class="chart-bookmark-btn ${isSaved ? "is-saved" : ""}" data-action="bookmark" data-id="${book.id}" aria-label="Saqlash" title="${isSaved ? "Saqlangandan o'chirish" : "Saqlash"}">
                  <svg viewBox="0 0 24 24" fill="${isSaved ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                  </svg>
                </button>

                <div class="chart-next-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function getInitials(title) {
    if (!title) return "📖";
    const clean = title.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "📖";
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

  // Real Playback / Open Telegram Audio Post
  function playBook(book) {
    if (!book) return;
    state.currentBook = book;
    updateMiniPlayer();

    const postUrl = book.postUrl || `https://t.me/audiokitoblar_uz/${book.id}`;

    // Inside Telegram WebApp, open the real post in Telegram audio player
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(postUrl);
    } else {
      window.open(postUrl, "_blank");
    }
  }

  // Modal Dialog Actions
  function openModal(book) {
    state.currentBook = book;
    updateModalDetails();

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

    if (book.coverImage && elements.modalCoverImg) {
      elements.modalCoverImg.src = book.coverImage;
      elements.modalCoverImg.hidden = false;
      if (elements.modalCoverFallback) elements.modalCoverFallback.hidden = true;
    } else if (elements.modalCoverFallback) {
      if (elements.modalCoverImg) elements.modalCoverImg.hidden = true;
      elements.modalCoverFallback.hidden = false;
      elements.modalCoverFallback.style.background = book.coverGradient || "linear-gradient(135deg, #2563eb 0%, #1e3a8a 100%)";
      elements.modalCoverFallback.textContent = getInitials(book.title);
    }

    if (elements.modalTitle) elements.modalTitle.textContent = book.title;
    if (elements.modalAuthor) elements.modalAuthor.textContent = book.author;
    if (elements.modalGenre) elements.modalGenre.textContent = book.genre || "Hikoya";
    if (elements.modalNarrator) elements.modalNarrator.textContent = book.narrator || "Suxandon";
    if (elements.modalSize) elements.modalSize.textContent = book.size || "—";
    if (elements.modalDuration) elements.modalDuration.textContent = book.duration || `${book.minutes} daqiqa`;

    if (elements.modalDescBox && elements.modalDescText) {
      if (book.description && book.description.trim().length > 10) {
        elements.modalDescText.textContent = book.description;
        elements.modalDescBox.hidden = false;
      } else {
        elements.modalDescBox.hidden = true;
      }
    }

    updateModalBookmarkBtn();
  }

  function updateModalBookmarkBtn() {
    if (!elements.modalBookmarkBtn || !state.currentBook) return;
    const isSaved = state.savedIds.has(String(state.currentBook.id));
    elements.modalBookmarkBtn.classList.toggle("is-saved", isSaved);
    elements.modalBookmarkBtn.setAttribute("title", isSaved ? "Saqlangandan o'chirish" : "Saqlash");
    const svg = elements.modalBookmarkBtn.querySelector("svg");
    if (svg) svg.setAttribute("fill", isSaved ? "currentColor" : "none");
  }

  // Mini Player Sticky Quick Bar
  function updateMiniPlayer() {
    const book = state.currentBook;
    if (!elements.miniPlayer || !book) return;

    elements.miniPlayer.classList.add("is-visible");
    if (elements.miniCover) {
      if (book.coverImage) {
        elements.miniCover.innerHTML = `<img src="${escapeHtml(book.coverImage)}" alt="" />`;
      } else {
        elements.miniCover.style.background = book.coverGradient || "#2563eb";
        elements.miniCover.textContent = getInitials(book.title);
      }
    }
    if (elements.miniTitle) elements.miniTitle.textContent = book.title;
    if (elements.miniAuthor) elements.miniAuthor.textContent = `${book.author} • ${book.duration || ""}`;
  }

  // Sidebar Controls (Matching Main Mini App)
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

  // Event Listeners Setup
  function bindEvents() {
    // Menu hamburger button
    elements.menuBtn?.addEventListener("click", () => {
      openSidebar();
    });

    // Topbar Bookmark button (shows saved books)
    elements.topbarBookmarkBtn?.addEventListener("click", () => {
      setFilter("saqlanganlar");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Sidebar Close
    elements.sidebarCloseBtn?.addEventListener("click", closeSidebar);
    elements.sidebarBackdrop?.addEventListener("click", closeSidebar);

    // Sidebar Saved Books button
    elements.sidebarSavedBooksBtn?.addEventListener("click", () => {
      closeSidebar();
      setFilter("saqlanganlar");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Sidebar Theme Switch toggle
    elements.sidebarThemeSwitch?.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") !== "light";
      document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
    });

    // Modal Close
    elements.modalCloseBtn?.addEventListener("click", closeModal);
    elements.modalBackdrop?.addEventListener("click", closeModal);

    // Modal Listen in Telegram Button
    elements.modalListenTgBtn?.addEventListener("click", () => {
      playBook(state.currentBook);
    });

    // Modal Bookmark Toggle
    elements.modalBookmarkBtn?.addEventListener("click", () => {
      if (state.currentBook) {
        toggleBookmark(state.currentBook.id);
      }
    });

    // Mini Player Quick Bar click
    elements.miniPlayer?.addEventListener("click", (e) => {
      if (e.target.closest("#miniListenBtn")) {
        playBook(state.currentBook);
      } else {
        openModal(state.currentBook);
      }
    });

    // Search input
    elements.searchInput?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      if (elements.searchClearBtn) {
        elements.searchClearBtn.hidden = !state.searchQuery;
      }
      render();
    });

    elements.searchClearBtn?.addEventListener("click", () => {
      if (elements.searchInput) {
        elements.searchInput.value = "";
        state.searchQuery = "";
        elements.searchClearBtn.hidden = true;
        render();
      }
    });

    // Genre Filter Pills
    elements.genrePills?.forEach((btn) => {
      btn.addEventListener("click", () => {
        const f = btn.getAttribute("data-filter") || "barchasi";
        setFilter(f);
      });
    });

    // Delegated clicks on books list
    elements.booksList?.addEventListener("click", (e) => {
      const bookmarkBtn = e.target.closest('[data-action="bookmark"]');
      if (bookmarkBtn) {
        const id = bookmarkBtn.getAttribute("data-id");
        toggleBookmark(id, e);
        return;
      }

      const card = e.target.closest('[data-action="open"]');
      if (card) {
        const id = card.getAttribute("data-id");
        const book = state.books.find((b) => String(b.id) === String(id));
        if (book) {
          openModal(book);
        }
      }
    });
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", () => {
    initElements();
    initTelegram();
    loadSavedIds();
    bindEvents();
    loadBooks();
  });

  // Global exports for inline triggers
  window.closeSidebar = closeSidebar;
})();
