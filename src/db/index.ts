import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({
  url: process.env.DATABASE_URL || 'file:local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Apply performance PRAGMAs once at module load (local SQLite only)
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('file:')) {
  client.execute('PRAGMA journal_mode = WAL').catch(() => {});
  client.execute('PRAGMA synchronous = NORMAL').catch(() => {});
  client.execute('PRAGMA foreign_keys = ON').catch(() => {});
  client.execute('PRAGMA cache_size = -20000').catch(() => {});
  client.execute('PRAGMA temp_store = MEMORY').catch(() => {});
}

// Measurement hook for a local server (`npm run bench:web`, V2 R9). A local file database
// answers in microseconds, which hides what a page costs against Turso, where every round
// trip is a network turn. BENCH_DB_RTT_MS delays each round trip by that much, so a route's
// sequential depth shows up in its response time; BENCH_DB_TRACE prints one line per round
// trip, so they can be counted. Only for local file databases — never set in a deployment.
const benchRttMs = Number(process.env.BENCH_DB_RTT_MS ?? 0);
const benchTrace = process.env.BENCH_DB_TRACE === '1';
if ((benchRttMs > 0 || benchTrace) && (process.env.DATABASE_URL ?? 'file:').startsWith('file:')) {
  const target = client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const method of ['execute', 'batch', 'transaction', 'migrate'] as const) {
    const original = target[method]?.bind(client);
    if (!original) continue;
    target[method] = async (...args: unknown[]) => {
      if (benchTrace) {
        const first = args[0];
        const text = typeof first === 'string' ? first : (first as { sql?: string } | undefined)?.sql
          ?? (Array.isArray(first) ? `[${first.length} statements]` : '');
        console.log(`[db-rt] ${Math.round(performance.now())} ${method} ${String(text).replace(/\s+/g, ' ').slice(0, 90)}`);
      }
      if (benchRttMs > 0) await new Promise((resolve) => setTimeout(resolve, benchRttMs));
      return original(...args);
    };
  }
}

export const db = drizzle(client, { schema });
