import { cookies, headers } from 'next/headers';
import { routing, type Locale } from './routing';

const LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';
const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

/** The best supported locale an `Accept-Language` header asks for, by its q weights. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if (isLocale(primary)) return primary;
  }
  return null;
}

/**
 * The language of the current request, for data a server path writes on the user's
 * behalf (template content, default names, the sample workspace).
 *
 * `getLocale()` only knows the locale when the intl middleware ran: server actions do,
 * route handlers (`/api/*`) and Auth.js events do not — there it silently answers the
 * default locale. This resolves the way the middleware does (its header, then the
 * locale cookie, then `Accept-Language`), so every server path gets the same answer.
 */
export async function getRequestLocale(): Promise<Locale> {
  try {
    const headerStore = await headers();
    const fromMiddleware = headerStore.get(LOCALE_HEADER);
    if (isLocale(fromMiddleware)) return fromMiddleware;
    const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
    return localeFromAcceptLanguage(headerStore.get('accept-language')) ?? routing.defaultLocale;
  } catch {
    // Outside a request (a script): the default locale.
    return routing.defaultLocale;
  }
}
