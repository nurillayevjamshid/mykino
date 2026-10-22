const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

describe("Music Mini-Player Drag & Repositioning Suite (xuddi kinolardek)", () => {
  const root = path.resolve(__dirname, "../..");
  const musicJsPath = path.join(root, "webapp/music/music.js");
  const musicCssPath = path.join(root, "webapp/music/music.css");
  const glassCssPath = path.join(root, "webapp/glass-theme.css");

  test("music.js defines __miniPlayerOffsetY, reset handler and drag setup", () => {
    const code = fs.readFileSync(musicJsPath, "utf8");

    assert.match(code, /let __miniPlayerOffsetY = 0;/);
    assert.match(code, /window\.__resetMiniPlayerOffset =/);
    assert.match(code, /function setupMiniPlayerDrag\(\)/);

    // Touch event listeners
    assert.match(code, /miniPlayer\.addEventListener\("touchstart", onDragStart/);
    assert.match(code, /miniPlayer\.addEventListener\("touchmove", onDragMove/);
    assert.match(code, /miniPlayer\.addEventListener\("touchend", onDragEnd/);

    // Desktop mouse drag
    assert.match(code, /miniPlayer\.addEventListener\("mousedown"/);
  });

  test("music.js implements flick to dismiss and bounded vertical placement", () => {
    const code = fs.readFileSync(musicJsPath, "utf8");

    // Flick to dismiss threshold
    assert.match(code, /Math\.abs\(dx\) > 110/);
    assert.match(code, /hideMiniPlayer\(\)/);

    // Vertical bounding limits
    assert.match(code, /maxUpward = -\(H - playerH - topSafe - 88\)/);
    assert.match(code, /maxDownward = 10/);

    // Saved offset transform
    assert.match(code, /miniPlayer\.style\.transform = `translate3d\(-50%, \$\{__miniPlayerOffsetY\}px, 0\)`/);
  });

  test("music.js integrates drag state with expand handler and show/hide lifecycle", () => {
    const code = fs.readFileSync(musicJsPath, "utf8");

    // Prevents accidental expand on drag release
    assert.match(code, /if \(justDraggedMiniPlayer\)/);

    // Restores offset in showMiniPlayer
    assert.match(code, /if \(__miniPlayerOffsetY !== 0\) \{/);

    // Clears inline transform in hideMiniPlayer
    assert.match(code, /__miniPlayerOffsetY = 0;/);
  });

  test("music.js supports progress bar touch scrubbing for song timeline seeking", () => {
    const code = fs.readFileSync(musicJsPath, "utf8");

    assert.match(code, /const miniBarEl = document\.querySelector\("\.mini-player__bar"\);/);
    assert.match(code, /miniBarEl\.addEventListener\("touchstart"/);
    assert.match(code, /miniBarEl\.addEventListener\("touchmove"/);
    assert.match(code, /handleSeek\(e\.touches\[0\]\.clientX\)/);
  });

  test("music.css and glass-theme.css style .mini-player.is-dragging and fullplayer hiding", () => {
    const musicCss = fs.readFileSync(musicCssPath, "utf8");
    const glassCss = fs.readFileSync(glassCssPath, "utf8");

    [musicCss, glassCss].forEach((css) => {
      // Touch action and grab cursor
      assert.match(css, /\.mini-player\s*\{[^}]*touch-action:\s*none/);
      assert.match(css, /\.mini-player\s*\{[^}]*cursor:\s*grab/);

      // Dragging state styles
      assert.match(css, /\.mini-player\.is-dragging\s*\{[^}]*cursor:\s*grabbing\s*!important/);
      assert.match(css, /\.mini-player\.is-dragging\s*\{[^}]*transition:\s*none\s*!important/);

      // Hidden states with !important to override inline transform
      assert.match(css, /\.mini-player\[aria-hidden="true"\]\s*\{[^}]*transform:\s*translateX\(-50%\)\s*translateY\(140%\)\s*!important/);
      assert.match(css, /body\.fullplayer-open \.mini-player\[aria-hidden="false"\]\s*\{[^}]*transform:\s*translateX\(-50%\)\s*translateY\(140%\)\s*!important/);
    });
  });
});
