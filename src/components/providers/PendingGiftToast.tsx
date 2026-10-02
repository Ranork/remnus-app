'use client';

// Floating reminder for a not-yet-logged-in visitor who came from a Prospect
// Invite link, browsed away from /welcome/[token] to explore the site first,
// and shouldn't lose track of the gift while doing that. Mounted site-wide
// for logged-out visitors (see [locale]/layout.tsx, same branch as
// AttributionCapture) — once someone IS logged in, this no longer applies
// (they've either already gone through the real auto-claim flow, or they're
// an unrelated existing account for whom "explore before signing up" isn't
// the scenario). Positioned top-right rather than bottom — the bottom of the
// screen is already claimed by CookieConsentBanner (z-[120], full-width) and
// the accessibility widget; top avoids fighting either for space.
//
// Collapsed = one compact row. Hovering (or focusing inside) expands it downward
// into a preview that mirrors /welcome/[token] itself (co-brand lockup, the gift
// headline, the pitch, the plan badges) — not a zoom, an actual reveal of the same
// content the invite page shows, using a CSS grid-rows 0fr→1fr transition so it
// animates to its natural height instead of a guessed max-height.
//
// V2 R8.6: a floating surface like a menu (bg-float, shadow-float); the gift icon on
// a signal-soft disc is the one warm spot — no glow, no gold border.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { X, Gift } from 'lucide-react';
import { readPendingGift, clearPendingGift, type PendingGift } from '@/lib/prospectInvite/pendingGift';
import { PLAN_LIMITS } from '@/lib/billing/plans';
import { GiftLockup } from '@/components/features/auth/GiftLockup';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';

export default function PendingGiftToast() {
  const t = useTranslations('ProspectInvites');
  const tBilling = useTranslations('Billing');
  const pathname = usePathname();
  const [gift, setGift] = useState<PendingGift | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Re-check on every navigation: covers both "just left /welcome/[token]"
  // (marker was written moments ago) and a later dismissal expiring naturally.
  useEffect(() => {
    setGift(readPendingGift());
  }, [pathname]);

  const onWelcomePage = pathname?.includes('/welcome/');
  if (!gift || dismissed || onWelcomePage) return null;

  const dismiss = () => {
    setDismissed(true);
    clearPendingGift();
  };

  // See the matching comment in welcome/[token]/page.tsx — bare "Startup"/
  // "Professional" reads ambiguously to a prospect, so this reuses the same
  // tierPlanLabel wrapper ("{tier} Plan") rather than the raw Billing label.
  const rawTierLabel = tBilling(gift.giftTier === 'professional' ? 'tier_professional' : 'tier_startup');
  const tierLabel = t('tierPlanLabel', { tier: rawTierLabel });
  const limits = PLAN_LIMITS[gift.giftTier];
  const seatsLabel = limits.seats === Infinity ? t('unlimitedLabel') : String(limits.seats);
  const agentsLabel = limits.agents === Infinity ? t('unlimitedLabel') : String(limits.agents);

  return (
    <div className="fixed inset-x-4 top-20 z-90 animate-fade-in animate-duration-200 sm:inset-x-auto sm:right-4 sm:w-90">
      <div className="group overflow-hidden rounded-surface bg-float text-fg-2 shadow-float">
        {/* Collapsed row — always visible */}
        <div className="flex items-center gap-3 py-2.5 pr-2 pl-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal-soft text-signal-text">
            <Gift size={16} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 truncate text-ui font-medium text-fg">
            {t('toastText', { days: gift.giftDays, appName: gift.appName })}
          </p>
          <Link href={`/welcome/${gift.token}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            {t('toastCta')}
          </Link>
          <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label={t('toastDismiss')}>
            <X />
          </Button>
        </div>

        {/* Hover/focus-expand preview — grid-rows 0fr→1fr animates to natural height. */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-focus-within:grid-rows-[1fr] group-hover:grid-rows-[1fr] motion-reduce:transition-none">
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-line px-4 pt-3.5 pb-4">
              <GiftLockup appName={gift.appName} appLogoUrl={gift.appLogoUrl} size="sm" />
              <div className="flex flex-col gap-1">
                <p className="text-sm leading-snug font-semibold text-fg">
                  {t('giftLine', { days: gift.giftDays, tier: tierLabel })}
                </p>
                <p className="text-xs leading-relaxed text-fg-3">{t('pitchLine')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{t('chipSeats', { count: seatsLabel })}</Badge>
                <Badge>{t('chipAgents', { count: agentsLabel })}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
