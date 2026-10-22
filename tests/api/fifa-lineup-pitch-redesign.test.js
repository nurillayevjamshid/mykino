const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('FIFA Lineup Pitch Redesign & Flashscore Player Cards API Suite', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const categoriesJs = fs.readFileSync(path.join(rootDir, 'api/categories.js'), 'utf8');
  const fifaJs = fs.readFileSync(path.join(rootDir, 'webapp/fifa/fifa.js'), 'utf8');
  const kinoCss = fs.readFileSync(path.join(rootDir, 'webapp/kino/kino.css'), 'utf8');

  test('api/categories.js defines Wikipedia photo resolver, Sofascore cutouts & batch enrichment', () => {
    assert.match(categoriesJs, /const KNOWN_PLAYER_CUTOUTS = \{/);
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

  test('webapp/fifa/fifa.js defines and exports renderFlashscorePitchPlayer', () => {
    assert.match(fifaJs, /function renderFlashscorePitchPlayer\(p,\s*opts/);
    assert.match(fifaJs, /window\.renderFlashscorePitchPlayer\s*=\s*renderFlashscorePitchPlayer/);
  });

  test('webapp/fifa/fifa.js renders right-shoulder rating badge with color classes and MOTM star', () => {
    assert.match(fifaJs, /fifa-pitch-player__rating/);
    assert.match(fifaJs, /fifa-rating--blue/);
    assert.match(fifaJs, /fifa-rating--green/);
    assert.match(fifaJs, /fifa-rating--orange/);
    assert.match(fifaJs, /fifa-rating--red/);
    assert.match(fifaJs, /fifa-rating__star.*★/);
  });

  test('webapp/fifa/fifa.js renders left-side events container with sub-out arrow, cards, goals, and assists', () => {
    assert.match(fifaJs, /fifa-pitch-player__events/);
    assert.match(fifaJs, /fifa-pitch-badge--sub/);
    assert.match(fifaJs, /fifa-pitch-badge--sub-arrow.*↓/);
    assert.match(fifaJs, /fifa-pitch-badge--card/);
    assert.match(fifaJs, /fifa-pitch-badge--goal/);
    assert.match(fifaJs, /fifa-pitch-badge--assist/);
  });

  test('webapp/fifa/fifa.js renders captain, number, and shortName in single name-row below portrait', () => {
    assert.match(fifaJs, /fifa-pitch-player__name-row/);
    assert.match(fifaJs, /fifa-pitch-player__captain/);
    assert.match(fifaJs, /fifa-pitch-player__number/);
    assert.match(fifaJs, /fifa-pitch-player__name/);
  });

  test('webapp/kino/kino.css styles Flashscore cutout portrait without circle border-radius, rectangular rating, and left events', () => {
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*48px/);
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*border-radius:\s*0\s*!important/);
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*background:\s*transparent\s*!important/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*border-radius:\s*3px\s*!important/);
    assert.match(kinoCss, /\.fifa-pitch-player__events\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-badge--sub\s*,\s*\.fifa-pitch-player__sub-stack\s*\{[^}]*background:\s*#dc2626\s*!important/);
    assert.match(kinoCss, /\.fifa-pitch-player__name-row\s*\{[^}]*display:\s*inline-flex/);
  });

  test('webapp/kino/kino.css includes mobile responsiveness for pitch player', () => {
    assert.match(kinoCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*42px/);
    assert.match(kinoCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fifa-pitch-player__rating\s*\{[^}]*font-size:\s*9\.5px/);
  });
});
