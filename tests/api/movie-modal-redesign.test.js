const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const indexPath = path.join(ROOT, "webapp/index.html");
const glassCssPath = path.join(ROOT, "webapp/glass-theme.css");
const kinoCssPath = path.join(ROOT, "webapp/kino/kino.css");
const kinoJsPath = path.join(ROOT, "webapp/kino/kino.js");

test("Movie Modal Modern Design Reference Suite", async (t) => {
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const glassCss = fs.readFileSync(glassCssPath, "utf8");
  const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
  const kinoJs = fs.readFileSync(kinoJsPath, "utf8");

  await t.test("index.html matches modern rounded poster and pill button design", () => {
    assert.match(indexHtml, /class="modal-card-wrapper"/, "modal-card-wrapper wrapper present");
    assert.match(indexHtml, /class="modal-card-dots"/, "pagination indicators present");
    assert.match(indexHtml, /class="modal-card-dot is-active"/, "active pagination dot present");
    assert.match(indexHtml, /id="watchActions"/, "watchActions present");
    assert.match(indexHtml, /id="watchButton"/, "watchButton present");
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

  await t.test("glass-theme.css styles rounded poster, pagination dots and high-contrast pill button", () => {
    assert.match(glassCss, /\.movie-modal\s+\.modal-poster\s*\{[^}]*border-radius:\s*36px\s+36px\s+38px\s+38px/, "poster card has rounded bottom corners");
    assert.match(glassCss, /\.modal-card-dots\s*\{/, "modal-card-dots styled");
    assert.match(glassCss, /\.modal-card-dot\s*\{[^}]*border-radius:\s*50%/, "inactive dots are circular");
    assert.match(glassCss, /\.modal-card-dot\.is-active\s*\{[^}]*border-radius:\s*9999px/, "active dot is capsule");
    assert.match(glassCss, /\.watch-button\.watch-button--pill\s*\{[^}]*border-radius:\s*9999px\s*!important;/, "watch button is full pill");
    assert.match(glassCss, /html\[data-theme="dark"\]\s+\.movie-modal\s+\.watch-button\.watch-button--pill[^}]*background:\s*#ffffff\s*!important;[^}]*color:\s*#0b111e\s*!important;/, "dark mode watch button is solid white with dark text");
    assert.match(glassCss, /html\[data-theme="light"\]\s+\.movie-modal\s+\.watch-button\.watch-button--pill\s*\{[^}]*background:\s*#0f172a\s*!important;[^}]*color:\s*#ffffff\s*!important;/, "light mode watch button is solid dark slate with white text");
    // Ensure scoop notch styles are removed
    assert.doesNotMatch(glassCss, /\.modal-card-bottom-notch\s*\{/, "no notch styles");
  });

  await t.test("kino.js handles description toggle and maintains smooth modal interaction", () => {
    assert.match(kinoJs, /function setDescriptionExpanded/, "setDescriptionExpanded defined in kino.js");
    assert.match(kinoJs, /function syncDescriptionToggle/, "syncDescriptionToggle defined in kino.js");
    assert.match(kinoJs, /modalDescriptionWrap\.classList\.toggle\("is-expanded"/, "toggles expanded class on description wrap");
  });
});
