const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Kino Video Camera Icon Suite', () => {
  const root = path.resolve(__dirname, '../..');
  const kinoJsPath = path.join(root, 'webapp/kino/kino.js');
  const indexHtmlPath = path.join(root, 'webapp/index.html');
  const kinoCssPath = path.join(root, 'webapp/kino/kino.css');
  const glassCssPath = path.join(root, 'webapp/glass-theme.css');

  test('kino.js defines the video camera icon in ITEMS.kino, icons.kino, and SECTION_SPLASH_ICONS', () => {
    const js = fs.readFileSync(kinoJsPath, 'utf8');
    assert.match(js, /kino-icon\s+sidebar__item-icon--kino/);
    assert.match(js, /<rect[^>]+rx="3\.8"[^>]*><\/rect>/);
    assert.match(js, /<path[^>]+d="M16\.5\s+9\.8/);
  });

  test('index.html uses video camera icon in section splash and sidebar brand', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(html, /id="sectionSplashLogo"[^>]*>[\s\S]*?<svg[^>]+class="[^"]*kino-icon/);
    assert.match(html, /sidebar__brand[\s\S]*?<svg[^>]+class="[^"]*kino-icon/);
    assert.match(html, /kino:\s*'<svg[^>]+class="[^"]*kino-icon/);
  });

  test('kino.css and glass-theme.css style kino-icon white in dark mode and black in light mode', () => {
    const kinoCss = fs.readFileSync(kinoCssPath, 'utf8');
    const glassCss = fs.readFileSync(glassCssPath, 'utf8');

    for (const css of [kinoCss, glassCss]) {
      assert.match(css, /\.kino-icon[\s\S]*?color:\s*#ffffff\s*!important/i);
      assert.match(css, /\.kino-icon[\s\S]*?fill:\s*#ffffff\s*!important/i);
      assert.match(css, /html\[data-theme="light"\]\s+\.kino-icon[\s\S]*?color:\s*#000000\s*!important/i);
      assert.match(css, /html\[data-theme="light"\]\s+\.kino-icon[\s\S]*?fill:\s*#000000\s*!important/i);
    }
  });
});
