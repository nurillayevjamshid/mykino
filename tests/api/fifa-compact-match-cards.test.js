const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const kinoCssPath = path.join(ROOT, "webapp/kino/kino.css");
const glassCssPath = path.join(ROOT, "webapp/glass-theme.css");
const fifaJsPath = path.join(ROOT, "webapp/fifa/fifa.js");

test("FIFA Compact Match Cards & League Section Theme Suite", async (t) => {
  const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
  const glassCss = fs.readFileSync(glassCssPath, "utf8");
  const fifaJs = fs.readFileSync(fifaJsPath, "utf8");

  await t.test("kino.css & glass-theme.css define compact padding and margins for .fifa-match", () => {
    assert.match(kinoCss, /\.fifa-match\s*\{[^}]*padding:\s*9px\s+12px\s+10px\s*!important;/);
    assert.match(glassCss, /\.fifa-match[^}]*padding:\s*9px\s+12px\s+10px\s*!important;/);
    assert.match(kinoCss, /\.fifa-match\s*\{[^}]*margin-bottom:\s*8px\s*!important;/);
  });

  await t.test("team logo wraps and scores are sleek and compact", () => {
    // 38px logo wrap instead of bulky 52px
    assert.match(kinoCss, /\.fifa-card-team__logo-wrap\s*\{[^}]*width:\s*38px;/);
    assert.match(kinoCss, /\.fifa-card-team__logo-wrap\s*\{[^}]*height:\s*38px;/);
    assert.match(glassCss, /\.fifa-card-team__logo-wrap\s*\{[^}]*width:\s*38px;/);

    // 21px score instead of 30px
    assert.match(kinoCss, /\.fifa-card-score\s*\{[^}]*font-size:\s*21px;/);
    assert.match(glassCss, /\.fifa-card-score\s*\{[^}]*font-size:\s*21px;/);
  });

  await t.test("redundant competition label is hidden inside league list to save vertical space", () => {
    assert.match(kinoCss, /\.fifa-match-league\s+\.fifa-card-competition\s*\{[^}]*display:\s*none\s*!important;/);
    assert.match(glassCss, /\.fifa-match-league\s+\.fifa-card-competition\s*\{[^}]*display:\s*none\s*!important;/);
  });

  await t.test("fifa-next-match-card has compact padding and sleek footer", () => {
    assert.match(kinoCss, /\.fifa-next-match-card\s*\{[^}]*padding:\s*12px\s+14px;/);
    assert.match(glassCss, /\.fifa-next-match-card[^}]*padding:\s*12px\s+14px\s*!important;/);
    assert.match(fifaJs, /class="fifa-next-match-card__footer"[^>]*margin-top:\s*8px;/);
  });

  await t.test("fifa-match-league has transparent outer container so match cards stand out cleanly without duplicate background", () => {
    // Outer league container must be transparent in dark and light mode
    assert.match(glassCss, /\.fifa-match-league[^}]*background:\s*transparent\s*!important;/);
    assert.match(glassCss, /html\[data-theme="light"\]\s+\.fifa-match-league\s*\{[^}]*background:\s*transparent\s*!important;/);

    // League header has dedicated pill styling
    assert.match(glassCss, /\.fifa-match-league__head[^}]*display:\s*flex\s*!important;/);
    assert.match(glassCss, /html\[data-theme="light"\]\s+\.fifa-match-league__head\s*\{[^}]*background:\s*#f1f5f9\s*!important;/);
  });
});
