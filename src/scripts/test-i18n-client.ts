/**
 * Which message namespaces reach the browser (V2 R9.1).
 *
 * The locale layout no longer hands the whole catalogue (~125 KB in English, more in
 * other languages) to `NextIntlClientProvider` on every page and every `router.refresh()`.
 * Each scope sends only what its client components read — `src/i18n/clientNamespaces.ts`,
 * rendered by `<ClientMessages scope>` (src/i18n/ClientMessages.tsx). A namespace missing
 * from a list would print a raw key on screen, so this script rebuilds the lists from the
 * code and fails when they drift:
 *
 *   npm run test:i18n-client            # check
 *   npm run test:i18n-client -- --write # regenerate src/i18n/clientNamespaces.ts
 *
 * How: walk the import graph (static, `import()` and `export … from`) from each route
 * entry, mark every module reachable from a `'use client'` file as client code, and
 * collect the namespaces its `useTranslations(...)` calls use. A bare
 * `useTranslations()` contributes the first segment of each `t('Ns.key')` call. A
 * namespace the script cannot read statically (a variable, a template string) fails the
 * check — name it literally. A component that reads a few keys of a large namespace may
 * narrow it with a trailing comment on the same line:
 *   const tl = useTranslations('Landing'); // i18n-client: Landing.bridgePricing*
 *
 * Scopes (each sends only what its parent scope does not already have):
 *   root   the locale layout and its error boundary — every page
 *   app    the signed-in shell, `(app)/layout.tsx` → <ClientMessages scope="app">
 *   admin  `(app)/admin/layout.tsx`
 *   <dir>  each public top-level route directory under [locale] (its layout.tsx), and
 *          `landing` for `[locale]/page.tsx`
 * The check also fails when a scope that needs messages is not wrapped.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');
const LOCALE_DIR = join(SRC, 'app', '[locale]');
const APP_DIR = join(LOCALE_DIR, '(app)');
const ADMIN_DIR = join(APP_DIR, 'admin');
const OUT = join(SRC, 'i18n', 'clientNamespaces.ts');

const sources = new Map<string, string>();
function read(file: string): string {
  let text = sources.get(file);
  if (text === undefined) {
    text = readFileSync(file, 'utf8');
    sources.set(file, text);
  }
  return text;
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g;
function importsOf(file: string): string[] {
  const out: string[] = [];
  for (const m of read(file).matchAll(IMPORT_RE)) {
    const target = resolveImport(file, m[1] ?? m[2] ?? m[3]);
    if (target) out.push(target);
  }
  return out;
}

const isClient = (file: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(read(file));

/** Modules that run in the browser when `entries` render. */
function clientModules(entries: string[]): Set<string> {
  const client = new Set<string>();
  const seen = new Set<string>();
  const stack: Array<[string, boolean]> = entries.map((e) => [e, false]);
  while (stack.length) {
    const [file, parentClient] = stack.pop()!;
    const inClient = parentClient || isClient(file);
    const key = `${file}|${inClient}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (inClient) client.add(file);
    for (const next of importsOf(file)) stack.push([next, inClient]);
  }
  return client;
}

const problems = new Set<string>();
const namespaceCache = new Map<string, string[]>();
function namespacesOf(file: string): string[] {
  const cached = namespaceCache.get(file);
  if (cached) return cached;
  const text = read(file);
  const found = new Set<string>();
  const rel = relative(ROOT, file);
  for (const m of text.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*([^)]*?)\s*\)[^\n]*/g)) {
    const [line, name, arg] = m;
    const narrowed = /\/\/\s*i18n-client:\s*(.+)$/.exec(line);
    if (narrowed) {
      for (const entry of narrowed[1].split(',')) found.add(entry.trim());
      continue;
    }
    if (arg) {
      const literal = /^['"]([\w-]+)(?:\.[\w.-]+)?['"]$/.exec(arg);
      if (literal) found.add(literal[1]);
      else problems.add(`${rel}: useTranslations(${arg}) — use a literal namespace`);
      continue;
    }
    // Bare useTranslations(): every key is namespaced in the call itself.
    const callRe = new RegExp(`\\b${name}(?:\\.(?:rich|markup|raw|has))?\\(\\s*([^,)]*)`, 'g');
    for (const call of text.matchAll(callRe)) {
      const key = /^['"]([\w-]+)\.[\w.-]+['"]$/.exec(call[1].trim());
      if (key) found.add(key[1]);
      else problems.add(`${rel}: ${name}(${call[1].trim()}) — bare useTranslations() needs literal 'Ns.key' keys`);
    }
  }
  if (/\buseTranslations\(/.test(text) && found.size === 0 && ![...problems].some((p) => p.startsWith(rel))) {
    problems.add(`${rel}: a useTranslations call the script could not read`);
  }
  if (/\buseMessages\(/.test(text) && !file.endsWith(join('i18n', 'MergeClientMessages.tsx'))) {
    problems.add(`${rel}: useMessages() reads the whole catalogue`);
  }
  const list = [...found];
  namespaceCache.set(file, list);
  return list;
}

function walk(dir: string, pick: (file: string) => boolean, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, pick, out);
    else if (pick(full)) out.push(full);
  }
  return out;
}

const ROUTE_FILE = /[\\/](page|layout|error|loading|not-found|template|default)\.tsx$/;
const collect = (entries: string[]) => {
  const set = new Set<string>();
  for (const file of clientModules(entries)) for (const ns of namespacesOf(file)) set.add(ns);
  return set;
};
const minus = (set: Set<string>, ...parents: Set<string>[]) => [...set].filter((ns) => !parents.some((p) => p.has(ns))).sort();

// Tiny namespaces many public pages share ride along with root, so those pages need no wrapper.
const ALWAYS_ROOT = ['LanguageSwitcher', 'UI'];
const root = new Set([...collect([join(LOCALE_DIR, 'layout.tsx'), join(LOCALE_DIR, 'error.tsx')]), ...ALWAYS_ROOT]);
const app = collect(walk(APP_DIR, (f) => ROUTE_FILE.test(f) && !f.startsWith(ADMIN_DIR)));
const admin = collect(walk(ADMIN_DIR, (f) => ROUTE_FILE.test(f)));

const scopes: Record<string, string[]> = {
  root: [...root].sort(),
  app: minus(app, root),
  admin: minus(admin, app, root),
};
// Where each scope's <ClientMessages> must be rendered.
const wrappers: Record<string, string> = {
  app: join(APP_DIR, 'layout.tsx'),
  admin: join(ADMIN_DIR, 'layout.tsx'),
};
const landing = minus(collect([join(LOCALE_DIR, 'page.tsx')]), root);
if (landing.length) {
  scopes.landing = landing;
  wrappers.landing = join(LOCALE_DIR, 'page.tsx');
}
for (const name of readdirSync(LOCALE_DIR).sort()) {
  const dir = join(LOCALE_DIR, name);
  if (name === '(app)' || !statSync(dir).isDirectory()) continue;
  const needed = minus(collect(walk(dir, (f) => ROUTE_FILE.test(f))), root);
  if (!needed.length) continue;
  scopes[name] = needed;
  wrappers[name] = join(dir, 'layout.tsx');
}

for (const [scope, file] of Object.entries(wrappers)) {
  const rel = relative(ROOT, file);
  if (!existsSync(file)) problems.add(`${rel} is missing — scope "${scope}" needs <ClientMessages scope="${scope}">`);
  else if (!read(file).includes(`<ClientMessages scope="${scope}"`)) problems.add(`${rel}: wrap the tree in <ClientMessages scope="${scope}">`);
}

const catalogue = JSON.parse(readFileSync(join(ROOT, 'messages', 'en.json'), 'utf8')) as Record<string, Record<string, unknown>>;
for (const entry of new Set(Object.values(scopes).flat())) {
  const [ns, prefix] = entry.endsWith('*') ? [entry.slice(0, entry.indexOf('.')), entry.slice(entry.indexOf('.') + 1, -1)] : [entry, null];
  if (!(ns in catalogue)) problems.add(`namespace "${ns}" is used in client code but missing from messages/en.json`);
  else if (prefix !== null && !Object.keys(catalogue[ns]).some((k) => k.startsWith(prefix))) problems.add(`"${entry}" matches no key in messages/en.json`);
}

const generated = `// Generated by \`npm run test:i18n-client -- --write\` (src/scripts/test-i18n-client.ts).
// Do not edit by hand: the check fails when these drift from the code.
//
// The message namespaces each <ClientMessages scope> sends to the browser (V2 R9.1), on
// top of what its parent scope already sent. 'Ns.prefix*' = only the keys of Ns that
// start with prefix. root: the locale layout (every page); app: the signed-in shell;
// admin: (app)/admin; any other key: that public route directory under [locale].

export const CLIENT_NAMESPACES = {
${Object.entries(scopes).map(([scope, list]) => `  ${/^\w+$/.test(scope) ? scope : `'${scope}'`}: [${list.map((ns) => `'${ns}'`).join(', ')}],`).join('\n')}
} as const;

export type ClientScope = Exclude<keyof typeof CLIENT_NAMESPACES, 'root'>;
`;

const size = (names: string[]) => names.reduce((sum, ns) => sum + JSON.stringify(catalogue[ns.replace(/\..*$/, '')] ?? {}).length, 0);
console.log(`catalogue ${(JSON.stringify(catalogue).length / 1024).toFixed(1)} KB (en); ≤ per scope (whole namespaces):`);
for (const [scope, list] of Object.entries(scopes)) console.log(`  ${scope.padEnd(16)} ${String(list.length).padStart(2)} ns  ${(size(list) / 1024).toFixed(1)} KB`);

if (problems.size) {
  console.error(`\n${problems.size} problem(s):\n${[...problems].map((p) => `  - ${p}`).join('\n')}`);
  if (!process.argv.includes('--write')) process.exit(1);
}

if (process.argv.includes('--write')) {
  writeFileSync(OUT, generated);
  console.log(`wrote ${relative(ROOT, OUT)}`);
} else if (!existsSync(OUT) || readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') !== generated) {
  console.error(`\n${relative(ROOT, OUT)} is out of date — run: npm run test:i18n-client -- --write`);
  process.exit(1);
} else {
  console.log('ok — client namespace lists match the code');
}
