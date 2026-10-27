const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createMockReq, createMockRes } = require("../helpers/mock-http");

const ROOT = path.resolve(__dirname, "../..");
const Chess = require("../../webapp/shaxmat/chess-engine.js");
const Checkers = require("../../webapp/shaxmat/checkers-engine.js");
const { handleGames, _memoryRooms } = require("../../api/_lib/games");

delete process.env.REDIS_URL;
delete process.env.KV_URL;

async function call(method, body, { url = "/api/games", headers = {} } = {}) {
  const req = createMockReq({ method, url, body, headers });
  const res = createMockRes();
  await handleGames(req, res);
  return res;
}

const post = (body, headers) => call("POST", body, { headers });

async function newMatch(game = "chess", extra = {}) {
  const created = await post({ action: "create", game, color: "w", name: "Ali", ...extra });
  const joined = await post({ action: "join", room: created.body.room.id, name: "Vali" });
  return { id: created.body.room.id, w: created.body.token, b: joined.body.token, created, joined };
}

const move = (id, token, m, extra = {}) => post({ action: "move", room: id, token, move: m, ...extra });

test("chess engine: perft matches the reference counts", () => {
  assert.equal(Chess.perft(Chess.createInitialState(), 3), 8902);
  const kiwipete = Chess.fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  assert.equal(Chess.perft(kiwipete, 2), 2039);
  assert.equal(Chess.perft(Chess.fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 3), 2812);
  assert.equal(Chess.perft(Chess.fromFEN("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3), 9467);
});

test("chess engine: special moves, notation and game endings", () => {
  let s = Chess.fromFEN("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const castle = Chess.findMove(s, { from: "e1", to: "g1" });
  assert.equal(Chess.moveToSan(s, castle), "O-O");
  s = Chess.applyMove(s, castle);
  assert.equal(s.board[Chess.parseSquare("f1")], "R");
  assert.equal(s.castling, "kq");

  s = Chess.fromFEN("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  const ep = Chess.findMove(s, { from: "e5", to: "d6" });
  assert.equal(ep.flag, "ep");
  assert.equal(Chess.applyMove(s, ep).board[Chess.parseSquare("d5")], null);

  s = Chess.fromFEN("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
  const promo = Chess.findMove(s, { from: "a7", to: "a8", promotion: "n" });
  assert.equal(Chess.moveToSan(s, promo), "a8=N");

  s = Chess.createInitialState();
  for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"]]) s = Chess.applyMove(s, Chess.findMove(s, { from, to }));
  const mate = Chess.findMove(s, { from: "d8", to: "h4" });
  assert.equal(Chess.moveToSan(s, mate), "Qh4#");
  assert.deepEqual(Chess.getStatus(Chess.applyMove(s, mate)), { over: true, winner: "b", reason: "checkmate", check: true });

  assert.equal(Chess.getStatus(Chess.fromFEN("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).reason, "stalemate");
  assert.equal(Chess.getStatus(Chess.fromFEN("7k/8/6K1/8/8/8/8/5B2 b - - 0 1")).reason, "material");

  // Uch marta takror: otlar oldinga-orqaga yuradi.
  s = Chess.createInitialState();
  const shuffle = [["g1", "f3"], ["g8", "f6"], ["f3", "g1"], ["f6", "g8"]];
  for (let i = 0; i < 2; i++) for (const [from, to] of shuffle) s = Chess.applyMove(s, Chess.findMove(s, { from, to }));
  assert.equal(Chess.getStatus(s).reason, "repetition");
});

test("chess engine: the computer finds a mate in one", () => {
  const s = Chess.fromFEN("6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1");
  for (const level of [2, 3]) {
    const m = Chess.chooseMove(s, level, { random: () => 0.5 });
    assert.equal(Chess.moveToSan(s, m), "Rd8#");
  }
});

test("checkers engine: Russian draughts rules", () => {
  // Rus shashkasi perft qiymatlari.
  const perft = (s, d) => (d === 1 ? Checkers.legalMoves(s).length : Checkers.legalMoves(s).reduce((n, m) => n + perft(Checkers.applyMove(s, m, true), d - 1), 0));
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => perft(Checkers.createInitialState(), d)), [7, 49, 302, 1469, 7482]);

  const texts = (s) => Checkers.legalMoves(s).map(Checkers.moveToText).sort();
  // Urish majburiy va ketma-ket urish.
  assert.deepEqual(texts(Checkers.fromLayout({ white: ["c3", "a1"], black: ["d4", "f6"] })), ["c3:e5:g7"]);
  // Oddiy dona orqaga ham uradi.
  assert.deepEqual(texts(Checkers.fromLayout({ white: ["e5"], black: ["d4"] })), ["e5:c3"]);
  // Damka uzoqdan uradi va urishni davom ettira oladigan katakka tushadi.
  assert.deepEqual(texts(Checkers.fromLayout({ white: ["Ka1"], black: ["c3", "f6"] })), ["a1:d4:g7", "a1:d4:h8", "a1:e5:g7", "a1:e5:h8"]);
  // Urish paytida oxirgi qatorga yetgan dona damka bo'lib, damka sifatida urishni davom ettiradi.
  const promo = Checkers.legalMoves(Checkers.fromLayout({ white: ["b6"], black: ["c7", "f6"] }));
  assert.deepEqual(promo.map(Checkers.moveToText).sort(), ["b6:d8:g5", "b6:d8:h4"]);
  assert.ok(promo.every((m) => m.promote));
  // Urilgan dona yurish tugaguncha taxtada qoladi va uni ikki marta urib bo'lmaydi.
  assert.deepEqual(texts(Checkers.fromLayout({ white: ["e5"], black: ["f6", "e7"] })), ["e5:g7"]);
  // Raqibda yurish qolmasa — yutqazadi.
  assert.deepEqual(Checkers.getStatus(Checkers.fromLayout({ white: ["a1"], black: [], turn: "b" })), { over: true, winner: "w", reason: "nomoves" });
});

test("games API: friends play an online chess game by invite link", async () => {
  const { id, w, b, created, joined } = await newMatch("chess", { timeControl: "3+2" });
  assert.equal(created.statusCode, 200);
  assert.equal(created.body.room.status, "waiting");
  assert.equal(joined.body.color, "b");
  assert.equal(joined.body.room.status, "active");
  assert.equal(created.body.room.players.w.name, "Ali");
  assert.ok(!JSON.stringify(joined.body.room).includes(w), "tokens never leak into room snapshots");

  assert.equal((await move(id, b, { from: "e7", to: "e5" })).body.code, "NOT_YOUR_TURN");
  assert.equal((await move(id, w, { from: "e2", to: "e5" })).body.code, "ILLEGAL");
  assert.equal((await move(id, "nope", { from: "e2", to: "e4" })).statusCode, 403);
  assert.equal((await move(id, w, { from: "e2", to: "e4" }, { ply: 3 })).body.code, "STALE");

  let res;
  for (const [token, from, to] of [[w, "f2", "f3"], [b, "e7", "e5"], [w, "g2", "g4"], [b, "d8", "h4"]]) {
    res = await move(id, token, { from, to });
    assert.equal(res.statusCode, 200, `${from}-${to}`);
  }
  assert.deepEqual(res.body.room.moves, ["f3", "e5", "g4", "Qh4#"]);
  assert.deepEqual(res.body.room.result, { winner: "b", reason: "checkmate" });
  // 3+2: har yurishdan keyin 2 soniya qo'shiladi.
  assert.ok(res.body.room.clock.w > 183000 && res.body.room.clock.w <= 184000, String(res.body.room.clock.w));

  // Uchinchi odam — tomoshabin.
  const third = await post({ action: "join", room: id, name: "Soli" });
  assert.equal(third.statusCode, 409);
  assert.equal(third.body.code, "FULL");
  assert.equal(third.body.room.you, null);

  // Ikkalasi rozi bo'lsa — qayta o'yin, ranglar almashadi.
  await post({ action: "rematch", room: id, token: w });
  res = await post({ action: "rematch", room: id, token: b });
  assert.equal(res.body.room.status, "active");
  assert.equal(res.body.room.you, "w");
  assert.equal(res.body.room.players.w.name, "Vali");
  assert.deepEqual(res.body.room.moves, []);

  // Saqlangan token bilan qayta kirish o'sha o'rinni qaytaradi.
  const rejoin = await post({ action: "join", room: id, token: w });
  assert.equal(rejoin.body.color, "b");

  const poll = await call("GET", null, { url: `/api/games?room=${id}&since=0`, headers: { "x-game-token": b } });
  assert.equal(poll.body.ok, true);
  assert.equal(poll.body.changed, true);
  assert.equal(poll.body.room.you, "w");
});

test("games API: checkers moves, draw offers, resign and timeouts", async () => {
  const { id, w, b } = await newMatch("checkers", { timeControl: "1+0" });
  let res = await move(id, w, { from: "c3", path: ["d4"] });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.room.moves, ["c3-d4"]);
  res = await move(id, b, { from: "f6", path: ["e5"] });
  // Oqlar urishi majburiy: oddiy yurish rad etiladi.
  assert.equal((await move(id, w, { from: "a3", path: ["b4"] })).body.code, "ILLEGAL");
  assert.equal((await move(id, w, { from: "d4", path: ["f6"] })).statusCode, 200);

  res = await post({ action: "offer-draw", room: id, token: b });
  assert.equal(res.body.room.drawOffer, "b");
  res = await post({ action: "decline-draw", room: id, token: w });
  assert.equal(res.body.room.drawOffer, null);
  await post({ action: "offer-draw", room: id, token: b });
  res = await post({ action: "offer-draw", room: id, token: w });
  assert.deepEqual(res.body.room.result, { winner: null, reason: "agreement" });

  const second = await newMatch("chess", { timeControl: "1+0" });
  await move(second.id, second.w, { from: "e2", to: "e4" });
  // Qora o'ylab qoldi: vaqtini sun'iy ravishda o'tkazib yuboramiz.
  const entry = _memoryRooms.get(second.id);
  const room = JSON.parse(entry.json);
  room.clock.turnStartedAt -= 61000;
  entry.json = JSON.stringify(room);
  res = await call("GET", null, { url: `/api/games?room=${second.id}&since=0` });
  assert.deepEqual(res.body.room.result, { winner: "w", reason: "timeout" });
  assert.equal(res.body.room.clock.b, 0);

  const third = await newMatch("chess");
  res = await post({ action: "resign", room: third.id, token: third.b });
  assert.deepEqual(res.body.room.result, { winner: "w", reason: "resign" });
  assert.equal((await move(third.id, third.w, { from: "e2", to: "e4" })).body.code, "ENDED");
});

test("games API: every time category is accepted and the clock starts once both players are in", async () => {
  for (const tc of ["1+0", "2+1", "3+0", "3+2", "5+0", "10+0", "10+5", "15+10", "30+0", "30+20"]) {
    const res = await post({ action: "create", game: "chess", timeControl: tc });
    assert.equal(res.body.room.timeControl, tc);
  }
  const waiting = await post({ action: "create", game: "chess", color: "w", timeControl: "15+10" });
  assert.equal(waiting.body.room.clock.running, null, "no clock while waiting for the friend");
  const id = waiting.body.room.id;
  await post({ action: "join", room: id });
  const entry = _memoryRooms.get(id);
  const room = JSON.parse(entry.json);
  room.clock.turnStartedAt -= 5000;
  entry.json = JSON.stringify(room);
  const res = await call("GET", null, { url: `/api/games?room=${id}&since=0` });
  assert.equal(res.body.room.clock.running, "w", "white's clock runs before the first move");
  assert.ok(res.body.room.clock.w <= 15 * 60000 - 5000);
  assert.equal(res.body.room.clock.b, 15 * 60000);
});

test("games page: time categories, local clocks and a computer that never hangs", () => {
  const js = fs.readFileSync(path.join(ROOT, "webapp/shaxmat/shaxmat.js"), "utf8");
  for (const name of ["Bullet", "Blits", "Rapid", "Klassik", "Cheksiz"]) assert.match(js, new RegExp(`name: "${name}"`));
  assert.match(js, /function pressLocalClock\(s, mover\)/);
  assert.match(js, /endLocal\(\{ winner: opposite\(color\), reason: "timeout" \}\)/);
  // Worker xato bersa yoki javob bermasa — shu sahifada hisoblanadi.
  assert.match(js, /w\.addEventListener\("error", onError\)/);
  assert.match(js, /timer = setTimeout\(\(\) => \{\s*worker = false;/);
  assert.match(js, /function chooseHere\(game, state, level, timeMs\)/);
  const html = fs.readFileSync(path.join(ROOT, "webapp/shaxmat/index.html"), "utf8");
  assert.match(html, /id="tcCats"/);
  assert.match(html, /id="tcOptions"/);
});

test("games API: rejects bad input and foreign origins", async () => {
  assert.equal((await post({ action: "create", game: "go" })).statusCode, 400);
  assert.equal((await post({ action: "fly" })).statusCode, 400);
  assert.equal((await call("GET", null, { url: "/api/games?room=../../x" })).statusCode, 400);
  assert.equal((await call("GET", null, { url: "/api/games?room=zzzzzzzz" })).statusCode, 404);
  assert.equal((await post({ action: "join", room: "zzzzzzzz" })).statusCode, 404);
  const foreign = await post({ action: "create", game: "chess" }, { origin: "https://evil.example" });
  assert.equal(foreign.statusCode, 403);
  const created = await post({ action: "create", game: "chess", name: "<script>x</script>".repeat(5) });
  const name = Object.values(created.body.room.players).find(Boolean).name;
  assert.ok(!name.includes("<") && name.length <= 32);
});

test("games are routed at /shaxmat and invite links open the game", () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const routes = vercel.routes.map((r) => `${r.src} -> ${r.dest}`);
  assert.ok(routes.includes("/api/games -> /api/users.js?_games=1"), "games API piggybacks on an existing function");
  assert.ok(routes.includes("/shaxmat -> /webapp/shaxmat/index.html"));
  assert.ok(routes.includes("/shaxmat/(.*) -> /webapp/shaxmat/$1"));
  assert.ok(vercel.builds.length <= 13, "no new serverless function was added");

  const users = fs.readFileSync(path.join(ROOT, "api/users.js"), "utf8");
  // Modul faqat o'yin so'rovida yuklanadi — boshqa foydalanuvchi API'lariga ta'sir qilmaydi.
  assert.match(users, /_games=1[\s\S]*?return require\("\.\/_lib\/games"\)\.handleGames\(request, response\)/);
  const usersBuild = vercel.builds.find((b) => b.src === "api/users.js");
  assert.deepEqual(usersBuild.config.includeFiles, ["webapp/shaxmat/chess-engine.js", "webapp/shaxmat/checkers-engine.js"]);

  const index = fs.readFileSync(path.join(ROOT, "webapp/index.html"), "utf8");
  assert.match(index, /\^shaxmat_\(\[a-z0-9\]\{4,16\}\)\$/);
  assert.match(index, /location\.replace\("\/shaxmat\/\?room="/);

  const page = fs.readFileSync(path.join(ROOT, "webapp/shaxmat/index.html"), "utf8");
  for (const src of ["chess-engine.js", "checkers-engine.js", "shaxmat.js", "shaxmat.css"]) {
    assert.match(page, new RegExp(`/shaxmat/${src.replace(".", "\\.")}\\?v=`));
  }
  const js = fs.readFileSync(path.join(ROOT, "webapp/shaxmat/shaxmat.js"), "utf8");
  assert.match(js, /startapp=shaxmat_\$\{session\.room\}/);
  assert.match(js, /disableVerticalSwipes/);
});
