import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { readFileSync } from 'fs';
import { join } from 'path';

type Messages = Record<string, unknown>;

// Deep-merge override onto base (override wins). Used to fall back to English for
// any key a non-default locale has not translated yet, so a partial locale file
// never renders raw key names in the UI.
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const b = out[key];
    const o = override[key];
    if (
      b && o &&
      typeof b === 'object' && typeof o === 'object' &&
      !Array.isArray(b) && !Array.isArray(o)
    ) {
      out[key] = deepMerge(b as Messages, o as Messages);
    } else {
      out[key] = o;
    }
  }
  return out;
}

async function loadMessages(locale: string): Promise<Messages> {
  const isDev = process.env.NODE_ENV === 'development';
  return isDev
    ? JSON.parse(readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'))
    : (await import(`../../messages/${locale}.json`)).default;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as (typeof routing.locales)[number])) {
    locale = routing.defaultLocale;
  }

  const localeMessages = await loadMessages(locale);
  const messages =
    locale === routing.defaultLocale
      ? localeMessages
      : deepMerge(await loadMessages(routing.defaultLocale), localeMessages);

  return { locale, messages };
});
