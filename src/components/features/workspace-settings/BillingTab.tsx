'use client';
import { useTranslations } from 'next-intl';
import { CreditCard, ArrowRight } from 'lucide-react';

interface BillingTabProps {
  /** Closes Workspace Settings and opens the global Billing center. */
  onOpenBilling: () => void;
}

/**
 * Thin redirect tab. Billing is per-user (the billing owner's seat pool), so it
 * lives in the global {@link BillingModal} rather than a per-workspace surface.
 */
export default function BillingTab({ onOpenBilling }: BillingTabProps) {
  const t = useTranslations('Billing');

  return (
    <div className="space-y-6">
      <div className="border border-signal/20 rounded-xl p-5 space-y-4 bg-signal/5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-signal/10 border border-signal/20 flex items-center justify-center shrink-0 mt-0.5">
            <CreditCard size={16} className="text-signal-text" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-neutral-100">{t('tabHeroTitle')}</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">{t('tabHeroSubtitle')}</p>
          </div>
        </div>

        <button
          onClick={onOpenBilling}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-ink-fg bg-ink hover:bg-ink/88 px-5 py-3 rounded-lg transition-colors"
        >
          <CreditCard size={16} />
          {t('openBilling')}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
