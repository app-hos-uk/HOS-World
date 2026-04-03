#!/usr/bin/env node
/**
 * Point this repo at .githooks so commit-msg can strip "Made-with: Cursor" trailers.
 * Safe to run when not in a git clone (no-op).
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chmodSync, existsSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hook = join(root, '.githooks', 'commit-msg');

try {
  execSync('git rev-parse --git-dir', { cwd: root, stdio: 'pipe' });
} catch {
  process.exit(0);
}

try {
  execSync('git config core.hooksPath .githooks', { cwd: root, stdio: 'inherit' });
  if (existsSync(hook)) {
    try {
      chmodSync(hook, 0o755);
    } catch {
      /* windows or permission */
    }
  }
} catch {
  process.exit(0);
}
