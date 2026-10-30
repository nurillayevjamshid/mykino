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

  // Lentaga osilgan bir juft boks qo'lqopi (foydalanuvchi bergan rasmdan vektorlangan) — sidebar, splash va admin bilan bir xil
  var ICON_GLOVE = '<svg viewBox="0 0 544 544" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M174 530C155 528 132 523 116 517C101 512 73 499 64 492C44 479 28 458 20 436C15 420 13 413 14 394C14 366 14 364 38 309C56 267 61 259 74 247C86 235 97 228 114 223L122 220 L134 191C140 175 145 162 145 161C145 156 149 151 155 148C160 146 161 146 176 146C190 146 204 147 210 150C212 150 216 142 228 118C237 100 244 86 244 86C243 86 239 89 234 92C221 101 211 103 197 101C183 99 171 91 165 78C163 73 162 72 162 57C162 43 163 42 166 36C168 31 171 27 175 24C183 16 189 14 202 13C216 13 222 14 239 26L253 35 L258 33C262 30 264 30 272 30C280 30 282 30 286 33L291 35 L306 26C314 20 322 15 324 15C327 14 333 14 340 14C349 14 353 14 357 16C365 19 374 27 378 36C381 42 382 43 382 57C382 72 381 73 379 78C375 86 367 94 360 98C353 101 341 102 334 102C325 101 320 98 310 92C305 89 301 86 300 86C300 86 307 100 316 118C328 142 332 150 334 150C340 147 354 146 368 146C383 146 384 146 389 148C395 151 399 156 399 161C399 162 404 175 410 191L422 220 L432 224C439 226 447 230 452 233C463 239 479 254 485 265C490 273 522 344 525 356C530 368 531 375 530 395C530 411 530 415 528 423C521 447 512 463 496 480C485 490 475 496 455 506C426 519 411 524 386 528C369 531 336 531 328 529C304 522 287 504 280 482C277 472 276 456 278 446L280 438 L276 434L272 431 L268 434L264 438 L266 446C268 456 267 472 264 482C257 504 240 521 217 529C212 530 184 531 174 530ZM206 507C214 504 223 499 229 493C240 482 246 464 243 452L242 448 L230 448C221 448 217 448 212 446C204 443 198 439 192 433C187 428 180 415 180 412C180 410 180 410 178 410C168 414 161 415 154 415L145 415 L145 404L145 393 L151 393C159 392 167 389 173 385L178 382 L178 374C177 368 177 365 174 360C172 356 171 351 171 350C171 347 172 347 178 344C182 342 186 340 188 340C192 340 192 340 195 348C197 352 199 357 199 358C200 359 200 370 201 382C202 401 202 403 204 408C209 418 221 425 230 425C241 425 253 417 258 406L260 400 L261 367C261 346 261 330 260 325C258 311 253 299 245 288L241 283 L230 283C199 281 166 270 139 251L128 244 L121 246C106 251 88 265 79 278C75 285 46 350 41 365C33 386 35 409 44 432C50 445 64 461 77 471C83 475 104 486 120 493C136 499 160 506 176 507C185 508 201 508 206 507ZM385 505C399 502 411 498 424 493C441 486 461 475 468 470C503 444 516 401 503 364C497 349 468 284 465 278C456 265 438 251 423 246L416 244 L405 251C378 270 345 281 314 283L303 283 L299 288C291 300 286 311 284 325C283 330 283 347 283 367C283 399 284 401 286 405C291 417 303 426 313 425C323 425 335 418 340 408C342 403 342 401 343 382C344 370 344 359 345 358C345 357 347 352 349 348C352 340 352 340 356 340C358 340 362 342 366 344C372 347 373 347 373 350C373 351 372 356 370 360C367 365 367 368 366 374L366 382 L371 385C377 389 385 392 393 393L399 393 L399 404L399 415 L390 415C383 415 376 414 366 410C364 410 364 410 364 412C364 415 357 428 352 433C346 439 340 443 332 446C327 448 323 448 314 448L302 448 L301 452C298 464 304 482 315 493C321 499 330 504 338 507C345 509 370 508 385 505ZM278 276L283 268 L278 253C275 244 272 237 272 237C272 237 269 244 266 253L261 268 L266 276C269 280 272 284 272 284C272 284 275 280 278 276ZM246 239L253 217 L243 217C232 216 214 212 200 207C189 204 169 194 164 191C161 189 161 189 160 192C159 193 162 195 181 205C194 211 205 217 207 219C209 221 212 225 214 227C216 232 216 233 216 245L216 258 L222 259C226 259 231 260 234 260L239 260 L246 239ZM320 259L328 258 L328 245C328 234 328 232 330 228C331 225 334 221 336 219C338 218 350 211 363 205C382 195 385 193 384 192C383 189 383 189 380 191C375 194 355 204 344 207C330 212 312 216 301 217L291 217 L298 239L305 260 L309 260C311 260 316 260 320 259ZM194 244C194 239 190 237 171 227C160 221 151 217 150 217C150 218 149 220 148 222C147 226 147 226 150 229C155 233 174 244 183 247L192 251 L193 248C193 247 194 245 194 244ZM372 242C377 240 385 235 390 232L398 227 L396 222C395 220 394 217 393 217C393 217 384 222 373 227C350 239 349 240 351 247L352 251 L357 249C359 248 366 245 372 242ZM252 193C247 189 231 181 220 178C206 173 192 169 182 168L174 168 L178 171C185 175 204 184 216 187C229 191 241 194 253 195C254 195 254 194 252 193ZM306 193C324 190 353 179 366 170L370 168 L363 168C353 169 342 172 328 176C316 180 297 189 292 193L290 195 L294 194C296 194 302 193 306 193ZM278 172C286 168 297 162 303 160C306 159 308 158 308 157C308 156 272 86 272 86C272 86 236 156 236 157C236 158 238 159 241 160C247 162 259 168 266 172C269 174 272 176 272 176C272 176 275 174 278 172ZM212 76C215 75 239 59 240 58C242 57 212 37 208 36C195 34 182 49 185 61C187 69 193 76 201 78C204 79 208 78 212 76ZM349 75C356 71 361 61 359 53C358 48 355 43 350 40C341 34 337 34 318 47C310 53 303 57 303 57C303 58 331 76 335 78C339 79 343 79 349 75ZM275 60C277 58 277 57 275 55C275 54 273 53 272 53C271 53 269 54 269 55C267 57 267 58 269 60C270 61 272 62 272 62C272 62 274 61 275 60Z"></path></svg>';
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
