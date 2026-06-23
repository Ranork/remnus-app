import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'tr', 'hi', 'es', 'fr', 'de', 'zh', 'ru'],
  defaultLocale: 'en',
  localePrefix: 'never',
});

export type Locale = (typeof routing.locales)[number];
