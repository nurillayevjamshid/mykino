#!/usr/bin/env node
// Syntax check for all front-end and serverless JS, plus JSON data files.
//
// Historically this was a long hard-coded `node --check a.js && node --check b.js`
// chain inside package.json. That broke silently whenever files were moved or
// removed (e.g. webapp/app.js was split into webapp/kino|music|tv|... modules,
// but the old path stayed in the script and CI failed on every push).
//
// This version discovers files at runtime, so it never goes stale.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Directories to scan recursively for .js files.
const JS_DIRS = ['api', 'webapp', 'scripts', 'tests', 'bot'];

// Top-level files that are not inside the scanned dirs.
const JS_FILES = [];

// JSON files that must parse (data integrity).
const JSON_FILES = ['package.json', 'vercel.json', 'data/movies.json'];

// Never walk into these.
const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.workbuddy-ai', '.tmp-check']);

function walkJs(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // directory may not exist in some checkouts
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walkJs(full, out);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

const jsFiles = [];
for (const d of JS_DIRS) walkJs(path.join(ROOT, d), jsFiles);
for (const f of JS_FILES) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) jsFiles.push(full);
}

// Also check .mjs / .cjs if present at the scanned roots (rare here).
const files = [...new Set(jsFiles)].sort();

if (files.length === 0) {
  console.error('check-syntax: no JS files found — did the project layout change?');
  process.exit(1);
}

let failed = 0;

console.log(`Syntax check: ${files.length} JS files`);

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${rel}`);
    const out = (err.stderr || err.stdout || '').toString().trim();
    if (out) {
      out.split('\n').slice(0, 12).forEach((l) => console.error('        ' + l));
    }
  }
}

console.log(`JSON check: ${JSON_FILES.length} files`);
for (const f of JSON_FILES) {
  const full = path.join(ROOT, f);
  if (!fs.existsSync(full)) {
    failed++;
    console.error(`  FAIL  ${f} (missing)`);
    continue;
  }
  try {
    JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${f}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\ncheck-syntax: ${failed} file(s) failed`);
  process.exit(1);
}

console.log('\ncheck-syntax: all files OK');
