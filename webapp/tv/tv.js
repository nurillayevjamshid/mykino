// TV bo'limi — O'zbek telekanallari jonli efiri (HLS).
// Lazy-load: kino.js ichidagi ensureTvModule() sidebar'dagi "TV" bosilganda yuklaydi.
// Tashqariga: window.__tv = { openTvView, closeTvView }
(function initTvModule() {
  const tvView = document.getElementById("tvView");
  const appShell = document.getElementById("appShell");
  if (!tvView) return;

  // ===== Kanallar ro'yxati =====
  // Manba tartibi: 1) admin boshqargan ro'yxat (/api/categories?type=tv-channels),
  // 2) statik default (/static/tv/tv-channels.json). Admin panel orqali kanal
  // qo'shish/tahrirlash/o'chirish mumkin — saqlangan ro'yxat ustunlik qiladi.
  let TV_CHANNELS = [];
  let tvChannelsPromise = null;

  function fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  function loadTvChannels() {
    if (TV_CHANNELS.length) return Promise.resolve(TV_CHANNELS);
    if (tvChannelsPromise) return tvChannelsPromise;
    tvChannelsPromise = (async () => {
      const api = await fetchJson("/api/categories?type=tv-channels", 5000);
      if (api && api.ok && Array.isArray(api.channels) && api.channels.length) {
        TV_CHANNELS = api.channels;
        return TV_CHANNELS;
      }
      const def = await fetchJson("/static/tv/tv-channels.json?v=20260710-tv-sport-cleanup", 8000);
      if (def && Array.isArray(def.channels)) TV_CHANNELS = def.channels;
      return TV_CHANNELS;
    })().finally(() => { tvChannelsPromise = null; });
    return tvChannelsPromise;
  }

  const GROUP_LABELS = {
    all: "Barchasi",
    General: "Umumiy",
    Entertainment: "Ko'ngilochar",
    Movies: "Kino",
    Music: "Musiqa",
    Kids: "Bolalar",
    News: "Yangiliklar",
    Sports: "Sport",
    Family: "Oila",
    Documentary: "Hujjatli",
    Undefined: "Boshqa",
  };
  const GROUP_ORDER = ["all", "General", "Entertainment", "Movies", "Music", "Kids", "News", "Sports", "Family", "Documentary", "Undefined"];

  let activeGroup = "all";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function channelInitial(name) {
    return String(name || "?").trim().charAt(0).toUpperCase();
  }

  // Logolar rasm-proxy (weserv.nl) orqali yuklanadi — imgur ba'zi hududlarda
  // bloklangan/hotlink'ga 403 qaytaradi. Proxy ishlamasa to'g'ridan-to'g'ri
  // URL'ga, u ham bo'lmasa harfli fallback'ga o'tiladi.
  function logoProxyUrl(url) {
    if (!url) return "";
    return "https://images.weserv.nl/?url=" + encodeURIComponent(url) + "&w=112&h=112&fit=contain";
  }

  function buildChannelCard(ch, idx) {
    const proxied = logoProxyUrl(ch.logo);
    return `
      <button class="tv-card" type="button" data-tv-play="${idx}">
        <span class="tv-card__logo">
          <img src="${esc(proxied)}" data-direct="${esc(ch.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"
               onerror="if(this.dataset.direct){this.src=this.dataset.direct;this.removeAttribute('data-direct');}else{this.style.display='none';this.nextElementSibling.style.display='grid';}" />
          <span class="tv-card__fallback" style="display:none;">${esc(channelInitial(ch.name))}</span>
        </span>
        <span class="tv-card__name">${esc(ch.name)}</span>
      </button>`;
  }

  function visibleChannels() {
    if (activeGroup === "all") return TV_CHANNELS.map((ch, i) => ({ ch, i }));
    return TV_CHANNELS.map((ch, i) => ({ ch, i })).filter(({ ch }) => ch.group === activeGroup);
  }

  function usedGroups() {
    const present = new Set(TV_CHANNELS.map((c) => c.group));
    return GROUP_ORDER.filter((g) => g === "all" || present.has(g));
  }

  function renderTvView() {
    const chips = usedGroups().map((g) =>
      `<button class="tv-chip${g === activeGroup ? " is-active" : ""}" type="button" data-tv-group="${esc(g)}">${esc(GROUP_LABELS[g] || g)}</button>`
    ).join("");
    const cards = visibleChannels().map(({ ch, i }) => buildChannelCard(ch, i)).join("");
    tvView.innerHTML = `
      <header class="tv-head">
        <button class="tv-head__back" type="button" data-tv-back aria-label="Orqaga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <h1 class="tv-head__title">TV kanallar</h1>
        <span class="tv-head__count">${TV_CHANNELS.length} ta</span>
      </header>
      <div class="tv-chips">${chips}</div>
      <div class="tv-grid">${cards}</div>
      <div class="tv-spacer"></div>
    `;
    tvView.querySelector("[data-tv-back]")?.addEventListener("click", () => closeTvView());
    tvView.querySelectorAll("[data-tv-group]").forEach((b) => {
      b.addEventListener("click", () => {
        activeGroup = b.dataset.tvGroup;
        renderTvView();
      });
    });
    tvView.querySelectorAll("[data-tv-play]").forEach((b) => {
      b.addEventListener("click", () => {
        const ch = TV_CHANNELS[Number(b.dataset.tvPlay)];
        if (ch) openTvPlayer(ch);
      });
    });
  }

  // ===== HLS pleyer (fifa.js jonli efir pleyeri naqshi) =====
  let hlsLibLoading = null;
  function loadHlsLib() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (hlsLibLoading) return hlsLibLoading;
    hlsLibLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
      s.async = true;
      s.onload = () => resolve(window.Hls);
      s.onerror = () => { hlsLibLoading = null; reject(new Error("hls.js yuklanmadi")); };
      document.head.appendChild(s);
    });
    return hlsLibLoading;
  }

  let activeHls = null;
  let controlsTimer = null;

  function ensurePlayerModal() {
    let modal = document.getElementById("tvPlayerModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "tvPlayerModal";
    modal.hidden = true;
    modal.innerHTML = `
      <video id="tvPlayerVideo" playsinline autoplay></video>
      <div class="tv-player__top">
        <button class="tv-player__icon-btn" type="button" data-tv-player-close aria-label="Yopish">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6 9 12l6 6"></path></svg>
        </button>
        <strong class="tv-player__name" id="tvPlayerName"></strong>
        <span class="tv-player__badge"><span class="tv-player__dot"></span>LIVE</span>
      </div>
      <button class="tv-player__center-btn" type="button" id="tvPlayerPlay" hidden aria-label="Play"></button>
      <div class="tv-player__bottom">
        <button class="tv-player__icon-btn" type="button" id="tvPlayerMute" aria-label="Ovoz"></button>
        <button class="tv-player__icon-btn" type="button" id="tvPlayerFs" aria-label="To'liq ekran">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
        </button>
      </div>
      <div class="tv-player__status" id="tvPlayerStatus"></div>
    `;
    document.body.appendChild(modal);

    modal.querySelector("[data-tv-player-close]")?.addEventListener("click", () => closeTvPlayer());
    modal.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      modal.classList.toggle("controls-hidden");
      if (!modal.classList.contains("controls-hidden")) scheduleControlsHide(modal);
    });

    const video = modal.querySelector("#tvPlayerVideo");
    const playBtn = modal.querySelector("#tvPlayerPlay");
    playBtn.addEventListener("click", () => { video.play().catch(() => {}); });

    // Jonli efir — orqaga/oldinga o'tkazib bo'lmaydi. Foydalanuvchi seek
    // qilsa (shu jumladan iOS native fullscreen'dagi ±10s va progress bar),
    // pleyer avtomatik jonli nuqtaga qaytadi. Tezlik ham 1x da qotiriladi.
    let seekSnapGuard = false;
    const liveEdge = () => {
      if (activeHls && Number.isFinite(activeHls.liveSyncPosition)) return activeHls.liveSyncPosition;
      try {
        if (video.seekable && video.seekable.length) return video.seekable.end(video.seekable.length - 1);
      } catch (_) {}
      return NaN;
    };
    video.addEventListener("seeking", () => {
      if (seekSnapGuard) return;
      const edge = liveEdge();
      if (!Number.isFinite(edge)) return;
      if (Math.abs(video.currentTime - edge) > 6) {
        seekSnapGuard = true;
        try { video.currentTime = edge; } catch (_) {}
        setTimeout(() => { seekSnapGuard = false; }, 250);
      }
    });
    video.addEventListener("ratechange", () => {
      if (video.playbackRate !== 1) { try { video.playbackRate = 1; } catch (_) {} }
    });
    video.addEventListener("play", () => { playBtn.hidden = true; scheduleControlsHide(modal); });
    video.addEventListener("playing", () => { playBtn.hidden = true; setStatus(""); scheduleControlsHide(modal); });
    video.addEventListener("pause", () => {
      playBtn.hidden = false;
      playBtn.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg>`;
      modal.classList.remove("controls-hidden");
    });

    const muteBtn = modal.querySelector("#tvPlayerMute");
    const syncMuteIcon = () => {
      muteBtn.innerHTML = video.muted
        ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.7-2.7-1.41-1.42-2.7 2.71-2.7-2.71-1.42 1.42 2.71 2.7-2.71 2.7 1.42 1.42 2.7-2.71 2.7 2.71 1.41-1.42-2.7-2.7z"/></svg>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
    };
    muteBtn.addEventListener("click", () => { video.muted = !video.muted; syncMuteIcon(); });
    syncMuteIcon();

    modal.querySelector("#tvPlayerFs")?.addEventListener("click", () => {
      const inFs = document.fullscreenElement || document.webkitFullscreenElement;
      if (inFs) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        return;
      }
      if (typeof video.webkitEnterFullscreen === "function" && !video.paused) {
        try { video.webkitEnterFullscreen(); return; } catch (_) {}
      }
      (modal.requestFullscreen || modal.webkitRequestFullscreen)?.call(modal);
    });

    return modal;
  }

  function scheduleControlsHide(modal, delay = 4000) {
    if (controlsTimer) clearTimeout(controlsTimer);
    controlsTimer = setTimeout(() => {
      const v = modal.querySelector("#tvPlayerVideo");
      if (v && !v.paused) modal.classList.add("controls-hidden");
    }, delay);
  }

  function setStatus(text) {
    const el = document.getElementById("tvPlayerStatus");
    if (!el) return;
    el.textContent = text || "";
    el.style.display = text ? "block" : "none";
  }

  function stopPlayback() {
    try { activeHls?.destroy?.(); } catch (_) {}
    activeHls = null;
    const video = document.getElementById("tvPlayerVideo");
    if (video) {
      try { video.pause(); } catch (_) {}
      video.removeAttribute("src");
      try { video.load(); } catch (_) {}
    }
  }

  function openTvPlayer(channel) {
    const modal = ensurePlayerModal();
    const video = modal.querySelector("#tvPlayerVideo");
    const nameEl = modal.querySelector("#tvPlayerName");
    if (nameEl) nameEl.textContent = channel.name;
    modal.hidden = false;
    modal.classList.remove("controls-hidden");
    document.body.classList.add("tv-player-open");
    setStatus("Yuklanmoqda…");
    try { window.tgBackRegister?.("tv-player", () => closeTvPlayer()); } catch (_) {}

    const src = channel.url;
    const tryNative = () => {
      if (!video.canPlayType("application/vnd.apple.mpegurl")) {
        setStatus("Brauzer jonli efirni qo'llab-quvvatlamaydi");
        return;
      }
      video.src = src;
      video.addEventListener("loadedmetadata", () => setStatus(""), { once: true });
      video.addEventListener("error", () => setStatus("Oqimni yuklab bo'lmadi"), { once: true });
      video.play().catch(() => {});
    };

    loadHlsLib().then((Hls) => {
      if (!Hls || !Hls.isSupported()) { tryNative(); return; }
      stopPlayback();
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1500,
        levelLoadingMaxRetry: 4,
      });
      activeHls = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setStatus(""); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setStatus("Tarmoq xatosi — kanal vaqtincha ishlamayapti");
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch (_) { setStatus("Media xatosi"); }
        } else {
          setStatus("Oqimni yuklab bo'lmadi");
        }
      });
    }).catch(() => tryNative());
  }

  function closeTvPlayer() {
    const modal = document.getElementById("tvPlayerModal");
    if (!modal || modal.hidden) return;
    stopPlayback();
    modal.hidden = true;
    document.body.classList.remove("tv-player-open");
    if (controlsTimer) { clearTimeout(controlsTimer); controlsTimer = null; }
    try { window.tgBackUnregister?.("tv-player"); } catch (_) {}
  }

  // ===== View ochish/yopish =====
  function openTvView() {
    tvView.hidden = false;
    document.body.classList.add("is-tv");
    if (TV_CHANNELS.length) {
      renderTvView();
    } else {
      tvView.innerHTML = `<div class="tv-loading"><div class="tv-loading__spinner"></div><div>Kanallar yuklanmoqda…</div></div>`;
      loadTvChannels().then(() => {
        if (!document.body.classList.contains("is-tv")) return;
        if (TV_CHANNELS.length) renderTvView();
        else tvView.innerHTML = `<div class="tv-loading"><div>Kanallarni yuklab bo'lmadi. Tarmoqni tekshirib qayta urinib ko'ring.</div></div>`;
      });
    }
    appShell?.scrollTo({ top: 0, behavior: "smooth" });
    try { window.tgBackRegister?.("tv-view", () => closeTvViewAndGoHome()); } catch (_) {}
    try { window.syncSidebarSectionItems?.(); } catch (_) {}
  }

  function closeTvView() {
    closeTvPlayer();
    tvView.hidden = true;
    document.body.classList.remove("is-tv");
    try { window.tgBackUnregister?.("tv-view"); } catch (_) {}
  }

  function closeTvViewAndGoHome() {
    closeTvView();
    try { window.setFilter?.("all"); } catch (_) {}
  }

  window.__tv = { openTvView, closeTvView };
})();
