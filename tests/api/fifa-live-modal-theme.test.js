const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("FIFA Live Match Modal Dark Mode & High Contrast Suite", () => {
  const kinoCssPath = path.join(__dirname, "../../webapp/kino/kino.css");
  const glassCssPath = path.join(__dirname, "../../webapp/glass-theme.css");

  test("kino.css defines solid non-transparent background (#0d1117) for fifa-lineup-modal__sheet", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");

    // Modal sheet must NOT use transparent var(--surface-1)
    assert.doesNotMatch(kinoCss, /\.fifa-lineup-modal__sheet\s*\{[^}]*background:\s*var\(--surface-1/);

    // Modal sheet must use solid #0d1117 !important
    assert.match(kinoCss, /\.fifa-lineup-modal__sheet\s*\{[^}]*background:\s*#0d1117\s*!important/);

    // Modal sheet border and backdrop contrast
    assert.match(kinoCss, /\.fifa-lineup-modal__backdrop\s*\{[^}]*rgba\(0,\s*0,\s*0,\s*0\.78\)/);
  });

  test("glass-theme.css enforces solid background and disables backdrop-filter for fifa modal sheet", () => {
    const glassCss = fs.readFileSync(glassCssPath, "utf8");

    // Must have explicit solid dark mode override
    assert.match(glassCss, /\.fifa-lineup-modal__sheet[^}]*background:\s*#0d1117\s*!important/);
    assert.match(glassCss, /\.fifa-lineup-modal__sheet[^}]*backdrop-filter:\s*none\s*!important/);

    // Light mode override
    assert.match(glassCss, /html\[data-theme="light"\]\s*\.fifa-lineup-modal__sheet[^}]*background:\s*#ffffff\s*!important/);
  });

  test("event timeline, minute scrubber and statistics have high contrast styling in dark mode", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");

    // Timeline scrubber track & fill classes (matches fifa.js)
    assert.match(kinoCss, /\.fifa-timeline-scrubber__track/);
    assert.match(kinoCss, /\.fifa-timeline-scrubber__fill/);
    assert.match(kinoCss, /\.fifa-scrubber-cursor/);

    // Timeline event card and row items
    assert.match(kinoCss, /\.fifa-tl-item-content\s*\{[^}]*background:\s*#141924/);
    assert.match(kinoCss, /\.fifa-tl-badge\.fifa-tl-icon--goal/);
    assert.match(kinoCss, /\.fifa-tl-badge\.fifa-tl-icon--yellow/);
    assert.match(kinoCss, /\.fifa-tl-badge\.fifa-tl-icon--red/);
    assert.match(kinoCss, /\.fifa-tl-badge\.fifa-tl-icon--sub/);

    // Statistics card & rows
    assert.match(kinoCss, /\.fifa-stats-card\s*\{[^}]*background:\s*#131823/);
    assert.match(kinoCss, /\.fifa-stat-row\s*\{[^}]*background:\s*#181e2b/);
    assert.match(kinoCss, /\.fifa-stat-bar/);
    assert.match(kinoCss, /\.fifa-stat-bar__home/);
    assert.match(kinoCss, /\.fifa-stat-bar__away/);
  });

  test("light theme preserves pristine bright contrast and readability", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");

    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-lineup-modal__sheet\s*\{[^}]*background:\s*#ffffff\s*!important/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-stats-card\s*\{[^}]*background:\s*#f8fafc/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-stat-row\s*\{[^}]*background:\s*#ffffff/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-tl-item-content\s*\{[^}]*background:\s*#f8fafc/);
  });

  test("fifa elements enforce high-contrast text and cards in both dark and light modes", () => {
    const kinoCss = fs.readFileSync(kinoCssPath, "utf8");
    const glassCss = fs.readFileSync(glassCssPath, "utf8");
    const fifaJs = fs.readFileSync(path.join(__dirname, "../../webapp/fifa/fifa.js"), "utf8");

    // No hardcoded white text on light backgrounds via inline styles in fifa.js
    assert.doesNotMatch(fifaJs, /style="[^"]*color:\s*var\(--c-text/);
    assert.doesNotMatch(fifaJs, /style="[^"]*color:\s*var\(--text-muted/);

    // Dark mode contrast
    assert.match(kinoCss, /\.fifa-match__name\s*\{[^}]*color:\s*#ffffff/);
    assert.match(kinoCss, /\.fifa-match-league\s*\{[^}]*background:\s*#111522/);
    assert.match(kinoCss, /\.fifa-standings-card\s*\{[^}]*background:\s*#111522/);
    assert.match(kinoCss, /\.fifa-next-match-card\s*\{[^}]*color:\s*#ffffff/);

    // Light mode explicit contrast
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-match\s*\{[^}]*background:\s*#ffffff/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-match__name\s*\{[^}]*color:\s*#0f172a/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-match-league__copy strong\s*\{[^}]*color:\s*#0f172a/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-standings-card__head strong\s*\{[^}]*color:\s*#0f172a/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-next-team__name\s*\{[^}]*color:\s*#0f172a/);
    assert.match(kinoCss, /html\[data-theme="light"\]\s*\.fifa-favorites-heading\s*\{[^}]*color:\s*#0f172a/);

    // Glass theme protects football elements from becoming unreadable
    assert.match(glassCss, /html\[data-theme="light"\]\s*\.fifa-match__name[^}]*color:\s*#0f172a\s*!important/);
    assert.match(glassCss, /html\[data-theme="light"\]\s*\.fifa-match-league__copy strong[^}]*color:\s*#0f172a\s*!important/);
    assert.match(glassCss, /html\[data-theme="light"\]\s*\.fifa-next-team__name[^}]*color:\s*#0f172a\s*!important/);
  });
});
