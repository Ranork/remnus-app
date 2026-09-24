/**
 * Project map (P13): how knowledge `sources` are read as repo paths, and how a
 * path an agent asks about matches them. Pure — no database.
 *
 *   npm run test:code-paths
 */
import assert from 'node:assert/strict';
import { matchSource, normalizeQueryPath, normalizeSourcePath } from '@/lib/graph/codePaths';

let passed = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  assert.deepEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  passed++;
};

// ── sources → repo paths ──
const sources: Array<[string, string | null]> = [
  ['src/auth.ts', 'src/auth.ts'],
  ['./src/auth.ts', 'src/auth.ts'],
  ['/src/auth.ts', 'src/auth.ts'],
  ['src\\lib\\auth.ts', 'src/lib/auth.ts'],
  ['src/auth.ts#L10-L20', 'src/auth.ts'],
  ['src/auth.ts:42', 'src/auth.ts'],
  ['src/auth.ts:42:7', 'src/auth.ts'],
  ['src/lib/', 'src/lib/'],
  ['src/lib/**/*.ts', 'src/lib/'],
  ['src/*.ts', 'src/'],
  ['package.json', 'package.json'],
  ['Dockerfile', 'Dockerfile'],
  ['.env.example', '.env.example'],
  ['docs/Team notes.md', 'docs/Team notes.md'],
  ['  src//lib/auth.ts  ', 'src/lib/auth.ts'],
  // Not paths inside the repository.
  ['https://example.com/spec', null],
  ['file:///home/me/app/src/auth.ts', null],
  ['C:\\work\\app\\src\\auth.ts', null],
  ['//server/share/file.ts', null],
  ['../other-repo/src/x.ts', null],
  ['Authentication', null],
  ['Meeting notes', null],
  ['v1.2', null],
  ['**/*.ts', null],
  ['', null],
];
for (const [input, expected] of sources) check(`normalizeSourcePath(${JSON.stringify(input)})`, normalizeSourcePath(input), expected);

// ── what an agent asks about ──
const queries: Array<[string, string | null]> = [
  ['src/auth.ts', 'src/auth.ts'],
  ['D:\\work\\app\\src\\auth.ts', 'work/app/src/auth.ts'],
  ['/home/me/app/src/auth.ts', 'home/me/app/src/auth.ts'],
  ['src/lib/', 'src/lib/'],
  ['./src/auth.ts:12', 'src/auth.ts'],
  ['https://example.com/spec', null],
];
for (const [input, expected] of queries) check(`normalizeQueryPath(${JSON.stringify(input)})`, normalizeQueryPath(input), expected);

// ── query × source ──
const matches: Array<[string, string, ReturnType<typeof matchSource>]> = [
  ['src/auth.ts', 'src/auth.ts', 'exact'],
  ['SRC/Auth.ts', 'src/auth.ts', 'exact'],
  ['work/app/src/auth.ts', 'src/auth.ts', 'exact'], // absolute query, repo-relative source
  ['src/lib/auth.ts', 'src/lib/', 'folder'],
  ['work/app/src/lib/auth.ts', 'src/lib/', 'folder'],
  ['src/lib/', 'src/lib/', 'exact'],
  ['src/lib', 'src/lib/auth.ts', 'inside'],
  ['src/lib/', 'src/lib/auth.ts', 'inside'],
  ['src/auth.ts', 'src/auth.tsx', null],
  ['src/authentication.ts', 'src/auth', null],
  ['docs/README.md', 'README.md', null], // a one-segment source matches only itself
  ['README.md', 'README.md', 'exact'],
  ['src/libs/x.ts', 'src/lib/', null],
];
for (const [query, source, expected] of matches) check(`matchSource(${query}, ${source})`, matchSource(query, source), expected);

console.log(`test-code-paths: ${passed} checks passed`);
