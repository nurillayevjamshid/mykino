const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const indexHtmlPath = path.join(ROOT, 'webapp/index.html');
const glassCssPath = path.join(ROOT, 'webapp/glass-theme.css');
const kinoCssPath = path.join(ROOT, 'webapp/kino/kino.css');

test('Entrance Splash Screen NTV Logo Suite', async (t) => {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const glassCss = fs.readFileSync(glassCssPath, 'utf8');
  const kinoCss = fs.readFileSync(kinoCssPath, 'utf8');

  await t.test('index.html uses animated splash-ntv-logo with paths in splashScreen', () => {
    assert.match(indexHtml, /id="splashScreen"[\s\S]*?class="[^"]*splash-ntv-logo[^"]*"/, 'splashScreen has splash-ntv-logo');
    assert.match(indexHtml, /class="[^"]*splash-ntv-path--n1[^"]*"/, 'n1 path present');
    assert.match(indexHtml, /class="[^"]*splash-ntv-path--t[^"]*"/, 't path present');
    assert.match(indexHtml, /class="[^"]*splash-ntv-path--v[^"]*"/, 'v path present');
    assert.match(indexHtml, /id="ntv-fade-splash"/, 'ntv-fade-splash gradient present');
  });

  await t.test('splash-ntv-logo is always styled pure white in all themes', () => {
    for (const [name, css] of [['glass-theme.css', glassCss], ['kino.css', kinoCss]]) {
      assert.match(
        css,
        /\.splash-ntv-logo[\s\S]*?color:\s*#ffffff\s*!important/,
        `${name} styles .splash-ntv-logo color as pure white`
      );
      assert.match(
        css,
        /\.splash-ntv-logo[\s\S]*?stroke:\s*#ffffff\s*!important/,
        `${name} styles .splash-ntv-logo stroke as pure white`
      );
      assert.match(
        css,
        /html\[data-theme="light"\]\s+\.splash-ntv-logo[\s\S]*?color:\s*#ffffff\s*!important/,
        `${name} guarantees light theme does not make splash logo black`
      );
    }
  });

  await t.test('entrance splash includes stroke draw and breathing pulse animations', () => {
    for (const [name, css] of [['glass-theme.css', glassCss], ['kino.css', kinoCss]]) {
      assert.match(css, /@keyframes\s+splashStrokeDraw/, `${name} defines splashStrokeDraw animation`);
      assert.match(css, /@keyframes\s+splashLogoPulse/, `${name} defines splashLogoPulse animation`);
      assert.match(css, /\.splash-ntv-path[\s\S]*?stroke-dasharray/, `${name} sets stroke-dasharray for path drawing`);
      assert.match(css, /\.splash-ntv-logo[\s\S]*?animation:[\s\S]*?splashLogoPulse/, `${name} applies pulse animation`);
    }
  });
});
