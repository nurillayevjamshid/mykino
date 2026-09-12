#!/usr/bin/env node
// Runs the Node smoke tests with an explicit file list.
//
// Why this exists: `node --test tests/**/*.test.js` behaves differently
// across Node versions. Node 22 expands the quoted glob internally, but
// Node 24 (which GitHub Actions now uses by default, since Node 20 is
// deprecated) passes it through literally and fails with:
//   Could not find '.../tests/**/*.test.js'
// Shell expansion is not an option either, because `npm run` on Windows
// uses cmd.exe, which has no glob support.
//
// Discovering the files here and spawning `node --test` with real paths
// works identically on every Node version and every OS.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');

// Reporter is configurable: 'spec' for local, 'tap' for CI.
const reporterArg = process.argv.find((a) => a.startsWith('--reporter='));
const reporter = reporterArg ? reporterArg.split('=')[1] : 'spec';

const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__']);

function collect(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collect(full, out);
    } else if (e.isFile() && e.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

const files = collect(TESTS_DIR, []).sort();

if (files.length === 0) {
  console.error('run-tests: no *.test.js files found under tests/');
  process.exit(1);
}

console.log(`run-tests: ${files.length} test file(s)`);

const result = spawnSync(
  process.execPath,
  ['--test', `--test-reporter=${reporter}`, ...files],
  { stdio: 'inherit', cwd: ROOT }
);

process.exit(result.status === null ? 1 : result.status);
