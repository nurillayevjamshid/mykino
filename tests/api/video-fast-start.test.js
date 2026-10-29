"use strict";

const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const R2_ENV = {
  R2_ENDPOINT: "https://abc123.r2.cloudflarestorage.com",
  R2_BUCKET: "mykino",
  R2_ACCESS_KEY_ID: "AKIDEXAMPLE",
  R2_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  R2_PUBLIC_URL: "https://pub-42c7619e0f49402bb099364c0b589eca.r2.dev",
};

function loadStore() {
  delete require.cache[require.resolve("../../api/_lib/r2-store.js")];
  return require("../../api/_lib/r2-store.js");
}

describe("R2 presigned video URLs", () => {
  let savedEnv;
  beforeEach(() => {
    savedEnv = {};
    for (const key of Object.keys(R2_ENV)) {
      savedEnv[key] = process.env[key];
      process.env[key] = R2_ENV[key];
    }
  });
  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("signs the r2.dev object against the S3 endpoint (matches the AWS SDK signer)", () => {
    const { presignR2PublicUrl } = loadStore();
    const now = Date.UTC(2026, 9, 29, 15, 30);
    const signed = presignR2PublicUrl("https://pub-42c7619e0f49402bb099364c0b589eca.r2.dev/1AbC_dEf-xyz.mp4", now);
    const url = new URL(signed);
    assert.equal(url.origin, "https://abc123.r2.cloudflarestorage.com");
    assert.equal(url.pathname, "/mykino/1AbC_dEf-xyz.mp4");
    assert.equal(url.searchParams.get("X-Amz-Date"), "20261029T000000Z");
    assert.equal(url.searchParams.get("X-Amz-Expires"), "604800");
    // Reference value produced by @smithy/signature-v4 for the same request.
    assert.equal(
      url.searchParams.get("X-Amz-Signature"),
      "f3bd51ec9ae46555c8a7fa8a8349952cf97b29ff09c7ba6d9e65edf4d07b7f42",
    );
  });

  test("keeps the same URL for the whole UTC day so edge caches stay valid", () => {
    const { presignR2PublicUrl } = loadStore();
    const src = "https://r2.myplaylist.uz/Qism%201.mp4";
    const morning = presignR2PublicUrl(src, Date.UTC(2026, 9, 29, 0, 5));
    const night = presignR2PublicUrl(src, Date.UTC(2026, 9, 29, 23, 55));
    assert.ok(morning);
    assert.equal(morning, night);
    assert.match(morning, /\/mykino\/Qism%201\.mp4\?/);
  });

  test("refuses non-R2 hosts and works as a no-op without R2 config", () => {
    const { presignR2PublicUrl } = loadStore();
    assert.equal(presignR2PublicUrl("https://evil.example.com/x.mp4"), "");
    process.env.R2_SECRET_ACCESS_KEY = "";
    assert.equal(presignR2PublicUrl("https://pub-42c7619e0f49402bb099364c0b589eca.r2.dev/x.mp4"), "");
  });
});

describe("Kino player fast start", () => {
  const kino = fs.readFileSync(path.resolve(__dirname, "../../webapp/kino/kino.js"), "utf8");

  test("plays the signed R2 URL first, then r2.dev, then drive-stream", () => {
    const src = kino.match(/function getMovieCdnSources\(movie\) \{[\s\S]*?\n\}/)[0];
    const getMovieCdnSources = new Function(`${src}; return getMovieCdnSources;`)();
    assert.deepEqual(
      getMovieCdnSources({
        cdnSignedUrl: "https://a.r2.cloudflarestorage.com/b/k.mp4?X-Amz-Signature=1",
        cdnUrl: "https://pub-x.r2.dev/k.mp4",
        videoUrl: "/api/drive-stream/k?token=t",
      }),
      [
        "https://a.r2.cloudflarestorage.com/b/k.mp4?X-Amz-Signature=1",
        "https://pub-x.r2.dev/k.mp4",
        "/api/drive-stream/k?token=t",
      ],
    );
    assert.deepEqual(getMovieCdnSources({ cdnUrl: "https://pub-x.r2.dev/k.mp4" }), ["https://pub-x.r2.dev/k.mp4"]);
    assert.deepEqual(getMovieCdnSources({ videoUrl: "/api/drive-stream/k?token=t" }), []);
  });

  test("switches to the next source when the current one stalls or errors", () => {
    const body = kino.match(/function createVideoElement\(src, movie, options = \{\}\) \{[\s\S]*?\n\}/)[0];
    assert.match(body, /alternateSources = \[\]/);
    assert.match(body, /failoverTimer = window\.setTimeout\(/);
    assert.match(body, /if \(switchToNextSource\(\)\) return;/);
    // A preloaded element that is already ready must not wait for events that never come again.
    assert.match(body, /if \(video\.readyState >= 1\) \{\s*applyLoadedMetadata\(\);\s*onReady\(\);/);
  });
});
