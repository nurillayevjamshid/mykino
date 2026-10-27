const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Admin panel design system", () => {
  const root = path.resolve(__dirname, "../../webapp/admin");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "admin.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "admin.css"), "utf8");

  test("defines one set of colour tokens with a dark variant", () => {
    assert.equal((css.match(/^:root \{/gm) || []).length, 1);
    assert.equal((css.match(/^\[data-theme="dark"\] \{/gm) || []).length, 1);
    for (const token of ["--primary", "--bg-card", "--text", "--text-muted", "--border", "--control-h"]) {
      assert.match(css, new RegExp(`${token}:`));
    }
  });

  test("tabs, cards and status lines get their look from CSS, not inline styles", () => {
    assert.doesNotMatch(html, /class="(?:movie|music|ad)-tab[^"]*"[^>]*style=/);
    assert.doesNotMatch(html, /class="form-card[^"]*" style=/);
    assert.doesNotMatch(js, /style\.borderBottomColor = active/);
    // Holat ranglari faqat setTone() orqali — alohida hex qiymatlar yo'q.
    assert.doesNotMatch(js, /\.style\.color = kind ===/);
    assert.match(js, /function setTone\(el, kind\)/);
    assert.match(css, /\[data-tone="error"\]/);
  });

  test("only data-driven inline styles remain in the markup", () => {
    const leftovers = (html.match(/style="[^"]*"/g) || [])
      .filter((s) => !/^style="background:[^;]+"$/.test(s) && !/^style="display: ?(?:none|block);?"$/.test(s));
    assert.deepEqual(leftovers, []);
  });

  test("applies Telegram theme colours only inside Telegram", () => {
    assert.match(js, /const isInsideTelegram = \(\) => Boolean\(tg && tg\.initData\)/);
    assert.match(js, /if \(!isInsideTelegram\(\) \|\| !tg\.themeParams\) return;/);
  });
});
