// Shaxmat va shashka: do'st bilan online (havola orqali), kompyuterga qarshi
// va bir telefonda ikki kishi. Qoidalar chess-engine.js / checkers-engine.js
// da; online yurishlar /api/games orqali serverda tekshiriladi.
(function () {
  "use strict";

  const tg = window.Telegram?.WebApp;
  const isInsideTelegram = Boolean(tg && tg.initData);
  const Chess = window.ChessEngine;
  const Checkers = window.CheckersEngine;
  const BOT_USERNAME = String(window.MYKINO_BOT_USERNAME || "myntv_bot").replace(/^@/, "");
  const API = "/api/games";
  const ASSET_VERSION = "20261028-games-ui";
  const STORE_ROOMS = "games_online_rooms";
  const STORE_LOCAL = "games_local_";
  const STORE_SOUND = "games_sound";
  const LEVEL_NAMES = { 1: "Oson", 2: "O'rta", 3: "Qiyin" };
  const STORE_TIME = "games_time_control";
  const STORE_BOARD = "games_board_theme";
  const STORE_STATS = "games_stats";
  const BOARD_THEMES = [
    { id: "wood", name: "Yog'och" },
    { id: "green", name: "Yashil" },
    { id: "blue", name: "Moviy" },
    { id: "purple", name: "Binafsha" },
    { id: "marble", name: "Marmar" },
  ];
  // Vaqt turlari: daqiqa + har yurishdan keyin qo'shiladigan soniya.
  const TIME_CATEGORIES = [
    { id: "bullet", name: "Bullet", icon: "⚡", options: ["1+0", "2+1"] },
    { id: "blitz", name: "Blits", icon: "🔥", options: ["3+0", "3+2", "5+0"] },
    { id: "rapid", name: "Rapid", icon: "⏱", options: ["10+0", "10+5", "15+10"] },
    { id: "classical", name: "Klassik", icon: "🏛", options: ["30+0", "30+20"] },
    { id: "none", name: "Cheksiz", icon: "∞", options: ["none"] },
  ];
  const categoryOf = (tc) => TIME_CATEGORIES.find((c) => c.options.includes(tc)) || TIME_CATEGORIES[TIME_CATEGORIES.length - 1];
  function parseTimeControl(tc) {
    const m = /^(\d+)\+(\d+)$/.exec(String(tc || ""));
    return m ? { base: Number(m[1]) * 60000, inc: Number(m[2]) * 1000 } : null;
  }
  const timeControlLabel = (tc) => (parseTimeControl(tc) ? `${categoryOf(tc).name} ${tc}` : "vaqtsiz");
  const COLOR_NAMES = { w: "Oqlar", b: "Qoralar" };
  const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"/></svg>';
  const REASONS = {
    checkmate: "Mot",
    stalemate: "Pat — yurishga joy qolmadi",
    fifty: "50 yurish davomida urish ham, piyoda yurishi ham bo'lmadi",
    repetition: "Pozitsiya uch marta takrorlandi",
    material: "Mot qilish uchun kuch yetarli emas",
    timeout: "Vaqt tugadi",
    resign: "Taslim bo'lindi",
    agreement: "Kelishuv bo'yicha durang",
    nomoves: "Yurish qolmadi",
    kings: "15 yurish davomida faqat damkalar yurdi",
    cancelled: "O'yin bekor qilindi",
  };

  const ADAPTERS = {
    chess: {
      title: "Shaxmat",
      create: () => Chess.createInitialState(),
      legal: (s) => Chess.legalMoves(s),
      apply: (s, m) => Chess.applyMove(s, m),
      status: (s) => Chess.getStatus(s),
      notation: (s, m) => Chess.moveToSan(s, m),
      last: (m) => ({ from: m.from, to: m.to }),
      dest: (m) => m.to,
      isCapture: (m) => Boolean(m.captured),
      colorOf: (p) => Chess.colorOf(p),
      payload: (m) => ({ from: Chess.squareName(m.from), to: Chess.squareName(m.to), promotion: m.promotion || undefined }),
      same: (a, b) => a.from === b.from && a.to === b.to && (a.promotion || null) === (b.promotion || null),
    },
    checkers: {
      title: "Shashka",
      create: () => Checkers.createInitialState(),
      legal: (s) => Checkers.legalMoves(s),
      apply: (s, m) => Checkers.applyMove(s, m),
      status: (s) => Checkers.getStatus(s),
      notation: (s, m) => Checkers.moveToText(m),
      last: (m) => ({ from: m.from, to: Checkers.destination(m), path: m.path, captures: m.captures }),
      dest: (m) => Checkers.destination(m),
      isCapture: (m) => m.captures.length > 0,
      colorOf: (p) => Checkers.colorOf(p),
      payload: (m) => ({ from: Checkers.squareName(m.from), path: m.path.map(Checkers.squareName) }),
      same: (a, b) => a.from === b.from && a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]),
    },
  };

  const $ = (id) => document.getElementById(id);
  const opposite = (c) => (c === "w" ? "b" : "w");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  // ---------------- Telegram ----------------
  function setupTelegram() {
    if (!tg) return;
    try { tg.ready(); } catch (_) {}
    try { tg.expand(); } catch (_) {}
    // Dona sudrayotganda mini app yopilib ketmasin.
    try { tg.disableVerticalSwipes?.(); } catch (_) {}
    const applyInsets = () => {
      const top = (Number(tg.safeAreaInset?.top) || 0) + (Number(tg.contentSafeAreaInset?.top) || 0);
      if (top) document.documentElement.style.setProperty("--tg-safe-top", top + "px");
    };
    applyInsets();
    try {
      tg.onEvent?.("safeAreaChanged", applyInsets);
      tg.onEvent?.("contentSafeAreaChanged", applyInsets);
      tg.onEvent?.("fullscreenChanged", applyInsets);
    } catch (_) {}
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      tg.setHeaderColor?.(bg);
      tg.setBackgroundColor?.(bg);
    } catch (_) {}
    try {
      tg.BackButton.onClick(goBack);
      tg.BackButton.show();
    } catch (_) {}
  }

  function haptic(kind) {
    try {
      if (kind === "success" || kind === "error" || kind === "warning") tg?.HapticFeedback?.notificationOccurred(kind);
      else tg?.HapticFeedback?.impactOccurred(kind || "light");
    } catch (_) {}
  }

  function myName() {
    const u = tg?.initDataUnsafe?.user;
    const full = u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : "";
    return full || "Mehmon";
  }

  // ---------------- Ovoz ----------------
  let audioCtx = null;
  let soundOn = readJson(STORE_SOUND, true) !== false;

  function tone(freq, duration, { type = "sine", gain = 0.12, delay = 0 } = {}) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch (_) {}
  }
  const sounds = {
    move: () => tone(420, 0.07, { type: "triangle", gain: 0.16 }),
    capture: () => { tone(260, 0.09, { type: "square", gain: 0.06 }); tone(180, 0.12, { type: "triangle", gain: 0.14, delay: 0.03 }); },
    check: () => tone(880, 0.14, { type: "sine", gain: 0.1 }),
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { gain: 0.1, delay: i * 0.1 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.22, { gain: 0.1, delay: i * 0.12 })),
    notify: () => { tone(660, 0.09, { gain: 0.1 }); tone(880, 0.12, { gain: 0.1, delay: 0.1 }); },
  };

  // ---------------- Taxta rangi ----------------
  function applyBoardTheme(id) {
    const theme = BOARD_THEMES.find((t) => t.id === id) || BOARD_THEMES[0];
    if (theme.id === "wood") document.documentElement.removeAttribute("data-board");
    else document.documentElement.setAttribute("data-board", theme.id);
    return theme;
  }
  function nextBoardTheme() {
    const current = readJson(STORE_BOARD, "wood");
    const i = BOARD_THEMES.findIndex((t) => t.id === current);
    const theme = applyBoardTheme(BOARD_THEMES[(i + 1) % BOARD_THEMES.length].id);
    writeJson(STORE_BOARD, theme.id);
    toast(`Taxta: ${theme.name}`, 1400);
    haptic("light");
  }

  // ---------------- Statistika ----------------
  function readStats() {
    return Object.assign({ wins: 0, draws: 0, losses: 0 }, readJson(STORE_STATS, {}));
  }
  function recordResult(outcome) {
    const stats = readStats();
    stats[outcome] += 1;
    writeJson(STORE_STATS, stats);
  }
  function rankName(wins) {
    if (wins >= 50) return "Grossmeyster";
    if (wins >= 20) return "Usta";
    if (wins >= 5) return "Havaskor";
    return "Yangi o'yinchi";
  }
  function renderHero() {
    const name = myName();
    $("heroName").textContent = name;
    $("heroAvatar").textContent = name.trim().charAt(0).toUpperCase() || "?";
    const stats = readStats();
    $("statPlayed").textContent = stats.wins + stats.draws + stats.losses;
    $("statWins").textContent = stats.wins;
    $("statDraws").textContent = stats.draws;
    $("statLosses").textContent = stats.losses;
    $("heroRank").textContent = rankName(stats.wins);
  }

  function launchConfetti() {
    const box = $("confetti");
    box.textContent = "";
    const colors = ["#f59e0b", "#6d5dfc", "#22b8f0", "#10b981", "#ef4444", "#fde68a"];
    for (let i = 0; i < 46; i++) {
      const bit = document.createElement("i");
      bit.style.left = Math.random() * 100 + "%";
      bit.style.background = colors[i % colors.length];
      bit.style.animationDelay = Math.random() * 0.35 + "s";
      bit.style.setProperty("--dx", (Math.random() - 0.5) * 160 + "px");
      bit.style.setProperty("--rot", (Math.random() - 0.5) * 900 + "deg");
      box.appendChild(bit);
    }
    setTimeout(() => { box.textContent = ""; }, 2600);
  }

  function syncSoundButton() {
    $("soundToggle").classList.toggle("is-muted", !soundOn);
  }

  // ---------------- Toast va oynalar ----------------
  let toastTimer = null;
  function toast(text, ms = 2200) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function openSheet(id) { $(id).hidden = false; }
  function closeSheet(id) { $(id).hidden = true; }
  const openSheets = () => ["setupSheet", "resultSheet", "confirmSheet"].filter((id) => !$(id).hidden);

  let confirmHandler = null;
  function confirmAction(title, text, yesLabel, onYes) {
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yesLabel;
    confirmHandler = onYes;
    openSheet("confirmSheet");
  }

  // ---------------- Bosh ekran ----------------
  let selectedGame = "chess";
  let setupMode = null;
  const savedTime = readJson(STORE_TIME, "10+0");
  const setupOptions = { level: "2", timeControl: TIME_CATEGORIES.some((c) => c.options.includes(savedTime)) ? savedTime : "10+0", color: "random" };

  function renderTimePicker() {
    const active = categoryOf(setupOptions.timeControl);
    const cats = $("tcCats");
    cats.textContent = "";
    for (const cat of TIME_CATEGORIES) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tc-cat" + (cat === active ? " is-active" : "");
      btn.innerHTML = '<span class="tc-cat__icon"></span><span class="tc-cat__name"></span>';
      btn.querySelector(".tc-cat__icon").textContent = cat.icon;
      btn.querySelector(".tc-cat__name").textContent = cat.name;
      btn.addEventListener("click", () => {
        if (cat !== active) setTimeControl(cat.options[cat.options.length > 2 ? 1 : 0]);
      });
      cats.appendChild(btn);
    }
    const opts = $("tcOptions");
    opts.textContent = "";
    opts.hidden = active.id === "none";
    for (const tc of active.options) {
      const [min, inc] = tc.split("+");
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (tc === setupOptions.timeControl ? " is-active" : "");
      chip.textContent = inc === "0" ? `${min} daqiqa` : `${min} + ${inc}`;
      chip.addEventListener("click", () => setTimeControl(tc));
      opts.appendChild(chip);
    }
    const parsed = parseTimeControl(setupOptions.timeControl);
    $("tcHint").textContent = parsed
      ? `Har biringizga ${parsed.base / 60000} daqiqa${parsed.inc ? `, har yurishdan keyin +${parsed.inc / 1000} soniya` : ""}`
      : "Vaqt cheklanmaydi";
  }

  function setTimeControl(tc) {
    setupOptions.timeControl = tc;
    writeJson(STORE_TIME, tc);
    renderTimePicker();
  }

  function showView(name) {
    $("homeView").hidden = name !== "home";
    $("gameView").hidden = name !== "game";
    window.scrollTo(0, 0);
  }

  function selectGame(game) {
    selectedGame = game;
    document.querySelectorAll(".game-card").forEach((el) => el.classList.toggle("is-active", el.dataset.game === game));
  }

  // Shashkada vaqt nazorati yo'q — soat faqat shaxmatda.
  function gameOptions(game) {
    return game === "checkers" ? Object.assign({}, setupOptions, { timeControl: "none" }) : setupOptions;
  }

  function openSetup(mode) {
    setupMode = mode;
    const timed = selectedGame === "chess";
    // Shashkada bir telefonda o'ynash uchun sozlanadigan narsa qolmaydi.
    if (!timed && mode === "local") return startLocal(selectedGame, mode, gameOptions(selectedGame));
    const title = ADAPTERS[selectedGame].title;
    $("setupTitle").textContent = `${title}: ${mode === "online" ? "do'st bilan online" : mode === "ai" ? "kompyuterga qarshi" : "bir telefonda"}`;
    $("levelField").hidden = mode !== "ai";
    $("colorField").hidden = mode === "local";
    $("timeField").hidden = !timed;
    if (timed) renderTimePicker();
    $("setupStart").textContent = mode === "online" ? "O'yin yaratish" : "Boshlash";
    openSheet("setupSheet");
  }

  function renderResumeList() {
    const items = [];
    for (const game of ["chess", "checkers"]) {
      const saved = readJson(STORE_LOCAL + game, null);
      if (saved && !saved.result && saved.moves?.length) items.push({ kind: "local", game, saved, updatedAt: saved.updatedAt || 0 });
    }
    for (const room of readJson(STORE_ROOMS, [])) {
      if (room.status !== "ended") items.push({ kind: "online", game: room.game, room, updatedAt: room.updatedAt || 0 });
    }
    items.sort((a, b) => b.updatedAt - a.updatedAt);
    const list = $("resumeList");
    list.textContent = "";
    for (const item of items.slice(0, 5)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "resume-item";
      const icon = item.game === "chess" ? "♞︎" : "⛀︎";
      let title;
      let sub;
      let tag = "";
      if (item.kind === "online") {
        const r = item.room;
        title = r.opponent ? `${r.opponent} bilan` : "Do'stingiz kutilmoqda";
        sub = `${ADAPTERS[item.game].title} · online · ${COLOR_NAMES[r.color].toLowerCase()}`;
        if (r.status === "waiting") tag = '<span class="resume-item__tag">Kutilmoqda</span>';
        else if (r.myTurn) tag = '<span class="resume-item__tag resume-item__tag--turn">Navbatingiz</span>';
        btn.addEventListener("click", () => joinRoom(r.id));
      } else {
        const s = item.saved;
        title = s.mode === "ai" ? `Kompyuter · ${LEVEL_NAMES[s.level] || ""}` : "Bir telefonda";
        sub = `${ADAPTERS[item.game].title} · ${s.moves.length} ta yurish`;
        btn.addEventListener("click", () => resumeLocal(item.game));
      }
      btn.innerHTML = `<span class="resume-item__icon">${icon}</span><span class="resume-item__text"><b></b><small></small></span>${tag}`;
      btn.querySelector("b").textContent = title;
      btn.querySelector("small").textContent = sub;
      list.appendChild(btn);
    }
    $("resumeBlock").hidden = !items.length;
  }

  function rememberRoom(patch) {
    const rooms = readJson(STORE_ROOMS, []).filter((r) => r.id !== patch.id);
    const prev = readJson(STORE_ROOMS, []).find((r) => r.id === patch.id) || {};
    rooms.unshift(Object.assign(prev, patch, { updatedAt: Date.now() }));
    writeJson(STORE_ROOMS, rooms.slice(0, 20));
  }
  const savedRoom = (id) => readJson(STORE_ROOMS, []).find((r) => r.id === id) || null;

  // ---------------- O'yin sessiyasi ----------------
  let session = null;

  function newSession(game, mode, extra) {
    const adapter = ADAPTERS[game];
    return Object.assign({
      game,
      mode,
      adapter,
      state: adapter.create(),
      moves: [],
      lastMove: null,
      history: [],
      myColor: null,
      level: 2,
      flipped: false,
      result: null,
      resultShown: false,
      selected: -1,
      candidates: [],
      pathSoFar: [],
      legal: [],
      aiThinking: false,
      hint: null,
      // online
      room: null,
      token: "",
      version: 0,
      status: "active",
      players: null,
      clock: null,
      clockAt: 0,
      drawOffer: null,
      rematch: null,
      poll: null,
    }, extra || {});
  }

  function enterSession(s) {
    leaveSession();
    session = s;
    session.legal = session.result ? [] : session.adapter.legal(session.state);
    $("gameTitle").textContent = s.adapter.title;
    closeSheet("resultSheet");
    showView("game");
    render();
    startClockTicker();
    if (s.mode === "online") {
      setRoomInUrl(s.room);
      startPolling();
    }
    if (s.mode === "ai" && !s.result && s.state.turn !== s.myColor) scheduleAi();
  }

  function leaveSession() {
    if (!session) return;
    stopPolling();
    stopClockTicker();
    cancelAi();
    if (session.mode !== "online") saveLocal();
    session = null;
    setRoomInUrl(null);
  }

  function setRoomInUrl(room) {
    try {
      const url = new URL(location.href);
      if (room) url.searchParams.set("room", room);
      else url.searchParams.delete("room");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function startLocal(game, mode, options = {}) {
    const s = newSession(game, mode);
    s.timeControl = options.timeControl || "none";
    const tc = parseTimeControl(s.timeControl);
    if (tc) s.clock = { w: tc.base, b: tc.base, inc: tc.inc, running: "w" };
    s.clockAt = Date.now();
    if (mode === "ai") {
      s.level = Number(options.level) || 2;
      s.myColor = options.color === "w" || options.color === "b" ? options.color : Math.random() < 0.5 ? "w" : "b";
    }
    enterSession(s);
    saveLocal();
  }

  function saveLocal() {
    if (!session || session.mode === "online") return;
    writeJson(STORE_LOCAL + session.game, {
      mode: session.mode,
      state: session.state,
      moves: session.moves,
      lastMove: session.lastMove,
      myColor: session.myColor,
      level: session.level,
      result: session.result,
      timeControl: session.timeControl,
      clock: snapshotClock(session),
      updatedAt: Date.now(),
    });
  }

  function resumeLocal(game) {
    const saved = readJson(STORE_LOCAL + game, null);
    if (!saved) return;
    enterSession(newSession(game, saved.mode, {
      state: saved.state,
      moves: saved.moves || [],
      lastMove: saved.lastMove || null,
      myColor: saved.myColor || null,
      level: saved.level || 2,
      result: saved.result || null,
      resultShown: Boolean(saved.result),
      timeControl: saved.timeControl || "none",
      // Ilovadan chiqib turilgan vaqt hisoblanmaydi.
      clock: saved.clock || null,
      clockAt: Date.now(),
    }));
  }

  // Pastdagi tomon: o'z rangim (yoki oqlar), "aylantirish" bosilsa — teskari.
  function bottomColor() {
    const base = session.myColor || "w";
    return session.flipped ? opposite(base) : base;
  }

  function canMove() {
    if (!session || session.result || session.aiThinking) return false;
    const turn = session.state.turn;
    if (session.mode === "local") return true;
    if (session.mode === "ai") return turn === session.myColor;
    return session.status === "active" && session.myColor === turn;
  }

  // ---------------- Taxtani chizish ----------------
  const boardEl = $("board");
  let drag = null;

  function displayToSquare(d) {
    const row = Math.floor(d / 8);
    const col = d % 8;
    return bottomColor() === "w" ? (7 - row) * 8 + col : row * 8 + (7 - col);
  }
  function squareToDisplay(sq) {
    const r = sq >> 3, f = sq & 7;
    return bottomColor() === "w" ? { row: 7 - r, col: f } : { row: r, col: 7 - f };
  }

  // Shashkada bir necha bosqichli urish paytida dona oraliq katakda ko'rinadi.
  function displayBoard() {
    const board = session.state.board.slice();
    const captured = new Set();
    if (session.game === "checkers" && session.selected >= 0 && session.pathSoFar.length) {
      const piece = board[session.selected];
      board[session.selected] = null;
      board[session.pathSoFar[session.pathSoFar.length - 1]] = piece;
      for (const c of session.candidates[0].captures.slice(0, session.pathSoFar.length)) captured.add(c);
    }
    return { board, captured };
  }

  function pieceNode(game, p, captured) {
    const el = document.createElement("div");
    el.className = "piece";
    if (game === "chess") {
      const color = Chess.colorOf(p);
      el.innerHTML = `<span class="chess-piece" data-color="${color}">${GLYPH[p.toLowerCase()]}︎</span>`;
    } else {
      const color = Checkers.colorOf(p);
      el.innerHTML = `<span class="disc${captured ? " is-captured" : ""}" data-color="${color}">${Checkers.isKing(p) ? CROWN : ""}</span>`;
    }
    return el;
  }

  function currentTargets() {
    const map = new Map();
    for (const m of session.candidates) {
      const sq = session.game === "chess" ? m.to : m.path[session.pathSoFar.length];
      if (sq == null) continue;
      const capture = session.game === "chess" ? Boolean(m.captured) : m.captures.length > session.pathSoFar.length;
      map.set(sq, map.get(sq) || capture);
    }
    return map;
  }

  function render(options = {}) {
    if (!session) return;
    if (drag) cancelDrag();
    const { board, captured } = displayBoard();
    const targets = session.selected >= 0 ? currentTargets() : new Map();
    const last = session.lastMove;
    let checkSq = -1;
    if (session.game === "chess" && Chess.inCheck(session.state)) checkSq = Chess.findKing(session.state.board, session.state.turn);
    // Shashkada urish majburiy bo'lsa, ura oladigan donalarni belgilaymiz.
    const movable = new Set();
    if (session.game === "checkers" && canMove() && session.selected < 0 && session.legal.length && session.legal[0].captures.length) {
      for (const m of session.legal) movable.add(m.from);
    }
    const hint = session.hint;

    const frag = document.createDocumentFragment();
    for (let d = 0; d < 64; d++) {
      const sq = displayToSquare(d);
      const row = Math.floor(d / 8), col = d % 8;
      const el = document.createElement("div");
      const dark = (((sq >> 3) + (sq & 7)) & 1) === 0;
      el.className = "sq" + (dark ? " is-dark" : "");
      el.dataset.sq = sq;
      if (last && (sq === last.from || sq === last.to)) el.classList.add("is-last");
      if (hint && (sq === hint.from || sq === hint.to)) el.classList.add("is-selected");
      if (sq === session.selected) el.classList.add("is-selected");
      if (session.pathSoFar.includes(sq)) el.classList.add("is-last");
      if (sq === checkSq) el.classList.add("is-check");
      if (movable.has(sq)) el.classList.add("is-movable");
      if (targets.has(sq)) {
        el.classList.add("is-target");
        if (targets.get(sq) || board[sq]) el.classList.add("is-capture");
      }
      if (col === 0) el.insertAdjacentHTML("beforeend", `<span class="coord coord--rank">${(sq >> 3) + 1}</span>`);
      if (row === 7) el.insertAdjacentHTML("beforeend", `<span class="coord coord--file">${"abcdefgh"[sq & 7]}</span>`);
      const p = board[sq];
      if (p) el.appendChild(pieceNode(session.game, p, captured.has(sq)));
      frag.appendChild(el);
    }
    boardEl.textContent = "";
    boardEl.appendChild(frag);

    if (options.animate) animateMove(options.animate.from, options.animate.to);
    renderPlayers();
    renderStatus();
    renderMoves();
    renderActions();
    renderOverlays();
  }

  function squareEl(sq) {
    return boardEl.querySelector(`.sq[data-sq="${sq}"]`);
  }

  function animateMove(from, to) {
    const pieceEl = squareEl(to)?.querySelector(".piece");
    if (!pieceEl) return;
    const size = boardEl.clientWidth / 8;
    const a = squareToDisplay(from), b = squareToDisplay(to);
    pieceEl.style.transition = "none";
    pieceEl.style.transform = `translate(${(a.col - b.col) * size}px, ${(a.row - b.row) * size}px)`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pieceEl.style.transition = "transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1)";
        pieceEl.style.transform = "";
      });
    });
  }

  // ---------------- O'yinchilar paneli ----------------
  function avatarColor(name) {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return `hsl(${h}, 42%, 46%)`;
  }

  function capturedInfo(color) {
    // Rangi `color` bo'lgan o'yinchi urib olgan donalar.
    if (session.game === "chess") {
      const victim = opposite(color);
      const counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
      let own = 0, other = 0;
      for (const p of session.state.board) {
        if (!p) continue;
        const t = p.toLowerCase();
        if (t === "k") continue;
        if (Chess.colorOf(p) === victim) counts[t]++;
        if (Chess.colorOf(p) === color) own += PIECE_VALUE[t];
        else other += PIECE_VALUE[t];
      }
      let glyphs = "";
      for (const t of ["q", "r", "b", "n", "p"]) glyphs += (GLYPH[t] + "︎").repeat(Math.max(0, START_COUNT[t] - counts[t]));
      const adv = own - other;
      return { glyphs, adv: adv > 0 ? `+${adv}` : "" };
    }
    const n = Checkers.countPieces(session.state.board);
    const men = n[color], kings = n[color.toUpperCase()];
    return { text: `${men + kings} dona${kings ? ` · ${kings} damka` : ""}` };
  }

  function playerLabel(color) {
    if (session.mode === "local") return { name: COLOR_NAMES[color], meta: "" };
    if (session.mode === "ai") {
      return color === session.myColor ? { name: "Siz", meta: "" } : { name: "Kompyuter", meta: LEVEL_NAMES[session.level], bot: true };
    }
    const p = session.players?.[color];
    if (!p) return { name: "Kutilmoqda…", meta: "", waiting: true };
    const you = color === session.myColor ? " (siz)" : "";
    return { name: p.name + you, meta: "", online: p.online };
  }

  function renderPlayer(el, color) {
    const info = playerLabel(color);
    const avatar = el.querySelector(".player__avatar");
    avatar.textContent = info.bot ? "AI" : info.waiting ? "?" : (info.name || "?").trim().charAt(0).toUpperCase();
    avatar.style.background = info.waiting ? "#9ca3af" : info.bot ? "#475569" : avatarColor(info.name);
    if (session.mode === "online" && !info.waiting) avatar.dataset.online = String(Boolean(info.online));
    else delete avatar.dataset.online;
    el.querySelector(".player__name").textContent = info.name;
    const meta = el.querySelector(".player__meta");
    meta.textContent = "";
    const cap = capturedInfo(color);
    if (info.meta) meta.append(info.meta + (cap.text || cap.glyphs || cap.adv ? " · " : ""));
    if (cap.text) meta.append(cap.text);
    else {
      if (cap.glyphs) {
        const span = document.createElement("span");
        span.className = "cap";
        span.textContent = cap.glyphs;
        meta.append(span);
      }
      if (cap.adv) {
        const span = document.createElement("span");
        span.className = "adv";
        span.textContent = cap.adv;
        meta.append(span);
      }
    }
    el.classList.toggle("is-turn", !session.result && session.status === "active" && session.state.turn === color);
    el.dataset.color = color;
  }

  function renderPlayers() {
    const bottom = bottomColor();
    renderPlayer($("playerBottom"), bottom);
    renderPlayer($("playerTop"), opposite(bottom));
    renderClocks();
  }

  // ---------------- Soat ----------------
  let clockTimer = null;
  let clockRefreshRequested = false;

  // Joriy qoldiq vaqtlar (yurayotgan tomondan o'tgan vaqt ayirilgan holda).
  function snapshotClock(s) {
    if (!s.clock) return null;
    const c = Object.assign({}, s.clock);
    if (c.running && !s.result) c[c.running] = Math.max(0, c[c.running] - (Date.now() - s.clockAt));
    return c;
  }

  // Kompyuter va bir telefondagi o'yinda soat shu yerda yuritiladi.
  function pressLocalClock(s, mover) {
    if (!s.clock) return;
    const now = Date.now();
    s.clock[mover] = Math.max(0, s.clock[mover] - (now - s.clockAt)) + (s.clock.inc || 0);
    s.clock.running = s.result ? null : opposite(mover);
    s.clockAt = now;
  }

  function clockValue(color) {
    const c = session?.clock;
    if (!c) return null;
    if (c.running === color && !session.result) return Math.max(0, c[color] - (Date.now() - session.clockAt));
    return c[color];
  }

  function formatClock(ms) {
    const total = Math.ceil(ms / 1000);
    if (ms < 10000) return `0:0${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}`;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function renderClocks() {
    for (const id of ["playerTop", "playerBottom"]) {
      const el = $(id);
      const clockEl = el.querySelector(".player__clock");
      const color = el.dataset.color;
      const value = session && color ? clockValue(color) : null;
      clockEl.hidden = value == null;
      if (value == null) continue;
      clockEl.textContent = formatClock(value);
      clockEl.classList.toggle("is-low", value < 20000 && session.clock.running === color);
      if (value <= 0 && session.clock.running === color && session.mode !== "online" && !session.result) {
        cancelAi();
        endLocal({ winner: opposite(color), reason: "timeout" });
        return;
      }
      if (value <= 0 && session.clock.running === color && session.mode === "online" && !clockRefreshRequested) {
        clockRefreshRequested = true;
        refreshRoom().finally(() => { setTimeout(() => { clockRefreshRequested = false; }, 1500); });
      }
    }
  }

  function startClockTicker() {
    stopClockTicker();
    clockTimer = setInterval(() => { if (session?.clock) renderClocks(); }, 100);
  }
  function stopClockTicker() {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  // ---------------- Holat, yurishlar, amallar ----------------
  function setStatus(text, tone) {
    const el = $("statusLine");
    el.textContent = text;
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  function resultHeadline(result) {
    if (!result) return "";
    if (!result.winner) return "Durang";
    if (session.myColor && session.mode !== "local") return result.winner === session.myColor ? "Siz yutdingiz!" : "Siz yutqazdingiz";
    return `${COLOR_NAMES[result.winner]} g'alaba qildi`;
  }

  function renderStatus() {
    const s = session;
    if (s.result) {
      const tone = !s.result.winner ? "info" : s.myColor && s.mode !== "local" ? (s.result.winner === s.myColor ? "good" : "bad") : "info";
      setStatus(`${resultHeadline(s.result)} · ${REASONS[s.result.reason] || ""}`, tone);
      return;
    }
    if (s.mode === "online" && s.status === "waiting") return setStatus("Do'stingiz qo'shilishini kutyapmiz…", "info");
    if (s.mode === "online" && !s.myColor) return setStatus("Siz tomoshabinsiz", "info");
    const turn = s.state.turn;
    const check = s.game === "chess" && Chess.inCheck(s.state);
    const mustCapture = s.game === "checkers" && s.legal.length && s.legal[0].captures.length;
    let text;
    if (s.mode === "local") text = `${COLOR_NAMES[turn]} navbati`;
    else if (turn === s.myColor) text = "Sizning navbatingiz";
    else text = s.mode === "ai" ? "Kompyuter o'ylayapti…" : "Raqib o'ylayapti…";
    if (check) text += " — Shax!";
    else if (mustCapture && (s.mode === "local" || turn === s.myColor)) text += " — urish majburiy";
    setStatus(text, check ? "bad" : s.mode !== "local" && turn === s.myColor ? "good" : "");
  }

  function renderMoves() {
    const list = $("moveList");
    list.textContent = "";
    const moves = session.moves;
    for (let i = 0; i < moves.length; i += 2) {
      const chip = document.createElement("span");
      chip.className = "move-chip" + (i + 2 >= moves.length ? " is-latest" : "");
      chip.innerHTML = `<i>${i / 2 + 1}.</i>`;
      chip.append(moves[i] + (moves[i + 1] ? " " + moves[i + 1] : ""));
      list.appendChild(chip);
    }
    list.scrollLeft = list.scrollWidth;
  }

  const ICONS = {
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
    hint: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    restart: '<path d="M4 4v6h6"/><path d="M5.5 15A7.5 7.5 0 106 8.3L4 10"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    draw: '<circle cx="12" cy="12" r="9"/><path d="M8 10h8M8 14h8"/>',
    share: '<path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15z"/>',
    rematch: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    cancel: '<path d="M6 6l12 12M18 6L6 18"/>',
  };

  function actionButton(icon, label, onClick, opts = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "action" + (opts.danger ? " action--danger" : "");
    btn.disabled = Boolean(opts.disabled);
    btn.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[icon]}</svg><span></span>`;
    btn.querySelector("span").textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function renderActions() {
    const bar = $("actionBar");
    bar.textContent = "";
    const s = session;
    const add = (...args) => bar.appendChild(actionButton(...args));
    if (s.mode === "online") {
      if (!s.myColor) {
        add("menu", "Menyu", goHome);
      } else if (s.status === "waiting") {
        add("share", "Taklif qilish", shareInvite);
        add("cancel", "Bekor qilish", () => confirmAction("O'yinni bekor qilasizmi?", "Taklif havolasi ishlamay qoladi.", "Bekor qilish", () => sendAction("resign")), { danger: true });
      } else if (s.result) {
        add("rematch", s.rematch?.[s.myColor] ? "Kutilmoqda…" : "Qayta o'ynash", requestRematch, { disabled: s.rematch?.[s.myColor] });
        add("menu", "Menyu", goHome);
      } else {
        add("draw", s.drawOffer === s.myColor ? "Taklif yuborildi" : "Durang", offerDraw, { disabled: s.drawOffer === s.myColor });
        add("flag", "Taslim", () => confirmAction("Taslim bo'lasizmi?", "O'yin raqib foydasiga yakunlanadi.", "Taslim bo'lish", () => sendAction("resign")), { danger: true });
      }
      return;
    }
    add("undo", "Orqaga", undo, { disabled: !s.history.length });
    if (s.mode === "ai") add("hint", "Maslahat", showHint, { disabled: !canMove() });
    add("restart", "Yangi o'yin", () => {
      if (s.moves.length && !s.result) confirmAction("Yangi o'yin boshlansinmi?", "Hozirgi o'yin yo'qoladi.", "Boshlash", restartLocal);
      else restartLocal();
    });
    if (s.mode === "ai") {
      add("flag", "Taslim", () => confirmAction("Taslim bo'lasizmi?", "O'yin kompyuter foydasiga yakunlanadi.", "Taslim bo'lish", () => {
        endLocal({ over: true, winner: opposite(s.myColor), reason: "resign" });
      }), { danger: true, disabled: Boolean(s.result) });
    }
  }

  function renderOverlays() {
    const s = session;
    const waiting = s.mode === "online" && s.status === "waiting" && Boolean(s.myColor);
    $("inviteOverlay").hidden = !waiting;
    if (waiting) $("inviteCode").textContent = s.room.toUpperCase();
    const offer = s.mode === "online" && !s.result && s.drawOffer && s.myColor && s.drawOffer !== s.myColor;
    $("drawOffer").hidden = !offer;
    const tc = parseTimeControl(s.timeControl) ? ` · ${timeControlLabel(s.timeControl)}` : "";
    const sub = s.mode === "online" ? (s.myColor ? `Online${tc}` : "Tomosha")
      : s.mode === "ai" ? `Kompyuter · ${LEVEL_NAMES[s.level]}${tc}` : `Bir telefonda${tc}`;
    $("gameSubtitle").textContent = sub;
  }

  // ---------------- Yurish qilish ----------------
  function clearSelection(target = session) {
    target.selected = -1;
    target.candidates = [];
    target.pathSoFar = [];
  }

  function selectSquare(sq) {
    session.selected = sq;
    session.candidates = session.legal.filter((m) => m.from === sq);
    session.pathSoFar = [];
    session.hint = null;
  }

  function onSquare(sq) {
    if (!session || !canMove()) return;
    $("promotionOverlay").hidden = true;
    const s = session;
    if (s.selected >= 0) {
      const targets = currentTargets();
      if (targets.has(sq)) return chooseTarget(sq);
      if (s.pathSoFar.length) return; // urish zanjirini oxirigacha yetkazish kerak
    }
    const p = s.state.board[sq];
    if (p && s.adapter.colorOf(p) === s.state.turn && sq !== s.selected) {
      if (s.legal.some((m) => m.from === sq)) {
        selectSquare(sq);
        haptic("light");
      } else {
        clearSelection();
        if (s.game === "checkers" && s.legal.length && s.legal[0].captures.length) {
          toast("Urish majburiy — belgilangan donalardan birini tanlang");
          haptic("warning");
        }
      }
      render();
      return;
    }
    clearSelection();
    render();
  }

  function chooseTarget(sq) {
    const s = session;
    if (s.game === "chess") {
      const matches = s.candidates.filter((m) => m.to === sq);
      if (matches[0].promotion) return askPromotion(matches);
      return commitMove(matches[0]);
    }
    const next = s.candidates.filter((m) => m.path[s.pathSoFar.length] === sq);
    s.pathSoFar.push(sq);
    s.candidates = next;
    if (next.length === 1 && next[0].path.length === s.pathSoFar.length) return commitMove(next[0]);
    haptic("light");
    render();
  }

  // Sudrab tashlash: shashkada to'g'ridan-to'g'ri yakuniy katakka ham tashlash mumkin.
  function dropOn(sq) {
    const s = session;
    if (currentTargets().has(sq)) return chooseTarget(sq);
    if (s.game === "checkers") {
      const matches = s.candidates.filter((m) => Checkers.destination(m) === sq);
      if (matches.length === 1) return commitMove(matches[0]);
    }
    render();
  }

  function askPromotion(matches) {
    const box = $("promotionChoices");
    box.textContent = "";
    for (const m of matches) {
      const btn = document.createElement("button");
      btn.type = "button";
      const p = session.state.turn === "w" ? m.promotion.toUpperCase() : m.promotion;
      btn.appendChild(pieceNode("chess", p));
      btn.addEventListener("click", () => {
        $("promotionOverlay").hidden = true;
        commitMove(m);
      });
      box.appendChild(btn);
    }
    $("promotionOverlay").hidden = false;
  }

  function commitMove(move, opts = {}) {
    const s = session;
    const notation = s.adapter.notation(s.state, move);
    const mover = s.state.turn;
    s.history.push({ state: s.state, moves: s.moves.slice(), lastMove: s.lastMove, clock: snapshotClock(s) });
    if (s.history.length > 300) s.history.shift();
    s.state = s.adapter.apply(s.state, move);
    s.moves.push(notation);
    s.lastMove = s.adapter.last(move);
    s.hint = null;
    clearSelection();
    const status = s.adapter.status(s.state);
    s.legal = status.over ? [] : s.adapter.legal(s.state);
    playMoveSound(move, notation);
    if (s.mode !== "online") {
      if (status.over) s.result = { winner: status.winner, reason: status.reason };
      pressLocalClock(s, mover);
    }
    render({ animate: { from: move.from, to: s.adapter.dest(move) } });
    if (s.mode === "online") {
      if (!opts.fromServer) sendMove(move);
      return;
    }
    saveLocal();
    if (s.result) return showResultSoon();
    if (s.mode === "ai" && s.state.turn !== s.myColor) scheduleAi();
  }

  function playMoveSound(move, notation) {
    if (/[+#]$/.test(notation)) sounds.check();
    else if (session.adapter.isCapture(move)) sounds.capture();
    else sounds.move();
    haptic(session.adapter.isCapture(move) ? "medium" : "light");
  }

  function undo() {
    const s = session;
    if (!s || s.mode === "online" || !s.history.length) return;
    cancelAi();
    let snap = s.history.pop();
    // Kompyuterga qarshi: o'z navbatimga qaytguncha orqaga.
    while (s.mode === "ai" && snap.state.turn !== s.myColor && s.history.length) snap = s.history.pop();
    s.state = snap.state;
    s.moves = snap.moves;
    s.lastMove = snap.lastMove;
    if (snap.clock) {
      s.clock = Object.assign({}, snap.clock, { running: snap.state.turn });
      s.clockAt = Date.now();
    }
    s.result = null;
    s.resultShown = false;
    s.legal = s.adapter.legal(s.state);
    clearSelection();
    closeSheet("resultSheet");
    render();
    saveLocal();
    if (s.mode === "ai" && s.state.turn !== s.myColor) scheduleAi();
  }

  function restartLocal() {
    const s = session;
    closeSheet("resultSheet");
    startLocal(s.game, s.mode, { level: s.level, color: s.myColor, timeControl: s.timeControl });
  }

  function endLocal(status) {
    if (session.clock?.running) {
      session.clock = snapshotClock(session);
      session.clock.running = null;
    }
    session.result = { winner: status.winner, reason: status.reason };
    session.legal = [];
    clearSelection();
    render();
    saveLocal();
    showResultSoon();
  }

  // ---------------- Kompyuter ----------------
  let worker = null;
  let aiRequest = 0;

  function getWorker() {
    if (worker !== null) return worker;
    try {
      worker = new Worker(`/shaxmat/ai-worker.js?v=${ASSET_VERSION}`);
    } catch (_) {
      worker = false;
    }
    return worker;
  }

  // Har doim yurish qaytaradi: hisoblash xato bersa — tasodifiy qonuniy yurish.
  function chooseHere(game, state, level, timeMs) {
    const engine = game === "chess" ? Chess : Checkers;
    try {
      const move = engine.chooseMove(state, level, timeMs ? { timeMs } : {});
      if (move) return move;
    } catch (err) {
      console.error("games ai:", err);
    }
    const legal = engine.legalMoves(state);
    return legal.length ? legal[Math.floor(Math.random() * legal.length)] : null;
  }

  // Alohida oqim (Web Worker) ishlamasa, xato bersa yoki javob kechiksa —
  // yurish shu sahifaning o'zida hisoblanadi, kompyuter hech qachon qotib qolmaydi.
  function computeMove(game, state, level, timeMs) {
    const id = ++aiRequest;
    const w = getWorker();
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = (move) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (w) {
          w.removeEventListener("message", onMessage);
          w.removeEventListener("error", onError);
        }
        resolve(move);
      };
      const runHere = () => setTimeout(() => finish(chooseHere(game, state, level, timeMs)), 30);
      function onMessage(e) {
        if (e.data?.id !== id) return;
        if (e.data.move) finish(e.data.move);
        else runHere();
      }
      function onError(e) {
        e?.preventDefault?.();
        worker = false; // keyingi safar to'g'ridan-to'g'ri shu yerda
        runHere();
      }
      if (!w) return runHere();
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);
      timer = setTimeout(() => {
        worker = false;
        try { w.terminate(); } catch (_) {}
        runHere();
      }, (timeMs || 1800) + 1200);
      try {
        w.postMessage({ id, game, state, level, timeMs });
      } catch (_) {
        runHere();
      }
    }).then((move) => (id === aiRequest ? move : null));
  }

  function cancelAi() {
    aiRequest++;
    if (session) session.aiThinking = false;
  }

  async function scheduleAi() {
    const s = session;
    s.aiThinking = true;
    render();
    const started = Date.now();
    const raw = await computeMove(s.game, s.state, s.level);
    if (session !== s || !s.aiThinking) return;
    await sleep(Math.max(0, 450 - (Date.now() - started)));
    if (session !== s || !s.aiThinking) return;
    s.aiThinking = false;
    const pick = raw || chooseHere(s.game, s.state, 1, 300);
    const move = pick && s.legal.find((m) => s.adapter.same(m, pick));
    if (move) commitMove(move);
    else render();
  }

  async function showHint() {
    const s = session;
    if (!canMove()) return;
    toast("Eng yaxshi yurish hisoblanmoqda…", 1200);
    const raw = await computeMove(s.game, s.state, 3, 900);
    if (session !== s || !raw) return;
    s.hint = { from: raw.from, to: s.game === "chess" ? raw.to : Checkers.destination(raw) };
    render();
    setTimeout(() => {
      if (session === s && s.hint) {
        s.hint = null;
        render();
      }
    }, 2500);
  }

  // ---------------- Natija ----------------
  function showResultSoon() {
    const s = session;
    if (!s.result || s.resultShown) return;
    s.resultShown = true;
    setTimeout(() => {
      if (session !== s || !s.result) return;
      const r = s.result;
      const mine = s.myColor && s.mode !== "local";
      let badge = "🤝";
      if (r.winner) badge = mine ? (r.winner === s.myColor ? "🏆" : "😔") : "🏆";
      if (r.reason === "cancelled") badge = "✖️";
      const won = r.winner && (!mine || r.winner === s.myColor);
      $("resultBadge").textContent = badge;
      $("resultBadge").dataset.tone = r.reason === "cancelled" ? "" : won ? "win" : r.winner ? "lose" : "";
      if (mine && r.reason !== "cancelled") recordResult(!r.winner ? "draws" : r.winner === s.myColor ? "wins" : "losses");
      $("resultTitle").textContent = r.reason === "cancelled" ? "O'yin bekor qilindi" : resultHeadline(r);
      $("resultReason").textContent = r.reason === "cancelled" ? "" : REASONS[r.reason] || "";
      const canRematch = s.mode !== "online" || (s.myColor && r.reason !== "cancelled");
      $("resultAgain").hidden = !canRematch;
      $("resultAgain").textContent = s.mode === "online" ? "Qayta o'ynash (ranglar almashadi)" : "Qayta o'ynash";
      openSheet("resultSheet");
      if (won && r.reason !== "cancelled") launchConfetti();
      if (mine && r.winner) (r.winner === s.myColor ? sounds.win : sounds.lose)();
      haptic(mine && r.winner && r.winner !== s.myColor ? "error" : "success");
    }, 650);
  }

  // ---------------- Online ----------------
  function apiHeaders(extra) {
    const h = Object.assign({ "Content-Type": "application/json" }, extra || {});
    if (tg?.initData) h["X-TG-Init-Data"] = tg.initData;
    return h;
  }

  async function apiPost(body) {
    const res = await fetch(API, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body), credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data.ok, status: res.status, data };
  }

  async function createOnline(game, options) {
    const btn = $("setupStart");
    btn.disabled = true;
    try {
      const { ok, data } = await apiPost({ action: "create", game, timeControl: options.timeControl, color: options.color, name: myName() });
      if (!ok) return toast(data.error || "O'yin yaratib bo'lmadi");
      rememberRoom({ id: data.room.id, game, color: data.color, token: data.token, status: data.room.status, opponent: "" });
      closeSheet("setupSheet");
      openOnline(data.room, data.token);
      setTimeout(shareInvite, 350);
    } catch (err) {
      console.error("games:", err);
      toast("Internet bilan muammo. Qayta urinib ko'ring.");
    } finally {
      btn.disabled = false;
    }
  }

  async function joinRoom(roomId) {
    const id = String(roomId || "").toLowerCase();
    if (!/^[a-z0-9]{4,16}$/.test(id)) return;
    const saved = savedRoom(id);
    setStatus("Ulanmoqda…", "info");
    try {
      const { ok, data } = await apiPost({ action: "join", room: id, token: saved?.token || "", name: myName() });
      if (ok) {
        rememberRoom({ id, game: data.room.game, color: data.color, token: data.token, status: data.room.status });
        openOnline(data.room, data.token);
        if (!saved) toast("O'yinga qo'shildingiz! Omad 🍀");
        return;
      }
      if (data.code === "FULL" && data.room) {
        toast("Bu o'yinda joy yo'q — tomosha rejimi");
        openOnline(data.room, "");
        return;
      }
      if (data.code === "NOT_FOUND") forgetRoom(id);
      toast(data.error || "O'yinga ulanib bo'lmadi");
      goHome();
    } catch (err) {
      console.error("games:", err);
      toast("Internet bilan muammo. Qayta urinib ko'ring.");
      goHome();
    }
  }

  function forgetRoom(id) {
    writeJson(STORE_ROOMS, readJson(STORE_ROOMS, []).filter((r) => r.id !== id));
  }

  function openOnline(room, token) {
    const s = newSession(room.game, "online", { room: room.id, token, myColor: room.you || null, version: 0 });
    s.timeControl = room.timeControl;
    applyRoom(s, room, { initial: true });
    enterSession(s);
  }

  function applyRoom(s, room, { initial } = {}) {
    if (!room || room.version < s.version) return;
    const prevMoves = s.moves.length;
    const hadResult = Boolean(s.result);
    const wasWaiting = s.status === "waiting";
    const restarted = !initial && hadResult && !room.result && room.moves.length === 0;
    s.version = room.version;
    s.status = room.status;
    s.players = room.players;
    s.myColor = room.you || (s.token ? s.myColor : null);
    s.timeControl = room.timeControl;
    s.clock = room.clock;
    s.clockAt = Date.now();
    s.drawOffer = room.drawOffer;
    s.rematch = room.rematch;
    const changedPosition = room.moves.length !== prevMoves || restarted || initial;
    if (changedPosition) {
      s.state = room.state;
      s.moves = room.moves.slice();
      s.lastMove = room.lastMove;
      s.legal = room.result ? [] : s.adapter.legal(s.state);
      clearSelection(s);
    }
    s.result = room.result;
    if (restarted) {
      s.resultShown = false;
      s.flipped = false;
      closeSheet("resultSheet");
      toast("Yangi o'yin! Ranglar almashdi", 2600);
    }
    if (initial) {
      s.resultShown = Boolean(room.result);
      return;
    }
    if (session !== s) return;
    const opponentMoved = room.moves.length > prevMoves && room.lastMove;
    if (wasWaiting && room.status === "active") {
      sounds.notify();
      haptic("success");
      toast("Do'stingiz qo'shildi — o'yin boshlandi!", 2600);
    }
    if (opponentMoved) {
      const notation = room.moves[room.moves.length - 1];
      if (/[+#]$/.test(notation)) sounds.check();
      else if (room.lastMove.captures?.length || notation.includes("x")) sounds.capture();
      else sounds.move();
      haptic("light");
    }
    render(opponentMoved ? { animate: { from: room.lastMove.from, to: room.lastMove.to } } : {});
    if (room.result && !hadResult) showResultSoon();
    const opp = s.myColor ? room.players[opposite(s.myColor)] : null;
    rememberRoom({
      id: room.id,
      status: room.status,
      opponent: opp?.name || "",
      myTurn: room.status === "active" && room.turn === s.myColor,
      color: s.myColor || savedRoom(room.id)?.color || "w",
    });
  }

  async function sendMove(move) {
    const s = session;
    const ply = s.moves.length - 1;
    try {
      const { ok, data } = await apiPost({ action: "move", room: s.room, token: s.token, move: s.adapter.payload(move), ply });
      if (session !== s) return;
      if (ok) {
        applyRoom(s, data.room);
        return;
      }
      toast(data.error || "Yurish qabul qilinmadi");
      haptic("error");
    } catch (_) {
      toast("Internet bilan muammo — yurish yuborilmadi");
    }
    // Server bilan qayta sinxronlash.
    if (session === s) {
      s.version = 0;
      await refreshRoom(true);
    }
  }

  async function sendAction(action) {
    const s = session;
    closeSheet("confirmSheet");
    try {
      const { ok, data } = await apiPost({ action, room: s.room, token: s.token });
      if (session !== s) return;
      if (ok) applyRoom(s, data.room);
      else toast(data.error || "Amal bajarilmadi");
    } catch (_) {
      toast("Internet bilan muammo. Qayta urinib ko'ring.");
    }
  }

  function offerDraw() {
    sendAction("offer-draw");
    toast("Durang taklifi yuborildi");
  }

  function requestRematch() {
    closeSheet("resultSheet");
    sendAction("rematch");
    toast("Raqib roziligini kutyapmiz…");
  }

  async function refreshRoom(force) {
    const s = session;
    if (!s || s.mode !== "online") return;
    try {
      const res = await fetch(`${API}?room=${encodeURIComponent(s.room)}&since=0`, { headers: apiHeaders(s.token ? { "X-Game-Token": s.token } : {}) });
      const data = await res.json();
      if (session === s && data.ok) {
        if (force) s.version = 0;
        applyRoom(s, data.room);
      }
    } catch (_) {}
  }

  // Uzun so'rov (long polling): server o'zgarish bo'lguncha ~7 soniya kutadi.
  function startPolling() {
    stopPolling();
    const s = session;
    const controller = new AbortController();
    s.poll = controller;
    (async () => {
      let failures = 0;
      while (session === s && !controller.signal.aborted) {
        if (document.hidden) {
          await new Promise((r) => document.addEventListener("visibilitychange", r, { once: true }));
          continue;
        }
        try {
          const headers = apiHeaders(s.token ? { "X-Game-Token": s.token } : {});
          const res = await fetch(`${API}?room=${encodeURIComponent(s.room)}&since=${s.version}&wait=1`, { headers, signal: controller.signal });
          const data = await res.json();
          if (session !== s) return;
          if (res.status === 404) {
            toast("O'yin topilmadi yoki muddati tugagan");
            forgetRoom(s.room);
            return;
          }
          if (data.ok) {
            failures = 0;
            if (data.changed || data.room.version > s.version) applyRoom(s, data.room);
            else if (data.room) {
              s.players = data.room.players;
              renderPlayers();
            }
          } else {
            await sleep(res.status === 429 ? 5000 : 2000);
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          failures++;
          await sleep(Math.min(8000, 1000 * failures));
        }
      }
    })();
  }

  function stopPolling() {
    if (session?.poll) {
      session.poll.abort();
      session.poll = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && session?.mode === "online") startPolling();
  });

  function inviteLink() {
    return `https://t.me/${BOT_USERNAME}?startapp=shaxmat_${session.room}`;
  }

  function inviteText() {
    const title = session.game === "chess" ? "shaxmat" : "shashka";
    return `♟ Keling, ${title} o'ynaymiz! Havolani bosing — o'yin darhol boshlanadi 👇`;
  }

  function shareInvite() {
    if (!session || session.mode !== "online") return;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink())}&text=${encodeURIComponent(inviteText())}`;
    if (isInsideTelegram && tg.openTelegramLink) {
      try {
        tg.openTelegramLink(url);
        return;
      } catch (_) {}
    }
    if (navigator.share) {
      navigator.share({ text: inviteText(), url: inviteLink() }).catch(() => {});
      return;
    }
    window.open(url, "_blank", "noopener");
  }

  async function copyInvite() {
    const link = inviteLink();
    try {
      await navigator.clipboard.writeText(link);
      toast("Havola nusxalandi");
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      try { document.execCommand("copy"); toast("Havola nusxalandi"); } catch (__) { toast(link, 5000); }
      input.remove();
    }
    haptic("light");
  }

  // ---------------- Navigatsiya ----------------
  function goHome() {
    leaveSession();
    setRoomInUrl(null);
    closeSheet("resultSheet");
    $("promotionOverlay").hidden = true;
    renderResumeList();
    renderHero();
    showView("home");
  }

  function goBack() {
    const sheets = openSheets();
    if (sheets.length) {
      sheets.forEach(closeSheet);
      return;
    }
    if (!$("gameView").hidden) {
      goHome();
      return;
    }
    location.href = "/";
  }

  // ---------------- Sudrab yurish ----------------
  function squareFromPoint(x, y) {
    const rect = boardEl.getBoundingClientRect();
    if (x < rect.left || y < rect.top || x >= rect.right || y >= rect.bottom) return -1;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    return displayToSquare(row * 8 + col);
  }

  function cancelDrag() {
    if (!drag) return;
    if (drag.el) {
      drag.el.classList.remove("is-dragging");
      drag.el.style.transform = "";
    }
    drag = null;
  }

  boardEl.addEventListener("pointerdown", (e) => {
    const sqEl = e.target.closest(".sq");
    if (!sqEl || !session) return;
    const sq = Number(sqEl.dataset.sq);
    const reselect = session.selected === sq && !session.pathSoFar.length;
    if (!reselect) onSquare(sq);
    if (session && session.selected === sq && !session.pathSoFar.length && canMove()) {
      drag = { sq, x: e.clientX, y: e.clientY, el: squareEl(sq)?.querySelector(".piece"), active: false, reselect, hover: null };
      try { boardEl.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  boardEl.addEventListener("pointermove", (e) => {
    if (!drag || !drag.el) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 6) return;
    drag.active = true;
    drag.el.classList.add("is-dragging");
    drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`;
    const over = squareFromPoint(e.clientX, e.clientY);
    if (drag.hover !== over) {
      squareEl(drag.hover)?.classList.remove("is-hover");
      drag.hover = over;
      if (over >= 0) squareEl(over)?.classList.add("is-hover");
    }
  });

  function endPointer(e) {
    if (!drag) return;
    const d = drag;
    squareEl(d.hover)?.classList.remove("is-hover");
    if (d.active) {
      const target = squareFromPoint(e.clientX, e.clientY);
      cancelDrag();
      if (target >= 0 && target !== d.sq) dropOn(target);
      else render();
      return;
    }
    cancelDrag();
    // Tanlangan donani qayta bosish — tanlovni bekor qiladi.
    if (d.reselect) {
      clearSelection();
      render();
    }
  }
  boardEl.addEventListener("pointerup", endPointer);
  boardEl.addEventListener("pointercancel", () => { cancelDrag(); if (session) render(); });

  // ---------------- Hodisalar ----------------
  function bindUi() {
    document.querySelectorAll(".game-card").forEach((el) => el.addEventListener("click", () => {
      selectGame(el.dataset.game);
      haptic("light");
    }));
    document.querySelectorAll(".mode").forEach((el) => el.addEventListener("click", () => {
      const mode = el.dataset.mode;
      openSetup(mode);
    }));
    document.querySelectorAll(".chips").forEach((group) => {
      group.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        group.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", c === chip));
        setupOptions[group.dataset.option] = chip.dataset.value;
      });
    });
    $("setupStart").addEventListener("click", () => {
      if (setupMode === "online") return createOnline(selectedGame, gameOptions(selectedGame));
      closeSheet("setupSheet");
      startLocal(selectedGame, setupMode, gameOptions(selectedGame));
    });
    document.querySelectorAll("[data-close-sheet]").forEach((el) => el.addEventListener("click", () => closeSheet(el.closest(".sheet").id)));
    $("homeBack").addEventListener("click", goBack);
    $("gameBack").addEventListener("click", goBack);
    $("themeButton").addEventListener("click", nextBoardTheme);
    $("flipButton").addEventListener("click", () => {
      if (!session) return;
      session.flipped = !session.flipped;
      render();
    });
    $("soundToggle").addEventListener("click", () => {
      soundOn = !soundOn;
      writeJson(STORE_SOUND, soundOn);
      syncSoundButton();
      if (soundOn) sounds.move();
    });
    $("inviteShare").addEventListener("click", shareInvite);
    $("inviteCopy").addEventListener("click", copyInvite);
    $("drawAccept").addEventListener("click", () => sendAction("offer-draw"));
    $("drawDecline").addEventListener("click", () => sendAction("decline-draw"));
    $("confirmNo").addEventListener("click", () => closeSheet("confirmSheet"));
    $("confirmYes").addEventListener("click", () => {
      closeSheet("confirmSheet");
      const fn = confirmHandler;
      confirmHandler = null;
      if (fn) fn();
    });
    $("resultAgain").addEventListener("click", () => {
      if (!session) return;
      if (session.mode === "online") requestRematch();
      else restartLocal();
    });
    $("resultMenu").addEventListener("click", goHome);
    $("promotionOverlay").addEventListener("click", (e) => {
      if (e.target === $("promotionOverlay")) {
        $("promotionOverlay").hidden = true;
        clearSelection();
        render();
      }
    });
  }

  function roomFromEntry() {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("room");
    if (fromQuery) return fromQuery;
    // Telegram start_param sahifa yangilansa ham saqlanib qoladi — faqat bir marta ishlatamiz.
    const start = String(tg?.initDataUnsafe?.start_param || "");
    const m = /^shaxmat_([a-z0-9]{4,16})$/i.exec(start);
    if (!m) return "";
    const key = "shaxmat_redirected_" + m[1].toLowerCase();
    try {
      if (sessionStorage.getItem(key)) return "";
      sessionStorage.setItem(key, "1");
    } catch (_) {}
    return m[1];
  }

  function init() {
    setupTelegram();
    syncSoundButton();
    applyBoardTheme(readJson(STORE_BOARD, "wood"));
    renderHero();
    bindUi();
    const params = new URLSearchParams(location.search);
    if (params.get("game") === "checkers") selectGame("checkers");
    renderResumeList();
    const room = roomFromEntry();
    if (room) {
      showView("game");
      joinRoom(room);
    } else {
      showView("home");
    }
  }

  init();
})();
