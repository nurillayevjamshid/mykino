/* ==========================================================================
   KIBERSPORT BO'LIMI — JavaScript moduli (loyihaga ulangan)

   Naqsh fifa/fifa.js bilan bir xil:
   - Lazy-load: foydalanuvchi Kibersport tabini bosgach yuklanadi.
   - Tashqi interfeys: window.__esport = { openEsportView, closeEsportView }.
   - Ko'rinish elementga bog'lanadi: #esportView (index.html ichida).

   Kontent ikki manbadan keladi:
     1. /api/settings  -> esportsStreams  (admin panelda kiritilgan strim)
     2. /api/esport    -> haylaytlar va matchlar ro'yxati

   API javob bermasa (brauzerda ochilganda yoki offline), NAMUNA
   ma'lumotlar ishlatiladi — shuning uchun sahifa har doim ko'rinadi.
   ========================================================================== */
(function initEsportModule() {
  "use strict";

  var esportView = document.getElementById("esportView");
  // Bo'lim index.html da bo'lmasa — modul hech narsa qilmaydi (xato bermaydi).
  if (!esportView) return;

  /* ---------------------------------------------------------------
     Namuna ma'lumotlar (API ishlamaganda zaxira)
     --------------------------------------------------------------- */
  var SAMPLE = {
    pubg: {
      stream: {
        // YouTube video ID — iframe shu ID bo'yicha quriladi
        youtubeId: "jfKfPfyJRdk",
        title: "PUBG Mobile Global Championship",
        subtitle: "Grand Finals · 3-xarita",
        isLive: true,
        viewers: 48213,
        game: "PUBG Mobile"
      },
      highlights: [
        { title: "Eng yaxshi 5 ta snayper o'qi", channel: "PMGC", views: "128K", time: "2 kun oldin", youtubeId: "jfKfPfyJRdk" },
        { title: "Final zona — 1v4 clutch", channel: "Esports Daily", views: "94K", time: "3 kun oldin", youtubeId: "jfKfPfyJRdk" },
        { title: "AWM bilan 600 metr", channel: "PMGC", views: "61K", time: "5 kun oldin", youtubeId: "jfKfPfyJRdk" }
      ],
      matches: [
        { home: "Team Falcons", away: "Nigma Galaxy", time: "20:00", date: "Bugun", status: "soon" },
        { home: "S2G Esports", away: "Alpha7", time: "22:30", date: "Bugun", status: "soon" },
        { home: "IHC Esports", away: "Tianba", time: "18:00", date: "Ertaga", status: "" }
      ]
    },
    cs2: {
      stream: {
        youtubeId: "jfKfPfyJRdk",
        title: "CS2 Major — Chorak final",
        subtitle: "BO3 · Mirage",
        isLive: false,
        viewers: 0,
        game: "CS2"
      },
      highlights: [
        { title: "AWP ace — 5 soniyada", channel: "HLTV", views: "310K", time: "1 kun oldin", youtubeId: "jfKfPfyJRdk" },
        { title: "Eng yaxshi smoke lineup'lar", channel: "CS Tips", views: "77K", time: "4 kun oldin", youtubeId: "jfKfPfyJRdk" }
      ],
      matches: [
        { home: "NAVI", away: "FaZe Clan", time: "21:00", date: "Bugun", status: "soon" },
        { home: "Vitality", away: "G2", time: "23:45", date: "Bugun", status: "soon" }
      ]
    },
    coc: {
      stream: {
        youtubeId: "jfKfPfyJRdk",
        title: "Clash of Clans — World Finals",
        subtitle: "Clan War League",
        isLive: false,
        viewers: 0,
        game: "Clash of Clans"
      },
      highlights: [
        { title: "3 yulduzli hujum — TH16", channel: "Clash Bashes", views: "52K", time: "6 kun oldin", youtubeId: "jfKfPfyJRdk" },
        { title: "Eng tez 100% hujum", channel: "CoC Pro", views: "38K", time: "1 hafta oldin", youtubeId: "jfKfPfyJRdk" }
      ],
      matches: [
        { home: "Tribe Gaming", away: "Queens Walk", time: "19:00", date: "Ertaga", status: "" }
      ]
    }
  };

  /* ---------------------------------------------------------------
     Ichki holat
     --------------------------------------------------------------- */
  var state = {
    game: "pubg",        // faol tab
    data: SAMPLE,        // API'dan kelgan yoki namuna ma'lumot
    playingId: null      // hozir ijro etilayotgan YouTube video ID
  };

  /* ---------------------------------------------------------------
     DOM havolalari
     MUHIM: barcha ID'lar `esport` prefiksli va faqat shu bo'lim ichida
     izlanadi — boshqa bo'limlar (kino, musiqa, fifa) bilan to'qnashmasin.
     --------------------------------------------------------------- */
  function $id(suffix) {
    return esportView.querySelector("#" + suffix);
  }

  var el = {
    tabs:        $id("esportGameTabs"),
    streamHost:  $id("esportStreamHost"),
    streamEmpty: $id("esportStreamEmpty"),
    emptyTitle:  $id("esportEmptyTitle"),
    liveBadge:   $id("esportLiveBadge"),
    streamTitle: $id("esportStreamTitle"),
    streamSub:   $id("esportStreamSub"),
    viewers:     $id("esportViewers"),
    viewersNum:  $id("esportViewersNum"),
    highlights:  $id("esportHighlightList"),
    matches:     $id("esportMatchList"),
    headerPill:  $id("esportHeaderPill"),
    refreshBtn:  $id("esportRefreshBtn"),
    preview:     $id("esportStreamPreview"),
    previewImg:  $id("esportStreamPreviewImg"),
    fullscreen:  $id("esportFullscreenBtn")
  };

  /* ---------------------------------------------------------------
     Yordamchi: HTML injection'dan himoya
     --------------------------------------------------------------- */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ---------------------------------------------------------------
     Yordamchi: sonlarni chiroyli ko'rsatish (48213 -> 48.2K)
     --------------------------------------------------------------- */
  function formatViews(n) {
    var num = Number(n) || 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(num);
  }

  /* ---------------------------------------------------------------
     Yordamchi: YouTube ID ajratib olish
     Qo'llab-quvvatlanadi: to'liq havola, youtu.be, shorts, embed, yoki toza ID
     --------------------------------------------------------------- */
  function extractYoutubeId(input) {
    var raw = String(input || "").trim();
    if (!raw) return "";

    // Toza ID (11 belgi atrofida)
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

  /* ---------------------------------------------------------------
     Admin panel kalitlarini modul kalitlariga moslash
     Admin: cs, pubg, clash  ->  Modul: cs2, pubg, coc
     --------------------------------------------------------------- */
  function settingsToGameKey(adminKey) {
    var map = { cs: "cs2", pubg: "pubg", clash: "coc" };
    return map[adminKey] || adminKey;
  }

  /* ---------------------------------------------------------------
     YouTube thumbnail URL
     --------------------------------------------------------------- */
  function previewImageUrl(ytId) {
    if (!ytId) return "";
    return "https://i.ytimg.com/vi/" + esc(ytId) + "/hqdefault.jpg";
  }

  /* ---------------------------------------------------------------
     Strimni ijro qilish — ilovaning o'z pleyerida (podcast naqshi)
     --------------------------------------------------------------- */
  function playStream(ytId, title) {
    if (!ytId) return;
    if (typeof window.__playYouTubeStandalone === "function") {
      state.playingId = ytId;
      renderStream();
      try {
        window.__playYouTubeStandalone(ytId, { title: title || "Jonli efir" });
      } catch (_) {}
      return;
    }
    // Fallback: iframe ichida ochish (brauzerda)
    state.playingId = ytId;
    renderStream();
  }

  /* ---------------------------------------------------------------
     Full Screen — Telegram WebApp API bilan
     --------------------------------------------------------------- */
  function toggleStreamFullscreen() {
    var wrap = esportView.querySelector(".stream-frame");
    if (!wrap) return;

    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && typeof tg.requestFullscreen === "function" && !tg.isFullscreen) {
      try { tg.requestFullscreen(); return; } catch (_) {}
    }

    var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (req) {
      try { req.call(wrap); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------------
     Strimni chizish — PREVIEW vs PLAYING holat
     --------------------------------------------------------------- */
  function renderStream() {
    var gameData = state.data[state.game] || {};
    var stream = gameData.stream || {};
    var ytId = extractYoutubeId(stream.youtubeId || stream.url || "");

    // Sarlavha va tavsif
    el.streamTitle.textContent = stream.title || "—";
    el.streamSub.textContent = stream.subtitle || stream.game || "—";

    // Ko'ruvchilar soni (0 bo'lsa yashiriladi)
    var viewers = Number(stream.viewers) || 0;
    if (viewers > 0) {
      el.viewersNum.textContent = formatViews(viewers);
      el.viewers.hidden = false;
    } else {
      el.viewers.hidden = true;
    }

    // LIVE belgisi — faqat jonli bo'lsa ko'rinadi
    var isLive = Boolean(stream.isLive);
    el.liveBadge.hidden = !isLive;
    el.headerPill.style.display = isLive ? "" : "none";

    // Fullscreen tugmasi
    if (el.fullscreen) el.fullscreen.hidden = !ytId;

    if (!ytId) {
      // Video yo'q — bo'sh holatni ko'rsatamiz
      el.streamHost.innerHTML = "";
      el.streamHost.dataset.currentId = "";
      if (el.preview) el.preview.hidden = true;
      el.streamEmpty.hidden = false;
      el.emptyTitle.textContent = stream.title
        ? "Efir hozircha mavjud emas"
        : "Hozircha efir yo'q";
      return;
    }

    // Preview rasmi (ijro qilinmaguncha iframe yo'q)
    if (state.playingId !== ytId) {
      el.streamEmpty.hidden = true;
      el.streamHost.innerHTML = "";
      el.streamHost.dataset.currentId = ytId;
      if (el.preview) {
        el.preview.hidden = false;
        var thumb = previewImageUrl(ytId);
        if (el.previewImg) {
          el.previewImg.src = thumb;
          el.previewImg.alt = stream.title || "Jonli efir";
        }
      }
      return;
    }

    // PLAYING holat — iframe ochiladi (faqat brauzer fallback)
    el.streamEmpty.hidden = true;
    if (el.preview) el.preview.hidden = true;
    if (el.streamHost.dataset.currentId !== ytId) {
      el.streamHost.dataset.currentId = ytId;
      el.streamHost.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' + esc(ytId) +
        '?rel=0&playsinline=1&autoplay=1"' +
        ' title="' + esc(stream.title || "Jonli efir") + '"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
        ' allowfullscreen loading="eager"></iframe>';
    }
  }

  /* ---------------------------------------------------------------
     Haylaytlar ro'yxatini chizish
     --------------------------------------------------------------- */
  function renderHighlights() {
    var gameData = state.data[state.game] || {};
    var items = Array.isArray(gameData.highlights) ? gameData.highlights : [];

    if (!items.length) {
      el.highlights.innerHTML =
        '<div class="card" style="justify-content:center;color:var(--c-hint);font-size:13px;">' +
        "Haylaytlar topilmadi</div>";
      return;
    }

    el.highlights.innerHTML = items.map(function (item) {
      var ytId = extractYoutubeId(item.youtubeId || item.url || "");
      // YouTube rasmi ID bo'yicha avtomatik olinadi
      var thumb = ytId
        ? "https://i.ytimg.com/vi/" + esc(ytId) + "/mqdefault.jpg"
        : "";

      return (
        '<button class="card" type="button" data-yt="' + esc(ytId) + '">' +
          '<span class="card__thumb">' +
            (thumb
              ? '<img src="' + thumb + '" alt="" loading="lazy" ' +
                'onerror="this.style.display=\'none\'">'
              : "") +
          "</span>" +
          '<span class="card__body">' +
            '<span class="card__title">' + esc(item.title || "Nomsiz") + "</span>" +
            '<span class="card__meta">' +
              "<span>" + esc(item.channel || "NTV") + "</span>" +
              (item.views ? '<span class="card__sep">·</span><span>' + esc(formatViews(item.views)) + " ko'rish</span>" : "") +
              (item.time ? '<span class="card__sep">·</span><span>' + esc(item.time) + "</span>" : "") +
            "</span>" +
          "</span>" +
        "</button>"
      );
    }).join("");
  }

  /* ---------------------------------------------------------------
     Matchlar ro'yxatini chizish
     --------------------------------------------------------------- */
  function renderMatches() {
    var gameData = state.data[state.game] || {};
    var items = Array.isArray(gameData.matches) ? gameData.matches : [];

    if (!items.length) {
      el.matches.innerHTML =
        '<div class="card" style="justify-content:center;color:var(--c-hint);font-size:13px;">' +
        "Matchlar topilmadi</div>";
      return;
    }

    el.matches.innerHTML = items.map(function (m) {
      // Holat yorlig'i: jonli / tez orada / bo'sh
      var statusHtml = "";
      if (m.status === "live") {
        statusHtml = '<span class="match-center__status match-center__status--live">Jonli</span>';
      } else if (m.status === "soon") {
        statusHtml = '<span class="match-center__status">Tez orada</span>';
      }

      return (
        '<div class="match-card">' +
          '<div class="match-team match-team--home">' +
            '<span class="match-team__name">' + esc(m.home || "—") + "</span>" +
          "</div>" +
          '<div class="match-center">' +
            '<div class="match-center__time">' + esc(m.time || "—") + "</div>" +
            '<div class="match-center__date">' + esc(m.date || "") + "</div>" +
            statusHtml +
          "</div>" +
          '<div class="match-team match-team--away">' +
            '<span class="match-team__name">' + esc(m.away || "—") + "</span>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------------------------------------------------------------
     Faol tabni almashtirish
     --------------------------------------------------------------- */
  function setGame(gameKey) {
    if (!state.data[gameKey]) return;
    state.game = gameKey;

    // Tab tugmalarining faol holatini yangilash
    var tabs = el.tabs.querySelectorAll(".esport-tab");
    for (var i = 0; i < tabs.length; i++) {
      var isActive = tabs[i].dataset.game === gameKey;
      tabs[i].classList.toggle("is-active", isActive);
      tabs[i].setAttribute("aria-selected", isActive ? "true" : "false");
    }

    // Faol tabni ko'rinish maydoniga surish (uzun ro'yxatlarda qulay)
    var active = el.tabs.querySelector(".esport-tab.is-active");
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    // Kontentni yangilash
    renderStream();
    renderHighlights();
    renderMatches();
  }

  /* ---------------------------------------------------------------
     Admin sozlamalaridan strimni modulga qo'yish
     --------------------------------------------------------------- */
  function applyConfiguredStream(settings) {
    var streams = settings && settings.esportsStreams;
    if (!streams || typeof streams !== "object") return;

    Object.keys(streams).forEach(function (adminKey) {
      var cfg = streams[adminKey];
      if (!cfg || !cfg.enabled) return;
      var ytUrl = cfg.youtubeUrl || "";
      var ytId = extractYoutubeId(ytUrl);
      if (!ytId) return;

      var modKey = settingsToGameKey(adminKey);
      if (!state.data[modKey]) state.data[modKey] = {};
      state.data[modKey].stream = {
        youtubeId: ytId,
        title: cfg.title || cfg.label || "Jonli efir",
        subtitle: cfg.meta || modKey.toUpperCase(),
        isLive: Boolean(cfg.isLive),
        viewers: 0
      };
    });
  }

  /* ---------------------------------------------------------------
     API'dan ma'lumot olish
     API javob bermasa — namuna ma'lumot qoladi (sahifa bo'sh qolmaydi)
     --------------------------------------------------------------- */
  function loadData() {
    // 1) Admin panelda kiritilgan jonli efir sozlamasi
    fetch("/api/settings", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (settings) {
        applyConfiguredStream(settings);
        renderStream();
      })
      .catch(function () { /* API yo'q — namuna qoladi */ });

    // 2) Kibersport kontenti (haylaytlar + matchlar)
    fetch("/api/esport", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || typeof data !== "object") return;
        // Faqat kelgan kalitlarni almashtiramiz — qolgani namuna bo'lib qoladi
        Object.keys(data).forEach(function (key) {
          if (data[key] && typeof data[key] === "object") {
            state.data[key] = Object.assign({}, state.data[key] || {}, data[key]);
          }
        });
        setGame(state.game);
      })
      .catch(function () { /* API yo'q — namuna qoladi */ });
  }

  /* ---------------------------------------------------------------
     Hodisalarni ulash
     --------------------------------------------------------------- */
  function bindEvents() {
    // Tab tugmalari
    el.tabs.addEventListener("click", function (e) {
      var tab = e.target.closest(".esport-tab");
      if (!tab) return;
      setGame(tab.dataset.game);
    });
    // Klaviatura bilan tab almashtirish (qulaylik uchun)
    el.tabs.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var tabs = Array.prototype.slice.call(el.tabs.querySelectorAll(".esport-tab"));
      var idx = tabs.findIndex(function (t) { return t.classList.contains("is-active"); });
      if (idx < 0) return;
      var next = e.key === "ArrowRight"
        ? (idx + 1) % tabs.length
        : (idx - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      setGame(tabs[next].dataset.game);
    });

    // Haylayt kartasiga bosilganda — o'sha video strimda ochiladi
    el.highlights.addEventListener("click", function (e) {
      var card = e.target.closest(".card[data-yt]");
      if (!card) return;
      var ytId = card.dataset.yt;
      if (!ytId) return;

      // Strimni shu videoga almashtiramiz
      var gameData = state.data[state.game];
      gameData.stream = Object.assign({}, gameData.stream, {
        youtubeId: ytId,
        title: card.querySelector(".card__title").textContent,
        isLive: false,
        viewers: 0
      });
      renderStream();

      // Sahifani strimga surish
      esportView.querySelector(".stream-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // Preview ustiga bosilganda — strimni ijro qilish (podcast naqshi)
    if (el.preview) {
      el.preview.addEventListener("click", function () {
        var gameData = state.data[state.game] || {};
        var stream = gameData.stream || {};
        var ytId = extractYoutubeId(stream.youtubeId || stream.url || "");
        if (ytId) playStream(ytId, stream.title);
      });
    }

    // Fullscreen tugmasi
    if (el.fullscreen) {
      el.fullscreen.addEventListener("click", function () {
        toggleStreamFullscreen();
      });
    }

    // "Yangilash" tugmasi
    el.refreshBtn.addEventListener("click", function () {
      loadData();
      renderStream();
      renderHighlights();
      renderMatches();
    });

    // Pastki navigatsiya — FAQAT mustaqil sahifada (.esport-bottom-nav).
    // Asosiy ilovaga ulanganda bu panel index.html da bo'lmaydi; ilovaning
    // o'z .bottom-bar paneli ishlatiladi va kino.js tomonidan boshqariladi.
    var nav = esportView.querySelector(".esport-bottom-nav");
    if (nav) {
      nav.addEventListener("click", function (e) {
        var btn = e.target.closest(".esport-bottom-nav__item");
        if (!btn) return;
        // Kibersport allaqachon faol — qayta yuklamaymiz
        if (btn.dataset.nav === "esport") return;
        console.log("Navigatsiya:", btn.dataset.nav);
      });
    }
  }

  /* ---------------------------------------------------------------
     Telegram WebApp bilan integratsiya
     --------------------------------------------------------------- */
  function initTelegram() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;  // Brauzerda ochilgan

    // Ilovani to'liq balandlikka yoyish
    tg.ready();
    tg.expand();

    // Mavzuni HTML'ga yozamiz — CSS shundan light/dark ni biladi
    var scheme = (tg.colorScheme === "light") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", scheme);

    // Telegram mavzusi o'zgarsa (foydalanuvchi almashtirsa) darhol moslashamiz
    if (tg.onEvent) {
      tg.onEvent("themeChanged", function () {
        document.documentElement.setAttribute(
          "data-theme",
          tg.colorScheme === "light" ? "light" : "dark"
        );
      });
    }

    // Telegram'ning "orqaga" tugmasini ko'rsatamiz
    if (tg.BackButton) tg.BackButton.hide();
  }

  /* ---------------------------------------------------------------
     Ishga tushirish
     --------------------------------------------------------------- */
  function init() {
    initTelegram();
    bindEvents();
    renderStream();
    renderHighlights();
    renderMatches();
    loadData();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---------------------------------------------------------------
     Tashqi interfeys — lazy-loader (kino.js) shu nomlarni chaqiradi.
     Naqsh fifa.js / music.js bilan bir xil:
       openX  -> ko'rsatadi + <body> ga "is-esport" klassini qo'shadi
       closeX -> yashiradi + klassni olib tashlaydi
     --------------------------------------------------------------- */
  function openEsportView() {
    // Boshqa bo'limlar yopilishini kino.js o'zi boshqaradi (sidebar handler).
    esportView.hidden = false;
    document.body.classList.add("is-esport");

    // Joriy o'yin kontenti darhol chizilsin (loading holatisiz)
    renderStream();
    renderHighlights();
    renderMatches();

    // Sahifani yuqoriga suramiz
    var shell = document.getElementById("appShell");
    if (shell) shell.scrollTo({ top: 0, behavior: "smooth" });

    // Telegram "orqaga" tugmasini ro'yxatga olamiz (fifa naqshi)
    try { window.tgBackRegister?.("esport", function () { closeEsportView(); }); } catch (_) {}

    // So'ng real ma'lumotni olib kelib qayta chizamiz:
    //   /api/settings -> esportsStreams (admin panelda kiritilgan strim)
    //   /api/esport   -> haylaytlar va matchlar
    // Ikkalasi ham ishlamasa SAMPLE ma'lumot qoladi.
    loadData();
  }

  function closeEsportView() {
    esportView.hidden = true;
    document.body.classList.remove("is-esport");
    try { window.tgBackUnregister?.("esport"); } catch (_) {}

    // Iframe tozalaymiz (audio fonda qolmasin)
    state.playingId = null;
    if (el.streamHost) {
      el.streamHost.innerHTML = "";
      el.streamHost.dataset.currentId = "";
    }
    if (el.preview) el.preview.hidden = true;
  }

  window.__esport = { openEsportView: openEsportView, closeEsportView: closeEsportView };
})();
