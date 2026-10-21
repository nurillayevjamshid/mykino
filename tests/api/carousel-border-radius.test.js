const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Carousel Cards Border Radius Suite', () => {
  const root = path.resolve(__dirname, '../..');
  const kinoCssPath = path.join(root, 'webapp/kino/kino.css');
  const musicCssPath = path.join(root, 'webapp/music/music.css');
  const potcastsCssPath = path.join(root, 'webapp/potcasts/potcasts.css');
  const glassCssPath = path.join(root, 'webapp/glass-theme.css');

  test('kino.css sets hero carousel border-radius to 30px', () => {
    const css = fs.readFileSync(kinoCssPath, 'utf8');
    assert.match(css, /#heroSection\.hero\s*\{[^}]*border-radius:\s*30px\s*!important/i);
    assert.match(css, /\.hero-carousel\s*\{[^}]*border-radius:\s*30px\s*!important/i);
  });

  test('music.css sets music carousel track border-radius to 30px', () => {
    const css = fs.readFileSync(musicCssPath, 'utf8');
    assert.match(css, /\.music-carousel__track\s*\{[^}]*border-radius:\s*30px\s*!important/i);
  });

  test('potcasts.css sets pod-hero-kino carousel border-radius to 30px', () => {
    const css = fs.readFileSync(potcastsCssPath, 'utf8');
    assert.match(css, /\.pod-hero-kino\s*\{[^}]*border-radius:\s*30px\s*!important/i);
  });

  test('glass-theme.css guarantees 30px border-radius for all carousel cards', () => {
    const css = fs.readFileSync(glassCssPath, 'utf8');
    assert.match(css, /#heroSection\.hero/);
    assert.match(css, /\.music-carousel__track/);
    assert.match(css, /\.pod-hero-kino/);
    assert.match(css, /border-radius:\s*30px\s*!important/);
  });
});
