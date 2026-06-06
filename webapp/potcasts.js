// Potkastlar moduli — real YouTube kanallar.
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView }
(function () {
  "use strict";

  const podcastsView = document.getElementById("podcastsView");
  const podcastsRoot = document.getElementById("podcastsRoot");

  // ===== i18n =====
  const I18N = {
    uz: {
      headerTitle: "Potkastlar",
      catTitle: "Kategoriyalar",
      savedTitle: "Saqlangan",
      back: "Orqaga",
      saveBtn: "Saqlash",
      removeBtn: "O'chirish",
      savedToast: "Saqlandi",
      unsavedToast: "Saqlanganlardan o'chirildi",
      tabHome: "Asosiy",
      tabVideos: "Videolar",
      tabShorts: "Shorts",
      tabPlaylists: "Playlistlar",
      sectionLatest: "So'nggi yuklangan",
      sectionShorts: "Shorts",
      sectionVideos: "Videolar",
      sectionPlaylists: "Playlistlar",
      sectionChannels: "Kanallar",
      emptyNothingTitle: "Hech narsa topilmadi",
      emptyNothingHint: "Boshqa so'z bilan qidirib ko'ring",
      emptyNoPodcastsTitle: "Hali potkast qo'shilmagan",
      emptyNoPodcastsHint: "Admin paneldan YouTube potkast qo'shing",
      emptyNoVideos: "Bu so'rov bo'yicha video topilmadi",
      emptyNoLangPodcasts: "Bu tilda potkast yo'q",
      emptyChooseOther: "Boshqa kategoriyani tanlang",
      emptySavedTitle: "Saqlangan video yo'q",
      emptySavedHint: "Videoning o'ng burchagidagi bookmark tugmasini bosing",
      emptyContent: "Kontent topilmadi",
      noVideos: "Videolar yo'q",
      noShorts: "Shortslar yo'q",
      noPlaylists: "Playlistlar yo'q",
      loading: "Yuklanmoqda...",
      loadingPodcast: "Potkast yuklanmoqda...",
      playerNotReady: "Pleyer hali yuklanmadi — qaytadan urinib ko'ring.",
      playlistSoon: "Playlist tez orada qo'shiladi",
      more: "Batafsil",
      hide: "Yashirish",
      errorTitle: "Xato",
      prefetching: (a, b) => `Videolar yuklanmoqda… (${a}/${b})`,
      unitPodcasts: "potkast",
      unitVideo: "video",
      unitSubs: "obunachi",
      unitViews: "ko'rishlar",
      today: "Bugun",
      yesterday: "Kecha",
      daysAgo: (n) => `${n} kun oldin`,
      weeksAgo: (n) => `${n} hafta oldin`,
      monthsAgo: (n) => `${n} oy oldin`,
      yearsAgo: (n) => `${n} yil oldin`,
      unknownVideo: "Noma'lum video",
      langUz: "O'zbekcha",
      langRu: "Ruscha",
      langEn: "Inglizcha",
      shareSubs: "obunachi",
      shareVideo: "video",
    },
    ru: {
      headerTitle: "Подкасты",
      catTitle: "Категории",
      savedTitle: "Сохранённые",
      back: "Назад",
      saveBtn: "Сохранить",
      removeBtn: "Удалить",
      savedToast: "Сохранено",
      unsavedToast: "Удалено из сохранённых",
      tabHome: "Главная",
      tabVideos: "Видео",
      tabShorts: "Shorts",
      tabPlaylists: "Плейлисты",
      sectionLatest: "Последнее",
      sectionShorts: "Shorts",
      sectionVideos: "Видео",
      sectionPlaylists: "Плейлисты",
      sectionChannels: "Каналы",
      emptyNothingTitle: "Ничего не найдено",
      emptyNothingHint: "Попробуйте другой запрос",
      emptyNoPodcastsTitle: "Подкастов пока нет",
      emptyNoPodcastsHint: "Добавьте YouTube-подкаст в админ-панели",
      emptyNoVideos: "По этому запросу видео не найдено",
      emptyNoLangPodcasts: "На этом языке подкастов нет",
      emptyChooseOther: "Выберите другую категорию",
      emptySavedTitle: "Нет сохранённых видео",
      emptySavedHint: "Нажмите на закладку в углу видео, чтобы сохранить",
      emptyContent: "Контент не найден",
      noVideos: "Нет видео",
      noShorts: "Нет Shorts",
      noPlaylists: "Нет плейлистов",
      loading: "Загрузка...",
      loadingPodcast: "Загружается подкаст...",
      playerNotReady: "Плеер ещё не загрузился — попробуйте ещё раз.",
      playlistSoon: "Плейлисты скоро появятся",
      more: "Подробнее",
      hide: "Скрыть",
      errorTitle: "Ошибка",
      prefetching: (a, b) => `Видео загружаются… (${a}/${b})`,
      unitPodcasts: "подкаст",
      unitVideo: "видео",
      unitSubs: "подписчиков",
      unitViews: "просмотров",
      today: "Сегодня",
      yesterday: "Вчера",
      daysAgo: (n) => `${n} дн. назад`,
      weeksAgo: (n) => `${n} нед. назад`,
      monthsAgo: (n) => `${n} мес. назад`,
      yearsAgo: (n) => `${n} г. назад`,
      unknownVideo: "Неизвестное видео",
      langUz: "Узбекский",
      langRu: "Русский",
      langEn: "Английский",
      shareSubs: "подписчиков",
      shareVideo: "видео",
    },
    en: {
      headerTitle: "Podcasts",
      catTitle: "Categories",
      savedTitle: "Saved",
      back: "Back",
      saveBtn: "Save",
      removeBtn: "Remove",
      savedToast: "Saved",
      unsavedToast: "Removed from saved",
      tabHome: "Home",
      tabVideos: "Videos",
      tabShorts: "Shorts",
      tabPlaylists: "Playlists",
      sectionLatest: "Latest",
      sectionShorts: "Shorts",
      sectionVideos: "Videos",
      sectionPlaylists: "Playlists",
      sectionChannels: "Channels",
      emptyNothingTitle: "Nothing found",
      emptyNothingHint: "Try another query",
      emptyNoPodcastsTitle: "No podcasts yet",
      emptyNoPodcastsHint: "Add a YouTube podcast from admin",
      emptyNoVideos: "No videos for this query",
      emptyNoLangPodcasts: "No podcasts in this language",
      emptyChooseOther: "Pick another category",
      emptySavedTitle: "No saved videos",
      emptySavedHint: "Tap the bookmark on a video to save it",
      emptyContent: "Nothing here",
      noVideos: "No videos",
      noShorts: "No shorts",
      noPlaylists: "No playlists",
      loading: "Loading...",
      loadingPodcast: "Loading podcast...",
      playerNotReady: "Player not ready — try again.",
      playlistSoon: "Playlists coming soon",
      more: "More",
      hide: "Hide",
      errorTitle: "Error",
      prefetching: (a, b) => `Videos loading… (${a}/${b})`,
      unitPodcasts: "podcasts",
      unitVideo: "videos",
      unitSubs: "subscribers",
      unitViews: "views",
      today: "Today",
      yesterday: "Yesterday",
      daysAgo: (n) => `${n} days ago`,
      weeksAgo: (n) => `${n} weeks ago`,
      monthsAgo: (n) => `${n} months ago`,
      yearsAgo: (n) => `${n} years ago`,
      unknownVideo: "Unknown video",
      langUz: "Uzbek",
      langRu: "Russian",
      langEn: "English",
      shareSubs: "subscribers",
      shareVideo: "videos",
    },
  };
  function uiLang() {
    try {
      const l = (window.__i18n && window.__i18n.lang) || localStorage.getItem("kino_lang") || "uz";
      return I18N[l] ? l : "uz";
    } catch (_) { return "uz"; }
  }
  function T(key, ...args) {
    const tbl = I18N[uiLang()] || I18N.uz;
    const v = tbl[key];
    if (typeof v === "function") return v(...args);
    if (v != null) return v;
    return I18N.uz[key] != null ? (typeof I18N.uz[key] === "function" ? I18N.uz[key](...args) : I18N.uz[key]) : key;
  }

  const tg = window.Telegram?.WebApp;
  const haptic = (kind = "light") => {
    try { tg?.HapticFeedback?.impactOccurred?.(kind); } catch (_) {}
  };

  let channels = [];
  let loaded = false;
  let currentQuery = "";
  let currentLang = null;
  // channelId → { channel, videos, shorts, playlists, fetchedAt }
  const channelViewCache = new Map();
  let prefetchStarted = false;
  let prefetchInFlight = 0;
  let prefetchDone = 0;
  const PREFETCH_CONCURRENCY = 3;
  const SEARCH_VIDEOS_LIMIT = 60;

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  let currentView = "list"; // "list" | "channel"
  let currentChannelId = null;
  let currentChannelData = null;
  let currentTab = "home"; // "home" | "videos" | "shorts" | "playlists"
  let toastTimer = null;
  // Kop videoli kanallarda hamma kartochka birdan chizilmasligi uchun
  // batchlab ko'rsatamiz — scroll oxiriga yetganda yana qo'shiladi.
  const RENDER_BATCH = 24;
  let visibleVideos = RENDER_BATCH;
  let visibleShorts = RENDER_BATCH;
  let loadMoreObserver = null;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatCount(n) {
    const x = Number(n || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(x >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(x);
  }

  function formatDuration(sec) {
    const s = Number(sec || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return `${m}:${String(ss).padStart(2, "0")}`;
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (!t) return "";
    const diff = Math.max(0, Date.now() - t);
    const d = Math.floor(diff / 86400000);
    if (d < 1) return T("today");
    if (d < 2) return T("yesterday");
    if (d < 7) return T("daysAgo", d);
    if (d < 30) return T("weeksAgo", Math.floor(d / 7));
    if (d < 365) return T("monthsAgo", Math.floor(d / 30));
    return T("yearsAgo", Math.floor(d / 365));
  }

  function showToast(msg) {
    let el = document.getElementById("podToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "podToast";
      el.className = "pod-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1600);
  }

  // ---------- API ----------

  async function loadChannels() {
    try {
      const [r] = await Promise.all([
        fetch("/api/podcasts"),
        loadLangMeta(),
      ]);
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi.");
      channels = Array.isArray(data.channels) ? data.channels : [];
      loaded = true;
      // Asosiy sahifa qidiruvi videolarni ham topishi uchun fonda yuklab boshlaymiz.
      startPrefetchAllChannelViews();
    } catch (err) {
      console.error("podcasts loadChannels:", err);
      channels = [];
      loaded = true;
    }
  }

  async function loadChannelView(channelId) {
    const cached = channelViewCache.get(channelId);
    if (cached) return cached;
    const r = await fetch(`/api/podcasts?channelId=${encodeURIComponent(channelId)}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "Potkastni yuklab bo'lmadi.");
    channelViewCache.set(channelId, data);
    return data; // { channel, videos, shorts, playlists }
  }

  // Hamma kanallarning videolarini fonda yuklab keladi — qidiruv asosiy sahifadan
  // video sarlavhalari bo'yicha ishlasin uchun.
  function startPrefetchAllChannelViews() {
    if (prefetchStarted) return;
    prefetchStarted = true;
    prefetchDone = 0;
    const queue = channels.map((c) => c.channelId).filter(Boolean);
    let i = 0;
    const next = () => {
      while (prefetchInFlight < PREFETCH_CONCURRENCY && i < queue.length) {
        const id = queue[i++];
        if (channelViewCache.has(id)) { prefetchDone++; continue; }
        prefetchInFlight++;
        fetch(`/api/podcasts?channelId=${encodeURIComponent(id)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok) channelViewCache.set(id, data);
          })
          .catch(() => {})
          .finally(() => {
            prefetchInFlight--;
            prefetchDone++;
            // Qidiruv ochiq turgan bo'lsa, natijalarni yangilab boramiz.
            if (currentQuery && currentView === "list") {
              refreshSearchVideosSection();
            }
            next();
          });
      }
    };
    next();
  }

  // Asosiy ro'yxat ichidagi "Videolar" qidiruv natijasini qayta chizadi
  // (kanallar ro'yxatini qayta yozmaymiz — faqat shu seksiyani yangilaymiz).
  function refreshSearchVideosSection() {
    const host = podcastsRoot.querySelector("[data-pod-search-videos]");
    if (!host) return;
    host.outerHTML = buildSearchVideosSection();
    wireSearchVideosEvents();
  }

  function collectSearchVideos() {
    if (!currentQuery) return [];
    const out = [];
    for (const c of channels) {
      const view = channelViewCache.get(c.channelId);
      if (!view) continue;
      const chTitle = view.channel?.title || c.snapshot?.title || "";
      const all = [...(view.videos || []), ...(view.shorts || [])];
      for (const v of all) {
        if (matchesQuery(v.title)) {
          out.push({ ...v, channelId: c.channelId, channelTitle: chTitle });
          if (out.length >= SEARCH_VIDEOS_LIMIT * 2) break;
        }
      }
      if (out.length >= SEARCH_VIDEOS_LIMIT * 2) break;
    }
    // Eng yangi ko'rilganlar oldinga
    out.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    return out.slice(0, SEARCH_VIDEOS_LIMIT);
  }

  function buildSearchVideoCard(v) {
    const favs = getPodcastFavorites();
    const isFav = favs.has(v.videoId);
    return `
      <div class="pod-vid-card" role="button" tabindex="0" data-pod-search-play="${escapeHtml(v.channelId)}|${escapeHtml(v.videoId)}">
        <div class="pod-vid-card__thumb" style="background-image:url('${escapeHtml(v.thumb)}')">
          <span class="pod-vid-card__dur">${formatDuration(v.durationSec)}</span>
          <span class="pod-fav-btn${isFav ? " is-active" : ""}" role="button" tabindex="0" data-pod-fav="${escapeHtml(v.videoId)}" aria-label="${escapeHtml(T("saveBtn"))}" aria-pressed="${isFav}">
            ${bookmarkSvg()}
          </span>
        </div>
        <div class="pod-vid-card__title">${escapeHtml(v.title)}</div>
        <div class="pod-vid-card__meta">${escapeHtml(v.channelTitle)} · ${formatCount(v.viewCount)} ${escapeHtml(T("unitViews"))}</div>
      </div>
    `;
  }

  function buildSearchVideosSection() {
    if (!currentQuery) return `<div data-pod-search-videos hidden></div>`;
    const items = collectSearchVideos();
    const totalChannels = channels.length;
    const progress = prefetchDone < totalChannels
      ? `<div class="pod-ch-section__hint">${escapeHtml(T("prefetching", prefetchDone, totalChannels))}</div>`
      : "";
    const body = items.length
      ? `<div class="pod-vid-grid">${items.map(buildSearchVideoCard).join("")}</div>`
      : (prefetchDone < totalChannels
          ? ""
          : `<div class="pod-empty pod-empty--inline"><div class="pod-empty__title">${escapeHtml(T("emptyNoVideos"))}</div></div>`);
    return `
      <section class="pod-ch-section" data-pod-search-videos>
        <h3 class="pod-ch-section__title">${escapeHtml(T("sectionVideos"))}</h3>
        ${progress}
        ${body}
      </section>
    `;
  }

  function wireSearchVideosEvents() {
    podcastsRoot.querySelectorAll("[data-pod-search-play]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-pod-fav]")) return;
        e.preventDefault();
        haptic("light");
        const [chId, vId] = String(el.dataset.podSearchPlay || "").split("|");
        playSearchVideo(chId, vId);
      });
    });
    podcastsRoot.querySelectorAll("[data-pod-search-videos] [data-pod-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic("medium");
        const vid = btn.dataset.podFav;
        // search natijasi ichidan meta yig'amiz
        const meta = findSearchVideoMeta(vid);
        const isActive = togglePodcastFavorite(vid, meta);
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
        showToast(isActive ? T("savedToast") : T("unsavedToast"));
      });
    });
  }

  function findSearchVideoMeta(videoId) {
    for (const c of channels) {
      const view = channelViewCache.get(c.channelId);
      if (!view) continue;
      const all = [...(view.videos || []), ...(view.shorts || [])];
      const v = all.find((x) => x.videoId === videoId);
      if (v) {
        return {
          title: v.title || "",
          thumb: v.thumb || "",
          durationSec: v.durationSec || 0,
          viewCount: v.viewCount || 0,
          publishedAt: v.publishedAt || "",
          channelTitle: view.channel?.title || "",
          channelId: c.channelId,
        };
      }
    }
    return null;
  }

  function playSearchVideo(channelId, videoId) {
    const view = channelViewCache.get(channelId);
    if (view) {
      currentChannelData = view; // openPlayer/savePodcastHistory shu kontekstdan foydalanadi
    }
    if (typeof window.__playYouTubeStandalone === "function") {
      const meta = findSearchVideoMeta(videoId);
      savePodcastHistory(videoId);
      window.__playYouTubeStandalone(videoId, { title: meta?.title || "" });
      return;
    }
    showToast(T("playerNotReady"));
  }

  // ---------- Featured kanallar (header section uchun — hero style) ----------

  function buildFeaturedChannels() {
    const featured = channels.filter((c) => c.featured);
    if (!featured.length) return "";
    // Agar bitta bo'lsa — katta hero, ko'p bo'lsa — carousel
    if (featured.length === 1) {
      return buildSingleHero(featured[0]);
    }
    return buildFeaturedCarousel(featured);
  }

  function buildSingleHero(c) {
    const s = c.snapshot || {};
    const banner = s.banner || "";
    const bgStyle = banner ? `background-image:url('${escapeHtml(banner)}')` : "";
    return `
      <div class="pod-hero" data-pod-open="${escapeHtml(c.channelId)}">
        <div class="pod-hero__bg" style="${bgStyle}"></div>
        <div class="pod-hero__gradient"></div>
        <div class="pod-hero__inner">
          <h3 class="pod-hero__title">${escapeHtml(s.title || c.channelId)}</h3>
        </div>
      </div>
    `;
  }

  function buildFeaturedCarousel(list) {
    const cards = list.map((c) => {
      const s = c.snapshot || {};
      const banner = s.banner || "";
      const bgStyle = banner ? `background-image:url('${escapeHtml(banner)}')` : "";
      return `
        <div class="pod-hero-card-scroll" data-pod-open="${escapeHtml(c.channelId)}">
          <div class="pod-hero__bg" style="${bgStyle}"></div>
          <div class="pod-hero__gradient"></div>
          <div class="pod-hero__inner">
            <h3 class="pod-hero__title">${escapeHtml(s.title || c.channelId)}</h3>
          </div>
        </div>
      `;
    }).join("");
    return `
      <div class="pod-hero-scroll-track">${cards}</div>
    `;
  }

  // ---------- List view (qo'shilgan kanallar) ----------

  function matchesQuery(text) {
    if (!currentQuery) return true;
    return String(text || "").toLowerCase().includes(currentQuery);
  }

  function filterChannels(list) {
    if (!currentQuery) return list;
    return list.filter((c) => {
      const s = c.snapshot || {};
      return matchesQuery(s.title) || matchesQuery(s.description) || matchesQuery(c.channelId);
    });
  }

  function buildList() {
    const filtered = filterChannels(channels);
    const items = shuffleArray(filtered).map((c) => {
      const s = c.snapshot || {};
      const avatar = s.avatar ? `<img src="${escapeHtml(s.avatar)}" alt="" />` : `<span>${escapeHtml((s.title || "?").charAt(0))}</span>`;
      const meta = `<span class="pod-channel-row__tag pod-channel-row__tag--green">${formatCount(s.videoCount)} ${escapeHtml(T("unitVideo"))}</span><span class="pod-channel-row__tag pod-channel-row__tag--yellow">${formatCount(s.subscriberCount)} ${escapeHtml(T("unitSubs"))}</span>`;
      return `
        <button class="pod-channel-row" type="button" data-pod-open="${escapeHtml(c.channelId)}">
          <span class="pod-channel-row__glow" aria-hidden="true"></span>
          <div class="pod-channel-row__avatar">${avatar}</div>
          <div class="pod-channel-row__body">
            <div class="pod-channel-row__title">${escapeHtml(s.title || c.channelId)}</div>
            <div class="pod-channel-row__meta">${meta}</div>
          </div>
          <span class="pod-channel-row__go" aria-hidden="true">
            <svg class="pod-channel-row__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </button>
      `;
    }).join("");

    return `
      <div class="pod-list">
        ${currentQuery ? "" : buildFeaturedChannels()}
        ${currentQuery && filtered.length ? `<h3 class="pod-ch-section__title">${escapeHtml(T("sectionChannels"))}</h3>` : ""}
        ${filtered.length
          ? items
          : (channels.length
              ? (currentQuery ? "" : `<div class="pod-empty"><div class="pod-empty__icon">🔎</div><div class="pod-empty__title">${escapeHtml(T("emptyNothingTitle"))}</div><div class="pod-empty__hint">${escapeHtml(T("emptyNothingHint"))}</div></div>`)
              : `<div class="pod-empty"><div class="pod-empty__icon">🎙️</div><div class="pod-empty__title">${escapeHtml(T("emptyNoPodcastsTitle"))}</div><div class="pod-empty__hint">${escapeHtml(T("emptyNoPodcastsHint"))}</div></div>`)}
        ${currentQuery ? buildSearchVideosSection() : ""}
      </div>
    `;
  }

  // ---------- Channel view (YouTube-style) ----------

  // Podcast saqlanganlar (localStorage) — bookmark format: { [videoId]: {meta} }
  function readSavedStore() {
    try {
      const raw = localStorage.getItem("podcastFavorites");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const obj = {};
        for (const id of parsed) { if (id) obj[String(id)] = { videoId: String(id) }; }
        return obj;
      }
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) { return {}; }
  }
  function writeSavedStore(store) {
    try { localStorage.setItem("podcastFavorites", JSON.stringify(store)); } catch (_) {}
  }
  function getPodcastFavorites() {
    return new Set(Object.keys(readSavedStore()));
  }
  function getSavedPodcastVideos() {
    const store = readSavedStore();
    return Object.values(store).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }
  function togglePodcastFavorite(videoId, meta) {
    const store = readSavedStore();
    const key = String(videoId);
    if (store[key]) {
      delete store[key];
    } else {
      store[key] = { videoId: key, ...(meta || {}), savedAt: Date.now() };
    }
    writeSavedStore(store);
    return !!store[key];
  }

  function bookmarkSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
  }

  function buildVideoCard(v) {
    const favs = getPodcastFavorites();
    const isFav = favs.has(v.videoId);
    return `
      <div class="pod-vid-card" role="button" tabindex="0" data-pod-play-video="${escapeHtml(v.videoId)}">
        <div class="pod-vid-card__thumb" style="background-image:url('${escapeHtml(v.thumb)}')">
          <span class="pod-vid-card__dur">${formatDuration(v.durationSec)}</span>
          <span class="pod-fav-btn${isFav ? " is-active" : ""}" role="button" tabindex="0" data-pod-fav="${escapeHtml(v.videoId)}" aria-label="${escapeHtml(T("saveBtn"))}" aria-pressed="${isFav}">
            ${bookmarkSvg()}
          </span>
        </div>
        <div class="pod-vid-card__title">${escapeHtml(v.title)}</div>
        <div class="pod-vid-card__meta">${formatCount(v.viewCount)} ${escapeHtml(T("unitViews"))} · ${escapeHtml(timeAgo(v.publishedAt))}</div>
      </div>
    `;
  }

  function buildShortCard(v) {
    const isFav = getPodcastFavorites().has(v.videoId);
    return `
      <div class="pod-short-card" role="button" tabindex="0" data-pod-play-video="${escapeHtml(v.videoId)}">
        <div class="pod-short-card__thumb" style="background-image:url('${escapeHtml(v.thumb)}')">
          <span class="pod-fav-btn${isFav ? " is-active" : ""}" role="button" tabindex="0" data-pod-fav="${escapeHtml(v.videoId)}" aria-label="${escapeHtml(T("saveBtn"))}" aria-pressed="${isFav}">
            ${bookmarkSvg()}
          </span>
        </div>
        <div class="pod-short-card__title">${escapeHtml(v.title)}</div>
        <div class="pod-short-card__meta">${formatCount(v.viewCount)} ${escapeHtml(T("unitViews"))}</div>
      </div>
    `;
  }

  function buildPlaylistCard(p) {
    return `
      <a class="pod-pl-card" href="https://www.youtube.com/playlist?list=${escapeHtml(p.playlistId)}" target="_blank" rel="noopener" data-pod-pl="${escapeHtml(p.playlistId)}">
        <div class="pod-pl-card__thumb" style="background-image:url('${escapeHtml(p.thumb)}')">
          <span class="pod-pl-card__count">${p.itemCount} ${escapeHtml(T("unitVideo"))}</span>
        </div>
        <div class="pod-pl-card__title">${escapeHtml(p.title)}</div>
      </a>
    `;
  }

  function buildTabContent(data) {
    let { videos = [], shorts = [], playlists = [] } = data;
    if (currentQuery) {
      videos = videos.filter((v) => matchesQuery(v.title));
      shorts = shorts.filter((v) => matchesQuery(v.title));
      playlists = playlists.filter((p) => matchesQuery(p.title));
    }
    if (currentTab === "home") {
      const latest = videos.slice(0, 1);
      const recent = videos.slice(1, 9);
      const shortsRow = shorts.slice(0, 10);
      return `
        ${latest.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">${escapeHtml(T("sectionLatest"))}</h3>
            <div class="pod-vid-grid pod-vid-grid--featured">
              ${buildVideoCard(latest[0])}
            </div>
          </section>` : ""}
        ${shortsRow.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">${escapeHtml(T("sectionShorts"))}</h3>
            <div class="pod-shorts-row">
              ${shortsRow.map(buildShortCard).join("")}
            </div>
          </section>` : ""}
        ${recent.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">${escapeHtml(T("sectionVideos"))}</h3>
            <div class="pod-vid-grid">
              ${recent.map(buildVideoCard).join("")}
            </div>
          </section>` : ""}
        ${playlists.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">${escapeHtml(T("sectionPlaylists"))}</h3>
            <div class="pod-pl-row">
              ${playlists.slice(0, 8).map(buildPlaylistCard).join("")}
            </div>
          </section>` : ""}
        ${(!videos.length && !shorts.length && !playlists.length) ? `<div class="pod-empty"><div class="pod-empty__title">${escapeHtml(T("emptyContent"))}</div></div>` : ""}
      `;
    }
    if (currentTab === "videos") {
      if (!videos.length) return `<div class="pod-empty"><div class="pod-empty__title">${escapeHtml(T("noVideos"))}</div></div>`;
      const shown = videos.slice(0, visibleVideos);
      const hasMore = videos.length > shown.length;
      return `<div class="pod-vid-grid" data-pod-grid="videos">${shown.map(buildVideoCard).join("")}</div>${hasMore ? `<div class="pod-load-sentinel" data-pod-load-more="videos" style="height:1px;"></div>` : ""}`;
    }
    if (currentTab === "shorts") {
      if (!shorts.length) return `<div class="pod-empty"><div class="pod-empty__title">${escapeHtml(T("noShorts"))}</div></div>`;
      const shown = shorts.slice(0, visibleShorts);
      const hasMore = shorts.length > shown.length;
      return `<div class="pod-shorts-grid" data-pod-grid="shorts">${shown.map(buildShortCard).join("")}</div>${hasMore ? `<div class="pod-load-sentinel" data-pod-load-more="shorts" style="height:1px;"></div>` : ""}`;
    }
    if (currentTab === "playlists") {
      return `<div class="pod-pl-grid">${playlists.map(buildPlaylistCard).join("") || `<div class="pod-empty"><div class="pod-empty__title">${escapeHtml(T("noPlaylists"))}</div></div>`}</div>`;
    }
    return "";
  }

  function buildChannelView(data) {
    const ch = data.channel || {};
    const banner = ch.banner ? `<div class="pod-ch-banner" style="background-image:url('${escapeHtml(ch.banner)}')"></div>` : `<div class="pod-ch-banner pod-ch-banner--fallback"></div>`;
    const tabs = [
      { id: "home", label: T("tabHome") },
      { id: "videos", label: T("tabVideos") },
      { id: "shorts", label: T("tabShorts") },
      { id: "playlists", label: T("tabPlaylists") },
    ];
    return `
      <header class="pod-topbar pod-topbar--channel">
        <button class="pod-topbar__back" type="button" data-pod-back-to-list aria-label="${escapeHtml(T("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="pod-topbar__title pod-topbar__title--ch">${escapeHtml(ch.title || "")}</div>
        <button class="pod-topbar__share" type="button" data-pod-share aria-label="Ulashish">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path>
            <polyline points="16 6 12 2 8 6"></polyline>
            <line x1="12" y1="2" x2="12" y2="15"></line>
          </svg>
        </button>
      </header>
      <div class="pod-ch">
        ${banner}
        <div class="pod-ch-head">
          <div class="pod-ch-head__row">
            <div class="pod-ch-avatar">${ch.avatar ? `<img src="${escapeHtml(ch.avatar)}" alt="" />` : ""}</div>
            <div class="pod-ch-info">
              <h1 class="pod-ch-name">${escapeHtml(ch.title || "")}</h1>
              <div class="pod-ch-meta">
                <span>${escapeHtml(ch.handle || "")}</span>
                ${ch.handle ? '<span class="pod-ch-dot">·</span>' : ""}
                <span>${formatCount(ch.subscriberCount)} ${escapeHtml(T("unitSubs"))}</span>
                <span class="pod-ch-dot">·</span>
                <span>${formatCount(ch.videoCount)} ${escapeHtml(T("unitVideo"))}</span>
              </div>
              ${ch.description ? `<div class="pod-ch-desc" data-pod-desc-toggle><span class="pod-ch-desc__text">${escapeHtml(ch.description.slice(0, 160))}</span>${ch.description.length > 160 ? `<span class="pod-ch-desc__dots">…</span><span class="pod-ch-desc__full" hidden>${escapeHtml(ch.description.slice(160))}</span><span class="pod-ch-desc__btn">${escapeHtml(T("more"))}</span>` : ""}</div>` : ""}
            </div>
          </div>
        </div>
        <nav class="pod-ch-tabs">
          ${tabs.map((t) => `<button type="button" class="pod-ch-tab ${t.id === currentTab ? "is-active" : ""}" data-pod-ch-tab="${t.id}">${t.label}</button>`).join("")}
        </nav>
        <div class="pod-ch-content" id="podChContent">
          ${buildTabContent(data)}
        </div>
      </div>
    `;
  }

  // ---------- Video pleyer — kino bo'limidagi custom pleyer (iOS/Android/PC mos) ----------
  // YouTube'ning o'z UI'si o'rniga kino bo'limining unified pleyer. Tashqi YouTube'ga chiqmaydi.

  function findVideoTitle(videoId) {
    if (!currentChannelData) return "";
    const all = [...(currentChannelData.videos || []), ...(currentChannelData.shorts || [])];
    return all.find((v) => v.videoId === videoId)?.title || "";
  }

  function findVideoMeta(videoId) {
    if (!currentChannelData) return null;
    const all = [...(currentChannelData.videos || []), ...(currentChannelData.shorts || [])];
    const video = all.find((v) => v.videoId === videoId);
    if (!video) return null;
    const ch = currentChannelData.channel || {};
    return {
      title: video.title || "",
      thumb: video.thumb || "",
      durationSec: video.durationSec || 0,
      viewCount: video.viewCount || 0,
      publishedAt: video.publishedAt || "",
      channelTitle: ch.title || "",
      channelId: ch.channelId || "",
    };
  }

  function openPlayer(videoId) {
    // Tomosha tarixiga saqlash
    savePodcastHistory(videoId);
    if (typeof window.__playYouTubeStandalone === "function") {
      window.__playYouTubeStandalone(videoId, { title: findVideoTitle(videoId) });
      return;
    }
    showToast("Pleyer hali yuklanmadi — qaytadan urinib ko'ring.");
  }

  function savePodcastHistory(videoId) {
    if (!currentChannelData) return;
    const all = [...(currentChannelData.videos || []), ...(currentChannelData.shorts || [])];
    const video = all.find((v) => v.videoId === videoId);
    if (!video) return;
    const ch = currentChannelData.channel || {};
    let history = [];
    try { history = JSON.parse(localStorage.getItem("podcastHistory") || "[]"); } catch (_) {}
    // O'chirish (dublikat)
    history = history.filter((h) => h.videoId !== videoId);
    // Boshiga qo'shish
    history.unshift({
      videoId,
      title: video.title || "",
      thumb: video.thumb || "",
      durationSec: video.durationSec || 0,
      channelTitle: ch.title || "",
      channelId: ch.channelId || "",
      watchedAt: new Date().toISOString(),
    });
    // Maksimal 50 ta
    if (history.length > 50) history = history.slice(0, 50);
    try { localStorage.setItem("podcastHistory", JSON.stringify(history)); } catch (_) {}
  }

  function closePlayer() {
    // Kino pleyer o'zining yopish mexanizmi bilan ishlaydi (TG back, X tugma).
  }

  // ---------- Rendering & events ----------

  function renderList() {
    currentView = "list";
    currentChannelId = null;
    currentChannelData = null;
    podcastsRoot.innerHTML = buildList();
    wireListEvents();
  }

  async function renderChannel(channelId) {
    currentView = "channel";
    currentChannelId = channelId;
    currentTab = "home";
    visibleVideos = RENDER_BATCH;
    visibleShorts = RENDER_BATCH;
    if (loadMoreObserver) { try { loadMoreObserver.disconnect(); } catch (_) {} loadMoreObserver = null; }
    podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>${escapeHtml(T("loadingPodcast"))}</div></div>`;
    try {
      const data = await loadChannelView(channelId);
      currentChannelData = data;
      podcastsRoot.innerHTML = buildChannelView(data);
      wireChannelEvents();
    } catch (err) {
      podcastsRoot.innerHTML = `<div class="pod-empty"><div class="pod-empty__title">${escapeHtml(T("errorTitle"))}</div><div class="pod-empty__hint">${escapeHtml(err.message)}</div><button class="pod-ch-sub" type="button" data-pod-back-to-list style="margin-top:14px;">${escapeHtml(T("back"))}</button></div>`;
      podcastsRoot.querySelector("[data-pod-back-to-list]")?.addEventListener("click", renderList);
    }
  }

  function wireListEvents() {
    podcastsRoot.querySelector("[data-pod-close]")?.addEventListener("click", () => {
      haptic("light");
      closePodcastsView();
    });
    podcastsRoot.querySelectorAll("[data-pod-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (e.target.closest(".pod-hero__btn")) { e.preventDefault(); e.stopPropagation(); }
        haptic("light");
        renderChannel(btn.dataset.podOpen);
      });
    });
    // Search natijasidagi video kartochkalar
    wireSearchVideosEvents();
  }

  function wireChannelEvents() {
    podcastsRoot.querySelector("[data-pod-back-to-list]")?.addEventListener("click", () => {
      haptic("light");
      renderList();
    });
    podcastsRoot.querySelectorAll("[data-pod-ch-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.podChTab;
        if (tab === currentTab) return;
        currentTab = tab;
        // Yangi tab — batchni boshidan
        visibleVideos = RENDER_BATCH;
        visibleShorts = RENDER_BATCH;
        haptic("light");
        podcastsRoot.querySelectorAll("[data-pod-ch-tab]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.podChTab === tab);
        });
        const content = podcastsRoot.querySelector("#podChContent");
        if (content && currentChannelData) {
          content.innerHTML = buildTabContent(currentChannelData);
          wireContentEvents();
        }
      });
    });
    podcastsRoot.querySelector("[data-pod-desc-toggle]")?.addEventListener("click", () => {
      haptic("light");
      const el = podcastsRoot.querySelector("[data-pod-desc-toggle]");
      if (!el) return;
      const dots = el.querySelector(".pod-ch-desc__dots");
      const full = el.querySelector(".pod-ch-desc__full");
      const btn = el.querySelector(".pod-ch-desc__btn");
      if (full && full.hidden) {
        full.hidden = false;
        if (dots) dots.style.display = "none";
        if (btn) btn.textContent = T("hide");
      } else if (full) {
        full.hidden = true;
        if (dots) dots.style.display = "";
        if (btn) btn.textContent = T("more");
      }
    });
    podcastsRoot.querySelector("[data-pod-share]")?.addEventListener("click", () => {
      haptic("medium");
      shareChannel();
    });
    wireContentEvents();
  }

  async function shareChannel() {
    if (!currentChannelData) return;
    const ch = currentChannelData.channel || {};
    const tg = window.Telegram?.WebApp;
    const userId = tg?.initDataUnsafe?.user?.id;
    const ver = tg?.version || "0";
    const hasShare = typeof tg?.shareMessage === "function";
    const debug = (msg) => { try { tg?.showAlert ? tg.showAlert(msg) : alert(msg); } catch (_) { alert(msg); } };
    // Yashirin link uchun: bot serverda savePreparedInlineMessage qiladi,
    // so'ng Telegram.WebApp.shareMessage(id) bilan ulashamiz.
    if (userId && hasShare) {
      try {
        const r = await fetch("/api/music?resource=podcasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "share", channelId: ch.channelId, userId: String(userId) }),
        });
        const data = await r.json().catch(() => null);
        if (data?.ok && data.preparedMessageId) {
          tg.shareMessage(data.preparedMessageId);
          return;
        }
        debug("Share xato: " + (data?.error || "noma'lum"));
      } catch (e) {
        debug("Share fetch xato: " + (e?.message || e));
      }
    } else {
      debug(`Share API yo'q: userId=${userId || "?"} hasShare=${hasShare} ver=${ver}`);
    }
    // Fallback: eski t.me/share/url (yashirin link ishlamaydi, lekin ishlaydi)
    const subText = formatCount(ch.subscriberCount) + " " + T("shareSubs");
    const vidText = formatCount(ch.videoCount) + " " + T("shareVideo");
    const avatar = ch.avatar || "";
    const link = `https://t.me/mykinoplay_bot?startapp=pod_${encodeURIComponent(ch.channelId || "")}`;
    let text = `Potkast nomi: ${ch.title || ""}\n\n`;
    text += `👥 ${subText}\n`;
    text += `🎬 ${vidText}\n\n`;
    text += `▶️ Potkastni ko'rish: ${link}`;
    const shareUrl = avatar
      ? `https://t.me/share/url?url=${encodeURIComponent(avatar)}&text=${encodeURIComponent(text)}`
      : `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    try { window.open(shareUrl, "_blank"); } catch (_) {
      try { tg?.openTelegramLink(shareUrl); } catch (_) {}
    }
  }

  function wireContentEvents() {
    podcastsRoot.querySelectorAll("[data-pod-play-video]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-pod-fav]")) return;
        e.preventDefault();
        haptic("light");
        openPlayer(el.dataset.podPlayVideo);
      });
    });
    // Saqlash tugmasi (bookmark)
    podcastsRoot.querySelectorAll("[data-pod-fav]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic("medium");
        const vid = btn.dataset.podFav;
        const meta = findVideoMeta(vid);
        const isActive = togglePodcastFavorite(vid, meta);
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-pressed", String(isActive));
        showToast(isActive ? T("savedToast") : T("unsavedToast"));
      });
    });
    // Playlist link'lari — YouTube'ga o'tmasin, in-app pleyer ochsin (birinchi videoni)
    podcastsRoot.querySelectorAll("[data-pod-pl]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        haptic("light");
        showToast(T("playlistSoon"));
      });
    });
    // Scroll oxiriga yetganda yana RENDER_BATCH ta video qo'shamiz
    setupLoadMoreObserver();
  }

  function setupLoadMoreObserver() {
    if (loadMoreObserver) { try { loadMoreObserver.disconnect(); } catch (_) {} loadMoreObserver = null; }
    const sentinel = podcastsRoot.querySelector("[data-pod-load-more]");
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const scrollRoot = document.getElementById("appShell") || null;
    let busy = false;
    loadMoreObserver = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting || busy) continue;
        busy = true;
        try { loadMoreObserver.disconnect(); } catch (_) {}
        loadMoreObserver = null;
        appendMore(en.target.dataset.podLoadMore);
        // Yangi batch chizilgach yangi sentinel uchun observer qaytadan o'rnatamiz
        setupLoadMoreObserver();
        break;
      }
    }, { root: scrollRoot, rootMargin: "300px 0px", threshold: 0 });
    loadMoreObserver.observe(sentinel);
  }

  // Mavjud grid'ga yana RENDER_BATCH ta kartochka qo'shadi (innerHTML qayta yozilmaydi).
  function appendMore(which) {
    if (!currentChannelData) return;
    const grid = podcastsRoot.querySelector(`[data-pod-grid="${which}"]`);
    const sentinel = podcastsRoot.querySelector(`[data-pod-load-more="${which}"]`);
    if (!grid) return;
    let list, start, end, builder;
    if (which === "videos") {
      list = currentChannelData.videos || [];
      start = visibleVideos;
      end = Math.min(list.length, start + RENDER_BATCH);
      visibleVideos = end;
      builder = buildVideoCard;
    } else if (which === "shorts") {
      list = currentChannelData.shorts || [];
      start = visibleShorts;
      end = Math.min(list.length, start + RENDER_BATCH);
      visibleShorts = end;
      builder = buildShortCard;
    } else {
      return;
    }
    if (start >= end) { if (sentinel) sentinel.remove(); return; }
    const html = list.slice(start, end).map(builder).join("");
    grid.insertAdjacentHTML("beforeend", html);
    // Yangi kartochkalardagi event'larni ulash (faqat oxirgi qo'shilganlar)
    const newCards = Array.from(grid.children).slice(start);
    newCards.forEach((card) => {
      const vid = card.dataset.podPlayVideo;
      if (vid) {
        card.addEventListener("click", (e) => {
          if (e.target.closest("[data-pod-fav]")) return;
          e.preventDefault();
          haptic("light");
          openPlayer(vid);
        });
      }
      const favBtn = card.querySelector("[data-pod-fav]");
      if (favBtn) {
        favBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          haptic("medium");
          const fv = favBtn.dataset.podFav;
          const meta = findVideoMeta(fv);
          const isActive = togglePodcastFavorite(fv, meta);
          favBtn.classList.toggle("is-active", isActive);
          favBtn.setAttribute("aria-pressed", String(isActive));
          showToast(isActive ? T("savedToast") : T("unsavedToast"));
        });
      }
    });
    if (end >= list.length && sentinel) sentinel.remove();
  }

  // ---------- Public API ----------

  async function openPodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    if (!loaded) {
      podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>${escapeHtml(T("loading"))}</div></div>`;
      await loadChannels();
    } else {
      startPrefetchAllChannelViews();
    }
    renderList();
  }

  function closePodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = true;
    document.body.classList.remove("is-podcasts");
    closePlayer();
  }

  // ---------- Saqlangan videolar view ----------

  function buildSavedCard(v) {
    return `
      <div class="pod-vid-card" role="button" tabindex="0" data-pod-play-saved="${escapeHtml(v.videoId)}">
        <div class="pod-vid-card__thumb" style="background-image:url('${escapeHtml(v.thumb || "")}')">
          ${v.durationSec ? `<span class="pod-vid-card__dur">${formatDuration(v.durationSec)}</span>` : ""}
          <span class="pod-fav-btn is-active" role="button" tabindex="0" data-pod-saved-remove="${escapeHtml(v.videoId)}" aria-label="${escapeHtml(T("removeBtn"))}" aria-pressed="true">
            ${bookmarkSvg()}
          </span>
        </div>
        <div class="pod-vid-card__title">${escapeHtml(v.title || T("unknownVideo"))}</div>
        <div class="pod-vid-card__meta">${escapeHtml(v.channelTitle || "")}</div>
      </div>
    `;
  }

  function renderSavedView() {
    if (!podcastsView) return;
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    currentView = "saved";
    currentChannelId = null;
    currentChannelData = null;
    const savedAll = getSavedPodcastVideos();
    const saved = currentQuery ? savedAll.filter((v) => matchesQuery(v.title) || matchesQuery(v.channelTitle)) : savedAll;
    const body = saved.length
      ? `<div class="pod-vid-grid">${saved.map(buildSavedCard).join("")}</div>`
      : `<div class="pod-empty"><div class="pod-empty__icon">🔖</div><div class="pod-empty__title">${escapeHtml(T("emptySavedTitle"))}</div><div class="pod-empty__hint">${escapeHtml(T("emptySavedHint"))}</div></div>`;
    podcastsRoot.innerHTML = `
      <header class="pod-topbar">
        <div class="pod-topbar__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>${escapeHtml(T("savedTitle"))}</span>
        </div>
      </header>
      <div class="pod-list">${body}</div>
    `;
    wireSavedEvents();
  }

  function wireSavedEvents() {
    podcastsRoot.querySelectorAll("[data-pod-play-saved]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-pod-saved-remove]")) return;
        e.preventDefault();
        haptic("light");
        const vid = el.dataset.podPlaySaved;
        const meta = readSavedStore()[vid];
        if (typeof window.__playYouTubeStandalone === "function") {
          window.__playYouTubeStandalone(vid, { title: meta?.title || "" });
        }
      });
    });
    podcastsRoot.querySelectorAll("[data-pod-saved-remove]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        haptic("medium");
        togglePodcastFavorite(btn.dataset.podSavedRemove);
        showToast(T("unsavedToast"));
        renderSavedView();
      });
    });
  }

  function openPodcastsSavedView() {
    if (!loaded) {
      podcastsView.hidden = false;
      document.body.classList.add("is-podcasts");
      podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>${escapeHtml(T("loading"))}</div></div>`;
      loadChannels().finally(renderSavedView);
      return;
    }
    renderSavedView();
  }

  // ---------- Kategoriyalar view (Ruscha / O'zbekcha / Inglizcha) ----------

  function detectChannelLang(channel) {
    const manual = String(channel?.lang || "").toLowerCase();
    if (manual === "uz" || manual === "ru" || manual === "en") return manual;
    const snap = channel?.snapshot || {};
    const country = String(snap.country || "").toUpperCase();
    if (country === "UZ") return "uz";
    if (["RU", "KZ", "BY", "UA", "KG", "TJ"].includes(country)) return "ru";
    if (["US", "GB", "CA", "AU", "IN", "IE", "NZ", "ZA"].includes(country)) return "en";
    const text = `${snap.title || ""} ${snap.description || ""}`;
    if (/[Ѐ-ӿ]/.test(text)) return "ru";
    if (/\b(o'|sh|ch|g'|uchun|haqida|qanday|ekan|bo'l)\b/i.test(text)) return "uz";
    if (/[a-zA-Z]/.test(text) && !/[Ѐ-ӿ]/.test(text)) return "en";
    return "uz";
  }

  const LANG_DEFAULTS = {
    uz: { titleKey: "langUz", emoji: "🇺🇿" },
    ru: { titleKey: "langRu", emoji: "🇷🇺" },
    en: { titleKey: "langEn", emoji: "🇬🇧" },
  };
  let LANG_META = {
    uz: { customTitle: "", image: "", emoji: LANG_DEFAULTS.uz.emoji },
    ru: { customTitle: "", image: "", emoji: LANG_DEFAULTS.ru.emoji },
    en: { customTitle: "", image: "", emoji: LANG_DEFAULTS.en.emoji },
  };
  function langMetaTitle(code) {
    const m = LANG_META[code] || LANG_META.uz;
    // Admin paneldan custom nom berilgan bo'lsa — uni hurmat qilamiz,
    // aks holda joriy UI tilidagi nom (T) ishlatiladi.
    if (m.customTitle) return m.customTitle;
    return T(LANG_DEFAULTS[code]?.titleKey || "langUz");
  }

  async function loadLangMeta() {
    try {
      const r = await fetch("/api/categories?type=podcast-langs");
      const data = await r.json();
      const src = data && data.ok && data.langs ? data.langs : {};
      ["uz", "ru", "en"].forEach((k) => {
        const e = src[k] || {};
        LANG_META[k] = {
          customTitle: String(e.name || "").trim(),
          image: String(e.image || "").trim(),
          emoji: LANG_DEFAULTS[k].emoji,
        };
      });
    } catch (_) { /* defaults qoladi */ }
  }

  function buildCategoryCard(lang, count) {
    const meta = LANG_META[lang];
    const avatar = meta.image
      ? `<img src="${escapeHtml(meta.image)}" alt="" />`
      : `<span>${meta.emoji}</span>`;
    return `
      <button class="pod-channel-row pod-cat-row" type="button" data-pod-cat="${lang}">
        <span class="pod-channel-row__glow" aria-hidden="true"></span>
        <div class="pod-channel-row__avatar pod-cat-row__avatar">${avatar}</div>
        <div class="pod-channel-row__body">
          <div class="pod-channel-row__title">${escapeHtml(langMetaTitle(lang))}</div>
          <div class="pod-channel-row__meta">
            <span class="pod-channel-row__tag pod-channel-row__tag--green">${count} ${escapeHtml(T("unitPodcasts"))}</span>
          </div>
        </div>
        <span class="pod-channel-row__go" aria-hidden="true">
          <svg class="pod-channel-row__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </span>
      </button>
    `;
  }

  function renderCategoriesView() {
    currentView = "categories";
    currentChannelId = null;
    currentChannelData = null;
    const counts = { uz: 0, ru: 0, en: 0 };
    channels.forEach((c) => { counts[detectChannelLang(c)]++; });
    podcastsRoot.innerHTML = `
      <header class="pod-topbar">
        <div class="pod-topbar__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
          </svg>
          <span>${escapeHtml(T("catTitle"))}</span>
        </div>
      </header>
      <div class="pod-cat-list">
        ${buildCategoryCard("uz", counts.uz)}
        ${buildCategoryCard("ru", counts.ru)}
        ${buildCategoryCard("en", counts.en)}
      </div>
    `;
    podcastsRoot.querySelectorAll("[data-pod-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        haptic("light");
        renderLanguageList(btn.dataset.podCat);
      });
    });
  }

  function renderLanguageList(lang) {
    currentView = "lang-list";
    currentLang = lang;
    const meta = LANG_META[lang] || LANG_META.uz;
    const langChannels = channels.filter((c) => detectChannelLang(c) === lang);
    const filtered = shuffleArray(filterChannels(langChannels));
    const items = filtered.map((c) => {
      const s = c.snapshot || {};
      const avatar = s.avatar ? `<img src="${escapeHtml(s.avatar)}" alt="" />` : `<span>${escapeHtml((s.title || "?").charAt(0))}</span>`;
      const tags = `<span class="pod-channel-row__tag pod-channel-row__tag--green">${formatCount(s.videoCount)} ${escapeHtml(T("unitVideo"))}</span><span class="pod-channel-row__tag pod-channel-row__tag--yellow">${formatCount(s.subscriberCount)} ${escapeHtml(T("unitSubs"))}</span>`;
      return `
        <button class="pod-channel-row" type="button" data-pod-open="${escapeHtml(c.channelId)}">
          <span class="pod-channel-row__glow" aria-hidden="true"></span>
          <div class="pod-channel-row__avatar">${avatar}</div>
          <div class="pod-channel-row__body">
            <div class="pod-channel-row__title">${escapeHtml(s.title || c.channelId)}</div>
            <div class="pod-channel-row__meta">${tags}</div>
          </div>
          <span class="pod-channel-row__go" aria-hidden="true">
            <svg class="pod-channel-row__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </button>
      `;
    }).join("");
    podcastsRoot.innerHTML = `
      <header class="pod-topbar pod-topbar--channel">
        <button class="pod-topbar__back" type="button" data-pod-back-to-categories aria-label="${escapeHtml(T("back"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="pod-topbar__title pod-topbar__title--ch">${meta.emoji} ${escapeHtml(langMetaTitle(lang))}</div>
        <span style="width:34px"></span>
      </header>
      <div class="pod-list">
        ${filtered.length
          ? items
          : (currentQuery
              ? `<div class="pod-empty"><div class="pod-empty__icon">🔎</div><div class="pod-empty__title">${escapeHtml(T("emptyNothingTitle"))}</div><div class="pod-empty__hint">${escapeHtml(T("emptyNothingHint"))}</div></div>`
              : `<div class="pod-empty"><div class="pod-empty__icon">${meta.emoji}</div><div class="pod-empty__title">${escapeHtml(T("emptyNoLangPodcasts"))}</div><div class="pod-empty__hint">${escapeHtml(T("emptyChooseOther"))}</div></div>`)}
      </div>
    `;
    podcastsRoot.querySelector("[data-pod-back-to-categories]")?.addEventListener("click", () => {
      haptic("light");
      renderCategoriesView();
    });
    podcastsRoot.querySelectorAll("[data-pod-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        haptic("light");
        renderChannel(btn.dataset.podOpen);
      });
    });
  }

  async function openPodcastsCategoriesView() {
    if (!podcastsView) return;
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    if (!loaded) {
      podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>${escapeHtml(T("loading"))}</div></div>`;
      await loadChannels();
    }
    renderCategoriesView();
  }

  function setQuery(q) {
    const next = String(q || "").trim().toLowerCase();
    if (next === currentQuery) return;
    currentQuery = next;
    if (!podcastsView || podcastsView.hidden) return;
    if (currentView === "list") {
      renderList();
    } else if (currentView === "lang-list" && currentLang) {
      renderLanguageList(currentLang);
    } else if (currentView === "channel" && currentChannelData) {
      visibleVideos = RENDER_BATCH;
      visibleShorts = RENDER_BATCH;
      const content = podcastsRoot.querySelector("#podChContent");
      if (content) {
        content.innerHTML = buildTabContent(currentChannelData);
        wireContentEvents();
      }
    } else if (currentView === "saved") {
      renderSavedView();
    }
  }

  // Tizimdagi til o'zgarsa — joriy ko'rinishni qayta chizamiz.
  function rerenderCurrent() {
    if (!podcastsView || podcastsView.hidden) return;
    if (currentView === "list") {
      renderList();
    } else if (currentView === "categories") {
      renderCategoriesView();
    } else if (currentView === "lang-list" && currentLang) {
      renderLanguageList(currentLang);
    } else if (currentView === "channel" && currentChannelData) {
      podcastsRoot.innerHTML = buildChannelView(currentChannelData);
      wireChannelEvents();
    } else if (currentView === "saved") {
      renderSavedView();
    }
  }
  try {
    window.addEventListener("kino-lang-change", rerenderCurrent);
  } catch (_) {}

  window.__potcasts = { openPodcastsView, closePodcastsView, openSavedView: openPodcastsSavedView, openCategoriesView: openPodcastsCategoriesView, setQuery };
  // Util funksiyalarni tashqariga chiqarish (app.js history/favorites uchun)
  window.__podUtils = { formatDuration, timeAgo, escapeHtml, getPodcastFavorites, togglePodcastFavorite, getSavedPodcastVideos };
})();
