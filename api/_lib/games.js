// Shaxmat va shashka online xonalari: do'stga havola orqali o'ynash.
// Holat Redis'da (REDIS_URL / KV_URL) saqlanadi, bo'lmasa — xotirada (lokal
// test uchun). Har bir yurish serverda dvigatel bilan tekshiriladi; o'yinchi
// o'z o'rnini yaratish/qo'shilishda olingan maxfiy token orqali tasdiqlaydi.
const crypto = require("node:crypto");
const ChessEngine = require("../../webapp/shaxmat/chess-engine.js");
const CheckersEngine = require("../../webapp/shaxmat/checkers-engine.js");
const {
  setCorsHeaders,
  isOriginAllowed,
  applyRateLimit,
  getVerifiedInitDataUser,
  readLimitedJsonBody,
} = require("./auth");

const ROOM_TTL_SEC = 3 * 24 * 60 * 60;
const LONG_POLL_MS = 7000;
const POLL_STEP_MS = 450;
const ONLINE_WINDOW_MS = 20000;
const ROOM_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
// Bullet, Blits, Rapid va Klassik: "daqiqa+soniya" (har yurishdan keyin qo'shiladi).
const TIME_CONTROLS = { none: { base: 0, inc: 0 } };
for (const tc of ["1+0", "2+1", "3+0", "3+2", "5+0", "10+0", "10+5", "15+10", "30+0", "30+20"]) {
  const [min, inc] = tc.split("+").map(Number);
  TIME_CONTROLS[tc] = { base: min * 60, inc };
}

const ENGINES = {
  chess: {
    create: () => ChessEngine.createInitialState(),
    status: (s) => ChessEngine.getStatus(s),
    play(state, input) {
      const move = ChessEngine.findMove(state, input || {});
      if (!move) return null;
      return {
        state: ChessEngine.applyMove(state, move),
        notation: ChessEngine.moveToSan(state, move),
        last: { from: move.from, to: move.to },
      };
    },
  },
  checkers: {
    create: () => CheckersEngine.createInitialState(),
    status: (s) => CheckersEngine.getStatus(s),
    play(state, input) {
      const move = CheckersEngine.findMove(state, input || {});
      if (!move) return null;
      return {
        state: CheckersEngine.applyMove(state, move),
        notation: CheckersEngine.moveToText(move),
        last: { from: move.from, to: CheckersEngine.destination(move), path: move.path, captures: move.captures },
      };
    },
  },
};

// ---------------- Saqlash ----------------
const memoryRooms = new Map();
let redisPromise = null;

async function getRedis() {
  const url = process.env.REDIS_URL || process.env.KV_URL || "";
  if (!url) return null;
  if (redisPromise) {
    try {
      const c = await redisPromise;
      if (c?.isOpen) return c;
    } catch (_) {}
    redisPromise = null;
  }
  redisPromise = (async () => {
    try {
      const { createClient } = require("redis");
      const client = createClient({ url });
      client.on("error", (err) => console.warn("redis (games) error:", err.message));
      await client.connect();
      return client;
    } catch (_) {
      return null;
    }
  })();
  return redisPromise;
}

const roomKey = (id) => `game:room:${id}`;

async function loadRoom(id) {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(roomKey(id));
    return raw ? JSON.parse(raw) : null;
  }
  const entry = memoryRooms.get(id);
  if (!entry || entry.expires < Date.now()) return null;
  return JSON.parse(entry.json);
}

async function insertRoom(room) {
  const redis = await getRedis();
  const json = JSON.stringify(room);
  if (redis) return (await redis.set(roomKey(room.id), json, { NX: true, EX: ROOM_TTL_SEC })) === "OK";
  if (memoryRooms.has(room.id)) return false;
  memoryRooms.set(room.id, { json, expires: Date.now() + ROOM_TTL_SEC * 1000 });
  return true;
}

