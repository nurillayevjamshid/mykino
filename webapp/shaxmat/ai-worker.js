// Kompyuter yurishini alohida oqimda hisoblaydi — taxta qotib qolmasligi uchun.
importScripts("/shaxmat/chess-engine.js?v=20261027-games-v1", "/shaxmat/checkers-engine.js?v=20261027-games-v1");

self.onmessage = (event) => {
  const { id, game, state, level, timeMs } = event.data || {};
  const engine = game === "checkers" ? self.CheckersEngine : self.ChessEngine;
  let move = null;
  try {
    move = engine.chooseMove(state, level, timeMs ? { timeMs } : {});
  } catch (err) {
    move = null;
  }
  self.postMessage({ id, move });
};
