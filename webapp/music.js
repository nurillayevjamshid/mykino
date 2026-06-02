// Musiqa moduli — lazy-load qilinadi (app.js ichidagi ensureMusicModule orqali).
// Tashqi global'lar app.js dan kelishi kerak: tg, haptic, t, getRank, escapeHtml,
// getTelegramUser, recordMusicListen, tgBackRegister, tgBackUnregister, setFilter,
// ensureYouTubeApi, profileModal.
//
// Tashqariga: window.__music = { openMusicView, closeMusicView, ... }
(function () {
  "use strict";

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
          <svg viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14.4" fill="none" stroke="currentColor" stroke-width="1.6"></circle>
            <path d="M13 11.4 22.2 16 13 20.6Z" fill="currentColor"></path>
          </svg>
        </span>
        <span class="music-splash__name">
          <b>MY</b><span>PLAYLIST</span>
        </span>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }
  function showMusicSplash() { ensureMusicSplash().hidden = false; }
  function hideMusicSplash() {
    const el = document.getElementById("musicSplash");
    if (el) el.hidden = true;
  }

  async function loadMusicCatalog() {
    showMusicSplash();
    showMusicState("loading");
    let seed = [];
    try {
      const res = await fetch("/api/music", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      seed = Array.isArray(json.tracks) ? json.tracks : [];
    } catch (err) {
      if (musicErrorText) musicErrorText.textContent = err.message || "Yuklab bo'lmadi.";
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
      .split(/\s*(?:&|,|\bfeat\.?\b|\bft\.?\b|\band\b|x|×)\s*/i)
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
    all: '<span class="ms-icon" aria-hidden="true">library_music</span>',
    pop: '<span class="ms-icon" aria-hidden="true">star</span>',
    rap: '<span class="ms-icon" aria-hidden="true">mic</span>',
    rock: '<span class="ms-icon" aria-hidden="true">bolt</span>',
    jazz: '<span class="ms-icon" aria-hidden="true">music_note</span>',
    classic: '<span class="ms-icon" aria-hidden="true">piano</span>',
    electronic: '<span class="ms-icon" aria-hidden="true">graphic_eq</span>',
    uzbek: '<span class="ms-icon" aria-hidden="true">auto_awesome</span>',
    folk: '<span class="ms-icon" aria-hidden="true">album</span>',
    hiphop: '<span class="ms-icon" aria-hidden="true">queue_music</span>',
  };

  const MUSIC_ARTIST_ICON = '<span class="ms-icon" aria-hidden="true">person</span>';
  const MUSIC_DEFAULT_ICON = '<span class="ms-icon" aria-hidden="true">music_note</span>';

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
    const img = findArtistImage(name);
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
      const res = await fetch("/api/music?resource=artists", { cache: "no-store" });
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
      const items = [
        musicChipHtml({ active: musicCategory === "all", dataAttr: "data-music-cat", value: "all", label: "Hammasi", icon: musicCategoryIcon("all") }),
      ].concat(cats.map((c) => musicChipHtml({
        active: musicCategory === c,
        dataAttr: "data-music-cat",
        value: c,
        label: c,
        icon: musicCategoryIcon(c),
      })));
      musicCategoryRow.innerHTML = items.join("");
    }
    if (musicArtistRow) {
      const eligible = shuffleMusicArtists(eligibleArtistNames());
      const items = [
        musicArtistCardHtml("Hammasi", "all", "Hammasi"),
      ].concat(eligible.map((a) => musicArtistCardHtml(a)));
      musicArtistRow.innerHTML = items.join("");
    }
  }

  function filteredMusicTracks() {
    const q = musicQuery.toLowerCase();
    return musicAllTracks.filter((t) => {
      if (musicCategory !== "all" && !trackCategories(t).some((c) => c === musicCategory)) return false;
      if (musicArtist !== "all" && !trackHasArtist(t, musicArtist)) return false;
      if (q && !(t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))) return false;
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
              <span class="music-row__title">${escapeMusicHtml(t.title)}</span>
              <span class="music-row__sub">${escapeMusicHtml(t.artist)}</span>
            </span>
          </button>
          <div class="music-row__actions">
            <button class="music-row__btn music-row__btn--add ${inPl ? "is-added" : ""}" type="button" data-music-add="${id}" aria-label="Playlistga qo'shish">
              <span class="ms-icon" aria-hidden="true">add</span>
            </button>
            <button class="music-row__btn music-row__btn--play" type="button" data-music-row="${id}" aria-label="Play">
              <span class="ms-icon ms-icon--fill" aria-hidden="true">play_arrow</span>
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
          <button class="music-more__btn" type="button" data-music-more>Ko'proq ko'rish (${list.length - MUSIC_PAGE_SIZE})</button>
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
        <button class="music-artist-detail__back" type="button" data-allsongs-back aria-label="Orqaga">
          <span class="ms-icon ms-icon--lg" aria-hidden="true">chevron_left</span>
        </button>
        <h1 class="music-artist-detail__name">Hamma musiqalar</h1>
      </header>
      <div class="music-filters">
        <div class="music-filter-label">Kategoriya</div>
        <div class="music-card-row" id="allSongsCategoryRow"></div>
      </div>
      <ol class="music-list" id="allSongsList"></ol>
      <div class="music-view__spacer"></div>
    `;
    musicView.appendChild(panel);
    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-allsongs-back]")) { closeAllSongs(); return; }
      const catBtn = event.target.closest("[data-music-cat]");
      if (catBtn) {
        musicCategory = catBtn.dataset.musicCat;
        renderAllSongs();
        return;
      }
      const addBtn = event.target.closest("[data-music-add]");
      if (addBtn) {
        toggleMusicPlaylist(addBtn.dataset.musicAdd);
        renderAllSongs();
        return;
      }
      const row = event.target.closest("[data-music-row]");
      if (row) {
        const track = musicAllTracks.find((t) => t.youtubeId === row.dataset.musicRow);
        if (track) playMusicTrack(track);
      }
    });
    return panel;
  }

  function renderAllSongs() {
    ensureAllSongsDom();
    const catRow = document.getElementById("allSongsCategoryRow");
    if (catRow) {
      const cats = shuffleMusicCats(uniqSorted(musicAllTracks.flatMap(trackCategories)));
      catRow.innerHTML = [
        musicChipHtml({ active: musicCategory === "all", dataAttr: "data-music-cat", value: "all", label: "Hammasi", icon: musicCategoryIcon("all") }),
      ].concat(cats.map((c) => musicChipHtml({
        active: musicCategory === c, dataAttr: "data-music-cat", value: c, label: c, icon: musicCategoryIcon(c),
      }))).join("");
    }
    const listEl = document.getElementById("allSongsList");
    if (listEl) {
      const playlist = readMusicPlaylist();
      const list = shuffleTracks(filteredMusicTracks());
      listEl.innerHTML = list.length
        ? list.map((t) => musicRowHtml(t, playlist)).join("")
        : `<li class="music-state music-state--empty"><span>Hech narsa topilmadi</span></li>`;
    }
  }

  function scrollMusicTop() {
    try { document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
    try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (_) {}
  }

  function openAllSongs() {
    const panel = ensureAllSongsDom();
    if (!panel) return;
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
        <button class="music-artist-detail__back" type="button" data-allartists-back aria-label="Orqaga">
          <span class="ms-icon ms-icon--lg" aria-hidden="true">chevron_left</span>
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
    const panel = ensureAllArtistsDom();
    if (!panel) return;
    renderAllArtists();
    document.body.classList.add("is-music-all-artists");
    panel.hidden = false;
    scrollMusicTop();
    tgBackRegister("music-all-artists", () => { try { closeAllArtists(); } catch (_) {} });
  }

  function closeAllArtists() {
    const panel = document.getElementById("musicAllArtists");
    if (panel) panel.hidden = true;
    document.body.classList.remove("is-music-all-artists");
    tgBackUnregister("music-all-artists");
  }

  // ----- Musiqa beta eslatma modali -----
  function ensureMusicBetaModal() {
    let el = document.getElementById("musicBetaModal");
    if (el) return el;
    el = document.createElement("div");
    el.id = "musicBetaModal";
    el.className = "music-beta-modal";
    el.hidden = true;
    el.innerHTML = `
      <div class="music-beta-modal__backdrop" data-music-beta-close></div>
      <div class="music-beta-modal__card" role="dialog" aria-modal="true">
        <div class="music-beta-modal__icon" aria-hidden="true">
          <span class="ms-icon ms-icon--lg" aria-hidden="true">help_outline</span>
        </div>
        <p class="music-beta-modal__text">Hozirda musiqa bo'limi beta versiyada ishlamoqda. Yaqin vaqtlarda yanada ko'proq sizga yoqadigan qo'shiqlar qo'shiladi.</p>
        <button class="music-beta-modal__btn" type="button" data-music-beta-close>Tushunarli</button>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-music-beta-close]")) el.hidden = true;
    });
    return el;
  }
  function openMusicBetaModal() {
    ensureMusicBetaModal().hidden = false;
  }
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-music-beta-info]")) {
      event.preventDefault();
      openMusicBetaModal();
    }
  });

  const MUSIC_PLAYLIST_KEY = "kino_music_playlist_v1";
  function readMusicPlaylist() {
    try { return JSON.parse(localStorage.getItem(MUSIC_PLAYLIST_KEY) || "[]"); } catch { return []; }
  }
  function writeMusicPlaylist(ids) {
    try { localStorage.setItem(MUSIC_PLAYLIST_KEY, JSON.stringify(ids)); } catch {}
  }
  function toggleMusicPlaylist(id) {
    const list = readMusicPlaylist();
    const idx = list.indexOf(id);
    const wasInList = idx >= 0;
    if (wasInList) list.splice(idx, 1); else list.push(id);
    writeMusicPlaylist(list);
    return !wasInList;
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
    return Array.from(counts.entries())
      .filter(([, n]) => n >= 4)
      .map(([a]) => a);
  }

  function pickArtistFallbackImage(name) {
    const target = name.toLowerCase();
    const track = musicAllTracks.find((t) => splitArtists(t.artist).some((a) => a.toLowerCase() === target));
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
        <button class="music-artist-detail__back" type="button" data-artist-detail-back aria-label="Orqaga">
          <span class="ms-icon ms-icon--lg" aria-hidden="true">chevron_left</span>
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
        if (track) playMusicTrack(track);
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
              <span class="music-row__title">${escapeMusicHtml(t.title)}</span>
              <span class="music-row__sub">${escapeMusicHtml(t.artist)}</span>
            </span>
          </button>
          <div class="music-row__actions">
            <button class="music-row__btn music-row__btn--add ${inPl ? "is-added" : ""}" type="button" data-music-add="${id}" aria-label="Playlistga qo'shish">
              <span class="ms-icon" aria-hidden="true">add</span>
            </button>
            <button class="music-row__btn music-row__btn--play" type="button" data-music-row="${id}" aria-label="Play">
              <span class="ms-icon ms-icon--fill" aria-hidden="true">play_arrow</span>
            </button>
          </div>
        </div>
      </li>`;
    }).join("");
  }

  let artistDetailOrigin = null;
  function openArtistDetail(name) {
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
    if (allArtists && !allArtists.hidden) artistDetailOrigin = "all-artists";
    else if (allSongs && !allSongs.hidden) artistDetailOrigin = "all-songs";
    else artistDetailOrigin = null;
    if (allArtists) allArtists.hidden = true;
    if (allSongs) allSongs.hidden = true;
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
    if (artistDetailOrigin === "all-artists") {
      const allArtists = document.getElementById("musicAllArtists");
      if (allArtists) { allArtists.hidden = false; document.body.classList.add("is-music-all-artists"); }
    } else if (artistDetailOrigin === "all-songs") {
      const allSongs = document.getElementById("musicAllSongs");
      if (allSongs) { allSongs.hidden = false; document.body.classList.add("is-music-all-songs"); }
    }
    artistDetailOrigin = null;
    tgBackUnregister("music-artist-detail");
  }

  function openMusicView() {
    if (!musicView) return;
    reshuffleMusic();
    if (!musicAllTracks.length) {
      loadMusicCatalog();
    } else {
      renderMusicCarousel();
      renderMusicFilters();
      renderMusicList();
    }
    fetchMusicArtists().then(() => { renderMusicFilters(); renderMusicCarousel(); });
    try { ensureYouTubeApi?.(); } catch (_) {}
    musicView.hidden = false;
    document.body.classList.add("is-music");
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelectorAll(".bottom-bar [data-action='categories']").forEach((b) => b.classList.add("is-active"));
    document.querySelectorAll(".bottom-bar [data-filter='all']").forEach((b) => b.classList.remove("is-active"));
    tgBackRegister("music-view", () => { try { closeMusicView(); setFilter("all"); } catch (_) {} });
  }

  function closeMusicView() {
    if (!musicView) return;
    musicView.hidden = true;
    document.body.classList.remove("is-music");
    closeArtistDetail();
    closeAllSongs();
    closeAllArtists();
    stopMusicCarouselTimer();
    closeMusicFullPlayer();
    tgBackUnregister("music-view");
  }

  // ----- YouTube IFrame Player -----
  let ytPlayer = null;
  let ytReady = false;
  let ytPendingId = null;
  let ytProgressTimer = null;

  function initYtPlayerForMusic() {
    if (ytPlayer) return;
    if (!window.YT?.Player) return;
    try {
      ytPlayer = new YT.Player("ytPlayer", {
        height: "100%", width: "100%",
        playerVars: { playsinline: 1, controls: 0, autoplay: 0, modestbranding: 1, rel: 0, iv_load_policy: 3 },
        events: {
          onReady: () => {
            ytReady = true;
            if (ytPendingId) {
              try {
                ytPlayer.loadVideoById(ytPendingId);
                ytPlayer.playVideo?.();
              } catch (_) {}
              ytPendingId = null;
            }
          },
          onStateChange: (e) => {
            if (!window.YT) return;
            const S = YT.PlayerState;
            const state = (e.data === S.PLAYING) ? "pause" : ((e.data === S.PAUSED || e.data === S.ENDED) ? "play" : null);
            if (state) {
              if (miniPlayerToggle) miniPlayerToggle.dataset.state = state;
              if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = state;
            }
            if (e.data === S.ENDED) { try { autoAdvance(); } catch (_) {} }
          },
          onError: (e) => {
            console.warn("YT player error", e?.data);
            if (musicErrorText) musicErrorText.textContent = "Bu trekni o'ynatib bo'lmadi (embed cheklangan). Boshqasini tanlang.";
          },
        },
      });
    } catch (_) {}
  }

  // YouTube IFrame API ready callback'ni zanjir bilan o'rnatamiz, video player bilan to'qnashmaslik uchun.
  (function chainYouTubeReadyCallback() {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      try { prev?.(); } catch (_) {}
      initYtPlayerForMusic();
    };
    if (window.YT?.Player) initYtPlayerForMusic();
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
      if (!ytReady || !ytPlayer?.getCurrentTime) return;
      try {
        const cur = ytPlayer.getCurrentTime() || 0;
        const dur = ytPlayer.getDuration() || 0;
        if (miniPlayerTime) miniPlayerTime.textContent = formatMusicTime(cur);
        if (miniPlayerBarFill && dur > 0) miniPlayerBarFill.style.width = `${Math.min(100, (cur / dur) * 100)}%`;
        if (musicFullPlayerCur) musicFullPlayerCur.textContent = formatMusicTime(cur);
        if (musicFullPlayerDur && dur > 0) musicFullPlayerDur.textContent = `-${formatMusicTime(Math.max(0, dur - cur))}`;
        if (musicFullPlayerBarFill && dur > 0) {
          const pct = Math.min(100, (cur / dur) * 100);
          musicFullPlayerBarFill.style.width = `${pct}%`;
          if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = `${pct}%`;
        }
      } catch (_) {}
    }, 500);
  }

  function playMusicTrack(track) {
    if (!track) return;
    musicCurrentTrackKey = trackKey(track);
    try { recordMusicListen?.(track); } catch (_) {}
    if (miniPlayerTitle) miniPlayerTitle.textContent = track.title;
    if (miniPlayerArtistEl) miniPlayerArtistEl.textContent = track.artist;
    const miniArt = document.getElementById("miniPlayerArt");
    if (miniArt) miniArt.src = `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
    if (miniPlayerBarFill) miniPlayerBarFill.style.width = "0%";
    if (miniPlayerTime) miniPlayerTime.textContent = "0:00";
    showMiniPlayer();
    openMusicFullPlayer(track);
    if (ytReady && ytPlayer?.loadVideoById) {
      try {
        ytPlayer.loadVideoById(track.youtubeId);
        if (ytPlayer.playVideo) ytPlayer.playVideo();
      } catch (_) {}
    } else {
      ytPendingId = track.youtubeId;
      try { ensureYouTubeApi?.().then(() => initYtPlayerForMusic()); } catch (_) {}
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
    try { if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo(); } catch (_) {}
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
      if (track) playMusicTrack(track);
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
  const musicFullPlayerShuffle = document.getElementById("musicFullPlayerShuffle");
  const musicFullPlayerRepeat = document.getElementById("musicFullPlayerRepeat");
  const musicFullPlayerLike = document.getElementById("musicFullPlayerLike");
  const miniPlayerYtHost = document.getElementById("miniPlayerYt");

  let musicShuffle = false;
  let musicRepeat = "off";

  function moveYtIntoFullPlayer() {
    musicFullPlayerArt?.classList.add("has-video");
  }
  function moveYtBackToMini() {
    // no-op
  }

  function openMusicFullPlayer(track) {
    if (!musicFullPlayer || !track) return;
    document.body.classList.add("fullplayer-open");
    if (musicFullPlayerArtFallback) musicFullPlayerArtFallback.style.backgroundImage = `url('https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg')`;
    if (musicFullPlayerAlbum) musicFullPlayerAlbum.textContent = (track.category && track.category !== "all") ? track.category : "Music";
    if (musicFullPlayerTitle) musicFullPlayerTitle.textContent = track.title;
    if (musicFullPlayerArtist) musicFullPlayerArtist.textContent = track.artist;
    if (musicFullPlayerBarFill) musicFullPlayerBarFill.style.width = "0%";
    if (musicFullPlayerBarThumb) musicFullPlayerBarThumb.style.left = "0%";
    if (musicFullPlayerCur) musicFullPlayerCur.textContent = "0:00";
    if (musicFullPlayerDur) musicFullPlayerDur.textContent = "0:00";
    if (musicFullPlayerToggle) musicFullPlayerToggle.dataset.state = "pause";
    if (musicFullPlayerLike) {
      const inPl = readMusicPlaylist().includes(track.youtubeId);
      musicFullPlayerLike.setAttribute("aria-pressed", inPl ? "true" : "false");
      musicFullPlayerLike.dataset.id = track.youtubeId;
    }
    musicFullPlayer.hidden = false;
    requestAnimationFrame(() => musicFullPlayer.setAttribute("aria-hidden", "false"));
    moveYtIntoFullPlayer();
    tgBackRegister("music-fullplayer", () => { try { closeMusicFullPlayer(); } catch (_) {} });
  }

  function closeMusicFullPlayer() {
    if (!musicFullPlayer) return;
    musicFullPlayer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("fullplayer-open");
    tgBackUnregister("music-fullplayer");
  }

  function currentTrackIndex() {
    const list = shuffleTracks(filteredMusicTracks());
    return list.findIndex((t) => trackKey(t) === musicCurrentTrackKey);
  }
  function playRelative(offset) {
    const list = shuffleTracks(filteredMusicTracks());
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
      try { ytPlayer?.seekTo?.(0, true); ytPlayer?.playVideo?.(); } catch (_) {}
      return;
    }
    const list = shuffleTracks(filteredMusicTracks());
    if (!list.length) return;
    const cur = currentTrackIndex();
    if (musicRepeat === "off" && !musicShuffle && cur >= list.length - 1) return;
    playRelative(1);
  }

  musicFullPlayer?.addEventListener("click", (e) => {
    if (e.target.closest("[data-music-fp-close]")) { closeMusicFullPlayer(); return; }
    if (e.target.closest("[data-music-fp-toggle]")) {
      if (!ytReady || !ytPlayer) return;
      try {
        const s = ytPlayer.getPlayerState();
        if (s === YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
      } catch (_) {}
      return;
    }
    if (e.target.closest("[data-music-fp-prev]")) { playRelative(-1); return; }
    if (e.target.closest("[data-music-fp-next]")) { playRelative(1); return; }
    if (e.target.closest("[data-music-fp-shuffle]")) {
      musicShuffle = !musicShuffle;
      if (musicFullPlayerShuffle) musicFullPlayerShuffle.setAttribute("aria-pressed", musicShuffle ? "true" : "false");
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
      if (id) {
        toggleMusicPlaylist(id);
        const inPl = readMusicPlaylist().includes(id);
        musicFullPlayerLike.setAttribute("aria-pressed", inPl ? "true" : "false");
        renderMusicList();
      }
      return;
    }
  });

  musicFullPlayerBar?.addEventListener("click", (e) => {
    if (!ytReady || !ytPlayer?.getDuration) return;
    try {
      const rect = musicFullPlayerBar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur = ytPlayer.getDuration() || 0;
      if (dur > 0) ytPlayer.seekTo(dur * pct, true);
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
    if (track) playMusicTrack(track);
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
      toggleMusicPlaylist(addBtn.dataset.musicAdd);
      renderMusicList();
    }
  });

  miniPlayerToggle?.addEventListener("click", () => {
    if (!ytReady || !ytPlayer) return;
    try {
      const state = ytPlayer.getPlayerState();
      if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
      else ytPlayer.playVideo();
    } catch (_) {}
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
    playMusicTrack,
    renderMusicList,
    scrollMusicTop,
    setQuery(q) { musicQuery = String(q || ""); renderMusicList(); },
    findTrackById(id) { return musicAllTracks.find((t) => t.youtubeId === id) || null; },
    hideMiniPlayer,
  };
})();
