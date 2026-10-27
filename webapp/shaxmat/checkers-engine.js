// Shashka dvigateli (rus shashkasi qoidalari): urish majburiy, oddiy dona
// orqaga ham uradi, bir yurishda ketma-ket urish, damka (shoh) uzoqqa yuradi,
// oxirgi qatorga urish paytida yetgan dona darhol damka bo'lib urishni
// davom ettiradi, urilgan donalar yurish tugaguncha taxtada qoladi
// ("turk urishi"). Brauzerda window.CheckersEngine, serverda require().
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CheckersEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FILES = "abcdefgh";
  const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  // 15 yurishdan (30 yarim yurish) beri faqat damkalar yursa va urish bo'lmasa — durang.
  const QUIET_LIMIT = 30;

  const squareName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  function parseSquare(name) {
    const m = /^([a-h])([1-8])$/.exec(String(name || ""));
    return m ? (Number(m[2]) - 1) * 8 + FILES.indexOf(m[1]) : -1;
  }
  const isDark = (i) => (((i >> 3) + (i & 7)) & 1) === 0;
  const colorOf = (p) => p.toLowerCase();
  const isKing = (p) => p === "W" || p === "B";
  const opposite = (c) => (c === "w" ? "b" : "w");
  const onBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

  function positionKey(state) {
    let key = "";
    for (let i = 0; i < 64; i++) key += state.board[i] || ".";
    return key + state.turn;
  }

  function createInitialState() {
    const board = new Array(64).fill(null);
    for (let i = 0; i < 64; i++) {
      if (!isDark(i)) continue;
      const r = i >> 3;
      if (r <= 2) board[i] = "w";
      else if (r >= 5) board[i] = "b";
    }
    const state = { board, turn: "w", quiet: 0, history: [] };
    state.history = [positionKey(state)];
    return state;
  }

  function fromLayout({ white = [], black = [], turn = "w" }) {
    const board = new Array(64).fill(null);
    const put = (list, man) => {
      for (const name of list) {
        const king = name.startsWith("K");
        board[parseSquare(king ? name.slice(1) : name)] = king ? man.toUpperCase() : man;
      }
    };
    put(white, "w");
    put(black, "b");
    const state = { board, turn, quiet: 0, history: [] };
    state.history = [positionKey(state)];
    return state;
  }

  const promotes = (sq, color) => (color === "w" ? (sq >> 3) === 7 : (sq >> 3) === 0);

  function captureSequences(board, from, piece) {
    const color = colorOf(piece);
    const results = [];
    // Yuruvchi dona boshlang'ich katakdan ketgan deb hisoblanadi.
    const b = board.slice();
    b[from] = null;

    function extend(sq, king, path, captured) {
      const options = [];
      for (const [dr, df] of DIRS) {
        let r = (sq >> 3) + dr, f = (sq & 7) + df;
        if (king) {
          while (onBoard(r, f) && !b[r * 8 + f]) { r += dr; f += df; }
        }
        if (!onBoard(r, f)) continue;
        const victim = r * 8 + f;
        const vp = b[victim];
        if (!vp || colorOf(vp) === color || captured.includes(victim)) continue;
        const landings = [];
        let lr = r + dr, lf = f + df;
        while (onBoard(lr, lf) && !b[lr * 8 + lf]) {
          landings.push(lr * 8 + lf);
          if (!king) break;
          lr += dr; lf += df;
        }
        if (!landings.length) continue;
        // Damka urishni davom ettira oladigan katakka tushishi shart.
        const continuing = landings.filter((l) => canCapture(l, king || promotes(l, color), captured.concat(victim)));
        for (const l of continuing.length ? continuing : landings) options.push({ victim, landing: l });
      }
      if (!options.length) {
        if (captured.length) results.push({ path: path.slice(), captures: captured.slice(), king });
        return;
      }
      for (const { victim, landing } of options) {
        path.push(landing);
        extend(landing, king || promotes(landing, color), path, captured.concat(victim));
        path.pop();
      }
    }

    function canCapture(sq, king, captured) {
      for (const [dr, df] of DIRS) {
        let r = (sq >> 3) + dr, f = (sq & 7) + df;
        if (king) while (onBoard(r, f) && !b[r * 8 + f]) { r += dr; f += df; }
        if (!onBoard(r, f)) continue;
        const victim = r * 8 + f;
        const vp = b[victim];
        if (!vp || colorOf(vp) === color || captured.includes(victim)) continue;
        if (onBoard(r + dr, f + df) && !b[(r + dr) * 8 + f + df]) return true;
      }
      return false;
    }

    extend(from, isKing(piece), [], []);
    return results.map((r) => ({ from, path: r.path, captures: r.captures, piece, promote: !isKing(piece) && r.king }));
  }

  function legalMoves(state) {
    const { board, turn } = state;
    const captures = [];
    const quiet = [];
    for (let from = 0; from < 64; from++) {
      const p = board[from];
      if (!p || colorOf(p) !== turn) continue;
      captures.push(...captureSequences(board, from, p));
      if (captures.length) continue;
      const king = isKing(p);
      for (const [dr, df] of DIRS) {
        if (!king && dr !== (turn === "w" ? 1 : -1)) continue;
        let r = (from >> 3) + dr, f = (from & 7) + df;
        while (onBoard(r, f) && !board[r * 8 + f]) {
          const to = r * 8 + f;
          quiet.push({ from, path: [to], captures: [], piece: p, promote: !king && promotes(to, turn) });
          if (!king) break;
          r += dr; f += df;
        }
      }
    }
    return captures.length ? captures : quiet;
  }

  const legalMovesFrom = (state, from) => legalMoves(state).filter((m) => m.from === from);
  const destination = (move) => move.path[move.path.length - 1];

  function applyMove(state, move, lite) {
    const board = state.board.slice();
    const to = destination(move);
    board[move.from] = null;
    for (const c of move.captures) board[c] = null;
    board[to] = move.promote ? move.piece.toUpperCase() : move.piece;
    const irreversible = move.captures.length > 0 || !isKing(move.piece);
    const next = {
      board,
      turn: opposite(state.turn),
      quiet: irreversible ? 0 : (state.quiet || 0) + 1,
      history: [],
    };
    if (!lite) next.history = (irreversible ? [] : (state.history || []).slice(-120)).concat(positionKey(next));
    return next;
  }

  function getStatus(state) {
    const moves = legalMoves(state);
    if (!moves.length) return { over: true, winner: opposite(state.turn), reason: "nomoves" };
    if ((state.quiet || 0) >= QUIET_LIMIT) return { over: true, winner: null, reason: "kings" };
    const key = positionKey(state);
    if ((state.history || []).filter((k) => k === key).length >= 3) return { over: true, winner: null, reason: "repetition" };
    return { over: false, winner: null, reason: "" };
  }

  // Foydalanuvchi yo'li: {from, path: [katak, ...]} — to'liq mos keladigan yurish.
  function findMove(state, input) {
    const from = typeof input.from === "number" ? input.from : parseSquare(input.from);
    const path = (Array.isArray(input.path) ? input.path : [input.to]).map((s) => (typeof s === "number" ? s : parseSquare(s)));
    const matches = legalMoves(state).filter((m) => m.from === from && m.path.length === path.length && m.path.every((s, i) => s === path[i]));
    if (matches.length === 1) return matches[0];
    // Bitta yakuniy katakka faqat bitta yo'l bo'lsa, oraliq kataklarsiz ham qabul qilinadi.
    if (path.length === 1) {
      const byEnd = legalMoves(state).filter((m) => m.from === from && destination(m) === path[0]);
      if (byEnd.length === 1) return byEnd[0];
    }
    return null;
  }

  function moveToText(move) {
    const sep = move.captures.length ? ":" : "-";
    return [move.from].concat(move.path).map(squareName).join(sep);
  }

  function countPieces(board) {
    const n = { w: 0, b: 0, W: 0, B: 0 };
    for (const p of board) if (p) n[p]++;
    return n;
  }

  // ---------------- Kompyuter raqib ----------------
  function evaluate(state) {
    let score = 0;
    const board = state.board;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p) continue;
      const r = i >> 3, f = i & 7;
      let v;
      if (isKing(p)) v = 300;
      else {
        const advance = p === "w" ? r : 7 - r;
        v = 100 + advance * 6;
        if ((p === "w" && r === 0) || (p === "b" && r === 7)) v += 8; // orqa qatorni qo'riqlash
      }
      if (f >= 2 && f <= 5 && r >= 2 && r <= 5) v += 6;
      if (f === 0 || f === 7) v -= 4;
      score += colorOf(p) === "w" ? v : -v;
    }
    return state.turn === "w" ? score : -score;
  }

  const WIN = 100000;
  const orderMoves = (moves) => moves.sort((a, b) => (b.captures.length - a.captures.length) || (Number(b.promote) - Number(a.promote)));

  function chooseMove(state, level = 2, options = {}) {
    const settings = { 1: { depth: 2, noise: 60, ms: 300 }, 2: { depth: 5, noise: 15, ms: 900 }, 3: { depth: 9, noise: 0, ms: 1800 } }[level] || { depth: 5, noise: 15, ms: 900 };
    const deadline = Date.now() + (options.timeMs || settings.ms);
    const random = options.random || Math.random;
    let nodes = 0;
    let aborted = false;

    function negamax(s, depth, alpha, beta, ply) {
      if ((++nodes & 511) === 0 && Date.now() > deadline) aborted = true;
      if (aborted) return 0;
      const moves = legalMoves(s);
      if (!moves.length) return -WIN + ply;
      // Urish zanjiri tugamaguncha chuqurlikni kamaytirmaymiz (gorizont effekti).
      if (depth <= 0 && !moves[0].captures.length) return evaluate(s);
      if (depth <= -6) return evaluate(s);
      orderMoves(moves);
      for (const m of moves) {
        const score = -negamax(applyMove(s, m, true), depth - 1, -beta, -alpha, ply + 1);
        if (aborted) return 0;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    const rootMoves = orderMoves(legalMoves(state));
    if (!rootMoves.length) return null;
    if (rootMoves.length === 1) return rootMoves[0];
    let best = rootMoves[0];
    for (let depth = 1; depth <= settings.depth; depth++) {
      let alpha = -Infinity;
      let bestThis = null;
      for (const m of rootMoves) {
        const score = -negamax(applyMove(state, m, true), depth - 1, -WIN * 2, -alpha + settings.noise, 1);
        if (aborted) break;
        const noisy = score + (settings.noise ? (random() - 0.5) * 2 * settings.noise : 0);
        if (!bestThis || noisy > bestThis.noisy) bestThis = { m, noisy };
        if (score > alpha) alpha = score;
      }
      if (aborted && depth > 1) break;
      if (bestThis) {
        best = bestThis.m;
        rootMoves.splice(rootMoves.indexOf(best), 1);
        rootMoves.unshift(best);
      }
      if (aborted) break;
    }
    return best;
  }

  return {
    createInitialState,
    fromLayout,
    legalMoves,
    legalMovesFrom,
    applyMove,
    findMove,
    getStatus,
    moveToText,
    countPieces,
    chooseMove,
    destination,
    squareName,
    parseSquare,
    isDark,
    isKing,
    colorOf,
  };
});
