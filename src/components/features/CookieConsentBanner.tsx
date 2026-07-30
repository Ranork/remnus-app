'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConsent } from '@/components/providers/ConsentContext';

declare global {
  interface Window {
    AccessibilityPreferenceWidget?: {
      configure: (options: { offsetY?: string; offsetX?: string; [key: string]: unknown }) => void;
    };
  }
}

/**
 * Bottom consent bar. Two modes:
 *  - consentRequired (EU/EEA/UK): "Accept" / "Reject" — capture stays off until Accept.
 *  - elsewhere: informational notice with a single "Got it" dismiss (capture already on).
 * Shown only while no choice has been stored.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('Consent');
  const { consent, consentRequired, accept, reject } = useConsent();

  // The accessibility widget (src/app/layout.tsx) sits bottom-left with a
  // corner-hugging default offset. While this banner spans the full width at
  // the bottom, push the widget up so it doesn't overlap the banner's text/
  // buttons; once a choice is stored (now or from a prior visit) drop it back
  // to the corner. Re-applies on the widget's own "mounted" event in case it
  // finishes loading after this effect already ran.
  useEffect(() => {
    const offsetY = consent === null ? '5rem' : '1.25rem';
    const apply = () => window.AccessibilityPreferenceWidget?.configure({ offsetY });
    apply();
    document.addEventListener('accessibility-preference-widget:mounted', apply);
    return () => document.removeEventListener('accessibility-preference-widget:mounted', apply);
  }, [consent]);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] border-t border-neutral-800 bg-neutral-900 px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-neutral-50">
          <span className="shrink-0 text-base leading-5" aria-hidden>🍪</span>
          <p className="min-w-0">
            <span className="font-medium text-neutral-100">{t('title')}</span>{' '}
            <span className="text-neutral-50/80">
              {consentRequired ? t('descriptionRequired') : t('descriptionInformational')}
            </span>{' '}
            <Link
              href="/privacy"
              className="text-blue-500 underline-offset-2 hover:underline"
            >
              {t('learnMore')}
            </Link>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {consentRequired ? (
            <>
              <button
                type="button"
                onClick={reject}
                className="px-3 py-1.5 text-sm font-medium text-neutral-50 transition-colors hover:text-neutral-100"
              >
                {t('reject')}
              </button>
              <button
                type="button"
                onClick={accept}
                className="bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500/90"
              >
                {t('accept')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={accept}
              className="bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500/90"
            >
              {t('gotIt')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
