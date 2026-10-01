'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createCheckoutSession, cancelSubscription } from '@/lib/actions/billing';
import DemoBillingNotice from './DemoBillingNotice';
import type { PlanTier } from '@/lib/billing/plans';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

const RANK: Record<PlanTier, number> = { free: 0, startup: 1, professional: 2, enterprise: 3 };

type TierDef = {
  tier: PlanTier;
  titleKey: string; priceKey: string; subKey: string | null; featKeys: string[];
};

const TIERS: TierDef[] = [
  { tier: 'free', titleKey: 'bridgePricingFreeTitle', priceKey: 'bridgePricingFreePrice', subKey: null,
    featKeys: ['bridgePricingFreeF1', 'bridgePricingFreeF2', 'bridgePricingFreeF3', 'bridgePricingFreeF4', 'bridgePricingFreeF5'] },
  { tier: 'startup', titleKey: 'bridgePricingStartupTitle', priceKey: 'bridgePricingStartupPrice', subKey: 'bridgePricingStartupPriceSub',
    featKeys: ['bridgePricingStartupF1', 'bridgePricingStartupF2', 'bridgePricingStartupF3', 'bridgePricingStartupF4', 'bridgePricingStartupF5'] },
  { tier: 'professional', titleKey: 'bridgePricingProTitle', priceKey: 'bridgePricingProPrice', subKey: 'bridgePricingProPriceSub',
    featKeys: ['bridgePricingProF1', 'bridgePricingProF2', 'bridgePricingProF3', 'bridgePricingProF4', 'bridgePricingProF5'] },
  { tier: 'enterprise', titleKey: 'bridgePricingEntTitle', priceKey: 'bridgePricingEntPrice', subKey: null,
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="full" className="h-auto sm:h-auto">
        <DialogHeader>
          <DialogTitle>{t('planPickerTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {error && <p role="alert" className="mb-3 text-xs text-red-400">{error}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((def) => {
              const isCurrent = def.tier === currentTier;
              const dir = RANK[def.tier] > RANK[currentTier] ? 'up' : 'down';
              const priceSub = def.subKey ? tl(def.subKey) : null;
              return (
                <div
                  key={def.tier}
                  className={cn(
                    'flex flex-col rounded-surface bg-raised p-4',
                    isCurrent
                      ? 'shadow-[inset_0_0_0_1.5px_var(--color-signal)]'
                      : 'shadow-[inset_0_0_0_1px_var(--color-line)]',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-fg">{tl(def.titleKey)}</span>
                    {isCurrent && <Badge variant="signal" size="sm">{t('current')}</Badge>}
                  </div>

                  <div className="mb-3 flex items-end gap-1">
                    <span className="text-[26px] leading-none font-bold tracking-tight text-fg">{tl(def.priceKey)}</span>
                    {priceSub && <span className="mb-0.5 text-xs text-fg-3">{priceSub}</span>}
                  </div>

                  <ul className="mb-4 flex flex-1 flex-col gap-1.5">
                    {def.featKeys.map((k) => (
                      <li key={k} className="flex items-start gap-1.5 text-xs leading-relaxed text-fg-2">
                        <Check size={14} className="mt-px shrink-0 text-fg-3" />
                        {tl(k)}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button disabled className="w-full">{t('current')}</Button>
                  ) : (
                    <Button
                      variant={def.tier !== 'enterprise' && dir === 'up' ? 'primary' : def.tier === 'free' && confirmFree ? 'danger' : 'secondary'}
                      className="w-full"
                      onClick={() => act(def.tier)}
                      disabled={!!busy && busy !== def.tier}
                      loading={busy === def.tier}
                    >
                      {def.tier === 'enterprise'
                        ? t('contactSales')
                        : def.tier === 'free'
                          ? (confirmFree ? t('downgradeFreeConfirm') : t('downgrade'))
                          : dir === 'up' ? t('upgrade') : t('downgrade')}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DialogBody>

        {demoBlocked && <DemoBillingNotice onClose={() => setDemoBlocked(false)} />}
      </DialogContent>
    </Dialog>
  );
}
