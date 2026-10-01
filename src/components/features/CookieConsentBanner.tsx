'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useConsent } from '@/components/providers/ConsentContext';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    AccessibilityPreferenceWidget?: {
      configure: (options: { offsetY?: string; offsetX?: string; [key: string]: unknown }) => void;
    };
  }
}

/**
 * Bottom consent strip. Two modes:
 *  - consentRequired (EU/EEA/UK): "Accept" / "Reject" — capture stays off until Accept.
 *  - elsewhere: informational notice with a single "Got it" dismiss (capture already on).
 * Shown only while no choice has been stored.
 *
 * A thin strip on the desk along the bottom edge (V2 R8.6): one line from `sm` (text
 * left, buttons right), two on a phone. It sits under the app's sheet like the rest of
 * the desk, and its height is published so anything pinned to the bottom of the screen
 * can stand on it instead of under it.
 */
export default function CookieConsentBanner() {
  const t = useTranslations('Consent');
  const { consent, consentRequired, accept, reject } = useConsent();

  // While the strip is up its height is published as `--consent-banner-height`, so
  // things pinned to the bottom of the screen (the knowledge map's selection card,
  // toasts, the demo feedback card) sit above it instead of under it. 0 once a choice
  // is stored. The accessibility widget (src/app/layout.tsx, public pages) sits in the
  // bottom-left corner: it is lifted by the same height, and dropped back to its corner
  // offset once the strip is gone. Re-applied on the widget's own "mounted" event in
  // case it loads after this effect ran.
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    const bar = barRef.current;
    const placeWidget = (height: number) =>
      window.AccessibilityPreferenceWidget?.configure({ offsetY: height > 0 ? `${height + 12}px` : '1.25rem' });

    if (!bar) {
      root.style.setProperty('--consent-banner-height', '0px');
      const apply = () => placeWidget(0);
      apply();
      document.addEventListener('accessibility-preference-widget:mounted', apply);
      return () => document.removeEventListener('accessibility-preference-widget:mounted', apply);
    }

    const publish = () => {
      root.style.setProperty('--consent-banner-height', `${bar.offsetHeight}px`);
      placeWidget(bar.offsetHeight);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(bar);
    document.addEventListener('accessibility-preference-widget:mounted', publish);
    return () => {
      observer.disconnect();
      document.removeEventListener('accessibility-preference-widget:mounted', publish);
      root.style.setProperty('--consent-banner-height', '0px');
    };
  }, [consent]);

  if (consent !== null) return null;

  return (
    <div
      ref={barRef}
      role="region"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-[120] border-t border-line bg-desk px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        {/* The title names the region for screen readers; on screen the sentence says it. */}
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-fg-2">
          {consentRequired ? t('descriptionRequired') : t('descriptionInformational')}{' '}
          <Link href="/privacy" className="whitespace-nowrap text-fg underline underline-offset-2 hover:text-fg-2">
            {t('learnMore')}
          </Link>
        </p>

        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {consentRequired ? (
            <>
              <Button variant="ghost" size="sm" onClick={reject}>
                {t('reject')}
              </Button>
              <Button variant="primary" size="sm" onClick={accept}>
                {t('accept')}
              </Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={accept}>
              {t('gotIt')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
