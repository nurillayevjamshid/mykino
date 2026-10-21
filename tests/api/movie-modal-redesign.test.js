const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const indexPath = path.join(ROOT, "webapp/index.html");
const glassCssPath = path.join(ROOT, "webapp/glass-theme.css");
const kinoCssPath = path.join(ROOT, "webapp/kino/kino.css");
const kinoJsPath = path.join(ROOT, "webapp/kino/kino.js");

test("Movie Modal Redesign Suite", async (t) => {
  const indexHtml = fs.readFileSync(indexPath, "utf8");
  const glassCss = fs.readFileSync(glassCssPath, "utf8");
  const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
  const kinoJs = fs.readFileSync(kinoJsPath, "utf8");

  await t.test("index.html contains the new floating card structure and scooped notch", () => {
    assert.match(indexHtml, /class="modal-card-wrapper"/, "modal-card-wrapper wrapper present");
    assert.match(indexHtml, /class="modal-card-dots"/, "3-dash pagination indicators present");
    assert.match(indexHtml, /class="modal-card-dot is-active"/, "active pagination dash present");
    assert.match(indexHtml, /class="modal-card-bottom-notch-wrap"/, "bottom notch SVG wrap present");
    assert.match(indexHtml, /class="modal-card-bottom-notch"/, "bottom notch SVG element present");
    assert.match(indexHtml, /path d="M 0,0 L 0,42/, "concave scoop cutout path present");
    assert.match(indexHtml, /id="watchActions"/, "watchActions present");
    assert.match(indexHtml, /id="watchButton"/, "watchButton present");
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

  await t.test("glass-theme.css styles the floating card, scooped notch and buttons", () => {
    assert.match(glassCss, /\.modal-card-wrapper\s*\{/, "modal-card-wrapper styled");
    assert.match(glassCss, /\.modal-card-dots\s*\{/, "modal-card-dots styled");
    assert.match(glassCss, /\.modal-card-dot\.is-active\s*\{/, "active dot styled");
    assert.match(glassCss, /\.modal-card-bottom-notch-wrap\s*\{/, "notch wrap styled");
    assert.match(glassCss, /\.modal-card-bottom-notch\s*\{/, "notch SVG styled");
    assert.match(glassCss, /html\[data-theme="light"\]\s+\.modal-card-bottom-notch\s*\{[^}]*fill:\s*#ffffff/, "light theme notch fill is #ffffff");
    assert.match(glassCss, /html\[data-theme="dark"\]\s+\.modal-card-bottom-notch\s*\{[^}]*fill:\s*#0b0f1a/, "dark theme notch fill is #0b0f1a");
  });

  await t.test("kino.js handles description toggle and maintains smooth modal interaction", () => {
    assert.match(kinoJs, /function setDescriptionExpanded/, "setDescriptionExpanded defined in kino.js");
    assert.match(kinoJs, /function syncDescriptionToggle/, "syncDescriptionToggle defined in kino.js");
    assert.match(kinoJs, /modalDescriptionWrap\.classList\.toggle\("is-expanded"/, "toggles expanded class on description wrap");
  });
});
