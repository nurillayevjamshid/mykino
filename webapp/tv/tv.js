// TV bo'limi — O'zbek telekanallari jonli efiri (HLS).
// Lazy-load: kino.js ichidagi ensureTvModule() sidebar'dagi "TV" bosilganda yuklaydi.
// Tashqariga: window.__tv = { openTvView, closeTvView }
(function initTvModule() {
  const tvView = document.getElementById("tvView");
  const appShell = document.getElementById("appShell");
  if (!tvView) return;

  // ===== Kanallar ro'yxati (uz.m3u dan) =====
  // group: General/Kids/Movies/Music/Entertainment/News/Documentary/Sports/Family/Undefined
  const TV_CHANNELS = [
    { name: "O'zbekiston", group: "General", logo: "https://i.imgur.com/QUIIhTD.png", url: "https://stream8.cinerama.uz/1001/tracks-v1a1/playlist.m3u8" },
    { name: "Yoshlar", group: "General", logo: "https://i.imgur.com/s4xfUSx.png", url: "https://stream8.cinerama.uz/1002/tracks-v1a1/playlist.m3u8" },
    { name: "Toshkent", group: "General", logo: "https://i.imgur.com/Z9R4nZg.png", url: "https://stream8.cinerama.uz/1003/tracks-v1a1/playlist.m3u8" },
    { name: "Milliy", group: "General", logo: "https://i.imgur.com/v4FBm26.png", url: "https://stream8.cinerama.uz/1014/tracks-v1a1/playlist.m3u8" },
    { name: "MY5", group: "Entertainment", logo: "https://i.imgur.com/bjlzu5k.png", url: "https://st.my5.media/hls/hd/index.m3u8" },
    { name: "Sevimli TV", group: "Family", logo: "https://i.imgur.com/iMwzRlr.png", url: "https://stream8.cinerama.uz/1017/tracks-v1a1/playlist.m3u8" },
    { name: "Zo'r TV", group: "Entertainment", logo: "https://i.imgur.com/NuzyhVM.png", url: "https://stream8.cinerama.uz/1016/tracks-v1a1/mono.m3u8" },
    { name: "Sport", group: "Sports", logo: "https://i.imgur.com/2WJE9CM.png", url: "https://stream8.cinerama.uz/1004/tracks-v1a1/mono.m3u8" },
    { name: "O'zbekiston 24", group: "News", logo: "https://i.imgur.com/VRFhKbw.png", url: "https://stream8.cinerama.uz/1011/tracks-v1a1/playlist.m3u8" },
    { name: "UzReport TV", group: "News", logo: "https://i.imgur.com/Bch2RHc.jpg", url: "https://stream8.cinerama.uz/1015/tracks-v1a1/playlist.m3u8" },
    { name: "Kinoteatr", group: "Movies", logo: "https://i.imgur.com/emH1BgC.png", url: "https://stream8.cinerama.uz/1009/tracks-v1a1/playlist.m3u8" },
    { name: "BIZ Cinema", group: "Movies", logo: "https://biztv.uz/static/media/biz-cinema.286b83dc.png", url: "https://fl.biztv.media/cinema_720_EMfSyXgoRdiIHgldXTZICucKTIeCKO/index.m3u8" },
    { name: "BIZ TV", group: "Entertainment", logo: "https://biztv.uz/static/media/logo.5f993187.png", url: "https://fl.biztv.media/biz_tv_720_uni8jhub4h8fub4idejswh8dh3j94finbu4nidj39inwsj92in3d/index.m3u8" },
    { name: "BIZ Music", group: "Music", logo: "https://i.ibb.co/DfsCJwk/Uz-biz-music-5462.jpg", url: "https://fl.biztv.media/music_720_QAKpGmVUjaPApCNjpsgBxrdqNihAkl/index.m3u8" },
    { name: "FTV", group: "Music", logo: "https://i.imgur.com/7lpISyN.jpg", url: "https://stream8.cinerama.uz/1018/playlist.m3u8" },
    { name: "Navo", group: "General", logo: "https://i.imgur.com/7dZ64y9.png", url: "https://stream8.cinerama.uz/1008/tracks-v1a1/playlist.m3u8" },
    { name: "Bolajon", group: "Kids", logo: "https://i.imgur.com/s7o0ifu.png", url: "https://stream8.cinerama.uz/1007/playlist.m3u8" },
    { name: "Aqlvoy", group: "Kids", logo: "https://i.imgur.com/ekF5cAi.png", url: "https://stream8.cinerama.uz/1205/tracks-v1a1/mono.m3u8" },
    { name: "Cheksiz TV", group: "Entertainment", logo: "https://i.imgur.com/f7hHmmR.jpeg", url: "https://fl.biztv.media/cheksiz_tv_480_unif7hujidth7f4du83jrhuid3k94j8hfj8d93eubych8eju93n4ubt/tracks-v1a1/mono.m3u8" },
    { name: "Makon TV", group: "Entertainment", logo: "https://i.imgur.com/vCc0ED1.png", url: "https://stream8.cinerama.uz/1497/tracks-v1a1/mono.m3u8" },
    { name: "Dunyo bo'ylab", group: "General", logo: "https://i.imgur.com/KArB5U6.png", url: "https://stream8.cinerama.uz/1006/tracks-v1a1/playlist.m3u8" },
    { name: "Madaniyat va ma'rifat", group: "General", logo: "https://i.imgur.com/eeNLXCP.png", url: "https://stream8.cinerama.uz/1005/tracks-v1a1/playlist.m3u8" },
    { name: "O'zbekiston Tarixi", group: "Documentary", logo: "https://i.imgur.com/iTTd3Ir.png", url: "https://stream8.cinerama.uz/1209/tracks-v1a1/playlist.m3u8" },
    { name: "Dasturxon TV", group: "General", logo: "https://i.imgur.com/APM2ej5.jpeg", url: "https://stream8.cinerama.uz/1206/tracks-v1a1/playlist.m3u8" },
    { name: "Renessans TV", group: "General", logo: "https://i.imgur.com/cVlcqCX.png", url: "https://stream8.cinerama.uz/1221/tracks-v1a1/playlist.m3u8" },
    { name: "Taraqqiyot TV", group: "General", logo: "https://i.imgur.com/V3rtPEl.jpg", url: "https://stream8.cinerama.uz/1204/tracks-v1a1/mono.m3u8" },
    { name: "Nurafshon TV", group: "General", logo: "https://i.imgur.com/MMdNyBU.jpeg", url: "https://stream8.cinerama.uz/1220/tracks-v1a1/mono.m3u8" },
    { name: "Mahalla", group: "Undefined", logo: "https://i.imgur.com/GtABiJI.png", url: "https://stream8.cinerama.uz/1013/tracks-v1a1/playlist.m3u8" },
    { name: "Andijon MTRK", group: "General", logo: "https://i.imgur.com/EGPAvom.jpeg", url: "https://stream8.cinerama.uz/1457/tracks-v1a1/mono.m3u8" },
    { name: "Farg'ona MTRK", group: "General", logo: "https://i.imgur.com/RYjQOfo.jpeg", url: "https://stream8.cinerama.uz/1458/tracks-v1a1/mono.m3u8" },
    { name: "Buxoro MTRK", group: "General", logo: "https://i.imgur.com/jmxPtC9.png", url: "https://stream8.cinerama.uz/1459/tracks-v1a1/mono.m3u8" },
    { name: "Navoiy MTRK", group: "General", logo: "https://i.imgur.com/qa4VlYh.png", url: "https://stream8.cinerama.uz/1460/tracks-v1a1/mono.m3u8" },
    { name: "Qaraqalpaqstan", group: "General", logo: "https://i.imgur.com/G3qrUJh.png", url: "https://stream8.cinerama.uz/1467/playlist.m3u8" },
  ];

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

  function buildChannelCard(ch, idx) {
    return `
      <button class="tv-card" type="button" data-tv-play="${idx}">
        <span class="tv-card__logo">
          <img src="${esc(ch.logo)}" alt="" loading="lazy" decoding="async"
               onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
          <span class="tv-card__fallback" style="display:none;">${esc(channelInitial(ch.name))}</span>
        </span>
        <span class="tv-card__name">${esc(ch.name)}</span>
        <span class="tv-card__live"><span class="tv-card__live-dot"></span>LIVE</span>
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
    renderTvView();
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
