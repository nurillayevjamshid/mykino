const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { RULES } = require("../../scripts/check-secrets.js");

function matches(text, file = "x.js") {
  return RULES.filter((rule) => {
    if (rule.onlyFiles && !rule.onlyFiles.test(file)) return false;
    rule.re.lastIndex = 0;
    return rule.re.test(text);
  }).map((rule) => rule.name);
}

describe("scripts/check-secrets.js", () => {
  test("catches a real-looking Telegram bot token, also inside a workflow expression", () => {
    const token = `1234567890:AA${"x".repeat(33)}`;
    assert.ok(matches(`BOT_TOKEN=${token}`, ".env.example").includes("Telegram bot token"));
    assert.ok(matches(`BOT_TOKEN: \${{ secrets.${token} }}`, "a.yml").includes("Telegram bot token"));
  });

  test("catches a password written into an env example", () => {
    assert.deepEqual(matches("ADMIN_PASSWORD=hunter2hunter2", ".env.example"), ["Maxfiy o'zgaruvchiga qiymat yozilgan"]);
  });

  test("ignores placeholders and secret references", () => {
    const text = [
      "BOT_TOKEN=123456789:telegram-bot-token-from-botfather",
      "ADMIN_PASSWORD=",
      "R2_ACCESS_KEY_ID=",
      "R2_SECRET_ACCESS_KEY=",
      "ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}",
      "ADMIN_PASSWORD: ci-admin-password",
    ].join("\n");
    assert.deepEqual(matches(text, ".env.example"), []);
    assert.deepEqual(matches(text, "ci.yml"), []);
  });
});
