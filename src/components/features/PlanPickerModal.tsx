'use client';

import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createCheckoutSession, cancelSubscription } from '@/lib/actions/billing';
import DemoBillingNotice from './DemoBillingNotice';
import type { PlanTier } from '@/lib/billing/plans';

const RANK: Record<PlanTier, number> = { free: 0, startup: 1, professional: 2, enterprise: 3 };

type Accent = 'green' | 'blue' | 'accent' | 'amber';
const ACCENT: Record<Accent, { color: string; tint: string }> = {
  green:  { color: 'var(--color-green-400)',     tint: 'rgba(127,195,109,0.06)' },
  blue:   { color: 'var(--color-blue-500)',      tint: 'rgba(68,92,149,0.10)' },
  accent: { color: 'var(--color-accent-strong)', tint: 'rgba(68,92,149,0.05)' },
  amber:  { color: 'var(--color-amber-500)',     tint: 'rgba(204,125,69,0.06)' },
};

type TierDef = {
  tier: PlanTier; accent: Accent;
  titleKey: string; priceKey: string; subKey: string | null; featKeys: string[];
};

const TIERS: TierDef[] = [
  { tier: 'free', accent: 'green', titleKey: 'bridgePricingFreeTitle', priceKey: 'bridgePricingFreePrice', subKey: null,
    featKeys: ['bridgePricingFreeF1', 'bridgePricingFreeF2', 'bridgePricingFreeF3', 'bridgePricingFreeF4', 'bridgePricingFreeF5'] },
  { tier: 'startup', accent: 'blue', titleKey: 'bridgePricingStartupTitle', priceKey: 'bridgePricingStartupPrice', subKey: 'bridgePricingStartupPriceSub',
    featKeys: ['bridgePricingStartupF1', 'bridgePricingStartupF2', 'bridgePricingStartupF3', 'bridgePricingStartupF4', 'bridgePricingStartupF5'] },
  { tier: 'professional', accent: 'accent', titleKey: 'bridgePricingProTitle', priceKey: 'bridgePricingProPrice', subKey: 'bridgePricingProPriceSub',
    featKeys: ['bridgePricingProF1', 'bridgePricingProF2', 'bridgePricingProF3', 'bridgePricingProF4', 'bridgePricingProF5'] },
  { tier: 'enterprise', accent: 'amber', titleKey: 'bridgePricingEntTitle', priceKey: 'bridgePricingEntPrice', subKey: null,
    featKeys: ['bridgePricingEntF1', 'bridgePricingEntF2', 'bridgePricingEntF3', 'bridgePricingEntF4', 'bridgePricingEntF5'] },
];

export default function PlanPickerModal({ currentTier, isDemo = false, onClose }: { currentTier: PlanTier; isDemo?: boolean; onClose: () => void }) {
  const t = useTranslations('Billing');
  const tl = useTranslations('Landing');
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [confirmFree, setConfirmFree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoBlocked, setDemoBlocked] = useState(false);

  const act = async (tier: PlanTier) => {
    setError(null);
    // Demo accounts can browse pricing, but every plan change is gated behind sign-in.
    if (isDemo) { setDemoBlocked(true); return; }
    if (tier === 'enterprise') { window.location.assign('/contact'); return; }

    if (tier === 'free') {
      if (!confirmFree) { setConfirmFree(true); return; }
      setBusy('free');
      try {
        const r = await cancelSubscription();
        if (r.error) { setError(r.error); setBusy(null); return; }
        window.location.assign('/app');
      } catch { setError(t('actionError')); setBusy(null); }
      return;
    }

    setBusy(tier);
    try {
      const r = await createCheckoutSession(tier);
      if (r.url) { window.location.assign(r.url); return; }
      if (r.error) setError(r.error);
    } catch { setError(t('actionError')); }
    setBusy(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-110 bg-black/70" onClick={onClose} />
      <div className="fixed inset-x-3 top-1/2 -translate-y-1/2 z-110 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-[0_8px_60px_rgba(0,0,0,0.7)] flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 shrink-0">
          <span className="text-sm font-semibold text-neutral-100">{t('planPickerTitle')}</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {error && <p className="m-0 mb-3 text-xs text-red-400">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TIERS.map((def) => {
              const a = ACCENT[def.accent];
              const isCurrent = def.tier === currentTier;
              const dir = RANK[def.tier] > RANK[currentTier] ? 'up' : 'down';
              const priceSub = def.subKey ? tl(def.subKey) : null;
              return (
                <div
                  key={def.tier}
                  className="flex flex-col rounded-lg border p-4"
                  style={{ background: a.tint, borderColor: isCurrent ? a.color : 'var(--color-neutral-800)' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-neutral-100 text-[15px]">{tl(def.titleKey)}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ color: a.color, border: `1px solid ${a.color}` }}>
                        {t('current')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-end gap-1 mb-3">
                    <span className="font-sans font-bold text-neutral-100 text-[26px]" style={{ letterSpacing: '-0.03em', lineHeight: 1 }}>{tl(def.priceKey)}</span>
                    {priceSub && <span className="font-mono text-[10px] text-dim mb-1">{priceSub}</span>}
                  </div>

                  <ul className="flex flex-col gap-1.5 flex-1 mb-4">
                    {def.featKeys.map((k) => (
                      <li key={k} className="flex gap-1.5 items-start text-[12px] text-neutral-50">
                        <Check size={12} className="shrink-0 mt-0.5" style={{ color: a.color }} />
                        {tl(k)}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button disabled className="w-full px-3 py-2 rounded-lg text-[12.5px] font-medium text-neutral-500 border border-neutral-800 cursor-default">
                      {t('current')}
                    </button>
                  ) : (
                    <button
                      onClick={() => act(def.tier)}
                      disabled={!!busy}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-colors disabled:opacity-50"
                      style={
                        def.tier === 'enterprise'
                          ? { border: '1px solid var(--color-neutral-700)', color: 'var(--color-neutral-100)' }
                          : dir === 'up'
                            ? { background: a.color, color: def.accent === 'blue' ? '#fff' : '#1d1f23' }
                            : { border: '1px solid var(--color-neutral-700)', color: 'var(--color-neutral-100)' }
                      }
                    >
                      {busy === def.tier && <Loader2 size={13} className="animate-spin" />}
                      {def.tier === 'enterprise'
                        ? t('contactSales')
                        : def.tier === 'free'
                          ? (confirmFree ? t('downgradeFreeConfirm') : t('downgrade'))
                          : dir === 'up' ? t('upgrade') : t('downgrade')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {demoBlocked && (
        <>
          <div className="fixed inset-0 z-120 bg-black/60" onClick={() => setDemoBlocked(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-120 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm">
            <DemoBillingNotice onClose={() => setDemoBlocked(false)} />
          </div>
        </>
      )}
    </>
  );
}
