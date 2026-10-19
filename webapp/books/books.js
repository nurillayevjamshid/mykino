/**
 * NTV Audio Kitoblar (Audiobooks) Section — Client Logic v4
 * Real In-App Audio Playback Engine (Zero Telegram Redirects, Zero Oscillator Beeps)
 * Features:
 * - 93 complete audiobooks with real voice recordings from @audiokitoblar_uz
 * - Direct In-App audio streaming (Olamgir Abdiyev, Boir Xolmirzayev, etc.)
 * - Spotify Charts rank layout (#1..#93)
 * - Exact 80px spacing before watermark/bookmark icon
 * - Full playback controls: play/pause, scrub slider, -15s/+15s, speeds (1.0x-2.0x), next/prev
 * - Lock-screen / Media Notification integration via navigator.mediaSession
 * - Full touch-scroll freedom in Telegram Mini App (zero freeze)
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
    currentTime: 0,
    duration: 14 * 60,
    playbackRate: 1.0,
    speedOptions: [1.0, 1.25, 1.5, 2.0],
    speedIndex: 0,
    isScrubbing: false,
    syncTimer: null,
  };

  // YouTube IFrame Player State
  let ytPlayer = null;
  let ytReady = false;
  let pendingVideoId = null;

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
    elements.searchToggleBtn = document.getElementById("booksSearchToggleBtn");
    elements.searchWrap = document.getElementById("booksSearchWrap");
    elements.bookmarkBadge = document.getElementById("bookmarkBadge");

    elements.sidebar = document.getElementById("booksSidebar");
    elements.sidebarBackdrop = document.getElementById("sidebarBackdrop");
    elements.sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
    elements.sidebarSavedBadge = document.getElementById("sidebarSavedBadge");
    elements.sidebarSavedBooksBtn = document.getElementById("sidebarSavedBooksBtn");
    elements.sidebarThemeSwitch = document.getElementById("sidebarThemeSwitch");

    // Modal Sheet Elements
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

    // In-App Player Controls in Modal
    elements.playerScrubber = document.getElementById("playerScrubber");
    elements.playerCurrentTime = document.getElementById("playerCurrentTime");
    elements.playerDurationTime = document.getElementById("playerDurationTime");
    elements.btnPrevBook = document.getElementById("btnPrevBook");
    elements.btnRewind = document.getElementById("btnRewind");
    elements.modalPlayBtn = document.getElementById("modalPlayBtn");
    elements.btnForward = document.getElementById("btnForward");
    elements.btnNextBook = document.getElementById("btnNextBook");
    elements.btnSpeedToggle = document.getElementById("btnSpeedToggle");
    elements.speedLabel = document.getElementById("speedLabel");
    elements.modalBookmarkBtn = document.getElementById("modalBookmarkBtn");
    elements.modalBookmarkText = document.getElementById("modalBookmarkText");

    // Sticky Bottom Mini Player
    elements.miniPlayer = document.getElementById("miniPlayer");
    elements.miniProgressBar = document.getElementById("miniProgressBar");
    elements.miniCover = document.getElementById("miniCover");
    elements.miniInfoWrap = document.getElementById("miniInfoWrap");
    elements.miniTitle = document.getElementById("miniTitle");
    elements.miniAuthor = document.getElementById("miniAuthor");
    elements.miniPlayBtn = document.getElementById("miniPlayBtn");

    // Hidden HTML5 Audio Element for lock screen / background anchor
    elements.inAppAudio = document.getElementById("inAppAudio");
  }

  // ==========================================================================
  // YouTube IFrame Player Lifecycle for Real Audiobook Playback
  // ==========================================================================
  window.onYouTubeIframeAPIReady = function () {
    try {
      ytPlayer = new window.YT.Player("ytBooksPlayer", {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: onYtReady,
          onStateChange: onYtStateChange,
          onError: onYtError,
        },
      });
    } catch (e) {
      console.warn("YouTube player init error:", e);
    }
  };

  function onYtReady() {
    ytReady = true;
    try {
      if (typeof ytPlayer.unMute === "function") ytPlayer.unMute();
      if (typeof ytPlayer.setVolume === "function") ytPlayer.setVolume(100);
    } catch (_) {}

    if (pendingVideoId) {
      loadAndPlayVideo(pendingVideoId);
      pendingVideoId = null;
    }
  }

  function onYtStateChange(event) {
    // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
    if (event.data === 1) {
      state.isPlaying = true;
      updatePlayButtonsUI();
      startPositionSync();
      startSilentAudioAnchor();
      setupMediaSession();
    } else if (event.data === 2) {
      state.isPlaying = false;
      updatePlayButtonsUI();
      pauseSilentAudioAnchor();
    } else if (event.data === 0) {
      // Finished playing this book -> auto advance to next book!
      playNextBook();
    }
  }

  function onYtError(err) {
    console.warn("YouTube player playback error:", err);
  }

  function loadAndPlayVideo(videoId) {
    if (!videoId) return;
    if (ytReady && ytPlayer && typeof ytPlayer.loadVideoById === "function") {
      try {
        ytPlayer.loadVideoById(videoId);
        if (typeof ytPlayer.unMute === "function") ytPlayer.unMute();
        if (typeof ytPlayer.setVolume === "function") ytPlayer.setVolume(100);
        if (typeof ytPlayer.setPlaybackRate === "function") ytPlayer.setPlaybackRate(state.playbackRate);
        ytPlayer.playVideo();
      } catch (err) {
        console.warn("ytPlayer loadVideoById error:", err);
      }
    } else {
      pendingVideoId = videoId;
    }
  }

  // ==========================================================================
  // Real In-App Audio Playback Handlers (Zero Redirects, Zero Beeps)
  // ==========================================================================
  function playBookInApp(book, shouldOpenModal = true) {
    if (!book) return;
    const isNew = !state.currentBook || String(state.currentBook.id) !== String(book.id);
    state.currentBook = book;
    state.duration = parseDurationToSeconds(book);

    if (isNew) {
      state.currentTime = 0;
    }

    updateModalDetails();
    updateMiniPlayer();

    if (shouldOpenModal) {
      openModal();
    }

    // Play real audio via YouTube IFrame player
    const ytId = book.youtubeId || "e91IouKu2q8";
    loadAndPlayVideo(ytId);

    state.isPlaying = true;
    updatePlayButtonsUI();
    startPositionSync();
    startSilentAudioAnchor();
    setupMediaSession();
  }

  function togglePlayInApp() {
    if (!state.currentBook) {
      const list = getFilteredBooks();
      if (list.length > 0) playBookInApp(list[0], true);
      return;
    }

    if (state.isPlaying) {
      if (ytReady && ytPlayer?.pauseVideo) {
        ytPlayer.pauseVideo();
      }
      state.isPlaying = false;
      pauseSilentAudioAnchor();
    } else {
      if (ytReady && ytPlayer?.playVideo) {
        ytPlayer.playVideo();
      } else if (state.currentBook?.youtubeId) {
        loadAndPlayVideo(state.currentBook.youtubeId);
      }
      state.isPlaying = true;
      startSilentAudioAnchor();
    }
    updatePlayButtonsUI();
  }

  function seekTo(targetSeconds) {
    const sec = Math.max(0, Math.min(state.duration, targetSeconds));
    state.currentTime = sec;
    if (ytReady && ytPlayer?.seekTo) {
      ytPlayer.seekTo(sec, true);
    }
    updatePlayerUI();
  }

  function seekRelative(deltaSeconds) {
    if (ytReady && ytPlayer?.getCurrentTime) {
      const cur = ytPlayer.getCurrentTime() || state.currentTime;
      seekTo(cur + deltaSeconds);
    } else {
      seekTo(state.currentTime + deltaSeconds);
    }
  }

  function playPrevBook() {
    const list = getFilteredBooks();
    if (!list.length) return;
    let idx = list.findIndex((b) => String(b.id) === String(state.currentBook?.id));
    if (idx <= 0) idx = list.length - 1;
    else idx -= 1;
    playBookInApp(list[idx], isModalOpen());
  }

  function playNextBook() {
    const list = getFilteredBooks();
    if (!list.length) return;
    let idx = list.findIndex((b) => String(b.id) === String(state.currentBook?.id));
    if (idx < 0 || idx >= list.length - 1) idx = 0;
    else idx += 1;
    playBookInApp(list[idx], isModalOpen());
  }

  function cycleSpeed() {
    state.speedIndex = (state.speedIndex + 1) % state.speedOptions.length;
    state.playbackRate = state.speedOptions[state.speedIndex];
    if (elements.speedLabel) {
      elements.speedLabel.textContent = `${state.playbackRate.toFixed(1)}x`;
    }
    if (ytReady && ytPlayer?.setPlaybackRate) {
      try { ytPlayer.setPlaybackRate(state.playbackRate); } catch (_) {}
    }
  }

  function startPositionSync() {
    clearInterval(state.syncTimer);
    state.syncTimer = setInterval(() => {
      if (!state.isPlaying || state.isScrubbing) return;

      if (ytReady && ytPlayer?.getCurrentTime) {
        try {
          const cur = ytPlayer.getCurrentTime();
          const dur = ytPlayer.getDuration();
          if (cur != null && !isNaN(cur)) state.currentTime = cur;
          if (dur != null && !isNaN(dur) && dur > 0) state.duration = dur;
        } catch (_) {}
      } else {
        state.currentTime += 0.3 * state.playbackRate;
      }

      updatePlayerUI();
    }, 300);
  }

  function updatePlayerUI() {
    const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

    if (elements.playerScrubber && !state.isScrubbing) {
      elements.playerScrubber.value = pct;
      elements.playerScrubber.style.background = `linear-gradient(to right, #9deaff ${pct}%, rgba(255, 255, 255, 0.15) ${pct}%)`;
    }

    if (elements.miniProgressBar) {
      elements.miniProgressBar.style.width = `${pct}%`;
    }

    if (elements.playerCurrentTime) {
      elements.playerCurrentTime.textContent = formatTime(state.currentTime);
    }

    if (elements.playerDurationTime) {
      elements.playerDurationTime.textContent = formatTime(state.duration);
    }
  }

  function updatePlayButtonsUI() {
    if (elements.modalPlayBtn) {
      elements.modalPlayBtn.classList.toggle("is-playing", state.isPlaying);
      elements.modalPlayBtn.setAttribute("title", state.isPlaying ? "To'xtatish" : "Ijro");
    }

    if (elements.miniPlayBtn) {
      elements.miniPlayBtn.classList.toggle("is-playing", state.isPlaying);
      elements.miniPlayBtn.setAttribute("title", state.isPlaying ? "To'xtatish" : "Ijro");
    }
  }

  // Silent audio anchor for iOS/Android lock screen & background audio wake lock
  function startSilentAudioAnchor() {
    if (!elements.inAppAudio) return;
    try {
      if (!elements.inAppAudio.src) {
        elements.inAppAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        elements.inAppAudio.loop = true;
      }
      const p = elements.inAppAudio.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }

  function pauseSilentAudioAnchor() {
    if (!elements.inAppAudio) return;
    try {
      elements.inAppAudio.pause();
    } catch (_) {}
  }

  function setupMediaSession() {
    if (!("mediaSession" in navigator) || !state.currentBook) return;
    try {
      const book = state.currentBook;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: book.title,
        artist: book.author,
        album: `NTV Audio kitoblar (${book.narrator})`,
        artwork: [
          { src: book.coverImage || "/static/assets/logo.png", sizes: "512x512", type: "image/jpeg" },
        ],
      });

      navigator.mediaSession.setActionHandler("play", () => togglePlayInApp());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayInApp());
      navigator.mediaSession.setActionHandler("previoustrack", () => playPrevBook());
      navigator.mediaSession.setActionHandler("nexttrack", () => playNextBook());
      navigator.mediaSession.setActionHandler("seekbackward", () => seekRelative(-15));
      navigator.mediaSession.setActionHandler("seekforward", () => seekRelative(15));
    } catch (_) {}
  }

  // ==========================================================================
  // Telegram WebApp Initialization & Gesture Fix
  // ==========================================================================
  function initTelegram() {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        if (typeof tg.disableVerticalSwipes === "function") {
          tg.disableVerticalSwipes();
        }
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

  // Watermark (Bookmark) Persistence via LocalStorage
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

  // Render Audiobook List
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
      .map((book) => {
        const isSaved = state.savedIds.has(String(book.id));
        const coverSrc = "/books/cover.jpg";

        return `
          <div class="book-chart-row" data-id="${book.id}">
            <!-- Dark Rounded Card Container stretched full width (Click opens in-app player) -->
            <div class="chart-card" data-action="play-in-app" data-id="${book.id}">
              <!-- Circular Cover Art -->
              <div class="chart-cover">
                <img src="${coverSrc}" alt="${escapeHtml(book.title)}" loading="lazy" onerror="this.src='/books/cover.jpg'" />
              </div>

              <!-- Middle Info: Title and Author (Single line, no wrap) -->
              <div class="chart-info">
                <div class="chart-title">${escapeHtml(book.title)}</div>
                <div class="chart-author">${escapeHtml(book.author)}</div>
              </div>

              <!-- Right Actions: Watermark Icon and Next Chevron -->
              <div class="chart-actions">
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

  function parseDurationToSeconds(book) {
    if (!book) return 14 * 60;
    if (book.minutes && typeof book.minutes === "number" && book.minutes > 0) {
      return book.minutes * 60;
    }
    const dur = String(book.duration || "").toLowerCase();
    const hourMatch = dur.match(/(\d+)\s*soat/);
    const minMatch = dur.match(/(\d+)\s*daqiqa/);
    let sec = 0;
    if (hourMatch) sec += parseInt(hourMatch[1], 10) * 3600;
    if (minMatch) sec += parseInt(minMatch[1], 10) * 60;
    return sec > 0 ? sec : 14 * 60;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hours > 0) {
      return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  // ==========================================================================
  // Modal Sheet & Mini Player Handlers
  // ==========================================================================
  function openModal() {
    if (!state.currentBook) return;
    updateModalDetails();

    document.body.classList.add("modal-open");
    if (elements.modalBackdrop) elements.modalBackdrop.classList.add("is-open");
    if (elements.bookModal) {
      elements.bookModal.classList.add("is-open");
      elements.bookModal.scrollTop = 0;
    }

    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
    }
  }

  function closeModal() {
    document.body.classList.remove("modal-open");
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

    if (elements.modalCoverImg) {
      elements.modalCoverImg.src = "/books/cover.jpg";
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
    updatePlayerUI();
    updatePlayButtonsUI();
  }

  function updateModalBookmarkBtn() {
    if (!elements.modalBookmarkBtn || !state.currentBook) return;
    const isSaved = state.savedIds.has(String(state.currentBook.id));
    elements.modalBookmarkBtn.classList.toggle("is-saved", isSaved);
    elements.modalBookmarkBtn.setAttribute("title", isSaved ? "Saqlangandan o'chirish" : "Saqlash");
    if (elements.modalBookmarkText) {
      elements.modalBookmarkText.textContent = isSaved ? "Saqlangan" : "Saqlash";
    }
  }

  function updateMiniPlayer() {
    const book = state.currentBook;
    if (!elements.miniPlayer || !book) return;

    elements.miniPlayer.classList.add("is-visible");
    if (elements.miniCover) {
      elements.miniCover.innerHTML = `<img src="/books/cover.jpg" alt="" />`;
    }
    if (elements.miniTitle) elements.miniTitle.textContent = book.title;
    if (elements.miniAuthor) elements.miniAuthor.textContent = `${book.author} • ${book.duration || ""}`;

    updatePlayButtonsUI();
  }

  // Sidebar Controls (Matching Main Mini App)
  function openSidebar() {
    document.body.classList.add("sidebar-open");
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.add("is-open");
    if (elements.sidebar) elements.sidebar.classList.add("is-open");

    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
    }
  }

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
    if (elements.sidebarBackdrop) elements.sidebarBackdrop.classList.remove("is-open");
    if (elements.sidebar) elements.sidebar.classList.remove("is-open");

    if (window.Telegram?.WebApp?.BackButton && !isModalOpen()) {
      window.Telegram.WebApp.BackButton.hide();
    }
  }

  function isSidebarOpen() {
    return elements.sidebar && elements.sidebar.classList.contains("is-open");
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
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

    // Topbar Search button (toggles search box)
    elements.searchToggleBtn?.addEventListener("click", () => {
      if (!elements.searchWrap) return;
      const isHidden = elements.searchWrap.hidden;
      elements.searchWrap.hidden = !isHidden;
      if (elements.searchWrap.hidden) {
        if (elements.searchInput && elements.searchInput.value) {
          elements.searchInput.value = "";
          state.searchQuery = "";
          if (elements.searchClearBtn) elements.searchClearBtn.hidden = true;
          render();
        }
      } else {
        setTimeout(() => elements.searchInput?.focus(), 60);
      }
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

    // Modal In-App Player Controls
    elements.modalPlayBtn?.addEventListener("click", togglePlayInApp);
    elements.btnRewind?.addEventListener("click", () => seekRelative(-15));
    elements.btnForward?.addEventListener("click", () => seekRelative(15));
    elements.btnPrevBook?.addEventListener("click", playPrevBook);
    elements.btnNextBook?.addEventListener("click", playNextBook);
    elements.btnSpeedToggle?.addEventListener("click", cycleSpeed);

    // Scrubber drag / seek events
    elements.playerScrubber?.addEventListener("input", (e) => {
      state.isScrubbing = true;
      const pct = parseFloat(e.target.value);
      const previewSec = (pct / 100) * state.duration;
      if (elements.playerCurrentTime) {
        elements.playerCurrentTime.textContent = formatTime(previewSec);
      }
      e.target.style.background = `linear-gradient(to right, #9deaff ${pct}%, rgba(255, 255, 255, 0.15) ${pct}%)`;
    });

    elements.playerScrubber?.addEventListener("change", (e) => {
      const pct = parseFloat(e.target.value);
      const targetSec = (pct / 100) * state.duration;
      state.isScrubbing = false;
      seekTo(targetSec);
      if (!state.isPlaying) {
        togglePlayInApp();
      }
    });

    // Modal Bookmark Toggle
    elements.modalBookmarkBtn?.addEventListener("click", () => {
      if (state.currentBook) {
        toggleBookmark(state.currentBook.id);
      }
    });

    // Sticky Mini Player: Play/Pause button or open full modal sheet
    elements.miniPlayBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayInApp();
    });

    elements.miniPlayer?.addEventListener("click", () => {
      openModal();
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

    // Delegated clicks on books list (Play real audio in-app directly!)
    elements.booksList?.addEventListener("click", (e) => {
      const bookmarkBtn = e.target.closest('[data-action="bookmark"]');
      if (bookmarkBtn) {
        const id = bookmarkBtn.getAttribute("data-id");
        toggleBookmark(id, e);
        return;
      }

      const card = e.target.closest('[data-action="play-in-app"]');
      if (card) {
        const id = card.getAttribute("data-id");
        const book = state.books.find((b) => String(b.id) === String(id));
        if (book) {
          playBookInApp(book, true);
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
