'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CheckCircle2, Users, Bot, HardDrive, ScrollText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { reconcileMySubscription } from '@/lib/actions/billing';
import type { PlanTier } from '@/lib/billing/plans';

type Sub = Awaited<ReturnType<typeof reconcileMySubscription>>;

function formatBytes(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

const TIER_ACCENT: Record<PlanTier, string> = {
  free: 'var(--color-green-400)',
  startup: 'var(--color-blue-500)',
  professional: 'var(--color-accent-strong)',
  enterprise: 'var(--color-amber-500)',
};

// Shown once after a successful Stripe Checkout (lands on any page with ?billing=success).
export default function BillingSuccessModal() {
  const t = useTranslations('Billing');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const show = params.get('billing') === 'success';

  const [data, setData] = useState<Sub | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (!show || fetched.current) return;
    fetched.current = true;
    let cancelled = false;
    // Reconcile directly from Stripe (source of truth) instead of waiting on the
    // webhook — robust to delayed/unreachable webhooks. A fresh checkout's subscription
    // is normally live in Stripe by the time we land here, so the first call resolves;
    // we still retry a few times (max ~5s) in case it's a beat behind.
    const poll = async (attempt = 0) => {
      try {
        const sub = await reconcileMySubscription();
        if (cancelled) return;
        setData(sub);
        if (sub.tier === 'free' && attempt < 4) setTimeout(() => poll(attempt + 1), 1200);
      } catch {
        if (!cancelled && attempt < 4) setTimeout(() => poll(attempt + 1), 1200);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [show]);

  if (!show) return null;

  const close = () => router.replace(pathname);

  const tier = data?.tier ?? 'startup';
  const val = (n: number) => (isFinite(n) ? String(n) : t('unlimited'));
  const limits = data?.limits;

  return (
    <>
      <div className="fixed inset-0 z-200 bg-black/70" onClick={close} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-200 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] p-7 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(127,195,109,0.12)', border: '1px solid rgba(127,195,109,0.3)' }}
        >
          <CheckCircle2 size={30} className="text-green-400" />
        </div>

        {!data ? (
          <div className="py-8"><Loader2 size={20} className="animate-spin text-neutral-500" /></div>
        ) : (
          <>
            <h2 className="m-0 text-lg font-semibold text-neutral-100">{t('successTitle')}</h2>
            <span
              className="mt-2.5 text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{ color: TIER_ACCENT[tier], borderColor: TIER_ACCENT[tier], background: 'rgba(255,255,255,0.03)' }}
            >
              {t(`tier_${tier}` as 'tier_free')}
            </span>
            <p className="m-0 mt-3 text-[13.5px] text-neutral-400 leading-relaxed">{t('successBody')}</p>

            <div className="w-full mt-5 mb-6 flex flex-col gap-2.5 text-left">
              <Feat icon={<Users size={14} />} text={t('featSeats', { value: val(limits!.seats) })} />
              <Feat icon={<Bot size={14} />} text={t('featAgents', { value: val(limits!.agents) })} />
              <Feat icon={<HardDrive size={14} />} text={t('featStorage', { value: formatBytes(limits!.storageBytes) })} />
              <Feat icon={<ScrollText size={14} />} text={t('featAudit', { value: val(limits!.auditDays) })} />
            </div>

            <button
              onClick={close}
              className="w-full inline-flex items-center justify-center px-5 py-3 rounded-lg text-[13.5px] font-semibold text-ink-fg bg-ink hover:opacity-90 transition-opacity"
            >
              {t('successCta')}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Feat({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13.5px] text-neutral-100">
      <span className="text-green-400 shrink-0">{icon}</span>
      {text}
    </div>
  );
}
