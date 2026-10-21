const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Unified Send Icon Suite', () => {
  const root = path.resolve(__dirname, '../..');
  const pathRegex = /M22\s+2\s+15\s+22\s+11\s+13\s+2\s+9\s+22\s+2Z/;
  const innerFoldRegex = /m11\s+13\s+6-6/;

  test('webapp/index.html uses the unified send icon in comments, share-chat, and fifa promo', () => {
    const html = fs.readFileSync(path.join(root, 'webapp/index.html'), 'utf8');

    // commentsSubmit button
    assert.match(html, /id="commentsSubmit"[\s\S]*?class="send-icon"/);
    // shareChatBtn
    assert.match(html, /id="shareChatBtn"[\s\S]*?class="send-icon"/);
    // fifaPromoShare
    assert.match(html, /id="fifaPromoShare"[\s\S]*?class="send-icon"/);

    assert.match(html, pathRegex);
    assert.match(html, innerFoldRegex);
  });

  test('webapp/beta/index.html and webapp/spatial/index.html use the unified send icon', () => {
    const beta = fs.readFileSync(path.join(root, 'webapp/beta/index.html'), 'utf8');
    const spatial = fs.readFileSync(path.join(root, 'webapp/spatial/index.html'), 'utf8');

    assert.match(beta, /id="shareChatBtn"[\s\S]*?class="send-icon"/);
    assert.match(spatial, /id="sendButton"[\s\S]*?class="send-icon"/);
  });

  test('webapp/potcasts/potcasts.js and webapp/news/index.html use the unified send icon', () => {
    const potcasts = fs.readFileSync(path.join(root, 'webapp/potcasts/potcasts.js'), 'utf8');
    const news = fs.readFileSync(path.join(root, 'webapp/news/index.html'), 'utf8');

    assert.match(potcasts, /pod-topbar__share[\s\S]*?class="send-icon"/);
    assert.match(news, /class="action-icon-btn"[\s\S]*?class="send-icon"/);
  });

  test('kino.css and glass-theme.css style .send-icon with clean stroke rules', () => {
    const kinoCss = fs.readFileSync(path.join(root, 'webapp/kino/kino.css'), 'utf8');
    const glassCss = fs.readFileSync(path.join(root, 'webapp/glass-theme.css'), 'utf8');

    for (const css of [kinoCss, glassCss]) {
      assert.match(css, /\.send-icon[\s\S]*?fill:\s*none\s*!important/i);
      assert.match(css, /\.send-icon[\s\S]*?stroke:\s*currentColor\s*!important/i);
      assert.match(css, /\.send-icon[\s\S]*?stroke-linecap:\s*round\s*!important/i);
      assert.match(css, /\.send-icon[\s\S]*?stroke-linejoin:\s*round\s*!important/i);
    }
  });
});
