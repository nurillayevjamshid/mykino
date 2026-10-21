const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Floating Mini-Screen Card Layout Suite', () => {
  const root = path.resolve(__dirname, '../..');
  const kinoCssPath = path.join(root, 'webapp/kino/kino.css');
  const glassCssPath = path.join(root, 'webapp/glass-theme.css');
  const indexHtmlPath = path.join(root, 'webapp/index.html');
  const kinoJsPath = path.join(root, 'webapp/kino/kino.js');

  test('kino.css defines wide full-width capsule card with 545/256 aspect ratio and 26px border radius', () => {
    const css = fs.readFileSync(kinoCssPath, 'utf8');
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*aspect-ratio:\s*545\s*\/\s*256/i);
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*border-radius:\s*26px/i);
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*left:\s*12px/i);
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*right:\s*12px/i);
    assert.match(css, /\.video-player\.is-mini-screen\s*\.video-mount\s*\{[^}]*border-radius:\s*26px/i);
  });

  test('glass-theme.css enforces mini-screen full-width card proportions and controls', () => {
    const css = fs.readFileSync(glassCssPath, 'utf8');
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*aspect-ratio:\s*545\s*\/\s*256/i);
    assert.match(css, /\.video-player\.is-mini-screen\s*\{[^}]*border-radius:\s*26px/i);
    assert.match(css, /\.player-mini-btn\s*\{[^}]*border-radius:\s*50%/i);
  });

  test('index.html contains full mini controls with badge, title, expand, toggle and close buttons', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(html, /id="playerMiniControls"/);
    assert.match(html, /id="playerMiniBadge"/);
    assert.match(html, /id="playerMiniTitle"/);
    assert.match(html, /id="playerMiniExpand"/);
    assert.match(html, /id="playerMiniToggle"/);
    assert.match(html, /id="playerMiniClose"/);
  });

  test('kino.js updates mini player badge and title and supports meta expand', () => {
    const js = fs.readFileSync(kinoJsPath, 'utf8');
    assert.match(js, /miniBadge\.textContent\s*=\s*activeMovie\._podcast/);
    assert.match(js, /playerMiniTitle/);
    assert.match(js, /player-mini-meta/);
  });
});
