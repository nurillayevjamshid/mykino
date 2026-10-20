// Musiqa moduli — lazy-load qilinadi (app.js ichidagi ensureMusicModule orqali).
// Tashqi global'lar app.js dan kelishi kerak: tg, haptic, t, getRank, escapeHtml,
// getTelegramUser, recordMusicListen, tgBackRegister, tgBackUnregister, setFilter,
// ensureYouTubeApi, profileModal.
//
// Tashqariga: window.__music = { openMusicView, closeMusicView, ... }
(function () {
  "use strict";

  // ===== i18n (musiqa moduli uchun mahalliy tarjima jadvali) =====
  // kino.js dagi __i18n.lang ga ergashadi. Yangi til qo'shish uchun shu
  // ob'ektga til kodi va kalit-qiymat juftlarini qo'shish kifoya.
  const MUSIC_COPY = {
    uz: {
      addToPlaylist: "Playlistga qo'shish",
      play: "Play",
      back: "Orqaga",
      prevPage: "Oldingi sahifa",
      nextPage: "Keyingi sahifa",
      favoritesPl: "Sevimlilar",
      signInRequired: "Telegram orqali kiring.",
      savePlaylist: "Playlistga saqlash",
      close: "Yopish",
      playlistName: "Playlist nomi",
      saveFailed: "Saqlanmadi.",
      createFailed: "Yaratib bo'lmadi.",
      playlistNeedSignIn: "Playlist saqlash uchun Telegram orqali kiring.",
      myPlaylists: "Mening playlistlarim",
      open: "Ochish",
      manage: "Boshqarish",
      renameFailed: "Nomni o'zgartirib bo'lmadi.",
      deleteFailed: "O'chirib bo'lmadi.",
      choose: "Tanlang",
      renameItem: "Nomini o'zgartirish",
      deleteItem: "O'chirish",
      embedRestricted: "Bu trekni o'ynatib bo'lmadi (embed cheklangan). Boshqasini tanlang.",
      musicLabel: "Music",
      startOver: "Boshidan boshlash",
      startOverOrNext: "Boshidan boshlaysizmi yoki keyingi playlistga o'tasizmi?",
      startOverConfirm: "Boshidan boshlaymizmi?",
      loadFailed: "Yuklab bo'lmadi.",
    },
    ru: {
      addToPlaylist: "Добавить в плейлист",
      play: "Воспроизвести",
      back: "Назад",
      prevPage: "Предыдущая страница",
      nextPage: "Следующая страница",
      favoritesPl: "Избранное",
      signInRequired: "Войдите через Telegram.",
      savePlaylist: "Сохранить в плейлист",
      close: "Закрыть",
      playlistName: "Название плейлиста",
      saveFailed: "Не удалось сохранить.",
      createFailed: "Не удалось создать.",
      playlistNeedSignIn: "Для сохранения плейлиста войдите через Telegram.",
      myPlaylists: "Мои плейлисты",
      open: "Открыть",
      manage: "Управление",
      renameFailed: "Не удалось переименовать.",
      deleteFailed: "Не удалось удалить.",
      choose: "Выберите",
      renameItem: "Переименовать",
      deleteItem: "Удалить",
      embedRestricted: "Этот трек нельзя проиграть (встраивание ограничено). Выберите другой.",
      musicLabel: "Music",
      startOver: "Начать сначала",
      startOverOrNext: "Начать сначала или перейти к следующему плейлисту?",
      startOverConfirm: "Начнём сначала?",
      loadFailed: "Не удалось загрузить.",
    },
    en: {
      addToPlaylist: "Add to playlist",
      play: "Play",
      back: "Back",
      prevPage: "Previous page",
      nextPage: "Next page",
      favoritesPl: "Favorites",
      signInRequired: "Sign in via Telegram.",
      savePlaylist: "Save to playlist",
      close: "Close",
      playlistName: "Playlist name",
      saveFailed: "Failed to save.",
      createFailed: "Failed to create.",
      playlistNeedSignIn: "Sign in via Telegram to save a playlist.",
      myPlaylists: "My playlists",
      open: "Open",
      manage: "Manage",
      renameFailed: "Failed to rename.",
      deleteFailed: "Failed to delete.",
      choose: "Choose",
      renameItem: "Rename",
      deleteItem: "Delete",
      embedRestricted: "This track can't play (embedding restricted). Pick another.",
      musicLabel: "Music",
      startOver: "Start over",
      startOverOrNext: "Start over or move to the next playlist?",
      startOverConfirm: "Start over?",
      loadFailed: "Failed to load.",
    },
  };
  function M(key) {
    const lang = (window.__i18n && window.__i18n.lang) || "uz";
    const table = MUSIC_COPY[lang] || MUSIC_COPY.uz;
    return table[key] || MUSIC_COPY.uz[key] || key;
  }

  // ===== DOM refs =====
  const MUSIC_LOCAL_KEY = "kino_admin_music_v1";
  const musicView = document.getElementById("musicView");
  const musicSearchBtn = document.getElementById("musicSearchBtn");
  const musicSearchBar = document.getElementById("musicSearchBar");
  const musicSearchInput = document.getElementById("musicSearchInput");
  const musicSearchClear = document.getElementById("musicSearchClear");
  const musicCategoryRow = document.getElementById("musicCategoryRow");
  const musicArtistRow = document.getElementById("musicArtistRow");
  const musicListEl = document.getElementById("musicList");
  const musicLoadingEl = document.getElementById("musicLoading");
  const musicErrorEl = document.getElementById("musicError");
  const musicErrorText = document.getElementById("musicErrorText");
  const musicEmptyEl = document.getElementById("musicEmpty");
  const musicRetryBtn = document.getElementById("musicRetryBtn");

  const miniPlayer = document.getElementById("miniPlayer");
  const miniPlayerTitle = document.getElementById("miniPlayerTitle");
  const miniPlayerArtistEl = document.getElementById("miniPlayerArtist");
  const miniPlayerToggle = document.getElementById("miniPlayerToggle");
  const miniPlayerClose = document.getElementById("miniPlayerClose");
  const miniPlayerBarFill = document.getElementById("miniPlayerBarFill");
  const miniPlayerTime = document.getElementById("miniPlayerTime");

  // ===== State =====
  let musicAllTracks = [];
  let musicCategory = "all";
  let musicArtist = "all";
  let musicQuery = "";
  let musicSearchDebounce = null;
  let musicCurrentTrackKey = "";
  let musicArtistsData = [];

  function trackKey(t) {
    return `${(t.title || "").toLowerCase()}|${(t.artist || "").toLowerCase()}|${t.youtubeId || ""}`;
  }

  function displayTrackTitle(t) {
    let title = (t && t.title) || "";
    const idx = title.search(/\s[-–—]\s/);
    if (idx > 0) title = title.slice(idx).replace(/^\s[-–—]\s/, "");
    let prev;
    do {
      prev = title;
      title = title.replace(/\s*[\(\[\{][^\)\]\}]*[\)\]\}]\s*$/, "");
    } while (prev !== title);
    title = title.replace(/\s*[|·—–-]\s+[^|·—–-]*$/i, (m) => {
      return /(audio|video|official|live|lyric|remix|hd|explicit|mv|karaoke|cover)/i.test(m) ? "" : m;
    });
    return title.trim();
  }

  function dedupeTracks(list) {
    const seen = new Map();
    for (const t of list) {
      if (!t || !t.title || !t.artist || !t.youtubeId) continue;
      const key = trackKey(t);
      if (!seen.has(key)) seen.set(key, t);
    }
    return Array.from(seen.values());
  }

  // Random ordering (reshuffled every time music view opens)
  const musicTrackShuffleRanks = new Map();
  const musicCatShuffleRanks = new Map();
  const musicArtistShuffleRanks = new Map();
  function reshuffleMusic() {
    musicTrackShuffleRanks.clear();
    musicCatShuffleRanks.clear();
    musicArtistShuffleRanks.clear();
  }
  function shuffleTracks(list) {
    return [...list].sort((a, b) =>
      getRank(musicTrackShuffleRanks, a?.youtubeId ?? trackKey(a)) -
      getRank(musicTrackShuffleRanks, b?.youtubeId ?? trackKey(b)));
  }
  function shuffleMusicCats(list) {
    return [...list].sort((a, b) => getRank(musicCatShuffleRanks, a) - getRank(musicCatShuffleRanks, b));
  }
  function shuffleMusicArtists(list) {
    return [...list].sort((a, b) => getRank(musicArtistShuffleRanks, a) - getRank(musicArtistShuffleRanks, b));
  }

  function readLocalMusic() {
    try {
      const raw = localStorage.getItem(MUSIC_LOCAL_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }

  function escapeMusicHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  }

  function formatMusicTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function showMusicState(name) {
    [musicLoadingEl, musicErrorEl, musicEmptyEl].forEach((el) => { if (el) el.hidden = true; });
    if (musicListEl) musicListEl.hidden = false;
    if (name === "loading" && musicLoadingEl) { musicLoadingEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
    if (name === "error" && musicErrorEl) { musicErrorEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
    if (name === "empty" && musicEmptyEl) { musicEmptyEl.hidden = false; if (musicListEl) musicListEl.hidden = true; }
  }

  function ensureMusicSplash() {
    let el = document.getElementById("musicSplash");
    if (el) return el;
    el = document.createElement("div");
    el.id = "musicSplash";
    el.className = "music-splash";
    el.hidden = true;
    el.innerHTML = `
      <div class="music-splash__spinner" aria-hidden="true"></div>
      <div class="music-splash__brand">
        <span class="music-splash__logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3" fill="currentColor"></circle>
            <circle cx="18" cy="16" r="3" fill="currentColor"></circle>
          </svg>
        </span>
        <span class="music-splash__name">
          <span>NTV</span>
        </span>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }
  function showMusicSplash() {
    if (window.showSectionSplash) {
      window.showSectionSplash("music");
    } else {
      ensureMusicSplash().hidden = false;
    }
  }
  function hideMusicSplash() {
    if (window.hideSectionSplash) {
      window.hideSectionSplash();
    }
    const el = document.getElementById("musicSplash");
    if (el) el.hidden = true;
  }

  async function loadMusicCatalog() {
    showMusicSplash();
    showMusicState("loading");
    let seed = [];
    try {
      const res = await fetch("/api/music");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      seed = Array.isArray(json.tracks) ? json.tracks : [];
    } catch (err) {
      if (musicErrorText) musicErrorText.textContent = err.message || M("loadFailed");
      showMusicState("error");
      hideMusicSplash();
      return;
    }
    const local = readLocalMusic();
    musicAllTracks = dedupeTracks([...seed, ...local]);
    renderMusicCarousel();
    renderMusicFilters();
    renderMusicList();
    hideMusicSplash();
  }

  function uniqSorted(values) {
    const set = new Set(values.filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function splitArtists(name) {
    if (!name) return [];
    return String(name)
      .split(/\s*(?:&|,)\s*|\s+(?:feat\.?|ft\.?|and|x|×)\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function trackHasArtist(track, artist) {
    if (!track || !artist) return false;
    const list = splitArtists(track.artist);
    const target = artist.toLowerCase();
    return list.some((a) => a.toLowerCase() === target);
  }

  const MUSIC_CATEGORY_ICONS = {
    all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    pop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v8"/><circle cx="12" cy="14" r="6"/><path d="M8 2h8"/></svg>',
    rap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="3" height="8" rx="1"/><rect x="10" y="4" width="3" height="14" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg>',
    rock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l3 6-3 12 6-6 6 6-3-12 3-6-6 4z"/></svg>',
    jazz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v10"/><circle cx="10" cy="15" r="4"/><path d="M14 3l6 3"/></svg>',
    classic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-6m4 6v-6m4 6v-6"/></svg>',
    electronic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>',
    uzbek: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6h6l-5 4 2 7-5.5-4-5.5 4 2-7-5-4h6z"/></svg>',
    folk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V8l10-3v10"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="15" r="3"/></svg>',
    hiphop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="3" height="8" rx="1"/><rect x="10" y="4" width="3" height="14" rx="1"/><rect x="16" y="8" width="3" height="10" rx="1"/></svg>',
  };

  const MUSIC_ARTIST_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
  const MUSIC_DEFAULT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  function musicCategoryIcon(value) {
    const key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
    return MUSIC_CATEGORY_ICONS[key] || MUSIC_DEFAULT_ICON;
  }

  function musicChipHtml({ active, dataAttr, value, label, icon }) {
    return `<button class="music-chip ${active ? "is-active" : ""}" type="button" ${dataAttr}="${escapeMusicHtml(value)}">
      <span class="music-chip__icon" aria-hidden="true">${icon}</span>
      <span class="music-chip__label">${escapeMusicHtml(label)}</span>
    </button>`;
  }

  function findArtistImage(name) {
    const t = String(name || "").toLowerCase();
    const rec = musicArtistsData.find((a) => String(a.name || "").toLowerCase() === t);
    return rec?.image || "";
  }
  function musicArtistCardHtml(name, value = name, label = name) {
    const active = musicArtist === value;
    // 1) saqlangan/kanal artist rasmi, 2) trek thumbnail, 3) chip fallback
    const img = value === "all" ? "" : (findArtistImage(name) || pickArtistFallbackImage(name));
    if (img) {
      return `<button class="music-artist-card ${active ? "is-active" : ""}" type="button" data-music-artist="${escapeMusicHtml(value)}" style="background-image:url('${img.replaceAll("'", "%27")}')">
        <span class="music-artist-card__shade"></span>
        <span class="music-artist-card__label">${escapeMusicHtml(label)}</span>
      </button>`;
    }
    return musicChipHtml({ active, dataAttr: "data-music-artist", value, label, icon: MUSIC_ARTIST_ICON });
  }

  async function fetchMusicArtists() {
    try {
      const res = await fetch("/api/music?resource=artists");
      if (!res.ok) return;
      const json = await res.json();
      musicArtistsData = Array.isArray(json.artists) ? json.artists : [];
    } catch (_) {}
  }

  function trackCategories(t) {
    if (Array.isArray(t.categories) && t.categories.length) return t.categories;
    if (t.category) return [t.category];
    return [];
  }

  function renderMusicFilters() {
    if (musicCategoryRow) {
      const cats = shuffleMusicCats(uniqSorted(musicAllTracks.flatMap(trackCategories)));
      const items = cats.map((c) => musicChipHtml({
        active: musicCategory === c,
        dataAttr: "data-music-cat",
        value: c,
        label: c,
        icon: musicCategoryIcon(c),
      }));
      musicCategoryRow.innerHTML = items.join("");
    }
    if (musicArtistRow) {
      const eligible = shuffleMusicArtists(eligibleArtistNames());
      musicArtistRow.innerHTML = eligible.map((a) => musicArtistCardHtml(a)).join("");
    }
  }

  function filteredMusicTracks() {
    const q = musicQuery.toLowerCase();
    return musicAllTracks.filter((t) => {
      if (musicCategory !== "all" && !trackCategories(t).some((c) => c === musicCategory)) return false;
      if (musicArtist !== "all" && !trackHasArtist(t, musicArtist)) return false;
      if (q) {
        const songName = displayTrackTitle(t).toLowerCase();
        const rawTitle = (t.title || "").toLowerCase();
        const artist = (t.artist || "").toLowerCase();
        if (!songName.includes(q) && !rawTitle.includes(q) && !artist.includes(q)) return false;
      }
      return true;
    });
  }

  const MUSIC_PAGE_SIZE = 20;

  function musicRowHtml(t, playlist) {
    const id = escapeMusicHtml(t.youtubeId);
    const inPl = playlist.includes(t.youtubeId);
    return `
      <li class="music-item">
        <div class="music-row ${trackKey(t) === musicCurrentTrackKey ? "is-playing" : ""}">
          <button class="music-row__main" type="button" data-music-row="${id}">
            <span class="music-row__cover" style="background-image:url('https://i.ytimg.com/vi/${id}/mqdefault.jpg')"></span>
            <span class="music-row__meta">
              <span class="music-row__title">${escapeMusicHtml(displayTrackTitle(t))}</span>
              <span class="music-row__sub">${escapeMusicHtml(t.artist)}</span>
            </span>
          </button>
          <div class="music-row__actions">
            <button class="music-row__btn music-row__btn--add ${inPl ? "is-added" : ""}" type="button" data-music-add="${id}" aria-label="${escapeMusicHtml(M("addToPlaylist"))}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="14" y2="6"></line>
                <line x1="3" y1="12" x2="14" y2="12"></line>
                <line x1="3" y1="18" x2="10" y2="18"></line>
                <polygon points="17 14 17 22 22 18" fill="currentColor" stroke="none"></polygon>
              </svg>
            </button>
            <button class="music-row__btn music-row__btn--play" type="button" data-music-row="${id}" aria-label="${escapeMusicHtml(M("play"))}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z"></path></svg>
            </button>
          </div>
        </div>
      </li>`;
  }

  function renderMusicList() {
    if (!musicListEl) return;
    const list = shuffleTracks(filteredMusicTracks());
    if (!list.length) { showMusicState("empty"); return; }
    showMusicState("data");
    const playlist = readMusicPlaylist();
    const shown = list.slice(0, MUSIC_PAGE_SIZE);
    musicListEl.innerHTML = shown.map((t) => musicRowHtml(t, playlist)).join("");
    if (list.length > MUSIC_PAGE_SIZE) {
      musicListEl.insertAdjacentHTML("beforeend", `
        <li class="music-more">
          <button class="music-more__btn" type="button" data-music-more>Ko'proq ko'rish</button>
        </li>`);
    }
  }

  // ----- Hamma musiqalar (all songs page) -----
  function ensureAllSongsDom() {
    if (!musicView) return null;
    let panel = document.getElementById("musicAllSongs");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "musicAllSongs";
    panel.className = "music-allsongs";
    panel.hidden = true;
    panel.innerHTML = `
      <header class="music-artist-detail__head">
        <button class="music-artist-detail__back" type="button" data-allsongs-back aria-label="${escapeMusicHtml(M("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="music-artist-detail__name">Hamma musiqalar</h1>
      </header>
      <ol class="music-list" id="allSongsList"></ol>
      <div class="music-view__spacer"></div>
    `;
    musicView.appendChild(panel);
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-allsongs-back]")) { closeAllSongs(); return; }
      const catBtn = event.target.closest("[data-music-cat]");
      if (catBtn) {
        musicCategory = catBtn.dataset.musicCat;
        allSongsPage = 1;
        renderAllSongs();
        return;
      }
      const addBtn = event.target.closest("[data-music-add]");
      if (addBtn) {
        event.stopPropagation();
        handleSaveButtonClick(addBtn.dataset.musicAdd);
        return;
      }
      const pageBtn = event.target.closest("[data-allsongs-page]");
      if (pageBtn) {
        if (pageBtn.disabled) return;
        const dir = pageBtn.dataset.allsongsPage;
        const total = Math.max(1, Math.ceil(shuffleTracks(filteredMusicTracks()).length / MUSIC_PAGE_SIZE));
        if (dir === "prev") allSongsPage = Math.max(1, allSongsPage - 1);
        else if (dir === "next") allSongsPage = Math.min(total, allSongsPage + 1);
        renderAllSongs();
        scrollAllSongsTop();
        return;
      }
      const row = event.target.closest("[data-music-row]");
      if (row) {
        const track = musicAllTracks.find((t) => t.youtubeId === row.dataset.musicRow);
        if (track) { setMusicPlayContext({ kind: "list" }); playMusicTrack(track); }
      }
    });
    return panel;
  }

  let allSongsPage = 1;

  // Navigation guards — rapid taps / duplicate routes oldini olish.
  // Har bir "tab" yoki sub-panel uchun oxirgi marta ochilgan vaqtni saqlaymiz;
  // 280ms ichida takror chaqirilsa, no-op qilamiz.
  const __navLast = { tap: 0, key: "" };
  function navLock(key, gapMs = 280) {
    const now = Date.now();
    if (__navLast.key === key && (now - __navLast.tap) < gapMs) return false;
    __navLast.key = key;
    __navLast.tap = now;
    return true;
  }

  // Boshqa music sub-panellarini yopadi (faqat `except` qoldiriladi).
  // Tab almashtirganda ekrandagi eski paneldan tozalanish uchun.
  function closeOtherMusicSubPanels(except) {
    if (except !== "artist-detail") {
      const p = document.getElementById("musicArtistDetail");
      if (p && !p.hidden) { artistDetailOrigin = null; closeArtistDetail(); }
    }
    if (except !== "all-songs") {
      const p = document.getElementById("musicAllSongs");
      if (p && !p.hidden) closeAllSongs();
    }
    if (except !== "all-artists") {
      const p = document.getElementById("musicAllArtists");
      if (p && !p.hidden) closeAllArtists();
    }
    if (except !== "playlists") {
      const p = document.getElementById("musicPlaylistsView");
      if (p && !p.hidden) closePlaylistsView();
    }
  }

  function scrollAllSongsTop() {
    try { document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
  }

  function renderAllSongs() {
    ensureAllSongsDom();
    const catRow = document.getElementById("allSongsCategoryRow");
    if (catRow) {
      const cats = shuffleMusicCats(uniqSorted(musicAllTracks.flatMap(trackCategories)));
      catRow.innerHTML = cats.map((c) => musicChipHtml({
        active: musicCategory === c, dataAttr: "data-music-cat", value: c, label: c, icon: musicCategoryIcon(c),
      })).join("");
    }
    const listEl = document.getElementById("allSongsList");
    if (!listEl) return;
    const playlist = readMusicPlaylist();
    const list = shuffleTracks(filteredMusicTracks());
    if (!list.length) {
      listEl.innerHTML = `<li class="music-state music-state--empty"><span>Hech narsa topilmadi</span></li>`;
      const pager = document.getElementById("allSongsPager");
      if (pager) pager.innerHTML = "";
      return;
    }
    const totalPages = Math.max(1, Math.ceil(list.length / MUSIC_PAGE_SIZE));
    if (allSongsPage > totalPages) allSongsPage = totalPages;
    if (allSongsPage < 1) allSongsPage = 1;
    const start = (allSongsPage - 1) * MUSIC_PAGE_SIZE;
    const slice = list.slice(start, start + MUSIC_PAGE_SIZE);
    listEl.innerHTML = slice.map((t) => musicRowHtml(t, playlist)).join("");
    renderAllSongsPager(totalPages);
  }

  function renderAllSongsPager(totalPages) {
    let pager = document.getElementById("allSongsPager");
    if (!pager) {
      const listEl = document.getElementById("allSongsList");
      if (!listEl) return;
      pager = document.createElement("nav");
      pager.id = "allSongsPager";
      pager.className = "music-pager";
      listEl.insertAdjacentElement("afterend", pager);
    }
    if (totalPages <= 1) { pager.innerHTML = ""; return; }
    const prevDisabled = allSongsPage <= 1 ? "disabled" : "";
    const nextDisabled = allSongsPage >= totalPages ? "disabled" : "";
    pager.innerHTML = `
      <button class="music-pager__btn" type="button" data-allsongs-page="prev" ${prevDisabled} aria-label="${escapeMusicHtml(M("prevPage"))}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
        <span>Oldingi</span>
      </button>
      <span class="music-pager__info">${allSongsPage} / ${totalPages}</span>
      <button class="music-pager__btn" type="button" data-allsongs-page="next" ${nextDisabled} aria-label="${escapeMusicHtml(M("nextPage"))}">
        <span>Keyingi</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
      </button>
    `;
  }

  function scrollMusicTop() {
    try { document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
  }

  function openAllSongs() {
    if (!navLock("all-songs")) return;
    const panel = ensureAllSongsDom();
    if (!panel) return;
    closeOtherMusicSubPanels("all-songs");
    allSongsPage = 1;
    renderAllSongs();
    document.body.classList.add("is-music-all-songs");
    panel.hidden = false;
    scrollMusicTop();
    tgBackRegister("music-all-songs", () => { try { closeAllSongs(); } catch (_) {} });
  }

  function closeAllSongs() {
    const panel = document.getElementById("musicAllSongs");
    if (panel) panel.hidden = true;
    document.body.classList.remove("is-music-all-songs");
    tgBackUnregister("music-all-songs");
    setMusicNavActive("categories");
  }

  // ----- Barcha qo'shiqchilar (all artists page) -----
  function ensureAllArtistsDom() {
    if (!musicView) return null;
    let panel = document.getElementById("musicAllArtists");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "musicAllArtists";
    panel.className = "music-allartists";
    panel.hidden = true;
    panel.innerHTML = `
      <header class="music-artist-detail__head">
        <button class="music-artist-detail__back" type="button" data-allartists-back aria-label="${escapeMusicHtml(M("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="music-artist-detail__name">Barcha qo'shiqchilar</h1>
      </header>
      <div class="music-allartists__grid" id="allArtistsGrid"></div>
      <div class="music-view__spacer"></div>
    `;
    musicView.appendChild(panel);
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-allartists-back]")) { closeAllArtists(); return; }
      const card = event.target.closest("[data-music-artist]");
      if (card) {
        const name = card.dataset.musicArtist;
        if (name && name !== "all") openArtistDetail(name);
      }
    });
    return panel;
  }

  function renderAllArtists() {
    ensureAllArtistsDom();
    const grid = document.getElementById("allArtistsGrid");
    if (!grid) return;
    const eligible = shuffleMusicArtists(eligibleArtistNames());
    grid.innerHTML = eligible.length
      ? eligible.map((a) => musicArtistCardHtml(a)).join("")
      : `<div class="music-state music-state--empty"><span>Qo'shiqchi topilmadi</span></div>`;
  }

  function openAllArtists() {
    if (!navLock("all-artists")) return;
    if (musicView && musicView.hidden) {
      musicView.hidden = false;
      document.body.classList.add("is-music");
      try { ensureMusicYouTubeApi(); } catch (_) {}
      if (!musicAllTracks.length) { try { loadMusicCatalog(); } catch (_) {} }
      tgBackRegister("music-view", () => { try { closeMusicView(); setFilter("all"); } catch (_) {} });
    }
    const panel = ensureAllArtistsDom();
    if (!panel) return;
    closeOtherMusicSubPanels("all-artists");
    renderAllArtists();
    document.body.classList.add("is-music-all-artists");
    panel.hidden = false;
    scrollMusicTop();
    setMusicNavActive("artists");
    tgBackRegister("music-all-artists", () => { try { closeAllArtists(); } catch (_) {} });
  }

  function closeAllArtists() {
    const panel = document.getElementById("musicAllArtists");
    if (panel) panel.hidden = true;
    document.body.classList.remove("is-music-all-artists");
    tgBackUnregister("music-all-artists");
    setMusicNavActive("categories");
  }

  // Musiqa beta eslatma modali olib tashlandi
  function openMusicBetaModal() {}

  // ===== Playlists (multi, YouTube-uslubida) =====
  const MUSIC_PLAYLISTS_KEY = "kino_music_playlists_v2";
  const MUSIC_PLAYLIST_LEGACY_KEY = "kino_music_playlist_v1";
  const PLAYLIST_ENDPOINT = "/api/music-playlists";
  let musicPlaylistsCache = null;
  let musicPlaylistsLoaded = false;

  function getMusicUserId() {
    try {
      const id = getTelegramUser?.()?.id;
      return id ? String(id) : "";
    } catch { return ""; }
  }
  function readPlaylistsLocal() {
    try {
      const raw = localStorage.getItem(MUSIC_PLAYLISTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
      // legacy: bitta flat ro'yxat bo'lsa "Sevimlilar" ga ko'chirib qo'yamiz
      const legacy = localStorage.getItem(MUSIC_PLAYLIST_LEGACY_KEY);
      if (legacy) {
        const ids = JSON.parse(legacy);
        if (Array.isArray(ids) && ids.length) {
          const now = Date.now();
          return [{ id: `pl_local_${now.toString(36)}`, name: M("favoritesPl"), createdAt: now, updatedAt: now, tracks: ids }];
        }
      }
    } catch {}
    return [];
  }
  function writePlaylistsLocal(list) {
    try { localStorage.setItem(MUSIC_PLAYLISTS_KEY, JSON.stringify(list)); } catch {}
  }
  function getPlaylists() {
    if (!musicPlaylistsCache) musicPlaylistsCache = readPlaylistsLocal();
    return musicPlaylistsCache;
  }
  function setPlaylists(list) {
    musicPlaylistsCache = Array.isArray(list) ? list : [];
    writePlaylistsLocal(musicPlaylistsCache);
  }
  function trackInAnyPlaylist(trackId) {
    return getPlaylists().some((pl) => Array.isArray(pl.tracks) && pl.tracks.includes(trackId));
  }
  // Eski API'larni saqlaymiz — boshqa joylarda chaqirilgan: row "is-added" indikatori.
  function readMusicPlaylist() {
    const set = new Set();
    for (const pl of getPlaylists()) {
      if (Array.isArray(pl.tracks)) for (const id of pl.tracks) set.add(id);
    }
    return Array.from(set);
  }

  async function loadPlaylistsFromServer() {
    if (musicPlaylistsLoaded) return;
    const userId = getMusicUserId();
    if (!userId) { musicPlaylistsLoaded = true; return; }
    try {
      const resp = await fetch(`${PLAYLIST_ENDPOINT}?userId=${encodeURIComponent(userId)}`, { headers: { Accept: "application/json" } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data?.ok && Array.isArray(data.playlists)) {
        setPlaylists(data.playlists);
        musicPlaylistsLoaded = true;
        refreshPlaylistAffectedViews();
      }
    } catch (_) {
      // serverga ulanib bo'lmasa — local cache bilan ishlaymiz
    }
  }
  async function apiPlaylist(payload) {
    const userId = getMusicUserId();
    if (!userId) {
      const err = new Error(M("signInRequired")); err.code = "NO_USER"; throw err;
    }
    const resp = await fetch(PLAYLIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data?.ok) {
      const err = new Error(data?.error || `HTTP ${resp.status}`); throw err;
    }
    return data;
  }

  function refreshPlaylistAffectedViews() {
    try { renderMusicList(); } catch (_) {}
    try { rerenderOpenAllSongs(); } catch (_) {}
    try { rerenderOpenArtistDetail(); } catch (_) {}
    try { renderPlaylistsView(); } catch (_) {}
    try { syncFullPlayerLike(); } catch (_) {}
  }
  function rerenderOpenAllSongs() {
    const panel = document.getElementById("musicAllSongs");
    if (panel && !panel.hidden) renderAllSongs();
  }
  function rerenderOpenArtistDetail() {
    const panel = document.getElementById("musicArtistDetail");
    if (panel && !panel.hidden) {
      const name = document.getElementById("musicArtistDetailName")?.textContent || "";
      if (name) renderArtistDetailTracks(name);
    }
  }
  function syncFullPlayerLike() {
    if (!musicFullPlayerLike) return;
    const id = musicFullPlayerLike.dataset.id;
    if (!id) return;
    musicFullPlayerLike.setAttribute("aria-pressed", trackInAnyPlaylist(id) ? "true" : "false");
  }

  // ===== Save-to-playlist bottom sheet =====
  let saveSheetTrackId = null;
  function ensureSaveSheet() {
    let el = document.getElementById("musicSaveSheet");
    if (el) return el;
    el = document.createElement("div");
    el.id = "musicSaveSheet";
    el.className = "music-savesheet";
    el.hidden = true;
    el.innerHTML = `
      <div class="music-savesheet__backdrop" data-savesheet-close></div>
      <div class="music-savesheet__panel" role="dialog" aria-modal="true" aria-label="${escapeMusicHtml(M("savePlaylist"))}">
        <header class="music-savesheet__head">
          <h3>Saqlash</h3>
          <button class="music-savesheet__close" type="button" data-savesheet-close aria-label="${escapeMusicHtml(M("close"))}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6l-12 12"></path></svg>
          </button>
        </header>
        <ul class="music-savesheet__list" id="musicSaveSheetList"></ul>
        <div class="music-savesheet__new" id="musicSaveSheetNew">
          <button class="music-savesheet__new-btn" type="button" data-savesheet-new>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
            <span>Yangi playlist</span>
          </button>
          <form class="music-savesheet__form" data-savesheet-form hidden>
            <input type="text" maxlength="80" placeholder="${escapeMusicHtml(M("playlistName"))}" data-savesheet-input />
            <div class="music-savesheet__form-actions">
              <button type="button" class="music-savesheet__form-cancel" data-savesheet-cancel>Bekor</button>
              <button type="submit" class="music-savesheet__form-save">Yaratish</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", onSaveSheetClick);
    el.addEventListener("change", onSaveSheetChange);
    el.querySelector("[data-savesheet-form]")?.addEventListener("submit", onSaveSheetCreate);
    return el;
  }
  function openSaveSheet(trackId) {
    saveSheetTrackId = trackId;
    const el = ensureSaveSheet();
    renderSaveSheet();
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("is-open"));
    document.body.classList.add("is-savesheet-open");
    tgBackRegister?.("music-savesheet", () => closeSaveSheet());
  }
  function closeSaveSheet() {
    const el = document.getElementById("musicSaveSheet");
    if (!el) return;
    el.classList.remove("is-open");
    document.body.classList.remove("is-savesheet-open");
    setTimeout(() => { el.hidden = true; }, 180);
    saveSheetTrackId = null;
    const form = el.querySelector("[data-savesheet-form]");
    if (form) form.hidden = true;
    const newBtn = el.querySelector("[data-savesheet-new]");
    if (newBtn) newBtn.hidden = false;
    tgBackUnregister?.("music-savesheet");
  }
  function renderSaveSheet() {
    const list = document.getElementById("musicSaveSheetList");
    if (!list) return;
    const playlists = getPlaylists();
    if (!playlists.length) {
      list.innerHTML = `<li class="music-savesheet__empty">Hali playlist yo'q. Quyida yangisini yarating.</li>`;
      return;
    }
    list.innerHTML = playlists.map((pl) => {
      const inPl = Array.isArray(pl.tracks) && saveSheetTrackId && pl.tracks.includes(saveSheetTrackId);
      const count = Array.isArray(pl.tracks) ? pl.tracks.length : 0;
      return `
      <li class="music-savesheet__item">
        <label class="music-savesheet__row">
          <input type="checkbox" data-savesheet-toggle="${escapeMusicHtml(pl.id)}" ${inPl ? "checked" : ""} />
          <span class="music-savesheet__check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-11"></path></svg>
          </span>
          <span class="music-savesheet__meta">
            <span class="music-savesheet__name">${escapeMusicHtml(pl.name)}</span>
            <span class="music-savesheet__count">${count} qo'shiq</span>
          </span>
        </label>
      </li>`;
    }).join("");
  }
  function onSaveSheetClick(event) {
    if (event.target.closest("[data-savesheet-close]")) { closeSaveSheet(); return; }
    if (event.target.closest("[data-savesheet-new]")) {
      const form = document.querySelector("#musicSaveSheet [data-savesheet-form]");
      const btn = document.querySelector("#musicSaveSheet [data-savesheet-new]");
      if (form) form.hidden = false;
      if (btn) btn.hidden = true;
      form?.querySelector("input")?.focus();
      return;
    }
    if (event.target.closest("[data-savesheet-cancel]")) {
      const form = document.querySelector("#musicSaveSheet [data-savesheet-form]");
      const btn = document.querySelector("#musicSaveSheet [data-savesheet-new]");
      if (form) { form.hidden = true; form.reset(); }
      if (btn) btn.hidden = false;
      return;
    }
  }
  async function onSaveSheetChange(event) {
    const cb = event.target.closest("input[type='checkbox'][data-savesheet-toggle]");
    if (!cb) return;
    const plId = cb.dataset.savesheetToggle;
    const trackId = saveSheetTrackId;
    if (!plId || !trackId) return;
    cb.disabled = true;
    // optimistic update
    const playlists = getPlaylists().map((pl) => {
      if (pl.id !== plId) return pl;
      const tracks = Array.isArray(pl.tracks) ? [...pl.tracks] : [];
      const idx = tracks.indexOf(trackId);
      if (idx >= 0) tracks.splice(idx, 1); else tracks.push(trackId);
      return { ...pl, tracks, updatedAt: Date.now() };
    });
    setPlaylists(playlists);
    refreshPlaylistAffectedViews();
    try {
      await apiPlaylist({ action: "toggleTrack", id: plId, trackId });
    } catch (err) {
      // revert
      const reverted = getPlaylists().map((pl) => {
        if (pl.id !== plId) return pl;
        const tracks = Array.isArray(pl.tracks) ? [...pl.tracks] : [];
        const idx = tracks.indexOf(trackId);
        if (idx >= 0) tracks.splice(idx, 1); else tracks.push(trackId);
        return { ...pl, tracks };
      });
      setPlaylists(reverted);
      cb.checked = !cb.checked;
      refreshPlaylistAffectedViews();
      try { (window.Telegram?.WebApp?.showAlert || alert)(err.message || M("saveFailed")); } catch (_) {}
    } finally {
      cb.disabled = false;
    }
  }
  async function onSaveSheetCreate(event) {
    event.preventDefault();
    // event.currentTarget await dan keyin null bo'lib qoladi — referenslarni oldindan ushlaymiz.
    const form = event.currentTarget;
    const input = form?.querySelector("input");
    const name = String(input?.value || "").trim();
    if (!name) { input?.focus(); return; }
    const submitBtn = form?.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const data = await apiPlaylist({ action: "create", name, trackId: saveSheetTrackId });
      if (data?.playlist) {
        const playlists = [data.playlist, ...getPlaylists().filter((p) => p.id !== data.playlist.id)];
        setPlaylists(playlists);
        refreshPlaylistAffectedViews();
        renderSaveSheet();
        const formNow = form || document.querySelector("#musicSaveSheet [data-savesheet-form]");
        if (formNow) {
          formNow.hidden = true;
          try { formNow.reset(); } catch (_) {}
        }
        const newBtn = document.querySelector("#musicSaveSheet [data-savesheet-new]");
        if (newBtn) newBtn.hidden = false;
      }
    } catch (err) {
      try { (window.Telegram?.WebApp?.showAlert || alert)(err.message || M("createFailed")); } catch (_) {}
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }
  function handleSaveButtonClick(trackId) {
    if (!trackId) return;
    if (!getMusicUserId()) {
      try { (window.Telegram?.WebApp?.showAlert || alert)(M("playlistNeedSignIn")); } catch (_) {}
      return;
    }
    loadPlaylistsFromServer();
    openSaveSheet(trackId);
  }

  // ===== Playlists view (pastki navbar "Playlist" tab) =====
  let playlistsViewOpenedId = null;
  function ensurePlaylistsViewDom() {
    if (!musicView) return null;
    let panel = document.getElementById("musicPlaylistsView");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "musicPlaylistsView";
    panel.className = "music-playlists-view";
    panel.hidden = true;
    panel.innerHTML = `
      <header class="music-artist-detail__head">
        <button class="music-artist-detail__back" type="button" data-playlists-back aria-label="${escapeMusicHtml(M("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="music-artist-detail__name" data-playlists-title>Mening playlistlarim</h1>
      </header>
      <ol class="music-playlists-list" id="musicPlaylistsList"></ol>
      <section class="music-playlist-detail" id="musicPlaylistDetail" hidden>
        <div class="music-playlist-hero" id="musicPlaylistHero"></div>
        <ol class="music-list" id="musicPlaylistDetailList"></ol>
      </section>
      <div class="music-view__spacer"></div>`;
    musicView.appendChild(panel);
    panel.addEventListener("click", onPlaylistsViewClick);
    return panel;
  }
  function playlistCoverIds(pl) {
    const ids = (pl?.tracks || [])
      .filter((id) => musicAllTracks.some((t) => t.youtubeId === id))
      .slice(0, 4);
    return ids;
  }
  function playlistCoverHtml(pl, fallbackSvgSize) {
    const ids = playlistCoverIds(pl);
    if (ids.length >= 4) {
      return `<span class="music-playlist-card__mosaic" aria-hidden="true">
        ${ids.map((id) => `<span style="background-image:url('https://i.ytimg.com/vi/${escapeMusicHtml(id)}/mqdefault.jpg')"></span>`).join("")}
      </span>`;
    }
    if (ids.length >= 1) {
      return `<span class="music-playlist-card__mosaic" style="background-image:url('https://i.ytimg.com/vi/${escapeMusicHtml(ids[0])}/mqdefault.jpg');background-size:cover;background-position:center;" aria-hidden="true"></span>`;
    }
    const size = fallbackSvgSize || 24;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="14" y2="6"></line><line x1="3" y1="12" x2="14" y2="12"></line><line x1="3" y1="18" x2="10" y2="18"></line><polygon points="17 14 17 22 22 18" fill="currentColor" stroke="none"></polygon></svg>`;
  }
  function renderPlaylistsView() {
    const panel = document.getElementById("musicPlaylistsView");
    if (!panel || panel.hidden) return;
    if (playlistsViewOpenedId) { renderPlaylistDetail(playlistsViewOpenedId); return; }
    const list = document.getElementById("musicPlaylistsList");
    const detail = document.getElementById("musicPlaylistDetail");
    if (detail) detail.hidden = true;
    if (list) list.hidden = false;
    const title = panel.querySelector("[data-playlists-title]");
    if (title) title.textContent = M("myPlaylists");
    if (!list) return;
    const playlists = getPlaylists();
    if (!playlists.length) {
      list.innerHTML = `
        <li class="music-playlists-empty">
          <span class="music-playlists-empty__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="14" y2="6"></line>
              <line x1="3" y1="12" x2="14" y2="12"></line>
              <line x1="3" y1="18" x2="10" y2="18"></line>
              <polygon points="17 14 17 22 22 18" fill="currentColor" stroke="none"></polygon>
            </svg>
          </span>
          <h3 class="music-playlists-empty__title">Playlistlar bo'sh</h3>
          <p class="music-playlists-empty__text">Hali bironta playlist yaratilmagan. Musiqa ro'yxatida qo'shiq yonidagi <strong>navbat</strong> ikonkasini bosib o'z playlistingizni qo'shing.</p>
        </li>`;
      return;
    }
    list.innerHTML = playlists.map((pl) => {
      return `
      <li class="music-playlist-card" data-playlist-open="${escapeMusicHtml(pl.id)}">
        <span class="music-playlist-card__cover">
          <span class="music-playlist-card__art">
            ${playlistCoverHtml(pl, 28)}
          </span>
        </span>
        <span class="music-playlist-card__meta">
          <span class="music-playlist-card__name">${escapeMusicHtml(pl.name)}</span>
        </span>
        <button class="music-playlist-card__go" type="button" data-playlist-open="${escapeMusicHtml(pl.id)}" aria-label="${escapeMusicHtml(M("open"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </li>`;
    }).join("");
  }
  function renderPlaylistDetail(playlistId) {
    const panel = document.getElementById("musicPlaylistsView");
    if (!panel) return;
    const pl = getPlaylists().find((p) => p.id === playlistId);
    if (!pl) { playlistsViewOpenedId = null; renderPlaylistsView(); return; }
    const list = document.getElementById("musicPlaylistsList");
    const detail = document.getElementById("musicPlaylistDetail");
    const detailList = document.getElementById("musicPlaylistDetailList");
    const hero = document.getElementById("musicPlaylistHero");
    const title = panel.querySelector("[data-playlists-title]");
    if (list) list.hidden = true;
    if (detail) detail.hidden = false;
    if (title) title.textContent = "";
    const tracks = (pl.tracks || []).map((id) => musicAllTracks.find((t) => t.youtubeId === id)).filter(Boolean);

    if (hero) {
      const coverIds = playlistCoverIds(pl);
      const heroBg = coverIds[0]
        ? `url('https://i.ytimg.com/vi/${escapeMusicHtml(coverIds[0])}/mqdefault.jpg')`
        : "none";
      hero.style.setProperty("--pl-hero-bg", heroBg);
      hero.innerHTML = `
        <div class="music-playlist-hero__top">
          <div class="music-playlist-hero__cover">
            ${playlistCoverHtml(pl, 64)}
          </div>
        </div>
        <h2 class="music-playlist-hero__name">${escapeMusicHtml(pl.name)}</h2>
        <div class="music-playlist-hero__meta">
          <span>Playlist</span>
          <span>${tracks.length} qo'shiq</span>
        </div>
        <div class="music-playlist-hero__actions">
          <button class="music-playlist-hero__play" type="button" data-playlist-playall="${escapeMusicHtml(pl.id)}" ${tracks.length ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z"></path></svg>
            <span>Play all</span>
          </button>
          <button class="music-playlist-hero__icon-btn" type="button" data-playlist-menu="${escapeMusicHtml(pl.id)}" aria-label="${escapeMusicHtml(M("manage"))}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
          </button>
        </div>`;
    }

    if (!detailList) return;
    if (!tracks.length) {
      detailList.innerHTML = `<li class="music-playlists-empty">
        <span class="music-playlists-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="14" y2="6"></line><line x1="3" y1="12" x2="14" y2="12"></line><line x1="3" y1="18" x2="10" y2="18"></line><polygon points="17 14 17 22 22 18" fill="currentColor" stroke="none"></polygon></svg>
        </span>
        <p class="music-playlists-empty__text">Bu playlist bo'sh. Musiqa ro'yxatidan qo'shiq qo'shing.</p>
      </li>`;
      return;
    }
    const playlistIds = readMusicPlaylist();
    detailList.innerHTML = tracks.map((t) => musicRowHtml(t, playlistIds)).join("");
  }
  function onPlaylistsViewClick(event) {
    if (event.target.closest("[data-playlists-back]")) {
      if (playlistsViewOpenedId) { playlistsViewOpenedId = null; renderPlaylistsView(); }
      else closePlaylistsView();
      return;
    }
    const playAllBtn = event.target.closest("[data-playlist-playall]");
    if (playAllBtn) {
      event.stopPropagation();
      const plId = playAllBtn.dataset.playlistPlayall;
      const pl = getPlaylists().find((p) => p.id === plId);
      const firstTrack = pl && (pl.tracks || [])
        .map((id) => musicAllTracks.find((t) => t.youtubeId === id))
        .find(Boolean);
      if (firstTrack) {
        setMusicPlayContext({ kind: "playlist", id: plId });
        playMusicTrack(firstTrack);
      }
      return;
    }
    const menuBtn = event.target.closest("[data-playlist-menu]");
    if (menuBtn) { event.stopPropagation(); openPlaylistMenu(menuBtn.dataset.playlistMenu); return; }
    const openBtn = event.target.closest("[data-playlist-open]");
    if (openBtn) { playlistsViewOpenedId = openBtn.dataset.playlistOpen; renderPlaylistDetail(playlistsViewOpenedId); return; }
    const addBtn = event.target.closest("[data-music-add]");
    if (addBtn) { event.stopPropagation(); handleSaveButtonClick(addBtn.dataset.musicAdd); return; }
    const row = event.target.closest("[data-music-row]");
    if (row) {
      const track = musicAllTracks.find((t) => t.youtubeId === row.dataset.musicRow);
      if (track) {
        if (playlistsViewOpenedId) setMusicPlayContext({ kind: "playlist", id: playlistsViewOpenedId });
        else setMusicPlayContext({ kind: "list" });
        playMusicTrack(track);
      }
    }
  }
  function openPlaylistMenu(playlistId) {
    const pl = getPlaylists().find((p) => p.id === playlistId);
    if (!pl) return;
    const tg = window.Telegram?.WebApp;
    const choose = (action) => {
      if (action === "rename") {
        const next = (window.prompt || (() => null))("Yangi nom:", pl.name);
        if (next == null) return;
        const name = String(next).trim();
        if (!name || name === pl.name) return;
        const old = getPlaylists();
        setPlaylists(old.map((p) => p.id === pl.id ? { ...p, name, updatedAt: Date.now() } : p));
        refreshPlaylistAffectedViews();
        apiPlaylist({ action: "rename", id: pl.id, name }).catch(() => {
          setPlaylists(old);
          refreshPlaylistAffectedViews();
          try { (tg?.showAlert || alert)(M("renameFailed")); } catch (_) {}
        });
      } else if (action === "delete") {
        const ok = (window.confirm || (() => false))(`"${pl.name}" o'chirilsinmi?`);
        if (!ok) return;
        const old = getPlaylists();
        setPlaylists(old.filter((p) => p.id !== pl.id));
        if (playlistsViewOpenedId === pl.id) playlistsViewOpenedId = null;
        refreshPlaylistAffectedViews();
        apiPlaylist({ action: "delete", id: pl.id }).catch(() => {
          setPlaylists(old);
          refreshPlaylistAffectedViews();
          try { (tg?.showAlert || alert)(M("deleteFailed")); } catch (_) {}
        });
      }
    };
    if (tg?.showPopup) {
      tg.showPopup({
        title: pl.name,
        message: M("choose"),
        buttons: [
          { id: "rename", type: "default", text: M("renameItem") },
          { id: "delete", type: "destructive", text: M("deleteItem") },
          { id: "cancel", type: "cancel" },
        ],
      }, (id) => choose(id));
    } else {
      const ans = (window.prompt || (() => ""))(`"${pl.name}" — qaysi amal? (rename / delete)`, "rename");
      if (ans === "rename" || ans === "delete") choose(ans);
    }
  }
  function openPlaylistsView() {
    if (!musicView) return;
    if (!navLock("playlists")) return;
    if (musicView.hidden) {
      // music view yopiq — avval ochamiz, lekin uning auto sub-panellarini bloklamasdan
      musicView.hidden = false;
      document.body.classList.add("is-music");
      tgBackRegister("music-view", () => { try { closeMusicView(); setFilter("all"); } catch (_) {} });
    }
    ensurePlaylistsViewDom();
    closeOtherMusicSubPanels("playlists");
    loadPlaylistsFromServer();
    const panel = document.getElementById("musicPlaylistsView");
    if (!panel) return;
    playlistsViewOpenedId = null;
    panel.hidden = false;
    document.body.classList.add("is-music-playlists");
    renderPlaylistsView();
    scrollMusicTop();
    setMusicNavActive("playlist");
    tgBackRegister?.("music-playlists", () => {
      if (playlistsViewOpenedId) { playlistsViewOpenedId = null; renderPlaylistsView(); }
      else closePlaylistsView();
    });
  }
  function closePlaylistsView() {
    const panel = document.getElementById("musicPlaylistsView");
    if (panel) panel.hidden = true;
    playlistsViewOpenedId = null;
    document.body.classList.remove("is-music-playlists");
    tgBackUnregister?.("music-playlists");
    setMusicNavActive("categories");
  }

  const musicCarouselTrack = document.getElementById("musicCarouselTrack");
  const musicCarouselDots = document.getElementById("musicCarouselDots");
  let musicCarouselIndex = 0;
  let musicCarouselTimer = null;
  let musicCarouselItems = [];

  function eligibleArtistNames() {
    const counts = new Map();
    musicAllTracks.forEach((t) => {
      splitArtists(t.artist).forEach((a) => {
        const k = a.trim();
        if (!k) return;
        counts.set(k, (counts.get(k) || 0) + 1);
      });
    });
    const result = [];
    const seen = new Set();
    // 1) Saqlangan qo'shiqchilar (shu jumladan YouTube kanal-artistlar) — har doim ko'rinadi.
    //    Ism " x ", " & " va h.k. separator bilan bo'lsa, parchalarini ham `seen` ga
    //    qo'shamiz — aks holda 4+ qoidasi bilan ular yana qaytadan ro'yxatga tushadi.
    for (const a of musicArtistsData) {
      const name = String(a?.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      for (const part of splitArtists(name)) {
        const pk = part.trim().toLowerCase();
        if (pk) seen.add(pk);
      }
      result.push(name);
    }
    // 2) 4+ qo'shig'i bo'lganlar
    for (const [name, n] of counts.entries()) {
      if (n < 4) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(name);
    }
    return result;
  }

  function pickArtistFallbackImage(name) {
    const target = String(name || "").toLowerCase().trim();
    if (!target) return "";
    // YT kanal-artistda cover bo'lsa, uni ishlatamiz (kanal banner emas, lekin musiqaviy nuance)
    const channelTrack = musicAllTracks.find((t) => String(t.artist || "").toLowerCase().trim() === target && t.cover);
    if (channelTrack?.cover) return channelTrack.cover;
    // Aks holda — birinchi tegishli trekning YT thumbnail'i
    const track = musicAllTracks.find((t) => {
      if (String(t.artist || "").toLowerCase().trim() === target) return true;
      return splitArtists(t.artist).some((a) => a.toLowerCase() === target);
    });
    return track ? `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg` : "";
  }

  function renderMusicCarousel() {
    if (!musicCarouselTrack || !musicCarouselDots) return;
    const eligible = shuffleMusicArtists(eligibleArtistNames());
    const withImages = eligible
      .map((name) => ({ name, image: findArtistImage(name) || pickArtistFallbackImage(name) }))
      .filter((x) => x.image);
    musicCarouselItems = withImages.slice(0, 5);
    if (!musicCarouselItems.length) {
      musicCarouselTrack.innerHTML = "";
      musicCarouselDots.innerHTML = "";
      return;
    }
    musicCarouselIndex = Math.min(musicCarouselIndex, musicCarouselItems.length - 1);
    musicCarouselTrack.innerHTML = musicCarouselItems.map((item, i) => `
      <button class="music-slide ${i === musicCarouselIndex ? "is-active" : ""}" type="button" data-music-slide-artist="${escapeMusicHtml(item.name)}">
        <span class="music-slide__bg" style="background-image:url('${item.image.replaceAll("'", "%27")}')"></span>
        <span class="music-slide__gradient"></span>
        <span class="music-slide__inner">
          <span class="music-slide__title">${escapeMusicHtml(item.name)}</span>
        </span>
      </button>
    `).join("");
    musicCarouselDots.innerHTML = musicCarouselItems.map((_, i) => `
      <button class="music-dot ${i === musicCarouselIndex ? "is-active" : ""}" type="button" data-music-dot="${i}" aria-label="Slayd ${i + 1}"></button>
    `).join("");
    startMusicCarouselTimer();
  }

  function setMusicCarouselIndex(i) {
    if (!musicCarouselItems.length) return;
    musicCarouselIndex = (i + musicCarouselItems.length) % musicCarouselItems.length;
    musicCarouselTrack?.querySelectorAll(".music-slide").forEach((el, idx) => el.classList.toggle("is-active", idx === musicCarouselIndex));
    musicCarouselDots?.querySelectorAll(".music-dot").forEach((el, idx) => el.classList.toggle("is-active", idx === musicCarouselIndex));
  }

  function startMusicCarouselTimer() {
    stopMusicCarouselTimer();
    if (musicCarouselItems.length < 2) return;
    musicCarouselTimer = setInterval(() => setMusicCarouselIndex(musicCarouselIndex + 1), 4500);
  }
  function stopMusicCarouselTimer() {
    if (musicCarouselTimer) { clearInterval(musicCarouselTimer); musicCarouselTimer = null; }
  }

  function ensureArtistDetailDom() {
    if (!musicView) return null;
    let panel = document.getElementById("musicArtistDetail");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "musicArtistDetail";
    panel.className = "music-artist-detail";
    panel.hidden = true;
    panel.innerHTML = `
      <header class="music-artist-detail__head">
        <button class="music-artist-detail__back" type="button" data-artist-detail-back aria-label="${escapeMusicHtml(M("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="music-artist-detail__name" id="musicArtistDetailName"></h1>
      </header>
      <div class="music-artist-detail__card" id="musicArtistDetailCard">
        <div class="music-artist-detail__shade"></div>
        <span class="music-artist-detail__title" id="musicArtistDetailTitle"></span>
      </div>
      <ol class="music-list" id="musicArtistDetailList"></ol>
    `;
    musicView.appendChild(panel);
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-artist-detail-back]")) {
        closeArtistDetail();
        return;
      }
      const row = event.target.closest("[data-music-row]");
      if (row) {
        const id = row.dataset.musicRow;
        const track = musicAllTracks.find((t) => t.youtubeId === id);
        if (track) { setMusicPlayContext({ kind: "list" }); playMusicTrack(track); }
      }
    });
    return panel;
  }

  function renderArtistDetailTracks(name) {
    const list = document.getElementById("musicArtistDetailList");
    if (!list) return;
    const target = name.toLowerCase();
    const tracks = shuffleTracks(musicAllTracks.filter((t) => splitArtists(t.artist).some((a) => a.toLowerCase() === target)));
    const playlist = readMusicPlaylist();
    list.innerHTML = tracks.map((t) => {
      const id = escapeMusicHtml(t.youtubeId);
      const inPl = playlist.includes(t.youtubeId);
      return `
      <li class="music-item">
        <div class="music-row ${trackKey(t) === musicCurrentTrackKey ? "is-playing" : ""}">
          <button class="music-row__main" type="button" data-music-row="${id}">
            <span class="music-row__cover" style="background-image:url('https://i.ytimg.com/vi/${id}/mqdefault.jpg')"></span>
            <span class="music-row__meta">
              <span class="music-row__title">${escapeMusicHtml(displayTrackTitle(t))}</span>
              <span class="music-row__sub">${escapeMusicHtml(t.artist)}</span>
            </span>
          </button>
          <div class="music-row__actions">
            <button class="music-row__btn music-row__btn--add ${inPl ? "is-added" : ""}" type="button" data-music-add="${id}" aria-label="${escapeMusicHtml(M("addToPlaylist"))}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="3" y1="6" x2="14" y2="6"></line>
                <line x1="3" y1="12" x2="14" y2="12"></line>
                <line x1="3" y1="18" x2="10" y2="18"></line>
                <polygon points="17 14 17 22 22 18" fill="currentColor" stroke="none"></polygon>
              </svg>
            </button>
            <button class="music-row__btn music-row__btn--play" type="button" data-music-row="${id}" aria-label="${escapeMusicHtml(M("play"))}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7z"></path></svg>
            </button>
          </div>
        </div>
      </li>`;
    }).join("");
  }

  // Origin info — qaytishda qaerga borishni va qaysi scroll pozitsiyaga
  // o'tishni biladigan obyekt: { view: "all-artists"|"all-songs"|null, scrollTop: 0 }
  let artistDetailOrigin = null;
  function currentAppScrollTop() {
    try { return document.getElementById("appShell")?.scrollTop || window.scrollY || 0; }
    catch (_) { return 0; }
  }
  function restoreAppScrollTop(top) {
    try { document.getElementById("appShell")?.scrollTo({ top, behavior: "auto" }); } catch (_) {}
    try { window.scrollTo({ top, behavior: "auto" }); } catch (_) {}
  }
  function openArtistDetail(name) {
    if (!navLock("artist-detail:" + name)) return;
    const panel = ensureArtistDetailDom();
    if (!panel) return;
    document.getElementById("musicArtistDetailName").textContent = name;
    document.getElementById("musicArtistDetailTitle").textContent = name;
    const card = document.getElementById("musicArtistDetailCard");
    const img = findArtistImage(name) || pickArtistFallbackImage(name);
    if (card) card.style.backgroundImage = img ? `url('${img.replaceAll("'", "%27")}')` : "none";
    renderArtistDetailTracks(name);
    const allArtists = document.getElementById("musicAllArtists");
    const allSongs = document.getElementById("musicAllSongs");
    const playlists = document.getElementById("musicPlaylistsView");
    let view = null;
    if (allArtists && !allArtists.hidden) view = "all-artists";
    else if (allSongs && !allSongs.hidden) view = "all-songs";
    artistDetailOrigin = { view, scrollTop: currentAppScrollTop() };
    if (allArtists) allArtists.hidden = true;
    if (allSongs) allSongs.hidden = true;
    if (playlists && !playlists.hidden) closePlaylistsView();
    document.body.classList.remove("is-music-all-artists", "is-music-all-songs");
    document.body.classList.add("is-music-artist-detail");
    panel.hidden = false;
    scrollMusicTop();
    tgBackRegister("music-artist-detail", () => { try { closeArtistDetail(); } catch (_) {} });
  }

  function closeArtistDetail() {
    const panel = document.getElementById("musicArtistDetail");
    if (panel) panel.hidden = true;
    document.body.classList.remove("is-music-artist-detail");
    const origin = artistDetailOrigin;
    artistDetailOrigin = null;
    if (origin?.view === "all-artists") {
      const allArtists = document.getElementById("musicAllArtists");
      if (allArtists) { allArtists.hidden = false; document.body.classList.add("is-music-all-artists"); }
      if (origin.scrollTop) restoreAppScrollTop(origin.scrollTop);
      setMusicNavActive("artists");
    } else if (origin?.view === "all-songs") {
      const allSongs = document.getElementById("musicAllSongs");
      if (allSongs) { allSongs.hidden = false; document.body.classList.add("is-music-all-songs"); }
      if (origin.scrollTop) restoreAppScrollTop(origin.scrollTop);
      setMusicNavActive("categories");
    } else {
      setMusicNavActive("categories");
    }
    tgBackUnregister("music-artist-detail");
  }

  function openMusicView() {
    if (!musicView) return;
    if (!navLock("music-view")) return;
    const wasHidden = musicView.hidden;
    closeOtherMusicSubPanels(null);
    if (wasHidden) reshuffleMusic();
    if (!musicAllTracks.length) {
      loadMusicCatalog();
    } else {
      renderMusicCarousel();
      renderMusicFilters();
      renderMusicList();
    }
    fetchMusicArtists().then(() => { renderMusicFilters(); renderMusicCarousel(); });
    try { loadPlaylistsFromServer(); } catch (_) {}
    try { ensureMusicYouTubeApi().then(() => initYtPlayerForMusic()).catch(() => {}); } catch (_) {}
    musicView.hidden = false;
    document.body.classList.add("is-music");
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.classList.remove("is-active"));
    setMusicNavActive("categories");
    tgBackRegister("music-view", () => { try { closeMusicView(); setFilter("all"); } catch (_) {} });
  }

  function setMusicNavActive(action) {
    document.querySelectorAll(".bottom-bar--music .bottom-bar__button").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.action === action);
    });
  }

  function closeMusicView() {
    if (!musicView) return;
    musicView.hidden = true;
    document.body.classList.remove("is-music");
    // Origin'ni null qilamiz — aks holda closeArtistDetail all-songs/all-artists
    // panelini qaytarib ko'rsatib, keyingi closeAll* ga to'qnashadi (flicker).
    artistDetailOrigin = null;
    closeArtistDetail();
    closeAllSongs();
    closeAllArtists();
    try { closePlaylistsView(); } catch (_) {}
    stopMusicCarouselTimer();
    closeMusicFullPlayer();
    try {
      tgBackUnregister?.("music-artist-detail");
      tgBackUnregister?.("music-all-songs");
      tgBackUnregister?.("music-all-artists");
      tgBackUnregister?.("music-playlists");
      tgBackUnregister?.("music-savesheet");
      tgBackUnregister?.("music-fullplayer");
      tgBackUnregister?.("music-view");
    } catch (_) {}
  }

  // ----- Background Audio, Wake Lock & Media Session API -----
  // Telefon ekrani bloklanganda yoki fonda musiqa to'xtab qolmasligi,
  // tinglash paytida ekran o'z-o'zidan o'chib qolmasligi (Screen Wake Lock)
  // hamda Telegram / OS bildirishnoma panelida to'liq boshqaruv uchun.
  let nativeAudioPlayer = null;
  let currentPlayingType = "youtube"; // "youtube" | "audio"
  let musicUserPlaying = false;
  let userManuallyPaused = false;
  let mediaSessionInitialized = false;
  let musicWakeLock = null;

  async function requestMusicWakeLock() {
    try {
      if ("wakeLock" in navigator && !musicWakeLock) {
        musicWakeLock = await navigator.wakeLock.request("screen");
        musicWakeLock.addEventListener("release", () => {
          musicWakeLock = null;
        });
      }
    } catch (_) {}
  }

  function releaseMusicWakeLock() {
    try {
      if (musicWakeLock) {
        musicWakeLock.release().catch(() => {});
        musicWakeLock = null;
      }
    } catch (_) {}
  }

  let silentAudioEl = null;
  let silentAudioCtx = null;
  let silentAudioSource = null;

  function initSilentAudioContext() {
    try {
      if (!silentAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) silentAudioCtx = new AudioCtx();
      }
      if (silentAudioCtx && silentAudioCtx.state === "suspended") {
        silentAudioCtx.resume().catch(() => {});
      }
      if (silentAudioCtx && !silentAudioSource) {
        const buffer = silentAudioCtx.createBuffer(1, silentAudioCtx.sampleRate, silentAudioCtx.sampleRate);
        silentAudioSource = silentAudioCtx.createBufferSource();
        silentAudioSource.buffer = buffer;
        silentAudioSource.loop = true;
        const gain = silentAudioCtx.createGain();
        gain.gain.value = 0.0001;
        silentAudioSource.connect(gain);
        gain.connect(silentAudioCtx.destination);
        silentAudioSource.start(0);
      }
    } catch (_) {}
  }

  function playSilentAnchor() {
    try {
      if ("audioSession" in navigator) {
        navigator.audioSession.type = "playback";
      }
    } catch (_) {}
    if (currentPlayingType === "youtube") {
      pauseSilentAnchor();
      return;
    }
    initSilentAudioContext();
    try {
      if (!silentAudioEl) {
        silentAudioEl = new Audio();
        // 1-second 44.1kHz silent WAV data URI
        silentAudioEl.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        silentAudioEl.loop = true;
        silentAudioEl.setAttribute("playsinline", "");
        silentAudioEl.setAttribute("webkit-playsinline", "");
        silentAudioEl.volume = 0.01;
      }
      const p = silentAudioEl.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (_) {}
  }

  function pauseSilentAnchor() {
    try {
      if (silentAudioEl) silentAudioEl.pause();
    } catch (_) {}
    try {
      if (silentAudioCtx && silentAudioCtx.state === "running") {
        silentAudioCtx.suspend().catch(() => {});
      }
    } catch (_) {}
  }

  function ensureYtAudio() {
    if (!ytReady || !ytPlayer) return;
    try {
      if (typeof ytPlayer.unMute === "function") ytPlayer.unMute();
      if (typeof ytPlayer.setVolume === "function") ytPlayer.setVolume(100);
    } catch (_) {}
  }

  function getNativeAudioPlayer() {
    if (nativeAudioPlayer) return nativeAudioPlayer;
    try {
      nativeAudioPlayer = new Audio();
      nativeAudioPlayer.setAttribute("playsinline", "");
      nativeAudioPlayer.setAttribute("webkit-playsinline", "");
      nativeAudioPlayer.addEventListener("play", () => {
        musicUserPlaying = true;
        userManuallyPaused = false;
        requestMusicWakeLock();
        if ("mediaSession" in navigator) {
          try { navigator.mediaSession.playbackState = "playing"; } catch (_) {}
        }
        if (miniPlayerToggle) miniPlayerToggle.dataset.state = "pause";
        if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
      });
      nativeAudioPlayer.addEventListener("pause", () => {
        if (userManuallyPaused) {
          musicUserPlaying = false;
          releaseMusicWakeLock();
          if ("mediaSession" in navigator) {
            try { navigator.mediaSession.playbackState = "paused"; } catch (_) {}
          }
          if (miniPlayerToggle) miniPlayerToggle.dataset.state = "play";
          if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "play";
        }
      });
      nativeAudioPlayer.addEventListener("ended", () => {
        if ("mediaSession" in navigator) {
          try { navigator.mediaSession.playbackState = "paused"; } catch (_) {}
        }
        try { autoAdvance(); } catch (_) {}
      });
    } catch (_) {}
    return nativeAudioPlayer;
  }

  function initMediaSession() {
    if (!("mediaSession" in navigator) || mediaSessionInitialized) return;
    mediaSessionInitialized = true;

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        resumeMusicPlayback();
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("pause", () => {
        pauseMusicPlayback();
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        playRelative(-1);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        playRelative(1);
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime != null) {
          if (currentPlayingType === "audio" && nativeAudioPlayer) {
            nativeAudioPlayer.currentTime = details.seekTime;
          } else if (ytReady && ytPlayer?.seekTo) {
            ytPlayer.seekTo(details.seekTime, true);
          }
          syncMediaPositionState();
        }
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const offset = details.seekOffset || 10;
        if (currentPlayingType === "audio" && nativeAudioPlayer) {
          nativeAudioPlayer.currentTime = Math.max(0, (nativeAudioPlayer.currentTime || 0) - offset);
        } else if (ytReady && ytPlayer?.getCurrentTime) {
          const cur = ytPlayer.getCurrentTime() || 0;
          ytPlayer.seekTo(Math.max(0, cur - offset), true);
        }
        syncMediaPositionState();
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;
        if (currentPlayingType === "audio" && nativeAudioPlayer) {
          const dur = nativeAudioPlayer.duration || 0;
          const cur = nativeAudioPlayer.currentTime || 0;
          nativeAudioPlayer.currentTime = Math.min(dur || (cur + offset), cur + offset);
        } else if (ytReady && ytPlayer?.getCurrentTime) {
          const cur = ytPlayer.getCurrentTime() || 0;
          const dur = ytPlayer.getDuration ? (ytPlayer.getDuration() || 0) : 0;
          ytPlayer.seekTo(Math.min(dur || (cur + offset), cur + offset), true);
        }
        syncMediaPositionState();
      });
    } catch (_) {}

    try {
      navigator.mediaSession.setActionHandler("stop", () => {
        pauseMusicPlayback();
        hideMiniPlayer();
      });
    } catch (_) {}
  }

  function getTrackArtUrl(track) {
    if (!track) return "";
    const artistName = track.artist || "";
    const artistImg = findArtistImage(artistName) || pickArtistFallbackImage(artistName);
    if (artistImg) return artistImg;
    if (track.cover || track.poster) return track.cover || track.poster;
    if (track.youtubeId) return `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
    return "";
  }

  function updateMediaSessionMetadata(track) {
    if (!("mediaSession" in navigator) || !track) return;
    try {
      initMediaSession();
      const title = displayTrackTitle(track);
      const artist = track.artist || "NTV Music";
      const album = (track.category && track.category !== "all") ? track.category : "NTV Music";
      const artwork = [];
      const artUrl = getTrackArtUrl(track);
      if (artUrl) {
        artwork.push(
          { src: artUrl, sizes: "512x512", type: "image/jpeg" },
          { src: artUrl, sizes: "256x256", type: "image/jpeg" },
          { src: artUrl, sizes: "128x128", type: "image/jpeg" }
        );
      }
      if (typeof MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album,
          artwork,
        });
      }
      navigator.mediaSession.playbackState = "playing";
    } catch (_) {}
  }

  function syncMediaPositionState() {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    let cur = 0;
    let dur = 0;
    if (currentPlayingType === "audio" && nativeAudioPlayer) {
      cur = nativeAudioPlayer.currentTime || 0;
      dur = nativeAudioPlayer.duration || 0;
    } else if (ytReady && ytPlayer?.getCurrentTime && ytPlayer?.getDuration) {
      try {
        cur = ytPlayer.getCurrentTime() || 0;
        dur = ytPlayer.getDuration() || 0;
      } catch (_) {}
    } else {
      return;
    }
    try {
      if (dur > 0 && cur >= 0 && cur <= dur) {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: 1,
          position: cur,
        });
      }
    } catch (_) {}
  }

  function resumeMusicPlayback() {
    musicUserPlaying = true;
    userManuallyPaused = false;
    requestMusicWakeLock();

    if (currentPlayingType === "audio" && nativeAudioPlayer) {
      playSilentAnchor();
      try { nativeAudioPlayer.play(); } catch (_) {}
    } else if (currentPlayingType === "youtube") {
      pauseSilentAnchor();
      if (ytReady && ytPlayer?.playVideo) {
        try {
          ensureYtAudio();
          ytPlayer.playVideo();
        } catch (_) {}
      } else if (directIframeEl) {
        try {
          directIframeEl.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          directIframePlaying = true;
        } catch (_) {}
      }
    }

    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "playing"; } catch (_) {}
    }
    if (miniPlayerToggle) miniPlayerToggle.dataset.state = "pause";
    if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
    if (musicFullPlayerArt) {
      musicFullPlayerArt.classList.add("is-playing");
    }
    startMiniProgress();
  }

  function pauseMusicPlayback() {
    musicUserPlaying = false;
    userManuallyPaused = true;
    releaseMusicWakeLock();
    pauseSilentAnchor();

    if (currentPlayingType === "audio" && nativeAudioPlayer) {
      try { nativeAudioPlayer.pause(); } catch (_) {}
    } else if (currentPlayingType === "youtube") {
      if (ytReady && ytPlayer?.pauseVideo) {
        try { ytPlayer.pauseVideo(); } catch (_) {}
      } else if (directIframeEl) {
        try {
          directIframeEl.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          directIframePlaying = false;
        } catch (_) {}
      }
    }
    
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "paused"; } catch (_) {}
    }
    if (miniPlayerToggle) miniPlayerToggle.dataset.state = "play";
    if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "play";
    if (musicFullPlayerArt) {
      musicFullPlayerArt.classList.remove("is-playing");
    }
  }

  function toggleMusicPlayback() {
    if (currentPlayingType === "audio" && nativeAudioPlayer) {
      if (nativeAudioPlayer.paused) resumeMusicPlayback();
      else pauseMusicPlayback();
      return;
    }
    if (!ytReady || !ytPlayer) {
      if (musicUserPlaying) pauseMusicPlayback();
      else resumeMusicPlayback();
      return;
    }
    try {
      const s = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
      const isPlaying = (window.YT?.PlayerState && s === window.YT.PlayerState.PLAYING) || s === 1;
      if (isPlaying) pauseMusicPlayback();
      else resumeMusicPlayback();
    } catch (_) {
      if (musicUserPlaying) pauseMusicPlayback();
      else resumeMusicPlayback();
    }
  }

  // Ekran bloklanganda, mini app pastga tushirilganda yoki boshqa ilovaga o'tilganda fon ijrosini davom ettirish
  try {
    const handleForegroundReturn = () => {
      if (musicUserPlaying && !userManuallyPaused) {
        requestMusicWakeLock();
        if (currentPlayingType === "audio" && nativeAudioPlayer) {
          playSilentAnchor();
          try { nativeAudioPlayer.play(); } catch (_) {}
        } else if (currentPlayingType === "youtube") {
          pauseSilentAnchor();
          if (ytReady && ytPlayer?.playVideo) {
            try {
              ensureYtAudio();
              const s = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
              if (s !== 1) ytPlayer.playVideo();
            } catch (_) {}
          } else if (directIframeEl) {
            try {
              directIframeEl.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
              directIframePlaying = true;
            } catch (_) {}
          }
        }
        if (miniPlayerToggle) miniPlayerToggle.dataset.state = "pause";
        if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
        if ("mediaSession" in navigator) {
          try { navigator.mediaSession.playbackState = "playing"; } catch (_) {}
        }
      }
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        handleForegroundReturn();
      } else if (musicUserPlaying && !userManuallyPaused && currentPlayingType === "audio") {
        playSilentAnchor();
      }
    });
    window.addEventListener("focus", handleForegroundReturn);
    window.addEventListener("blur", () => {
      if (musicUserPlaying && !userManuallyPaused && currentPlayingType === "audio") playSilentAnchor();
    });

    // Telegram Mini App minimallashtirilganda yoki pastga surilganda fon ijrosi to'xtamasligi:
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.onEvent === "function") {
      tg.onEvent("viewportChanged", () => {
        if (musicUserPlaying && !userManuallyPaused) {
          if (currentPlayingType === "audio") {
            playSilentAnchor();
            if (nativeAudioPlayer?.paused) nativeAudioPlayer.play().catch(() => {});
          } else if (currentPlayingType === "youtube") {
            pauseSilentAnchor();
            if (ytReady && ytPlayer?.playVideo) {
              ensureYtAudio();
              const s = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
              if (s !== 1) ytPlayer.playVideo();
            } else if (directIframeEl) {
              try {
                directIframeEl.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                directIframePlaying = true;
              } catch (_) {}
            }
          }
        }
      });
    }
  } catch (_) {}

  // Har qanday ekran bosilganda YouTube ovozini majburiy yoqish (unMute gesture)
  try {
    const unlockAudioOnTouch = () => {
      if (musicUserPlaying && !userManuallyPaused && currentPlayingType === "youtube") {
        ensureYtAudio();
      }
    };
    window.addEventListener("pointerdown", unlockAudioOnTouch, { passive: true });
    window.addEventListener("touchend", unlockAudioOnTouch, { passive: true });
    window.addEventListener("click", unlockAudioOnTouch, { passive: true });
  } catch (_) {}

    function ensureMusicYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (typeof window.ensureYouTubeApi === "function") {
      return window.ensureYouTubeApi();
    }
    if (window._musicYtPromise) return window._musicYtPromise;
    window._musicYtPromise = new Promise((resolve, reject) => {
      let resolved = false;
      let pollId = 0;
      let timeoutId = 0;
      const finishResolve = (yt) => {
        if (resolved) return;
        resolved = true;
        if (pollId) clearInterval(pollId);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(yt);
      };
      const finishReject = (err) => {
        if (resolved) return;
        resolved = true;
        if (pollId) clearInterval(pollId);
        if (timeoutId) clearTimeout(timeoutId);
        window._musicYtPromise = null;
        reject(err);
      };
      const existingScript = document.querySelector('script[data-youtube-iframe-api="1"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.dataset.youtubeIframeApi = "1";
        script.onerror = () => finishReject(new Error("YouTube iframe API yuklanmadi."));
        document.head.append(script);
      }
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch (_) {}
        if (window.YT?.Player) finishResolve(window.YT);
      };
      pollId = setInterval(() => {
        if (window.YT?.Player) finishResolve(window.YT);
      }, 50);
      timeoutId = setTimeout(() => {
        if (window.YT?.Player) {
          finishResolve(window.YT);
        } else {
          finishReject(new Error("YouTube iframe API timeout"));
        }
      }, 9000);
    });
    return window._musicYtPromise;
  }

  function fallbackToNativeStream(track) {
    if (!track?.youtubeId) return;
    mountDirectMusicIframe(track.youtubeId, track);
  }

// ----- YouTube Player Manager -----
  let ytPlayer = null;
  let ytReady = false;
  let directIframeEl = null;
  let directIframePlaying = false;
  let directIframeDuration = 210;
  let directIframeProgress = 0;
  let ytMountRequestId = 0;
  let ytStartupTimer = null;
  let ytProgressTimer = null;

  function destroyMusicYtPlayer() {
    clearTimeout(ytStartupTimer);
    directIframeEl = null;
    directIframePlaying = false;
    directIframeProgress = 0;
    if (ytPlayer?.destroy) {
      try { ytPlayer.destroy(); } catch (_) {}
    }
    ytPlayer = null;
    ytReady = false;
    if (musicFullPlayerYtSlot) {
      musicFullPlayerYtSlot.replaceChildren();
    }
    if (musicFullPlayerArt) {
      musicFullPlayerArt.classList.remove("has-video");
    }
  }

  function mountDirectMusicIframe(videoId, track) {
    if (!musicFullPlayerYtSlot || !videoId) return;
    clearTimeout(ytStartupTimer);
    destroyMusicYtPlayer();

    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
    iframe.title = track?.title || "Music";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    iframe.setAttribute("playsinline", "1");
    iframe.setAttribute("webkit-playsinline", "1");
    iframe.style.cssText = "width:100%;height:100%;border:0;position:absolute;inset:0;z-index:5;";
    musicFullPlayerYtSlot.replaceChildren(iframe);

    directIframeEl = iframe;
    directIframePlaying = true;
    ytReady = true;
    musicUserPlaying = true;
    userManuallyPaused = false;
    requestMusicWakeLock();

    if (musicFullPlayerArt) {
      musicFullPlayerArt.classList.add("has-video");
      musicFullPlayerArt.classList.add("is-playing");
    }
    if (miniPlayerToggle) miniPlayerToggle.dataset.state = "pause";
    if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "playing"; } catch (_) {}
    }
    startMiniProgress();
  }

  async function mountMusicYouTubePlayer(track) {
    const videoId = track?.youtubeId;
    if (!videoId) return;
    const reqId = ++ytMountRequestId;

    destroyMusicYtPlayer();

    const mountNode = document.createElement("div");
    mountNode.id = `ytPlayer_${reqId}`;
    mountNode.style.width = "100%";
    mountNode.style.height = "100%";
    if (musicFullPlayerYtSlot) {
      musicFullPlayerYtSlot.replaceChildren(mountNode);
    }

    clearTimeout(ytStartupTimer);
    ytStartupTimer = setTimeout(() => {
      if (reqId !== ytMountRequestId) return;
      if (!musicUserPlaying || userManuallyPaused) return;
      const s = ytPlayer?.getPlayerState ? ytPlayer.getPlayerState() : -1;
      if (s !== 1) { // 1 = PLAYING
        console.warn("Music YT player startup timeout, falling back to direct iframe...");
        mountDirectMusicIframe(videoId, track);
      }
    }, 2800);

    try {
      const YT = await ensureMusicYouTubeApi();
      if (reqId !== ytMountRequestId) return;

      ytPlayer = new YT.Player(mountNode, {
        host: "https://www.youtube.com",
        videoId: videoId,
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: () => {
            if (reqId !== ytMountRequestId) return;
            ytReady = true;
            try {
              const iframe = ytPlayer.getIframe?.() || musicFullPlayerYtSlot?.querySelector("iframe");
              if (iframe) {
                iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
                iframe.setAttribute("playsinline", "1");
                iframe.setAttribute("webkit-playsinline", "1");
              }
            } catch (_) {}
            try { ytPlayer.setVolume?.(100); } catch (_) {}
            try { ytPlayer.unMute?.(); } catch (_) {}
            try { ytPlayer.playVideo?.(); } catch (_) {}
            musicUserPlaying = true;
            userManuallyPaused = false;
            requestMusicWakeLock();
            startMiniProgress();
          },
          onStateChange: (e) => {
            if (reqId !== ytMountRequestId) return;
            if (!window.YT) return;
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) {
              clearTimeout(ytStartupTimer);
              musicUserPlaying = true;
              userManuallyPaused = false;
              ensureYtAudio();
              requestMusicWakeLock();
              if ("mediaSession" in navigator) {
                try { navigator.mediaSession.playbackState = "playing"; } catch (_) {}
              }
              if (miniPlayerToggle) miniPlayerToggle.dataset.state = "pause";
              if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
              if (musicFullPlayerArt) {
                musicFullPlayerArt.classList.add("is-playing");
                musicFullPlayerArt.classList.add("has-video");
              }
              startMiniProgress();
            } else if (e.data === S.PAUSED) {
              if (!userManuallyPaused && musicUserPlaying) {
                const tryResume = () => {
                  if (musicUserPlaying && !userManuallyPaused && ytPlayer?.playVideo) {
                    try {
                      ensureYtAudio();
                      ytPlayer.playVideo();
                    } catch (_) {}
                  }
                };
                setTimeout(tryResume, 80);
                setTimeout(tryResume, 250);
                return;
              }
              musicUserPlaying = false;
              releaseMusicWakeLock();
              pauseSilentAnchor();
              if ("mediaSession" in navigator) {
                try { navigator.mediaSession.playbackState = "paused"; } catch (_) {}
              }
              if (miniPlayerToggle) miniPlayerToggle.dataset.state = "play";
              if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "play";
              if (musicFullPlayerArt) {
                musicFullPlayerArt.classList.remove("is-playing");
              }
            } else if (e.data === S.ENDED) {
              releaseMusicWakeLock();
              if ("mediaSession" in navigator) {
                try { navigator.mediaSession.playbackState = "paused"; } catch (_) {}
              }
              try { autoAdvance(); } catch (_) {}
            }
          },
          onError: (e) => {
            if (reqId !== ytMountRequestId) return;
            console.warn("YT player error", e?.data);
            clearTimeout(ytStartupTimer);
            mountDirectMusicIframe(videoId, track);
          }
        }
      });
    } catch (err) {
      if (reqId !== ytMountRequestId) return;
      console.warn("Failed to init YT.Player, fallback to direct iframe:", err);
      mountDirectMusicIframe(videoId, track);
    }
  }

  // YouTube IFrame API ready callback zanjiri
  (function chainYouTubeReadyCallback() {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      try { prev?.(); } catch (_) {}
    };
    try {
      ensureMusicYouTubeApi().catch(() => {});
    } catch (_) {}
  })();

  function stopMiniProgress() {
    if (ytProgressTimer) {
      clearInterval(ytProgressTimer);
      ytProgressTimer = null;
    }
  }

  function startMiniProgress() {
    if (ytProgressTimer) return;
    ytProgressTimer = setInterval(() => {
      let cur = 0;
      let dur = 0;
      if (currentPlayingType === "audio" && nativeAudioPlayer) {
        cur = nativeAudioPlayer.currentTime || 0;
        dur = nativeAudioPlayer.duration || 0;
      } else if (directIframeEl && directIframePlaying) {
        directIframeProgress = Math.min(directIframeDuration, directIframeProgress + 0.5);
        cur = directIframeProgress;
        dur = directIframeDuration;
        if (directIframeProgress >= directIframeDuration) {
          try { autoAdvance(); } catch (_) {}
        }
      } else if (ytReady && ytPlayer?.getCurrentTime) {
        try {
          cur = ytPlayer.getCurrentTime() || 0;
          dur = ytPlayer.getDuration() || 0;
        } catch (_) {}
      } else {
        return;
      }
      try {
        if (miniPlayerTime) miniPlayerTime.textContent = formatMusicTime(cur);
        if (miniPlayerBarFill && dur > 0) miniPlayerBarFill.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
        if (musicFullPlayerCur) musicFullPlayerCur.textContent = formatMusicTime(cur);
        if (musicFullPlayerDur && dur > 0) musicFullPlayerDur.textContent = `-${formatMusicTime(Math.max(0, dur - cur))}`;
        if (musicFullPlayerBarFill && dur > 0) {
          const pct = Math.min(100, (cur / dur) * 100);
          musicFullPlayerBarFill.style.width = `${pct}%`;
          if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = `${pct}%`;
        }
        syncMediaPositionState();
      } catch (_) {}

      // Agar YouTube tasodifan muted holatga tushib qolsa, ovozini majburiy tiklaymiz:
      if (musicUserPlaying && !userManuallyPaused && currentPlayingType === "youtube" && ytReady && ytPlayer) {
        try {
          if (typeof ytPlayer.isMuted === "function" && ytPlayer.isMuted()) {
            ensureYtAudio();
          }
          const s = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
          if (s === 2) { // 2 = PAUSED
            ensureYtAudio();
            ytPlayer.playVideo();
          }
        } catch (_) {}
      }
    }, 500);
  }

  function playMusicTrack(track) {
    if (!track) return;
    musicCurrentTrackKey = trackKey(track);
    musicUserPlaying = true;
    userManuallyPaused = false;
    requestMusicWakeLock();
    initMediaSession();
    updateMediaSessionMetadata(track);
    try { recordMusicListen?.(track); } catch (_) {}
    if (miniPlayerTitle) miniPlayerTitle.textContent = displayTrackTitle(track);
    if (miniPlayerArtistEl) miniPlayerArtistEl.textContent = track.artist;
    const miniArt = document.getElementById("miniPlayerArt");
    const artUrl = getTrackArtUrl(track);
    if (miniArt && artUrl) {
      miniArt.src = artUrl;
    }
    if (miniPlayerBarFill) miniPlayerBarFill.style.width = "0%";
    if (miniPlayerTime) miniPlayerTime.textContent = "0:00";
    showMiniPlayer();
    openMusicFullPlayer(track);

    const directAudioUrl = track.audioUrl || (track.url && /\.(mp3|m4a|aac|ogg|wav)(\?.*)?$/i.test(track.url) ? track.url : null);
    if (directAudioUrl) {
      currentPlayingType = "audio";
      destroyMusicYtPlayer();
      const audio = getNativeAudioPlayer();
      if (audio) {
        if (audio.src !== directAudioUrl && !audio.src.endsWith(directAudioUrl)) {
          audio.src = directAudioUrl;
        }
        const p = audio.play();
        if (p && typeof p.catch === "function") {
          p.catch((err) => console.warn("audio play catch:", err));
        }
      }
      playSilentAnchor();
    } else {
      currentPlayingType = "youtube";
      pauseSilentAnchor();
      if (nativeAudioPlayer) {
        try { nativeAudioPlayer.pause(); } catch (_) {}
      }
      mountMusicYouTubePlayer(track);
    }

    startMiniProgress();
    renderMusicList();
    if (document.getElementById("musicAllSongs") && !document.getElementById("musicAllSongs").hidden) renderAllSongs();
  }

  function showMiniPlayer() {
    if (!miniPlayer) return;
    miniPlayer.removeAttribute("hidden");
    requestAnimationFrame(() => miniPlayer.setAttribute("aria-hidden", "false"));
  }

  function hideMiniPlayer() {
    if (!miniPlayer) return;
    miniPlayer.setAttribute("aria-hidden", "true");
    musicUserPlaying = false;
    userManuallyPaused = true;
    releaseMusicWakeLock();
    pauseSilentAnchor();
    if (currentPlayingType === "audio" && nativeAudioPlayer) {
      try { nativeAudioPlayer.pause(); } catch (_) {}
    } else {
      try { if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo(); } catch (_) {}
    }
    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.playbackState = "none"; } catch (_) {}
    }
    stopMiniProgress();
  }

  musicView?.addEventListener("click", (event) => {
    const catBtn = event.target.closest("[data-music-cat]");
    if (catBtn) {
      musicCategory = catBtn.dataset.musicCat;
      renderMusicFilters();
      renderMusicList();
      return;
    }
    const artBtn = event.target.closest("[data-music-artist]");
    if (artBtn) {
      const val = artBtn.dataset.musicArtist;
      if (val === "all") {
        openAllArtists();
      } else {
        openArtistDetail(val);
      }
      return;
    }
    if (event.target.closest("[data-music-more]")) {
      openAllSongs();
      return;
    }
    const row = event.target.closest("[data-music-row]");
    if (row) {
      const id = row.dataset.musicRow;
      const track = musicAllTracks.find((t) => t.youtubeId === id);
      if (track) { setMusicPlayContext({ kind: "list" }); playMusicTrack(track); }
    }
  });

  musicSearchBtn?.addEventListener("click", () => {
    if (!musicSearchBar) return;
    const willOpen = musicSearchBar.hidden;
    musicSearchBar.hidden = !willOpen;
    if (willOpen) musicSearchInput?.focus();
  });
  musicSearchInput?.addEventListener("input", (e) => {
    clearTimeout(musicSearchDebounce);
    musicSearchDebounce = setTimeout(() => {
      musicQuery = e.target.value.trim();
      renderMusicList();
    }, 200);
  });
  musicSearchClear?.addEventListener("click", () => {
    if (musicSearchInput) musicSearchInput.value = "";
    musicQuery = "";
    renderMusicList();
  });
  musicRetryBtn?.addEventListener("click", loadMusicCatalog);

  const musicFullPlayer = document.getElementById("musicFullPlayer");
  const musicFullPlayerArt = document.getElementById("musicFullPlayerArt");
  const musicFullPlayerArtFallback = document.getElementById("musicFullPlayerArtFallback");
  const musicFullPlayerYtSlot = document.getElementById("musicFullPlayerYtSlot");
  const musicFullPlayerAlbum = document.getElementById("musicFullPlayerAlbum");
  const musicFullPlayerTitle = document.getElementById("musicFullPlayerTitle");
  const musicFullPlayerArtist = document.getElementById("musicFullPlayerArtist");
  const musicFullPlayerCur = document.getElementById("musicFullPlayerCur");
  const musicFullPlayerDur = document.getElementById("musicFullPlayerDur");
  const musicFullPlayerBar = document.getElementById("musicFullPlayerBar");
  const musicFullPlayerBarFill = document.getElementById("musicFullPlayerBarFill");
  const musicFullPlayerBarThumb = document.getElementById("musicFullPlayerBarThumb");
  const musicFullPlayerToggle = document.getElementById("musicFullPlayerToggle");
  const musicFullPlayerAddToPlaylist = document.getElementById("musicFullPlayerAddToPlaylist");
  const musicFullPlayerRepeat = document.getElementById("musicFullPlayerRepeat");
  const musicFullPlayerLike = document.getElementById("musicFullPlayerLike");
  const miniPlayerYtHost = document.getElementById("miniPlayerYt");

  let musicShuffle = false;
  let musicRepeat = "off";
  let musicPlayContext = { kind: "list" };
  function setMusicPlayContext(ctx) { musicPlayContext = ctx && ctx.kind ? ctx : { kind: "list" }; }

  function moveYtIntoFullPlayer() {
    musicFullPlayerArt?.classList.remove("has-video");
  }
  function moveYtBackToMini() {
    // no-op
  }

  function openMusicFullPlayer(track) {
    if (!musicFullPlayer || !track) return;
    document.body.classList.add("fullplayer-open");
    const artUrl = getTrackArtUrl(track);
    if (musicFullPlayerArtFallback && artUrl) {
      musicFullPlayerArtFallback.style.backgroundImage = `url('${artUrl.replaceAll("'", "%27")}')`;
    }
    if (musicFullPlayerAlbum) {
      musicFullPlayerAlbum.textContent = track.artist || displayTrackTitle(track) || M("musicLabel");
    }
    if (musicFullPlayerTitle) musicFullPlayerTitle.textContent = displayTrackTitle(track);
    if (musicFullPlayerArtist) musicFullPlayerArtist.textContent = track.artist;
    if (musicFullPlayerBarFill) musicFullPlayerBarFill.style.width = "0%";
    if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = "0%";
    if (musicFullPlayerCur) musicFullPlayerCur.textContent = "0:00";
    if (musicFullPlayerDur) musicFullPlayerDur.textContent = "0:00";
    if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = musicUserPlaying ? "pause" : "play";
    if (musicFullPlayerArt) {
      if (musicUserPlaying) musicFullPlayerArt.classList.add("is-playing");
      else musicFullPlayerArt.classList.remove("is-playing");
      musicFullPlayerArt.classList.remove("has-video");
    }
    if (musicFullPlayerLike) {
      const inPl = readMusicPlaylist().includes(track.youtubeId);
      musicFullPlayerLike.setAttribute("aria-pressed", inPl ? "true" : "false");
      musicFullPlayerLike.dataset.id = track.youtubeId;
    }
    musicFullPlayer.hidden = false;
    requestAnimationFrame(() => musicFullPlayer.setAttribute("aria-hidden", "false"));
    tgBackRegister("music-fullplayer", () => { try { closeMusicFullPlayer(); } catch (_) {} });
  }

  function closeMusicFullPlayer() {
    if (!musicFullPlayer) return;
    musicFullPlayer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("fullplayer-open");
    tgBackUnregister("music-fullplayer");
  }

  (function setupMusicFullPlayerSwipe() {
    if (!musicFullPlayer) return;
    let startY = 0;
    let startX = 0;
    let dragging = false;

    musicFullPlayer.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      if (e.target.closest("button, input, [data-music-fp-toggle], .music-fullplayer__bar")) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });

    musicFullPlayer.addEventListener("touchmove", (e) => {
      if (!dragging || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        musicFullPlayer.style.transform = `translateY(${Math.min(dy, 280)}px)`;
        musicFullPlayer.style.opacity = `${Math.max(0.4, 1 - dy / 400)}`;
      }
    }, { passive: true });

    const finishSwipe = (e) => {
      if (!dragging) return;
      dragging = false;
      const touch = e.changedTouches ? e.changedTouches[0] : null;
      const dy = touch ? touch.clientY - startY : 0;
      musicFullPlayer.style.transition = "transform 220ms ease, opacity 220ms ease";
      if (dy > 70) {
        musicFullPlayer.style.transform = "translateY(100%)";
        musicFullPlayer.style.opacity = "0";
        setTimeout(() => {
          musicFullPlayer.style.transition = "";
          musicFullPlayer.style.transform = "";
          musicFullPlayer.style.opacity = "";
          closeMusicFullPlayer();
        }, 220);
      } else {
        musicFullPlayer.style.transform = "";
        musicFullPlayer.style.opacity = "";
        setTimeout(() => {
          musicFullPlayer.style.transition = "";
        }, 220);
      }
    };

    musicFullPlayer.addEventListener("touchend", finishSwipe, { passive: true });
    musicFullPlayer.addEventListener("touchcancel", finishSwipe, { passive: true });
  })();

  function playlistTracks(plId) {
    const pl = getPlaylists().find((p) => p.id === plId);
    if (!pl) return [];
    return (pl.tracks || [])
      .map((id) => musicAllTracks.find((t) => t.youtubeId === id))
      .filter(Boolean);
  }
  function getContextList() {
    if (musicPlayContext.kind === "playlist") {
      const list = playlistTracks(musicPlayContext.id);
      if (list.length) return list;
    }
    return shuffleTracks(filteredMusicTracks());
  }
  function currentTrackIndex() {
    const list = getContextList();
    return list.findIndex((t) => trackKey(t) === musicCurrentTrackKey);
  }
  function playRelative(offset) {
    const list = getContextList();
    if (!list.length) return;
    const cur = currentTrackIndex();
    let nextIdx;
    if (musicShuffle && list.length > 1) {
      do { nextIdx = Math.floor(Math.random() * list.length); } while (nextIdx === cur);
    } else {
      nextIdx = cur < 0 ? 0 : (cur + offset + list.length) % list.length;
    }
    playMusicTrack(list[nextIdx]);
  }

  function autoAdvance() {
    if (musicRepeat === "one") {
      if (currentPlayingType === "audio" && nativeAudioPlayer) {
        try { nativeAudioPlayer.currentTime = 0; nativeAudioPlayer.play(); } catch (_) {}
      } else if (ytReady && ytPlayer?.seekTo) {
        try { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); } catch (_) {}
      } else if (directIframeEl) {
        directIframeProgress = 0;
        try {
          directIframeEl.contentWindow?.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
          directIframeEl.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        } catch (_) {}
      }
      return;
    }
    const list = getContextList();
    if (!list.length) return;
    const cur = currentTrackIndex();
    if (musicPlayContext.kind === "playlist" && cur >= list.length - 1) {
      if (musicRepeat === "all") { playMusicTrack(list[0]); return; }
      handlePlaylistEnded();
      return;
    }
    if (musicRepeat === "off" && !musicShuffle && cur >= list.length - 1) return;
    playRelative(1);
  }

  function handlePlaylistEnded() {
    const curPl = getPlaylists().find((p) => p.id === musicPlayContext.id);
    if (!curPl) return;
    const all = getPlaylists();
    const idx = all.findIndex((p) => p.id === curPl.id);
    let nextPl = null;
    for (let i = idx + 1; i < all.length; i += 1) {
      if (playlistTracks(all[i].id).length) { nextPl = all[i]; break; }
    }
    const tg = window.Telegram?.WebApp;
    const restart = () => {
      const tracks = playlistTracks(curPl.id);
      if (!tracks[0]) return;
      setMusicPlayContext({ kind: "playlist", id: curPl.id });
      playMusicTrack(tracks[0]);
    };
    const playNext = () => {
      if (!nextPl) { restart(); return; }
      const tracks = playlistTracks(nextPl.id);
      if (!tracks[0]) { restart(); return; }
      setMusicPlayContext({ kind: "playlist", id: nextPl.id });
      playMusicTrack(tracks[0]);
    };
    pauseMusicPlayback();
    const buttons = [{ id: "restart", type: "default", text: M("startOver") }];
    if (nextPl) buttons.push({ id: "next", type: "default", text: `Keyingisi: ${nextPl.name}` });
    buttons.push({ id: "cancel", type: "cancel" });
    if (tg?.showPopup) {
      tg.showPopup({
        title: `"${curPl.name}" tugadi`,
        message: nextPl ? M("startOverOrNext") : M("startOverConfirm"),
        buttons,
      }, (id) => {
        if (id === "restart") restart();
        else if (id === "next") playNext();
      });
    } else {
      const msg = nextPl
        ? `"${curPl.name}" tugadi.\nOK — boshidan, Bekor — "${nextPl.name}" ga o'tish.`
        : `"${curPl.name}" tugadi. Boshidan boshlaymizmi?`;
      const ok = (window.confirm || (() => false))(msg);
      if (ok) restart();
      else if (nextPl) playNext();
    }
  }

  musicFullPlayer?.addEventListener("click", (e) => {
    if (e.target.closest("[data-music-fp-close]")) { closeMusicFullPlayer(); return; }
    if (e.target.closest("[data-music-fp-toggle]")) {
      toggleMusicPlayback();
      return;
    }
    if (e.target.closest("[data-music-fp-prev]")) { playRelative(-1); return; }
    if (e.target.closest("[data-music-fp-next]")) { playRelative(1); return; }
    if (e.target.closest("[data-music-fp-addlist]")) {
      // Joriy qo'shiqni playlistga qo'shish — savesheet ochiladi
      const id = musicFullPlayerLike?.dataset.id;
      if (id) handleSaveButtonClick(id);
      return;
    }
    if (e.target.closest("[data-music-fp-repeat]")) {
      musicRepeat = musicRepeat === "off" ? "all" : musicRepeat === "all" ? "one" : "off";
      if (musicFullPlayerRepeat) {
        musicFullPlayerRepeat.dataset.repeat = musicRepeat;
        musicFullPlayerRepeat.setAttribute("aria-pressed", musicRepeat === "off" ? "false" : "true");
      }
      return;
    }
    if (e.target.closest("#musicFullPlayerLike")) {
      const id = musicFullPlayerLike?.dataset.id;
      if (id) handleSaveButtonClick(id);
      return;
    }
  });

  musicFullPlayerBar?.addEventListener("click", (e) => {
    try {
      const rect = musicFullPlayerBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      if (currentPlayingType === "audio" && nativeAudioPlayer) {
        const dur = nativeAudioPlayer.duration || 0;
        if (dur > 0) {
          nativeAudioPlayer.currentTime = dur * pct;
          syncMediaPositionState();
        }
      } else if (ytReady && ytPlayer?.getDuration) {
        const dur = ytPlayer.getDuration() || 0;
        if (dur > 0) {
          ytPlayer.seekTo(dur * pct, true);
          syncMediaPositionState();
        }
      } else if (directIframeEl) {
        directIframeProgress = directIframeDuration * pct;
        try {
          directIframeEl.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func: "seekTo", args: [directIframeProgress, true] }),
            "*"
          );
        } catch (_) {}
        syncMediaPositionState();
      }
    } catch (_) {}
  });

  musicCarouselTrack?.addEventListener("click", (e) => {
    const artistSlide = e.target.closest("[data-music-slide-artist]");
    if (artistSlide) {
      openArtistDetail(artistSlide.dataset.musicSlideArtist);
      return;
    }
    const slide = e.target.closest("[data-music-slide]");
    if (!slide) return;
    const id = slide.dataset.musicSlide;
    const track = musicAllTracks.find((t) => t.youtubeId === id);
    if (track) { setMusicPlayContext({ kind: "list" }); playMusicTrack(track); }
  });
  musicCarouselDots?.addEventListener("click", (e) => {
    const dot = e.target.closest("[data-music-dot]");
    if (!dot) return;
    setMusicCarouselIndex(parseInt(dot.dataset.musicDot, 10) || 0);
    startMusicCarouselTimer();
  });

  if (musicCarouselTrack) {
    let sx = 0, sy = 0, active = false, moved = false;
    musicCarouselTrack.addEventListener("touchstart", (e) => {
      if (!e.touches[0] || musicCarouselItems.length < 2) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      active = true;
      moved = false;
      stopMusicCarouselTimer();
    }, { passive: true });
    musicCarouselTrack.addEventListener("touchmove", (e) => {
      if (!active || !e.touches[0]) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        active = false;
        return;
      }
      if (Math.abs(dx) > 8) moved = true;
    }, { passive: true });
    const finish = (e) => {
      const wasActive = active;
      active = false;
      if (wasActive) {
        const t = e.changedTouches && e.changedTouches[0];
        const dx = t ? t.clientX - sx : 0;
        if (Math.abs(dx) > 40 && musicCarouselItems.length > 1) {
          setMusicCarouselIndex(musicCarouselIndex + (dx < 0 ? 1 : -1));
        }
      }
      startMusicCarouselTimer();
    };
    musicCarouselTrack.addEventListener("touchend", finish);
    musicCarouselTrack.addEventListener("touchcancel", finish);
    musicCarouselTrack.addEventListener("click", (e) => {
      if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
    }, true);
  }

  musicView?.addEventListener("click", (e) => {
    const addBtn = e.target.closest("[data-music-add]");
    if (addBtn) {
      e.stopPropagation();
      handleSaveButtonClick(addBtn.dataset.musicAdd);
    }
  });

  miniPlayerToggle?.addEventListener("click", () => {
    toggleMusicPlayback();
  });
  miniPlayerClose?.addEventListener("click", hideMiniPlayer);
  document.getElementById("miniPlayerPrev")?.addEventListener("click", () => playRelative(-1));
  document.getElementById("miniPlayerNext")?.addEventListener("click", () => playRelative(1));
  document.getElementById("miniPlayerExpand")?.addEventListener("click", () => {
    const track = musicAllTracks.find((t) => trackKey(t) === musicCurrentTrackKey);
    if (track) openMusicFullPlayer(track);
  });

  document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.addEventListener("click", closeMusicView));
  document.querySelectorAll(".bottom-bar [data-action='favorites'], .bottom-bar [data-action='catalog']").forEach((b) => b.addEventListener("click", closeMusicView));

  // ===== Public API =====
  window.__music = {
    openMusicView,
    closeMusicView,
    openAllArtists,
    closeAllArtists,
    openAllSongs,
    closeAllSongs,
    openArtistDetail,
    closeArtistDetail,
    openPlaylistsView,
    closePlaylistsView,
    playMusicTrack,
    renderMusicList,
    scrollMusicTop,
    setMusicNavActive,
    setQuery(q) { musicQuery = String(q || ""); renderMusicList(); },
    findTrackById(id) { return musicAllTracks.find((t) => t.youtubeId === id) || null; },
    hideMiniPlayer,
    togglePlayback: toggleMusicPlayback,
    resume: resumeMusicPlayback,
    pause: pauseMusicPlayback,
  };

  // Til o'zgarganda — musiqa ro'yxati va artist row qayta render qilinadi,
  // shu bilan birga statik aria-label/title atributlar mavjud DOM ichida
  // qayta yangilanadi (kino.js dagi applyCopy data-i18n-* atributlarini topib oladi).
  try {
    window.addEventListener("kino-lang-change", () => {
      try { renderMusicList?.(); } catch (_) {}
      try { renderArtistRow?.(); } catch (_) {}
    });
  } catch (_) {}
})();
