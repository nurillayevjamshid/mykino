/* ==========================================================================
   BOKS BO'LIMI — NTV × O'zbekiston Boks Federatsiyasi hamkorligi

   Naqsh esport/esport.js bilan bir xil:
   - Lazy-load: kino.js dagi ensureBoksModule() yuklaydi.
   - Tashqi interfeys: window.__boks = { openBoksView, closeBoksView }.
   - Ko'rinish #boksView (index.html) ichiga to'liq JS bilan chiziladi.

   Kontent manbalari:
     /api/boks               -> efir, terma jamoa, janglar videolari (Efir tabida, qidiruv bilan) (admin panelda boshqariladi;
                                videolar YouTube kanaldan, shorts va qisqa kliplarsiz; pin qilinganlar boshida)
     /api/boks?resource=news -> @boxinguzbekistan Telegram kanalidagi xabarlar
     /static/boks/boks.json  -> hamkor ma'lumoti va hero kartadagi raqamlar

   Uzun ro'yxatlar (janglar, yangiliklar) pastga cheksiz davom etadi: oxiriga yetganda
   keyingi qism serverdan olinib, mavjud kartalar qayta chizilmasdan oxiriga qo'shiladi.
   ========================================================================== */
(function initBoksModule() {
  "use strict";

  var boksView = document.getElementById("boksView");
  if (!boksView) return;

  var DATA_URL = "/static/boks/boks.json";
  // Header rasmi (boks.json -> banner; "" bo'lsa matnli hamkorlik kartasi chiqadi)
  var DEFAULT_BANNER = "/static/assets/boks-header.jpg";
  var API_URL = "/api/boks";
  var MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

  var TABS = [
    { key: "live", label: "Efir" },
    { key: "news", label: "Yangiliklar" },
    { key: "team", label: "Terma jamoa" }
  ];

  // Lentaga osilgan bir juft boks qo'lqopi (chiziqli) — sidebar, splash va admin bilan bir xil
  var ICON_GLOVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.3c-1-1.5-3-1.7-3-.6s2 1.3 3 .6Zm0 0c1-1.5 3-1.7 3-.6s-2 1.3-3 .6Zm0 0L8 7.2M12 3.3l4 3.9"></path><path d="M4.6 9.8V7.8c0-.4.2-.6.6-.6h4.4c.4 0 .6.2.6.6v2M4.6 9.8C2.4 10.7 1.6 13 1.7 15.6c.2 3.8 2.6 6.3 5.6 6.3 2.3 0 3.5-1.2 3.5-3.2v-6.4c0-1.2-.3-1.9-.6-2.4ZM19.4 9.8V7.8c0-.4-.2-.6-.6-.6h-4.4c-.4 0-.6.2-.6.6v2M19.4 9.8c2.2.9 3 3.2 2.9 5.8-.2 3.8-2.6 6.3-5.6 6.3-2.3 0-3.5-1.2-3.5-3.2v-6.4c0-1.2.3-1.9.6-2.4Z"></path><path d="M6.6 13.4c0 2 .9 3.3 2.4 3.7M17.4 13.4c0 2-.9 3.3-2.4 3.7"></path></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 12 7-12 7V5Z"/></svg>';
  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 3a1 1 0 0 1 .7 1.7L15 6.4v4.1l2.6 2.6A1 1 0 0 1 17 15h-4v5.5a1 1 0 0 1-2 0V15H7a1 1 0 0 1-.7-1.7L9 10.5V6.4L7.3 4.7A1 1 0 0 1 8 3h8Z"/></svg>';
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
  var ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var ICON_MEDAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="15" r="6"></circle><path d="M8.5 10 6 3h4l2 4 2-4h4l-2.5 7"></path></svg>';
  var ICON_TG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 13.1l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.5 2.9c.9-.3 1.6.2 1.4 1.4Z"/></svg>';

  function newList() {
    return { items: [], total: 0, nextOffset: null, loading: false, failed: false, seq: 0 };
  }

  var state = {
    tab: "live",
    base: null,          // boks.json
    api: null,           // /api/boks
    apiFailed: false,
    loading: false,
    playingId: null,
    query: "",
    // all — qidiruvsiz ro'yxat, search — qidiruv natijalari (ikkalasi ham Efir tabida)
    lists: { all: newList(), search: newList() },
    news: { posts: [], nextBefore: null, loaded: false, loading: false, failed: false }
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

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + " mln";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + " ming";
    return String(n);
  }

  function formatAgo(iso) {
    var t = Date.parse(iso || "");
    if (!t) return "";
    var diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 60) return "Hozirgina";
    if (diff < 3600) return Math.floor(diff / 60) + " daqiqa oldin";
    if (diff < 86400) return Math.floor(diff / 3600) + " soat oldin";
    if (diff < 172800) return "Kecha";
    var d = new Date(t);
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var sameYear = d.getFullYear() === new Date().getFullYear();
    return d.getDate() + " " + MONTHS[d.getMonth()] + (sameYear ? "" : " " + d.getFullYear()) + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function initials(name) {
    return String(name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) { return part.charAt(0).toUpperCase(); })
      .join("");
  }

  // Tezkor filtr tugmasi faolligini solishtirish uchun: kichik harf, tutuqlar bir xil.
  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[‘’ʻʼ`´]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (url) {
      return '<a href="' + url + '" data-boks-link="' + url + '">' + url + "</a>";
    }).replace(/\n/g, "<br>");
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

  function loader() {
    return '<div class="boks-loading" aria-label="Yuklanmoqda"><span></span><span></span><span></span></div>';
  }

  function stream() {
    var s = (state.api && state.api.stream) || {};
    return { id: extractYoutubeId(s.youtubeId || s.url), title: s.title, subtitle: s.subtitle, isLive: Boolean(s.isLive) };
  }

  function pinnedFights() {
    return list(state.api && state.api.pinned);
  }

  /* ---------------------------------------------------------------
     Qobiq va hero
     --------------------------------------------------------------- */
  function renderShell() {
    var tabs = TABS.map(function (tab) {
      var active = tab.key === state.tab;
      return (
        '<button class="fifa-tab boks-tab' + (active ? " is-active" : "") + '" type="button" role="tab"' +
        ' data-boks-tab="' + tab.key + '" aria-selected="' + active + '">' + esc(tab.label) + "</button>"
      );
    }).join("");

    boksView.innerHTML =
      '<header class="boks-hero" id="boksHero"></header>' +
      // Tablar Futbol bo'limidagi .fifa-tabs ko'rinishida (fifa.js faqat data-fifa-tab'li tugmalarni ushlaydi)
      '<nav class="fifa-tabs boks-tabs" role="tablist" aria-label="Boks bo\'limlari">' + tabs + "</nav>" +
      '<div class="boks-panel" id="boksPanel" role="tabpanel"></div>' +
      '<div class="boks-view__spacer"></div>';
  }

  function renderHero() {
    var hero = document.getElementById("boksHero");
    if (!hero) return;
    var base = state.base || {};
    var partner = base.partner || {};
    var name = partner.name || "O'zbekiston Boks Federatsiyasi";
    var logo = String(partner.logo || "").trim();
    var mark = logo
      ? '<img class="boks-collab__logo" src="' + esc(logo) + '" alt="' + esc(name) + '">'
      : '<span class="boks-collab__glove">' + ICON_GLOVE + "</span>";

    var stats = list(base.stats).map(function (s) {
      return (
        '<div class="boks-stat">' +
        '<span class="boks-stat__value">' + esc(s.value) + "</span>" +
        '<span class="boks-stat__label">' + esc(s.label) + "</span>" +
        "</div>"
      );
    }).join("");

    var live = stream();
    var livePill = live.id && live.isLive
      ? '<button class="boks-live-pill" type="button" data-boks-tab="live"><span class="boks-live-pill__dot"></span>Jonli</button>'
      : "";
    var banner = String(base.banner == null ? DEFAULT_BANNER : base.banner).trim();
    hero.classList.toggle("boks-hero--banner", Boolean(banner));
    if (banner) {
      // Futbol bo'limidagi kabi rasmli header
      hero.innerHTML =
        '<img class="boks-hero__img" src="' + esc(banner) + '" alt="O\'zbekiston boks terma jamoasi" decoding="async" fetchpriority="high">' +
        livePill;
      return;
    }
    hero.innerHTML =
      '<div class="boks-collab" aria-label="NTV × ' + esc(name) + '">' +
      '<span class="boks-collab__ntv">NTV</span>' +
      '<span class="boks-collab__x" aria-hidden="true">×</span>' +
      mark +
      '<span class="boks-collab__name">' + esc(name) + "</span>" +
      "</div>" +
      '<div class="boks-hero__row">' +
      '<h2 class="boks-hero__title">Boks</h2>' +
      livePill +
      "</div>" +
      (partner.about ? '<p class="boks-hero__about">' + esc(partner.about) + "</p>" : "") +
      (stats ? '<div class="boks-stats">' + stats + "</div>" : "");
  }

  /* ---------------------------------------------------------------
     Efir
     --------------------------------------------------------------- */
  function renderStreamCard() {
    var s = stream();
    var frame;
    if (!s.id) {
      frame =
        '<div class="boks-stream__empty">' +
        '<span class="boks-empty__icon">' + ICON_GLOVE + "</span>" +
        '<p class="boks-empty__title">Hozircha efir yo\'q</p>' +
        '<p class="boks-empty__text">Terma jamoa janglari jonli efirda shu yerda ko\'rsatiladi.</p>' +
        "</div>";
    } else if (state.playingId === s.id && typeof window.__playYouTubeStandalone !== "function") {
      frame =
        '<iframe src="https://www.youtube.com/embed/' + esc(s.id) + '?rel=0&playsinline=1&autoplay=1"' +
        ' title="' + esc(s.title || "Jonli efir") + '"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
        " allowfullscreen></iframe>";
    } else {
      frame =
        '<button class="boks-stream__preview" type="button" data-boks-play="' + esc(s.id) + '"' +
        ' data-boks-title="' + esc(s.title || "Jonli efir") + '" aria-label="Efirni tomosha qilish">' +
        '<img src="' + thumbUrl(s.id) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="boks-card__overlay"></span>' +
        '<span class="boks-card__play">' + ICON_PLAY + "</span>" +
        "</button>" +
        (s.isLive ? '<span class="boks-stream__badge"><span class="boks-live-pill__dot"></span>LIVE</span>' : "");
    }
    var meta = s.id
      ? '<div class="boks-card__body">' +
        '<div class="boks-card__title">' + esc(s.title || "Jonli efir") + "</div>" +
        '<div class="boks-card__meta"><span class="boks-card__source">' + (s.isLive ? "Jonli efir" : "Efir") + "</span>" +
        (s.subtitle ? '<span class="boks-card__dot">•</span><span>' + esc(s.subtitle) + "</span>" : "") +
        "</div></div>"
      : "";
    return '<div class="boks-stream"><div class="boks-stream__frame">' + frame + "</div>" + meta + "</div>";
  }

  // Efir tabi: efir kartasi, "Boks janglari" sarlavhasi, uning ostida qidiruv va
  // janglar ro'yxati — pastga cheksiz davom etadi.
  function renderLive() {
    var all = state.lists.all;
    var total = pinnedFights().length + all.total;
    return (
      renderStreamCard() +
      '<h3 class="boks-section-title"><span class="boks-section-title__pulse" aria-hidden="true"></span>Boks janglari' +
      (total ? ' <span class="boks-section-title__count">' + formatCount(total) + "</span>" : "") +
      "</h3>" +
      renderFightSearch()
    );
  }

  /* ---------------------------------------------------------------
     Janglar (Efir tabida; qidiruv serverda — kanal arxivi minglab videodan iborat)
     --------------------------------------------------------------- */
  // Tezkor filtrlar: sarlavhalar inglizcha ("Jalolov (UZB)", "Olympic Games 2024 Final")
  var QUICK = [
    { label: "🇺🇿 O'zbekiston", q: "UZB" },
    { label: "Olimpiada", q: "Olympic" },
    { label: "Jahon chempionati", q: "World Championships" },
    { label: "Osiyo", q: "Asian" },
    { label: "Finallar", q: "Final" }
  ];

  function metaLine(v) {
    var parts = [];
    if (v.publishedAt) parts.push(formatAgo(v.publishedAt));
    if (v.viewCount) parts.push(formatCount(v.viewCount) + " marta");
    return parts.join(" · ");
  }

  // Futbol bo'limidagi video kartalar kabi: rasm tepada, ostida sarlavha va manba.
  function fightCard(v) {
    var ago = formatAgo(v.publishedAt);
    return (
      '<button class="boks-fight" type="button" data-boks-play="' + esc(v.videoId) + '" data-boks-title="' + esc(v.title) + '">' +
      '<span class="boks-card__media">' +
      '<img src="' + esc(v.thumb || thumbUrl(v.videoId)) + '" alt="" loading="lazy" decoding="async">' +
      '<span class="boks-card__overlay"></span>' +
      (v.pinned
        ? '<span class="boks-card__badge boks-card__badge--pin">' + ICON_PIN + "Tanlangan</span>"
        : ago ? '<span class="boks-card__badge">' + esc(ago) + "</span>" : "") +
      (v.durationSec ? '<span class="boks-card__dur">' + formatDuration(v.durationSec) + "</span>" : "") +
      '<span class="boks-card__play">' + ICON_PLAY + "</span>" +
      "</span>" +
      '<span class="boks-card__body">' +
      '<span class="boks-card__title">' + esc(v.title) + "</span>" +
      '<span class="boks-card__meta"><span class="boks-card__source">Boks janglari</span>' +
      (v.viewCount ? '<span class="boks-card__dot">•</span><span>' + formatCount(v.viewCount) + " marta ko'rilgan</span>" : "") +
      "</span>" +
      "</span>" +
      "</button>"
    );
  }

  // Ro'yxat oxiridagi "sentinel": ko'rinishga kirganda keyingi qism yuklanadi.
  function sentinel(key, hasMore, failed) {
    if (!hasMore) return '<div class="boks-sentinel" data-boks-sentinel="' + key + '" hidden></div>';
    return (
      '<div class="boks-sentinel" data-boks-sentinel="' + key + '">' +
      (failed ? '<button class="boks-more" type="button" data-boks-retry="' + key + '">Qayta urinish</button>' : loader()) +
      "</div>"
    );
  }

  // Pin qilinganlar (katta kartalar) + barcha janglar (qatorlar) — qidiruvsiz ro'yxat.
  function renderAllFights() {
    var l = state.lists.all;
    if (!state.api && !state.apiFailed) return loader();
    var pinned = pinnedFights();
    if (!pinned.length && !l.items.length) {
      return state.apiFailed || (state.api && state.api.videosError)
        ? empty("Videolar yuklanmadi", "Internetni tekshirib, birozdan so'ng qayta urinib ko'ring.")
        : empty("Janglar tez orada", "Terma jamoa janglarining videolari shu yerda paydo bo'ladi.");
    }
    return (
      (pinned.length ? '<div class="boks-fights boks-fights--pinned">' + pinned.map(fightCard).join("") + "</div>" : "") +
      '<div class="boks-fights" data-boks-rows="all">' + l.items.map(fightCard).join("") + "</div>" +
      sentinel("all", l.nextOffset != null, l.failed)
    );
  }

  function renderFightSearch() {
    var chips = QUICK.map(function (c) {
      var active = normalizeText(state.query) === normalizeText(c.q);
      return '<button class="boks-qchip' + (active ? " is-active" : "") + '" type="button" data-boks-quick="' + esc(c.q) + '">' + esc(c.label) + "</button>";
    }).join("");
    return (
      '<div class="boks-search">' +
      '<span class="boks-search__icon">' + ICON_SEARCH + "</span>" +
      '<input class="boks-search__input" id="boksFightSearch" type="search" inputmode="search" enterkeyhint="search" autocomplete="off"' +
      ' placeholder="Jangni qidiring: bokschi, turnir, yil…" value="' + esc(state.query) + '" aria-label="Jangni qidirish">' +
      '<button class="boks-search__clear" type="button" data-boks-clear' + (state.query ? "" : " hidden") + ' aria-label="Tozalash">' + ICON_CLOSE + "</button>" +
      "</div>" +
      '<div class="boks-qchips" role="group" aria-label="Tezkor filtr">' + chips + "</div>" +
      '<div id="boksFightResults">' + renderFightResults() + "</div>"
    );
  }

  function renderFightResults() {
    if (!state.query) return renderAllFights();
    var l = state.lists.search;
    if (l.loading && !l.items.length) return loader();
    if (l.failed && !l.items.length) return empty("Qidiruv ishlamadi", "Internetni tekshirib, qayta urinib ko'ring.");
    if (!l.items.length) return empty("Hech narsa topilmadi", "Boshqa so'z bilan qidiring — masalan, bokschining familiyasi (lotincha: Jalolov).");
    return (
      '<p class="boks-count">' + formatCount(l.total) + " ta jang topildi</p>" +
      '<div class="boks-fights" data-boks-rows="search">' + l.items.map(fightCard).join("") + "</div>" +
      sentinel("search", l.nextOffset != null, l.failed)
    );
  }

  function refreshFightResults() {
    var box = document.getElementById("boksFightResults");
    if (box) box.innerHTML = renderFightResults();
    var clear = boksView.querySelector("[data-boks-clear]");
    if (clear) clear.hidden = !state.query;
    boksView.querySelectorAll("[data-boks-quick]").forEach(function (b) {
      b.classList.toggle("is-active", normalizeText(state.query) === normalizeText(b.dataset.boksQuick));
    });
    observeSentinels();
  }

  // Ro'yxatni serverdan olish. append=false — yangi qidiruv; append=true — keyingi qism
  // (mavjud kartalar qayta chizilmaydi, faqat oxiriga qo'shiladi).
  // Kech kelgan eski javob yangi natijani bosib ketmasligi uchun seq tekshiriladi.
  function loadFightList(key, append) {
    var l = state.lists[key];
    if (append && (l.loading || l.nextOffset == null)) return;
    var seq = ++l.seq;
    var offset = append ? l.nextOffset : 0;
    l.loading = true;
    l.failed = false;
    if (!append) {
      l.items = [];
      l.total = 0;
      l.nextOffset = null;
      refreshFightResults();
    }
    var q = key === "search" ? state.query.trim() : "";
    var url = API_URL + "?resource=fights&offset=" + offset + (q ? "&q=" + encodeURIComponent(q) : "");
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) {
        if (seq !== l.seq) return;
        var incoming = list(json && json.videos);
        l.items = l.items.concat(incoming);
        l.total = Number(json && json.total) || 0;
        l.nextOffset = json && json.nextOffset != null ? json.nextOffset : null;
        l.loading = false;
        if (append) appendRows(key, incoming);
        else if (state.tab === "live") refreshFightResults();
      })
      .catch(function () {
        if (seq !== l.seq) return;
        l.loading = false;
        l.failed = true;
        if (append) updateSentinel(key, true, true);
        else if (state.tab === "live") refreshFightResults();
      });
  }

  function appendRows(key, items) {
    var rows = boksView.querySelector('[data-boks-rows="' + key + '"]');
    if (rows && items.length) rows.insertAdjacentHTML("beforeend", items.map(fightCard).join(""));
    var l = state.lists[key];
    updateSentinel(key, l.nextOffset != null, false);
  }

  function updateSentinel(key, hasMore, failed) {
    var el = boksView.querySelector('[data-boks-sentinel="' + key + '"]');
    if (!el) return;
    el.outerHTML = sentinel(key, hasMore, failed);
    observeSentinels();
  }

  function setQuery(value) {
    state.query = String(value || "");
    if (state.query.trim()) loadFightList("search", false);
    else {
      state.lists.search.seq++;
      refreshFightResults();
    }
  }

  /* ---------------------------------------------------------------
     Yangiliklar (Telegram kanal) — News bo'limidagi kartalar naqshi
     --------------------------------------------------------------- */
  function newsMedia(post) {
    var photos = list(post.photos);
    var ago = formatAgo(post.datetime);
    var badge = ago ? '<span class="boks-card__badge">' + esc(ago) + "</span>" : "";
    if (photos.length) {
      return (
        '<div class="boks-card__media">' +
        '<img src="' + esc(photos[0]) + '" alt="" loading="lazy" decoding="async">' +
        badge +
        (photos.length > 1 ? '<span class="boks-card__dur">+' + (photos.length - 1) + " rasm</span>" : "") +
        "</div>"
      );
    }
    if (post.videoUrl) {
      return (
        '<div class="boks-card__media">' +
        (post.videoThumb ? '<img src="' + esc(post.videoThumb) + '" alt="" loading="lazy" decoding="async">' : '<span class="boks-post__media-fill"></span>') +
        '<span class="boks-card__overlay"></span>' +
        badge +
        '<span class="boks-card__play">' + ICON_PLAY + "</span>" +
        (post.videoDuration ? '<span class="boks-card__dur">' + esc(post.videoDuration) + "</span>" : "") +
        "</div>"
      );
    }
    return "";
  }

  // Kartadagi manba qatori: @kanal • vaqt • ko'rishlar
  function postMeta(post) {
    return (
      '<span class="boks-card__meta">' +
      '<span class="boks-card__source">@boxinguzbekistan</span>' +
      '<span class="boks-card__dot">•</span><span>' + esc(formatAgo(post.datetime)) + "</span>" +
      (post.views ? '<span class="boks-card__views">' + ICON_EYE + esc(post.views) + "</span>" : "") +
      "</span>"
    );
  }

  function newsMeta(post) {
    return (
      '<div class="boks-post__meta">' +
      '<span class="boks-post__source">' + ICON_GLOVE + "@boxinguzbekistan</span>" +
      '<span class="boks-post__time">' + esc(formatAgo(post.datetime)) + "</span>" +
      (post.views ? '<span class="boks-post__views">' + ICON_EYE + esc(post.views) + "</span>" : "") +
      "</div>"
    );
  }

  function postCard(post) {
    return (
      '<article class="boks-post" data-boks-post="' + post.id + '">' +
      newsMedia(post) +
      '<div class="boks-card__body">' +
      '<h4 class="boks-card__title">' + esc(post.title) + "</h4>" +
      (post.lead && post.lead !== post.title ? '<p class="boks-post__lead">' + esc(post.lead) + "</p>" : "") +
      postMeta(post) +
      "</div>" +
      "</article>"
    );
  }

  function renderNews() {
    var news = state.news;
    if (!news.loaded) {
      if (!news.loading) loadNews(false);
      return loader();
    }
    if (!news.posts.length) {
      return news.failed
        ? empty("Yangiliklar yuklanmadi", "Birozdan so'ng qayta urinib ko'ring.") +
          '<button class="boks-more" type="button" data-boks-retry="news">Qayta urinish</button>'
        : empty("Yangiliklar tez orada", "Federatsiyaning rasmiy yangiliklari shu yerda e'lon qilinadi.");
    }
    return (
      '<button class="boks-channel" type="button" data-boks-link="https://t.me/boxinguzbekistan">' +
      '<span class="boks-channel__icon">' + ICON_TG + "</span>" +
      '<span class="boks-channel__text"><b>@boxinguzbekistan</b><small>Telegram kanal</small></span>' +
      '<span class="boks-channel__cta">Obuna</span>' +
      "</button>" +
      '<div class="boks-posts" data-boks-rows="news">' + news.posts.map(postCard).join("") + "</div>" +
      sentinel("news", Boolean(news.nextBefore), news.failed)
    );
  }

  function loadNews(append) {
    var news = state.news;
    if (news.loading || (append && !news.nextBefore)) return;
    news.loading = true;
    news.failed = false;
    var url = API_URL + "?resource=news" + (append ? "&before=" + news.nextBefore : "");
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) {
        var known = {};
        news.posts.forEach(function (p) { known[p.id] = true; });
        var incoming = list(json && json.posts).filter(function (p) {
          if (known[p.id]) return false;
          known[p.id] = true;
          return true;
        });
        news.posts = append ? news.posts.concat(incoming) : incoming;
        news.nextBefore = json && json.nextBefore;
        news.loading = false;
        news.loaded = true;
        if (state.tab !== "news" || boksView.hidden) return;
        var rows = boksView.querySelector('[data-boks-rows="news"]');
        if (append && rows) {
          if (incoming.length) rows.insertAdjacentHTML("beforeend", incoming.map(postCard).join(""));
          updateSentinel("news", Boolean(news.nextBefore), false);
        } else {
          renderPanel();
        }
      })
      .catch(function () {
        news.loading = false;
        news.failed = true;
        news.loaded = true;
        if (state.tab !== "news" || boksView.hidden) return;
        if (append) updateSentinel("news", true, true);
        else renderPanel();
      });
  }

  /* --- To'liq xabar oynasi (bottom sheet) --- */
  var sheet = null;
  function closeSheet() {
    if (!sheet) return;
    var v = sheet.querySelector("video");
    if (v) { try { v.pause(); } catch (_) {} }
    sheet.classList.remove("is-open");
    var el = sheet;
    sheet = null;
    setTimeout(function () { el.remove(); }, 260);
    document.documentElement.classList.remove("boks-sheet-open");
    try { window.tgBackUnregister?.("boks-post"); } catch (_) {}
  }

  function openPost(id) {
    var post = state.news.posts.find(function (p) { return String(p.id) === String(id); });
    if (!post) return;
    closeSheet();
    var photos = list(post.photos);
    var media = "";
    if (photos.length) {
      media = '<div class="boks-sheet__gallery' + (photos.length > 1 ? " is-multi" : "") + '">' +
        photos.map(function (p) { return '<img src="' + esc(p) + '" alt="" loading="lazy" decoding="async">'; }).join("") + "</div>";
    } else if (post.videoUrl) {
      media = '<video class="boks-sheet__video" src="' + esc(post.videoUrl) + '"' +
        (post.videoThumb ? ' poster="' + esc(post.videoThumb) + '"' : "") + " controls playsinline></video>";
    }
    var el = document.createElement("div");
    el.className = "boks-sheet";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML =
      '<div class="boks-sheet__backdrop" data-boks-sheet-close></div>' +
      '<div class="boks-sheet__panel">' +
      '<div class="boks-sheet__grab" aria-hidden="true"></div>' +
      '<button class="boks-sheet__close" type="button" data-boks-sheet-close aria-label="Yopish">' + ICON_CLOSE + "</button>" +
      '<div class="boks-sheet__scroll">' +
      newsMeta(post) +
      '<h3 class="boks-sheet__title">' + esc(post.title) + "</h3>" +
      media +
      '<div class="boks-sheet__text">' + linkify(post.text) + "</div>" +
      (post.telegramUrl
        ? '<button class="boks-sheet__tg" type="button" data-boks-link="' + esc(post.telegramUrl) + '">' + ICON_TG + "Telegramda ochish</button>"
        : "") +
      "</div></div>";
    document.body.appendChild(el);
    sheet = el;
    document.documentElement.classList.add("boks-sheet-open");
    requestAnimationFrame(function () { el.classList.add("is-open"); });
    try { window.tgBackRegister?.("boks-post", closeSheet); } catch (_) {}
    el.addEventListener("click", onClick);
  }

  /* ---------------------------------------------------------------
     Terma jamoa
     --------------------------------------------------------------- */
  function renderTeam() {
    if (!state.api && !state.apiFailed) return loader();
    var items = list(state.api && state.api.team);
    if (!items.length) {
      return empty("Terma jamoa tarkibi tez orada", "Bokschilar ro'yxati shu yerda e'lon qilinadi.");
    }
    return '<div class="boks-team">' + items.map(function (b) {
      var photo = safeUrl(b.photo);
      return (
        '<article class="boks-boxer">' +
        '<div class="boks-boxer__photo">' +
        (photo ? '<img src="' + esc(photo) + '" alt="' + esc(b.name) + '" loading="lazy" decoding="async">' : '<span class="boks-boxer__initials">' + esc(initials(b.name)) + "</span>") +
        (b.weight ? '<span class="boks-boxer__weight">' + esc(b.weight) + "</span>" : "") +
        "</div>" +
        '<div class="boks-boxer__body">' +
        '<h4 class="boks-boxer__name">' + esc(b.name) + "</h4>" +
        (b.result ? '<p class="boks-boxer__result">' + ICON_MEDAL + "<span>" + esc(b.result) + "</span></p>" : "") +
        "</div>" +
        "</article>"
      );
    }).join("") + "</div>";
  }

  function renderLinks() {
    var links = list(((state.base || {}).partner || {}).links).filter(function (l) { return safeUrl(l.url); });
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
    var html = state.tab === "news" ? renderNews()
      : state.tab === "team" ? renderTeam() + renderLinks()
      : renderLive();
    panel.innerHTML = html;
    observeSentinels();
  }

  function renderAll() {
    renderHero();
    renderPanel();
  }

  function setTab(key) {
    if (!TABS.some(function (t) { return t.key === key; })) return;
    if (key !== state.tab) {
      state.tab = key;
      boksView.querySelectorAll(".boks-tab").forEach(function (btn) {
        var active = btn.dataset.boksTab === key;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", String(active));
        if (active && btn.scrollIntoView) {
          try { btn.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); } catch (_) {}
        }
      });
    }
    renderPanel();
  }

  /* ---------------------------------------------------------------
     Cheksiz ro'yxat — sentinel ko'rinishga kirganda keyingi qism
     --------------------------------------------------------------- */
  var sentinelObserver = null;
  function onSentinel(entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting || boksView.hidden) return;
      var key = entry.target.dataset.boksSentinel;
      if (key === "news") loadNews(true);
      else if (state.lists[key] && !state.lists[key].failed) loadFightList(key, true);
    });
  }

  function observeSentinels() {
    if (typeof IntersectionObserver === "undefined") return;
    if (!sentinelObserver) {
      sentinelObserver = new IntersectionObserver(onSentinel, {
        root: document.getElementById("appShell") || null,
        rootMargin: "0px 0px 700px 0px"
      });
    }
    sentinelObserver.disconnect();
    boksView.querySelectorAll("[data-boks-sentinel]:not([hidden])").forEach(function (el) {
      sentinelObserver.observe(el);
    });
  }

  function play(ytId, title) {
    if (!ytId) return;
    if (typeof window.__playYouTubeStandalone === "function") {
      try { window.__playYouTubeStandalone(ytId, { title: title || "Boks" }); } catch (_) {}
      return;
    }
    // Brauzer fallback: efir bo'lsa ramkada, jang bo'lsa YouTube'da ochiladi
    if (stream().id === ytId) {
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
    var baseReq = fetch(DATA_URL + "?t=" + bucket, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) { state.base = json && typeof json === "object" ? json : {}; })
      .catch(function () { if (!state.base) state.base = {}; })
      .then(function () { if (!boksView.hidden) renderHero(); });
    var apiReq = fetch(API_URL, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) {
        state.api = json && typeof json === "object" ? json : {};
        state.apiFailed = false;
        // Qidiruvsiz birinchi qism asosiy javob bilan keladi
        var all = state.lists.all;
        all.seq++;
        all.items = list(state.api.videos);
        all.total = Number(state.api.total) || 0;
        all.nextOffset = state.api.nextOffset != null ? state.api.nextOffset : null;
        all.loading = false;
        all.failed = false;
      })
      .catch(function () { if (!state.api) state.apiFailed = true; });
    Promise.all([baseReq, apiReq]).then(function () {
      state.loading = false;
      if (!boksView.hidden) renderAll();
    });
  }

  var searchTimer = null;
  boksView.addEventListener("input", function (e) {
    if (e.target.id !== "boksFightSearch") return;
    var value = e.target.value;
    var clear = boksView.querySelector("[data-boks-clear]");
    if (clear) clear.hidden = !value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { setQuery(value); }, 320);
  });
  boksView.addEventListener("keydown", function (e) {
    if (e.target.id === "boksFightSearch" && e.key === "Enter") {
      clearTimeout(searchTimer);
      setQuery(e.target.value);
      e.target.blur();
    }
  });

  function onClick(e) {
    var t = e.target;
    if (t.closest("[data-boks-sheet-close]")) { closeSheet(); return; }
    var tab = t.closest("[data-boks-tab]");
    if (tab) { setTab(tab.dataset.boksTab); return; }
    var playBtn = t.closest("[data-boks-play]");
    if (playBtn) { play(playBtn.dataset.boksPlay, playBtn.dataset.boksTitle); return; }
    var link = t.closest("[data-boks-link]");
    if (link) { e.preventDefault(); openExternal(link.dataset.boksLink); return; }
    if (t.closest("[data-boks-clear]")) {
      clearTimeout(searchTimer);
      var input = document.getElementById("boksFightSearch");
      if (input) { input.value = ""; input.focus(); }
      setQuery("");
      return;
    }
    var quick = t.closest("[data-boks-quick]");
    if (quick) {
      clearTimeout(searchTimer);
      var next = normalizeText(state.query) === normalizeText(quick.dataset.boksQuick) ? "" : quick.dataset.boksQuick;
      var box = document.getElementById("boksFightSearch");
      if (box) box.value = next;
      setQuery(next);
      return;
    }
    var retry = t.closest("[data-boks-retry]");
    if (retry) {
      var key = retry.dataset.boksRetry;
      if (key === "news") {
        if (state.news.posts.length) loadNews(true);
        else { state.news.loaded = false; renderPanel(); }
      } else if (state.lists[key]) {
        state.lists[key].failed = false;
        loadFightList(key, true);
        updateSentinel(key, true, false);
      }
      return;
    }
    var post = t.closest("[data-boks-post]");
    if (post) openPost(post.dataset.boksPost);
  }
  boksView.addEventListener("click", onClick);

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
    closeSheet();
    boksView.hidden = true;
    document.body.classList.remove("is-boks");
    if (sentinelObserver) sentinelObserver.disconnect();
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
