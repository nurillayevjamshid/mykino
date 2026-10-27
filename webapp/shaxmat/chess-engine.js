// Shaxmat dvigateli: to'liq qoidalar (rokirovka, en passant, piyoda almashuvi,
// shax/mot/pat, 50 yurish, uch marta takror, yetarli bo'lmagan material) va
// kompyuter raqib. Brauzerda window.ChessEngine, serverda require() orqali
// ishlatiladi — server har bir yurishni shu kod bilan tekshiradi.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ChessEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const FILES = "abcdefgh";
  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const PROMOTIONS = ["q", "r", "b", "n"];

  // Kataklar: index = rank * 8 + file, rank 0 — oqlarning birinchi qatori.
  const squareName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  function parseSquare(name) {
    const m = /^([a-h])([1-8])$/.exec(String(name || ""));
    return m ? (Number(m[2]) - 1) * 8 + FILES.indexOf(m[1]) : -1;
  }
  const colorOf = (p) => (p === p.toUpperCase() ? "w" : "b");
  const opposite = (c) => (c === "w" ? "b" : "w");
  const typeOf = (p) => p.toLowerCase();
  const ofColor = (type, color) => (color === "w" ? type.toUpperCase() : type);

  function positionKey(state) {
    let key = "";
    for (let i = 0; i < 64; i++) key += state.board[i] || ".";
    return key + " " + state.turn + " " + (state.castling || "-") + " " + (epMatters(state) ? state.ep : "-");
  }

  // En passant katagi takrorlanishda faqat urib olish haqiqatan mumkin bo'lsa hisoblanadi.
  function epMatters(state) {
    if (state.ep < 0) return false;
    const dir = state.turn === "w" ? -1 : 1;
    const pawn = ofColor("p", state.turn);
    const r = (state.ep >> 3) + dir;
    for (const df of [-1, 1]) {
      const f = (state.ep & 7) + df;
      if (f >= 0 && f < 8 && state.board[r * 8 + f] === pawn) return true;
    }
    return false;
  }

  function createInitialState() {
    return fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  function fromFEN(fen) {
    const parts = String(fen).trim().split(/\s+/);
    const board = new Array(64).fill(null);
    const rows = parts[0].split("/");
    for (let i = 0; i < 8; i++) {
      let f = 0;
      for (const ch of rows[i]) {
        if (/\d/.test(ch)) f += Number(ch);
        else board[(7 - i) * 8 + f++] = ch;
      }
    }
    const state = {
      board,
      turn: parts[1] === "b" ? "b" : "w",
      castling: parts[2] && parts[2] !== "-" ? parts[2] : "",
      ep: parts[3] && parts[3] !== "-" ? parseSquare(parts[3]) : -1,
      halfmove: Number(parts[4]) || 0,
      fullmove: Number(parts[5]) || 1,
      history: [],
    };
    state.history = [positionKey(state)];
    return state;
  }

  function toFEN(state) {
    const rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = "";
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = state.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p;
      }
      rows.push(row + (empty || ""));
    }
    return [rows.join("/"), state.turn, state.castling || "-", state.ep >= 0 ? squareName(state.ep) : "-", state.halfmove, state.fullmove].join(" ");
  }

  function isAttacked(board, sq, by) {
    const r = sq >> 3;
    const f = sq & 7;
    const pr = by === "w" ? r - 1 : r + 1;
    const pawn = ofColor("p", by);
    if (pr >= 0 && pr < 8) {
      if (f > 0 && board[pr * 8 + f - 1] === pawn) return true;
      if (f < 7 && board[pr * 8 + f + 1] === pawn) return true;
    }
    const knight = ofColor("n", by);
    for (const [dr, df] of KNIGHT) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && board[rr * 8 + ff] === knight) return true;
    }
    const king = ofColor("k", by);
    for (const [dr, df] of KING) {
      const rr = r + dr, ff = f + df;
      if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8 && board[rr * 8 + ff] === king) return true;
    }
    const rook = ofColor("r", by), bishop = ofColor("b", by), queen = ofColor("q", by);
    for (const [dr, df] of ROOK_DIRS) {
      for (let rr = r + dr, ff = f + df; rr >= 0 && rr < 8 && ff >= 0 && ff < 8; rr += dr, ff += df) {
        const p = board[rr * 8 + ff];
        if (!p) continue;
        if (p === rook || p === queen) return true;
        break;
      }
    }
    for (const [dr, df] of BISHOP_DIRS) {
      for (let rr = r + dr, ff = f + df; rr >= 0 && rr < 8 && ff >= 0 && ff < 8; rr += dr, ff += df) {
        const p = board[rr * 8 + ff];
        if (!p) continue;
        if (p === bishop || p === queen) return true;
        break;
      }
    }
    return false;
  }

  function findKing(board, color) {
    const king = ofColor("k", color);
    for (let i = 0; i < 64; i++) if (board[i] === king) return i;
    return -1;
  }

  function inCheck(state, color = state.turn) {
    const k = findKing(state.board, color);
    return k >= 0 && isAttacked(state.board, k, opposite(color));
  }

  function pseudoMoves(state) {
    const { board, turn } = state;
    const moves = [];
    const enemy = opposite(turn);
    const add = (from, to, extra) => {
      moves.push(Object.assign({ from, to, piece: board[from], captured: board[to] || null, promotion: null, flag: "" }, extra));
    };
    for (let from = 0; from < 64; from++) {
      const p = board[from];
      if (!p || colorOf(p) !== turn) continue;
      const r = from >> 3, f = from & 7;
      const t = typeOf(p);
      if (t === "p") {
        const dir = turn === "w" ? 1 : -1;
        const lastRank = turn === "w" ? 7 : 0;
        const startRank = turn === "w" ? 1 : 6;
        const pushPawn = (to, extra) => {
          if ((to >> 3) === lastRank) for (const promo of PROMOTIONS) add(from, to, Object.assign({ promotion: promo }, extra));
          else add(from, to, extra);
        };
        const one = from + 8 * dir;
        if (!board[one]) {
          pushPawn(one);
          const two = from + 16 * dir;
          if (r === startRank && !board[two]) add(from, two, { flag: "double" });
        }
        for (const df of [-1, 1]) {
          const ff = f + df;
          if (ff < 0 || ff > 7) continue;
          const to = (r + dir) * 8 + ff;
          if (board[to] && colorOf(board[to]) === enemy) pushPawn(to);
          else if (to === state.ep) add(from, to, { flag: "ep", captured: ofColor("p", enemy) });
        }
      } else if (t === "n" || t === "k") {
        for (const [dr, df] of t === "n" ? KNIGHT : KING) {
          const rr = r + dr, ff = f + df;
          if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue;
          const to = rr * 8 + ff;
          if (!board[to] || colorOf(board[to]) === enemy) add(from, to);
        }
      } else {
        const dirs = t === "r" ? ROOK_DIRS : t === "b" ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [dr, df] of dirs) {
          for (let rr = r + dr, ff = f + df; rr >= 0 && rr < 8 && ff >= 0 && ff < 8; rr += dr, ff += df) {
            const to = rr * 8 + ff;
            if (!board[to]) { add(from, to); continue; }
            if (colorOf(board[to]) === enemy) add(from, to);
            break;
          }
        }
      }
    }
    // Rokirovka: shoh va o'tadigan kataklar hujum ostida bo'lmasligi kerak.
    const base = turn === "w" ? 0 : 56;
    const king = ofColor("k", turn), rook = ofColor("r", turn);
    const rights = state.castling || "";
    if (board[base + 4] === king && !isAttacked(board, base + 4, enemy)) {
      if (rights.includes(turn === "w" ? "K" : "k") && board[base + 7] === rook && !board[base + 5] && !board[base + 6] &&
        !isAttacked(board, base + 5, enemy) && !isAttacked(board, base + 6, enemy)) {
        add(base + 4, base + 6, { flag: "castleK" });
      }
      if (rights.includes(turn === "w" ? "Q" : "q") && board[base] === rook && !board[base + 1] && !board[base + 2] && !board[base + 3] &&
        !isAttacked(board, base + 3, enemy) && !isAttacked(board, base + 2, enemy)) {
        add(base + 4, base + 2, { flag: "castleQ" });
      }
    }
    return moves;
  }

  function boardAfter(board, move, color) {
    const b = board.slice();
    b[move.to] = move.promotion ? ofColor(move.promotion, color) : move.piece;
    b[move.from] = null;
    if (move.flag === "ep") b[move.to + (color === "w" ? -8 : 8)] = null;
    else if (move.flag === "castleK") { b[move.to - 1] = b[move.to + 1]; b[move.to + 1] = null; }
    else if (move.flag === "castleQ") { b[move.to + 1] = b[move.to - 2]; b[move.to - 2] = null; }
    return b;
  }

  function legalMoves(state) {
    const color = state.turn;
    const enemy = opposite(color);
    return pseudoMoves(state).filter((m) => {
      const b = boardAfter(state.board, m, color);
      const k = typeOf(m.piece) === "k" ? m.to : findKing(b, color);
      return !isAttacked(b, k, enemy);
    });
  }

  const legalMovesFrom = (state, from) => legalMoves(state).filter((m) => m.from === from);

  // lite=true — qidiruv uchun: takrorlanish tarixini yuritmaydi.
  function applyMove(state, move, lite) {
    const color = state.turn;
    let castling = state.castling || "";
    const strip = (chars) => { for (const c of chars) castling = castling.replace(c, ""); };
    if (move.piece === "K") strip("KQ");
    if (move.piece === "k") strip("kq");
    for (const sq of [move.from, move.to]) {
      if (sq === 0) strip("Q");
      if (sq === 7) strip("K");
      if (sq === 56) strip("q");
      if (sq === 63) strip("k");
    }
    const irreversible = typeOf(move.piece) === "p" || Boolean(move.captured);
    const next = {
      board: boardAfter(state.board, move, color),
      turn: opposite(color),
      castling,
      ep: move.flag === "double" ? (move.from + move.to) / 2 : -1,
      halfmove: irreversible ? 0 : state.halfmove + 1,
      fullmove: state.fullmove + (color === "b" ? 1 : 0),
      history: [],
    };
    if (!lite) next.history = (irreversible ? [] : (state.history || []).slice(-120)).concat(positionKey(next));
    return next;
  }

  function insufficientMaterial(board) {
    const minors = [];
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || typeOf(p) === "k") continue;
      const t = typeOf(p);
      if (t === "p" || t === "r" || t === "q") return false;
      minors.push({ t, shade: ((i >> 3) + (i & 7)) % 2 });
    }
    if (minors.length <= 1) return true;
    return minors.every((m) => m.t === "b") && minors.every((m) => m.shade === minors[0].shade);
  }

  function getStatus(state) {
    const moves = legalMoves(state);
    const check = inCheck(state);
    if (!moves.length) {
      return check
        ? { over: true, winner: opposite(state.turn), reason: "checkmate", check }
        : { over: true, winner: null, reason: "stalemate", check };
    }
    if (insufficientMaterial(state.board)) return { over: true, winner: null, reason: "material", check };
    if (state.halfmove >= 100) return { over: true, winner: null, reason: "fifty", check };
    const key = positionKey(state);
    const seen = (state.history || []).filter((k) => k === key).length;
    if (seen >= 3) return { over: true, winner: null, reason: "repetition", check };
    return { over: false, winner: null, reason: "", check };
  }

  function findMove(state, input) {
    const from = typeof input.from === "number" ? input.from : parseSquare(input.from);
    const to = typeof input.to === "number" ? input.to : parseSquare(input.to);
    const promo = input.promotion ? String(input.promotion).toLowerCase() : "";
    const matches = legalMoves(state).filter((m) => m.from === from && m.to === to);
    if (!matches.length) return null;
    if (matches[0].promotion) return matches.find((m) => m.promotion === (promo || "q")) || null;
    return matches[0];
  }

  function moveToSan(state, move) {
    let san;
    if (move.flag === "castleK") san = "O-O";
    else if (move.flag === "castleQ") san = "O-O-O";
    else {
      const t = typeOf(move.piece);
      const target = squareName(move.to);
      if (t === "p") {
        san = (move.captured ? FILES[move.from & 7] + "x" : "") + target + (move.promotion ? "=" + move.promotion.toUpperCase() : "");
      } else {
        const rivals = legalMoves(state).filter((m) => m.to === move.to && m.piece === move.piece && m.from !== move.from);
        let dis = "";
        if (rivals.length) {
          const sameFile = rivals.some((m) => (m.from & 7) === (move.from & 7));
          const sameRank = rivals.some((m) => (m.from >> 3) === (move.from >> 3));
          if (!sameFile) dis = FILES[move.from & 7];
          else if (!sameRank) dis = String((move.from >> 3) + 1);
          else dis = squareName(move.from);
        }
        san = t.toUpperCase() + dis + (move.captured ? "x" : "") + target;
      }
    }
    const after = applyMove(state, move, true);
    if (inCheck(after)) san += legalMoves(after).length ? "+" : "#";
    return san;
  }

  function perft(state, depth) {
    if (depth === 0) return 1;
    const moves = legalMoves(state);
    if (depth === 1) return moves.length;
    let n = 0;
    for (const m of moves) n += perft(applyMove(state, m, true), depth - 1);
    return n;
  }

  // ---------------- Kompyuter raqib ----------------
  const VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  // Jadvallar oqlar nuqtai nazaridan, 8-qatordan boshlab yozilgan.
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    kEnd: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
  };

  function evaluate(state) {
    const board = state.board;
    let heavy = 0;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && "nbrqNBRQ".includes(p)) heavy += VALUES[typeOf(p)];
    }
    const endgame = heavy <= 1600;
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p) continue;
      const t = typeOf(p);
      const white = p !== t;
      const idx = white ? (7 - (i >> 3)) * 8 + (i & 7) : i;
      const table = t === "k" && endgame ? PST.kEnd : PST[t];
      const v = VALUES[t] + table[idx];
      score += white ? v : -v;
    }
    return state.turn === "w" ? score : -score;
  }

  const MATE = 100000;
  const orderKey = (m) => (m.captured ? 10 * VALUES[typeOf(m.captured)] - VALUES[typeOf(m.piece)] + 1000 : 0) + (m.promotion ? VALUES[m.promotion] : 0);
  const orderMoves = (moves) => moves.sort((a, b) => orderKey(b) - orderKey(a));

  function chooseMove(state, level = 2, options = {}) {
    const settings = { 1: { depth: 1, noise: 120, ms: 400 }, 2: { depth: 3, noise: 12, ms: 1000 }, 3: { depth: 4, noise: 0, ms: 1800 } }[level] || { depth: 3, noise: 12, ms: 1000 };
    const deadline = Date.now() + (options.timeMs || settings.ms);
    const random = options.random || Math.random;
    let nodes = 0;
    let aborted = false;

    const timeUp = () => {
      if ((++nodes & 511) === 0 && Date.now() > deadline) aborted = true;
      return aborted;
    };

    function quiesce(s, alpha, beta, qdepth) {
      if (timeUp()) return 0;
      const stand = evaluate(s);
      if (stand >= beta) return beta;
      if (alpha < stand) alpha = stand;
      if (qdepth >= 4) return alpha;
      const captures = orderMoves(legalMoves(s).filter((m) => m.captured || m.promotion));
      for (const m of captures) {
        const score = -quiesce(applyMove(s, m, true), -beta, -alpha, qdepth + 1);
        if (aborted) return 0;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    function negamax(s, depth, alpha, beta, ply) {
      if (timeUp()) return 0;
      const moves = legalMoves(s);
      if (!moves.length) return inCheck(s) ? -MATE + ply : 0;
      if (s.halfmove >= 100) return 0;
      if (depth <= 0) return quiesce(s, alpha, beta, 0);
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
    let best = rootMoves[0];
    for (let depth = 1; depth <= settings.depth; depth++) {
      let alpha = -Infinity;
      let bestThis = null;
      const scored = [];
      for (const m of rootMoves) {
        const score = -negamax(applyMove(state, m, true), depth - 1, -MATE * 2, -alpha + settings.noise, 1);
        if (aborted) break;
        const noisy = score + (settings.noise ? (random() - 0.5) * 2 * settings.noise : 0);
        scored.push({ m, noisy });
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
    fromFEN,
    toFEN,
    legalMoves,
    legalMovesFrom,
    applyMove,
    findMove,
    getStatus,
    inCheck,
    moveToSan,
    perft,
    chooseMove,
    squareName,
    parseSquare,
    colorOf,
    findKing,
  };
});
