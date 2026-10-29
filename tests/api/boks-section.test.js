const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(rootDir, ...p), 'utf8');

describe('Boks section (NTV × O\'zbekiston Boks Federatsiyasi)', () => {
  test('index.html has the boks view, sidebar slot and splash entry', () => {
    const html = read('webapp', 'index.html');
    assert.match(html, /<section class="boks-view" id="boksView" hidden/);
    assert.match(html, /id="sidebarBoksItem" data-sidebar-action="boks"/);
    assert.match(html, /\(req === "boks"\) \? "boks"/);
    assert.match(html, /boks: "#e0242f"/);
  });

  test('kino.js lazy-loads the module and routes the sidebar action', () => {
    const js = read('webapp', 'kino', 'kino.js');
    assert.match(js, /function ensureBoksModule\(\)/);
    assert.match(js, /\/static\/boks\/boks\.js\?v=/);
    assert.match(js, /\/static\/boks\/boks\.css\?v=/);
    assert.match(js, /if \(action === "boks"\) \{\s*navigateSidebarSection\("boks"/);
    assert.match(js, /requestedSection === 'boks'\) openBoksView\(\)/);
    assert.match(js, /document\.getElementById\("sidebarBoksItem"\)/);
    // Every section closes boks when another one opens
    const esportCloses = (js.match(/^\s*closeEsportView\(\);$/gm) || []).length;
    const boksCloses = (js.match(/^\s*closeBoksView\(\);$/gm) || []).length;
    assert.ok(boksCloses >= esportCloses, 'closeBoksView runs wherever closeEsportView does');
  });

  test('every sidebar layout fills all four top slots', () => {
    const js = read('webapp', 'kino', 'kino.js');
    const order = js.match(/const ORDER = \{([\s\S]*?)\};/)[1];
    const rows = order.match(/\w+: \[[^\]]*\]/g);
    assert.ok(rows.some((r) => r.startsWith('boks:')), 'boks has its own layout');
    rows.forEach((row) => {
      const keys = row.match(/"[^"]+"/g);
      assert.equal(keys.length, 4, row);
      assert.ok(!keys.includes(`"${row.split(':')[0]}"`), 'a section does not link to itself: ' + row);
    });
  });

  test('boks.json is valid and boks.js exposes the module interface', () => {
    const data = JSON.parse(read('webapp', 'boks', 'boks.json'));
    assert.equal(data.partner.name, "O'zbekiston Boks Federatsiyasi");
    assert.ok(Array.isArray(data.events));
    const js = read('webapp', 'boks', 'boks.js');
    assert.match(js, /window\.__boks = \{ openBoksView: openBoksView, closeBoksView: closeBoksView \}/);
    // Efir, janglar va terma jamoa admin paneldan (/api/boks), yangiliklar Telegram kanaldan
    assert.match(js, /var API_URL = "\/api\/boks";/);
    assert.match(js, /\?resource=news/);
    assert.match(js, /\?resource=fights/);
  });

  test('/api/boks is routed through the music.js delegator (no new Vercel function)', () => {
    const vercel = JSON.parse(read('vercel.json'));
    assert.ok(vercel.routes.some((r) => r.src === '/api/boks' && r.dest === '/api/music.js?_boks=1'));
    assert.match(read('api', 'music.js'), /request\.query\?\._boks\) \{\s*await handleBoksRequest\(request, response\);/);
  });

  test('admin panel has a Boks section with Efir / Janglar / Terma jamoa tabs', () => {
    const html = read('webapp', 'admin', 'index.html');
    assert.match(html, /<li class="nav-item" data-section="boks">/);
    assert.match(html, /<section class="content-section boks-admin" id="boksSection">/);
    ['stream', 'fights', 'team'].forEach((tab) => {
      assert.match(html, new RegExp(`data-boks-admin-tab="${tab}"`));
      assert.match(html, new RegExp(`data-boks-admin-panel="${tab}"`));
    });
    assert.match(html, /<script src="\/admin\/admin-boks\.js\?v=/);
    const adminJs = read('webapp', 'admin', 'admin.js');
    assert.match(adminJs, /boks: 'boksSection'/);
    assert.match(adminJs, /if \(name === 'boks'\) \{ window\.boksAdmin\?\.load\(\); \}/);
  });
});
