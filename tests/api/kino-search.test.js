const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Kino search", () => {
  const kino = fs.readFileSync(path.resolve(__dirname, "../../webapp/kino/kino.js"), "utf8");

  test("includes series titles from the series catalog in search results", () => {
    assert.match(kino, /function filteredSeries\(\)/);
    assert.match(kino, /const seriesMatches = movieLoadState === "ready" \? filteredSeries\(\) : \[\]/);
    assert.match(kino, /if \(query && !seriesCatalogLoaded\) loadSeriesCatalog\(\)/);
  });

  test("treats Uzbek apostrophe variants as the same letter", () => {
    const src = kino.match(/function normalizeSearchText\(value\) \{[\s\S]*?\n\}/)[0];
    const normalizeSearchText = new Function(`${src}; return normalizeSearchText;`)();
    assert.equal(normalizeSearchText("Oʻtkan  Kunlar"), normalizeSearchText("o'tkan kunlar"));
    assert.equal(normalizeSearchText("O‘zbek"), "o'zbek");
  });
});
