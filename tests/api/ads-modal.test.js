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

  test("shows ad types as a swipeable carousel with a preview per type", () => {
    assert.match(html, /id="adsCarouselTrack"/);
    assert.equal((html.match(/<article class="ads-slide"/g) || []).length, 3);
    assert.equal((html.match(/data-ads-slide="\d"/g) || []).length, 3);
    for (const title of ["Kirish banneri", "Yuguruvchi qator", "Botda xabar"]) assert.match(html, new RegExp(`<strong>${title}</strong>`));
    // Har bir tur haqiqiy ilova skrinshoti bilan ko'rsatiladi.
    for (const name of ["banner", "ticker", "bot"]) {
      assert.match(html, new RegExp(`src="/static/assets/ads/ads-type-${name}\\.webp"`));
      assert.ok(fs.existsSync(path.join(root, `webapp/assets/ads/ads-type-${name}.webp`)));
    }
    // Skrinshot kesilmasdan, to'liq ko'rinishi kerak.
    const css = fs.readFileSync(path.join(root, "webapp/glass-theme.css"), "utf8");
    assert.match(css, /\.ads-preview--shot img \{[^}]*object-fit: contain/);
    assert.doesNotMatch(html, /class="ads-types"/);
    assert.match(kino, /getElementById\("adsCarouselTrack"\)/);
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
