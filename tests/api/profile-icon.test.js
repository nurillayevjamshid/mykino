const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Unified Profile Icon Suite', () => {
  const root = path.resolve(__dirname, '../..');
  const headCircleRegex = /circle\s+cx="12"\s+cy="7"\s+r="4"/;
  const bodyStadiumRegex = /rect\s+x="4\.5"\s+y="14"\s+width="15"\s+height="7"\s+rx="3\.5"/;

  test('webapp/index.html uses new profile icon in sidebarLowerItem2', () => {
    const html = fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8');
    assert.match(html, /id="sidebarLowerItem2"[\s\S]*?class="profile-icon/);
    assert.match(html, headCircleRegex);
    assert.match(html, bodyStadiumRegex);
  });

  test('webapp/kino/kino.js sets the new profile icon for all section states', () => {
    const js = fs.readFileSync(path.join(root, 'webapp/kino/kino.js'), 'utf8');
    // Ensure all 3 slots (music-profile, podcast-profile, profile) use the new stadium body
    const matches = js.match(/rect\s+x="4\.5"\s+y="14"\s+width="15"\s+height="7"\s+rx="3\.5"/g) || [];
    assert.equal(matches.length, 3, 'All 3 section profile slots must use the new profile icon');
  });

  test('books, beta, and music modules use the new profile icon', () => {
    const books = fs.readFileSync(path.join(root, 'webapp/books/index.html'), 'utf8');
    const beta = fs.readFileSync(path.join(root, 'webapp/beta/index.html'), 'utf8');
    const music = fs.readFileSync(path.join(root, 'webapp/music/music.js'), 'utf8');

    for (const content of [books, beta, music]) {
      assert.match(content, headCircleRegex);
      assert.match(content, bodyStadiumRegex);
    }
  });

  test('kino.css and glass-theme.css style .profile-icon with stroke rules', () => {
    const kinoCss = fs.readFileSync(path.join(root, 'webapp/kino/kino.css'), 'utf8');
    const glassCss = fs.readFileSync(path.join(root, 'webapp/glass-theme.css'), 'utf8');

    for (const css of [kinoCss, glassCss]) {
      assert.match(css, /\.profile-icon[\s\S]*?fill:\s*none\s*!important/i);
      assert.match(css, /\.profile-icon[\s\S]*?stroke:\s*currentColor\s*!important/i);
    }
  });
});
