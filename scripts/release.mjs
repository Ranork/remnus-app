#!/usr/bin/env node
// Release automation for the Tauri desktop app + auto-updater.
//
// Bumps the version in every place that must stay in lockstep (package.json,
// package-lock.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock), commits,
// creates an annotated `vX.Y.Z` tag, and pushes branch + tag. Pushing the tag triggers
// .github/workflows/tauri-release.yml, which builds every platform, generates
// the updater artifacts (latest.json) and publishes the GitHub release — at
// which point the in-app auto-updater picks the new version up.
//
// Usage:
//   node scripts/release.mjs patch     # 0.1.7 -> 0.1.8  (default)
//   node scripts/release.mjs minor     # 0.1.7 -> 0.2.0
//   node scripts/release.mjs major     # 0.1.7 -> 1.0.0
//   node scripts/release.mjs 1.2.3     # explicit version
//   node scripts/release.mjs current   # tag & ship the version already in the files
//
// Flags:
//   --dry-run   show what would happen without writing/committing/pushing

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
const runLive = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const arg = (args.find((a) => !a.startsWith('--')) || 'patch').toLowerCase();

const pkgPath = join(root, 'package.json');
const pkgLockPath = join(root, 'package-lock.json');
const cargoTomlPath = join(root, 'src-tauri', 'Cargo.toml');
const cargoLockPath = join(root, 'src-tauri', 'Cargo.lock');

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const pkgLock = JSON.parse(readFileSync(pkgLockPath, 'utf8'));
const current = pkg.version;

const bump = (v, kind) => {
  const [maj, min, pat] = v.split('.').map(Number);
  if ([maj, min, pat].some(Number.isNaN)) {
    fail(`Current version "${v}" is not plain semver (X.Y.Z).`);
  }
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
};

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

let next;
let doBump = true;
if (arg === 'current') {
  next = current;
  doBump = false;
} else if (['patch', 'minor', 'major'].includes(arg)) {
  next = bump(current, arg);
} else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  fail(`Unknown argument "${arg}". Use patch | minor | major | X.Y.Z | current.`);
}

const tag = `v${next}`;

// --- Safety checks ---------------------------------------------------------
const status = run('git status --porcelain');
if (status) {
  fail('Working tree is not clean. Commit or stash your changes first.\n' + status);
}

const existingTags = run('git tag --list').split('\n').filter(Boolean);
if (existingTags.includes(tag)) {
  fail(`Tag ${tag} already exists.`);
}

const branch = run('git rev-parse --abbrev-ref HEAD');

console.log(`\x1b[36mReleasing ${tag}\x1b[0m  (current: ${current}, branch: ${branch})`);
if (dryRun) console.log('\x1b[33m-- dry run: no files written, nothing pushed --\x1b[0m');

// --- Write version into all sources of truth -------------------------------
if (doBump) {
  pkg.version = next;
  if (!dryRun) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  pkgLock.version = next;
  if (!pkgLock.packages?.['']) {
    fail('Could not find the root package entry in package-lock.json.');
  }
  pkgLock.packages[''].version = next;
  if (!dryRun) writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');

  let toml = readFileSync(cargoTomlPath, 'utf8');
  // Only the [package] version line starts at column 0; build-dep versions are inline.
  const tomlNext = toml.replace(/^version = ".*"$/m, `version = "${next}"`);
  if (tomlNext === toml) fail('Could not find the [package] version line in Cargo.toml.');
  if (!dryRun) writeFileSync(cargoTomlPath, tomlNext);

  let lock = readFileSync(cargoLockPath, 'utf8');
  const lockNext = lock.replace(
    /(name = "remnus-app"\nversion = ")[^"]*(")/,
    `$1${next}$2`,
  );
  if (lockNext === lock) fail('Could not find the remnus-app entry in Cargo.lock.');
  if (!dryRun) writeFileSync(cargoLockPath, lockNext);

  console.log(`  • package.json, package-lock.json, Cargo.toml, Cargo.lock → ${next}`);
}

if (dryRun) {
  console.log('\x1b[33mDry run complete. Re-run without --dry-run to ship.\x1b[0m');
  process.exit(0);
}

// --- Commit, tag, push -----------------------------------------------------
if (doBump) {
  runLive(`git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock`);
  runLive(`git commit -m "chore(release): ${tag}"`);
}

runLive(`git tag -a ${tag} -m "Release ${tag}"`);
runLive(`git push origin ${branch}`);
runLive(`git push origin ${tag}`);

console.log(`\x1b[32m✓ Pushed ${tag}.\x1b[0m`);
console.log('  CI is building now → https://github.com/Ranork/remnus-app/actions');
console.log('  When the release publishes, the desktop auto-updater will offer the update.');
