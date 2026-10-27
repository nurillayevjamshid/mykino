const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const indexPath = path.join(ROOT, "webapp/index.html");
const glassCssPath = path.join(ROOT, "webapp/glass-theme.css");
const kinoCssPath = path.join(ROOT, "webapp/kino/kino.css");
const kinoJsPath = path.join(ROOT, "webapp/kino/kino.js");

test("Movie Modal Full-Screen Poster & Floating White Card Reference Suite", async (t) => {
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const glassCss = fs.readFileSync(glassCssPath, "utf8");
  const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
  const kinoJs = fs.readFileSync(kinoJsPath, "utf8");

  await t.test("index.html matches full-bleed poster and floating white card layout", () => {
    assert.match(indexHtml, /class="modal-card-wrapper"/, "modal-card-wrapper wrapper present");
    assert.match(indexHtml, /class="modal-info-card"/, "modal-info-card present");
    assert.match(indexHtml, /id="modalShareButton"[\s\S]*?class="send-icon"/, "modalShareButton contains send-icon");
    assert.match(indexHtml, /id="watchActions"/, "watchActions present");
    assert.match(indexHtml, /id="watchButton"/, "watchButton present");
    assert.match(indexHtml, /id="commentsTrigger"/, "commentsTrigger present");
    assert.match(indexHtml, /data-i18n="leaveComment"/, "commentsTrigger labeled leaveComment (Fikr qoldirish)");
    // Verify scooped notch SVG is removed per user request
    assert.doesNotMatch(indexHtml, /modal-card-bottom-notch-wrap/, "no scooped notch SVG wrap");
    assert.doesNotMatch(indexHtml, /modal-card-bottom-notch/, "no scooped notch SVG element");
  });

  await t.test("essential modal IDs are preserved in index.html", () => {
    const requiredIds = [
      "movieModal",
      "movieModalGrabberZone",
      "modalPoster",
      "modalPosterZoomBadge",
      "modalShareButton",
      "modalTitle",
      "modalMeta",
      "modalRating",
      "modalDescription",
      "modalDescriptionWrap",
      "modalDescriptionToggle",
      "commentsTrigger",
      "watchButton",
      "watchResumeChip",
      "watchResumeBadge"
    ];
    for (const id of requiredIds) {
      assert.ok(
        indexHtml.includes(`id="${id}"`),
        `Expected element with id="${id}" to exist in index.html`
      );
    }
  });

  await t.test("glass-theme.css styles full-bleed poster, circular top controls and floating white card", () => {
    assert.match(glassCss, /\.movie-modal\s+\.modal-poster\s*\{[^}]*position:\s*absolute\s*!important;/, "poster fills absolute backdrop");
    assert.match(glassCss, /\.movie-modal\s+\.modal-poster\s*\{[^}]*height:\s*100%\s*!important;/, "poster takes full height");
    assert.match(glassCss, /\.movie-modal\s+\.modal-close,\s*\.movie-modal\s+\.modal-share\s*\{[^}]*border-radius:\s*50%\s*!important;/, "top buttons are circular");
    assert.match(glassCss, /\.movie-modal\s+\.modal-info-card\s*\{[^}]*background:\s*#ffffff\s*!important;/, "info card has solid white background");
    assert.match(glassCss, /\.movie-modal\s+\.modal-info-card\s*\{[^}]*border-radius:\s*28px\s*!important;/, "info card has 28px rounded corners");
    assert.match(glassCss, /\.watch-button\.watch-button--pill\s*\{[^}]*border-radius:\s*9999px\s*!important;/, "watch button is full pill");
    assert.match(glassCss, /\.movie-modal\s+\.comments-trigger\s*\{[^}]*border-radius:\s*9999px\s*!important;/, "comments button is pill styled");
    // Ensure scoop notch styles are removed
    assert.doesNotMatch(glassCss, /\.modal-card-bottom-notch\s*\{/, "no notch styles");
  });

  await t.test("poster card shows the whole poster and puts both actions on one row", () => {
    // Ablojka to'liq enda, lekin kesilmaydi: ustida contain, ostida qoraytirilgan cover.
    assert.match(glassCss, /#movieModal\.movie-modal--poster-card \.modal-poster \{[^}]*flex: 1 1 0 !important;[^}]*background-size: contain, cover, cover !important;/);
    assert.match(kinoJs, /`\$\{posterUrl\}, linear-gradient\(rgba\(10, 14, 22, 0\.6\), rgba\(10, 14, 22, 0\.6\)\), \$\{posterUrl\}`/);
    assert.match(glassCss, /\.watch-button--pill \{[^}]*background: #2563eb !important;[^}]*box-shadow: none !important;/);
    // Fikr chapda, Tomosha o'ngda — bitta qatorda.
    const row = indexHtml.match(/<div class="modal-action-row">([\s\S]*?)<\/button>\s*<\/div>\s*<\/div>/);
    assert.ok(row, "modal-action-row wraps both buttons");
    assert.ok(row[1].indexOf('id="commentsTrigger"') < row[1].indexOf('id="watchButton"'));
    assert.match(glassCss, /\.modal-action-row \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) !important;/);
    assert.match(glassCss, /#movieModal\.movie-modal--poster-card \.watch-button--pill \{[^}]*background: #2563eb !important;/);
  });

  await t.test("kino.js handles openMovie rating display and description toggle", () => {
    assert.match(kinoJs, /modalRating\.hidden\s*=\s*false;/, "modalRating is always shown in openMovie");
    assert.match(kinoJs, /modal-rating__stars/, "modal-rating renders star container");
    assert.match(kinoJs, /function setDescriptionExpanded/, "setDescriptionExpanded defined in kino.js");
    assert.match(kinoJs, /function syncDescriptionToggle/, "syncDescriptionToggle defined in kino.js");
    assert.match(kinoJs, /modalDescriptionWrap\.classList\.toggle\("is-expanded"/, "toggles expanded class on description wrap");
  });
});
