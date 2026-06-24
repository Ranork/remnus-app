'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { reportClientError } from '@/lib/reportClientError';

/**
 * Error boundary for everything under `[locale]` (marketing, share, auth, and
 * the in-app routes). Renders inside `[locale]/layout` so providers — including
 * `NextIntlClientProvider` and PostHog — are available, which lets it both
 * localize the recovery UI and report the crash. A render error here degrades to
 * this branded panel instead of nuking the whole app to the bare browser screen.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors');
  const router = useRouter();

  useEffect(() => {
    reportClientError(error, { boundary: 'locale' });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <AlertTriangle className="mb-5 h-9 w-9 text-amber-500" strokeWidth={1.5} />
      <h1 className="text-2xl font-semibold text-neutral-50">{t('crashTitle')}</h1>
      <p className="mt-2 max-w-md text-sm text-neutral-100/70">{t('crashBody')}</p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90"
        >
          {t('crashReload')}
        </button>
        <button
          onClick={() => router.back()}
          className="rounded-md border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-50 transition-colors hover:bg-neutral-800/40"
        >
          {t('crashBack')}
        </button>
      </div>
    </div>
  );
}
