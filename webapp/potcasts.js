// Potkastlar moduli — real YouTube kanallar.
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView, setQuery, setFilter }
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
  let searchQuery = "";
  let filterMode = "all"; // "all" | "favorites"

  const SUB_STORAGE_KEY = "podcasts_subscribed_v1";

  function readSubscribedChannels() {
    try {
      return JSON.parse(localStorage.getItem(SUB_STORAGE_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function toggleSubscribeChannel(channelId) {
    const list = readSubscribedChannels();
    const idx = list.indexOf(channelId);
    let isSubbed = false;
    if (idx === -1) {
      list.push(channelId);
      isSubbed = true;
    } else {
      list.splice(idx, 1);
      isSubbed = false;
    }
    try {
      localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(list));
      if (tg?.CloudStorage) {
        tg.CloudStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(list), () => {});
      }
    } catch (_) {}
    return isSubbed;
  }

  function updateSubscribeButton(btn, isSubbed) {
    if (!btn) return;
    btn.classList.toggle("is-subbed", isSubbed);
    const span = btn.querySelector("span");
    if (span) {
      span.textContent = isSubbed ? "Obunadasiz" : "Obuna bo'lish";
    }
    const svg = btn.querySelector("svg");
    if (svg) {
      if (isSubbed) {
        svg.innerHTML = `<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`;
      } else {
        svg.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>`;
      }
    }
  }

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

  // ---------- List view (qo'shilgan kanallar) ----------

  function buildList() {
    const subbedList = readSubscribedChannels();
    let filtered = channels;
    if (filterMode === "favorites") {
      filtered = channels.filter((c) => subbedList.includes(c.channelId));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const s = c.snapshot || {};
        const title = (s.title || "").toLowerCase();
        const handle = (s.handle || "").toLowerCase();
        const desc = (s.description || "").toLowerCase();
        return title.includes(q) || handle.includes(q) || desc.includes(q);
      });
    }

    const items = filtered.map((c) => {
      const s = c.snapshot || {};
      const avatar = s.avatar ? `<img src="${escapeHtml(s.avatar)}" alt="" />` : `<span>${escapeHtml((s.title || "?").charAt(0))}</span>`;
      const meta = `${escapeHtml(s.handle || "YouTube kanal")} · ${formatCount(s.subscriberCount)} obunachi`;
      return `
        <button class="pod-channel-row" type="button" data-pod-open="${escapeHtml(c.channelId)}">
          <span class="pod-channel-row__glow" aria-hidden="true"></span>
          <div class="pod-channel-row__avatar">${avatar}</div>
          <div class="pod-channel-row__body">
            <div class="pod-channel-row__head">
              <div class="pod-channel-row__title">${escapeHtml(s.title || c.channelId)}</div>
              <span class="pod-channel-row__pill">${formatCount(s.subscriberCount)}</span>
            </div>
            <div class="pod-channel-row__meta">${meta}</div>
            <div class="pod-channel-row__desc">${escapeHtml((s.description || "").slice(0, 90))}${(s.description || "").length > 90 ? "…" : ""}</div>
          </div>
          <span class="pod-channel-row__go" aria-hidden="true">
            <svg class="pod-channel-row__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </span>
        </button>
      `;
    }).join("");

    const titleText = filterMode === "favorites" ? "Sevimli Potkastlar" : "Potkastlar";

    return `
      <header class="pod-topbar">
        <button class="pod-topbar__back" type="button" data-pod-close aria-label="Orqaga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="pod-topbar__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="13" rx="3"></rect>
            <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <span>${escapeHtml(titleText)}</span>
        </div>
      </header>
      <div class="pod-list">
        ${filtered.length ? items : `<div class="pod-empty"><div class="pod-empty__icon">🎙️</div><div class="pod-empty__title">Kanal topilmadi</div><div class="pod-empty__hint">${filterMode === "favorites" ? "Sevimli kanallaringiz yo'q." : "Qidiruv bo'yicha kanallar topilmadi."}</div></div>`}
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
    let { videos = [], shorts = [], playlists = [] } = data;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      videos = videos.filter((v) => (v.title || "").toLowerCase().includes(q));
      shorts = shorts.filter((v) => (v.title || "").toLowerCase().includes(q));
      playlists = playlists.filter((v) => (v.title || "").toLowerCase().includes(q));
    }

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
    const isSubbed = readSubscribedChannels().includes(ch.channelId);
    const subBtnClass = isSubbed ? "pod-ch-sub is-subbed" : "pod-ch-sub";
    const subBtnText = isSubbed ? "Obunadasiz" : "Obuna bo'lish";
    const subBtnIcon = isSubbed
      ? `<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`
      : `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>`;

    return `
      <header class="pod-topbar pod-topbar--channel">
        <button class="pod-topbar__back" type="button" data-pod-back-to-list aria-label="Orqaga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="pod-topbar__title pod-topbar__title--ch">${escapeHtml(ch.title || "")}</div>
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
            <button class="${subBtnClass}" type="button" data-pod-subscribe>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${subBtnIcon}</svg>
              <span>${subBtnText}</span>
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
      btn.addEventListener("click", () => {
        haptic("light");
        renderChannel(btn.dataset.podOpen);
      });
    });
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
    const subBtn = podcastsRoot.querySelector("[data-pod-subscribe]");
    subBtn?.addEventListener("click", () => {
      haptic("medium");
      const isSubbed = toggleSubscribeChannel(currentChannelId);
      updateSubscribeButton(subBtn, isSubbed);
      showToast(isSubbed ? "Obuna bo'lindi" : "Obunadan chiqildi");
    });
    wireContentEvents();
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

  function setQuery(q) {
    searchQuery = String(q || "").trim();
    if (currentView === "list") {
      renderList();
    } else if (currentView === "channel" && currentChannelData) {
      const content = podcastsRoot.querySelector("#podChContent");
      if (content) {
        content.innerHTML = buildTabContent(currentChannelData);
        wireContentEvents();
      }
    }
  }

  function setFilter(filter) {
    filterMode = filter === "favorites" ? "favorites" : "all";
    if (currentView === "list") {
      renderList();
    } else {
      renderList();
    }
  }

  window.__potcasts = { openPodcastsView, closePodcastsView, setQuery, setFilter };
})();
