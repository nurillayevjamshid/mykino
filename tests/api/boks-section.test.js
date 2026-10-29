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
    ['videos', 'news', 'events', 'team'].forEach((k) => assert.ok(Array.isArray(data[k]), k));
    const js = read('webapp', 'boks', 'boks.js');
    assert.match(js, /window\.__boks = \{ openBoksView: openBoksView, closeBoksView: closeBoksView \}/);
  });
});
