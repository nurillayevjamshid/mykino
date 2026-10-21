const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

describe('Search Category Pills & Flaticon Icons Suite', () => {
  const kinoJsPath = path.join(rootDir, 'webapp', 'kino', 'kino.js');
  const kinoCssPath = path.join(rootDir, 'webapp', 'kino', 'kino.css');
  const glassCssPath = path.join(rootDir, 'webapp', 'glass-theme.css');
  const indexPath = path.join(rootDir, 'webapp', 'index.html');

  test('kino.js defines Flaticon SVGs and renders capsule pills with Barchasi default', () => {
    const js = fs.readFileSync(kinoJsPath, 'utf8');

    // Function definition
    assert.match(js, /function getCategoryFlaticonSvg\(name\)/);
    assert.match(js, /class="search-genre-chip__icon"/);

    // Flaticon SVGs for genres
    assert.match(js, /jangari|action|boevik/);
    assert.match(js, /komediya|comedy/);
    assert.match(js, /fantastika|sci-fi|fantasy/);
    assert.match(js, /ujas|horror|qorqincli/);
    assert.match(js, /multfilm|animation|kartun/);
    assert.match(js, /drama/);
    assert.match(js, /triller|thriller/);

    // Render chips with Flaticon icon and label
    assert.match(js, /const icon = getCategoryFlaticonSvg\(cat\.isAll \? "all" : cat\.label\);/);
    assert.match(js, /\${icon}<span>\${escapeHtml\(cat\.label\)}<\/span>/);

    // Barchasi included
    assert.match(js, /value:\s*"all"/);
  });

  test('index.html static search-genres markup uses Flaticon SVG icons and capsule structure', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.match(html, /id="searchGenresList"/);
    assert.match(html, /search-genre-chip is-active/);
    assert.match(html, /class="search-genre-chip__icon"/);
    assert.match(html, /data-category="Barchasi"/);
    assert.match(html, /data-genre="Jangari"/);
    assert.match(html, /data-genre="Komediya"/);
  });

  test('CSS styles define capsule pills, white active highlight, and horizontal scroll layout', () => {
    const kinoCss = fs.readFileSync(kinoCssPath, 'utf8');
    const glassCss = fs.readFileSync(glassCssPath, 'utf8');

    // Kino CSS
    assert.match(kinoCss, /\.search-genre-chip\s*\{[^}]*border-radius:\s*999px/);
    assert.match(kinoCss, /\.search-genre-chip\.is-active\s*\{[^}]*background:\s*#ffffff\s*!important/);
    assert.match(kinoCss, /\.search-genres__list\s*\{[^}]*overflow-x:\s*auto/);

    // Glass theme CSS
    assert.match(glassCss, /\.search-genre-chip\s*\{[^}]*border-radius:\s*999px/);
    assert.match(glassCss, /\.search-genre-chip\.is-active\s*\{[^}]*background:\s*#ffffff\s*!important/);
    assert.match(glassCss, /\.search-genres__list\s*\{[^}]*overflow-x:\s*auto/);
  });
});
