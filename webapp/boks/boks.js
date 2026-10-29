/* ==========================================================================
   BOKS BO'LIMI — NTV × O'zbekiston Boks Federatsiyasi hamkorligi

   Naqsh esport/esport.js bilan bir xil:
   - Lazy-load: kino.js dagi ensureBoksModule() yuklaydi.
   - Tashqi interfeys: window.__boks = { openBoksView, closeBoksView }.
   - Ko'rinish #boksView (index.html) ichiga to'liq JS bilan chiziladi.

   Kontent manbai: /static/boks/boks.json (federatsiya bergan ma'lumot shu
   faylga yoziladi — efir, videolar, yangiliklar, turnirlar, terma jamoa).
   Bo'sh ro'yxatlar uchun "tez orada" holati ko'rsatiladi.
   ========================================================================== */
(function initBoksModule() {
  "use strict";

  var boksView = document.getElementById("boksView");
  if (!boksView) return;

  var DATA_URL = "/static/boks/boks.json";
  var MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

  var TABS = [
    { key: "live", label: "Efir" },
    { key: "news", label: "Yangiliklar" },
    { key: "events", label: "Turnirlar" },
    { key: "team", label: "Terma jamoa" }
  ];

  var ICON_GLOVE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 15.5V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3.5"></path>' +
    '<path d="M8 15.5h9"></path>' +
    '<path d="M17 15.5c1.8-.9 3-2.8 3-5V8a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v1"></path>' +
    '<path d="M8 15.5c-1.8-.6-3-2.2-3-4.2A2.3 2.3 0 0 1 7.3 9H10a2 2 0 0 1 0 4H8"></path>' +
    "</svg>";
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7V5Z"/></svg>';

  var state = {
    tab: "live",
    data: null,
    loading: false,
    playingId: null
  };

  /* ---------------------------------------------------------------
     Yordamchilar
     --------------------------------------------------------------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeUrl(url) {
    var raw = String(url || "").trim();
    return /^https?:\/\//i.test(raw) ? raw : "";
  }

  function extractYoutubeId(input) {
    var raw = String(input || "").trim();
    if (!raw) return "";
    if (/^[\w-]{10,12}$/.test(raw)) return raw;
    var patterns = [
      /youtu\.be\/([\w-]{10,12})/,
      /youtube\.com\/watch\?v=([\w-]{10,12})/,
      /youtube\.com\/embed\/([\w-]{10,12})/,
      /youtube\.com\/shorts\/([\w-]{10,12})/,
      /youtube\.com\/live\/([\w-]{10,12})/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = raw.match(patterns[i]);
      if (m && m[1]) return m[1];
    }
    return "";
  }

  function thumbUrl(ytId) {
    return ytId ? "https://i.ytimg.com/vi/" + encodeURIComponent(ytId) + "/hqdefault.jpg" : "";
  }

  // "2026-11-04" -> Date (mahalliy vaqt, UTC siljishisiz)
  function parseDay(value) {
    var m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function formatDay(value) {
    var d = parseDay(value);
    if (!d) return String(value || "");
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function eventStatus(ev) {
    var from = parseDay(ev.dateFrom || ev.date);
    var to = parseDay(ev.dateTo) || from;
    if (!from) return "soon";
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < from) return "soon";
    if (today > to) return "done";
    return "live";
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join("");
  }

  function openExternal(url) {
    var href = safeUrl(url);
    if (!href) return;
    var tg = window.Telegram && window.Telegram.WebApp;
    try {
      if (/^https:\/\/t\.me\//i.test(href) && tg && typeof tg.openTelegramLink === "function") {
        tg.openTelegramLink(href);
        return;
      }
      if (tg && typeof tg.openLink === "function") {
        tg.openLink(href);
        return;
      }
    } catch (_) {}
    window.open(href, "_blank", "noopener");
  }

  function empty(title, text) {
    return (
      '<div class="boks-empty">' +
      '<span class="boks-empty__icon">' + ICON_GLOVE + "</span>" +
      '<p class="boks-empty__title">' + esc(title) + "</p>" +
      '<p class="boks-empty__text">' + esc(text) + "</p>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------
     Chizish
     --------------------------------------------------------------- */
  function renderShell() {
    var tabs = TABS.map(function (tab) {
      var active = tab.key === state.tab;
      return (
        '<button class="boks-tab' + (active ? " is-active" : "") + '" type="button" role="tab"' +
        ' data-boks-tab="' + tab.key + '" aria-selected="' + active + '">' + esc(tab.label) + "</button>"
      );
    }).join("");

    boksView.innerHTML =
      '<header class="boks-hero" id="boksHero"></header>' +
      '<nav class="boks-tabs" role="tablist" aria-label="Boks bo\'limlari">' + tabs + "</nav>" +
      '<div class="boks-panel" id="boksPanel" role="tabpanel"></div>' +
      '<div class="boks-view__spacer"></div>';
  }

  function renderHero() {
    var hero = document.getElementById("boksHero");
    if (!hero) return;
    var data = state.data || {};
    var partner = data.partner || {};
    var name = partner.name || "O'zbekiston Boks Federatsiyasi";
    var logo = String(partner.logo || "").trim();
    var mark = logo
      ? '<img class="boks-collab__logo" src="' + esc(logo) + '" alt="' + esc(name) + '">'
      : '<span class="boks-collab__glove">' + ICON_GLOVE + "</span>";

    var stats = list(data.stats).map(function (s) {
      return (
        '<div class="boks-stat">' +
        '<span class="boks-stat__value">' + esc(s.value) + "</span>" +
        '<span class="boks-stat__label">' + esc(s.label) + "</span>" +
        "</div>"
      );
    }).join("");

    var isLive = Boolean(data.stream && data.stream.isLive && extractYoutubeId(data.stream.youtubeId || data.stream.url));

    hero.innerHTML =
      '<div class="boks-collab" aria-label="NTV × ' + esc(name) + '">' +
      '<span class="boks-collab__ntv">NTV</span>' +
      '<span class="boks-collab__x" aria-hidden="true">×</span>' +
      mark +
      '<span class="boks-collab__name">' + esc(name) + "</span>" +
      "</div>" +
      '<div class="boks-hero__row">' +
      '<h2 class="boks-hero__title">Boks</h2>' +
      (isLive ? '<span class="boks-live-pill"><span class="boks-live-pill__dot"></span>Jonli</span>' : "") +
      "</div>" +
      (partner.about ? '<p class="boks-hero__about">' + esc(partner.about) + "</p>" : "") +
      (stats ? '<div class="boks-stats">' + stats + "</div>" : "");
  }

  function renderLive() {
    var data = state.data || {};
    var stream = data.stream || {};
    var ytId = extractYoutubeId(stream.youtubeId || stream.url);
    var frame;

    if (!ytId) {
      frame =
        '<div class="boks-stream__empty">' +
        '<span class="boks-empty__icon">' + ICON_GLOVE + "</span>" +
        '<p class="boks-empty__title">Hozircha efir yo\'q</p>' +
        '<p class="boks-empty__text">Terma jamoa janglari jonli efirda shu yerda ko\'rsatiladi.</p>' +
        "</div>";
    } else if (state.playingId === ytId && typeof window.__playYouTubeStandalone !== "function") {
      frame =
        '<iframe src="https://www.youtube.com/embed/' + esc(ytId) + '?rel=0&playsinline=1&autoplay=1"' +
        ' title="' + esc(stream.title || "Jonli efir") + '"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
        " allowfullscreen></iframe>";
    } else {
      frame =
        '<button class="boks-stream__preview" type="button" data-boks-play="' + esc(ytId) + '"' +
        ' data-boks-title="' + esc(stream.title || "Jonli efir") + '" aria-label="Efirni tomosha qilish">' +
        '<img src="' + thumbUrl(ytId) + '" alt="" loading="lazy">' +
        '<span class="boks-stream__play">' + ICON_PLAY + "</span>" +
        "</button>" +
        (stream.isLive ? '<span class="boks-stream__badge"><span class="boks-live-pill__dot"></span>LIVE</span>' : "");
    }

    var meta = ytId
      ? '<div class="boks-stream__meta">' +
        '<p class="boks-stream__title">' + esc(stream.title || "Jonli efir") + "</p>" +
        (stream.subtitle ? '<p class="boks-stream__sub">' + esc(stream.subtitle) + "</p>" : "") +
        "</div>"
      : "";

    var videos = list(data.videos).map(function (v) {
      var id = extractYoutubeId(v.youtubeId || v.url);
      if (!id) return "";
      return (
        '<button class="boks-video" type="button" data-boks-play="' + esc(id) + '" data-boks-title="' + esc(v.title) + '">' +
        '<span class="boks-video__thumb"><img src="' + thumbUrl(id) + '" alt="" loading="lazy">' +
        '<span class="boks-video__play">' + ICON_PLAY + "</span></span>" +
        '<span class="boks-video__body">' +
        '<span class="boks-video__title">' + esc(v.title) + "</span>" +
        (v.subtitle || v.date
          ? '<span class="boks-video__meta">' + esc([v.subtitle, v.date ? formatDay(v.date) : ""].filter(Boolean).join(" · ")) + "</span>"
          : "") +
        "</span>" +
        "</button>"
      );
    }).join("");

    return (
      '<div class="boks-stream">' +
      '<div class="boks-stream__frame">' + frame + "</div>" +
      meta +
      "</div>" +
      '<h3 class="boks-section-title">Janglardan videolar</h3>' +
      (videos ? '<div class="boks-videos">' + videos + "</div>" : empty("Videolar tez orada", "Terma jamoa janglarining eng yaxshi lavhalari shu yerda paydo bo'ladi."))
    );
  }

  function renderNews() {
    var items = list((state.data || {}).news).slice().sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    if (!items.length) {
      return empty("Yangiliklar tez orada", "Federatsiyaning rasmiy yangiliklari shu yerda e'lon qilinadi.");
    }
    return '<div class="boks-news">' + items.map(function (n) {
      var url = safeUrl(n.url);
      var img = safeUrl(n.image);
      return (
        '<article class="boks-news__card">' +
        (img ? '<img class="boks-news__img" src="' + esc(img) + '" alt="" loading="lazy">' : "") +
        '<div class="boks-news__body">' +
        (n.date ? '<time class="boks-news__date">' + esc(formatDay(n.date)) + "</time>" : "") +
        '<h4 class="boks-news__title">' + esc(n.title) + "</h4>" +
        (n.text ? '<p class="boks-news__text">' + esc(n.text) + "</p>" : "") +
        (url ? '<button class="boks-link" type="button" data-boks-link="' + esc(url) + '">Batafsil</button>' : "") +
        "</div>" +
        "</article>"
      );
    }).join("") + "</div>";
  }

  function renderEvents() {
    // Avval davom etayotgan/kutilayotganlar (yaqinidan), so'ng yakunlanganlar (yangisidan)
    var items = list((state.data || {}).events).slice().sort(function (a, b) {
      var aDone = eventStatus(a) === "done";
      var bDone = eventStatus(b) === "done";
      if (aDone !== bDone) return aDone ? 1 : -1;
      var cmp = String(a.dateFrom || a.date || "").localeCompare(String(b.dateFrom || b.date || ""));
      return aDone ? -cmp : cmp;
    });
    if (!items.length) {
      return empty("Turnirlar taqvimi tez orada", "Terma jamoa ishtirok etadigan musobaqalar shu yerda ko'rinadi.");
    }
    var LABELS = { live: "Davom etmoqda", soon: "Kutilmoqda", done: "Yakunlangan" };
    return '<div class="boks-events">' + items.map(function (ev) {
      var from = parseDay(ev.dateFrom || ev.date);
      var status = eventStatus(ev);
      var range = ev.dateTo && ev.dateTo !== ev.dateFrom
        ? formatDay(ev.dateFrom || ev.date) + " — " + formatDay(ev.dateTo)
        : formatDay(ev.dateFrom || ev.date);
      var url = safeUrl(ev.url);
      return (
        '<article class="boks-event boks-event--' + status + '">' +
        '<div class="boks-event__date">' +
        '<span class="boks-event__day">' + (from ? from.getDate() : "—") + "</span>" +
        '<span class="boks-event__month">' + (from ? MONTHS[from.getMonth()] : "") + "</span>" +
        "</div>" +
        '<div class="boks-event__body">' +
        '<h4 class="boks-event__name">' + esc(ev.name) + "</h4>" +
        '<p class="boks-event__meta">' + esc([ev.city, range].filter(Boolean).join(" · ")) + "</p>" +
        '<span class="boks-event__status">' + LABELS[status] + "</span>" +
        "</div>" +
        (url ? '<button class="boks-link boks-event__link" type="button" data-boks-link="' + esc(url) + '">Batafsil</button>' : "") +
        "</article>"
      );
    }).join("") + "</div>";
  }

  function renderTeam() {
    var items = list((state.data || {}).team);
    if (!items.length) {
      return empty("Terma jamoa tarkibi tez orada", "Bokschilar ro'yxati federatsiya bilan kelishilgach qo'shiladi.");
    }
    return '<div class="boks-team">' + items.map(function (b) {
      var photo = String(b.photo || "").trim();
      var titles = list(b.titles).map(function (t) {
        return '<li class="boks-boxer__title">' + esc(t) + "</li>";
      }).join("");
      return (
        '<article class="boks-boxer">' +
        '<div class="boks-boxer__avatar">' +
        (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy">' : "<span>" + esc(initials(b.name)) + "</span>") +
        "</div>" +
        '<div class="boks-boxer__body">' +
        '<h4 class="boks-boxer__name">' + esc(b.name) + "</h4>" +
        (b.weight ? '<span class="boks-boxer__weight">' + esc(b.weight) + "</span>" : "") +
        (titles ? '<ul class="boks-boxer__titles">' + titles + "</ul>" : "") +
        "</div>" +
        "</article>"
      );
    }).join("") + "</div>";
  }

  function renderLinks() {
    var links = list(((state.data || {}).partner || {}).links).filter(function (l) { return safeUrl(l.url); });
    if (!links.length) return "";
    return (
      '<div class="boks-partner-links">' +
      links.map(function (l) {
        return '<button class="boks-chip" type="button" data-boks-link="' + esc(l.url) + '">' + esc(l.label || l.url) + "</button>";
      }).join("") +
      "</div>"
    );
  }

  function renderPanel() {
    var panel = document.getElementById("boksPanel");
    if (!panel) return;
    if (!state.data) {
      panel.innerHTML = '<div class="boks-loading" aria-label="Yuklanmoqda"><span></span><span></span><span></span></div>';
      return;
    }
    var html = state.tab === "news" ? renderNews()
      : state.tab === "events" ? renderEvents()
      : state.tab === "team" ? renderTeam()
      : renderLive();
    panel.innerHTML = html + renderLinks();
  }

  function renderAll() {
    renderHero();
    renderPanel();
  }

  function setTab(key) {
    if (!TABS.some(function (t) { return t.key === key; }) || key === state.tab) return;
    state.tab = key;
    boksView.querySelectorAll(".boks-tab").forEach(function (btn) {
      var active = btn.dataset.boksTab === key;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    renderPanel();
  }

  function play(ytId, title) {
    if (!ytId) return;
    if (typeof window.__playYouTubeStandalone === "function") {
      try { window.__playYouTubeStandalone(ytId, { title: title || "Boks" }); } catch (_) {}
      return;
    }
    // Brauzer fallback: efir bo'lsa ramkada, video bo'lsa YouTube'da ochiladi
    var stream = (state.data && state.data.stream) || {};
    if (extractYoutubeId(stream.youtubeId || stream.url) === ytId) {
      state.playingId = ytId;
      renderPanel();
      return;
    }
    openExternal("https://www.youtube.com/watch?v=" + encodeURIComponent(ytId));
  }

  /* ---------------------------------------------------------------
     Ma'lumot
     --------------------------------------------------------------- */
  function loadData() {
    if (state.loading) return;
    state.loading = true;
    // 10 daqiqalik "bucket" — JSON yangilansa, kesh uzog'i bilan 10 daqiqada yangilanadi
    var bucket = Math.floor(Date.now() / 600000);
    fetch(DATA_URL + "?t=" + bucket, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) { state.data = json && typeof json === "object" ? json : {}; })
      .catch(function () { if (!state.data) state.data = {}; })
      .then(function () {
        state.loading = false;
        if (!boksView.hidden) renderAll();
      });
  }

  boksView.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-boks-tab]");
    if (tab) {
      setTab(tab.dataset.boksTab);
      return;
    }
    var playBtn = e.target.closest("[data-boks-play]");
    if (playBtn) {
      play(playBtn.dataset.boksPlay, playBtn.dataset.boksTitle);
      return;
    }
    var link = e.target.closest("[data-boks-link]");
    if (link) openExternal(link.dataset.boksLink);
  });

  /* ---------------------------------------------------------------
     Tashqi interfeys
     --------------------------------------------------------------- */
  function openBoksView() {
    if (!boksView.firstChild) renderShell();
    boksView.hidden = false;
    document.body.classList.add("is-boks");
    renderAll();

    var shell = document.getElementById("appShell");
    if (shell) shell.scrollTo({ top: 0, behavior: "smooth" });

    try { window.tgBackRegister?.("boks", function () { closeBoksView(); }); } catch (_) {}
    loadData();
  }

  function closeBoksView() {
    var wasOpen = !boksView.hidden;
    boksView.hidden = true;
    document.body.classList.remove("is-boks");
    try { window.tgBackUnregister?.("boks"); } catch (_) {}
    if (state.playingId) {
      state.playingId = null;
      renderPanel();
    }
    if (!wasOpen) return;
    try { window.setFilter?.("all"); } catch (_) {}
    try { window.syncNavButtons?.(); } catch (_) {}
  }

  window.__boks = { openBoksView: openBoksView, closeBoksView: closeBoksView };
})();
