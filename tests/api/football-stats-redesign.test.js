const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Football Match Statistics & Uzbek Header/Modal Suite", () => {
  const root = path.join(__dirname, "../..");
  const categoriesJsPath = path.join(root, "api/categories.js");
  const fifaJsPath = path.join(root, "webapp/fifa/fifa.js");
  const kinoCssPath = path.join(root, "webapp/kino/kino.css");
  const glassCssPath = path.join(root, "webapp/glass-theme.css");

  test("api/categories.js defines extended match metrics in Uzbek including xG, shots off goal, blocked shots, and big chances", () => {
    const code = fs.readFileSync(categoriesJsPath, "utf8");

    assert.match(code, /label:\s*"To'p nazorati",\s*key:\s*"possession"/);
    assert.match(code, /label:\s*"Umumiy zarbalar",\s*key:\s*"shots"/);
    assert.match(code, /label:\s*"Aniq zarbalar",\s*key:\s*"shotsOnTarget"/);
    assert.match(code, /label:\s*"Burchak to'plari",\s*key:\s*"corners"/);
    assert.match(code, /label:\s*"Qoida buzilishi",\s*key:\s*"fouls"/);
    assert.match(code, /label:\s*"Kutilgan gollar \(xG\)",\s*key:\s*"xg"/);
    assert.match(code, /label:\s*"Noaniq zarbalar",\s*key:\s*"shotsOffTarget"/);
    assert.match(code, /label:\s*"To'silgan zarbalar",\s*key:\s*"blockedShots"/);
    assert.match(code, /label:\s*"Xavfli vaziyatlar",\s*key:\s*"bigChances"/);
    assert.match(code, /label:\s*"Sariq kartochkalar",\s*key:\s*"yellowCards"/);
    assert.match(code, /label:\s*"Qizil kartochkalar",\s*key:\s*"redCards"/);
    assert.match(code, /label:\s*"Ofsaydlar",\s*key:\s*"offsides"/);
    assert.match(code, /label:\s*"Darvozabon seyvlari",\s*key:\s*"saves"/);
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

  test("fifa.js renders 3 Uzbek tabs (Voqealar, Statistika, Tarkiblar) and removes Commentary/Odds", () => {
    const code = fs.readFileSync(fifaJsPath, "utf8");

    // Uzbek tabs
    assert.match(code, /data-fifa-modal-tab="timeline"[^>]*>[\s\S]*?Voqealar/);
    assert.match(code, /data-fifa-modal-tab="stats"[^>]*>[\s\S]*?Statistika/);
    assert.match(code, /data-fifa-modal-tab="lineups"[^>]*>[\s\S]*?Tarkiblar/);

    // Removed tabs: commentary and odds must not exist in modal tabs
    assert.doesNotMatch(code, /data-fifa-modal-tab="commentary"/);
    assert.doesNotMatch(code, /data-fifa-modal-tab="odds"/);
    assert.doesNotMatch(code, /id="fifaModalTabCommentary"/);
    assert.doesNotMatch(code, /id="fifaModalTabOdds"/);

    // Default tab
    assert.match(code, /defaultTab = activeModalTab \|\| "stats"/);

    // Uzbek Period buttons
    assert.match(code, /data-fifa-period="match"[^>]*>BUTUN O'YIN/);
    assert.match(code, /data-fifa-period="1st"[^>]*>1-TAYM/);
    assert.match(code, /data-fifa-period="2nd"[^>]*>2-TAYM/);
    assert.match(code, /data-fifa-period="extra"[^>]*>QO'SHIMCHA VAQT/);

    // Pitch title in Uzbek
    assert.match(code, /ASOSIY TARKIB/);
  });

  test("fifa.js generates 8 core statistics rows in Uzbek matching dual-bar tracks", () => {
    const code = fs.readFileSync(fifaJsPath, "utf8");

    // Core 8 metrics labels in Uzbek
    assert.match(code, /Kutilgan gollar \(xG\)/);
    assert.match(code, /To'p nazorati/);
    assert.match(code, /Umumiy zarbalar/);
    assert.match(code, /Aniq zarbalar/);
    assert.match(code, /Noaniq zarbalar/);
    assert.match(code, /To'silgan zarbalar/);
    assert.match(code, /Xavfli vaziyatlar/);
    assert.match(code, /Burchak to'plari/);

    // Dual-bar tracks and fills
    assert.match(code, /fifa-stat-track--home/);
    assert.match(code, /fifa-stat-track--away/);
    assert.match(code, /fifa-stat-fill--home/);
    assert.match(code, /fifa-stat-fill--away/);
    assert.match(code, /fifa-stat-val--home/);
    assert.match(code, /fifa-stat-val--away/);
    assert.match(code, /fifa-stat-label/);
  });

  test("kino.css and glass-theme.css style black bottom-bar labels in light mode and white in dark mode", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
    const glassCss = fs.readFileSync(glassCssPath, "utf8");

    [kinoCss, glassCss].forEach((css) => {
      // Dark mode bottom-bar labels: white
      assert.match(css, /\.bottom-bar\s*\.bottom-bar__label[^}]*color:\s*#ffffff\s*!important/);

      // Light mode bottom-bar labels: black
      assert.match(css, /html\[data-theme="light"\]\s*\.bottom-bar\s*\.bottom-bar__label[^}]*color:\s*#000000\s*!important/);

      // Light mode circle star favorite icon: dark/black
      assert.match(css, /html\[data-theme="light"\]\s*\.fifa-team-fav-btn--corner[^}]*color:\s*#0f172a\s*!important/);
      assert.match(css, /html\[data-theme="light"\]\s*\.fifa-team-fav-btn--corner[^}]*stroke:\s*#0f172a\s*!important/);
    });
  });
});
