'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createCheckoutSession } from '@/lib/actions/billing';
import DemoBillingNotice from '@/components/features/DemoBillingNotice';
import type { PlanTier } from '@/lib/billing/plans';

interface Props {
  tier: PlanTier;
  isAuthed: boolean;
  isDemo?: boolean;
  href: string;          // fallback link (guests / free / enterprise)
  label: string;
  variant: 'solid' | 'outline';
  accentColor: string;   // solid background
  solidTextLight: boolean;
}

// Paid tiers, when the visitor is logged in, start a Stripe Checkout directly.
// Everyone else just follows the link (sign up / contact / go to app).
export default function PricingCtaButton({ tier, isAuthed, isDemo = false, href, label, variant, accentColor, solidTextLight }: Props) {
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const isPaid = tier === 'startup' || tier === 'professional';

  const base = 'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[13.5px] transition-colors duration-150';
  const cls = variant === 'solid'
    ? `${base} font-semibold`
    : `${base} border border-neutral-700 font-medium text-neutral-100 hover:border-neutral-500`;
  const style = variant === 'solid'
    ? { background: accentColor, color: solidTextLight ? '#fff' : '#1d1f23' }
    : undefined;

  if (!isPaid || !isAuthed) {
    return (
      <Link href={href} className={cls} style={style}>
        {label}
        <span aria-hidden>→</span>
      </Link>
    );
  }

  // Demo accounts can see pricing but can't check out — invite them to sign in instead.
  if (isDemo) {
    return (
      <>
        <button type="button" onClick={() => setDemoOpen(true)} className={cls} style={style}>
          {label}
          <span aria-hidden>→</span>
        </button>
        {demoOpen && (
          <>
            <div className="fixed inset-0 z-100 bg-black/60" onClick={() => setDemoOpen(false)} />
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm">
              <DemoBillingNotice onClose={() => setDemoOpen(false)} />
            </div>
          </>
        )}
      </>
    );
  }

  const onClick = async () => {
    setBusy(true);
    try {
      const res = await createCheckoutSession(tier);
      if (res.url) { window.location.href = res.url; return; }
      window.location.href = href; // fallback if billing unavailable
    } catch {
      window.location.href = href;
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={onClick} disabled={busy} className={`${cls} disabled:opacity-60`} style={style}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {label}
      {!busy && <span aria-hidden>→</span>}
    </button>
  );
}
