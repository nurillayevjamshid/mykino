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

  test('kino.js defines the video camera icon in ITEMS.kino for section switching', () => {
    const js = fs.readFileSync(kinoJsPath, 'utf8');
    assert.match(js, /kino-icon\s+sidebar__item-icon--kino/);
    assert.match(js, /<rect[^>]+rx="3\.8"[^>]*><\/rect>/);
    assert.match(js, /<path[^>]+d="M16\.5\s+9\.8/);
  });

  test('index.html uses ntv-logo-svg and ensures NO icon before NTV in sidebar brand', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    // Sidebar brand must NOT have kino-icon or camera icon before NTV
    const sidebarBrandMatch = html.match(/<div[^>]+class="[^"]*sidebar__brand[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(sidebarBrandMatch, 'sidebar__brand element found');
    assert.doesNotMatch(sidebarBrandMatch[1], /kino-icon/);
    // Sidebar brand must have the new NTV logo SVG
    assert.match(html, /sidebar__brand[\s\S]*?class="[^"]*sidebar-ntv-logo/);
    // Section splash uses ntv-logo-svg
    assert.match(html, /section-splash__brand[\s\S]*?ntv-logo-svg/);
  });

  test('topbarSectionBrand in kino section renders kino-icon before NTV logo in topbar', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const js = fs.readFileSync(kinoJsPath, 'utf8');
    // Topbar brand has topbarSectionIcon with kino-icon
    assert.match(html, /id="topbarSectionIcon"[^>]*>[\s\S]*?class="[^"]*kino-icon/);
    // syncTopbarSection defines kino-icon for kino section
    assert.match(js, /kino:\s*`<svg[^>]+class="[^"]*kino-icon/);
  });

  test('ntv-logo-svg is styled pure black in light mode and pure white in dark mode', () => {
    const kinoCss = fs.readFileSync(kinoCssPath, 'utf8');
    const glassCss = fs.readFileSync(glassCssPath, 'utf8');

    for (const css of [kinoCss, glassCss]) {
      // Dark mode: pure white (#ffffff)
      assert.match(css, /\.ntv-logo-svg[\s\S]*?color:\s*#ffffff\s*!important/i);
      // Light mode: pure black (#000000)
      assert.match(css, /html\[data-theme="light"\][\s\S]*?\.ntv-logo-svg[\s\S]*?color:\s*#000000\s*!important/i);
      // Sidebar brand has no icon rule
      assert.match(css, /\.sidebar__brand\s+\.brand-logo[\s\S]*?display:\s*none\s*!important/i);
    }
  });
});
