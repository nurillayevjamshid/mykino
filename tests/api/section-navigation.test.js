const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

describe('Section Navigation & Splash Continuity Suite', () => {
  test('webapp/index.html suppresses entrance splash on incoming section or from query', () => {
    const html = fs.readFileSync(path.join(rootDir, 'webapp', 'index.html'), 'utf8');
    assert.match(html, /Boolean\(req\)/, 'Checks p.get("section") to skip entrance splash');
    assert.match(html, /skip-entrance-splash/, 'Applies skip-entrance-splash class to html');
    assert.match(html, /id="sectionSplash"/, 'Defines #sectionSplash in DOM');
    assert.match(html, /SECTION_SPLASH/i, 'Has inline splash configuration right after sectionSplash');
  });

  test('webapp/kino/kino.js guarantees strict 1.5s section transition without network freezing', () => {
    const js = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.js'), 'utf8');
    assert.match(js, /function navigateSidebarSection\(action,\s*switchFn\)/);
    // Ensure timeout is strictly 1500ms
    assert.match(js, /setTimeout\(\(\)\s*=>\s*\{\s*ensureTelegramFullscreen\(\);\s*hideSectionSplash\(\);\s*\},\s*1500\);/);
    // Ensure kino-back or kino both map to kino
    assert.match(js, /targetKey = \(action === "kino-back" \|\| action === "kino"\) \? "kino" : action/);
  });

  test('webapp/news/index.html configures dedicated section splash icons and from=news parameters', () => {
    const newsHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    assert.match(newsHtml, /SECTION_SPLASH_ICONS/, 'Defines SECTION_SPLASH_ICONS');
    assert.match(newsHtml, /SECTION_SPLASH_COLORS/, 'Defines SECTION_SPLASH_COLORS');
    assert.match(newsHtml, /href="\/\?from=news"/, 'Navigates to Kino with from=news');
    assert.match(newsHtml, /href="\/\?section=football&from=news"/, 'Navigates to Football with from=news');
    assert.match(newsHtml, /href="\/\?section=music&from=news"/, 'Navigates to Music with from=news');
    assert.match(newsHtml, /href="\/\?section=podcasts&from=news"/, 'Navigates to Podcasts with from=news');
    assert.match(newsHtml, /href="\/books\?from=news"/, 'Navigates to Books with from=news');
  });

  test('webapp/news.html and news.html mirrors match webapp/news/index.html navigation', () => {
    const mainNews = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    const mirror1 = fs.readFileSync(path.join(rootDir, 'webapp', 'news.html'), 'utf8');
    const mirror2 = fs.readFileSync(path.join(rootDir, 'news.html'), 'utf8');
    assert.equal(mirror1, mainNews, 'webapp/news.html matches webapp/news/index.html');
    assert.equal(mirror2, mainNews, 'news.html matches webapp/news/index.html');
  });

  test('webapp/books/index.html provides from=books query parameters in sidebar items', () => {
    const booksHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'index.html'), 'utf8');
    assert.match(booksHtml, /href="\/\?from=books"/, 'Navigates to Kino with from=books');
    assert.match(booksHtml, /href="\/\?section=football&from=books"/, 'Navigates to Football with from=books');
    assert.match(booksHtml, /href="\/\?section=music&from=books"/, 'Navigates to Music with from=books');
    assert.match(booksHtml, /href="\/\?section=podcasts&from=books"/, 'Navigates to Podcasts with from=books');
  });

  test('unified light theme default and storage sync across index, news, and books', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'index.html'), 'utf8');
    const newsHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    const booksHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'index.html'), 'utf8');
    const kinoJs = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.js'), 'utf8');

    // Both index and news default to light
    assert.match(indexHtml, /effTheme = \(storedTheme === "dark"\) \? "dark" : "light"/);
    assert.match(newsHtml, /effTheme = \(storedTheme === "dark"\) \? "dark" : "light"/);
    assert.match(booksHtml, /effTheme = \(storedTheme === "dark"\) \? "dark" : "light"/);

    // kino.js getInitialTheme strictly defaults to light
    assert.match(kinoJs, /if \(stored === "dark"\) return "dark";\s*return "light";/);

    // Both listen to storage event to sync theme cross-page
    assert.match(kinoJs, /window\.addEventListener\("storage",/);
    assert.match(newsHtml, /window\.addEventListener\('storage',/);
  });

  test('football section icon inverts to white in dark mode across all sidebars and styles', () => {
    const kinoCss = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.css'), 'utf8');
    const glassCss = fs.readFileSync(path.join(rootDir, 'webapp', 'glass-theme.css'), 'utf8');
    const newsHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    const booksCss = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'books.css'), 'utf8');

    // Check invert filter in all css files
    assert.match(kinoCss, /\[data-theme="dark"\] \.sidebar__item-img--fifa[\s\S]*?filter:\s*invert\(1\)/);
    assert.match(glassCss, /\[data-theme="dark"\] \.sidebar__item-img--fifa[\s\S]*?filter:\s*invert\(1\)/);
    assert.match(newsHtml, /\[data-theme="dark"\] \.sidebar__item-img--fifa[\s\S]*?filter:\s*invert\(1\)/);
    assert.match(booksCss, /\[data-theme="dark"\] \.sidebar__item-img--fifa[\s\S]*?filter:\s*invert\(1\)/);
  });

  test('cross-section language synchronization across kino, news, and books', () => {
    const kinoJs = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.js'), 'utf8');
    const newsHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');
    const booksJs = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'books.js'), 'utf8');
    const booksHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'index.html'), 'utf8');

    // kino.js listens to storage for kino_lang and app_lang, exports setAppLanguage
    assert.match(kinoJs, /e\.key === "kino_lang" \|\| e\.key === "app_lang"/);
    assert.match(kinoJs, /window\.setAppLanguage = setAppLanguage/);

    // news index.html sets app_lang and listens to storage
    assert.match(newsHtml, /localStorage\.setItem\('app_lang', lang\)/);
    assert.match(newsHtml, /e\.key === LANG_STORAGE_KEY \|\| e\.key === 'app_lang'/);

    // books includes language pills and storage sync
    assert.match(booksHtml, /id="sidebarLangPills"/);
    assert.match(booksJs, /e\.key === "kino_lang" \|\| e\.key === "app_lang"/);
  });

  test('single-click responsiveness and backdrop pointer-events safety', () => {
    const kinoCss = fs.readFileSync(path.join(rootDir, 'webapp', 'kino', 'kino.css'), 'utf8');
    const booksCss = fs.readFileSync(path.join(rootDir, 'webapp', 'books', 'books.css'), 'utf8');
    const newsHtml = fs.readFileSync(path.join(rootDir, 'webapp', 'news', 'index.html'), 'utf8');

    // Ensure .sidebar-backdrop does not block clicks when closed
    assert.match(kinoCss, /\.sidebar-backdrop:not\(\.is-open\)\s*\{\s*pointer-events:\s*none !important;\s*\}/);
    assert.match(booksCss, /\.sidebar-backdrop:not\(\.is-open\)/);
    assert.match(newsHtml, /\.sidebar-backdrop\s*\{[\s\S]*?pointer-events:\s*none;/);

    // Ensure hidden splash screens do not block clicks
    assert.match(kinoCss, /\.splash-screen\.hidden,\s*\.splash-screen\[hidden\]\s*\{[\s\S]*?pointer-events:\s*none !important;/);
    assert.match(kinoCss, /\.section-splash\[hidden\]\s*\{[\s\S]*?pointer-events:\s*none !important;/);
  });
});
