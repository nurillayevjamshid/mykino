const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('FIFA Lineup Pitch Redesign & Player Photos API Suite', () => {
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

  test('webapp/fifa/fifa.js renders top-right rating pill with MOTM star and color classes', () => {
    assert.match(fifaJs, /fifa-pitch-player__rating/);
    assert.match(fifaJs, /fifa-rating--blue/);
    assert.match(fifaJs, /fifa-rating--green/);
    assert.match(fifaJs, /fifa-rating--orange/);
    assert.match(fifaJs, /fifa-rating__star.*★/);
  });

  test('webapp/fifa/fifa.js renders top-left sub-out vertical stack with minute and red circle arrow', () => {
    assert.match(fifaJs, /fifa-pitch-player__sub-stack/);
    assert.match(fifaJs, /fifa-pitch-player__sub-min/);
    assert.match(fifaJs, /fifa-pitch-player__sub-circle.*←/);
  });

  test('webapp/fifa/fifa.js renders assist on bottom-left and goal on bottom-right', () => {
    assert.match(fifaJs, /fifa-pitch-badge--assist/);
    assert.match(fifaJs, /fifa-pitch-badge--goal/);
  });

  test('webapp/fifa/fifa.js renders captain, number, and shortName in name-row below avatar', () => {
    assert.match(fifaJs, /fifa-pitch-player__name-row/);
    assert.match(fifaJs, /fifa-pitch-player__captain/);
    assert.match(fifaJs, /fifa-pitch-player__number/);
    assert.match(fifaJs, /fifa-pitch-player__name/);
  });

  test('webapp/kino/kino.css styles avatar circle, black-text rating pill, sub-out stack, and name row', () => {
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*48px/);
    assert.match(kinoCss, /\.fifa-pitch-player__avatar\s*\{[^}]*background:\s*#383a3f/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-player__rating\s*\{[^}]*color:\s*#000000/);
    assert.match(kinoCss, /\.fifa-pitch-player__sub-stack\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-player__sub-circle\s*\{[^}]*background:\s*#ef4444/);
    assert.match(kinoCss, /\.fifa-pitch-badge--assist\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch-badge--goal\s*\{[^}]*position:\s*absolute/);
    assert.match(kinoCss, /\.fifa-pitch\s*\{[^}]*background:\s*#141518/);
  });

  test('webapp/kino/kino.css includes mobile responsiveness for pitch player', () => {
    assert.match(kinoCss, /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fifa-pitch-player__avatar\s*\{[^}]*width:\s*42px/);
  });
});
