import type { Locale } from '@/i18n/routing';
import type { SampleText, TemplateText } from './types';

// Loaded per locale on the server, where the content is created. Each locale is its
// own chunk, so a request pays only for its language.

const TEMPLATE_TEXT: Record<Locale, () => Promise<{ default: TemplateText }>> = {
  en: () => import('./templates/en'),
  tr: () => import('./templates/tr'),
  hi: () => import('./templates/hi'),
  es: () => import('./templates/es'),
  fr: () => import('./templates/fr'),
  de: () => import('./templates/de'),
  zh: () => import('./templates/zh'),
  ru: () => import('./templates/ru'),
};

const SAMPLE_TEXT: Record<Locale, () => Promise<{ default: SampleText }>> = {
  en: () => import('./sample/en'),
  tr: () => import('./sample/tr'),
  hi: () => import('./sample/hi'),
  es: () => import('./sample/es'),
  fr: () => import('./sample/fr'),
  de: () => import('./sample/de'),
  zh: () => import('./sample/zh'),
  ru: () => import('./sample/ru'),
};

export async function getTemplateText(locale: Locale): Promise<TemplateText> {
  return (await (TEMPLATE_TEXT[locale] ?? TEMPLATE_TEXT.en)()).default;
}

export async function getSampleText(locale: Locale): Promise<SampleText> {
  return (await (SAMPLE_TEXT[locale] ?? SAMPLE_TEXT.en)()).default;
}
