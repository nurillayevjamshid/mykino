const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Football Match Statistics & Sofascore Header Redesign Suite", () => {
  const root = path.join(__dirname, "../..");
  const categoriesJsPath = path.join(root, "api/categories.js");
  const fifaJsPath = path.join(root, "webapp/fifa/fifa.js");
  const kinoCssPath = path.join(root, "webapp/kino/kino.css");
  const glassCssPath = path.join(root, "webapp/glass-theme.css");

  test("api/categories.js defines extended match metrics including xG, shots off goal, blocked shots, and big chances", () => {
    const code = fs.readFileSync(categoriesJsPath, "utf8");

    assert.match(code, /key:\s*"xg"/);
    assert.match(code, /key:\s*"shotsOffTarget"/);
    assert.match(code, /key:\s*"blockedShots"/);
    assert.match(code, /key:\s*"bigChances"/);
    assert.match(code, /key:\s*"possession"/);
    assert.match(code, /key:\s*"shots"/);
    assert.match(code, /key:\s*"shotsOnTarget"/);
    assert.match(code, /key:\s*"corners"/);
    assert.match(code, /key:\s*"fouls"/);
  });

  test("fifa.js renders modern match header with datetime, squircle crest cards, red score, and favorite stars", () => {
    const code = fs.readFileSync(fifaJsPath, "utf8");

    // Header layout
    assert.match(code, /class="fifa-lineup-match-header"/);
    assert.match(code, /class="fifa-lineup-datetime"/);
    assert.match(code, /class="fifa-lineup-team__crest-card"/);
    assert.match(code, /class="fifa-lineup-team__name"/);
    assert.match(code, /class="fifa-lineup-score"/);
    assert.match(code, /class="fifa-lineup-status"/);

    // Star buttons on both sides
    assert.match(code, /fifa-lineup-star-btn/);
    assert.match(code, /favBtn\("left"\)/);
    assert.match(code, /favBtn\("right"\)/);

    // Crucial constraint: NO start audio commentary button
    assert.doesNotMatch(code, /START AUDIO COMMENTARY/i);
    assert.doesNotMatch(code, /start-audio-commentary/i);
  });

  test("fifa.js renders navigation tabs with default tab as STATS and period filter buttons", () => {
    const code = fs.readFileSync(fifaJsPath, "utf8");

    // Tabs
    assert.match(code, /data-fifa-modal-tab="timeline"[^>]*>\s*SUMMARY/);
    assert.match(code, /data-fifa-modal-tab="stats"[^>]*>\s*STATS/);
    assert.match(code, /data-fifa-modal-tab="lineups"[^>]*>\s*LINEUPS/);
    assert.match(code, /data-fifa-modal-tab="commentary"[^>]*>\s*COMMENTARY/);
    assert.match(code, /data-fifa-modal-tab="odds"[^>]*>\s*ODDS/);

    // Default tab
    assert.match(code, /defaultTab = activeModalTab \|\| "stats"/);

    // Period buttons
    assert.match(code, /data-fifa-period="match"/);
    assert.match(code, /data-fifa-period="1st"/);
    assert.match(code, /data-fifa-period="2nd"/);
    assert.match(code, /data-fifa-period="extra"/);

    // Period filter handlers
    assert.match(code, /activeStatsPeriod = btn\.dataset\.fifaPeriod/);
  });

  test("fifa.js generates 8 core statistics rows matching Sofascore reference order and dual-bar tracks", () => {
    const code = fs.readFileSync(fifaJsPath, "utf8");

    // Core 8 metrics labels
    assert.match(code, /Expected Goals \(xG\)/);
    assert.match(code, /Ball possession/);
    assert.match(code, /Goal attempts/);
    assert.match(code, /Shots on goal/);
    assert.match(code, /Shots off goal/);
    assert.match(code, /Blocked Shots/);
    assert.match(code, /Big chances/);
    assert.match(code, /Corner kicks/);

    // Dual-bar tracks and fills
    assert.match(code, /fifa-stat-track--home/);
    assert.match(code, /fifa-stat-track--away/);
    assert.match(code, /fifa-stat-fill--home/);
    assert.match(code, /fifa-stat-fill--away/);
    assert.match(code, /fifa-stat-val--home/);
    assert.match(code, /fifa-stat-val--away/);
    assert.match(code, /fifa-stat-label/);
  });

  test("kino.css and glass-theme.css style squircle cards, red score, tabs, and center-anchored dual bars", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
    const glassCss = fs.readFileSync(glassCssPath, "utf8");

    [kinoCss, glassCss].forEach((css) => {
      // Crest card with white background and 14px radius
      assert.match(css, /\.fifa-lineup-team__crest-card\s*\{[^}]*background:\s*#ffffff\s*!important/);
      assert.match(css, /\.fifa-lineup-team__crest-card\s*\{[^}]*border-radius:\s*14px\s*!important/);

      // Crimson red score & status
      assert.match(css, /\.fifa-lineup-score\s*\{[^}]*color:\s*#f43f5e\s*!important/);
      assert.match(css, /\.fifa-lineup-status\s*\{[^}]*color:\s*#f43f5e\s*!important/);

      // Period active button
      assert.match(css, /\.fifa-stats-period-btn\.is-active\s*\{[^}]*background:\s*#e11d48\s*!important/);

      // Center-anchored dual tracks
      assert.match(css, /\.fifa-stat-track--home\s*\{[^}]*justify-content:\s*flex-end\s*!important/);
      assert.match(css, /\.fifa-stat-track--away\s*\{[^}]*justify-content:\s*flex-start\s*!important/);

      // Home white fill & Away crimson red fill
      assert.match(css, /\.fifa-stat-fill--home[^}]*background:\s*#ffffff\s*!important/);
      assert.match(css, /\.fifa-stat-fill--away[^}]*background:\s*#e11d48\s*!important/);
    });
  });
});
