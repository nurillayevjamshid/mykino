// Potkastlar moduli — beta, mock data bilan vizual shell.
// Real audio integratsiyasi qo'shilganda data manbalari almashtiriladi.
// Tashqariga: window.__potcasts = { openPodcastsView, closePodcastsView }
(function () {
  "use strict";

  const podcastsView = document.getElementById("podcastsView");
  const podcastsRoot = document.getElementById("podcastsRoot");

  const tg = window.Telegram?.WebApp;
  const haptic = (kind = "light") => {
    try { tg?.HapticFeedback?.impactOccurred?.(kind); } catch (_) {}
  };

  const CATEGORIES = [
    { id: "all", label: "Barchasi" },
    { id: "suhbat", label: "Suhbat" },
    { id: "biznes", label: "Biznes" },
    { id: "tech", label: "Texnologiya" },
    { id: "madaniyat", label: "Madaniyat" },
    { id: "tarix", label: "Tarix" },
    { id: "sport", label: "Sport" },
    { id: "hayot", label: "Hayot" },
    { id: "yumor", label: "Yumor" },
  ];

  const FEATURED = [
    {
      id: "f1",
      title: "OYBEK SHOW",
      tagline: "Mehmonlar bilan jonli suhbat — har juma kechqurun",
      ep: "Yangi epizod: \"O'zbekiston IT bozori\"",
      cov: "g1",
      mono: "O",
    },
    {
      id: "f2",
      title: "Texnokratlar",
      tagline: "Texnologiya, startaplar va kelajak",
      ep: "AI agentlar inson o'rnini bosadimi?",
      cov: "g2",
      mono: "T",
    },
    {
      id: "f3",
      title: "Bizneschilar",
      tagline: "Tadbirkorlar haqiqiy hikoyalari",
      ep: "0 dan milliongacha: 7 yilda",
      cov: "g3",
      mono: "B",
    },
  ];

  const SHOWS = [
    { id: "s1", name: "OYBEK SHOW", host: "Oybek Mamatkulov", cat: "suhbat", cov: "g1", mono: "O" },
    { id: "s2", name: "Texnokratlar", host: "Sardor Allayarov", cat: "tech", cov: "g2", mono: "T" },
    { id: "s3", name: "Bizneschilar", host: "Hasan Ravshanov", cat: "biznes", cov: "g3", mono: "B" },
    { id: "s4", name: "Madaniyat soati", host: "Nodira Karimova", cat: "madaniyat", cov: "g4", mono: "M" },
    { id: "s5", name: "Tarixning sirlari", host: "Bahodir Eshonov", cat: "tarix", cov: "g5", mono: "T" },
    { id: "s6", name: "Sport Live", host: "Akmal Yusupov", cat: "sport", cov: "g6", mono: "S" },
    { id: "s7", name: "Hayot darslari", host: "Dilshoda Rasulova", cat: "hayot", cov: "g7", mono: "H" },
    { id: "s8", name: "Yumor Time", host: "Komediya jamoasi", cat: "yumor", cov: "g8", mono: "Y" },
    { id: "s9", name: "Faylasuflar", host: "Jamshid Tursunov", cat: "suhbat", cov: "g9", mono: "F" },
    { id: "s10", name: "Startup Kitchen", host: "Anvar Qodirov", cat: "biznes", cov: "g10", mono: "S" },
  ];

  const EPISODES = [
    { id: "e1", title: "AI agentlar inson o'rnini bosadimi?", showId: "s2", dur: "48 daq", when: "Bugun", isNew: true, dot: 0.18 },
    { id: "e2", title: "O'zbekiston IT bozori — 2026", showId: "s1", dur: "1 soat 12 daq", when: "Kecha", isNew: true, dot: 0.62 },
    { id: "e3", title: "0 dan milliongacha: 7 yilda", showId: "s3", dur: "54 daq", when: "2 kun oldin", isNew: false, dot: 0 },
    { id: "e4", title: "Amir Temur strategiyalari", showId: "s5", dur: "1 soat 04 daq", when: "3 kun oldin", isNew: false, dot: 0.85 },
    { id: "e5", title: "Stress va miya — neyrolog bilan", showId: "s7", dur: "42 daq", when: "4 kun oldin", isNew: false, dot: 0 },
    { id: "e6", title: "El-yurt ovozi: zamonaviy musiqa", showId: "s4", dur: "37 daq", when: "5 kun oldin", isNew: false, dot: 0 },
    { id: "e7", title: "Premyer-liga: tahlil va prognoz", showId: "s6", dur: "29 daq", when: "1 hafta oldin", isNew: false, dot: 0 },
    { id: "e8", title: "Stand-up: tunes hayot", showId: "s8", dur: "33 daq", when: "1 hafta oldin", isNew: false, dot: 0 },
  ];

  const showById = (id) => SHOWS.find((s) => s.id === id);

  let currentCategory = "all";
  let currentQuery = "";
  let rendered = false;
  let toastTimer = null;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function coverHtml(cov, mono, size = "md") {
    return `<div class="pod-cov pod-cov--${size} pod-cov--${cov}"><span>${escapeHtml(mono)}</span></div>`;
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

  function buildHero() {
    const cards = FEATURED.map((f) => `
      <article class="pod-hero-card pod-hero-card--${f.cov}" data-pod-play="${escapeHtml(f.id)}">
        <div class="pod-hero-card__bg"></div>
        <div class="pod-hero-card__glow"></div>
        <div class="pod-hero-card__body">
          <span class="pod-hero-card__badge">★ Tavsiya</span>
          <h3 class="pod-hero-card__title">${escapeHtml(f.title)}</h3>
          <p class="pod-hero-card__tagline">${escapeHtml(f.tagline)}</p>
          <div class="pod-hero-card__ep">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
            <span>${escapeHtml(f.ep)}</span>
          </div>
        </div>
        <div class="pod-hero-card__mono">${escapeHtml(f.mono)}</div>
      </article>
    `).join("");
    return `
      <div class="pod-hero">
        <div class="pod-hero__track" id="podHeroTrack">${cards}</div>
        <div class="pod-hero__dots" id="podHeroDots">
          ${FEATURED.map((_, i) => `<span class="pod-hero__dot ${i === 0 ? "is-active" : ""}" data-pod-dot="${i}"></span>`).join("")}
        </div>
      </div>
    `;
  }

  function buildCategories() {
    return `
      <div class="pod-categories" id="podCategories">
        ${CATEGORIES.map((c) => `
          <button class="pod-chip ${c.id === currentCategory ? "is-active" : ""}" type="button" data-pod-cat="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>
        `).join("")}
      </div>
    `;
  }

  function buildShowsRow() {
    const list = SHOWS.filter((s) => currentCategory === "all" || s.cat === currentCategory);
    if (!list.length) return "";
    return `
      <section class="pod-section">
        <header class="pod-section__head">
          <h2 class="pod-section__title">Mashhur potkastlar</h2>
          <button class="pod-section__more" type="button" data-pod-more="shows">Hammasi</button>
        </header>
        <div class="pod-shows" id="podShowsRow">
          ${list.map((s) => `
            <button class="pod-show-card" type="button" data-pod-show="${escapeHtml(s.id)}">
              ${coverHtml(s.cov, s.mono, "lg")}
              <div class="pod-show-card__name">${escapeHtml(s.name)}</div>
              <div class="pod-show-card__host">${escapeHtml(s.host)}</div>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }

  function buildEpisodesList() {
    const cat = currentCategory;
    const q = currentQuery.trim().toLowerCase();
    const list = EPISODES.filter((e) => {
      const sh = showById(e.showId);
      if (!sh) return false;
      if (cat !== "all" && sh.cat !== cat) return false;
      if (q) {
        const hay = `${e.title} ${sh.name} ${sh.host}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (!list.length) {
      return `
        <section class="pod-section">
          <header class="pod-section__head">
            <h2 class="pod-section__title">Yangi epizodlar</h2>
          </header>
          <div class="pod-empty-mini">Bu kategoriya bo'yicha epizodlar topilmadi</div>
        </section>
      `;
    }
    return `
      <section class="pod-section">
        <header class="pod-section__head">
          <h2 class="pod-section__title">Yangi epizodlar</h2>
          <button class="pod-section__more" type="button" data-pod-more="episodes">Hammasi</button>
        </header>
        <div class="pod-episodes">
          ${list.map((e) => {
            const sh = showById(e.showId);
            const progress = e.dot && e.dot > 0 ? `<div class="pod-ep__progress"><span style="width:${Math.round(e.dot * 100)}%"></span></div>` : "";
            const newBadge = e.isNew ? `<span class="pod-ep__new">YANGI</span>` : "";
            return `
              <article class="pod-ep-row" data-pod-play="${escapeHtml(e.id)}">
                ${coverHtml(sh.cov, sh.mono, "sm")}
                <div class="pod-ep__body">
                  <div class="pod-ep__top">
                    ${newBadge}
                    <span class="pod-ep__show">${escapeHtml(sh.name)}</span>
                  </div>
                  <h3 class="pod-ep__title">${escapeHtml(e.title)}</h3>
                  <div class="pod-ep__meta">
                    <span>${escapeHtml(e.when)}</span>
                    <span class="pod-ep__sep">•</span>
                    <span>${escapeHtml(e.dur)}</span>
                  </div>
                  ${progress}
                </div>
                <button class="pod-ep__play" type="button" aria-label="O'ynash">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4"></polygon></svg>
                </button>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function buildTopBar() {
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
          <input type="search" id="podSearchInput" placeholder="Potkast yoki epizod izlash..." autocomplete="off" />
        </div>
      </header>
    `;
  }

  function renderAll() {
    if (!podcastsRoot) return;
    podcastsRoot.innerHTML = `
      ${buildTopBar()}
      ${buildHero()}
      ${buildCategories()}
      ${buildShowsRow()}
      ${buildEpisodesList()}
      <div class="pod-foot">Bo'lim beta versiyada — yaqin orada real audio epizodlar qo'shiladi</div>
    `;
    wireEvents();
    wireHero();
  }

  function rerenderBody() {
    const head = podcastsRoot.querySelector(".pod-topbar");
    const hero = podcastsRoot.querySelector(".pod-hero");
    const oldChips = podcastsRoot.querySelector(".pod-categories");
    const restHtml = `${buildShowsRow()}${buildEpisodesList()}<div class="pod-foot">Bo'lim beta versiyada — yaqin orada real audio epizodlar qo'shiladi</div>`;
    podcastsRoot.innerHTML = "";
    if (head) podcastsRoot.appendChild(head);
    if (hero) podcastsRoot.appendChild(hero);
    const chipsWrap = document.createElement("div");
    chipsWrap.innerHTML = buildCategories();
    podcastsRoot.appendChild(chipsWrap.firstElementChild);
    const restWrap = document.createElement("div");
    restWrap.innerHTML = restHtml;
    while (restWrap.firstChild) podcastsRoot.appendChild(restWrap.firstChild);
    wireEvents();
  }

  function wireEvents() {
    podcastsRoot.querySelectorAll("[data-pod-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.podCat;
        if (id === currentCategory) return;
        currentCategory = id;
        haptic("light");
        rerenderBody();
      });
    });

    const search = podcastsRoot.querySelector("#podSearchInput");
    if (search) {
      search.value = currentQuery;
      let t = null;
      search.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => {
          currentQuery = search.value || "";
          const old = podcastsRoot.querySelector(".pod-episodes")?.closest(".pod-section");
          const emptyOld = podcastsRoot.querySelector(".pod-empty-mini")?.closest(".pod-section");
          const newHtml = buildEpisodesList();
          const wrap = document.createElement("div");
          wrap.innerHTML = newHtml;
          if (old) old.replaceWith(wrap.firstElementChild);
          else if (emptyOld) emptyOld.replaceWith(wrap.firstElementChild);
          else podcastsRoot.appendChild(wrap.firstElementChild);
          wireEvents();
        }, 180);
      });
    }

    podcastsRoot.querySelectorAll("[data-pod-play], [data-pod-show], [data-pod-more]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-pod-cat]")) return;
        haptic("light");
        showToast("Tez orada o'ynash imkoniyati qo'shiladi");
      });
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
    track.addEventListener("scroll", () => {
      requestAnimationFrame(updateDot);
    }, { passive: true });
    dots.forEach((d, i) => {
      d.addEventListener("click", () => {
        track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
      });
    });
  }

  function openPodcastsView() {
    if (!podcastsView) return;
    if (!rendered) {
      renderAll();
      rendered = true;
    }
    podcastsView.hidden = false;
    document.body.classList.add("is-podcasts");
    document.getElementById("appShell")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closePodcastsView() {
    if (!podcastsView) return;
    podcastsView.hidden = true;
    document.body.classList.remove("is-podcasts");
  }

  window.__potcasts = { openPodcastsView, closePodcastsView };
})();
