// Thin read-only client for Scout Forge's public app-catalog API. Used by the
// Prospect Invites admin flow to auto-fetch an app's name/logo/tagline from
// its `idstr` (the slug in its scoutforge.net/apps/<idstr> URL), so the admin
// doesn't have to hand-copy them. GET /app?idstr= is confirmed PUBLIC and
// unauthenticated in scoutforge-api (AppRoute registers only POST/PUT/DELETE
// with `{ login: true }` — GET has no permission gate), so this is a plain
// server-to-server fetch: no API key, no CORS concern (never called from the
// browser). Response envelope is `{"Success": bool, "Data": {...}}` (capitalized
// keys — scoutforge-api's Response.success/error convention, not ours).

const SCOUTFORGE_API_BASE_URL = process.env.SCOUTFORGE_API_BASE_URL || 'https://api.scoutforge.net';

export interface ScoutForgeAppInfo {
  idstr: string;
  name: string;
  shortDescription: string | null;
  logoUrl: string | null;
  url: string | null;
}

/**
 * Looks up a Scout Forge app by its idstr. Returns null on not-found, network
 * error, or an unexpected response shape — callers turn that into a single
 * user-facing "app not found" message rather than distinguishing causes.
 */
export async function fetchScoutForgeApp(idstr: string): Promise<ScoutForgeAppInfo | null> {
  const trimmed = idstr.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(`${SCOUTFORGE_API_BASE_URL}/app?idstr=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const app = json?.Data;
    if (!json?.Success || !app?.name) return null;

    return {
      idstr: app.idstr ?? trimmed,
      name: app.name,
      shortDescription: app.shortDescription ?? null,
      logoUrl: app.logoUrl ?? null,
      url: app.url ?? null,
    };
  } catch {
    return null;
  }
}
