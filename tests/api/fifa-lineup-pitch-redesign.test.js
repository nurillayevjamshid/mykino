const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('FIFA Lineup Pitch Redesign & Player Photos API Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const categoriesJs = fs.readFileSync(path.join(rootDir, 'api/categories.js'), 'utf8');
  const fifaJs = fs.readFileSync(path.join(rootDir, 'webapp/fifa/fifa.js'), 'utf8');
  const kinoCss = fs.readFileSync(path.join(rootDir, 'webapp/kino/kino.css'), 'utf8');

  test('api/categories.js defines Wikipedia photo resolver & batch enrichment', () => {
    assert.match(categoriesJs, /const FOOTBALL_PLAYER_PHOTO_CACHE = new Map\(\);/);
    assert.match(categoriesJs, /async function resolvePlayerPhoto\(name/);
    assert.match(categoriesJs, /https:\/\/en\.wikipedia\.org\/api\/rest_v1\/page\/summary\//);
    assert.match(categoriesJs, /async function batchResolvePlayerPhotos\(players/);
    assert.match(categoriesJs, /await batchResolvePlayerPhotos\(/);
  });

  test('api/categories.js maps assists, subOutMinute, isCaptain, and ratings', () => {
    assert.match(categoriesJs, /function computeSofascoreRating\(p, isLiveOrFinished\)/);
    assert.match(categoriesJs, /function assignPlayerRatingsAndMotm\(/);
    assert.match(categoriesJs, /subOutMinute/);
    assert.match(categoriesJs, /assists/);
    assert.match(categoriesJs, /isCaptain/);
    assert.match(categoriesJs, /motm/);
  });

  test('webapp/fifa/fifa.js renders top-right rating pill with MOTM star and color classes', () => {
    assert.match(fifaJs, /fifa-pitch-player__rating/);
    assert.match(fifaJs, /fifa-rating--blue/);
    assert.match(fifaJs, /fifa-rating--green/);
    assert.match(fifaJs, /fifa-rating--orange/);
    assert.match(fifaJs, /fifa-rating__star.*★/);
  });

  test('webapp/fifa/fifa.js renders top-left sub-out badge with minute and red arrow', () => {
    assert.match(fifaJs, /fifa-pitch-player__sub-out/);
    assert.match(fifaJs, /fifa-pitch-player__sub-arrow.*←/);
  });

  test('webapp/fifa/fifa.js renders event badges for goal and assist', () => {
    assert.match(fifaJs, /fifa-pitch-badge--goal/);
    assert.match(fifaJs, /fifa-pitch-badge--assist.*👟/);
  });

  test('webapp/fifa/fifa.js renders captain, number, and shortName in name-row below avatar', () => {
    assert.match(fifaJs, /fifa-pitch-player__name-row/);
    assert.match(fifaJs, /fifa-pitch-player__captain.*Ⓒ/);
    assert.match(fifaJs, /fifa-pitch-player__number/);
    assert.match(fifaJs, /fifa-pitch-player__name/);
  });

  test('webapp/kino/kino.css styles avatar circle, rating pill, sub-out badge, and name row', () => {
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*44px/);
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*border-radius:\s*50%/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*right:\s*-8px/);
    assert.match(kinoCss, /\.fifa-pitch-player__sub-out\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-player__sub-out\s*\{[^}]*left:\s*-8px/);
    assert.match(kinoCss, /\.fifa-pitch-badge--assist/);
    assert.match(kinoCss, /\.fifa-pitch-player__name-row/);
    assert.match(kinoCss, /\.fifa-pitch-player__captain\s*\{[^}]*color:\s*#fbbf24/);
  });

  test('webapp/kino/kino.css includes mobile responsiveness for pitch player', () => {
    assert.match(kinoCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*38px/);
  });
});
