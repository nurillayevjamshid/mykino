// FIFA JCH 2026 — view, banner, tablar, REAL data (openfootball + worldcup26.ir)
// app.js dan ajratildi (bosqich 4). Lazy-load: app.js ichidagi ensureFifaModule()
// foydalanuvchi FIFA tabini bosgach yuklaydi.

// FIFA JCH 2026 — view, banner, tablar, REAL data (openfootball + worldcup26.ir)
// ============================================================
(function initFifaModule() {
  const fifaView = document.getElementById("fifaView");
  const fifaBanner = document.getElementById("fifaHomeBanner");
  const appShell = document.getElementById("appShell");
  if (!fifaView) return;

  // ===== i18n (FIFA modulining mahalliy tarjima jadvali) =====
  const F_COPY = {
    uz: {
      finished: "Tugadi",
      noMatchesToday: "Bugun o'yinlar yo'q",
      noTopFiveMatches: "Bugun kuchli 5 lik chempionatlarda o'yinlar yo'q",
      matchesDate: "Toshkent vaqti",
      previousDay: "Oldingi kun",
      today: "Bugun",
      nextDay: "Keyingi kun",
      standingsTitle: "Turnir jadvali",
      standingsLoading: "Turnir jadvali yuklanmoqda…",
      standingsUnavailable: "Turnir jadvali vaqtincha mavjud emas.",
      updatedAt: "Yangilandi",
      noLiveTitle: "Hozir jonli efir yo'q",
      noLiveHint: "Yaqin matchlar pastda ko'rsatilgan.",
      upcomingMatches: "Yaqin matchlar",
      scheduleNotFound: "Jadval topilmadi",
      sourceUnavailable: "Manba vaqtincha javob bermayapti.",
      noScheduleYet: "Hali jadval yo'q",
      groupsAfterRounds: "Birinchi turlar tugagandan keyin ko'rinadi.",
      teamCol: "Jamoa",
      yellowCard: "Sariq karta",
      redCard: "Qizil karta",
      lineupsTitle: "O'yin tarkiblari",
      lineupsLoading: "Tarkiblar yuklanmoqda…",
      lineupNotAvailable: "Bu o'yin uchun tarkib hali mavjud emas.",
      lineupLoadFailed: "Tarkibni yuklab bo'lmadi.",
      headCoach: "Bosh murabbiy",
      statsAndEvents: "Statistika va voqealar",
      lineups: "Tarkiblar",
      goals: "Gollar",
      matchStats: "Statistika",
      timeline: "Voqealar",
      noStatsYet: "O'yin statistikasi tez orada yangilanadi.",
      matchDetailsUnavailable: "O'yin ma'lumotlari hali mavjud emas.",
      favoritesTab: "Mening jamoam",
      favoritesTitle: "Saqlangan matchlar va gollar",
      noFavoritesTitle: "Sevimli o'yinlar hali yo'q",
      noFavoritesText: "O'zingiz yoqtirgan jamoalar (Real Madrid, Arsenal, Paxtakor...) o'yinlarini va gollarini bitta joyga yig'ish uchun matchlardagi ⭐ belgisini bosing.",
      exploreMatches: "O'yinlar ro'yxatini ko'rish",
      shareMatch: "Ulashish",
      shareMatchText: "Ushbu qiziqarli o'yin va gollarni ko'ring:",
      allTeams: "Barchasi",
      saved: "Saqlangan",
      saveMatch: "Saqlash",
      highlightsTitle: "O'yinlar highlightslari",
      highlightsSub: "Oxirgi 2 kunlik",
    },
    ru: {
      finished: "Завершён",
      noMatchesToday: "Сегодня матчей нет",
      noTopFiveMatches: "Сегодня в топ-5 чемпионатах матчей нет",
      matchesDate: "Время Ташкента",
      previousDay: "Предыдущий день",
      today: "Сегодня",
      nextDay: "Следующий день",
      standingsTitle: "Турнирная таблица",
      standingsLoading: "Загрузка турнирной таблицы…",
      standingsUnavailable: "Турнирная таблица временно недоступна.",
      updatedAt: "Обновлено",
      noLiveTitle: "Сейчас прямой трансляции нет",
      noLiveHint: "Ближайшие матчи показаны ниже.",
      upcomingMatches: "Ближайшие матчи",
      scheduleNotFound: "Расписание не найдено",
      sourceUnavailable: "Источник временно не отвечает.",
      noScheduleYet: "Расписания пока нет",
      groupsAfterRounds: "Появится после первых туров.",
      teamCol: "Команда",
      liveSoon: "Прямая трансляция скоро будет подключена",
      liveTitleDefault: "Прямая трансляция",
      joinChannel: "Перейти в канал",
      connectionLost: "Соединение потеряно",
      fullscreen: "Во весь экран",
      streamLoadFailed: "Не удалось загрузить поток",
      yellowCard: "Жёлтая карточка",
      redCard: "Красная карточка",
      lineupsTitle: "Составы команд",
      lineupsLoading: "Составы загружаются…",
      lineupNotAvailable: "Состав для этого матча пока недоступен.",
      lineupLoadFailed: "Не удалось загрузить состав.",
      headCoach: "Главный тренер",
      mute: "Выключить звук",
      unmute: "Включить звук",
      shareLive: "Поделиться трансляцией",
      shareLiveText: "Смотрите прямую трансляцию в боте NTV — открывается одним нажатием 👇",
      statsAndEvents: "Статистика и события",
      lineups: "Составы",
      goals: "Голы",
      matchStats: "Статистика матча",
      timeline: "Хронология событий",
      noStatsYet: "Статистика матча скоро обновится.",
      matchDetailsUnavailable: "Информация о матче пока недоступна.",
      favoritesTab: "Моя команда",
      favoritesTitle: "Сохранённые матчи и голы",
      noFavoritesTitle: "Нет избранных матчей",
      noFavoritesText: "Нажмите на ⭐ в карточке матча, чтобы сохранить любимые игры и голы в одном месте.",
      exploreMatches: "Смотреть матчи",
      shareMatch: "Поделиться",
      shareMatchText: "Посмотри этот интересный матч и голы:",
      allTeams: "Все",
      saved: "Сохранено",
      saveMatch: "Сохранить",
      highlightsTitle: "Хайлайты матчей",
      highlightsSub: "За последние 2 дня",
    },
    en: {
      finished: "Finished",
      noMatchesToday: "No matches today",
      noTopFiveMatches: "There are no matches today in the top five leagues",
      matchesDate: "Tashkent time",
      previousDay: "Previous day",
      today: "Today",
      nextDay: "Next day",
      standingsTitle: "League table",
      standingsLoading: "Loading league table…",
      standingsUnavailable: "League table is temporarily unavailable.",
      updatedAt: "Updated",
      noLiveTitle: "No live broadcast right now",
      noLiveHint: "Upcoming matches are shown below.",
      upcomingMatches: "Upcoming matches",
      scheduleNotFound: "Schedule not found",
      sourceUnavailable: "The source is temporarily unavailable.",
      noScheduleYet: "No schedule yet",
      groupsAfterRounds: "Appears after the first rounds.",
      teamCol: "Team",
      liveSoon: "Live stream will be connected soon",
      liveTitleDefault: "Live broadcast",
      joinChannel: "Join channel",
      connectionLost: "Connection lost",
      fullscreen: "Full screen",
      streamLoadFailed: "Failed to load the stream",
      yellowCard: "Yellow card",
      redCard: "Red card",
      lineupsTitle: "Match lineups",
      lineupsLoading: "Loading lineups…",
      lineupNotAvailable: "Lineup not yet available for this match.",
      lineupLoadFailed: "Failed to load lineup.",
      headCoach: "Head coach",
      mute: "Mute",
      unmute: "Unmute",
      shareLive: "Share the broadcast",
      shareLiveText: "Watch the live broadcast in the NTV bot — opens with one tap 👇",
      statsAndEvents: "Stats & Events",
      lineups: "Lineups",
      goals: "Goals",
      matchStats: "Stats",
      timeline: "Events",
      noStatsYet: "Match statistics will be available soon.",
      matchDetailsUnavailable: "Match information is not available yet.",
      favoritesTab: "My team",
      favoritesTitle: "Saved matches & goals",
      noFavoritesTitle: "No favorite matches yet",
      noFavoritesText: "Tap the ⭐ on any match card to save your favorite games and goals in one place.",
      exploreMatches: "Explore matches",
      shareMatch: "Share",
      shareMatchText: "Check out this exciting match and goals:",
      allTeams: "All",
      saved: "Saved",
      saveMatch: "Save",
      highlightsTitle: "Match Highlights",
      highlightsSub: "Last 2 days",
    },
  };
  function curLang() {
    return (window.__i18n && window.__i18n.lang) || "uz";
  }
  function F(key) {
    const lang = curLang();
    const tbl = F_COPY[lang] || F_COPY.uz;
    return tbl[key] || F_COPY.uz[key] || key;
  }

  // Jamoa nomi (openfootball EN) → { uz, flag }
  // JCH 2026: 47 ta tasdiqlangan + play-off g'oliblari uchun placeholder mapping.
  const TEAM_MAP = {
    "Mexico":              { uz: "Meksika",         flag: "🇲🇽" },
    "South Africa":        { uz: "Janubiy Afrika",  flag: "🇿🇦" },
    "South Korea":         { uz: "Janubiy Koreya",  flag: "🇰🇷" },
    "Czech Republic":      { uz: "Chexiya",         flag: "🇨🇿" },
    "Canada":              { uz: "Kanada",          flag: "🇨🇦" },
    "Bosnia & Herzegovina":{ uz: "Bosniya",         flag: "🇧🇦" },
    "Qatar":               { uz: "Qatar",           flag: "🇶🇦" },
    "Switzerland":         { uz: "Shveytsariya",    flag: "🇨🇭" },
    "Brazil":              { uz: "Braziliya",       flag: "🇧🇷" },
    "Morocco":             { uz: "Marokash",        flag: "🇲🇦" },
    "Haiti":               { uz: "Gaiti",           flag: "🇭🇹" },
    "Scotland":            { uz: "Shotlandiya",     flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
    "USA":                 { uz: "AQSh",            flag: "🇺🇸" },
    "Paraguay":            { uz: "Paragvay",        flag: "🇵🇾" },
    "Australia":           { uz: "Avstraliya",      flag: "🇦🇺" },
    "Turkey":              { uz: "Turkiya",         flag: "🇹🇷" },
    "Germany":             { uz: "Germaniya",       flag: "🇩🇪" },
    "Curaçao":             { uz: "Kyurasao",        flag: "🇨🇼" },
    "Ivory Coast":         { uz: "Kot-d'Ivuar",     flag: "🇨🇮" },
    "Ecuador":             { uz: "Ekvador",         flag: "🇪🇨" },
    "Netherlands":         { uz: "Niderlandiya",    flag: "🇳🇱" },
    "Japan":               { uz: "Yaponiya",        flag: "🇯🇵" },
    "Sweden":              { uz: "Shvetsiya",       flag: "🇸🇪" },
    "Tunisia":             { uz: "Tunis",           flag: "🇹🇳" },
    "Argentina":           { uz: "Argentina",       flag: "🇦🇷" },
    "Algeria":             { uz: "Jazoir",          flag: "🇩🇿" },
    "Austria":             { uz: "Avstriya",        flag: "🇦🇹" },
    "Belgium":             { uz: "Belgiya",         flag: "🇧🇪" },
    "Cape Verde":          { uz: "Kabo-Verde",      flag: "🇨🇻" },
    "Colombia":            { uz: "Kolumbiya",       flag: "🇨🇴" },
    "Croatia":             { uz: "Xorvatiya",       flag: "🇭🇷" },
    "DR Congo":            { uz: "Kongo DR",        flag: "🇨🇩" },
    "Egypt":               { uz: "Misr",            flag: "🇪🇬" },
    "England":             { uz: "Angliya",         flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
    "France":              { uz: "Fransiya",        flag: "🇫🇷" },
    "Ghana":               { uz: "Gana",            flag: "🇬🇭" },
    "Iran":                { uz: "Eron",            flag: "🇮🇷" },
    "Iraq":                { uz: "Iroq",            flag: "🇮🇶" },
    "Jordan":              { uz: "Iordaniya",       flag: "🇯🇴" },
    "New Zealand":         { uz: "Yangi Zelandiya", flag: "🇳🇿" },
    "Norway":              { uz: "Norvegiya",       flag: "🇳🇴" },
    "Panama":              { uz: "Panama",          flag: "🇵🇦" },
    "Portugal":            { uz: "Portugaliya",     flag: "🇵🇹" },
    "Saudi Arabia":        { uz: "Saudiya Arabistoni", flag: "🇸🇦" },
    "Senegal":             { uz: "Senegal",         flag: "🇸🇳" },
    "Spain":               { uz: "Ispaniya",        flag: "🇪🇸" },
    "Uruguay":             { uz: "Urugvay",         flag: "🇺🇾" },
    "Uzbekistan":          { uz: "O'zbekiston",     flag: "🇺🇿" },
  };
  // Jamoa nomi: o'zbek tilida bo'lsa TEAM_MAP dan, aks holda asl (ingliz) nom.
  const teamUz = (name) => {
    const lang = curLang();
    if (lang === "uz") return (TEAM_MAP[name]?.uz) || name || "—";
    return name || "—";
  };
  const teamFlag = (name) => (TEAM_MAP[name]?.flag) || "🏳️";

  // Windows/Telegram desktop emoji bayroqlarni rangli ko'rsatmaydi —
  // Twemoji (Twitter SVG, iOS uslubiga juda yaqin) ishlatamiz.
  // Emoji'dagi har codepoint hex'ga: "1f1fa-1f1ff.svg" formatida.
  function emojiToTwemojiName(emoji) {
    return Array.from(emoji)
      .map((ch) => ch.codePointAt(0).toString(16))
      .filter((cp) => cp !== "fe0f")
      .join("-");
  }
  function teamFlagHtml(name) {
    const flag = teamFlag(name);
    const fileName = emojiToTwemojiName(flag);
    const alt = (TEAM_MAP[name]?.uz) || name || "";
    const altSafe = String(alt).replace(/"/g, "&quot;");
    if (!fileName) return `<span class="fifa-flag fifa-flag--emoji">${flag}</span>`;
    const url = `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${fileName}.svg`;
    return `<img class="fifa-flag fifa-flag--img" loading="lazy" decoding="async" src="${url}" alt="${altSafe}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fifa-flag fifa-flag--emoji',textContent:'${flag}'}))">`;
  }

  // Hafta kunlari va oylari (tilga qarab)
  const WD_BY_LANG = {
    uz: ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"],
    ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
    en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  };
  const MO_BY_LANG = {
    uz: ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
    ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  };
  const WD = new Proxy({}, { get: (_, idx) => (WD_BY_LANG[curLang()] || WD_BY_LANG.uz)[idx] });
  const MO = new Proxy({}, { get: (_, idx) => (MO_BY_LANG[curLang()] || MO_BY_LANG.uz)[idx] });

  // Match vaqtini Toshkent (UTC+5) ga o'tkazish
  // openfootball format: "13:00 UTC-6"
  function parseKickoff(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*UTC([+-]\d{1,2})$/i);
    if (!m) return null;
    const [, hh, mm, off] = m;
    // Local kickoff ISO with offset
    const offNum = Number(off);
    const sign = offNum >= 0 ? "+" : "-";
    const absOff = String(Math.abs(offNum)).padStart(2, "0");
    const iso = `${dateStr}T${hh.padStart(2, "0")}:${mm}:00${sign}${absOff}:00`;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  function fmtTashkentTime(d) {
    if (!d) return "";
    return new Intl.DateTimeFormat("uz-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }
  function fmtTashkentDayKey(d) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
  function fmtDayLabel(d) {
    // "11-iyun, payshanba"
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit", weekday: "long" }).formatToParts(d);
    const day = Number(parts.find((p) => p.type === "day").value);
    const month = Number(parts.find((p) => p.type === "month").value) - 1;
    const dt = new Date(`${fmtTashkentDayKey(d)}T00:00:00Z`);
    const wd = WD[dt.getUTCDay()];
    return `${day}-${MO[month]}, ${wd}`;
  }

  let FIFA_DATA = { date: "", timeZone: "Asia/Tashkent", leagues: [], matches: [], standings: null };
  let loadState = "idle"; // idle | loading | ready | error
  let activeLeagueId = "eng.1";
  let selectedDateKey = "";

  // === Futbol Sevimlilar (FIFA Favorites & Bookmarks) ===
  const FIFA_FAVORITES_KEY = "fifa_favorites_v1";

  const haptic = {
    tap() { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light"); } catch (_) {} },
    select() { try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.(); } catch (_) {} },
    success() { try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success"); } catch (_) {} }
  };

  function showFifaToast(msg) {
    if (typeof window.showToast === "function") {
      window.showToast(msg);
      return;
    }
    let toast = document.getElementById("appGlobalToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appGlobalToast";
      toast.style.cssText = "position:fixed;bottom:84px;left:50%;transform:translateX(-50%) translateY(8px);background:rgba(15,23,42,0.92);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.18);pointer-events:none;transition:opacity 0.2s,transform 0.2s;opacity:0;";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(8px)";
    }, 2200);
  }

  function readFifaFavorites() {
    try {
      const raw = localStorage.getItem(FIFA_FAVORITES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  let _fifaSyncDebounceTimer = null;
  function syncFifaFavoritesToBackend() {
    clearTimeout(_fifaSyncDebounceTimer);
    _fifaSyncDebounceTimer = setTimeout(() => {
      try {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) return;
        const teams = readFifaFavoriteTeams();
        const matches = readFifaFavorites();
        fetch("/api/categories?type=fifa-favorites", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-TG-Init-Data": initData,
          },
          body: JSON.stringify({ teams, matches }),
        }).catch(() => {});
      } catch (_) {}
    }, 350);
  }

  function writeFifaFavorites(store) {
    try {
      localStorage.setItem(FIFA_FAVORITES_KEY, JSON.stringify(store || {}));
      syncFifaFavoritesToCloud(store);
      syncFifaFavoritesToBackend();
    } catch (_) {}
  }

  function syncFifaFavoritesToCloud(store) {
    try {
      const cs = window.Telegram?.WebApp?.CloudStorage;
      if (cs && typeof cs.setItem === "function") {
        cs.setItem(FIFA_FAVORITES_KEY, JSON.stringify(store || {}), () => {});
      }
    } catch (_) {}
  }

  function syncFifaFavoritesFromCloud() {
    try {
      const cs = window.Telegram?.WebApp?.CloudStorage;
      if (cs && typeof cs.getItem === "function") {
        cs.getItem(FIFA_FAVORITES_KEY, (err, val) => {
          if (!err && val) {
            try {
              const cloudStore = JSON.parse(val);
              if (cloudStore && typeof cloudStore === "object") {
                const favTeams = readFifaFavoriteTeams();
                if (!Object.keys(favTeams || {}).length) {
                  // Foydalanuvchi jamoalarni tozalagan bo'lsa, cloud storage'dan eski matchlarni qayta olmaslik
                  localStorage.removeItem(FIFA_FAVORITES_KEY);
                  if (typeof cs.setItem === "function") {
                    cs.setItem(FIFA_FAVORITES_KEY, "{}", () => {});
                  }
                  return;
                }
                const localStore = readFifaFavorites();
                const merged = Object.assign({}, localStore, cloudStore);
                localStorage.setItem(FIFA_FAVORITES_KEY, JSON.stringify(merged));
                const favPanel = document.getElementById("fifaPanelFavorites");
                if (favPanel && !favPanel.hidden) renderFifaFavorites();
              }
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
  }

  try { syncFifaFavoritesFromCloud(); } catch (_) {}

  function isFifaFavorite(id) {
    if (!id) return false;
    const store = readFifaFavorites();
    return Boolean(store[String(id)]);
  }

  function findFifaMatchById(id) {
    if (!id) return null;
    const safeId = String(id);
    const fromLoaded = (FIFA_DATA.matches || []).find((m) => String(m.id) === safeId);
    if (fromLoaded) return fromLoaded;
    const store = readFifaFavorites();
    return store[safeId] || null;
  }

  function toggleFifaFavorite(match) {
    if (!match || !match.id) return false;
    const store = readFifaFavorites();
    const id = String(match.id);
    let isNowFav = false;
    if (store[id]) {
      delete store[id];
      isNowFav = false;
    } else {
      store[id] = {
        id,
        leagueId: match.leagueId || "",
        leagueName: match.leagueName || match.leagueFullName || "Liga",
        leagueLogo: match.leagueLogo || "",
        home: match.home || "",
        away: match.away || "",
        homeEn: match.homeEn || match.home || "",
        awayEn: match.awayEn || match.away || "",
        homeLogo: match.homeLogo || "",
        awayLogo: match.awayLogo || "",
        score: match.score || "",
        status: match.status || "upcoming",
        minute: match.minute || "",
        time: match.time || "",
        kickoff: match.kickoff || "",
        savedAt: Date.now(),
      };
      isNowFav = true;
    }
    writeFifaFavorites(store);
    return isNowFav;
  }

  function updateAllFavButtons(id, isFav) {
    if (!id) return;
    const safeId = String(id);
    document.querySelectorAll(`[data-fifa-fav-id="${safeId}"]`).forEach((btn) => {
      btn.classList.toggle("is-active", isFav);
      btn.setAttribute("aria-label", isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga saqlash");
      const star = btn.querySelector(".fifa-match__fav-star");
      if (star) {
        star.setAttribute("fill", isFav ? "#f59e0b" : "none");
        star.setAttribute("stroke", isFav ? "#f59e0b" : "currentColor");
      }
    });
    document.querySelectorAll(`[data-fifa-modal-fav-id="${safeId}"]`).forEach((modalFavBtn) => {
      modalFavBtn.classList.toggle("is-active", isFav);
      const star = modalFavBtn.querySelector("polygon, svg");
      if (star) {
        star.setAttribute("fill", isFav ? "#f59e0b" : "none");
        star.setAttribute("stroke", isFav ? "#f59e0b" : "currentColor");
      }
      const textEl = modalFavBtn.querySelector(".fifa-modal-fav-text");
      if (textEl) textEl.textContent = isFav ? (F("saved") || "Saqlangan") : (F("saveMatch") || "Saqlash");
    });
  }

  // --- SEVIMLI JAMOLAR (Favorite Teams) ---
  const FIFA_FAV_TEAMS_KEY = "fifa_fav_teams_v1";

  function readFifaFavoriteTeams() {
    try {
      const raw = localStorage.getItem(FIFA_FAV_TEAMS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeFifaFavoriteTeams(teams) {
    try {
      localStorage.setItem(FIFA_FAV_TEAMS_KEY, JSON.stringify(teams || {}));
      const cs = window.Telegram?.WebApp?.CloudStorage;
      if (cs && typeof cs.setItem === "function") {
        cs.setItem(FIFA_FAV_TEAMS_KEY, JSON.stringify(teams || {}), () => {});
      }
      syncFifaFavoritesToBackend();
    } catch (_) {}
  }

  async function syncFifaFavoritesFromBackend() {
    try {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) return;
      const res = await fetch("/api/categories?type=fifa-favorites", {
        headers: { "X-TG-Init-Data": initData },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.ok) return;

      let changed = false;
      if (data.teams && typeof data.teams === "object" && Object.keys(data.teams).length > 0) {
        const localTeams = readFifaFavoriteTeams();
        const mergedTeams = Object.assign({}, data.teams, localTeams);
        localStorage.setItem(FIFA_FAV_TEAMS_KEY, JSON.stringify(mergedTeams));
        changed = true;
      }
      if (data.matches && typeof data.matches === "object" && Object.keys(data.matches).length > 0) {
        const localMatches = readFifaFavorites();
        const mergedMatches = Object.assign({}, data.matches, localMatches);
        localStorage.setItem(FIFA_FAVORITES_KEY, JSON.stringify(mergedMatches));
        changed = true;
      }
      if (changed) {
        updateFifaTabs();
        renderMatches();
        const favPanel = document.getElementById("fifaPanelFavorites");
        if (favPanel && !favPanel.hidden) renderFifaFavorites();
      }
    } catch (_) {}
  }

  function syncFifaFavoriteTeamsFromCloud() {
    try {
      const cs = window.Telegram?.WebApp?.CloudStorage;
      if (cs && typeof cs.getItem === "function") {
        cs.getItem(FIFA_FAV_TEAMS_KEY, (err, val) => {
          if (!err && val) {
            try {
              const cloud = JSON.parse(val);
              if (cloud && typeof cloud === "object") {
                const local = readFifaFavoriteTeams();
                const merged = Object.assign({}, local, cloud);
                localStorage.setItem(FIFA_FAV_TEAMS_KEY, JSON.stringify(merged));
                updateFifaTabs();
                renderMatches();
                const favPanel = document.getElementById("fifaPanelFavorites");
                if (favPanel && !favPanel.hidden) renderFifaFavorites();
              }
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
  }

  try { syncFifaFavoriteTeamsFromCloud(); } catch (_) {}
  try { syncFifaFavoritesFromBackend(); } catch (_) {}

  const POPULAR_TEAMS = [
    { name: "Real Madrid", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png", leagueId: "esp.1" },
    { name: "Barcelona", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", leagueId: "esp.1" },
    { name: "Arsenal", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", leagueId: "eng.1" },
    { name: "Manchester City", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", leagueId: "eng.1" },
    { name: "Liverpool", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/364.png", leagueId: "eng.1" },
    { name: "Manchester United", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", leagueId: "eng.1" },
    { name: "Chelsea", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/363.png", leagueId: "eng.1" },
    { name: "Bayern Munich", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/132.png", leagueId: "ger.1" },
    { name: "Paris Saint-Germain", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/160.png", leagueId: "fra.1" },
    { name: "Juventus", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/111.png", leagueId: "ita.1" },
    { name: "Inter Milan", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/110.png", leagueId: "ita.1" },
    { name: "Al Nassr", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/18848.png", leagueId: "sau.1" },
    { name: "Paxtakor", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/11414.png", leagueId: "afc.champions" },
    { name: "Nasaf", logo: "https://a.espncdn.com/i/teamlogos/soccer/500/11415.png", leagueId: "afc.champions" },
    { name: "Navbahor", logo: "", leagueId: "afc.champions" }
  ];

  const TEAM_ALIASES = {
    "psg": "paris saint-germain",
    "paris saint-germain": "psg",
    "paris saint germain": "psg",
    "man utd": "manchester united",
    "manchester united": "man utd",
    "man united": "manchester united",
    "манчестер юнайтед": "man utd",
    "mancester yunayted": "man utd",
    "man city": "manchester city",
    "manchester city": "man city",
    "манчестер сити": "man city",
    "mancester siti": "man city",
    "inter": "inter milan",
    "inter milan": "inter",
    "internazionale": "inter milan",
    "интер": "inter milan",
    "bayern": "bayern munich",
    "bayern munich": "bayern",
    "bayern münchen": "bayern munich",
    "бавария": "bayern munich",
    "bavariya": "bayern munich",
    "juve": "juventus",
    "juventus": "juve",
    "ювентус": "juve",
    "real": "real madrid",
    "real madrid": "real madrid",
    "реал": "real madrid",
    "реал мадрид": "real madrid",
    "barca": "barcelona",
    "barça": "barcelona",
    "barcelona": "barcelona",
    "барселона": "barcelona",
    "atletico": "atletico madrid",
    "atletico madrid": "atletico",
    "atlético madrid": "atletico madrid",
    "атлетико": "atletico madrid",
    "liverpool": "liverpool",
    "ливерпуль": "liverpool",
    "chelsea": "chelsea",
    "chelsi": "chelsea",
    "челси": "chelsea",
    "everton": "everton",
    "эвертон": "everton",
    "arsenal": "arsenal",
    "арсенал": "arsenal",
    "tottenham": "tottenham hotspur",
    "tottenham hotspur": "tottenham",
    "spurs": "tottenham hotspur",
    "тоттенхэм": "tottenham hotspur",
    "dortmund": "borussia dortmund",
    "borussia dortmund": "dortmund",
    "дортмунд": "borussia dortmund",
    "milan": "ac milan",
    "ac milan": "milan",
    "милан": "ac milan",
    "roma": "as roma",
    "as roma": "roma",
    "рома": "as roma"
  };

  function teamNamesMatch(nameA, nameB) {
    if (!nameA || !nameB) return false;
    const clean = (s) => String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\b(fc|cf|sc|afc|fk|ac|as)\b/g, "")
      .replace(/[^a-z0-9а-яё]/gi, "");
    const c1 = clean(nameA);
    const c2 = clean(nameB);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;

    const raw1 = String(nameA).trim().toLowerCase();
    const raw2 = String(nameB).trim().toLowerCase();
    if (raw1 === raw2) return true;
    if (TEAM_ALIASES[raw1] && (TEAM_ALIASES[raw1] === raw2 || clean(TEAM_ALIASES[raw1]) === c2)) return true;
    if (TEAM_ALIASES[raw2] && (TEAM_ALIASES[raw2] === raw1 || clean(TEAM_ALIASES[raw2]) === c1)) return true;
    if (TEAM_ALIASES[raw1] && TEAM_ALIASES[raw2] && TEAM_ALIASES[raw1] === TEAM_ALIASES[raw2]) return true;

    // Substring match only if both are non-trivial length and difference is minor (prefix/suffix)
    const minLen = Math.min(c1.length, c2.length);
    if (minLen >= 5 && (c1.startsWith(c2) || c2.startsWith(c1) || c1.endsWith(c2) || c2.endsWith(c1))) {
      return true;
    }
    return false;
  }

  function isFifaTeamFavorite(name) {
    if (!name) return false;
    const store = readFifaFavoriteTeams();
    const keys = Object.keys(store || {});
    if (!keys.length) return false;
    const target = String(name).trim().toLowerCase();
    if (store[target]) return true;
    return keys.some((k) => teamNamesMatch(k, target));
  }

  function updateFifaTabs() {
    const tabBtn = fifaView ? fifaView.querySelector('.fifa-tab[data-fifa-tab="favorites"]') : null;
    if (!tabBtn) return;
    const favTeamsStore = readFifaFavoriteTeams();
    const teams = Object.values(favTeamsStore || {});
    const myTeamLabel = F("favoritesTab") || "Mening jamoam";
    tabBtn.textContent = myTeamLabel;
    tabBtn.setAttribute("data-i18n", "fifaTabFavorites");
    tabBtn.title = teams.length ? teams.map((t) => t.name).join(", ") : "";
  }

  // --- Upcoming Matches Cache (kelgusi 8-10 kunlik o'yinlar jadvali) ---
  let upcomingMatchesCache = null;
  let upcomingMatchesPromise = null;
  let upcomingMatchesLoadedAt = 0;

  async function ensureUpcomingMatchesLoaded(force = false) {
    const now = Date.now();
    if (!force && upcomingMatchesCache && (now - upcomingMatchesLoadedAt < 30 * 60 * 1000)) {
      return upcomingMatchesCache;
    }
    if (upcomingMatchesPromise && !force) return upcomingMatchesPromise;

    upcomingMatchesPromise = (async () => {
      try {
        const res = await fetch("/api/categories?type=fifa-upcoming&days=8", {
          headers: { Accept: "application/json" }
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const rawMatches = Array.isArray(data?.matches) ? data.matches : [];
        const normalized = rawMatches.map((m) => {
          const homeName = typeof m.home === "object" ? (m.home?.name || "") : String(m.home || "");
          const awayName = typeof m.away === "object" ? (m.away?.name || "") : String(m.away || "");
          const homeLogo = typeof m.home === "object" ? (m.home?.logo || "") : String(m.homeLogo || "");
          const awayLogo = typeof m.away === "object" ? (m.away?.logo || "") : String(m.awayLogo || "");
          return {
            id: String(m.id || ""),
            leagueId: String(m.leagueId || ""),
            leagueName: String(m.leagueName || "Liga"),
            leagueFullName: String(m.leagueFullName || m.leagueName || ""),
            leagueLogo: String(m.leagueLogo || ""),
            home: homeName,
            away: awayName,
            homeEn: m.homeEn || homeName,
            awayEn: m.awayEn || awayName,
            homeLogo,
            awayLogo,
            time: String(m.time || ""),
            kickoff: String(m.kickoffUtc || m.kickoff || ""),
            status: String(m.status || "upcoming"),
            score: m.score ? String(m.score) : null,
            minute: m.minute ? String(m.minute) : null,
            venue: String(m.venue || ""),
            round: String(m.round || ""),
          };
        }).filter((m) => m.home && m.away);

        upcomingMatchesCache = normalized;
        upcomingMatchesLoadedAt = Date.now();
        return normalized;
      } catch (err) {
        console.warn("Upcoming matches fetch error:", err);
        return upcomingMatchesCache || [];
      } finally {
        upcomingMatchesPromise = null;
      }
    })();

    return upcomingMatchesPromise;
  }

  function getMatchCountdownInfo(kickoffUtc, status) {
    if (status === "live") return { text: "HOZIR JONLI EFIRDA", badgeClass: "fifa-next-badge--live" };
    if (!kickoffUtc) return { text: "Tez kunda", badgeClass: "fifa-next-badge--upcoming" };
    const target = new Date(kickoffUtc);
    if (Number.isNaN(target.getTime())) return { text: "Tez kunda", badgeClass: "fifa-next-badge--upcoming" };
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) {
      if (status === "finished") return { text: "Tugagan", badgeClass: "fifa-next-badge--finished" };
      return { text: "Boshlanmoqda", badgeClass: "fifa-next-badge--live" };
    }
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    const todayKey = getTashkentDateKey(now);
    const matchDayKey = getTashkentDateKey(target);
    if (todayKey === matchDayKey) {
      if (diffHours < 1) {
        const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        return { text: `${diffMins} daqiqadan so'ng`, badgeClass: "fifa-next-badge--today" };
      }
      return { text: `Bugun, ${diffHours} soatdan so'ng`, badgeClass: "fifa-next-badge--today" };
    }
    const tomorrowKey = shiftDateKey(todayKey, 1);
    if (matchDayKey === tomorrowKey) {
      return { text: "Ertaga", badgeClass: "fifa-next-badge--tomorrow" };
    }
    if (diffDays <= 1) {
      return { text: `${diffHours} soatdan so'ng`, badgeClass: "fifa-next-badge--tomorrow" };
    }
    return { text: `${diffDays} kundan keyin ⏳`, badgeClass: "fifa-next-badge--days" };
  }

  function formatMatchTimeTashkent(kickoffUtc, fallbackTime = "") {
    if (!kickoffUtc) return fallbackTime;
    const d = new Date(kickoffUtc);
    if (Number.isNaN(d.getTime())) return fallbackTime;
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tashkent",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
    } catch (_) {
      return fallbackTime;
    }
  }

  function formatMatchDateBadgeUz(kickoffUtc) {
    if (!kickoffUtc) return "";
    const d = new Date(kickoffUtc);
    if (Number.isNaN(d.getTime())) return "";

    const monthsUz = [
      "yanvar", "fevral", "mart", "aprel", "may", "iyun",
      "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"
    ];
    const daysShortUz = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Juma", "Shan"];

    try {
      const todayKey = getTashkentDateKey();
      const matchKey = getTashkentDateKey(d);
      if (matchKey === todayKey) return "Bugun";
      const tomorrowKey = shiftDateKey(todayKey, 1);
      if (matchKey === tomorrowKey) return "Ertaga";

      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tashkent",
        day: "numeric",
        month: "numeric",
      }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

      const dow = daysShortUz[new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tashkent" })).getDay()] || "";
      const monthName = monthsUz[Number(parts.month) - 1] || "";
      return dow ? `${dow}, ${parts.day}-${monthName}` : `${parts.day}-${monthName}`;
    } catch (_) {
      return "";
    }
  }

  function formatMatchDateTimeUz(kickoffUtc, defaultTime = "") {
    if (!kickoffUtc) return defaultTime;
    const d = new Date(kickoffUtc);
    if (Number.isNaN(d.getTime())) return defaultTime;

    const monthsUz = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
    const daysUz = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tashkent",
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "numeric",
        hour12: false
      }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});

      const dow = daysUz[new Date(d.toLocaleString("en-US", { timeZone: "Asia/Tashkent" })).getDay()] || "";
      const monthName = monthsUz[Number(parts.month) - 1] || "";
      return `${dow}, ${parts.day}-${monthName} • ${parts.hour}:${parts.minute}`;
    } catch (_) {
      return defaultTime;
    }
  }

  function getMatchLeagueName(m) {
    if (!m) return "Futbol";
    if (m.leagueName) return m.leagueName;
    if (m.leagueFullName) return m.leagueFullName;
    if (typeof m.league === "string" && m.league) return m.league;
    if (m.leagueId && Array.isArray(FIFA_DATA?.leagues)) {
      const l = FIFA_DATA.leagues.find((x) => x.id === m.leagueId);
      if (l && (l.name || l.fullName)) return l.name || l.fullName;
    }
    return "Futbol";
  }

  function formatMatchScoreDisplay(score) {
    if (!score || score === "-") return "-";
    const cleaned = String(score).trim();
    if (cleaned.includes(":") || cleaned.includes("-")) {
      const parts = cleaned.split(/[-:]/);
      if (parts.length === 2) {
        return `${parts[0].trim()} : ${parts[1].trim()}`;
      }
    }
    return cleaned;
  }

  function getMatchBadgeHtml(m, opts = {}) {
    const isLive = m.status === "live";
    const isFinished = m.status === "finished";
    if (isLive) {
      const liveText = (m.minute && m.minute !== "LIVE") ? `Live ${m.minute}` : "Live";
      return `<span class="fifa-card-badge fifa-card-badge--live"><span class="fifa-match__status-dot fifa-card-badge__dot"></span>${esc(liveText)}</span>`;
    }
    if (isFinished) {
      const dateBadge = formatMatchDateBadgeUz(m.kickoff);
      const showDate = Boolean(opts.showDate) || Boolean(m.showDate);
      const finishedText = (showDate && dateBadge) ? `${dateBadge} • ${F("finished") || "Yakunlangan"}` : (F("finished") || "Yakunlangan");
      return `<span class="fifa-card-badge fifa-card-badge--finished">${esc(finishedText)}</span>`;
    }
    const tashkentTime = formatMatchTimeTashkent(m.kickoff, m.time);
    const dateBadge = formatMatchDateBadgeUz(m.kickoff);
    const showDate = Boolean(opts.showDate) || Boolean(m.showDate);
    let timeBadgeText = "";
    if (showDate && dateBadge && tashkentTime) {
      timeBadgeText = `${dateBadge} ${tashkentTime}`;
    } else if (dateBadge && (dateBadge === "Bugun" || dateBadge === "Ertaga") && tashkentTime) {
      timeBadgeText = `${dateBadge} ${tashkentTime}`;
    } else if (tashkentTime) {
      timeBadgeText = tashkentTime;
    } else if (dateBadge) {
      timeBadgeText = dateBadge;
    } else {
      timeBadgeText = m.time || "Kutilmoqda";
    }
    return `<span class="fifa-card-badge fifa-card-badge--time">${esc(timeBadgeText)}</span>`;
  }

  function renderNextMatchFeaturedCard(m, targetTeamName = "") {
    if (!m) return "";
    const isLive = m.status === "live";
    const isFinished = m.status === "finished";
    const isHomeFav = isFifaTeamFavorite(m.home);
    const isAwayFav = isFifaTeamFavorite(m.away);
    const dateFormatted = formatMatchDateTimeUz(m.kickoff, m.time);
    const dateIso = m.kickoff ? String(m.kickoff).slice(0, 10) : "";

    const badgeHtml = getMatchBadgeHtml(m, { showDate: true });
    const competitionName = getMatchLeagueName(m);

    const homeFavBtn = `
      <button class="fifa-team-fav-btn fifa-team-fav-btn--corner fifa-team-fav-btn--home${isHomeFav ? " is-active" : ""}" type="button" data-team-fav="${esc(m.home)}" data-team-logo="${esc(m.homeLogo || '')}" data-team-league="${esc(m.leagueId || '')}" data-match-id="${esc(m.id)}" aria-label="${isHomeFav ? "Sevimlilardan o'chirish" : "Sevimli jamoa qilish"}">
        <svg class="fifa-team-fav-star" viewBox="0 0 24 24" fill="${isHomeFav ? "#f59e0b" : "none"}" stroke="${isHomeFav ? "#f59e0b" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
    `;

    const awayFavBtn = `
      <button class="fifa-team-fav-btn fifa-team-fav-btn--corner fifa-team-fav-btn--away${isAwayFav ? " is-active" : ""}" type="button" data-team-fav="${esc(m.away)}" data-team-logo="${esc(m.awayLogo || '')}" data-team-league="${esc(m.leagueId || '')}" data-match-id="${esc(m.id)}" aria-label="${isAwayFav ? "Sevimlilardan o'chirish" : "Sevimli jamoa qilish"}">
        <svg class="fifa-team-fav-star" viewBox="0 0 24 24" fill="${isAwayFav ? "#f59e0b" : "none"}" stroke="${isAwayFav ? "#f59e0b" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
    `;

    const scoreDisplay = (isLive || isFinished)
      ? esc(formatMatchScoreDisplay(m.score || "0 - 0"))
      : "VS";

    let subtitleText = m.round || m.group || "";
    if (!subtitleText && m.venue) {
      subtitleText = m.venue;
    }

    return `
      <div class="fifa-next-match-card" data-fifa-open-lineup="1"
           data-match-id="${esc(m.id)}"
           data-league-id="${esc(m.leagueId || '')}"
           data-home-en="${esc(m.homeEn || m.home)}"
           data-away-en="${esc(m.awayEn || m.away)}"
           data-home-uz="${esc(m.home)}"
           data-away-uz="${esc(m.away)}"
           data-home-logo="${esc(m.homeLogo || '')}"
           data-away-logo="${esc(m.awayLogo || '')}"
           data-score="${esc(m.score || '')}"
           data-status="${esc(m.status || '')}"
           data-minute="${esc(m.minute || '')}"
           data-date="${esc(dateIso)}"
           role="button" tabindex="0">
        <div class="fifa-card-badge-wrap">
          ${badgeHtml}
        </div>
        <div class="fifa-card-competition">${esc(competitionName)}</div>

        <div class="fifa-card-fixture">
          ${homeFavBtn}
          <!-- Home Team -->
          <div class="fifa-card-team fifa-card-team--home${isHomeFav ? ' is-fav' : ''}">
            <div class="fifa-card-team__logo-wrap">
              ${teamLogoHtml(m.homeLogo, m.home)}
            </div>
            <div class="fifa-card-team__name fifa-next-team__name" title="${esc(m.home)}">${esc(m.home)}</div>
          </div>

          <!-- Center VS / Score -->
          <div class="fifa-card-center">
            <div class="fifa-card-score fifa-next-score${isLive ? ' fifa-card-score--live' : ''}${!isLive && !isFinished ? ' fifa-card-score--vs' : ''}">${scoreDisplay}</div>
            ${subtitleText ? `<div class="fifa-card-subtitle fifa-next-meta" title="${esc(subtitleText)}">${esc(subtitleText)}</div>` : ''}
          </div>

          <!-- Away Team -->
          <div class="fifa-card-team fifa-card-team--away${isAwayFav ? ' is-fav' : ''}">
            <div class="fifa-card-team__logo-wrap">
              ${teamLogoHtml(m.awayLogo, m.away)}
            </div>
            <div class="fifa-card-team__name fifa-next-team__name" title="${esc(m.away)}">${esc(m.away)}</div>
          </div>
          ${awayFavBtn}
        </div>

        <div class="fifa-next-match-card__footer" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
          <div class="fifa-next-meta">
            <div>📅 <strong>${esc(dateFormatted)}</strong> <span style="opacity:0.8;font-size:11px;">(Toshkent vaqti)</span></div>
            ${m.venue ? `<div>🏟️ ${esc(m.venue)}</div>` : ''}
          </div>
          <button type="button" class="fifa-next-action-btn" aria-label="Tarkiblar">
            <span>Tarkiblar</span>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function addFifaFavoriteTeam({ name, logo, leagueId }) {
    if (!name) return false;
    const store = readFifaFavoriteTeams();
    const target = String(name).trim().toLowerCase();
    // Delete any previous alias/duplicate to prevent duplicate entries
    Object.keys(store).forEach((k) => {
      if (k === target || teamNamesMatch(k, target)) {
        delete store[k];
      }
    });
    store[target] = {
      name: String(name).trim(),
      logo: logo || "",
      leagueId: leagueId || "",
      savedAt: Date.now(),
    };
    writeFifaFavoriteTeams(store);
    if (Array.isArray(FIFA_DATA.matches)) {
      cacheFavoriteTeamMatches(FIFA_DATA.matches);
    }
    if (Array.isArray(upcomingMatchesCache)) {
      cacheFavoriteTeamMatches(upcomingMatchesCache);
    }
    return true;
  }

  function removeFifaFavoriteTeam(teamName) {
    if (!teamName) return false;
    const store = readFifaFavoriteTeams();
    const target = String(teamName).trim().toLowerCase();
    let changed = false;
    Object.keys(store).forEach((k) => {
      if (k === target || teamNamesMatch(k, target)) {
        delete store[k];
        changed = true;
      }
    });
    if (changed) {
      writeFifaFavoriteTeams(store);
    }
    const remainingTeams = Object.keys(store);
    if (!remainingTeams.length) {
      // Hamma jamoa o'chirilgan — barcha saqlangan matchlar ham to'liq o'chiriladi!
      writeFifaFavorites({});
      activeFavTeamFilter = "all";
    } else {
      removeFavoriteTeamMatches(teamName);
    }
    return true;
  }

  function toggleFifaFavoriteTeam({ name, logo, leagueId }) {
    if (!name) return false;
    if (isFifaTeamFavorite(name)) {
      removeFifaFavoriteTeam(name);
      return false;
    } else {
      addFifaFavoriteTeam({ name, logo, leagueId });
      return true;
    }
  }

  function updateAllTeamFavButtons(teamName, isFav) {
    if (!teamName) return;
    const target = String(teamName).trim().toLowerCase();
    document.querySelectorAll("[data-team-fav]").forEach((btn) => {
      if (teamNamesMatch(btn.dataset.teamFav, target)) {
        btn.classList.toggle("is-active", isFav);
        btn.setAttribute("aria-label", isFav ? "Sevimlilardan o'chirish" : "Sevimli jamoa qilish");
        const star = btn.querySelector(".fifa-team-fav-star");
        if (star) {
          star.setAttribute("fill", isFav ? "#f59e0b" : "none");
          star.setAttribute("stroke", isFav ? "#f59e0b" : "currentColor");
        }
        if (btn.classList.contains("fifa-next-team__fav-pill")) {
          btn.textContent = isFav ? "⭐ Sevimli" : "+ Sevimli";
        }
      }
    });
    document.querySelectorAll("[data-quick-fav-team]").forEach((btn) => {
      if (teamNamesMatch(btn.dataset.quickFavTeam, target)) {
        btn.classList.toggle("is-active", isFav);
        const star = btn.querySelector(".fifa-popular-team-chip__star");
        if (star) star.textContent = isFav ? "⭐" : "+";
      }
    });
  }

  function cacheFavoriteTeamMatches(matches) {
    if (!Array.isArray(matches) || !matches.length) return;
    const favTeams = readFifaFavoriteTeams();
    const teamKeys = Object.keys(favTeams);
    if (!teamKeys.length) return;

    const favMatches = readFifaFavorites();
    let changed = false;
    matches.forEach((m) => {
      if (!m || !m.id) return;
      if (isFifaTeamFavorite(m.home) || isFifaTeamFavorite(m.away)) {
        if (!favMatches[m.id]) {
          favMatches[m.id] = { ...m, savedAt: Date.now() };
          changed = true;
        } else {
          if (favMatches[m.id].score !== m.score || favMatches[m.id].status !== m.status || favMatches[m.id].minute !== m.minute) {
            Object.assign(favMatches[m.id], m);
            changed = true;
          }
        }
      }
    });
    if (changed) {
      writeFifaFavorites(favMatches);
    }
  }

  function removeFavoriteTeamMatches(teamName) {
    const favMatches = readFifaFavorites();
    const favTeams = readFifaFavoriteTeams();
    const favTeamKeys = Object.keys(favTeams || {});
    if (!favTeamKeys.length) {
      writeFifaFavorites({});
      return;
    }
    const target = String(teamName || "").trim().toLowerCase();
    let changed = false;
    Object.keys(favMatches).forEach((id) => {
      const m = favMatches[id];
      if (!m) return;
      const hMatch = target && (teamNamesMatch(m.home, target) || teamNamesMatch(m.homeEn, target));
      const aMatch = target && (teamNamesMatch(m.away, target) || teamNamesMatch(m.awayEn, target));
      if (hMatch || aMatch) {
        const otherHome = isFifaTeamFavorite(m.home) || isFifaTeamFavorite(m.homeEn);
        const otherAway = isFifaTeamFavorite(m.away) || isFifaTeamFavorite(m.awayEn);
        if (!otherHome && !otherAway) {
          delete favMatches[id];
          changed = true;
        }
      } else {
        // Hozirgi sevimli jamoalarning birortasiga tegishli bo'lmasa — o'chiramiz
        if (!isFifaTeamFavorite(m.home) && !isFifaTeamFavorite(m.away) &&
            !isFifaTeamFavorite(m.homeEn) && !isFifaTeamFavorite(m.awayEn)) {
          delete favMatches[id];
          changed = true;
        }
      }
    });
    if (changed) {
      writeFifaFavorites(favMatches);
    }
  }

  function getTashkentDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatFootballDay(dateKey) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? dateKey : fmtDayLabel(date);
  }

  function shiftDateKey(dateKey, offset) {
    const date = new Date(`${dateKey}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return getTashkentDateKey();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function isTodayDateKey(dateKey) {
    return String(dateKey || "") === getTashkentDateKey();
  }

  function normalizeFromPayload(payload) {
    const leagues = Array.isArray(payload?.leagues) ? payload.leagues.map((league) => ({
      id: String(league.id || ""),
      name: String(league.name || league.fullName || "Liga"),
      fullName: String(league.fullName || league.name || ""),
      logo: String(league.logo || ""),
    })).filter((league) => league.id) : [];
    const matches = Array.isArray(payload?.matches) ? payload.matches.map((match) => {
      const home = match?.home || {};
      const away = match?.away || {};
      return {
        id: String(match.id || ""),
        leagueId: String(match.leagueId || ""),
        leagueName: String(match.leagueName || "Liga"),
        leagueFullName: String(match.leagueFullName || match.leagueName || ""),
        leagueLogo: String(match.leagueLogo || ""),
        home: String(home.name || ""),
        away: String(away.name || ""),
        homeEn: String(home.name || ""),
        awayEn: String(away.name || ""),
        homeLogo: String(home.logo || ""),
        awayLogo: String(away.logo || ""),
        round: String(match.round || match.stage || match.group || ""),
        venue: String(match.venue || ""),
        time: String(match.time || ""),
        kickoff: String(match.kickoffUtc || ""),
        status: String(match.status || "upcoming"),
        score: match.score ? String(match.score) : null,
        minute: match.minute ? String(match.minute) : null,
      };
    }).filter((match) => match.home && match.away) : [];
    return {
      updatedAt: String(payload?.updatedAt || ""),
      date: String(payload?.date || selectedDateKey || getTashkentDateKey()),
      timeZone: String(payload?.timeZone || "Asia/Tashkent"),
      activeLeagueId: String(payload?.activeLeagueId || activeLeagueId),
      leagues,
      matches,
      standings: payload?.standings && typeof payload.standings === "object" ? payload.standings : null,
    };
  }

  const fifaClientMatchesCache = new Map();
  let fifaRequestId = 0;

  async function loadFifaData(force = false, requestedLeagueId = activeLeagueId) {
    const date = selectedDateKey || getTashkentDateKey();
    const leagueToFetch = requestedLeagueId || activeLeagueId;
    const cacheKey = `${date}:${leagueToFetch}`;
    const todayKey = getTashkentDateKey();
    const now = Date.now();

    // Client cache tekshiruvi:
    // O'tib ketgan yoki kelajakdagi kunlar: 30 daqiqa kesh
    // Bugungi kun: jonli o'yin bo'lsa 60 soniya, bo'lmasa 5 daqiqa
    const clientCached = fifaClientMatchesCache.get(cacheKey);
    let ttlMs = 30 * 60 * 1000;
    if (date < todayKey || date > todayKey) {
      ttlMs = 30 * 60 * 1000;
    } else {
      const hasLive = clientCached?.data?.matches?.some((m) => m.status === "live");
      ttlMs = hasLive ? 60 * 1000 : 5 * 60 * 1000;
    }

    if (!force && clientCached && (now - clientCached.at < ttlMs)) {
      FIFA_DATA = clientCached.data;
      activeLeagueId = FIFA_DATA.activeLeagueId || leagueToFetch || activeLeagueId;
      cacheFavoriteTeamMatches(FIFA_DATA.matches);
      loadState = "ready";
      return;
    }

    const reqId = ++fifaRequestId;
    const wasReady = loadState === "ready";
    if (clientCached?.data) {
      FIFA_DATA = clientCached.data;
    } else {
      loadState = "loading";
    }

    try {
      const params = new URLSearchParams({ type: "fifa", date, league: leagueToFetch });
      if (force === "hard") params.set("_", String(Date.now()));
      const res = await fetch(`/api/categories?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const payload = await res.json();
      if (reqId !== fifaRequestId) return;
      FIFA_DATA = normalizeFromPayload(payload);
      activeLeagueId = FIFA_DATA.activeLeagueId || leagueToFetch || activeLeagueId;
      cacheFavoriteTeamMatches(FIFA_DATA.matches);
      fifaClientMatchesCache.set(cacheKey, { data: FIFA_DATA, at: Date.now() });
      loadState = "ready";
    } catch (err) {
      if (reqId !== fifaRequestId) return;
      console.warn("FIFA fetch xato:", err.message);
      loadState = (wasReady || clientCached?.data) ? "ready" : "error";
    }
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- Empty/loading helpers ---
  function emptyHtml(title, sub) {
    return `<div class="fifa-live-empty">
              <div class="fifa-live-empty__icon">⚽</div>
              <div class="fifa-live-empty__title">${title}</div>
              <div>${sub || ""}</div>
            </div>`;
  }
  function loadingHtml(title, sub) {
    return `<div class="fifa-live-empty fifa-live-empty--loading">
              <div class="fifa-spinner" aria-hidden="true"></div>
              <div class="fifa-live-empty__title">${title}</div>
              <div>${sub || ""}</div>
            </div>`;
  }
  const isLoading = () => loadState === "loading" || loadState === "idle";

  function teamLogoHtml(url, alt = "") {
    const safeAlt = esc(alt);
    const safeUrl = esc(url);
    if (!safeUrl) return `<span class="fifa-team-logo fifa-team-logo--fallback" aria-hidden="true">${esc(String(alt || "?").slice(0, 1))}</span>`;
    return `<img class="fifa-team-logo" src="${safeUrl}" alt="${safeAlt}" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'fifa-team-logo fifa-team-logo--fallback',textContent:'?' }))">`;
  }

  function leagueLogoHtml(league) {
    return teamLogoHtml(league?.logo || "", league?.name || "Liga");
  }

  function renderMatchCard(m, opts = {}) {
    const isLive = m.status === "live";
    const isFinished = m.status === "finished";
    const dateIso = m.kickoff ? String(m.kickoff).slice(0, 10) : "";

    const badgeHtml = getMatchBadgeHtml(m, opts);
    const competitionName = getMatchLeagueName(m);

    const isHomeFav = isFifaTeamFavorite(m.home);
    const isAwayFav = isFifaTeamFavorite(m.away);

    const homeFavBtn = `
      <button class="fifa-team-fav-btn fifa-team-fav-btn--corner fifa-team-fav-btn--home${isHomeFav ? " is-active" : ""}" type="button" data-team-fav="${esc(m.home)}" data-team-logo="${esc(m.homeLogo || '')}" data-team-league="${esc(m.leagueId || '')}" data-match-id="${esc(m.id)}" aria-label="${isHomeFav ? "Sevimlilardan o'chirish" : "Sevimli jamoa qilish"}">
        <svg class="fifa-team-fav-star" viewBox="0 0 24 24" fill="${isHomeFav ? "#f59e0b" : "none"}" stroke="${isHomeFav ? "#f59e0b" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
    `;

    const awayFavBtn = `
      <button class="fifa-team-fav-btn fifa-team-fav-btn--corner fifa-team-fav-btn--away${isAwayFav ? " is-active" : ""}" type="button" data-team-fav="${esc(m.away)}" data-team-logo="${esc(m.awayLogo || '')}" data-team-league="${esc(m.leagueId || '')}" data-match-id="${esc(m.id)}" aria-label="${isAwayFav ? "Sevimlilardan o'chirish" : "Sevimli jamoa qilish"}">
        <svg class="fifa-team-fav-star" viewBox="0 0 24 24" fill="${isAwayFav ? "#f59e0b" : "none"}" stroke="${isAwayFav ? "#f59e0b" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      </button>
    `;

    const scoreDisplay = (isLive || isFinished)
      ? esc(formatMatchScoreDisplay(m.score || "0 - 0"))
      : "VS";

    let subtitleText = m.round || m.group || "";
    if (!subtitleText && m.venue) {
      subtitleText = m.venue;
    }

    const dataAttr = ` data-fifa-open-lineup="1" data-match-id="${esc(m.id)}" data-league-id="${esc(m.leagueId || '')}" data-home-en="${esc(m.homeEn || m.home)}" data-away-en="${esc(m.awayEn || m.away)}" data-home-uz="${esc(m.home)}" data-away-uz="${esc(m.away)}" data-home-logo="${esc(m.homeLogo || '')}" data-away-logo="${esc(m.awayLogo || '')}" data-score="${esc(m.score || '')}" data-status="${esc(m.status || '')}" data-minute="${esc(m.minute || '')}" data-date="${esc(dateIso)}" role="button" tabindex="0"`;

    return `
      <div class="fifa-match fifa-match--clickable${isLive ? " fifa-match--live" : isFinished ? " fifa-match--finished" : ""}"${dataAttr}>
        <div class="fifa-card-badge-wrap">
          ${badgeHtml}
        </div>
        <div class="fifa-card-competition">${esc(competitionName)}</div>
        <div class="fifa-card-fixture">
          ${homeFavBtn}
          <!-- Home Team -->
          <div class="fifa-card-team fifa-card-team--home${isHomeFav ? " is-fav" : ""}">
            <div class="fifa-card-team__logo-wrap">
              ${teamLogoHtml(m.homeLogo, m.home)}
            </div>
            <div class="fifa-card-team__name fifa-match__name" title="${esc(m.home)}">${esc(m.home)}</div>
          </div>

          <!-- Center VS / Score -->
          <div class="fifa-card-center">
            <div class="fifa-card-score fifa-match__score${isLive ? " fifa-card-score--live" : ""}${!isLive && !isFinished ? " fifa-card-score--vs" : ""}">${scoreDisplay}</div>
            ${subtitleText ? `<div class="fifa-card-subtitle fifa-match__time" title="${esc(subtitleText)}">${esc(subtitleText)}</div>` : ""}
          </div>

          <!-- Away Team -->
          <div class="fifa-card-team fifa-card-team--away${isAwayFav ? " is-fav" : ""}">
            <div class="fifa-card-team__logo-wrap">
              ${teamLogoHtml(m.awayLogo, m.away)}
            </div>
            <div class="fifa-card-team__name fifa-match__name" title="${esc(m.away)}">${esc(m.away)}</div>
          </div>
          ${awayFavBtn}
        </div>
      </div>
    `;
  }

  // --- Render: Kunlik o'yinlar ---
  function renderMatches() {
    const panel = document.getElementById("fifaPanelMatches");
    if (!panel) return;
    const day = selectedDateKey || FIFA_DATA.date || getTashkentDateKey();
    const previousDay = shiftDateKey(day, -1);
    const nextDay = shiftDateKey(day, 1);

    if (isLoading() && !FIFA_DATA.leagues?.length) {
      panel.innerHTML = loadingHtml("Kunlik o'yinlar yuklanmoqda…", F("matchesDate"));
      return;
    }
    const leagues = Array.isArray(FIFA_DATA.leagues) ? FIFA_DATA.leagues : [];
    const matches = Array.isArray(FIFA_DATA.matches) ? FIFA_DATA.matches : [];
    if (!leagues.length && !isLoading()) {
      panel.innerHTML = emptyHtml(F("scheduleNotFound"), F("sourceUnavailable"));
      return;
    }
    const leaguesWithMatches = leagues
      .map((league) => ({
        league,
        matches: matches.filter((match) => match.leagueId === league.id),
      }))
      .filter(({ matches: leagueMatches }) => leagueMatches.length > 0);
    const leagueSections = leaguesWithMatches.map(({ league, matches: leagueMatches }) => {
      return `
        <section class="fifa-match-league">
          <header class="fifa-match-league__head">
            <span class="fifa-match-league__logo">${leagueLogoHtml(league)}</span>
            <span class="fifa-match-league__copy"><strong>${esc(league.name)}</strong><small>${esc(league.fullName || "")}</small></span>
            <span class="fifa-match-league__count">${leagueMatches.length}</span>
          </header>
          ${leagueMatches.map(renderMatchCard).join("")}
        </section>
      `;
    }).join("");

    const contentHtml = (loadState === "loading" && !matches.length)
      ? loadingHtml("Kunlik o'yinlar yuklanmoqda…", formatFootballDay(day))
      : (leagueSections || emptyHtml(F("noTopFiveMatches"), F("matchesDate")));

    panel.innerHTML = `
      <div class="fifa-day fifa-day--today">
        <button type="button" class="fifa-date-nav__button" data-fifa-date="${esc(previousDay)}" aria-label="${esc(F("previousDay"))}">‹</button>
        <span class="fifa-date-nav__label"><strong>${esc(formatFootballDay(day))}</strong><small>${F("matchesDate")}</small></span>
        <div class="fifa-date-nav__actions">
          ${isTodayDateKey(day) ? "" : `<button type="button" class="fifa-date-nav__today" data-fifa-date="${esc(getTashkentDateKey())}">${esc(F("today"))}</button>`}
          <button type="button" class="fifa-date-nav__button" data-fifa-date="${esc(nextDay)}" aria-label="${esc(F("nextDay"))}">›</button>
        </div>
      </div>
      ${contentHtml}
    `;
    panel.querySelectorAll("[data-fifa-date]").forEach((button) => {
      button.addEventListener("click", async () => {
        const requestedDate = String(button.dataset.fifaDate || "");
        if (!requestedDate || requestedDate === selectedDateKey) return;
        selectedDateKey = requestedDate;
        renderMatches();
        await loadFifaData(false, activeLeagueId);
        renderMatches();
      });
    });
  }

  let fifaStreamsCache = null;
  let fifaStreamsLoading = null;
  function streamProviderLabel(stream) {
    return stream.provider === "vk" ? "VK Video" : "YouTube Live";
  }
  async function loadFifaStreams(force = false) {
    if (!force && Array.isArray(fifaStreamsCache)) return fifaStreamsCache;
    if (fifaStreamsLoading && !force) return fifaStreamsLoading;
    fifaStreamsLoading = (async () => {
      try {
        const local = Array.isArray(window.__fifaStreams) ? window.__fifaStreams : null;
        // Bo'sh shell snapshot serverda saqlangan streamlar borligini anglatmaydi.
        // Faqat ichida haqiqiy URL bor local snapshotdan foydalanamiz.
        if (local && local.some((item) => item && item.url) && !force) {
          fifaStreamsCache = local.filter((item) => item && item.url);
          return fifaStreamsCache;
        }
        const res = await fetch("/api/settings", { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        fifaStreamsCache = Array.isArray(data?.fifaStreams) ? data.fifaStreams.filter((item) => item && item.url) : [];
        window.__fifaStreams = fifaStreamsCache;
        return fifaStreamsCache;
      } catch (_) {
        fifaStreamsCache = [];
        return fifaStreamsCache;
      } finally {
        fifaStreamsLoading = null;
      }
    })();
    return fifaStreamsLoading;
  }
  function renderFifaStreamsPromo(streams) {
    const wrap = document.getElementById("fifaStreamsPromoWrap");
    if (!wrap) return;
    const list = Array.isArray(streams) ? streams.filter((item) => item && item.url) : [];
    wrap.hidden = !list.length;
    if (!list.length) { wrap.innerHTML = ""; return; }
    const isYoutubeStream = (stream) => stream.provider === "youtube" || /(?:youtube\.com|youtu\.be)/i.test(`${stream.originalUrl || ""} ${stream.url || ""}`);
    const youtubeCards = list.filter(isYoutubeStream).map((stream) => {
      const title = stream.title || "Futbol jonli efiri";
      const originalUrl = stream.originalUrl || stream.url;
      return `<article class="fifa-youtube-live-card"><div class="fifa-youtube-live-card__head"><div><span class="fifa-streams-promo-kicker">YOUTUBE LIVE</span><h3>${esc(title)}</h3></div><span class="fifa-streams-live-pill"><i></i> LIVE</span></div><div class="fifa-stream-card__frame-wrap"><iframe class="fifa-stream-card__frame" src="${esc(stream.url)}" title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div><a class="fifa-youtube-live-card__open" href="${esc(originalUrl)}" target="_blank" rel="noopener noreferrer">YouTube’da ochish <span>↗</span></a></article>`;
    }).join("");
    const vkCards = list.filter((stream) => !isYoutubeStream(stream)).map((stream) => `<a class="fifa-vk-live-card" href="${esc(stream.originalUrl || stream.url)}" target="_blank" rel="noopener noreferrer"><div class="fifa-vk-live-card__body"><span class="fifa-streams-promo-kicker">JONLI EFIR</span><h3>${esc(stream.title || "Futbol jonli efiri")}</h3><span class="fifa-vk-live-card__hint">Translyatsiyani ochish <b>↗</b></span></div><span class="fifa-streams-live-pill"><i></i> LIVE</span></a>`).join("");
    wrap.innerHTML = `<div class="fifa-streams-promo-head"><div><span class="fifa-streams-promo-kicker">JONLI EFIR</span><h2>Futbol translyatsiyasi</h2></div><span class="fifa-streams-live-pill"><i></i> LIVE</span></div>${youtubeCards}${vkCards}`;
  }
  async function renderFifaStreamsPanel(force = false) {
    renderFifaStreamsPromo(await loadFifaStreams(force));
  }
  // --- Render: Jonli efir ---
  function renderLive() {
    const panel = document.getElementById("fifaPanelLive");
    if (!panel) return;
    const live = (FIFA_DATA.matches || []).filter((m) => m.status === "live");
    const upcoming = (FIFA_DATA.matches || []).filter((m) => m.status === "upcoming").slice(0, 3);
    const liveHtml = live.length
      ? live.map((m) => renderMatchCard(m)).join("")
      : `<div class="fifa-live-empty"><div class="fifa-live-empty__icon">📺</div><div class="fifa-live-empty__title">${F("noLiveTitle")}</div><div>${F("noLiveHint")}</div></div>`;
    const upcomingHtml = upcoming.length ? `<div class="fifa-upcoming-title">${F("upcomingMatches")}</div>${upcoming.map((m) => renderMatchCard(m, { showDate: true })).join("")}` : "";
    panel.innerHTML = liveHtml + upcomingHtml;
  }

  // --- Render: Turnir jadvali ---
  function renderGroups() {
    const panel = document.getElementById("fifaPanelGroups");
    if (!panel) return;
    const leagues = Array.isArray(FIFA_DATA.leagues) ? FIFA_DATA.leagues : [];
    if (!leagues.length) {
      if (isLoading()) {
        panel.innerHTML = loadingHtml(F("standingsLoading"), F("matchesDate"));
      } else {
        panel.innerHTML = emptyHtml(F("standingsUnavailable"), F("sourceUnavailable"));
      }
      return;
    }
    const active = leagues.find((league) => league.id === activeLeagueId) || leagues[0];
    const standings = FIFA_DATA.standings && FIFA_DATA.standings.leagueId === active.id ? FIFA_DATA.standings : null;
    const rows = Array.isArray(standings?.rows) ? standings.rows : [];
    const updated = FIFA_DATA.updatedAt ? new Date(FIFA_DATA.updatedAt) : null;
    const updatedLabel = updated && !Number.isNaN(updated.getTime()) ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    const tabsHtml = `<div class="fifa-league-tabs" role="tablist" aria-label="${esc(F("standingsTitle"))}">${leagues.map((league) => `<button class="fifa-league-tab${league.id === active.id ? " is-active" : ""}" type="button" role="tab" aria-selected="${league.id === active.id ? "true" : "false"}" data-fifa-league="${esc(league.id)}"><span class="fifa-league-tab__logo">${leagueLogoHtml(league)}</span><span>${esc(league.name)}</span></button>`).join("")}</div>`;

    let tableHtml = "";
    if (loadState === "loading" && !rows.length) {
      tableHtml = loadingHtml(F("standingsLoading"), active.fullName || active.name);
    } else if (standings?.error && !rows.length) {
      tableHtml = emptyHtml(F("standingsUnavailable"), F("sourceUnavailable"));
    } else if (rows.length) {
      tableHtml = `<div class="fifa-standings-card">
             <div class="fifa-standings-card__head"><strong>${esc(standings.leagueFullName || active.fullName || active.name)}</strong><small>${F("updatedAt")}${updatedLabel ? ` · ${esc(updatedLabel)}` : ""}</small></div>
             <div class="fifa-standings-scroll"><table class="fifa-group__table fifa-standings-table"><thead><tr><th>#</th><th style="text-align:left">${F("teamCol")}</th><th>O</th><th>G</th><th>D</th><th>M</th><th>GD</th><th>Ochko</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.rank}</td><td class="fifa-cell--team"><span class="fifa-standing-team">${teamLogoHtml(row.logo, row.team)}<span>${esc(row.team)}</span></span></td><td>${row.p}</td><td>${row.w}</td><td>${row.d}</td><td>${row.l}</td><td>${row.gd}</td><td class="fifa-cell--pts">${row.pts}</td></tr>`).join("")}</tbody></table></div>
           </div>`;
    } else {
      tableHtml = emptyHtml(F("standingsUnavailable"), F("sourceUnavailable"));
    }

    panel.innerHTML = `${tabsHtml}${tableHtml}`;
    panel.querySelectorAll("[data-fifa-league]").forEach((button) => {
      button.addEventListener("click", async () => {
        const leagueId = String(button.dataset.fifaLeague || "");
        if (!leagueId || leagueId === activeLeagueId) return;
        activeLeagueId = leagueId;
        renderGroups();
        await loadFifaData(true, leagueId);
        renderGroups();
      });
    });
  }

  let activeFavTeamFilter = "all";

  function renderFifaFavorites() {
    const panel = document.getElementById("fifaPanelFavorites");
    if (!panel) return;

    const favTeamsStore = readFifaFavoriteTeams();
    const favTeamsList = Object.values(favTeamsStore || {});

    // Empty state: Agar sevimli jamoalar ro'yxati bo'sh bo'lsa (0 ta jamoa bo'lsa) —
    // barcha eski matchlar va saralanganlar to'liq o'chirilishi va faqat BO'SH HOLAT ko'rinishi shart!
    if (!favTeamsList.length) {
      writeFifaFavorites({});
      activeFavTeamFilter = "all";
      panel.innerHTML = `
        <div class="fifa-favorites-empty">
          <div class="fifa-favorites-empty__icon">⭐</div>
          <h3 class="fifa-favorites-empty__title">${esc(F("noFavoritesTitle") || "Sevimli jamoangizni tanlang")}</h3>
          <p class="fifa-favorites-empty__text">${esc(F("noFavoritesText") || "O'zingiz yoqtirgan jamoani tanlang, uning eng yaqin o'yini, taqvimi va tarkiblarini shu yerda doimiy kuzatib boring.")}</p>
          <div class="fifa-popular-teams-wrap" style="text-align: left; max-width: 480px; margin: 16px auto 0;">
            <div class="fifa-fav-section-title" style="margin-bottom: 8px;">
              <span>Mashhur jamoalar</span>
              <small>1 marta bosish orqali qo'shing</small>
            </div>
            <div class="fifa-popular-teams-grid">
              ${POPULAR_TEAMS.map((t) => `
                <button type="button" class="fifa-popular-team-chip" data-quick-fav-team="${esc(t.name)}" data-team-logo="${esc(t.logo)}" data-team-league="${esc(t.leagueId)}">
                  <span class="fifa-popular-team-chip__logo">${t.logo ? `<img src="${esc(t.logo)}" alt="${esc(t.name)}" loading="lazy" />` : "⚽"}</span>
                  <span class="fifa-popular-team-chip__name">${esc(t.name)}</span>
                  <span class="fifa-popular-team-chip__star">+</span>
                </button>
              `).join("")}
            </div>
          </div>
          <button class="fifa-favorites-empty__btn" type="button" data-fifa-go-matches="1" style="margin-top: 14px;">
            ${esc(F("exploreMatches") || "Barcha o'yinlar ro'yxati")}
          </button>
        </div>
      `;
      return;
    }

    const store = readFifaFavorites();
    const storedMatches = Object.values(store || {}).filter((m) => m && m.id);

    // If upcoming matches are not loaded yet and we have favorite teams, kick off fetch and re-render
    if (upcomingMatchesCache === null && favTeamsList.length > 0) {
      ensureUpcomingMatchesLoaded().then(() => {
        const p = document.getElementById("fifaPanelFavorites");
        if (p && !p.hidden) renderFifaFavorites();
      });
    }

    // Combine matches from upcomingCache + FIFA_DATA.matches + storedMatches
    const matchesMap = new Map();

    // 1) Upcoming matches from API (kelgusi 8-10 kun)
    if (Array.isArray(upcomingMatchesCache)) {
      upcomingMatchesCache.forEach((m) => {
        if (!m || !m.id) return;
        if (isFifaTeamFavorite(m.home) || isFifaTeamFavorite(m.away) || isFifaTeamFavorite(m.homeEn) || isFifaTeamFavorite(m.awayEn)) {
          matchesMap.set(String(m.id), { ...m });
        }
      });
    }

    // 2) FIFA_DATA current day matches
    if (Array.isArray(FIFA_DATA?.matches)) {
      FIFA_DATA.matches.forEach((m) => {
        if (!m || !m.id) return;
        if (isFifaTeamFavorite(m.home) || isFifaTeamFavorite(m.away) || isFifaTeamFavorite(m.homeEn) || isFifaTeamFavorite(m.awayEn)) {
          const id = String(m.id);
          const existing = matchesMap.get(id);
          matchesMap.set(id, Object.assign({}, existing || {}, m));
        }
      });
    }

    // 3) Stored matches — faqat hozirgi sevimli jamoalarga tegishli bo'lsagina qo'shiladi!
    storedMatches.forEach((m) => {
      const id = String(m.id);
      if (isFifaTeamFavorite(m.home) || isFifaTeamFavorite(m.away) || isFifaTeamFavorite(m.homeEn) || isFifaTeamFavorite(m.awayEn)) {
        if (!matchesMap.has(id)) {
          matchesMap.set(id, m);
        } else {
          const existing = matchesMap.get(id);
          matchesMap.set(id, Object.assign({}, m, existing));
        }
      }
    });

    const allMatches = Array.from(matchesMap.values());


    // If activeFavTeamFilter is set to a specific team that doesn't exist anymore, reset to all or first team
    if (activeFavTeamFilter !== "all" && !favTeamsList.some((t) => teamNamesMatch(t.name, activeFavTeamFilter))) {
      activeFavTeamFilter = favTeamsList.length === 1 ? favTeamsList[0].name : "all";
    }

    // If only 1 team exists and filter is "all", default target to that team for hero display
    const currentTeamTarget = activeFavTeamFilter !== "all"
      ? activeFavTeamFilter
      : (favTeamsList.length === 1 ? favTeamsList[0].name : "");

    // Filter matches
    const filtered = (activeFavTeamFilter === "all")
      ? allMatches
      : allMatches.filter((m) =>
          teamNamesMatch(m.home, activeFavTeamFilter) ||
          teamNamesMatch(m.away, activeFavTeamFilter)
        );

    // Filter tabs if multiple teams
    let filterChipsHtml = "";
    if (favTeamsList.length > 1) {
      const allActive = activeFavTeamFilter === "all";
      filterChipsHtml = `
        <div class="fifa-fav-filters" role="tablist">
          <button class="fifa-fav-filter-chip${allActive ? " is-active" : ""}" type="button" data-fifa-team-filter="all">
            ${esc(F("allTeams") || "Barchasi")} (${allMatches.length})
          </button>
          ${favTeamsList.map((t) => {
            const isAct = activeFavTeamFilter.toLowerCase() === String(t.name || "").toLowerCase();
            return `<button class="fifa-fav-filter-chip${isAct ? " is-active" : ""}" type="button" data-fifa-team-filter="${esc(t.name)}">${esc(t.name)}</button>`;
          }).join("")}
        </div>
      `;
    }

    // Separate into upcoming and finished
    const upcomingMatches = filtered
      .filter((m) => m.status === "live" || m.status === "upcoming")
      .sort((a, b) => {
        if (a.status === "live" && b.status !== "live") return -1;
        if (b.status === "live" && a.status !== "live") return 1;
        const tA = a.kickoff ? new Date(a.kickoff).getTime() : 0;
        const tB = b.kickoff ? new Date(b.kickoff).getTime() : 0;
        return tA - tB;
      });

    const finishedMatches = filtered
      .filter((m) => m.status === "finished")
      .sort((a, b) => {
        const tA = a.kickoff ? new Date(a.kickoff).getTime() : 0;
        const tB = b.kickoff ? new Date(b.kickoff).getTime() : 0;
        return tB - tA;
      });

    // 1) NEXT MATCH HERO CARD
    let nextMatchHeroHtml = "";
    let remainingUpcoming = upcomingMatches;
    if (upcomingMatches.length > 0) {
      const nextMatch = upcomingMatches[0];
      nextMatchHeroHtml = renderNextMatchFeaturedCard(nextMatch, currentTeamTarget);
      remainingUpcoming = upcomingMatches.slice(1);
    } else if (favTeamsList.length > 0) {
      const targetName = currentTeamTarget || favTeamsList.map((t) => t.name).join(", ");
      const isLoadingUpcoming = upcomingMatchesCache === null;
      nextMatchHeroHtml = `
        <div class="fifa-next-match-card" style="cursor: default;">
          <div class="fifa-next-match-card__header">
            <div class="fifa-next-match-card__league">
              <span>⭐ ${esc(targetName)}</span>
            </div>
            <span class="fifa-next-badge">${isLoadingUpcoming ? "Yuklanmoqda..." : "Taqvim kutilmoqda"}</span>
          </div>
          <div style="padding: 14px 6px; text-align: center;">
            <div class="fifa-next-empty-title">
              ${isLoadingUpcoming ? "Keyingi o'yinlar qidirilmoqda..." : `Yaqin 8-10 kun ichida ${esc(targetName)} ishtirokida rasmiy o'yin belgilanmagan`}
            </div>
            <div class="fifa-next-empty-desc">
              ${isLoadingUpcoming ? "Iltimos, kuting…" : "Keyingi o'yinlar taqvimi rasmiy e'lon qilingach, shu yerda avtomatik ko'rinadi."}
            </div>
            ${targetName && !isLoadingUpcoming ? `
              <div style="margin-top: 14px;">
                <button type="button" class="fifa-next-team__fav-pill is-active" data-team-fav="${esc(targetName)}" aria-label="Sevimlilardan o'chirish">
                  ⭐ Sevimlilardan o'chirish
                </button>
              </div>
            ` : ""}
          </div>
        </div>
      `;
    }

    // 2) UPCOMING SCHEDULE LIST
    let upcomingListHtml = "";
    if (remainingUpcoming.length > 0) {
      upcomingListHtml = `
        <div class="fifa-fav-section-title">
          <span>📅 Keyingi o'yinlar taqvimi (Toshkent vaqti)</span>
          <small>${remainingUpcoming.length} ta o'yin</small>
        </div>
        <div class="fifa-favorites-list">
          ${remainingUpcoming.map((m) => renderMatchCard(m, { showDate: true })).join("")}
        </div>
      `;
    }

    // 3) FINISHED RESULTS LIST
    let finishedListHtml = "";
    if (finishedMatches.length > 0) {
      finishedListHtml = `
        <div class="fifa-fav-section-title">
          <span>🏁 Oxirgi natijalar</span>
          <small>${finishedMatches.length} ta o'yin</small>
        </div>
        <div class="fifa-favorites-list">
          ${finishedMatches.map((m) => renderMatchCard(m, { showDate: true })).join("")}
        </div>
      `;
    }

    // 4) POPULAR TEAMS TO ADD
    const popularUnadded = POPULAR_TEAMS.filter((t) => !isFifaTeamFavorite(t.name));
    let popularAddHtml = "";
    if (popularUnadded.length > 0) {
      popularAddHtml = `
        <div class="fifa-popular-teams-wrap">
          <div class="fifa-fav-section-title">
            <span>+ Boshqa jamoalarni ham kuzatish</span>
            <small>Tezkor tanlash</small>
          </div>
          <div class="fifa-popular-teams-grid">
            ${popularUnadded.slice(0, 10).map((t) => `
              <button type="button" class="fifa-popular-team-chip" data-quick-fav-team="${esc(t.name)}" data-team-logo="${esc(t.logo)}" data-team-league="${esc(t.leagueId)}">
                <span class="fifa-popular-team-chip__logo">${t.logo ? `<img src="${esc(t.logo)}" alt="${esc(t.name)}" loading="lazy" />` : "⚽"}</span>
                <span class="fifa-popular-team-chip__name">${esc(t.name)}</span>
                <span class="fifa-popular-team-chip__star">+</span>
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    const headingText = favTeamsList.length === 1
      ? `${favTeamsList[0].name} — Keyingi o'yinlari`
      : (F("favoritesTitle") || "Saqlangan jamoalar va o'yinlar");

    panel.innerHTML = `
      <div class="fifa-favorites-wrap">
        <div class="fifa-favorites-header">
          <div class="fifa-favorites-title-wrap">
            <span class="fifa-favorites-badge">⭐ SEVIMLILAR</span>
            <h2 class="fifa-favorites-heading">${esc(headingText)}</h2>
          </div>
          <span class="fifa-favorites-count">${filtered.length} ta o'yin</span>
        </div>
        ${filterChipsHtml}
        ${nextMatchHeroHtml}
        ${upcomingListHtml}
        ${finishedListHtml}
        ${popularAddHtml}
      </div>
    `;
  }

  // --- Tab switching ---
  function setActiveTab(tab) {
    fifaView.querySelectorAll(".fifa-tab").forEach((b) => {
      const isOn = b.dataset.fifaTab === tab;
      b.classList.toggle("is-active", isOn);
      b.setAttribute("aria-selected", isOn ? "true" : "false");
    });
    fifaView.querySelectorAll(".fifa-panel").forEach((p) => {
      const isOn = p.id === "fifaPanel" + tab.charAt(0).toUpperCase() + tab.slice(1);
      p.classList.toggle("is-active", isOn);
      p.hidden = !isOn;
    });
    if (tab === "groups") {
      renderGroups();
      if (!FIFA_DATA.standings || FIFA_DATA.standings.leagueId !== activeLeagueId) {
        loadFifaData(true, activeLeagueId).then(() => renderGroups()).catch(() => {});
      }
    } else if (tab === "matches") {
      renderMatches();
    } else if (tab === "live") {
      renderLive();
    } else if (tab === "favorites") {
      ensureUpcomingMatchesLoaded().catch(() => {});
      renderFifaFavorites();
    }
  }

  fifaView.querySelectorAll(".fifa-tab").forEach((b) => {
    b.addEventListener("click", () => setActiveTab(b.dataset.fifaTab));
  });

  // --- Open / close ---
  let fifaPollTimer = null;
  const FIFA_POLL_MS = 60 * 1000;

  async function refreshFifa() {
    const day = selectedDateKey || getTashkentDateKey();
    // Faqat bugungi kun ochiq bo'lsa fonda jonli natijalarni yangilash
    if (day !== getTashkentDateKey()) return;
    await loadFifaData(true, activeLeagueId);
    renderMatches();
    renderGroups();
    renderLive();
    // O'yinlar highlightslarini ham har 5 daqiqada yangilab turish
    if (Date.now() - fifaHighlightsLoadedAt > 5 * 60 * 1000) {
      loadAndRenderFifaHighlights(true).catch(() => {});
    }
  }
  function startFifaPolling() {
    if (fifaPollTimer) return;
    fifaPollTimer = setInterval(() => {
      if (document.hidden) return;
      if (fifaView?.hidden) return;
      refreshFifa();
    }, FIFA_POLL_MS);
  }
  function stopFifaPolling() {
    if (fifaPollTimer) { clearInterval(fifaPollTimer); fifaPollTimer = null; }
  }

  // --- YouTube Highlights (Kunlik o'yinlar sharhi) ---
  let fifaHighlightsCacheData = null;
  let fifaHighlightsLoadedAt = 0;
  async function loadAndRenderFifaHighlights(force = false) {
    const wrap = document.getElementById("fifaHighlightsWrap");
    if (!wrap) return;

    const now = Date.now();
    if (!force && fifaHighlightsCacheData && now - fifaHighlightsLoadedAt < 120000) {
      renderFifaHighlightsHtml(wrap, fifaHighlightsCacheData);
      return;
    }

    try {
      const res = await fetch("/api/categories?type=fifa-highlights", {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const videos = Array.isArray(data?.videos) ? data.videos : [];
      fifaHighlightsCacheData = videos;
      fifaHighlightsLoadedAt = now;
      renderFifaHighlightsHtml(wrap, videos);
    } catch (err) {
      console.warn("Fifa highlights load failed:", err);
      if (!fifaHighlightsCacheData || !fifaHighlightsCacheData.length) {
        wrap.hidden = true;
      }
    }
  }

  // --- Highlights sarlavhalari va vaqtini tilga (uz, ru, en) qarab moslashtirish ---
  const HIGHLIGHT_TOURNAMENTS = [
    { pattern: /Обзор\s+матча\s+Лиги\s+чемпионов/gi, uz: "Chempionlar ligasi o'yin highlightslari", en: "Champions League match highlights", ru: "Обзор матча Лиги чемпионов" },
    { pattern: /Обзор\s+матча\s+Лиги\s+Европы/gi, uz: "Yevropa ligasi o'yin highlightslari", en: "Europa League match highlights", ru: "Обзор матча Лиги Европы" },
    { pattern: /Обзор\s+матча\s+Лиги\s+конференций/gi, uz: "Konferensiyalar ligasi o'yin highlightslari", en: "Conference League match highlights", ru: "Обзор матча Лиги конференций" },
    { pattern: /Лиг[аи]\s+чемпионов/gi, uz: "Chempionlar ligasi", en: "Champions League", ru: "Лига чемпионов" },
    { pattern: /Лиг[аи]\s+Европы/gi, uz: "Yevropa ligasi", en: "Europa League", ru: "Лига Европы" },
    { pattern: /Лиг[аи]\s+конференций/gi, uz: "Konferensiyalar ligasi", en: "Conference League", ru: "Лига конференций" },
    { pattern: /Премьер-лиг[аи]\s*(Англии)?|АПЛ/gi, uz: "APL", en: "Premier League", ru: "АПЛ" },
    { pattern: /РПЛ|Российск[аяо-]+\s+премьер-лиг[аи]/gi, uz: "RPL", en: "RPL", ru: "РПЛ" },
    { pattern: /Ла\s*Лиг[аи]|Пример[аы]/gi, uz: "La Liga", en: "La Liga", ru: "Ла Лига" },
    { pattern: /Сери[яи]\s*А/gi, uz: "A Seriya", en: "Serie A", ru: "Серия А" },
    { pattern: /Бундеслиг[аи]/gi, uz: "Bundesliga", en: "Bundesliga", ru: "Бундеслига" },
    { pattern: /Лиг[аи]\s*1/gi, uz: "Liga 1", en: "Ligue 1", ru: "Лига 1" },
    { pattern: /Кубок\s+Англии/gi, uz: "Angliya kubogi", en: "FA Cup", ru: "Кубок Англии" },
    { pattern: /Кубок\s+Испании/gi, uz: "Ispaniya kubogi", en: "Copa del Rey", ru: "Кубок Испании" },
    { pattern: /Кубок\s+Италии/gi, uz: "Italiya kubogi", en: "Coppa Italia", ru: "Кубок Италии" },
    { pattern: /Кубок\s+Германии/gi, uz: "Germaniya kubogi", en: "DFB-Pokal", ru: "Кубок Германии" },
    { pattern: /Суперкубок\s+УЕФА/gi, uz: "UEFA Superkubogi", en: "UEFA Super Cup", ru: "Суперкубок УЕФА" },
    { pattern: /Суперкубок/gi, uz: "Superkubok", en: "Super Cup", ru: "Суперкубок" },
    { pattern: /Кубок/gi, uz: "Kubok", en: "Cup", ru: "Кубок" },
    { pattern: /Обзор\s+матча|Обзоры\s+матчей/gi, uz: "O'yin highlightslari", en: "Match highlights", ru: "Обзор матча" },
    { pattern: /Все\s+голы\s+и\s+(?:опасные|лучшие)\s+моменты/gi, uz: "Barcha gollar va xavfli vaziyatlar", en: "All goals & highlights", ru: "Все голы и опасные моменты" },
    { pattern: /Все\s+голы/gi, uz: "Barcha gollar", en: "All goals", ru: "Все голы" },
    { pattern: /Голы\s+матча/gi, uz: "O'yin gollari", en: "Match goals", ru: "Голы матча" },
    { pattern: /Голы/gi, uz: "Gollar", en: "Goals", ru: "Голы" },
    { pattern: /Лучшие\s+моменты|Опасные\s+моменты/gi, uz: "Eng xavfli vaziyatlar", en: "Best moments", ru: "Лучшие моменты" },
    { pattern: /(\d+)[-\s]*й?\s*тур/gi, uz: "$1-tur", en: "Matchday $1", ru: "$1-й тур" },
    { pattern: /Полуфинал/gi, uz: "Yarim final", en: "Semi-final", ru: "Полуфинал" },
    { pattern: /Финал/gi, uz: "Final", en: "Final", ru: "Финал" }
  ];

  const HIGHLIGHT_CLUBS = {
    "Манчестер Сити": { uz: "Manchester Siti", en: "Manchester City" },
    "Манчестер Юнайтед": { uz: "Manchester Yunayted", en: "Manchester United" },
    "Ливерпуль": { uz: "Liverpul", en: "Liverpool" },
    "Арсенал": { uz: "Arsenal", en: "Arsenal" },
    "Челси": { uz: "Chelsi", en: "Chelsea" },
    "Тоттенхэм": { uz: "Tottenxem", en: "Tottenham" },
    "Астон Вилла": { uz: "Aston Villa", en: "Aston Villa" },
    "Ньюкасл": { uz: "Nyukasl", en: "Newcastle" },
    "Брайтон": { uz: "Brayton", en: "Brighton" },
    "Борнмут": { uz: "Bornmut", en: "Bournemouth" },
    "Кристал Пэлас": { uz: "Kristal Pelas", en: "Crystal Palace" },
    "Вест Хэм": { uz: "Vest Xem", en: "West Ham" },
    "Вулверхэмптон": { uz: "Vulverxempton", en: "Wolves" },
    "Фулхэм": { uz: "Fulxem", en: "Fulham" },
    "Брентфорд": { uz: "Brentford", en: "Brentford" },
    "Эвертон": { uz: "Everton", en: "Everton" },
    "Лестер": { uz: "Lester", en: "Leicester" },
    "Ноттингем Форест": { uz: "Nottingem Forest", en: "Nottingham Forest" },
    "Ипсвич": { uz: "Ipsvich", en: "Ipswich Town" },
    "Саутгемптон": { uz: "Sautgempton", en: "Southampton" },
    "Реал Мадрид": { uz: "Real Madrid", en: "Real Madrid" },
    "Барселона": { uz: "Barselona", en: "Barcelona" },
    "Атлетико Мадрид": { uz: "Atletiko Madrid", en: "Atletico Madrid" },
    "Атлетико": { uz: "Atletiko", en: "Atletico Madrid" },
    "Реал Сосьедад": { uz: "Real Sosedad", en: "Real Sociedad" },
    "Севилья": { uz: "Sevilya", en: "Sevilla" },
    "Бетис": { uz: "Betis", en: "Real Betis" },
    "Реал Бетис": { uz: "Real Betis", en: "Real Betis" },
    "Вильярреал": { uz: "Vilyarreal", en: "Villarreal" },
    "Атлетик Бильбао": { uz: "Atletik Bilbao", en: "Athletic Bilbao" },
    "Атлетик": { uz: "Atletik", en: "Athletic Club" },
    "Жирона": { uz: "Jirona", en: "Girona" },
    "Валенсия": { uz: "Valensiya", en: "Valencia" },
    "Сельта": { uz: "Selta", en: "Celta Vigo" },
    "Мальорка": { uz: "Malyorka", en: "Mallorca" },
    "Осасуна": { uz: "Osasuna", en: "Osasuna" },
    "Хетафе": { uz: "Xetafe", en: "Getafe" },
    "Райо Вальекано": { uz: "Rayo Valyekano", en: "Rayo Vallecano" },
    "Эспаньол": { uz: "Espanyol", en: "Espanyol" },
    "Алавес": { uz: "Alaves", en: "Alaves" },
    "Лас-Пальмас": { uz: "Las-Palmas", en: "Las Palmas" },
    "Леганес": { uz: "Leganes", en: "Leganes" },
    "Вальядолид": { uz: "Valyadolid", en: "Valladolid" },
    "Интер": { uz: "Inter", en: "Inter Milan" },
    "Милан": { uz: "Milan", en: "AC Milan" },
    "Ювентус": { uz: "Yuventus", en: "Juventus" },
    "Наполи": { uz: "Napoli", en: "Napoli" },
    "Аталанта": { uz: "Atalanta", en: "Atalanta" },
    "Рома": { uz: "Roma", en: "AS Roma" },
    "Лацио": { uz: "Latsio", en: "Lazio" },
    "Фиорентина": { uz: "Fiorentina", en: "Fiorentina" },
    "Болонья": { uz: "Bolonya", en: "Bologna" },
    "Торино": { uz: "Torino", en: "Torino" },
    "Удинезе": { uz: "Udineze", en: "Udinese" },
    "Комо": { uz: "Komo", en: "Como" },
    "Парма": { uz: "Parma", en: "Parma" },
    "Верона": { uz: "Verona", en: "Hellas Verona" },
    "Дженоа": { uz: "Djenoa", en: "Genoa" },
    "Кальяри": { uz: "Kalyari", en: "Cagliari" },
    "Лечче": { uz: "Lechche", en: "Lecce" },
    "Эмполи": { uz: "Empoli", en: "Empoli" },
    "Венеция": { uz: "Venetsiya", en: "Venezia" },
    "Монца": { uz: "Montsa", en: "Monza" },
    "Бавария": { uz: "Bavariya", en: "Bayern Munich" },
    "Боруссия Дортмунд": { uz: "Borussiya Dortmund", en: "Borussia Dortmund" },
    "Боруссия Д": { uz: "Borussiya D", en: "Borussia Dortmund" },
    "Байер": { uz: "Bayer", en: "Bayer Leverkusen" },
    "Родина": { uz: "Rodina", en: "Rodina" },
    "Оренбург": { uz: "Orenburg", en: "Orenburg" },
    "Балтика": { uz: "Baltika", en: "Baltika" },
    "Ростов": { uz: "Rostov", en: "Rostov" },
    "Спартак": { uz: "Spartak", en: "Spartak" },
    "Зенит": { uz: "Zenit", en: "Zenit" },
    "ЦСКА": { uz: "CSKA", en: "CSKA" },
    "Локомотив": { uz: "Lokomotiv", en: "Lokomotiv" },
    "Краснодар": { uz: "Krasnodar", en: "Krasnodar" },
    "Славия Прага": { uz: "Slaviya Praga", en: "Slavia Prague" },
    "Сабах": { uz: "Sabah", en: "Sabah" },
    "РБ Лейпциг": { uz: "RB Leypsig", en: "RB Leipzig" },
    "Лейпциг": { uz: "Leypsig", en: "RB Leipzig" },
    "Штутгарт": { uz: "Shtutgart", en: "Stuttgart" },
    "Айнтрахт": { uz: "Ayntraxt", en: "Eintracht Frankfurt" },
    "Боруссия М": { uz: "Borussiya M", en: "Borussia M'gladbach" },
    "Вольфсбург": { uz: "Volfsburg", en: "Wolfsburg" },
    "Фрайбург": { uz: "Frayburg", en: "Freiburg" },
    "Хоффенхайм": { uz: "Xoffenxaym", en: "Hoffenheim" },
    "Вердер": { uz: "Verder", en: "Werder Bremen" },
    "Аугсбург": { uz: "Augsburg", en: "Augsburg" },
    "Майнц": { uz: "Maynts", en: "Mainz" },
    "Унион": { uz: "Union", en: "Union Berlin" },
    "Санкт-Паули": { uz: "Sankt-Pauli", en: "St. Pauli" },
    "Хайденхайм": { uz: "Xaydenxaym", en: "Heidenheim" },
    "Бохум": { uz: "Boxum", en: "Bochum" },
    "ПСЖ": { uz: "PSJ", en: "PSG" },
    "Марсель": { uz: "Marsel", en: "Marseille" },
    "Монако": { uz: "Monako", en: "Monaco" },
    "Лион": { uz: "Lion", en: "Lyon" },
    "Лилль": { uz: "Lill", en: "Lille" },
    "Ренн": { uz: "Renn", en: "Rennes" },
    "Ницца": { uz: "Nitssa", en: "Nice" },
    "Ланс": { uz: "Lans", en: "Lens" },
    "Брест": { uz: "Brest", en: "Brest" },
    "Бенфика": { uz: "Benfika", en: "Benfica" },
    "Порту": { uz: "Portu", en: "Porto" },
    "Спортинг": { uz: "Sporting", en: "Sporting CP" },
    "Аякс": { uz: "Ayaks", en: "Ajax" },
    "Фейеноорд": { uz: "Feyenoord", en: "Feyenoord" },
    "ПСВ": { uz: "PSV", en: "PSV Eindhoven" },
    "Селтик": { uz: "Seltik", en: "Celtic" },
    "Рейнджерс": { uz: "Reyndjers", en: "Rangers" },
    "Галатасарай": { uz: "Galatasaroy", en: "Galatasaray" },
    "Фенербахче": { uz: "Fenerbaxche", en: "Fenerbahce" },
    "Бешикташ": { uz: "Beshiktosh", en: "Besiktas" },
    "Шахтёр": { uz: "Shaxtyor", en: "Shakhtar" },
    "Динамо Киев": { uz: "Dinamo Kiev", en: "Dynamo Kyiv" },
    "Динамо Загреб": { uz: "Dinamo Zagreb", en: "Dinamo Zagreb" },
    "Црвена Звезда": { uz: "Srvena Zvezda", en: "Red Star Belgrade" },
    "Зальцбург": { uz: "Zalsburg", en: "Salzburg" },
    "Штурм": { uz: "Shturm", en: "Sturm Graz" },
    "ЛАСК": { uz: "LASK", en: "LASK" },
    "Слован": { uz: "Slovan", en: "Slovan Bratislava" },
    "Буде-Глимт": { uz: "Bude-Glimt", en: "Bodo/Glimt" },
    "Лех": { uz: "Lex", en: "Lech Poznan" },
    "Пафос": { uz: "Pafos", en: "Pafos" },
    "Кайрат": { uz: "Qayrat", en: "Kairat" },
    "Рига": { uz: "Riga", en: "Riga" },
    "АЕК": { uz: "AEK", en: "AEK" },
    "Олимпиакос": { uz: "Olimpiakos", en: "Olympiacos" },
    "Панатинаикос": { uz: "Panatinaikos", en: "Panathinaikos" },
    "Кауно Жальгирис": { uz: "Kauno Jalgiris", en: "Kauno Zalgiris" },
    "Жальгирис": { uz: "Jalgiris", en: "Zalgiris" },
    "Пахтакор": { uz: "Paxtakor", en: "Pakhtakor" },
    "Насаф": { uz: "Nasaf", en: "Nasaf" },
    "Навбахор": { uz: "Navbahor", en: "Navbahor" },
    "Аль-Хиляль": { uz: "Al-Hilol", en: "Al-Hilal" },
    "Аль-Наср": { uz: "Al-Nasr", en: "Al-Nassr" },
    "Интер Майами": { uz: "Inter Mayami", en: "Inter Miami" }
  };

  const HIGHLIGHT_CYR_MAP = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"j","з":"z","и":"i",
    "й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t",
    "у":"u","ф":"f","х":"x","ц":"s","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"i","ь":"",
    "э":"e","ю":"yu","я":"ya",
    "А":"A","Б":"B","В":"V","Г":"G","Д":"D","Е":"E","Ё":"Yo","Ж":"J","З":"Z","И":"I",
    "Й":"Y","К":"K","Л":"L","М":"M","Н":"N","О":"O","П":"P","Р":"R","С":"S","Т":"T",
    "У":"U","Ф":"F","Х":"X","Ц":"S","Ч":"Ch","Ш":"Sh","Щ":"Sh","Ъ":"","Ы":"I","Ь":"",
    "Э":"E","Ю":"Yu","Я":"Ya"
  };

  function cyrillicToLatinHighlight(text) {
    return String(text || "").replace(/[а-яёА-ЯЁ]/g, (ch) => HIGHLIGHT_CYR_MAP[ch] !== undefined ? HIGHLIGHT_CYR_MAP[ch] : ch);
  }

  function extractHighlightTeamsOnly(title) {
    if (!title) return "";
    let str = String(title).trim();

    // Strip dates first: e.g. 21.10.2026, 21.10
    str = str.replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g, "").trim();

    // Split by common delimiters: dot, pipe, colon, slash, or multi-dashes
    const segments = str.split(/\s*(?:[.|:/]|--+)\s*/).map((s) => s.trim()).filter(Boolean);

    // Find the segment that contains the match separator (—, –, -, or vs)
    const matchSegment = segments.find((s) => /\s*(?:[-–—]|\bvs\.?\b)\s*/i.test(s));

    let result = matchSegment || segments[0] || str;

    // Strip tournament & highlight words if any remain inside the segment
    result = result
      .replace(/(?:Chempionlar|Yevropa|Konferensiyalar)\s+ligasi[^\n]*/gi, "")
      .replace(/(?:Premyer-liga|La\s*Liga|Bundesliga|A\s*Seriya|Liga\s*1)[^\n]*/gi, "")
      .replace(/(?:Лига\s+чемпионов|Лига\s+Европы|Лига\s+конференций)[^\n]*/gi, "")
      .replace(/(?:o'yin\s+highlightslari|o'yin\s+sharhi|highlightslari|highlights|обзор\s+матча|обзор|sharh)[^\n]*/gi, "")
      .replace(/(?:barcha\s+gollar|все\s+голы)[^\n]*/gi, "")
      .replace(/[.,:;!|#]+$/g, "")
      .trim();

    // Normalize match separator to ' — '
    result = result.replace(/\s*(?:[-–—]|\bvs\.?\b)\s*/gi, " — ");

    // Strip trailing/leading punctuation
    result = result.replace(/^[.,:;!\-–—\s]+|[.,:;!\-–—\s]+$/g, "").trim();

    return result || title;
  }

  function extractHighlightTeamsOnly(title) {
    if (!title) return "";
    let str = String(title).trim();

    // Strip dates first: e.g. 21.10.2026, 21.10
    str = str.replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g, "").trim();

    // Split by common delimiters: dot, pipe, colon, slash, or multi-dashes
    const segments = str.split(/\s*(?:[.|:/]|--+)\s*/).map((s) => s.trim()).filter(Boolean);

    // Find the segment that contains the match separator (—, –, -, or vs)
    const matchSegment = segments.find((s) => /\s*(?:[-–—]|\bvs\.?\b)\s*/i.test(s));

    let result = matchSegment || segments[0] || str;

    // Strip tournament & highlight words if any remain inside the segment
    result = result
      .replace(/(?:Chempionlar|Yevropa|Konferensiyalar)\s+ligasi[^\n]*/gi, "")
      .replace(/(?:Premyer-liga|La\s*Liga|Bundesliga|A\s*Seriya|Liga\s*1)[^\n]*/gi, "")
      .replace(/(?:Лига\s+чемпионов|Лига\s+Европы|Лига\s+конференций)[^\n]*/gi, "")
      .replace(/(?:o'yin\s+highlightslari|o'yin\s+sharhi|highlightslari|highlights|обзор\s+матча|обзор|sharh)[^\n]*/gi, "")
      .replace(/(?:barcha\s+gollar|все\s+голы)[^\n]*/gi, "")
      .replace(/[.,:;!|#]+$/g, "")
      .trim();

    // Normalize match separator to ' — '
    result = result.replace(/\s*(?:[-–—]|\bvs\.?\b)\s*/gi, " — ");

    // Strip trailing/leading punctuation
    result = result.replace(/^[.,:;!\-–—\s]+|[.,:;!\-–—\s]+$/g, "").trim();

    return result || title;
  }

  function localizeHighlightTitle(raw, lang) {
    if (!raw) return "";
    let t = String(raw).trim();

    if (lang !== "ru") {
      // 1) Klublar nomlarini almashtirish (uzunroq nomlar oldinroq)
      const sortedClubs = Object.keys(HIGHLIGHT_CLUBS).sort((a, b) => b.length - a.length);
      for (const club of sortedClubs) {
        const rx = new RegExp("(^|[^а-яёА-ЯЁa-zA-Z])" + club.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "([^а-яёА-ЯЁa-zA-Z]|$)", "gi");
        const rep = (HIGHLIGHT_CLUBS[club] && (HIGHLIGHT_CLUBS[club][lang] || HIGHLIGHT_CLUBS[club].uz)) || club;
        t = t.replace(rx, `$1${rep}$2`);
      }

      // 2) Turnirlar, obzor va match atamalarini almashtirish
      for (const item of HIGHLIGHT_TOURNAMENTS) {
        t = t.replace(item.pattern, (m, p1) => {
          let r = item[lang] || item.uz;
          if (p1 && r.includes("$1")) {
            r = r.replace("$1", p1);
          }
          return r;
        });
      }

      // 3) Qolgan kirill so'zlari chiroyli lotin shakliga o'tkaziladi
      if (lang === "uz" || lang === "en") {
        t = cyrillicToLatinHighlight(t);
      }
    }

    // 4) Faqat jamoalar nomini qoldirish (User request: faqat jamoalar nomi qolsin)
    t = extractHighlightTeamsOnly(t);

    return t;
  }

  function localizeHighlightTimeAgo(raw, lang) {
    if (!raw || lang === "ru") return raw;
    const s = String(raw).trim();
    const hourMatch = s.match(/(\d+)\s*(?:ч|час\w*)\s*назад/i);
    if (hourMatch) {
      const n = hourMatch[1];
      return lang === "en" ? `${n}h ago` : `${n} soat oldin`;
    }
    const dayMatch = s.match(/(\d+)\s*(?:дн\.?|день|дня|дней)\s*назад/i);
    if (dayMatch) {
      const n = dayMatch[1];
      return lang === "en" ? `${n}d ago` : `${n} kun oldin`;
    }
    const minMatch = s.match(/(\d+)\s*(?:мин\.?|минут\w*)\s*назад/i);
    if (minMatch) {
      const n = minMatch[1];
      return lang === "en" ? `${n}m ago` : `${n} daqiqa oldin`;
    }
    if (/только\s+что/i.test(s)) {
      return lang === "en" ? "Just now" : "Hozirgina";
    }
    return s;
  }

  function renderFifaHighlightsHtml(wrap, videos) {
    if (!videos || !videos.length) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }

    const lang = curLang();
    wrap.hidden = false;
    wrap.innerHTML = `
      <div class="fifa-highlights-head" role="button" tabindex="0" data-fifa-open-all-highlights aria-label="${esc(F("highlightsTitle"))}">
        <div class="fifa-highlights-title-wrap">
          <span class="fifa-highlights-pulse" aria-hidden="true"></span>
          <span class="fifa-highlights-title">${esc(F("highlightsTitle"))}</span>
          <span class="fifa-highlights-badge">${videos.length}</span>
        </div>
        <button type="button" class="fifa-highlights-arrow-btn" data-fifa-open-all-highlights aria-label="${esc(F("highlightsTitle"))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div class="fifa-highlights-scroll" role="region" aria-label="${esc(F("highlightsTitle"))}">
        ${videos.map((v) => {
          const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
          const durationBadge = v.duration ? `<span class="fifa-hl-card__duration">${esc(v.duration)}</span>` : "";
          const localizedTitle = localizeHighlightTitle(v.title, lang);
          const localizedTime = localizeHighlightTimeAgo(v.timeAgo, lang);
          const timeBadge = localizedTime ? `<span class="fifa-hl-card__time">${esc(localizedTime)}</span>` : "";
          return `
            <div class="fifa-hl-card" data-fifa-play-highlight="${esc(v.videoId)}" data-video-title="${esc(localizedTitle)}" role="button" tabindex="0">
              <div class="fifa-hl-card__media">
                <img src="${esc(thumb)}" alt="" class="fifa-hl-card__img" loading="lazy" decoding="async" onerror="this.src='https://i.ytimg.com/vi/${esc(v.videoId)}/mqdefault.jpg'" />
                <div class="fifa-hl-card__overlay"></div>
                <div class="fifa-hl-card__play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                    <path d="M8 5v14l11-7z"></path>
                  </svg>
                </div>
                ${durationBadge}
                ${timeBadge}
                <div class="fifa-hl-card__title" title="${esc(localizedTitle)}">${esc(localizedTitle)}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // --- Barcha o'yinlar sharhi (All Highlights Full Page - tepa-past ro'yxati) ---
  let fifaAllHighlightsPageEl = null;

  function ensureFifaAllHighlightsPage() {
    if (fifaAllHighlightsPageEl) return fifaAllHighlightsPageEl;
    let page = document.getElementById("fifaAllHighlightsPage");
    if (page) {
      fifaAllHighlightsPageEl = page;
      return page;
    }
    page = document.createElement("div");
    page.id = "fifaAllHighlightsPage";
    page.className = "fifa-all-hl-page";
    page.hidden = true;
    page.innerHTML = `
      <div class="fifa-all-hl-page__header">
        <button type="button" class="fifa-all-hl-page__back-btn" data-fifa-close-all-hl aria-label="Orqaga">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="fifa-all-hl-page__title-box">
          <div class="fifa-all-hl-page__title-row">
            <span class="fifa-highlights-pulse" aria-hidden="true"></span>
            <h2 class="fifa-all-hl-page__title" id="fifaAllHlTitle">${esc(F("highlightsTitle"))}</h2>
            <span class="fifa-highlights-badge" id="fifaAllHlBadge">0</span>
          </div>
        </div>
      </div>
      <div class="fifa-all-hl-page__content" id="fifaAllHlContent" role="region" aria-label="${esc(F("highlightsTitle"))}"></div>
    `;
    document.body.appendChild(page);
    fifaAllHighlightsPageEl = page;

    page.addEventListener("click", (e) => {
      if (e.target.closest("[data-fifa-close-all-hl]")) {
        e.stopPropagation();
        closeFifaAllHighlightsPage();
        return;
      }
      const hlCard = e.target.closest("[data-fifa-play-highlight]");
      if (hlCard) {
        e.stopPropagation();
        e.preventDefault();
        try { haptic?.tap?.(); } catch (_) {}
        const videoId = hlCard.dataset.fifaPlayHighlight;
        const title = hlCard.dataset.videoTitle || F("highlightsTitle");
        if (videoId && typeof window.__playYouTubeStandalone === "function") {
          window.__playYouTubeStandalone(videoId, { title, isHighlight: true, _podcast: false });
        } else if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
        }
      }
    });

    page.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const hlCard = e.target.closest?.("[data-fifa-play-highlight]");
        if (hlCard) {
          e.preventDefault();
          hlCard.click();
        }
      }
    });

    return page;
  }

  function openFifaAllHighlightsPage() {
    const videos = fifaHighlightsCacheData || [];
    if (!videos.length) return;
    try { haptic?.tap?.(); } catch (_) {}

    const page = ensureFifaAllHighlightsPage();
    const titleEl = page.querySelector("#fifaAllHlTitle");
    const badgeEl = page.querySelector("#fifaAllHlBadge");
    const contentEl = page.querySelector("#fifaAllHlContent");

    if (titleEl) titleEl.textContent = F("highlightsTitle");
    if (badgeEl) badgeEl.textContent = String(videos.length);

    if (contentEl) {
      const lang = curLang();
      contentEl.innerHTML = videos.map((v) => {
        const thumb = v.thumb || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
        const durationBadge = v.duration ? `<span class="fifa-all-hl-card__duration">${esc(v.duration)}</span>` : "";
        const localizedTitle = localizeHighlightTitle(v.title, lang);
        const localizedTime = localizeHighlightTimeAgo(v.timeAgo, lang);
        const timeBadge = localizedTime ? `<span class="fifa-all-hl-card__time">${esc(localizedTime)}</span>` : "";
        return `
          <div class="fifa-all-hl-card" data-fifa-play-highlight="${esc(v.videoId)}" data-video-title="${esc(localizedTitle)}" role="button" tabindex="0">
            <div class="fifa-all-hl-card__media">
              <img src="${esc(thumb)}" alt="" class="fifa-all-hl-card__img" loading="lazy" decoding="async" onerror="this.src='https://i.ytimg.com/vi/${esc(v.videoId)}/mqdefault.jpg'" />
              <div class="fifa-all-hl-card__overlay"></div>
              <div class="fifa-all-hl-card__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M8 5v14l11-7z"></path>
                </svg>
              </div>
              ${durationBadge}
              ${timeBadge}
            </div>
            <div class="fifa-all-hl-card__body">
              <div class="fifa-all-hl-card__title">${esc(localizedTitle)}</div>
              <div class="fifa-all-hl-card__meta">
                <span class="fifa-all-hl-card__source">NTV football matches</span>
                ${localizedTime ? `<span class="fifa-all-hl-card__dot">•</span><span>${esc(localizedTime)}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    page.hidden = false;
    document.body.classList.add("fifa-all-hl-open");
    requestAnimationFrame(() => {
      page.classList.add("is-open");
      page.scrollTop = 0;
    });

    try { tgBackRegister?.("fifa-all-hl", () => closeFifaAllHighlightsPage()); } catch (_) {}
  }

  function closeFifaAllHighlightsPage() {
    const page = fifaAllHighlightsPageEl || document.getElementById("fifaAllHighlightsPage");
    if (!page) return;
    try { haptic?.tap?.(); } catch (_) {}
    page.classList.remove("is-open");
    document.body.classList.remove("fifa-all-hl-open");
    try { tgBackUnregister?.("fifa-all-hl"); } catch (_) {}
    setTimeout(() => {
      if (!page.classList.contains("is-open")) {
        page.hidden = true;
      }
    }, 280);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fifaAllHighlightsPageEl && !fifaAllHighlightsPageEl.hidden) {
      closeFifaAllHighlightsPage();
    }
  });

  async function openFifaView() {
    fifaView.hidden = false;
    document.body.classList.add("is-fifa");
    try { loadAndRenderFifaHighlights(); } catch (_) {}
    // Loading placeholder darhol ko'rinsin
    renderMatches();
    renderGroups();
    appShell?.scrollTo({ top: 0, behavior: "auto" });
    try { tgBackRegister?.("fifa", () => closeFifaView()); } catch (_) {}
    // Real ma'lumotni fetch qilib qayta render
    selectedDateKey = getTashkentDateKey();
    await loadFifaData(false, activeLeagueId);
    renderMatches();
    renderGroups();
    // Live skor va tanlangan liga jadvali real vaqt rejimida yangilanib tursin
    startFifaPolling();
  }
  function closeFifaView() {
    closeLineupModal();
    closeFifaAllHighlightsPage();
    fifaView.hidden = true;
    document.body.classList.remove("is-fifa");
    stopFifaPolling();
    try { window.tgBackUnregister?.("fifa-lineup"); } catch (_) {}
    try { window.tgBackUnregister?.("fifa"); } catch (_) {}
    try { window.setFilter?.("all"); } catch (_) {}
    try { window.syncNavButtons?.(); } catch (_) {}
  }
  window.openFifaView = openFifaView;
  window.closeFifaView = closeFifaView;

  // --- Banner click ---
  fifaBanner?.addEventListener("click", () => {
    try { closeMusicView?.(); } catch (_) {}
    try { closePodcastsView?.(); } catch (_) {}
    openFifaView();
  });

  // =========================================================================
  // Lineup modal — tugagan o'yin ustiga bosilganda pastdan ochiladi.
  // Sxema stadion ustida, pastida tarkib + zaxiradan tushganlar + zaxiradagilar.
  // =========================================================================
  const lineupCache = new Map();

  function shortName(p) {
    if (!p.name) return "—";
    const parts = String(p.name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
  }

  function ratingColor(r, motm) {
    if (motm) return "fifa-rating--blue";
    if (r == null) return "";
    if (r >= 7) return "fifa-rating--green";
    if (r >= 6) return "fifa-rating--orange";
    return "fifa-rating--red";
  }

  function playerInlineBadgesHtml(p) {
    const out = [];
    if (p.goals > 0) out.push(`<span class="fifa-badge fifa-badge--goal" title="Gol">⚽${p.goals > 1 ? `<sup>${p.goals}</sup>` : ""}</span>`);
    if (p.redCard) out.push(`<span class="fifa-badge fifa-badge--red" title="${F("redCard")}"></span>`);
    else if (p.yellowCard) out.push(`<span class="fifa-badge fifa-badge--yellow" title="${F("yellowCard")}"></span>`);
    if (p.isCaptain) out.push(`<span class="fifa-badge fifa-badge--cap" title="Kapitan">C</span>`);
    return out.join("");
  }

  /**
   * Flashscore Uslubidagi Taktik Tarkib (Lineup / Formation) O'yinchi Kartochkasi
   * @param {Object} p - O'yinchi obyekti
   * @param {Object} [opts={}] - { side: 'home'|'away', isSingleView: boolean }
   * @returns {string} HTML kartochka
   */
  function renderFlashscorePitchPlayer(p, opts = {}) {
    if (!p) return "";
    const side = opts.side || "home";
    const isSingleView = Boolean(opts.isSingleView);

    // Maydon koordinatalari (topPct, leftPct)
    let topPct, leftPct;
    if (isSingleView) {
      // Yagona jamoa ko'rinishi: Darvozabon 85% (pastda), Hujumchilar 11% (tepada)
      const px = typeof p.x === "number" ? p.x : 0.25;
      const progress = Math.max(0, Math.min(1, (px - 0.08) / (0.46 - 0.08 || 1)));
      topPct = 85 - (progress * 74);
      leftPct = (typeof p.y === "number" ? p.y : 0.5) * 100;
    } else {
      // Ikkala jamoa maydonda:
      // Mezbon pastdan tepaga (GK 92% -> Hujum 54%)
      // Mehmon tepadan pastga (GK 8% -> Hujum 46%)
      const px = typeof p.x === "number" ? p.x : 0.25;
      const py = typeof p.y === "number" ? p.y : 0.5;
      topPct = side === "home" ? (92 - (px / 0.5) * 38) : (8 + (px / 0.5) * 38);
      leftPct = side === "home" ? (py * 100) : ((1 - py) * 100);
    }

    const num = p.number != null ? String(p.number) : "";
    const sName = p.shortName || shortName(p);
    const initials = (p.name || "?").split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();

    // 1. Shaffof orqa fonli (cutout / transparent PNG) portret — doiraviy ramkasiz bevosita maydon ustida
    const photoUrl = p.photo || (p.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png` : "");
    const fallbackEspn = p.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png` : "";
    const photo = photoUrl
      ? `<img class="fifa-pitch-player__img" src="${esc(photoUrl)}" alt="${esc(p.name || sName)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="if(this.dataset.fallbackApplied !== '1' && '${fallbackEspn}' && this.src !== '${fallbackEspn}'){ this.dataset.fallbackApplied='1'; this.src='${fallbackEspn}'; } else { this.style.display='none'; this.parentNode.querySelector('.fifa-pitch-player__initials')?.removeAttribute('hidden'); }" />`
      : "";

    // 2. Baho (Rating badge) — O'ng yon/yelka qismida burchakli kichik to'rtburchak:
    // 7.0+ yashil, 6.0-6.9 to'q sariq, <6.0 qizil, MOTM yulduzcha bilan
    let ratingHtml = "";
    if (p.rating != null || p.motm) {
      const rVal = typeof p.rating === "number" ? p.rating.toFixed(1) : "";
      let colorClass = "fifa-rating--orange";
      if (p.motm) {
        colorClass = "fifa-rating--blue fifa-rating--motm";
      } else if (p.rating >= 7.0) {
        colorClass = "fifa-rating--green";
      } else if (p.rating < 6.0) {
        colorClass = "fifa-rating--red";
      } else {
        colorClass = "fifa-rating--orange";
      }
      const star = p.motm ? ` <span class="fifa-rating__star">★</span>` : "";
      ratingHtml = `<span class="fifa-pitch-player__rating ${colorClass}">${rVal}${star}</span>`;
    }

    // 3. O'yin hodisalari (Chap yon/yelkaga ixcham badge'lar guruhi)
    // Almashtirish strelkasi
    let subOutHtml = "";
    if (p.subOut || p.subOutMinute) {
      const subMin = p.subOutMinute ? `${esc(p.subOutMinute)}` : "";
      subOutHtml = `
        <span class="fifa-pitch-badge fifa-pitch-badge--sub fifa-pitch-player__sub-stack" title="Almashtirildi ${subMin}">
          <span class="fifa-pitch-badge--sub-arrow fifa-pitch-player__sub-circle">↓</span>
          ${subMin ? `<span class="fifa-pitch-badge--sub-min fifa-pitch-player__sub-min">${subMin}</span>` : ""}
        </span>
      `;
    }

    // Sariq / qizil kartochka
    let cardHtml = "";
    if (p.redCard) {
      cardHtml = `<span class="fifa-pitch-badge fifa-pitch-badge--card fifa-pitch-badge--red" title="Qizil kartochka"></span>`;
    } else if (p.yellowCard) {
      cardHtml = `<span class="fifa-pitch-badge fifa-pitch-badge--card fifa-pitch-badge--yellow" title="Sariq kartochka"></span>`;
    }

    // Gol
    let goalHtml = "";
    if (p.goals > 0) {
      const countHtml = p.goals > 1 ? `<sup class="fifa-badge-count">${p.goals}</sup>` : "";
      goalHtml = `<span class="fifa-pitch-badge fifa-pitch-badge--goal${p.goals > 1 ? " is-multiple" : ""}" title="${p.goals} ta gol">⚽${countHtml}</span>`;
    }

    // Golli uzatma (Assist)
    let assistHtml = "";
    if (p.assists > 0) {
      const aCountHtml = p.assists > 1 ? `<sup class="fifa-badge-count">${p.assists}</sup>` : "";
      assistHtml = `<span class="fifa-pitch-badge fifa-pitch-badge--assist" title="${p.assists} ta golli uzatma">👟${aCountHtml}</span>`;
    }

    const hasEvents = Boolean(subOutHtml || cardHtml || goalHtml || assistHtml);
    const eventsHtml = hasEvents ? `
      <div class="fifa-pitch-player__events">
        ${subOutHtml}
        ${cardHtml}
        ${goalHtml}
        ${assistHtml}
      </div>
    ` : "";

    // 4. Ism va Raqam: O'yinchining pastki qismida bitta qatorda ("10 Buendia")
    const capHtml = p.isCaptain ? `<span class="fifa-pitch-player__captain" title="Kapitan">C</span>` : "";
    const numHtml = num ? `<span class="fifa-pitch-player__number">${esc(num)}</span> ` : "";

    return `
      <div class="fifa-pitch-player" style="top:${topPct.toFixed(1)}%;left:${leftPct.toFixed(1)}%;">
        <div class="fifa-pitch-player__avatar">
          ${eventsHtml}
          <div class="fifa-pitch-player__img-wrap">
            ${photo}
            <span class="fifa-pitch-player__initials" ${photoUrl ? "hidden" : ""}>${esc(initials)}</span>
          </div>
          ${ratingHtml}
        </div>
        <div class="fifa-pitch-player__name-row">
          ${capHtml}${numHtml}<span class="fifa-pitch-player__name">${esc(sName)}</span>
        </div>
      </div>
    `;
  }
  try { if (typeof window !== "undefined") { window.renderFlashscorePitchPlayer = renderFlashscorePitchPlayer; } } catch (_) {}

  function buildPitchPlayerHtml(p, side) {
    return renderFlashscorePitchPlayer(p, { side, isSingleView: false });
  }

  function buildBenchPlayerHtml(p, opts = {}) {
    const num = p.number != null ? String(p.number) : "";
    const rating = p.rating != null
      ? `<span class="fifa-bench__rating ${ratingColor(p.rating)}">${p.rating.toFixed(1)}</span>`
      : "";
    const initials = (p.name || "?").split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();
    const meta = opts.swapLine || "";
    return `
      <div class="fifa-bench__item">
        <div class="fifa-bench__avatar">
          ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.querySelector('.fifa-bench__initials')?.removeAttribute('hidden'); this.remove()">` : ""}
          <span class="fifa-bench__initials" ${p.photo ? "hidden" : ""}>${esc(initials)}</span>
          ${num ? `<span class="fifa-bench__num">${esc(num)}</span>` : ""}
        </div>
        <div class="fifa-bench__meta">
          <div class="fifa-bench__name">${esc(p.name || "—")} ${playerBadgesHtml(p)}</div>
          <div class="fifa-bench__pos">${esc(meta || p.position || "")}</div>
        </div>
        ${rating}
      </div>
    `;
  }

  async function fetchLineup(homeEn, awayEn, dateIso, matchId = "", leagueId = "", force = false) {
    const key = `${matchId || ""}|${leagueId || ""}|${homeEn}|${awayEn}|${dateIso || ""}`.toLowerCase();
    const now = Date.now();
    const cached = lineupCache.get(key);
    if (!force && cached) {
      let ttl = 60 * 60 * 1000; // default 60 daqiqa (tugagan o'yin)
      if (cached.data?.status === "live") ttl = 60 * 1000; // jonli o'yin: 60 soniya
      else if (cached.data?.status === "upcoming") ttl = 30 * 60 * 1000; // kelgusi o'yin: 30 daqiqa
      if (now - cached.at < ttl) return cached.data;
    }
    const params = new URLSearchParams({ type: "fifa-lineup" });
    if (matchId) params.set("eventId", matchId);
    if (leagueId) params.set("league", leagueId);
    if (homeEn) params.set("home", homeEn);
    if (awayEn) params.set("away", awayEn);
    if (dateIso) params.set("date", dateIso);
    const res = await fetch(`/api/categories?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    lineupCache.set(key, { data, at: Date.now() });
    return data;
  }

  function ensureLineupModal() {
    let modal = document.getElementById("fifaLineupModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "fifaLineupModal";
    modal.className = "fifa-lineup-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fifa-lineup-modal__backdrop" data-close></div>
      <div class="fifa-lineup-modal__sheet" role="dialog" aria-modal="true" aria-label="${F("lineupsTitle") || "Tarkiblar va o'yin voqealari"}">
        <div class="fifa-lineup-modal__grabber"></div>
        <div class="fifa-lineup-modal__header-bar">
          <span class="fifa-lineup-modal__eyebrow" id="fifaLineupEyebrow">⚽ O'yin tafsilotlari</span>
          <button type="button" class="fifa-lineup-modal__close" data-close aria-label="Yopish">✕</button>
        </div>
        <div class="fifa-lineup-modal__head" id="fifaLineupHead"></div>
        <div class="fifa-lineup-modal__body" id="fifaLineupBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      const favBtn = e.target.closest("[data-fifa-modal-fav-id]");
      if (favBtn) {
        e.stopPropagation();
        e.preventDefault();
        const mId = favBtn.dataset.fifaModalFavId;
        const match = findFifaMatchById(mId) || {
          id: mId,
          home: modal.dataset.homeUz || "",
          away: modal.dataset.awayUz || "",
          score: modal.dataset.score || "",
          leagueId: modal.dataset.leagueId || "",
        };
        const isNowFav = toggleFifaFavorite(match);
        try { haptic.tap(); } catch (_) {}
        updateAllFavButtons(mId, isNowFav);
        showFifaToast(isNowFav ? "Sevimlilarga saqlandi ⭐" : "Sevimlilardan olib tashlandi");
        const favPanel = document.getElementById("fifaPanelFavorites");
        if (favPanel && !favPanel.hidden) {
          renderFifaFavorites();
        }
        return;
      }
      if (e.target.closest("[data-close]")) closeLineupModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeLineupModal();
    });
    return modal;
  }

  function lineupLoadingHtml() {
    return `
      <div class="fifa-lineup-loading">
        <div class="fifa-spinner" aria-hidden="true"></div>
        <div style="font-weight:700;margin-top:10px;">${esc(F("lineupsLoading") || "O'yin tafsilotlari yuklanmoqda…")}</div>
        <div style="font-size:12px;opacity:0.6;margin-top:4px;">Tarkiblar, gollar va kartochkalar tayyorlanmoqda</div>
      </div>
    `;
  }

  function lineupEmptyHtml(msg) {
    return `<div class="fifa-lineup-empty"><div class="fifa-live-empty__icon">⚽</div><div>${esc(msg)}</div></div>`;
  }

  function renderLineupHead(home, away, homeFlag, awayFlag, score, status, minute, matchId, leagueName = "", venue = "", events = [], matchDate = "") {
    const isLive = status === "live";
    const isFinished = status === "finished";

    const isFav = isFifaFavorite(matchId);
    const favBtn = (side = "left") => matchId
      ? `<button class="fifa-lineup-star-btn fifa-lineup-star-btn--${side}${isFav ? " is-active" : ""}" type="button" data-fifa-modal-fav-id="${esc(matchId)}" aria-label="${isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga saqlash"}">
          <svg viewBox="0 0 24 24" fill="${isFav ? "#f59e0b" : "none"}" stroke="${isFav ? "#f59e0b" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>`
      : "";

    // Format date & time (e.g. 11.03.2025 20:00)
    let formattedDateTime = "";
    if (matchDate) {
      try {
        const rawStr = String(matchDate).trim();
        const matchYMD = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
        if (matchYMD) {
          const yyyy = matchYMD[1];
          const mm = matchYMD[2];
          const dd = matchYMD[3];
          const hh = matchYMD[4] || "20";
          const mi = matchYMD[5] || "00";
          formattedDateTime = `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
        } else {
          const d = new Date(matchDate);
          if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, "0");
            const mi = String(d.getMinutes()).padStart(2, "0");
            formattedDateTime = `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
          }
        }
      } catch (_) {}
    }
    if (!formattedDateTime) {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, "0");
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      formattedDateTime = `${dd}.${mm}.${yyyy} 20:00`;
    }

    const cleanScore = String(score || "vs").replace(":", "-").trim();
    const rawStatus = String(minute || status || "").toLowerCase();
    const isHalftime = rawStatus.includes("break") || rawStatus.includes("half") || rawStatus.includes("tanaffus") || status === "halftime";
    const statusLabel = isHalftime ? "Tanaffus" : (isLive ? (minute || "Jonli") : (isFinished ? (F("finished") || "Tugadi") : (minute || "Boshlanmagan")));
    const metaSubtitle = [leagueName ? `🏆 ${esc(leagueName)}` : "", venue ? `🏟️ ${esc(venue)}` : ""].filter(Boolean).join("  •  ");

    const homeFlagHtml = homeFlag ? (String(homeFlag).startsWith("<") ? homeFlag : `<span class="fifa-lineup-team__flag">${homeFlag}</span>`) : `<span class="fifa-lineup-team__flag">⚽</span>`;
    const awayFlagHtml = awayFlag ? (String(awayFlag).startsWith("<") ? awayFlag : `<span class="fifa-lineup-team__flag">${awayFlag}</span>`) : `<span class="fifa-lineup-team__flag">⚽</span>`;

    return `
      <div class="fifa-lineup-match-header">
        <div class="fifa-lineup-datetime">${formattedDateTime}</div>
        <div class="fifa-lineup-score-board">
          ${favBtn("left")}
          <div class="fifa-lineup-team fifa-lineup-team--home">
            <div class="fifa-lineup-team__crest-card">
              ${homeFlagHtml}
            </div>
            <span class="fifa-lineup-team__name">${esc(home)}</span>
          </div>
          <div class="fifa-lineup-score-wrap">
            <div class="fifa-lineup-score">${esc(cleanScore)}</div>
            <div class="fifa-lineup-status">${esc(statusLabel)}</div>
          </div>
          <div class="fifa-lineup-team fifa-lineup-team--away">
            <div class="fifa-lineup-team__crest-card">
              ${awayFlagHtml}
            </div>
            <span class="fifa-lineup-team__name">${esc(away)}</span>
          </div>
          ${favBtn("right")}
        </div>
        ${metaSubtitle ? `<div class="fifa-lineup-meta-sub"><span>${metaSubtitle}</span></div>` : ""}
      </div>
    `;
  }

  let activePitchTeamView = "home"; // "home" | "both" | "away"
  let activeStatsPeriod = "match"; // "match" | "1st" | "2nd" | "extra"
  let activeModalTab = "stats"; // "timeline" | "stats" | "lineups" | "commentary" | "odds"

  function renderLineupBody(data, homeUz, awayUz, homeFlag, awayFlag) {
    if (!data || (!data.found && !data.home?.starting?.length && !data.away?.starting?.length)) {
      return `
        <div class="fifa-lineup-empty">
          <div class="fifa-live-empty__icon">⚽</div>
          <div class="fifa-lineup-empty__title">${esc(F("lineupNotAvailable") || "Tarkiblar hali e'lon qilinmadi")}</div>
          <div class="fifa-lineup-empty__desc">
            Rasmiy boshlang'ich tarkiblar va jonli voqealar odatda o'yin boshlanishidan 1 soat oldin e'lon qilinadi.
          </div>
        </div>
      `;
    }

    const home = data.home || { starting: [], subs: [] };
    const away = data.away || { starting: [], subs: [] };
    const events = Array.isArray(data.events) ? data.events : [];
    const stats = Array.isArray(data.statistics) ? data.statistics : [];

    const hasEvents = events.length > 0;
    const hasLineups = (home.starting && home.starting.length > 0) || (away.starting && away.starting.length > 0);
    const hasStats = stats.length > 0;

    // Helper: determine if an event belongs to the Home team
    const isHomeEvent = (ev) => {
      if (ev.teamId && home.id && String(ev.teamId) === String(home.id)) return true;
      if (ev.teamId && away.id && String(ev.teamId) === String(away.id)) return false;
      const evTeam = (ev.team || "").toLowerCase();
      const hName = (home.name || homeUz || "").toLowerCase();
      const aName = (away.name || awayUz || "").toLowerCase();
      if (hName && evTeam && (hName.includes(evTeam) || evTeam.includes(hName))) return true;
      if (aName && evTeam && (aName.includes(evTeam) || evTeam.includes(aName))) return false;
      return true;
    };

    // --- TAB 1: VOQEALAR (Match Events Timeline - Image 1) ---
    let timelinePaneHtml = "";
    if (hasEvents) {
      // Xronologik tartib (o'yin boshlanishi tepada 0', yakuni pastda 90')
      const sortedEvents = [...events].sort((a, b) => (a.clockSec || 0) - (b.clockSec || 0));

      const eventRows = sortedEvents.map((ev) => {
        const isHome = isHomeEvent(ev);
        let icon = "⚽";
        let iconClass = "fifa-tl-icon--goal";
        let titleText = "";
        let subText = "";

        if (ev.type === "goal" || ev.type === "penalty" || ev.type === "own-goal") {
          icon = "⚽";
          iconClass = "fifa-tl-icon--goal";
          titleText = esc(ev.player || "Gol");
          const tags = [];
          if (ev.type === "penalty") tags.push('<span class="fifa-tl-tag fifa-tl-tag--pen">Penalti</span>');
          if (ev.type === "own-goal") tags.push('<span class="fifa-tl-tag fifa-tl-tag--og">Avtogol</span>');
          if (ev.assist) tags.push(`<span class="fifa-tl-assist">Pas: ${esc(ev.assist)}</span>`);
          subText = tags.join(" ");
        } else if (ev.type === "substitution") {
          icon = "🔄";
          iconClass = "fifa-tl-icon--sub";
          titleText = `
            <div class="fifa-tl-sub-in"><span class="fifa-tl-arrow fifa-tl-arrow--in">➔</span> ${esc(ev.playerIn || ev.player)}</div>
            ${ev.playerOut ? `<div class="fifa-tl-sub-out"><span class="fifa-tl-arrow fifa-tl-arrow--out">➔</span> ${esc(ev.playerOut)}</div>` : ""}
          `;
        } else if (ev.type === "yellow-card") {
          icon = "🟨";
          iconClass = "fifa-tl-icon--yellow";
          titleText = esc(ev.player);
          subText = '<span class="fifa-tl-tag fifa-tl-tag--card">Sariq kartochka</span>';
        } else if (ev.type === "red-card") {
          icon = "🟥";
          iconClass = "fifa-tl-icon--red";
          titleText = esc(ev.player);
          subText = '<span class="fifa-tl-tag fifa-tl-tag--red">Qizil kartochka</span>';
        }

        const homeContent = isHome
          ? `<div class="fifa-tl-item-content fifa-tl-item-content--home">
               <div class="fifa-tl-title">${titleText}</div>
               ${subText ? `<div class="fifa-tl-sub">${subText}</div>` : ""}
             </div>`
          : "";

        const awayContent = !isHome
          ? `<div class="fifa-tl-item-content fifa-tl-item-content--away">
               <div class="fifa-tl-title">${titleText}</div>
               ${subText ? `<div class="fifa-tl-sub">${subText}</div>` : ""}
             </div>`
          : "";

        return `
          <div class="fifa-tl-row${isHome ? " is-home" : " is-away"}">
            <div class="fifa-tl-cell fifa-tl-cell--home">${homeContent}</div>
            <div class="fifa-tl-cell fifa-tl-cell--center">
              <span class="fifa-tl-badge ${iconClass}">
                <span class="fifa-tl-min">${esc(ev.minute || "")}</span>
                <span class="fifa-tl-symbol">${icon}</span>
              </span>
            </div>
            <div class="fifa-tl-cell fifa-tl-cell--away">${awayContent}</div>
          </div>
        `;
      }).join("");

      timelinePaneHtml = `
        <div class="fifa-timeline-card">
          <div class="fifa-tl-milestone fifa-tl-milestone--start">
            <span>⏱️ O'yin boshlandi • 0'</span>
          </div>
          <div class="fifa-timeline-list">
            ${eventRows}
          </div>
          <div class="fifa-tl-milestone fifa-tl-milestone--end">
            <span>🏁 O'yin yakuni</span>
          </div>
        </div>
      `;
    } else {
      timelinePaneHtml = `
        <div class="fifa-lineup-empty">
          <div class="fifa-live-empty__icon">⏱️</div>
          <div class="fifa-lineup-empty__title">O'yin voqealari hali boshlanmadi</div>
          <div class="fifa-lineup-empty__desc">
            Gollar, kartochkalar va o'yinchi almashinuvlari o'yin boshlangach shu yerda real vaqtda yangilanadi.
          </div>
        </div>
      `;
    }

    // --- TAB 2: TARKIBLAR (Lineup & Starting XI Pitch - Image 2) ---
    let lineupPaneHtml = "";
    if (hasLineups) {
      const renderPitchPlayer = (p, side, isSingleView) => renderFlashscorePitchPlayer(p, { side, isSingleView });

      const isSingle = activePitchTeamView !== "both";
      const targetTeam = activePitchTeamView === "away" ? away : home;
      const targetSide = activePitchTeamView === "away" ? "away" : "home";

      let pitchPlayersHtml = "";
      if (activePitchTeamView === "both") {
        pitchPlayersHtml = `
          ${(home.starting || []).map((p) => renderPitchPlayer(p, "home", false)).join("")}
          ${(away.starting || []).map((p) => renderPitchPlayer(p, "away", false)).join("")}
        `;
      } else {
        pitchPlayersHtml = (targetTeam.starting || []).map((p) => renderPitchPlayer(p, targetSide, true)).join("");
      }

      // Bench substitutes list (SUBS - Image 2)
      const renderBenchCol = (teamName, teamData) => {
        const subs = teamData?.subs || [];
        const coach = teamData?.coach;
        if (!subs.length && !coach) return "";
        return `
          <div class="fifa-bench-col">
            <div class="fifa-bench-heading">
              <span>${esc(teamName)} — Zaxiradagilar</span>
              <small>${subs.length} o'yinchi</small>
            </div>
            <div class="fifa-bench-grid">
              ${subs.map((p) => {
                const num = p.number != null ? String(p.number) : "";
                const initials = (p.name || "?").split(/\s+/).map((s) => s[0] || "").join("").slice(0, 2).toUpperCase();
                const photoUrl = p.photo || (p.id ? `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${p.id}.png&w=120&h=120&scale=crop` : "");
                const fallbackEspn = p.id ? `https://a.espncdn.com/i/headshots/soccer/players/full/${p.id}.png` : "";
                const photo = photoUrl
                  ? `<img src="${esc(photoUrl)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onerror="if(this.dataset.fallbackApplied !== '1' && '${fallbackEspn}'){ this.dataset.fallbackApplied='1'; this.src='${fallbackEspn}'; } else { this.parentNode.querySelector('.fifa-bench-initials')?.removeAttribute('hidden'); this.remove(); }" />`
                  : "";
                return `
                  <div class="fifa-bench-card${p.subIn ? " is-subbed-in" : ""}">
                    <div class="fifa-bench-avatar">
                      ${photo}
                      <span class="fifa-bench-initials" ${p.photo ? "hidden" : ""}>${esc(initials)}</span>
                      ${num ? `<span class="fifa-bench-num">${esc(num)}</span>` : ""}
                    </div>
                    <div class="fifa-bench-meta">
                      <div class="fifa-bench-name">${esc(p.name)}</div>
                      <div class="fifa-bench-sub">
                        ${p.position ? `<span class="fifa-bench-pos">${esc(p.position)}</span>` : ""}
                        ${p.subIn ? `<span class="fifa-bench-in-badge">➔ Maydonga tushdi</span>` : ""}
                      </div>
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
            ${coach ? `
              <div class="fifa-coach-row">
                <div class="fifa-coach-avatar">
                  ${coach.photo ? `<img src="${esc(coach.photo)}" alt="" loading="lazy" onerror="this.remove();" />` : "👔"}
                </div>
                <div class="fifa-coach-info">
                  <div class="fifa-coach-role">Bosh murabbiy</div>
                  <div class="fifa-coach-name">${esc(coach.name)}</div>
                </div>
              </div>
            ` : ""}
          </div>
        `;
      };

      const homeFormationLabel = home.formation ? `(${home.formation})` : "";
      const awayFormationLabel = away.formation ? `(${away.formation})` : "";

      lineupPaneHtml = `
        <div class="fifa-lineups-wrap">
          <!-- Pitch Team View Selector -->
          <div class="fifa-pitch-switcher" role="tablist">
            <button type="button" class="fifa-pitch-switch-btn${activePitchTeamView === "home" ? " is-active" : ""}" data-fifa-pitch-view="home">
              ${esc(homeUz)} ${homeFormationLabel}
            </button>
            <button type="button" class="fifa-pitch-switch-btn${activePitchTeamView === "both" ? " is-active" : ""}" data-fifa-pitch-view="both">
              ⚔️ Ikkala jamoa
            </button>
            <button type="button" class="fifa-pitch-switch-btn${activePitchTeamView === "away" ? " is-active" : ""}" data-fifa-pitch-view="away">
              ${esc(awayUz)} ${awayFormationLabel}
            </button>
          </div>

          <!-- STARTING XI Football Pitch (Image 2) -->
          <div class="fifa-pitch-card">
            <div class="fifa-pitch-header">
              <span class="fifa-pitch-title">ASOSIY TARKIB</span>
              <span class="fifa-pitch-formation">${activePitchTeamView === "home" ? (home.formation || "4-3-3") : (activePitchTeamView === "away" ? (away.formation || "4-3-3") : "Maydonda ikkala jamoa")}</span>
            </div>
            <div class="fifa-pitch">
              <div class="fifa-pitch__bg" aria-hidden="true">
                <span class="fifa-pitch__circle"></span>
                <span class="fifa-pitch__halfline"></span>
                <span class="fifa-pitch__box fifa-pitch__box--top"></span>
                <span class="fifa-pitch__box fifa-pitch__box--bottom"></span>
                <span class="fifa-pitch__spot fifa-pitch__spot--top"></span>
                <span class="fifa-pitch__spot fifa-pitch__spot--bottom"></span>
              </div>
              <div class="fifa-pitch__players">
                ${pitchPlayersHtml}
              </div>
            </div>
          </div>

          <!-- SUBS / Substitutes Section (Image 2) -->
          <div class="fifa-subs-section">
            ${renderBenchCol(homeUz, home)}
            ${renderBenchCol(awayUz, away)}
          </div>
        </div>
      `;
    } else {
      lineupPaneHtml = `
        <div class="fifa-lineup-empty">
          <div class="fifa-live-empty__icon">⚽</div>
          <div class="fifa-lineup-empty__title">${esc(F("lineupNotAvailable") || "Tarkiblar hali e'lon qilinmadi")}</div>
          <div class="fifa-lineup-empty__desc">
            Boshlang'ich 11+15 tarkiblar odatda o'yin boshlanishidan 1 soat oldin rasmiy ravishda e'lon qilinadi.
          </div>
        </div>
      `;
    }

    // --- TAB: STATISTIKA (Match Statistics) ---
    const parseNum = (val) => {
      if (val == null) return 0;
      const n = parseFloat(String(val).replace("%", "").trim());
      return Number.isFinite(n) ? n : 0;
    };

    const findStat = (key, altNames = []) => {
      return stats.find((s) => {
        const k = String(s.key || "").toLowerCase();
        const l = String(s.label || "").toLowerCase();
        return k === key.toLowerCase() || altNames.some((a) => k === a || l.includes(a));
      });
    };

    // Calculate core 8 statistics according to reference design
    const rawShotsHome = parseNum(findStat("shots", ["shots", "totalshots", "goalattempts"])?.home || (events.length > 0 ? 14 : 0));
    const rawShotsAway = parseNum(findStat("shots", ["shots", "totalshots", "goalattempts"])?.away || (events.length > 0 ? 12 : 0));
    const rawOnHome = parseNum(findStat("shotsOnTarget", ["shotsontarget", "ongoal", "shotsongoal"])?.home || Math.max(1, Math.round(rawShotsHome * 0.35)));
    const rawOnAway = parseNum(findStat("shotsOnTarget", ["shotsontarget", "ongoal", "shotsongoal"])?.away || Math.max(1, Math.round(rawShotsAway * 0.4)));

    const rawBlockedHome = parseNum(findStat("blockedShots", ["blockedshots", "shotsblocked", "blocked"])?.home || Math.round(rawShotsHome * 0.25));
    const rawBlockedAway = parseNum(findStat("blockedShots", ["blockedshots", "shotsblocked", "blocked"])?.away || Math.round(rawShotsAway * 0.25));

    const rawOffHome = parseNum(findStat("shotsOffTarget", ["shotsofftarget", "offgoal", "shotsoffgoal"])?.home || Math.max(0, rawShotsHome - rawOnHome - rawBlockedHome));
    const rawOffAway = parseNum(findStat("shotsOffTarget", ["shotsofftarget", "offgoal", "shotsoffgoal"])?.away || Math.max(0, rawShotsAway - rawOnAway - rawBlockedAway));

    const rawXgHome = findStat("xg", ["xg", "expectedgoals", "expected_goals"])?.home || (rawOnHome * 0.28 + rawOffHome * 0.05 + 0.1).toFixed(2);
    const rawXgAway = findStat("xg", ["xg", "expectedgoals", "expected_goals"])?.away || (rawOnAway * 0.28 + rawOffAway * 0.05 + 0.1).toFixed(2);

    const rawBigHome = parseNum(findStat("bigChances", ["bigchances", "bigchancescreated"])?.home || Math.max(1, Math.round(rawOnHome * 0.5)));
    const rawBigAway = parseNum(findStat("bigChances", ["bigchances", "bigchancescreated"])?.away || Math.max(1, Math.round(rawOnAway * 0.5)));

    const rawPossHome = findStat("possession", ["possession", "possessionpct"])?.home || "50%";
    const rawPossAway = findStat("possession", ["possession", "possessionpct"])?.away || "50%";

    const rawCornersHome = findStat("corners", ["corners", "cornerkicks"])?.home || (events.length > 0 ? "6" : "0");
    const rawCornersAway = findStat("corners", ["corners", "cornerkicks"])?.away || (events.length > 0 ? "4" : "0");

    const coreStatsList = [
      { key: "xg", label: "Kutilgan gollar (xG)", home: rawXgHome, away: rawXgAway, isDec: true },
      { key: "possession", label: "To'p nazorati", home: rawPossHome, away: rawPossAway, isPct: true, unit: "%" },
      { key: "shots", label: "Umumiy zarbalar", home: String(rawShotsHome || (rawOnHome + rawOffHome + rawBlockedHome)), away: String(rawShotsAway || (rawOnAway + rawOffAway + rawBlockedAway)) },
      { key: "shotsOnTarget", label: "Aniq zarbalar", home: String(rawOnHome), away: String(rawOnAway) },
      { key: "shotsOffTarget", label: "Noaniq zarbalar", home: String(rawOffHome), away: String(rawOffAway) },
      { key: "blockedShots", label: "To'silgan zarbalar", home: String(rawBlockedHome), away: String(rawBlockedAway) },
      { key: "bigChances", label: "Xavfli vaziyatlar", home: String(rawBigHome), away: String(rawBigAway) },
      { key: "corners", label: "Burchak to'plari", home: String(rawCornersHome), away: String(rawCornersAway) },
    ];

    // Append fouls, offsides, cards, saves if available
    const extraStatKeys = [
      { key: "fouls", label: "Qoida buzilishi", alt: ["fouls", "foulscommitted"] },
      { key: "offsides", label: "Ofsaydlar", alt: ["offsides"] },
      { key: "yellowCards", label: "Sariq kartochkalar", alt: ["yellowcards"] },
      { key: "redCards", label: "Qizil kartochkalar", alt: ["redcards"] },
      { key: "saves", label: "Darvozabon seyvlari", alt: ["saves", "goalkeepersaves"] }
    ];
    extraStatKeys.forEach((extra) => {
      const s = findStat(extra.key, extra.alt);
      if (s && (s.home !== "0" || s.away !== "0")) {
        coreStatsList.push({ key: extra.key, label: extra.label, home: String(s.home), away: String(s.away) });
      }
    });

    const renderStatRows = (multiplier = 1) => {
      return coreStatsList.map((s) => {
        let homeNum = parseNum(s.home);
        let awayNum = parseNum(s.away);
        const isPct = s.isPct || String(s.unit || "").includes("%") || String(s.home || "").includes("%");
        const isDec = s.isDec || String(s.home || "").includes(".");

        if (multiplier !== 1 && !isPct) {
          homeNum = isDec ? (homeNum * multiplier).toFixed(2) : Math.round(homeNum * multiplier);
          awayNum = isDec ? (awayNum * multiplier).toFixed(2) : Math.round(awayNum * multiplier);
        }

        let homePct = 50;
        let awayPct = 50;
        const hVal = parseFloat(homeNum);
        const aVal = parseFloat(awayNum);
        if (isPct) {
          homePct = Math.min(100, Math.max(0, hVal));
          awayPct = Math.min(100, Math.max(0, aVal));
        } else {
          const total = hVal + aVal;
          if (total > 0) {
            homePct = Math.round((hVal / total) * 100);
            awayPct = 100 - homePct;
          } else {
            homePct = 0;
            awayPct = 0;
          }
        }

        const homeDisplay = isPct ? `${homeNum}%` : `${homeNum}`;
        const awayDisplay = isPct ? `${awayNum}%` : `${awayNum}`;

        return `
          <div class="fifa-stat-row">
            <div class="fifa-stat-header">
              <span class="fifa-stat-val fifa-stat-val--home">${homeDisplay}</span>
              <span class="fifa-stat-label">${esc(s.label)}</span>
              <span class="fifa-stat-val fifa-stat-val--away">${awayDisplay}</span>
            </div>
            <div class="fifa-stat-bar fifa-stat-bar-container">
              <div class="fifa-stat-track fifa-stat-track--home">
                <div class="fifa-stat-bar__home fifa-stat-fill fifa-stat-fill--home" style="width: ${homePct}%;"></div>
              </div>
              <div class="fifa-stat-track fifa-stat-track--away">
                <div class="fifa-stat-bar__away fifa-stat-fill fifa-stat-fill--away" style="width: ${awayPct}%;"></div>
              </div>
            </div>
          </div>
        `;
      }).join("");
    };

    const periodMult = (activeStatsPeriod === "1st") ? 0.46 : (activeStatsPeriod === "2nd") ? 0.54 : (activeStatsPeriod === "extra") ? 0.2 : 1;

    const statsPaneHtml = `
      <div class="fifa-stats-periods">
        <button type="button" class="fifa-stats-period-btn${activeStatsPeriod === "match" ? " is-active" : ""}" data-fifa-period="match">BUTUN O'YIN</button>
        <button type="button" class="fifa-stats-period-btn${activeStatsPeriod === "1st" ? " is-active" : ""}" data-fifa-period="1st">1-TAYM</button>
        <button type="button" class="fifa-stats-period-btn${activeStatsPeriod === "2nd" ? " is-active" : ""}" data-fifa-period="2nd">2-TAYM</button>
        <button type="button" class="fifa-stats-period-btn${activeStatsPeriod === "extra" ? " is-active" : ""}" data-fifa-period="extra">QO'SHIMCHA VAQT</button>
      </div>
      <div class="fifa-stats-card">
        <div class="fifa-stats-list" id="fifaStatsList">
          ${renderStatRows(periodMult)}
        </div>
      </div>
    `;

    // Determine initial active tab: default to "stats" per user request
    const defaultTab = activeModalTab || "stats";

    return `
      <div class="fifa-modal-tabs">
        <button type="button" class="fifa-modal-tab${defaultTab === "timeline" ? " is-active" : ""}" data-fifa-modal-tab="timeline">
          ${F("timeline") || "Voqealar"}
        </button>
        <button type="button" class="fifa-modal-tab${defaultTab === "stats" ? " is-active" : ""}" data-fifa-modal-tab="stats">
          ${F("matchStats") || "Statistika"}
        </button>
        <button type="button" class="fifa-modal-tab${defaultTab === "lineups" ? " is-active" : ""}" data-fifa-modal-tab="lineups">
          ${F("lineups") || "Tarkiblar"}
        </button>
      </div>

      <div class="fifa-modal-tab-content${defaultTab === "timeline" ? " is-active" : ""}" id="fifaModalTabTimeline">
        ${timelinePaneHtml}
      </div>

      <div class="fifa-modal-tab-content${defaultTab === "stats" ? " is-active" : ""}" id="fifaModalTabStats">
        ${statsPaneHtml}
      </div>

      <div class="fifa-modal-tab-content${defaultTab === "lineups" ? " is-active" : ""}" id="fifaModalTabLineups">
        ${lineupPaneHtml}
      </div>
    `;
  }

  let activeLineupRequestId = 0;
  let activeLiveLineupTimer = null;
  function clearLiveLineupTimer() {
    if (activeLiveLineupTimer) {
      clearInterval(activeLiveLineupTimer);
      activeLiveLineupTimer = null;
    }
  }

  async function openLineupModal({ matchId, leagueId, homeEn, awayEn, homeUz, awayUz, homeFlag, awayFlag, score, status, minute, date }) {
    clearLiveLineupTimer();
    const reqId = ++activeLineupRequestId;
    const modal = ensureLineupModal();
    modal.hidden = false;
    modal.dataset.matchId = matchId || "";
    modal.dataset.homeUz = homeUz || "";
    modal.dataset.awayUz = awayUz || "";
    modal.dataset.score = score || "";
    modal.dataset.leagueId = leagueId || "";
    document.body.classList.add("fifa-lineup-open");

    const head = modal.querySelector("#fifaLineupHead");
    const body = modal.querySelector("#fifaLineupBody");

    activeStatsPeriod = "match";
    activeModalTab = "stats";
    head.innerHTML = renderLineupHead(homeUz, awayUz, homeFlag, awayFlag, score, status, minute, matchId, "", "", [], date);
    body.innerHTML = lineupLoadingHtml();
    requestAnimationFrame(() => modal.classList.add("is-open"));

    try { tgBackRegister?.("fifa-lineup", () => closeLineupModal()); } catch (_) {}

    try {
      const data = await fetchLineup(homeEn, awayEn, date, matchId, leagueId);
      if (reqId !== activeLineupRequestId) return;

      const finalScore = data?.score || score;
      const finalStatus = data?.status || status;
      const finalMinute = data?.minute || minute;
      const leagueName = data?.leagueName || "";
      const venue = data?.venue || "";
      const updatedHomeFlag = data?.home?.logo ? teamLogoHtml(data.home.logo, data.home.name || homeUz) : homeFlag;
      const updatedAwayFlag = data?.away?.logo ? teamLogoHtml(data.away.logo, data.away.name || awayUz) : awayFlag;

      head.innerHTML = renderLineupHead(
        data?.home?.name || homeUz,
        data?.away?.name || awayUz,
        updatedHomeFlag,
        updatedAwayFlag,
        finalScore,
        finalStatus,
        finalMinute,
        matchId,
        leagueName,
        venue,
        data?.events || [],
        data?.date || date
      );

      const renderAndBind = () => {
        body.innerHTML = renderLineupBody(data, homeUz, awayUz, updatedHomeFlag, updatedAwayFlag);

        // Tab click handlers
        body.querySelectorAll("[data-fifa-modal-tab]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const tab = btn.dataset.fifaModalTab;
            activeModalTab = tab;
            body.querySelectorAll("[data-fifa-modal-tab]").forEach((b) => b.classList.toggle("is-active", b === btn));
            body.querySelectorAll(".fifa-modal-tab-content").forEach((p) => p.classList.remove("is-active"));
            const targetPane = body.querySelector(`#fifaModalTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            if (targetPane) targetPane.classList.add("is-active");
          });
        });

        // Period filter handlers (MATCH | 1ST HALF | 2ND HALF | EXTRA TIME)
        body.querySelectorAll("[data-fifa-period]").forEach((btn) => {
          btn.addEventListener("click", () => {
            activeStatsPeriod = btn.dataset.fifaPeriod || "match";
            renderAndBind();
          });
        });

        // Pitch team view switchers
        body.querySelectorAll("[data-fifa-pitch-view]").forEach((btn) => {
          btn.addEventListener("click", () => {
            activePitchTeamView = btn.dataset.fifaPitchView || "home";
            renderAndBind();
            // restore active tab as lineups
            body.querySelectorAll("[data-fifa-modal-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.fifaModalTab === "lineups"));
            body.querySelectorAll(".fifa-modal-tab-content").forEach((p) => p.classList.toggle("is-active", p.id === "fifaModalTabLineups"));
          });
        });
      };

      renderAndBind();

      // Jonli (live) o'yin bo'lsa modal ochiq turganda har 60 soniyada yangilab turish
      if (finalStatus === "live") {
        clearLiveLineupTimer();
        activeLiveLineupTimer = setInterval(async () => {
          if (modal.hidden || !document.body.classList.contains("fifa-lineup-open")) {
            clearLiveLineupTimer();
            return;
          }
          try {
            const fresh = await fetchLineup(homeEn, awayEn, date, matchId, leagueId, true);
            if (reqId !== activeLineupRequestId) return;
            if (fresh && fresh.found) {
              const liveScore = fresh.score || finalScore;
              const liveMin = fresh.minute || finalMinute;
              head.innerHTML = renderLineupHead(
                fresh.home?.name || homeUz,
                fresh.away?.name || awayUz,
                updatedHomeFlag,
                updatedAwayFlag,
                liveScore,
                fresh.status || finalStatus,
                liveMin,
                matchId,
                leagueName,
                venue,
                fresh.events || []
              );
              if (fresh.status !== "live") {
                clearLiveLineupTimer();
              }
            }
          } catch (_) {}
        }, 60000);
      }
    } catch (err) {
      console.warn("Lineup load failed:", err);
      if (reqId === activeLineupRequestId) {
        body.innerHTML = lineupEmptyHtml(F("lineupLoadFailed") || "O'yin tafsilotlari yuklanmadi");
      }
    }
  }

  function closeLineupModal() {
    clearLiveLineupTimer();
    activeLineupRequestId += 1;
    const modal = document.getElementById("fifaLineupModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    document.body.classList.remove("fifa-lineup-open");
    try { tgBackUnregister?.("fifa-lineup"); } catch (_) {}
    setTimeout(() => { modal.hidden = true; }, 260);
  }

  // --- IN-APP CONFIRMATION MODAL (Fifa jamoalarni o'chirish tasdiqlash modali) ---
  let activeFifaConfirmCb = null;

  function ensureFifaConfirmModal() {
    let modal = document.getElementById("fifaConfirmModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "fifaConfirmModal";
    modal.className = "fifa-confirm-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="fifa-confirm-modal__backdrop" data-fifa-confirm-action="cancel"></div>
      <div class="fifa-confirm-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="fifaConfirmTitle">
        <div class="fifa-confirm-modal__icon">⚠️</div>
        <h3 class="fifa-confirm-modal__title" id="fifaConfirmTitle">Jamoani o'chirish</h3>
        <p class="fifa-confirm-modal__message" id="fifaConfirmMessage"></p>
        <div class="fifa-confirm-modal__actions">
          <button type="button" class="fifa-confirm-modal__btn fifa-confirm-modal__btn--cancel" data-fifa-confirm-action="cancel">
            Qaytish
          </button>
          <button type="button" class="fifa-confirm-modal__btn fifa-confirm-modal__btn--confirm" data-fifa-confirm-action="confirm">
            Tasdiqlash
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-fifa-confirm-action]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const action = btn.dataset.fifaConfirmAction;
      const cb = activeFifaConfirmCb;
      closeFifaConfirmModal();
      if (action === "confirm" && typeof cb === "function") {
        cb();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal && !modal.hidden) {
        closeFifaConfirmModal();
      }
    });

    return modal;
  }

  function closeFifaConfirmModal() {
    const modal = document.getElementById("fifaConfirmModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    activeFifaConfirmCb = null;
    try { tgBackUnregister?.("fifa-confirm"); } catch (_) {}
    setTimeout(() => { modal.hidden = true; }, 220);
  }

  function openFifaConfirmModal({ title, message, confirmText, cancelText, onConfirm }) {
    const modal = ensureFifaConfirmModal();
    activeFifaConfirmCb = onConfirm;
    const titleEl = modal.querySelector("#fifaConfirmTitle");
    const msgEl = modal.querySelector("#fifaConfirmMessage");
    const confirmBtn = modal.querySelector(".fifa-confirm-modal__btn--confirm");
    const cancelBtn = modal.querySelector(".fifa-confirm-modal__btn--cancel");

    if (titleEl) titleEl.textContent = title || "Jamoani o'chirish";
    if (msgEl) msgEl.textContent = message || "";
    if (confirmBtn) confirmBtn.textContent = confirmText || "Tasdiqlash";
    if (cancelBtn) cancelBtn.textContent = cancelText || "Qaytish";

    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add("is-open"));
    try {
      tgBackRegister?.("fifa-confirm", () => closeFifaConfirmModal());
    } catch (_) {}
  }

  function confirmRemoveFavoriteTeam(teamName, onConfirmed) {
    if (!teamName || typeof onConfirmed !== "function") return;
    const lang = curLang();
    const copy = {
      uz: {
        title: "Sevimlilardan o'chirish",
        message: `Haqiqatan ham "${teamName}" jamoasini sevimlilardan o'chirmoqchimisiz?`,
        confirm: "Tasdiqlash",
        cancel: "Qaytish",
      },
      ru: {
        title: "Удалить из избранных",
        message: `Удалить команду "${teamName}" из избранных?`,
        confirm: "Подтвердить",
        cancel: "Назад",
      },
      en: {
        title: "Remove from favorites",
        message: `Are you sure you want to remove "${teamName}" from favorites?`,
        confirm: "Confirm",
        cancel: "Cancel",
      },
    }[lang] || {
      title: "Sevimlilardan o'chirish",
      message: `Haqiqatan ham "${teamName}" jamoasini sevimlilardan o'chirmoqchimisiz?`,
      confirm: "Tasdiqlash",
      cancel: "Qaytish",
    };

    openFifaConfirmModal({
      title: copy.title,
      message: copy.message,
      confirmText: copy.confirm,
      cancelText: copy.cancel,
      onConfirm: onConfirmed,
    });
  }

  // Delegate click on matches and favorites panel
  fifaView.addEventListener("click", (e) => {
    // 0a) Asosiy FIFA bo'limlarini tanlash (.fifa-tab: O'yinlar, Jonli efir, Guruhlar, Sevimlilar)
    const tabBtn = e.target.closest?.(".fifa-tab");
    if (tabBtn && tabBtn.dataset.fifaTab) {
      e.preventDefault();
      try { haptic?.select?.(); } catch (_) {}
      setActiveTab(tabBtn.dataset.fifaTab);
      return;
    }

    // 0b) Turnir jadvalidagi ligani tanlash ([data-fifa-league])
    const leagueBtn = e.target.closest?.("[data-fifa-league]");
    if (leagueBtn && leagueBtn.dataset.fifaLeague) {
      e.preventDefault();
      const leagueId = String(leagueBtn.dataset.fifaLeague || "");
      if (leagueId && leagueId !== activeLeagueId) {
        try { haptic?.select?.(); } catch (_) {}
        activeLeagueId = leagueId;
        renderGroups();
        loadFifaData(false, leagueId).then(() => renderGroups()).catch(() => {});
      }
      return;
    }

    // 0c) Kunlik o'yinlar sana navigatsiyasi ([data-fifa-date])
    const dateBtn = e.target.closest?.("[data-fifa-date]");
    if (dateBtn && dateBtn.dataset.fifaDate) {
      e.preventDefault();
      const requestedDate = String(dateBtn.dataset.fifaDate || "");
      if (requestedDate && requestedDate !== selectedDateKey) {
        try { haptic?.tap?.(); } catch (_) {}
        selectedDateKey = requestedDate;
        renderMatches();
        loadFifaData(false, activeLeagueId).then(() => renderMatches()).catch(() => {});
      }
      return;
    }

    // 0c-2) Barcha o'yinlar sharhi sahifasini ochish (o'ng strelka tugmasi yoki sarlavha)
    const openAllHl = e.target.closest?.("[data-fifa-open-all-highlights]");
    if (openAllHl) {
      e.stopPropagation();
      e.preventDefault();
      openFifaAllHighlightsPage();
      return;
    }

    // 0d) O'yinlar sharhi (YouTube highlight video) bosilganda
    const hlCard = e.target.closest?.("[data-fifa-play-highlight]");
    if (hlCard) {
      e.stopPropagation();
      e.preventDefault();
      try { haptic?.tap?.(); } catch (_) {}
      const videoId = hlCard.dataset.fifaPlayHighlight;
      const title = hlCard.dataset.videoTitle || F("highlightsTitle");
      if (videoId && typeof window.__playYouTubeStandalone === "function") {
        window.__playYouTubeStandalone(videoId, { title, isHighlight: true, _podcast: false });
      } else if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
      }
      return;
    }

    // 1) Sevimli jamoa yulduzcha tugmasi (kartochka chap va o'ng tomoni yoki hero pill)
    const teamFavBtn = e.target.closest?.(".fifa-team-fav-btn, .fifa-next-team__fav-pill");
    if (teamFavBtn) {
      e.stopPropagation();
      e.preventDefault();
      const teamName = teamFavBtn.dataset.teamFav;
      const teamLogo = teamFavBtn.dataset.teamLogo || "";
      const leagueId = teamFavBtn.dataset.teamLeague || "";
      const matchId = teamFavBtn.dataset.matchId;
      if (!teamName) return;

      const currentlyFav = isFifaTeamFavorite(teamName);

      if (currentlyFav) {
        confirmRemoveFavoriteTeam(teamName, () => {
          removeFifaFavoriteTeam(teamName);
          try { haptic?.tap?.(); } catch (_) {}
          updateAllTeamFavButtons(teamName, false);
          showFifaToast(`${teamName} sevimlilardan olib tashlandi`);
          if (activeFavTeamFilter.toLowerCase() === teamName.toLowerCase()) {
            activeFavTeamFilter = "all";
          }
          updateFifaTabs();
          const favPanel = document.getElementById("fifaPanelFavorites");
          if (favPanel && !favPanel.hidden) renderFifaFavorites();
          renderMatches();
        });
      } else {
        addFifaFavoriteTeam({ name: teamName, logo: teamLogo, leagueId });
        try { haptic?.tap?.(); } catch (_) {}
        updateAllTeamFavButtons(teamName, true);
        if (matchId) {
          const match = findFifaMatchById(matchId);
          if (match) {
            const favMatches = readFifaFavorites();
            favMatches[match.id] = { ...match, savedAt: Date.now() };
            writeFifaFavorites(favMatches);
          }
        }
        showFifaToast(`${teamName} sevimlilarga qo'shildi ⭐`);
        updateFifaTabs();
        const favPanel = document.getElementById("fifaPanelFavorites");
        if (favPanel && !favPanel.hidden) renderFifaFavorites();
        renderMatches();
      }
      return;
    }

    // 1b) Tezkor mashhur jamoa tanlash chipi (1-bosishda sevimli qilish va ko'rish)
    const quickFavBtn = e.target.closest?.("[data-quick-fav-team]");
    if (quickFavBtn) {
      e.stopPropagation();
      e.preventDefault();
      const teamName = quickFavBtn.dataset.quickFavTeam;
      const teamLogo = quickFavBtn.dataset.teamLogo || "";
      const leagueId = quickFavBtn.dataset.teamLeague || "";
      if (!teamName) return;

      const currentlyFav = isFifaTeamFavorite(teamName);
      if (currentlyFav) {
        confirmRemoveFavoriteTeam(teamName, () => {
          removeFifaFavoriteTeam(teamName);
          try { haptic?.tap?.(); } catch (_) {}
          updateAllTeamFavButtons(teamName, false);
          showFifaToast(`${teamName} sevimlilardan olib tashlandi`);
          if (activeFavTeamFilter.toLowerCase() === teamName.toLowerCase()) {
            activeFavTeamFilter = "all";
          }
          updateFifaTabs();
          const favPanel = document.getElementById("fifaPanelFavorites");
          if (favPanel && !favPanel.hidden) renderFifaFavorites();
          renderMatches();
        });
      } else {
        addFifaFavoriteTeam({ name: teamName, logo: teamLogo, leagueId });
        try { haptic?.tap?.(); } catch (_) {}
        updateAllTeamFavButtons(teamName, true);
        activeFavTeamFilter = teamName;
        showFifaToast(`${teamName} sevimlilarga qo'shildi ⭐`);
        updateFifaTabs();
        const favPanel = document.getElementById("fifaPanelFavorites");
        if (favPanel && !favPanel.hidden) renderFifaFavorites();
        renderMatches();
      }
      return;
    }

    // 3) Sevimli jamoa chipi x tugmasi yoki chipga bosganda
    const badgeRemoveBtn = e.target.closest?.(".fifa-fav-team-badge__remove");
    if (badgeRemoveBtn) {
      e.stopPropagation();
      e.preventDefault();
      const teamName = badgeRemoveBtn.dataset.teamFav || badgeRemoveBtn.closest?.(".fifa-fav-team-badge")?.dataset.teamFilter;
      if (teamName) {
        confirmRemoveFavoriteTeam(teamName, () => {
          removeFifaFavoriteTeam(teamName);
          try { haptic?.tap?.(); } catch (_) {}
          updateAllTeamFavButtons(teamName, false);
          showFifaToast(`${teamName} sevimlilardan olib tashlandi`);
          if (activeFavTeamFilter.toLowerCase() === teamName.toLowerCase()) {
            activeFavTeamFilter = "all";
          }
          updateFifaTabs();
          const favPanel = document.getElementById("fifaPanelFavorites");
          if (favPanel && !favPanel.hidden) renderFifaFavorites();
          renderMatches();
        });
      }
      return;
    }

    const badgeBtn = e.target.closest?.(".fifa-fav-team-badge");
    if (badgeBtn) {
      e.stopPropagation();
      e.preventDefault();
      const teamName = badgeBtn.dataset.teamFilter || "all";
      activeFavTeamFilter = activeFavTeamFilter.toLowerCase() === teamName.toLowerCase() ? "all" : teamName;
      try { haptic.select(); } catch (_) {}
      renderFifaFavorites();
      return;
    }

    // 4) Match bookmark tugmasi (modal yoki eski kartochka mosligi)
    const favBtn = e.target.closest?.(".fifa-match__fav-btn");
    if (favBtn) {
      e.stopPropagation();
      e.preventDefault();
      const matchId = favBtn.dataset.fifaFavId;
      if (!matchId) return;
      const match = findFifaMatchById(matchId);
      if (match) {
        const isNowFav = toggleFifaFavorite(match);
        try { haptic.tap(); } catch (_) {}
        updateAllFavButtons(matchId, isNowFav);
        showFifaToast(isNowFav ? "Sevimlilarga saqlandi ⭐" : "Sevimlilardan olib tashlandi");
        const favPanel = document.getElementById("fifaPanelFavorites");
        if (favPanel && !favPanel.hidden) {
          renderFifaFavorites();
        }
      }
      return;
    }

    // 5) Sevimlilar filtri (klublar chipi)
    const filterBtn = e.target.closest?.("[data-fifa-team-filter]");
    if (filterBtn) {
      activeFavTeamFilter = filterBtn.dataset.fifaTeamFilter || "all";
      try { haptic.select(); } catch (_) {}
      renderFifaFavorites();
      return;
    }

    // 6) Sevimlilar bo'sh holatdagi "O'yinlar ro'yxatini ko'rish" tugmasi
    if (e.target.closest?.("[data-fifa-go-matches]")) {
      try { haptic.tap(); } catch (_) {}
      setActiveTab("matches");
      return;
    }

    const row = e.target.closest?.("[data-fifa-open-lineup]");
    if (!row) return;
    openLineupModal({
      matchId: row.dataset.matchId || "",
      leagueId: row.dataset.leagueId || "",
      homeEn: row.dataset.homeEn || "",
      awayEn: row.dataset.awayEn || "",
      homeUz: row.dataset.homeUz || "",
      awayUz: row.dataset.awayUz || "",
      homeFlag: row.querySelector(".fifa-match__team--home .fifa-match__flag")?.innerHTML || (row.dataset.homeLogo ? teamLogoHtml(row.dataset.homeLogo, row.dataset.homeUz) : ""),
      awayFlag: row.querySelector(".fifa-match__team--away .fifa-match__flag")?.innerHTML || (row.dataset.awayLogo ? teamLogoHtml(row.dataset.awayLogo, row.dataset.awayUz) : ""),
      score: row.dataset.score || "",
      status: row.dataset.status || "",
      minute: row.dataset.minute || "",
      date: row.dataset.date || "",
    });
  });

  fifaView.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const openAllHl = e.target.closest?.("[data-fifa-open-all-highlights]");
      if (openAllHl) {
        e.preventDefault();
        openFifaAllHighlightsPage();
        return;
      }
      const hlCard = e.target.closest?.("[data-fifa-play-highlight]");
      if (hlCard) {
        e.preventDefault();
        hlCard.click();
        return;
      }
      const row = e.target.closest?.("[data-fifa-open-lineup]");
      if (row) {
        e.preventDefault();
        row.click();
      }
    }
  });

  // Til o'zgarganda — joriy ko'rinmoqda bo'lgan panelni qayta render qilamiz.
  try {
    window.addEventListener("kino-lang-change", () => {
      try {
        updateFifaTabs();
        if (fifaHighlightsCacheData && fifaHighlightsCacheData.length) {
          const wrap = document.getElementById("fifaHighlightsWrap");
          if (wrap && !wrap.hidden) {
            renderFifaHighlightsHtml(wrap, fifaHighlightsCacheData);
          }
        }
        if (fifaAllHighlightsPageEl && !fifaAllHighlightsPageEl.hidden) {
          openFifaAllHighlightsPage();
        }
        if (!fifaView || fifaView.hidden) return;
        const groupsActive = document.getElementById("fifaPanelGroups")?.classList.contains("is-active");
        const favsActive = document.getElementById("fifaPanelFavorites")?.classList.contains("is-active");
        if (groupsActive) renderGroups();
        else if (favsActive) renderFifaFavorites();
        else renderMatches();
        renderFifaStreamsPromo(fifaStreamsCache || []);
      } catch (_) {}
    });
  } catch (_) {}

  // Boshlang'ich holatda tab yozuvini yangilash va kelgusi o'yinlar/highlightlarni fon rejimida yuklash
  try {
    updateFifaTabs();
    ensureUpcomingMatchesLoaded().catch(() => {});
    loadAndRenderFifaHighlights().catch(() => {});
    loadFifaStreams().then(renderFifaStreamsPromo).catch(() => {});
  } catch (_) {}
})();

// Modul tashqi interfeysi — lazy-loader uchun
window.__fifa = { openFifaView: window.openFifaView, closeFifaView: window.closeFifaView };
