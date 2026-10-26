const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Advertising modal", () => {
  const root = path.resolve(__dirname, "../..");
  const html = fs.readFileSync(path.join(root, "webapp/index.html"), "utf8");
  const kino = fs.readFileSync(path.join(root, "webapp/kino/kino.js"), "utf8");
  const users = fs.readFileSync(path.join(root, "api/users.js"), "utf8");

  test("puts the ads trigger rightmost in the shared topbar, after search", () => {
    const controlsStart = html.indexOf('class="topbar-controls');
    const controls = html.slice(controlsStart, html.indexOf("</header>", controlsStart));
    assert.ok(controls.indexOf('class="topbar-search"') !== -1);
    assert.ok(controls.indexOf('id="topbarAdsButton"') > controls.indexOf('class="topbar-search"'));
    assert.match(html, /<dialog class="ads-sheet" id="adsInfoModal"/);
  });

  test("shows the admin's contact details", () => {
    assert.match(html, /href="https:\/\/t\.me\/nurillaevv"/);
    assert.match(html, /href="tel:\+998950919966"/);
    assert.match(html, /data-ads-copy="\+998950919966"/);
  });

  test("loads the same subscriber count the admin panel shows", () => {
    assert.match(kino, /\/api\/users\?action=subscriber-count/);
    assert.match(users, /function isSubscriberCountRoute/);
    // Ro'yxat emas, faqat son qaytadi va admin GET bilan bir xil manbadan olinadi.
    assert.match(users, /count: subscriberCountCache\.value/);
    assert.match(users, /const \{ merged \} = await readMergedUsers\(\)/);
  });
});