// O'qish → o'zgartirish → yozish. Redis'da WATCH bilan, ikki o'yinchi bir
// vaqtda yozsa ham biri boshqasini o'chirib yubormaydi.
async function mutateRoom(id, mutator) {
  const redis = await getRedis();
  if (!redis) {
    const room = await loadRoom(id);
    if (!room) return { room: null };
    const result = mutator(room);
    if (result && result.error) return result;
    room.version += 1;
    room.updatedAt = Date.now();
    memoryRooms.set(id, { json: JSON.stringify(room), expires: Date.now() + ROOM_TTL_SEC * 1000 });
    return { room, result };
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const outcome = await redis.executeIsolated(async (iso) => {
      await iso.watch(roomKey(id));
      const raw = await iso.get(roomKey(id));
      if (!raw) {
        await iso.unwatch();
        return { room: null };
      }
      const room = JSON.parse(raw);
      const result = mutator(room);
      if (result && result.error) {
        await iso.unwatch();
        return result;
      }
      room.version += 1;
      room.updatedAt = Date.now();
      const exec = await iso.multi().set(roomKey(id), JSON.stringify(room), { EX: ROOM_TTL_SEC }).exec();
      return exec === null ? { retry: true } : { room, result };
    });
    if (!outcome.retry) return outcome;
  }
  return { error: "BUSY", status: 409, message: "Bir vaqtda o'zgarish bo'ldi, qayta urinib ko'ring." };
}

// ---------------- Xona mantiqi ----------------
function randomId(length = 8) {
  const bytes = crypto.randomBytes(length);
  let id = "";
  for (let i = 0; i < length; i++) id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length];
  return id;
}

const newToken = () => crypto.randomBytes(18).toString("base64url");
const otherColor = (c) => (c === "w" ? "b" : "w");

function cleanName(value) {
  return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 32);
}

function playerName(request, body) {
  const user = getVerifiedInitDataUser(request);
  if (user) {
    const full = cleanName([user.first_name, user.last_name].filter(Boolean).join(" "));
    if (full) return full;
    if (user.username) return cleanName(user.username);
  }
  return cleanName(body?.name) || "Mehmon";
}

