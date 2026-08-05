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
// Collapsed = one compact row. Hovering expands it downward into a preview
// that mirrors /welcome/[token] itself (co-brand logos, the gift headline,
// the pitch, the plan chips) — not a zoom, an actual reveal of the same
// content the invite page shows, using a CSS grid-rows 0fr→1fr transition so
// it animates to its natural height instead of a guessed max-height.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X, Gift } from 'lucide-react';
import { readPendingGift, clearPendingGift, type PendingGift } from '@/lib/prospectInvite/pendingGift';
import { PLAN_LIMITS } from '@/lib/billing/plans';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-800 bg-neutral-850 px-2.5 py-0.5 text-[11px] text-neutral-300">
      {children}
    </span>
  );
}

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
    <div className="fixed inset-x-4 top-20 z-90 animate-fade-in animate-duration-200 sm:inset-x-auto sm:right-4">
      <div
        className="pending-gift-toast group relative mx-auto max-w-sm overflow-hidden rounded-xl border bg-neutral-900/95 shadow-lg backdrop-blur"
        style={{ borderColor: 'color-mix(in oklab, var(--color-opt-yellow) 40%, transparent)' }}
      >
        {/* Same accent-glow technique as the landing page's "No API keys." strip
            (LandingSetup.tsx) — a gift deserves to visually pop, not blend into
            the neutral chrome everything else on the page uses. Unlike that
            strip this isn't scoped under .marketing-site, so light mode isn't
            covered by its remap — the pending-gift-toast* classes get their
            own catppuccin tuning in globals.css (gold reads fine on near-black
            but washes out on near-white without a stronger mix + a tinted glow). */}
        <div
          aria-hidden
          className="pending-gift-toast-glow pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(220px circle at 12% 20%, color-mix(in oklab, var(--color-opt-yellow) 20%, transparent), transparent 70%)' }}
        />
        {/* Collapsed row — always visible */}
        <div className="relative flex items-center gap-3 px-4 py-3">
          <div
            className="pending-gift-toast-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in oklab, var(--color-opt-yellow) 18%, transparent)' }}
          >
            <Gift size={16} style={{ color: 'var(--color-opt-yellow)' }} />
          </div>
          <p className="m-0 min-w-0 flex-1 truncate text-[12.5px] font-medium text-neutral-100">
            {t('toastText', { days: gift.giftDays, appName: gift.appName })}
          </p>
          <Link
            href={`/welcome/${gift.token}`}
            className="shrink-0 rounded-lg bg-blue-500 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t('toastCta')}
          </Link>
          <button
            onClick={dismiss}
            aria-label={t('toastDismiss')}
            className="shrink-0 rounded-lg p-1 text-neutral-500 hover:text-neutral-300"
          >
            <X size={14} />
          </button>
        </div>

        {/* Hover-expand preview — grid-rows 0fr→1fr animates to natural height.
            `relative` so it paints above the absolute glow behind it (same
            reason the collapsed row above needs it too). */}
        <div className="relative grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out group-hover:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <div className="flex flex-col items-center gap-2.5 border-t border-neutral-800 px-4 pb-4 pt-3.5 text-center">
              <div className="flex items-center gap-2">
                <img src="/logo-square-dark.png" alt="Remnus" className="h-7 w-7 rounded-lg object-contain" />
                <span className="text-neutral-700">×</span>
                {gift.appLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Scout Forge asset
                  <img src={gift.appLogoUrl} alt={gift.appName} className="h-7 w-7 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-[11px] font-semibold text-blue-300">
                    {gift.appName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="m-0 text-[13.5px] font-bold leading-tight text-neutral-50">
                {t('giftLine', { days: gift.giftDays, tier: tierLabel })}
              </p>
              <p className="m-0 text-[12px] leading-relaxed text-neutral-400">{t('pitchLine')}</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Chip>{t('chipSeats', { count: seatsLabel })}</Chip>
                <Chip>{t('chipAgents', { count: agentsLabel })}</Chip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
