const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

describe('News Section Archived & Inaccessibility Suite', () => {
  test('webapp/index.html hides news sidebar button completely', () => {
    const html = fs.readFileSync(path.join(rootDir, 'webapp', 'index.html'), 'utf8');
    assert.match(html, /id="sidebarNewsItem"[^>]*hidden/, '#sidebarNewsItem must have hidden attribute');
    assert.match(html, /id="sidebarNewsItem"[^>]*style="display:\s*none\s*!important;"/, '#sidebarNewsItem must have inline display: none !important');
    assert.match(html, /id="sidebarNewsItem"[^>]*aria-hidden="true"/, '#sidebarNewsItem must have aria-hidden="true"');
  });

  test('webapp/kino/kino.js excludes news from active sidebar slots and transition order', () => {
    const js = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.js'), 'utf8');

    // slots array in syncSidebarSectionItems must NOT contain sidebarNewsItem
    assert.match(js, /const slots = \[\s*document\.getElementById\("sidebarFifaItem"\),\s*document\.getElementById\("sidebarMusicItem"\),\s*document\.getElementById\("sidebarPodcastsItem"\),\s*\];/);

    // ORDER must not route to news in any active section
    assert.match(js, /kino:\s*\["fifa",\s*"music",\s*"podcasts"\]/);
    assert.match(js, /fifa:\s*\["kino",\s*"music",\s*"podcasts"\]/);
    assert.match(js, /music:\s*\["kino",\s*"fifa",\s*"podcasts"\]/);
    assert.match(js, /podcasts:\s*\["kino",\s*"fifa",\s*"music"\]/);

    // action === "news" must not redirect to /news
    assert.doesNotMatch(js, /if\s*\(action === "news"\)[\s\S]*?window\.location\.href\s*=\s*["']\/news/);

    // requestedSection === 'news' must not redirect to /news
    assert.doesNotMatch(js, /requestedSection === ['"]news['"]\s*\)\s*window\.location\.replace\(['"]\/news['"]\)/);
  });

  test('CSS across kino, glass-theme, and books strictly hides news sidebar items', () => {
    const kinoCss = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.css'), 'utf8');
    const glassCss = fs.readFileSync(path.join(rootDir, 'webapp', 'glass-theme.css'), 'utf8');
    const booksCss = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'books.css'), 'utf8');

    const selectorPattern = /#sidebarNewsItem[\s\S]*?display:\s*none\s*!important;/;
    assert.match(kinoCss, selectorPattern, 'kino.css hides news sidebar item');
    assert.match(glassCss, selectorPattern, 'glass-theme.css hides news sidebar item');
    assert.match(booksCss, selectorPattern, 'books.css hides news sidebar item');
  });

  test('webapp/books/index.html hides news link from sidebar', () => {
    const booksHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'index.html'), 'utf8');
    assert.match(booksHtml, /href="\/news"[^>]*style="display:\s*none\s*!important;"/);
    assert.match(booksHtml, /href="\/news"[^>]*hidden/);
  });

  test('webapp/news/index.html and mirrors immediately redirect to / if accessed directly', () => {
    const newsMain = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    const mirror1 = fs.readFileSync(path.join(rootDir, 'webapp', 'news.html'), 'utf8');
    const mirror2 = fs.readFileSync(path.join(rootDir, 'news.html'), 'utf8');

    const redirectSnippet = /window\.location\.replace\('\/'\s*\+\s*\(window\.location\.hash\s*\|\|\s*''\)\)/;
    assert.match(newsMain, redirectSnippet, 'webapp/news/index.html redirects to root');
    assert.match(mirror1, redirectSnippet, 'webapp/news.html redirects to root');
    assert.match(mirror2, redirectSnippet, 'news.html redirects to root');
  });
});
