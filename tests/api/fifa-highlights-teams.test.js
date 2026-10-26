const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("FIFA Highlights Teams-Only Title & Typography Suite", () => {
  const root = path.resolve(__dirname, "../..");
  const fifaJsPath = path.join(root, "webapp/fifa/fifa.js");
  const kinoCssPath = path.join(root, "webapp/kino/kino.css");
  const glassCssPath = path.join(root, "webapp/glass-theme.css");

  test("fifa.js defines extractHighlightTeamsOnly and extracts only team names from full match titles", () => {
    const fifaJs = fs.readFileSync(fifaJsPath, "utf8");

    assert.match(fifaJs, /function extractHighlightTeamsOnly\(title\)/);
    assert.match(fifaJs, /extractHighlightTeamsOnly\(t\)/);

    // Extract function to verify its behavior directly on test titles
    const fnMatch = fifaJs.match(/function extractHighlightTeamsOnly\(title\)\s*\{([\s\S]*?)\r?\n\s*\}\r?\n/);
    assert.ok(fnMatch, "extractHighlightTeamsOnly function found in fifa.js");

    const extractTeams = new Function("title", fnMatch[1]);

    // Test cases matching user screenshot
    assert.equal(
      extractTeams("Brugge — Lans. Chempionlar ligasi o'yin highlightslari. 21.10.2026"),
      "Brugge — Lans"
    );
    assert.equal(
      extractTeams("Sporting — LASK. Chempionlar ligasi o'yin highlightslari. 21.10.2026"),
      "Sporting — LASK"
    );
    assert.equal(
      extractTeams("Arsenal - Real Madrid | Обзор матча 21.10.2026"),
      "Arsenal — Real Madrid"
    );
    assert.equal(
      extractTeams("Barselona vs Bavariya. Chempionlar ligasi"),
      "Barselona — Bavariya"
    );
    assert.equal(
      extractTeams("Yuventus — Milan — Chempionlar ligasi"),
      "Yuventus — Milan"
    );
    assert.equal(
      extractTeams("Manchester Siti - Liverpul / Barcha gollar"),
      "Manchester Siti — Liverpul"
    );
  });

  test("kino.css and glass-theme.css style fifa-hl-card__title larger and bold (800)", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
    const glassCss = fs.readFileSync(glassCssPath, "utf8");

    for (const css of [kinoCss, glassCss]) {
      assert.match(css, /\.fifa-hl-card__title\s*\{[^}]*font-size:\s*14\.5px\s*!important/);
      assert.match(css, /\.fifa-hl-card__title\s*\{[^}]*font-weight:\s*800\s*!important/);
      assert.match(css, /\.fifa-all-hl-card__title\s*\{[^}]*font-weight:\s*800\s*!important/);
    }
  });
});