function colorForToken(room, token) {
  if (!token) return null;
  for (const c of ["w", "b"]) {
    const p = room.players[c];
    if (p && p.token && safeEqual(p.token, token)) return c;
  }
  return null;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function freshGame(room) {
  const tc = TIME_CONTROLS[room.timeControl] || TIME_CONTROLS.none;
  room.state = ENGINES[room.game].create();
  room.moves = [];
  room.lastMove = null;
  room.result = null;
  room.drawOffer = null;
  room.rematch = { w: false, b: false };
  room.clock = tc.base ? { w: tc.base * 1000, b: tc.base * 1000, turnStartedAt: Date.now() } : null;
  room.status = room.players.w && room.players.b ? "active" : "waiting";
}

function turnOf(room) {
  return room.state.turn;
}

// Soat ikkinchi o'yinchi qo'shilgan zahoti oqlar uchun yura boshlaydi.
function clockRunning(room) {
  return Boolean(room.clock) && room.status === "active";
}

// Navbatdagi tomonning vaqti tugaganini tekshiradi; tugagan bo'lsa o'yin yakunlanadi.
function settleClock(room, now = Date.now()) {
  if (!clockRunning(room)) return false;
  const side = turnOf(room);
  const left = room.clock[side] - (now - room.clock.turnStartedAt);
  if (left > 0) return false;
  room.clock[side] = 0;
  finish(room, otherColor(side), "timeout");
  return true;
}

function finish(room, winner, reason) {
  room.status = "ended";
  room.result = { winner, reason };
  room.drawOffer = null;
  room.rematch = { w: false, b: false };
}

function publicRoom(room, you) {
  const now = Date.now();
  const player = (c) => {
    const p = room.players[c];
    if (!p) return null;
    return { name: p.name, online: now - (p.lastSeen || 0) < ONLINE_WINDOW_MS };
  };
  let clock = null;
  if (room.clock) {
    clock = { w: room.clock.w, b: room.clock.b, running: clockRunning(room) ? turnOf(room) : null };
    if (clock.running) clock[clock.running] = Math.max(0, clock[clock.running] - (now - room.clock.turnStartedAt));
  }
  return {
    id: room.id,
    game: room.game,
    version: room.version,
    status: room.status,
    timeControl: room.timeControl,
    players: { w: player("w"), b: player("b") },
    state: room.state,
    turn: turnOf(room),
    moves: room.moves,
    lastMove: room.lastMove,
    result: room.result,
    drawOffer: room.drawOffer,
    rematch: room.rematch,
    clock,
    you: you || null,
    serverNow: now,
  };
}

// ---------------- Amallar ----------------
async function createRoom(request, body) {
  const game = body?.game === "checkers" ? "checkers" : body?.game === "chess" ? "chess" : null;
  if (!game) return { status: 400, body: { ok: false, error: "O'yin turi noto'g'ri." } };
  const timeControl = TIME_CONTROLS[body?.timeControl] ? body.timeControl : "none";
  let color = body?.color === "w" || body?.color === "b" ? body.color : crypto.randomInt(2) ? "w" : "b";
  const token = newToken();
  const now = Date.now();
  for (let attempt = 0; attempt < 5; attempt++) {
    const room = {
      id: randomId(),
      game,
      timeControl,
      createdAt: now,
      updatedAt: now,
      version: 1,
      players: { w: null, b: null },
    };
    room.players[color] = { name: playerName(request, body), token, joinedAt: now, lastSeen: now };
    freshGame(room);
    if (await insertRoom(room)) {
      return { status: 200, body: { ok: true, token, color, room: publicRoom(room, color) } };
    }
  }
  return { status: 500, body: { ok: false, error: "Xona yaratib bo'lmadi." } };
}

async function joinRoom(request, body) {
  const id = String(body?.room || "").toLowerCase();
  const token = String(body?.token || "");
  const name = playerName(request, body);
  let issued = null;
  const outcome = await mutateRoom(id, (room) => {
    const existing = colorForToken(room, token);
    if (existing) {
      room.players[existing].lastSeen = Date.now();
      issued = { color: existing, token };
      return null;
    }
    const free = ["w", "b"].find((c) => !room.players[c]);
    if (!free) return { error: "FULL", status: 409, message: "Bu o'yinda allaqachon ikki o'yinchi bor." };
    const t = newToken();
    room.players[free] = { name, token: t, joinedAt: Date.now(), lastSeen: Date.now() };
    room.status = "active";
    if (room.clock) room.clock.turnStartedAt = Date.now();
    issued = { color: free, token: t };
    return null;
  });
  if (!outcome.room && !outcome.error) return { status: 404, body: { ok: false, code: "NOT_FOUND", error: "O'yin topilmadi yoki muddati tugagan." } };
  if (outcome.error) {
    // To'lgan xonani tomoshabin sifatida ko'rsatamiz.
    const room = await loadRoom(id);
    return { status: outcome.status, body: { ok: false, code: outcome.error, error: outcome.message, room: room ? publicRoom(room, null) : null } };
  }
  return { status: 200, body: { ok: true, token: issued.token, color: issued.color, room: publicRoom(outcome.room, issued.color) } };
}

function playerAction(handler) {
  return async (request, body) => {
    const id = String(body?.room || "").toLowerCase();
    const token = String(body?.token || "");
    let you = null;
    const outcome = await mutateRoom(id, (room) => {
      you = colorForToken(room, token);
      if (!you) return { error: "FORBIDDEN", status: 403, message: "Siz bu o'yinning ishtirokchisi emassiz." };
      room.players[you].lastSeen = Date.now();
      settleClock(room);
      return handler(room, you, body);
    });
    if (!outcome.room && !outcome.error) return { status: 404, body: { ok: false, code: "NOT_FOUND", error: "O'yin topilmadi." } };
    if (outcome.error) return { status: outcome.status || 400, body: { ok: false, code: outcome.error, error: outcome.message } };
    // Qayta o'yinda ranglar almashadi — rangni yangi holatdan aniqlaymiz.
    return { status: 200, body: { ok: true, room: publicRoom(outcome.room, colorForToken(outcome.room, token)) } };
  };
}

const reject = (code, message, status = 409) => ({ error: code, status, message });

const makeMove = playerAction((room, you, body) => {
  if (room.status === "ended") return reject("ENDED", "O'yin tugagan.");
  if (room.status !== "active") return reject("WAITING", "Raqib hali qo'shilmadi.");
  if (turnOf(room) !== you) return reject("NOT_YOUR_TURN", "Hozir raqibning navbati.");
  // Mijoz qaysi pozitsiyadan yurganini yurishlar soni bilan bildiradi (onlayn
  // belgisi kabi boshqa o'zgarishlar yurishni bekor qilmasligi uchun).
  if (body?.ply != null && Number(body.ply) !== room.moves.length) return reject("STALE", "Holat yangilandi, qayta urinib ko'ring.");
  const played = ENGINES[room.game].play(room.state, body?.move);
  if (!played) return reject("ILLEGAL", "Bu yurish qoidaga zid.", 400);
  const now = Date.now();
  if (room.clock) {
    if (clockRunning(room)) room.clock[you] -= now - room.clock.turnStartedAt;
    room.clock[you] += (TIME_CONTROLS[room.timeControl]?.inc || 0) * 1000;
    room.clock.turnStartedAt = now;
  }
  room.state = played.state;
  room.moves.push(played.notation);
  room.lastMove = played.last;
  room.drawOffer = null;
  const status = ENGINES[room.game].status(room.state);
  if (status.over) finish(room, status.winner, status.reason);
  return null;
});

const resign = playerAction((room, you) => {
  if (room.status === "ended") return reject("ENDED", "O'yin tugagan.");
  if (room.status === "waiting") {
    finish(room, null, "cancelled");
    return null;
  }
  finish(room, otherColor(you), "resign");
  return null;
});

const offerDraw = playerAction((room, you) => {
  if (room.status !== "active") return reject("NOT_ACTIVE", "O'yin faol emas.");
  if (room.drawOffer === otherColor(you)) {
    finish(room, null, "agreement");
    return null;
  }
  room.drawOffer = you;
  return null;
});

const declineDraw = playerAction((room, you) => {
  if (room.drawOffer === otherColor(you)) room.drawOffer = null;
  return null;
});

// Ikkalasi ham "Qayta o'ynash"ni bosganda ranglar almashadi va yangi o'yin boshlanadi.
const rematch = playerAction((room, you) => {
  if (room.status !== "ended") return reject("NOT_ENDED", "O'yin hali tugamagan.");
  room.rematch[you] = true;
  if (room.rematch.w && room.rematch.b) {
    const { w, b } = room.players;
    room.players = { w: b, b: w };
    freshGame(room);
  }
  return null;
});

const ACTIONS = {
  create: createRoom,
  join: joinRoom,
  move: makeMove,
  resign,
  "offer-draw": offerDraw,
  "decline-draw": declineDraw,
  rematch,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getRoom(request) {
  const url = new URL(request.url || "/", "http://localhost");
  const id = String(url.searchParams.get("room") || request.query?.room || "").toLowerCase();
  const since = Number(url.searchParams.get("since") || 0);
  const wait = url.searchParams.get("wait") === "1";
  const token = String(request.headers["x-game-token"] || "");
  if (!/^[a-z0-9]{4,16}$/.test(id)) return { status: 400, body: { ok: false, error: "Xona ID noto'g'ri." } };

  const deadline = Date.now() + (wait ? LONG_POLL_MS : 0);
  let touched = false;
  for (;;) {
    let room = await loadRoom(id);
    if (!room) return { status: 404, body: { ok: false, code: "NOT_FOUND", error: "O'yin topilmadi yoki muddati tugagan." } };
    const you = colorForToken(room, token);
    const clockDue = clockRunning(room) && room.clock[turnOf(room)] - (Date.now() - room.clock.turnStartedAt) <= 0;
    // Onlayn belgisi uchun lastSeen'ni har 10 soniyada bir yangilaymiz.
    const stale = you && !touched && Date.now() - (room.players[you].lastSeen || 0) > ONLINE_WINDOW_MS / 2;
    if (clockDue || stale) {
      touched = true;
      const out = await mutateRoom(id, (r) => {
        if (you && r.players[you]) r.players[you].lastSeen = Date.now();
        settleClock(r);
        return null;
      });
      if (out.room) room = out.room;
    }
    if (!wait || room.version > since || Date.now() >= deadline) {
      return { status: 200, body: { ok: true, changed: room.version > since, room: publicRoom(room, you) } };
    }
    await sleep(POLL_STEP_MS);
  }
}

async function handleGames(request, response) {
  setCorsHeaders(request, response);
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (!(await applyRateLimit(request, response, { max: 240 }))) return;

  // Faqat o'z domenimizdan yoki Telegram ichidan.
  const origin = request.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    response.status(403).json({ ok: false, code: "FORBIDDEN", error: "Ruxsat berilmagan domen." });
    return;
  }

  try {
    if (request.method === "GET") {
      const out = await getRoom(request);
      response.status(out.status).json(out.body);
      return;
    }
    if (request.method !== "POST") {
      response.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }
    const body = await readLimitedJsonBody(request, 16 * 1024);
    const action = ACTIONS[String(body?.action || "")];
    if (!action) {
      response.status(400).json({ ok: false, error: "Noma'lum amal." });
      return;
    }
    const out = await action(request, body);
    response.status(out.status).json(out.body);
  } catch (err) {
    if (err?.statusCode === 413 || err instanceof SyntaxError) {
      response.status(err.statusCode || 400).json({ ok: false, error: "So'rov noto'g'ri." });
      return;
    }
    console.error("games error:", err);
    response.status(500).json({ ok: false, error: "Server xatosi." });
  }
}

module.exports = { handleGames, TIME_CONTROLS, _memoryRooms: memoryRooms };
