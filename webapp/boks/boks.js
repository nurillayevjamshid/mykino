/* ==========================================================================
   BOKS BO'LIMI — NTV × O'zbekiston Boks Federatsiyasi hamkorligi

   Naqsh esport/esport.js bilan bir xil:
   - Lazy-load: kino.js dagi ensureBoksModule() yuklaydi.
   - Tashqi interfeys: window.__boks = { openBoksView, closeBoksView }.
   - Ko'rinish #boksView (index.html) ichiga to'liq JS bilan chiziladi.

   Kontent manbalari:
     /api/boks               -> efir, terma jamoa, janglar videolari (admin panelda boshqariladi;
                                videolar YouTube kanaldan, shorts va qisqa kliplarsiz; pin qilinganlar boshida)
     /api/boks?resource=news -> @boxinguzbekistan Telegram kanalidagi xabarlar
     /static/boks/boks.json  -> hamkor ma'lumoti, raqamlar va turnirlar taqvimi
   ========================================================================== */
(function initBoksModule() {
  "use strict";

  var boksView = document.getElementById("boksView");
  if (!boksView) return;

  var DATA_URL = "/static/boks/boks.json";
  var API_URL = "/api/boks";
  var MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  var HOME_FIGHTS = 4;

  var TABS = [
    { key: "live", label: "Efir" },
    { key: "fights", label: "Janglar" },
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
  var ICON_PIN = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 3a1 1 0 0 1 .7 1.7L15 6.4v4.1l2.6 2.6A1 1 0 0 1 17 15h-4v5.5a1 1 0 0 1-2 0V15H7a1 1 0 0 1-.7-1.7L9 10.5V6.4L7.3 4.7A1 1 0 0 1 8 3h8Z"/></svg>';
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>';
  var ICON_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var ICON_MEDAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="15" r="6"></circle><path d="M8.5 10 6 3h4l2 4 2-4h4l-2.5 7"></path></svg>';
  var ICON_TG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.3 13.1l-4.8-1.5c-1-.3-1.1-1 .2-1.5L20.5 2.9c.9-.3 1.6.2 1.4 1.4Z"/></svg>';

  var state = {
    tab: "live",
    base: null,          // boks.json
    api: null,           // /api/boks
    apiFailed: false,
    loading: false,
    playingId: null,
    query: "",
    list: { items: [], total: 0, nextOffset: null, loading: false, failed: false },
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

  // Qidiruv uchun: kichik harf, o'/g' tutuqlarining hamma ko'rinishi bitta belgiga.
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
    hero.innerHTML =
      '<div class="boks-collab" aria-label="NTV × ' + esc(name) + '">' +
      '<span class="boks-collab__ntv">NTV</span>' +
      '<span class="boks-collab__x" aria-hidden="true">×</span>' +
      mark +
      '<span class="boks-collab__name">' + esc(name) + "</span>" +
      "</div>" +
      '<div class="boks-hero__row">' +
      '<h2 class="boks-hero__title">Boks</h2>' +
      (live.id && live.isLive ? '<button class="boks-live-pill" type="button" data-boks-tab="live"><span class="boks-live-pill__dot"></span>Jonli</button>' : "") +
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
        '<img src="' + thumbUrl(s.id) + '" alt="" loading="lazy">' +
        '<span class="boks-stream__play">' + ICON_PLAY + "</span>" +
        "</button>" +
        (s.isLive ? '<span class="boks-stream__badge"><span class="boks-live-pill__dot"></span>LIVE</span>' : "");
    }
    var meta = s.id
      ? '<div class="boks-stream__meta">' +
        '<p class="boks-stream__title">' + esc(s.title || "Jonli efir") + "</p>" +
        (s.subtitle ? '<p class="boks-stream__sub">' + esc(s.subtitle) + "</p>" : "") +
        "</div>"
      : "";
    return '<div class="boks-stream"><div class="boks-stream__frame">' + frame + "</div>" + meta + "</div>";
  }

  function renderLive() {
    var html = renderStreamCard();
    var pinned = pinnedFights();
    var latest = state.list.items;
    var pick = (pinned.length ? pinned : latest).slice(0, HOME_FIGHTS);
    var total = pinned.length + state.list.total;
    html +=
      '<div class="boks-section-head">' +
      '<h3 class="boks-section-title">' + (pinned.length ? "Tanlangan janglar" : "So'nggi janglar") + "</h3>" +
      (total ? '<button class="boks-link" type="button" data-boks-tab="fights">Barchasi (' + formatCount(total) + ")</button>" : "") +
      "</div>";
    if (!state.api && !state.apiFailed) return html + loader();
    if (!pick.length) return html + empty("Janglar tez orada", "Terma jamoa janglarining videolari shu yerda paydo bo'ladi.");
    return html + '<div class="boks-fights boks-fights--rail">' + pick.map(featuredCard).join("") + "</div>";
  }

  /* ---------------------------------------------------------------
     Janglar (qidiruv serverda — kanal arxivi minglab videodan iborat)
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

  function featuredCard(v) {
    return (
      '<button class="boks-fight boks-fight--featured" type="button" data-boks-play="' + esc(v.videoId) + '" data-boks-title="' + esc(v.title) + '">' +
      '<span class="boks-fight__thumb">' +
      '<img src="' + esc(v.thumb || thumbUrl(v.videoId)) + '" alt="" loading="lazy">' +
      (v.pinned ? '<span class="boks-fight__pin">' + ICON_PIN + "Tanlangan</span>" : "") +
      (v.durationSec ? '<span class="boks-fight__dur">' + formatDuration(v.durationSec) + "</span>" : "") +
      '<span class="boks-fight__play">' + ICON_PLAY + "</span>" +
      "</span>" +
      '<span class="boks-fight__body">' +
      '<span class="boks-fight__title">' + esc(v.title) + "</span>" +
      '<span class="boks-fight__meta">' + esc(metaLine(v)) + "</span>" +
      "</span>" +
      "</button>"
    );
  }

  function rowCard(v) {
    return (
      '<button class="boks-fight boks-fight--row" type="button" data-boks-play="' + esc(v.videoId) + '" data-boks-title="' + esc(v.title) + '">' +
      '<span class="boks-fight__thumb">' +
      '<img src="' + esc(v.thumb || thumbUrl(v.videoId)) + '" alt="" loading="lazy">' +
      (v.pinned ? '<span class="boks-fight__pin boks-fight__pin--dot" aria-label="Tanlangan">' + ICON_PIN + "</span>" : "") +
      (v.durationSec ? '<span class="boks-fight__dur">' + formatDuration(v.durationSec) + "</span>" : "") +
      "</span>" +
      '<span class="boks-fight__body">' +
      '<span class="boks-fight__title">' + esc(v.title) + "</span>" +
      '<span class="boks-fight__meta">' + esc(metaLine(v)) + "</span>" +
      "</span>" +
      "</button>"
    );
  }

  function renderFights() {
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
    var l = state.list;
    if ((!state.api && !state.apiFailed) || (l.loading && !l.items.length)) return loader();
    if (state.query) {
      if (l.failed && !l.items.length) return empty("Qidiruv ishlamadi", "Internetni tekshirib, qayta urinib ko'ring.");
      if (!l.items.length) return empty("Hech narsa topilmadi", "Boshqa so'z bilan qidiring — masalan, bokschining familiyasi (lotincha: Jalolov).");
      return (
        '<p class="boks-count">' + formatCount(l.total) + " ta jang topildi</p>" +
        '<div class="boks-fights">' + l.items.map(rowCard).join("") + "</div>" + moreButton()
      );
    }

    var pinned = pinnedFights();
    if (!pinned.length && !l.items.length) {
      return state.apiFailed || (state.api && state.api.videosError)
        ? empty("Videolar yuklanmadi", "Internetni tekshirib, birozdan so'ng qayta urinib ko'ring.")
        : empty("Janglar tez orada", "Terma jamoa janglarining videolari shu yerda paydo bo'ladi.");
    }
    var html = "";
    if (pinned.length) {
      html +=
        '<h3 class="boks-section-title boks-section-title--pin"><span class="boks-pin-dot">' + ICON_PIN + "</span>Tanlangan janglar</h3>" +
        '<div class="boks-fights">' + pinned.map(featuredCard).join("") + "</div>";
    }
    if (l.items.length) {
      html +=
        '<h3 class="boks-section-title">Barcha janglar <span class="boks-section-title__count">' + formatCount(l.total) + "</span></h3>" +
        '<div class="boks-fights">' + l.items.map(rowCard).join("") + "</div>" + moreButton();
    }
    return html;
  }

  function moreButton() {
    var l = state.list;
    if (l.nextOffset == null) return "";
    return '<button class="boks-more" type="button" data-boks-more' + (l.loading ? " disabled" : "") + ">" +
      (l.loading ? "Yuklanmoqda…" : "Yana ko'rsatish") + "</button>";
  }

  function refreshFightResults() {
    var box = document.getElementById("boksFightResults");
    if (box) box.innerHTML = renderFightResults();
    var clear = boksView.querySelector("[data-boks-clear]");
    if (clear) clear.hidden = !state.query;
    boksView.querySelectorAll("[data-boks-quick]").forEach(function (b) {
      b.classList.toggle("is-active", normalizeText(state.query) === normalizeText(b.dataset.boksQuick));
    });
  }

  // Ro'yxatni serverdan olish: yangi qidiruv (append=false) yoki keyingi sahifa (append=true).
  // Kech kelgan eski javob yangi qidiruv natijasini bosib ketmasligi uchun seq tekshiriladi.
  var listSeq = 0;
  function loadFightList(append) {
    var l = state.list;
    var seq = ++listSeq;
    var offset = append ? l.nextOffset || 0 : 0;
    l.loading = true;
    l.failed = false;
    if (!append) { l.items = []; l.total = 0; l.nextOffset = null; }
    refreshFightResults();
    var url = API_URL + "?resource=fights&offset=" + offset + (state.query ? "&q=" + encodeURIComponent(state.query.trim()) : "");
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) {
        if (seq !== listSeq) return;
        l.items = (append ? l.items : []).concat(list(json && json.videos));
        l.total = Number(json && json.total) || 0;
        l.nextOffset = json && json.nextOffset != null ? json.nextOffset : null;
      })
      .catch(function () { if (seq === listSeq) l.failed = true; })
      .then(function () {
        if (seq !== listSeq) return;
        l.loading = false;
        if (state.tab === "fights") refreshFightResults();
      });
  }

  function setQuery(value) {
    state.query = String(value || "");
    loadFightList(false);
  }

  /* ---------------------------------------------------------------
     Yangiliklar (Telegram kanal) — News bo'limidagi kartalar naqshi
     --------------------------------------------------------------- */
  function newsMedia(post) {
    var photos = list(post.photos);
    if (photos.length) {
      return (
        '<div class="boks-post__media">' +
        '<img src="' + esc(photos[0]) + '" alt="" loading="lazy">' +
        (photos.length > 1 ? '<span class="boks-post__album">+' + (photos.length - 1) + " rasm</span>" : "") +
        "</div>"
      );
    }
    if (post.videoUrl) {
      return (
        '<div class="boks-post__media">' +
        (post.videoThumb ? '<img src="' + esc(post.videoThumb) + '" alt="" loading="lazy">' : '<span class="boks-post__media-fill"></span>') +
        '<span class="boks-post__play">' + ICON_PLAY + "</span>" +
        (post.videoDuration ? '<span class="boks-fight__dur">' + esc(post.videoDuration) + "</span>" : "") +
        "</div>"
      );
    }
    return "";
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

  function renderNews() {
    var news = state.news;
    if (!news.loaded) {
      if (!news.loading) loadNews();
      return loader();
    }
    if (!news.posts.length) {
      return news.failed
        ? empty("Yangiliklar yuklanmadi", "Birozdan so'ng qayta urinib ko'ring.") +
          '<button class="boks-more" type="button" data-boks-news-retry>Qayta urinish</button>'
        : empty("Yangiliklar tez orada", "Federatsiyaning rasmiy yangiliklari shu yerda e'lon qilinadi.");
    }
    var cards = news.posts.map(function (post) {
      return (
        '<article class="boks-post" data-boks-post="' + post.id + '" tabindex="0">' +
        newsMeta(post) +
        newsMedia(post) +
        '<h4 class="boks-post__title">' + esc(post.title) + "</h4>" +
        (post.lead && post.lead !== post.title ? '<p class="boks-post__lead">' + esc(post.lead) + "</p>" : "") +
        '<span class="boks-post__more">Batafsil o\'qish</span>' +
        "</article>"
      );
    }).join("");
    var more = news.nextBefore
      ? '<button class="boks-more" type="button" data-boks-news-more' + (news.loading ? " disabled" : "") + ">" +
        (news.loading ? "Yuklanmoqda…" : "Oldingi yangiliklar") + "</button>"
      : "";
    return (
      '<button class="boks-channel" type="button" data-boks-link="https://t.me/boxinguzbekistan">' +
      '<span class="boks-channel__icon">' + ICON_TG + "</span>" +
      '<span class="boks-channel__text"><b>@boxinguzbekistan</b><small>Telegram kanal</small></span>' +
      '<span class="boks-channel__cta">Obuna</span>' +
      "</button>" +
      '<div class="boks-posts">' + cards + "</div>" + more
    );
  }

  function loadNews(append) {
    var news = state.news;
    if (news.loading) return;
    news.loading = true;
    var url = API_URL + "?resource=news" + (append && news.nextBefore ? "&before=" + news.nextBefore : "");
    fetch(url, { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : Promise.reject(res.status); })
      .then(function (json) {
        var incoming = list(json && json.posts);
        var seen = {};
        news.posts = (append ? news.posts.concat(incoming) : incoming).filter(function (p) {
          if (seen[p.id]) return false;
          seen[p.id] = true;
          return true;
        });
        news.nextBefore = json && json.nextBefore;
        news.failed = false;
      })
      .catch(function () { news.failed = true; })
      .then(function () {
        news.loading = false;
        news.loaded = true;
        if (!boksView.hidden && state.tab === "news") renderPanel();
      });
    if (append && state.tab === "news") renderPanel();
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
        photos.map(function (p) { return '<img src="' + esc(p) + '" alt="" loading="lazy">'; }).join("") + "</div>";
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
     Turnirlar
     --------------------------------------------------------------- */
  function renderEvents() {
    // Avval davom etayotgan/kutilayotganlar (yaqinidan), so'ng yakunlanganlar (yangisidan)
    var items = list((state.base || {}).events).slice().sort(function (a, b) {
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
        (photo ? '<img src="' + esc(photo) + '" alt="' + esc(b.name) + '" loading="lazy">' : '<span class="boks-boxer__initials">' + esc(initials(b.name)) + "</span>") +
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
    var html = state.tab === "fights" ? renderFights()
      : state.tab === "news" ? renderNews()
      : state.tab === "events" ? renderEvents()
      : state.tab === "team" ? renderTeam()
      : renderLive();
    panel.innerHTML = html + (state.tab === "live" ? renderLinks() : "");
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
        // Qidiruvsiz birinchi sahifa asosiy javob bilan keladi
        if (!state.query) {
          listSeq++;
          state.list = {
            items: list(state.api.videos),
            total: Number(state.api.total) || 0,
            nextOffset: state.api.nextOffset != null ? state.api.nextOffset : null,
            loading: false,
            failed: false
          };
        }
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
    if (t.closest("[data-boks-more]")) { loadFightList(true); return; }
    if (t.closest("[data-boks-news-more]")) { loadNews(true); return; }
    if (t.closest("[data-boks-news-retry]")) {
      state.news.loaded = false;
      renderPanel();
      return;
    }
    var post = t.closest("[data-boks-post]");
    if (post) openPost(post.dataset.boksPost);
  }
  boksView.addEventListener("click", onClick);
  boksView.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-boks-post]")) openPost(e.target.dataset.boksPost);
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
    closeSheet();
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
