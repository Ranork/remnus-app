// Origin a client used to reach this app. Behind a reverse proxy `next start` builds
// `req.url` from its bind address (e.g. `http://localhost:3000`), so the proxy's
// X-Forwarded-Host / X-Forwarded-Proto win when present. Edge-safe: no Node imports.
export function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = firstValue(req.headers.get('x-forwarded-host')) ?? url.host;
  const proto = firstValue(req.headers.get('x-forwarded-proto')) ?? url.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}

// Chained proxies append, so a header can arrive as `a, b`; the first hop is the client's.
function firstValue(header: string | null): string | null {
  const value = header?.split(',')[0]?.trim();
  return value ? value : null;
}
