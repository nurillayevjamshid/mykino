// Potkastlar moduli — real YouTube kanallar.
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView }
(function () {
  "use strict";

  const podcastsView = document.getElementById("podcastsView");
  const podcastsRoot = document.getElementById("podcastsRoot");

  const tg = window.Telegram?.WebApp;
  const haptic = (kind = "light") => {
    try { tg?.HapticFeedback?.impactOccurred?.(kind); } catch (_) {}
  };

  let channels = [];
  let loaded = false;
  let currentView = "list"; // "list" | "channel"
  let currentChannelId = null;
  let currentChannelData = null;
  let currentTab = "home"; // "home" | "videos" | "shorts" | "playlists"
  let toastTimer = null;

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
    if (d < 1) return "Bugun";
    if (d < 2) return "Kecha";
    if (d < 7) return `${d} kun oldin`;
    if (d < 30) return `${Math.floor(d / 7)} hafta oldin`;
    if (d < 365) return `${Math.floor(d / 30)} oy oldin`;
    return `${Math.floor(d / 365)} yil oldin`;
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
      const r = await fetch("/api/podcasts");
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || "Yuklab bo'lmadi.");
      channels = Array.isArray(data.channels) ? data.channels : [];
      loaded = true;
    } catch (err) {
      console.error("podcasts loadChannels:", err);
      channels = [];
      loaded = true;
    }
  }

  async function loadChannelView(channelId) {
    const r = await fetch(`/api/podcasts?channelId=${encodeURIComponent(channelId)}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "Kanalni yuklab bo'lmadi.");
    return data; // { channel, videos, shorts, playlists }
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
    const slides = list.map((c, i) => {
      const s = c.snapshot || {};
      const banner = s.banner || "";
      const bgStyle = banner ? `background-image:url('${escapeHtml(banner)}')` : "";
      return `
        <div class="pod-hero-slide ${i === 0 ? "is-active" : ""}" data-pod-open="${escapeHtml(c.channelId)}">
          <div class="pod-hero__bg" style="${bgStyle}"></div>
          <div class="pod-hero__gradient"></div>
          <div class="pod-hero__inner">
            <h3 class="pod-hero__title">${escapeHtml(s.title || c.channelId)}</h3>
          </div>
        </div>
      `;
    }).join("");
    const dots = list.map((_, i) => `<span class="pod-hero-dot ${i === 0 ? "is-active" : ""}" data-pod-hero-dot="${i}"></span>`).join("");
    return `
      <div class="pod-hero-carousel">
        <div class="pod-hero-slides">${slides}</div>
        <div class="pod-hero-dots">${dots}</div>
      </div>
    `;
  }

  // ---------- List view (qo'shilgan kanallar) ----------

  function buildList() {
    const items = channels.map((c) => {
      const s = c.snapshot || {};
      const avatar = s.avatar ? `<img src="${escapeHtml(s.avatar)}" alt="" />` : `<span>${escapeHtml((s.title || "?").charAt(0))}</span>`;
      const meta = `${formatCount(s.videoCount)} video`;
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

    // Statistika kartochkalari
    const totalVideos = channels.reduce((sum, c) => sum + Number((c.snapshot || {}).videoCount || 0), 0);
    const totalSubs = channels.reduce((sum, c) => sum + Number((c.snapshot || {}).subscriberCount || 0), 0);
    const statsHtml = channels.length ? `
      <div class="pod-stats-row">
        <div class="pod-stat-card pod-stat-card--green">
          <div class="pod-stat-card__icon">🎬</div>
          <div class="pod-stat-card__info">
            <div class="pod-stat-card__number">${formatCount(totalVideos)}</div>
            <div class="pod-stat-card__label">ta video</div>
          </div>
        </div>
        <div class="pod-stat-card pod-stat-card--yellow">
          <div class="pod-stat-card__icon">👥</div>
          <div class="pod-stat-card__info">
            <div class="pod-stat-card__number">${formatCount(totalSubs)}</div>
            <div class="pod-stat-card__label">obunachi</div>
          </div>
        </div>
      </div>
    ` : "";

    return `
      <header class="pod-topbar">
        <div class="pod-topbar__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="13" rx="3"></rect>
            <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <span>Potkastlar</span>
        </div>
      </header>
      <div class="pod-list">
        ${buildFeaturedChannels()}
        ${statsHtml}
        ${channels.length ? items : `<div class="pod-empty"><div class="pod-empty__icon">🎙️</div><div class="pod-empty__title">Hali kanal qo'shilmagan</div><div class="pod-empty__hint">Admin paneldan YouTube kanal qo'shing</div></div>`}
      </div>
    `;
  }

  // ---------- Channel view (YouTube-style) ----------

  function buildVideoCard(v) {
    return `
      <button class="pod-vid-card" type="button" data-pod-play-video="${escapeHtml(v.videoId)}">
        <div class="pod-vid-card__thumb" style="background-image:url('${escapeHtml(v.thumb)}')">
          <span class="pod-vid-card__dur">${formatDuration(v.durationSec)}</span>
        </div>
        <div class="pod-vid-card__title">${escapeHtml(v.title)}</div>
        <div class="pod-vid-card__meta">${formatCount(v.viewCount)} ko'rishlar · ${escapeHtml(timeAgo(v.publishedAt))}</div>
      </button>
    `;
  }

  function buildShortCard(v) {
    return `
      <button class="pod-short-card" type="button" data-pod-play-video="${escapeHtml(v.videoId)}">
        <div class="pod-short-card__thumb" style="background-image:url('${escapeHtml(v.thumb)}')"></div>
        <div class="pod-short-card__title">${escapeHtml(v.title)}</div>
        <div class="pod-short-card__meta">${formatCount(v.viewCount)} ko'rishlar</div>
      </button>
    `;
  }

  function buildPlaylistCard(p) {
    return `
      <a class="pod-pl-card" href="https://www.youtube.com/playlist?list=${escapeHtml(p.playlistId)}" target="_blank" rel="noopener" data-pod-pl="${escapeHtml(p.playlistId)}">
        <div class="pod-pl-card__thumb" style="background-image:url('${escapeHtml(p.thumb)}')">
          <span class="pod-pl-card__count">${p.itemCount} video</span>
        </div>
        <div class="pod-pl-card__title">${escapeHtml(p.title)}</div>
      </a>
    `;
  }

  function buildTabContent(data) {
    const { videos = [], shorts = [], playlists = [] } = data;
    if (currentTab === "home") {
      const latest = videos.slice(0, 1);
      const recent = videos.slice(1, 9);
      const shortsRow = shorts.slice(0, 10);
      return `
        ${latest.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">So'nggi yuklangan</h3>
            <div class="pod-vid-grid pod-vid-grid--featured">
              ${buildVideoCard(latest[0])}
            </div>
          </section>` : ""}
        ${shortsRow.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">Shorts</h3>
            <div class="pod-shorts-row">
              ${shortsRow.map(buildShortCard).join("")}
            </div>
          </section>` : ""}
        ${recent.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">Videolar</h3>
            <div class="pod-vid-grid">
              ${recent.map(buildVideoCard).join("")}
            </div>
          </section>` : ""}
        ${playlists.length ? `
          <section class="pod-ch-section">
            <h3 class="pod-ch-section__title">Playlistlar</h3>
            <div class="pod-pl-row">
              ${playlists.slice(0, 8).map(buildPlaylistCard).join("")}
            </div>
          </section>` : ""}
        ${(!videos.length && !shorts.length && !playlists.length) ? `<div class="pod-empty"><div class="pod-empty__title">Kontent topilmadi</div></div>` : ""}
      `;
    }
    if (currentTab === "videos") {
      return `<div class="pod-vid-grid">${videos.map(buildVideoCard).join("") || `<div class="pod-empty"><div class="pod-empty__title">Videolar yo'q</div></div>`}</div>`;
    }
    if (currentTab === "shorts") {
      return `<div class="pod-shorts-grid">${shorts.map(buildShortCard).join("") || `<div class="pod-empty"><div class="pod-empty__title">Shortslar yo'q</div></div>`}</div>`;
    }
    if (currentTab === "playlists") {
      return `<div class="pod-pl-grid">${playlists.map(buildPlaylistCard).join("") || `<div class="pod-empty"><div class="pod-empty__title">Playlistlar yo'q</div></div>`}</div>`;
    }
    return "";
  }

  function buildChannelView(data) {
    const ch = data.channel || {};
    const banner = ch.banner ? `<div class="pod-ch-banner" style="background-image:url('${escapeHtml(ch.banner)}')"></div>` : `<div class="pod-ch-banner pod-ch-banner--fallback"></div>`;
    const tabs = [
      { id: "home", label: "Asosiy" },
      { id: "videos", label: "Videolar" },
      { id: "shorts", label: "Shorts" },
      { id: "playlists", label: "Playlistlar" },
    ];
    return `
      <header class="pod-topbar pod-topbar--channel">
        <button class="pod-topbar__back" type="button" data-pod-back-to-list aria-label="Orqaga">
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
                <span>${formatCount(ch.subscriberCount)} obunachi</span>
                <span class="pod-ch-dot">·</span>
                <span>${formatCount(ch.videoCount)} video</span>
              </div>
              ${ch.description ? `<div class="pod-ch-desc">${escapeHtml(ch.description.slice(0, 160))}${ch.description.length > 160 ? "…" : ""}</div>` : ""}
            </div>
          </div>
          <div class="pod-ch-actions">
            <button class="pod-ch-sub" type="button" data-pod-subscribe>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
              <span>Obuna bo'lish</span>
            </button>
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

  function openPlayer(videoId) {
    if (typeof window.__playYouTubeStandalone === "function") {
      window.__playYouTubeStandalone(videoId, { title: findVideoTitle(videoId) });
      return;
    }
    showToast("Pleyer hali yuklanmadi — qaytadan urinib ko'ring.");
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
    podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>Kanal yuklanmoqda...</div></div>`;
    try {
      const data = await loadChannelView(channelId);
      currentChannelData = data;
      podcastsRoot.innerHTML = buildChannelView(data);
      wireChannelEvents();
    } catch (err) {
      podcastsRoot.innerHTML = `<div class="pod-empty"><div class="pod-empty__title">Xato</div><div class="pod-empty__hint">${escapeHtml(err.message)}</div><button class="pod-ch-sub" type="button" data-pod-back-to-list style="margin-top:14px;">Orqaga</button></div>`;
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
    // Carousel dots
    const dots = podcastsRoot.querySelectorAll("[data-pod-hero-dot]");
    if (dots.length) {
      dots.forEach((dot) => {
        dot.addEventListener("click", () => {
          haptic("light");
          switchHeroSlide(Number(dot.dataset.podHeroDot));
        });
      });
      startHeroRotation();
    }
  }

  let heroRotateTimer = null;
  function startHeroRotation() {
    clearInterval(heroRotateTimer);
    heroRotateTimer = setInterval(() => {
      const slides = podcastsRoot.querySelectorAll(".pod-hero-slide");
      if (slides.length < 2) return;
      const active = podcastsRoot.querySelector(".pod-hero-slide.is-active");
      const idx = active ? [...slides].indexOf(active) : 0;
      switchHeroSlide((idx + 1) % slides.length);
    }, 5000);
  }
  function switchHeroSlide(idx) {
    const slides = podcastsRoot.querySelectorAll(".pod-hero-slide");
    const dots = podcastsRoot.querySelectorAll("[data-pod-hero-dot]");
    slides.forEach((s, i) => s.classList.toggle("is-active", i === idx));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
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
    podcastsRoot.querySelector("[data-pod-subscribe]")?.addEventListener("click", () => {
      haptic("medium");
      showToast("Obuna bo'lish funksiyasi yaqin orada");
    });
    podcastsRoot.querySelector("[data-pod-share]")?.addEventListener("click", () => {
      haptic("medium");
      shareChannel();
    });
    wireContentEvents();
  }

  function shareChannel() {
    if (!currentChannelData) return;
    const ch = currentChannelData.channel || {};
    const subText = formatCount(ch.subscriberCount) + " obunachi";
    const vidText = formatCount(ch.videoCount) + " video";
    const avatar = ch.avatar || "";
    const link = `https://t.me/mykinoplay_bot?startapp=pod_${encodeURIComponent(ch.channelId || "")}`;
    let text = `${ch.title || ""}\n\n`;
    text += `👥 ${subText}\n`;
    text += `🎬 ${vidText}\n\n`;
    text += `▶️ ${link}`;
    const shareUrl = avatar
      ? `https://t.me/share/url?url=${encodeURIComponent(avatar)}&text=${encodeURIComponent(text)}`
      : `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    try { window.open(shareUrl, "_blank"); } catch (_) {
      try { window.Telegram?.WebApp?.openTelegramLink(shareUrl); } catch (_) {}
    }
  }

  function wireContentEvents() {
    podcastsRoot.querySelectorAll("[data-pod-play-video]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        haptic("light");
        openPlayer(el.dataset.podPlayVideo);
      });
    });
    // Playlist link'lari — YouTube'ga o'tmasin, in-app pleyer ochsin (birinchi videoni)
    podcastsRoot.querySelectorAll("[data-pod-pl]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        haptic("light");
        showToast("Playlist tez orada qo'shiladi");
      });
    });
  }

  // ---------- Public API ----------

  async function openPodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    if (!loaded) {
      podcastsRoot.innerHTML = `<div class="pod-loading"><div class="pod-loading__spinner"></div><div>Yuklanmoqda...</div></div>`;
      await loadChannels();
    }
    renderList();
  }

  function closePodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = true;
    document.body.classList.remove("is-podcasts");
    closePlayer();
  }

  window.__potcasts = { openPodcastsView, closePodcastsView };
})();
