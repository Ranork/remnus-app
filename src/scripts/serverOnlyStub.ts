// Side-effect import for tsx scripts that load server modules: `server-only` only
// resolves inside Next, so point it at Next's own empty stub. Import it FIRST —
// imports run in order, and anything importing `server-only` before this throws.
import Module from 'module';

const resolver = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = resolver._resolveFilename;
resolver._resolveFilename = (request, ...rest) =>
  resolveFilename(request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);
