// Potkastlar moduli — admin paneldan qo'shilgan YouTube kanal linklaridan
// RSS orqali olinadigan kanallar ro'yxati, kanal sahifasi va YouTube iframe pleyer.
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView }
(function () {
  "use strict";

  const podcastsView = document.getElementById("podcastsView");
  const podcastsRoot = document.getElementById("podcastsRoot");

  const tg = window.Telegram?.WebApp;
  const haptic = (kind = "light") => {
    try { tg?.HapticFeedback?.impactOccurred?.(kind); } catch (_) {}
  };

  const CATEGORIES_ORDER = ["Barchasi", "Suhbat", "Biznes", "Texnologiya", "Madaniyat", "Tarix", "Sport", "Hayot", "Yumor", "Boshqa"];

  let state = {
    channels: [],
    loading: false,
    error: "",
    category: "Barchasi",
    query: "",
    view: "list",          // "list" | "channel"
    currentChannelId: "",
    playingVideoId: "",
    initialized: false,
  };

  let ytPlayer = null;
  let ytReady = false;
  let toastTimer = null;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 1800);
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const diff = Date.now() - t;
    const min = Math.floor(diff / 60000);
    if (min < 1) return "hozir";
    if (min < 60) return `${min} daq oldin`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} soat oldin`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} kun oldin`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk} hafta oldin`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo} oy oldin`;
    return `${Math.floor(day / 365)} yil oldin`;
  }

  async function loadChannels() {
    state.loading = true;
    state.error = "";
    render();
    try {
      const res = await fetch("/api/potcasts", { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Yuklab bo'lmadi.");
      state.channels = Array.isArray(data.channels) ? data.channels : [];
    } catch (err) {
      state.error = err.message || "Tarmoq xatosi";
      state.channels = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  function getCategories() {
    const set = new Set(["Barchasi"]);
    for (const c of state.channels) set.add(c.category || "Boshqa");
    const list = Array.from(set);
    list.sort((a, b) => {
      const ai = CATEGORIES_ORDER.indexOf(a);
      const bi = CATEGORIES_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, "uz");
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return list;
  }

  function filteredChannels() {
    const q = state.query.trim().toLowerCase();
    return state.channels.filter((c) => {
      if (state.category !== "Barchasi" && (c.category || "Boshqa") !== state.category) return false;
      if (q) {
        const hay = `${c.name} ${c.handle} ${c.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function findChannel(id) {
    return state.channels.find((c) => c.id === id || c.channelId === id);
  }

  function avatarHtml(channel, size = "md") {
    const initial = (channel.name || "?").trim().charAt(0).toUpperCase();
    if (channel.avatar) {
      return `<div class="pod-avatar pod-avatar--${size}"><img src="${escapeHtml(channel.avatar)}" alt="${escapeHtml(channel.name)}" loading="lazy" referrerpolicy="no-referrer" /></div>`;
    }
    return `<div class="pod-avatar pod-avatar--${size} pod-avatar--mono"><span>${escapeHtml(initial)}</span></div>`;
  }

  function buildTopBar() {
    if (state.view === "channel") {
      const ch = findChannel(state.currentChannelId);
      const title = ch ? ch.name : "Potkast";
      return `
        <header class="pod-topbar pod-topbar--detail">
          <button class="pod-topbar__back" type="button" data-pod-back aria-label="Ortga">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg>
          </button>
          <div class="pod-topbar__title pod-topbar__title--detail">
            <span class="pod-topbar__name">${escapeHtml(title)}</span>
          </div>
        </header>
      `;
    }
    return `
      <header class="pod-topbar">
        <div class="pod-topbar__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="2" width="6" height="13" rx="3"></rect>
            <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
          <span>Potkastlar</span>
          <span class="pod-topbar__beta">BETA</span>
        </div>
        <div class="pod-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
          <input type="search" id="podSearchInput" placeholder="Potkast kanalini izlash..." autocomplete="off" />
        </div>
      </header>
    `;
  }

  function buildCategoriesRow() {
    const cats = getCategories();
    if (cats.length <= 1) return "";
    return `
      <div class="pod-categories" id="podCategories">
        ${cats.map((c) => `
          <button class="pod-chip ${c === state.category ? "is-active" : ""}" type="button" data-pod-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>
        `).join("")}
      </div>
    `;
  }

  function buildHero(channels) {
    const top = channels.slice(0, 3);
    if (!top.length) return "";
    return `
      <div class="pod-hero">
        <div class="pod-hero__track" id="podHeroTrack">
          ${top.map((c) => {
            const latest = c.videos?.[0];
            const tagline = c.description || (c.handle ? `@${c.handle}` : `${(c.videos || []).length} ta epizod`);
            const ep = latest ? `Yangi: "${latest.title}"` : "Tez orada yangi epizod";
            return `
              <article class="pod-hero-card" data-pod-channel="${escapeHtml(c.id)}">
                ${c.avatar ? `<div class="pod-hero-card__bg" style="background-image:url('${escapeHtml(c.avatar)}')"></div>` : `<div class="pod-hero-card__bg pod-hero-card__bg--mono"></div>`}
                <div class="pod-hero-card__glow"></div>
                <div class="pod-hero-card__body">
                  <span class="pod-hero-card__badge">★ Tavsiya</span>
                  <h3 class="pod-hero-card__title">${escapeHtml(c.name)}</h3>
                  <p class="pod-hero-card__tagline">${escapeHtml(tagline)}</p>
                  <div class="pod-hero-card__ep">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
                    <span>${escapeHtml(ep)}</span>
                  </div>
                </div>
                ${avatarHtml(c, "hero")}
              </article>
            `;
          }).join("")}
        </div>
        ${top.length > 1 ? `<div class="pod-hero__dots" id="podHeroDots">
          ${top.map((_, i) => `<span class="pod-hero__dot ${i === 0 ? "is-active" : ""}" data-pod-dot="${i}"></span>`).join("")}
        </div>` : ""}
      </div>
    `;
  }

  function buildChannelsGrid(channels) {
    if (!channels.length) return "";
    return `
      <section class="pod-section">
        <header class="pod-section__head">
          <h2 class="pod-section__title">Barcha kanallar</h2>
        </header>
        <div class="pod-shows">
          ${channels.map((c) => `
            <button class="pod-show-card" type="button" data-pod-channel="${escapeHtml(c.id)}">
              ${avatarHtml(c, "lg")}
              <div class="pod-show-card__name">${escapeHtml(c.name)}</div>
              <div class="pod-show-card__host">${escapeHtml(c.category || "Potkast")} • ${(c.videos || []).length} epizod</div>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function buildLatestEpisodes(channels) {
    const items = [];
    for (const c of channels) {
      for (const v of (c.videos || []).slice(0, 3)) {
        items.push({ channel: c, video: v });
      }
    }
    items.sort((a, b) => {
      const ta = new Date(a.video.published || 0).getTime();
      const tb = new Date(b.video.published || 0).getTime();
      return tb - ta;
    });
    const top = items.slice(0, 10);
    if (!top.length) return "";
    return `
      <section class="pod-section">
        <header class="pod-section__head">
          <h2 class="pod-section__title">Yangi epizodlar</h2>
        </header>
        <div class="pod-episodes">
          ${top.map(({ channel, video }) => `
            <article class="pod-ep-row" data-pod-play="${escapeHtml(video.videoId)}" data-pod-channel-of="${escapeHtml(channel.id)}">
              <div class="pod-ep__thumb"><img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>
              <div class="pod-ep__body">
                <div class="pod-ep__top">
                  <span class="pod-ep__show">${escapeHtml(channel.name)}</span>
                </div>
                <h3 class="pod-ep__title">${escapeHtml(video.title)}</h3>
                <div class="pod-ep__meta">
                  <span>${escapeHtml(timeAgo(video.published))}</span>
                </div>
              </div>
              <button class="pod-ep__play" type="button" aria-label="O'ynash">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>
              </button>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function buildEmptyState() {
    return `
      <div class="pod-empty">
        <div class="pod-empty__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="2" width="6" height="13" rx="3"></rect>
            <path d="M5 10v2a7 7 0 0 0 14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="22"></line>
          </svg>
        </div>
        <h3 class="pod-empty__title">Hali potkast kanali qo'shilmagan</h3>
        <p class="pod-empty__text">Admin paneldan YouTube kanal linkini qo'shing — barcha videolar shu yerda paydo bo'ladi.</p>
      </div>
    `;
  }

  function buildLoading() {
    return `
      <div class="pod-loading">
        <div class="pod-loading__spinner"></div>
        <p>Yuklanmoqda...</p>
      </div>
    `;
  }

  function buildErrorState() {
    return `
      <div class="pod-empty">
        <div class="pod-empty__icon" style="color:#e54545">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 8v4M12 16h.01"></path>
          </svg>
        </div>
        <h3 class="pod-empty__title">Yuklab bo'lmadi</h3>
        <p class="pod-empty__text">${escapeHtml(state.error)}</p>
        <button class="pod-btn" type="button" data-pod-retry>Qayta urinish</button>
      </div>
    `;
  }

  function buildChannelDetail() {
    const ch = findChannel(state.currentChannelId);
    if (!ch) {
      return `
        <div class="pod-empty">
          <h3 class="pod-empty__title">Kanal topilmadi</h3>
          <button class="pod-btn" type="button" data-pod-back>Ortga</button>
        </div>
      `;
    }
    const videos = ch.videos || [];
    return `
      <div class="pod-channel">
        <div class="pod-channel__hero">
          ${ch.avatar ? `<div class="pod-channel__bg" style="background-image:url('${escapeHtml(ch.avatar)}')"></div>` : ""}
          <div class="pod-channel__bg-overlay"></div>
          <div class="pod-channel__info">
            ${avatarHtml(ch, "channel")}
            <div class="pod-channel__meta">
              <h1 class="pod-channel__name">${escapeHtml(ch.name)}</h1>
              ${ch.handle ? `<div class="pod-channel__handle">@${escapeHtml(ch.handle)}</div>` : ""}
              <div class="pod-channel__stats">
                <span>${videos.length} ta epizod</span>
                ${ch.category ? `<span class="pod-channel__sep">•</span><span>${escapeHtml(ch.category)}</span>` : ""}
              </div>
              ${ch.description ? `<p class="pod-channel__desc">${escapeHtml(ch.description)}</p>` : ""}
              ${ch.url ? `<a class="pod-channel__yt" href="${escapeHtml(ch.url)}" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>
                <span>YouTube'da ochish</span>
              </a>` : ""}
            </div>
          </div>
        </div>
        <section class="pod-section pod-section--detail">
          <header class="pod-section__head">
            <h2 class="pod-section__title">Epizodlar</h2>
          </header>
          ${videos.length ? `
            <div class="pod-episodes">
              ${videos.map((v) => `
                <article class="pod-ep-row" data-pod-play="${escapeHtml(v.videoId)}" data-pod-channel-of="${escapeHtml(ch.id)}">
                  <div class="pod-ep__thumb"><img src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>
                  <div class="pod-ep__body">
                    <h3 class="pod-ep__title">${escapeHtml(v.title)}</h3>
                    <div class="pod-ep__meta">
                      <span>${escapeHtml(timeAgo(v.published))}</span>
                    </div>
                  </div>
                  <button class="pod-ep__play" type="button" aria-label="O'ynash">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>
                  </button>
                </article>
              `).join("")}
            </div>
          ` : `<div class="pod-empty-mini">Bu kanalda hali epizodlar yo'q</div>`}
        </section>
      </div>
    `;
  }

  function buildPlayerOverlay() {
    if (!state.playingVideoId) return "";
    return `
      <div class="pod-player" id="podPlayer" role="dialog" aria-modal="true" aria-label="Video pleyer">
        <button class="pod-player__close" type="button" data-pod-close-player aria-label="Yopish">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
        </button>
        <div class="pod-player__frame">
          <div id="podYtPlayer"></div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!podcastsRoot) return;
    if (state.view === "channel") {
      podcastsRoot.innerHTML = `
        ${buildTopBar()}
        ${buildChannelDetail()}
        ${buildPlayerOverlay()}
      `;
      wireEvents();
      mountPlayer();
      return;
    }

    let body = "";
    if (state.loading && !state.channels.length) {
      body = buildLoading();
    } else if (state.error && !state.channels.length) {
      body = buildErrorState();
    } else if (!state.channels.length) {
      body = buildEmptyState();
    } else {
      const filtered = filteredChannels();
      body = `
        ${buildHero(filtered)}
        ${buildCategoriesRow()}
        ${filtered.length ? buildChannelsGrid(filtered) + buildLatestEpisodes(filtered)
          : `<div class="pod-empty-mini">Bu kategoriya bo'yicha kanal topilmadi</div>`}
      `;
    }

    podcastsRoot.innerHTML = `
      ${buildTopBar()}
      ${body}
      ${buildPlayerOverlay()}
    `;
    wireEvents();
    wireHero();
    mountPlayer();
  }

  function wireEvents() {
    podcastsRoot.querySelectorAll("[data-pod-back]").forEach((el) => {
      el.addEventListener("click", () => {
        haptic("light");
        state.view = "list";
        state.currentChannelId = "";
        render();
      });
    });

    podcastsRoot.querySelectorAll("[data-pod-retry]").forEach((el) => {
      el.addEventListener("click", () => loadChannels());
    });

    podcastsRoot.querySelectorAll("[data-pod-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = btn.dataset.podCat;
        if (c === state.category) return;
        state.category = c;
        haptic("light");
        render();
      });
    });

    const search = podcastsRoot.querySelector("#podSearchInput");
    if (search) {
      search.value = state.query;
      let t = null;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          state.query = search.value || "";
          render();
          const ns = podcastsRoot.querySelector("#podSearchInput");
          if (ns) { ns.focus(); ns.setSelectionRange(ns.value.length, ns.value.length); }
        }, 220);
      });
    }

    podcastsRoot.querySelectorAll("[data-pod-channel]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.podChannel;
        if (!id) return;
        haptic("light");
        state.view = "channel";
        state.currentChannelId = id;
        document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "instant" });
        render();
      });
    });

    podcastsRoot.querySelectorAll("[data-pod-play]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const videoId = el.dataset.podPlay;
        if (!videoId) return;
        haptic("medium");
        openPlayer(videoId);
      });
    });

    podcastsRoot.querySelectorAll("[data-pod-close-player]").forEach((el) => {
      el.addEventListener("click", closePlayer);
    });
  }

  function wireHero() {
    const track = podcastsRoot.querySelector("#podHeroTrack");
    const dots = podcastsRoot.querySelectorAll("[data-pod-dot]");
    if (!track || !dots.length) return;
    const updateDot = () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, idx) => d.classList.toggle("is-active", idx === i));
    };
    track.addEventListener("scroll", () => { requestAnimationFrame(updateDot); }, { passive: true });
    dots.forEach((d, i) => {
      d.addEventListener("click", () => {
        track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
      });
    });
  }

  function openPlayer(videoId) {
    state.playingVideoId = videoId;
    // Faqat pleyer qismini qayta render qilamiz, ro'yxat hech qachon yo'qolmaydi
    document.getElementById("podPlayer")?.remove();
    podcastsRoot.insertAdjacentHTML("beforeend", buildPlayerOverlay());
    document.body.classList.add("is-pod-player");
    podcastsRoot.querySelector("[data-pod-close-player]")?.addEventListener("click", closePlayer);
    mountPlayer();
  }

  function destroyYtPlayer() {
    if (ytPlayer) {
      try { ytPlayer.destroy?.(); } catch (_) {}
    }
    ytPlayer = null;
    ytReady = false;
  }

  function closePlayer() {
    state.playingVideoId = "";
    document.body.classList.remove("is-pod-player");
    destroyYtPlayer();
    document.getElementById("podPlayer")?.remove();
  }

  function showPlayerFallback(videoId) {
    const frame = document.querySelector("#podPlayer .pod-player__frame");
    if (!frame) return;
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    frame.innerHTML = `
      <div class="pod-player__fallback">
        <p>Bu videoni ilova ichida ochib bo'lmadi.<br>Kanal egasi uni tashqi saytda ko'rsatishni cheklagan bo'lishi mumkin.</p>
        <a class="pod-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">YouTube'da ochish</a>
      </div>`;
  }

  function mountPlayer() {
    if (!state.playingVideoId) return;
    const videoId = state.playingVideoId;
    const slot = document.getElementById("podYtPlayer");
    if (!slot) return;
    // Har safar yangi pleyer yaratamiz — eski iframe overlay bilan birga
    // olib tashlangani uchun eski ytPlayer obyekti o'lik bo'lib qoladi.
    destroyYtPlayer();
    try {
      if (typeof window.ensureYouTubeApi === "function") window.ensureYouTubeApi();
    } catch (_) {}
    const tryInit = () => {
      if (state.playingVideoId !== videoId) return;          // boshqa video ochildi
      if (!document.getElementById("podYtPlayer")) return;   // pleyer yopildi
      if (!window.YT?.Player) { setTimeout(tryInit, 200); return; }
      try {
        ytPlayer = new YT.Player("podYtPlayer", {
          host: "https://www.youtube-nocookie.com",
          height: "100%",
          width: "100%",
          videoId,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => { ytReady = true; try { ytPlayer.playVideo(); } catch (_) {} },
            onError: () => { showPlayerFallback(videoId); },
          },
        });
      } catch (_) {
        showPlayerFallback(videoId);
      }
    };
    tryInit();
  }

  function openPodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
    if (!state.initialized) {
      state.initialized = true;
      loadChannels();
    } else {
      render();
    }
  }

  function closePodcastsView() {
    if (!podcastsView) return;
    closePlayer();
    podcastsView.hidden = true;
    document.body.classList.remove("is-podcasts");
  }

  window.__potcasts = { openPodcastsView, closePodcastsView, reload: loadChannels };
})();
