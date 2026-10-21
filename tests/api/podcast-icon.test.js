const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Podcast Microphone Icon Suite', () => {
  const root = path.resolve(__dirname, '../..');

  test('kino.js defines the new podcast icon with inner audio indicators in all slots', () => {
    const js = fs.readFileSync(path.join(root, 'webapp/kino/kino.js'), 'utf8');
    assert.match(js, /rect\s+x="8"\s+y="2"\s+width="8"\s+height="12"\s+rx="4"/);
    assert.match(js, /circle\s+cx="12"\s+cy="5\.2"\s+r="0\.9"/);
    assert.match(js, /path\s+d="M10\.2\s+8h3\.6"/);
    assert.match(js, /circle\s+cx="12"\s+cy="10\.8"\s+r="0\.9"/);
    assert.match(js, /path\s+d="M5\s+10v1\.5a7\s+7\s+0\s+0\s+0\s+14\s+0V10"/);
    assert.match(js, /line\s+x1="12"\s+y1="18\.5"\s+x2="12"\s+y2="22"/);
  });

  test('index.html uses new podcast icon in section splash and sidebar', () => {
    const html = fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8');
    assert.match(html, /id="sidebarPodcastsItem"[\s\S]*?rect\s+x="8"\s+y="2"/);
    assert.match(html, /podcasts:\s*'<svg[^>]*class="[^"]*podcast-icon/);
  });

  test('books, news, and admin use the new podcast icon', () => {
    const booksJs = fs.readFileSync(path.join(root, 'webapp/books/books.js'), 'utf8');
    const booksHtml = fs.readFileSync(path.join(root, 'webapp/books/index.html'), 'utf8');
    const adminHtml = fs.readFileSync(path.join(root, 'webapp/admin/index.html'), 'utf8');
    const newsHtml = fs.readFileSync(path.join(root, 'webapp/news/index.html'), 'utf8');

    for (const content of [booksJs, booksHtml, adminHtml, newsHtml]) {
      assert.match(content, /rect\s+x="8"\s+y="2"\s+width="8"\s+height="12"\s+rx="4"/);
      assert.match(content, /circle\s+cx="12"\s+cy="5\.2"/);
    }
  });

  test('kino.css and glass-theme.css style podcast circles with currentColor and no stroke', () => {
    const kinoCss = fs.readFileSync(path.join(root, 'webapp/kino/kino.css'), 'utf8');
    const glassCss = fs.readFileSync(path.join(root, 'webapp/glass-theme.css'), 'utf8');

    for (const css of [kinoCss, glassCss]) {
      assert.match(css, /\.podcast-icon\s+circle[\s\S]*?fill:\s*currentColor\s*!important/i);
      assert.match(css, /\.podcast-icon\s+circle[\s\S]*?stroke:\s*none\s*!important/i);
    }
  });
});
