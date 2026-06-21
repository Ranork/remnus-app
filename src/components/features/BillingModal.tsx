'use client';

import { useEffect, useState } from 'react';
import { X, CreditCard, Users, Bot, HardDrive, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getMySubscription, createPortalSession } from '@/lib/actions/billing';
import PlanPickerModal from './PlanPickerModal';
import PoolPeopleSection from './PoolPeopleSection';
import type { PlanTier } from '@/lib/billing/plans';

type Usage = Awaited<ReturnType<typeof getMySubscription>>;

function formatBytes(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

const TIER_ACCENT: Record<PlanTier, string> = {
  free: 'var(--color-green-400)',
  startup: 'var(--color-blue-500)',
  professional: 'var(--color-accent-strong)',
  enterprise: 'var(--color-amber-500)',
};

export default function BillingModal({ isDemo = false, onClose }: { isDemo?: boolean; onClose: () => void }) {
  const t = useTranslations('Billing');
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    getMySubscription()
      .then(setData)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const go = async (fn: () => Promise<{ url?: string; error?: string }>, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      if (res.url) { window.location.href = res.url; return; }
      if (res.error) setError(res.error);
    } catch {
      setError(t('actionError'));
    } finally {
      setBusy(null);
    }
  };

  const tier = data?.tier ?? 'free';
  const tierLabel = t(`tier_${tier}` as 'tier_free');

  return (
    <>
      <div className="fixed inset-0 z-100 bg-black/60" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-100 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-neutral-300" />
            <span className="text-sm font-semibold text-neutral-100">{t('title')}</span>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-neutral-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-sm text-red-400">{error ?? t('loadError')}</p>
          ) : (
            <>
              {/* Current plan */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="m-0 text-[11px] uppercase tracking-wider text-neutral-500">{t('currentPlan')}</p>
                  <p className="m-0 mt-0.5 text-lg font-semibold text-neutral-100" style={{ color: TIER_ACCENT[tier] }}>
                    {tierLabel}
                  </p>
                </div>
                {data.status !== 'active' && (
                  <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25">
                    {t(`status_${data.status}` as 'status_past_due')}
                  </span>
                )}
              </div>

              {/* Usage meters */}
              <div className="flex flex-col gap-3 mb-6">
                <Meter icon={<Users size={13} />} label={t('seats')} used={data.usage.seats.used} limit={data.usage.seats.limit} />
                <Meter icon={<Bot size={13} />} label={t('agents')} used={data.usage.agents.used} limit={data.usage.agents.limit} />
                <Meter
                  icon={<HardDrive size={13} />}
                  label={t('storage')}
                  used={data.usage.storageBytes.used}
                  limit={data.usage.storageBytes.limit}
                  format={formatBytes}
                />
              </div>

              {/* People & seats */}
              <div className="mb-6">
                <PoolPeopleSection />
              </div>

              {error && <p className="m-0 mb-3 text-xs text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-blue-500 hover:opacity-90 transition-opacity"
                >
                  {t('changePlan')}
                </button>
                {!isDemo && (
                  <button
                    onClick={() => go(createPortalSession, 'portal')}
                    disabled={!!busy}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {busy === 'portal' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={13} />}
                    {t('manageBilling')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {pickerOpen && data && (
        <PlanPickerModal currentTier={tier} isDemo={isDemo} onClose={() => setPickerOpen(false)} />
      )}
    </>
  );
}

function Meter({
  icon, label, used, limit, format,
}: { icon: React.ReactNode; label: string; used: number; limit: number; format?: (n: number) => string }) {
  const t = useTranslations('Billing');
  const unlimited = !isFinite(limit);
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  const fmt = format ?? ((n: number) => String(n));
  const over = !unlimited && used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-[12.5px]">
        <span className="flex items-center gap-1.5 text-neutral-300">{icon}{label}</span>
        <span className={over ? 'text-amber-400 font-medium' : 'text-neutral-400'}>
          {fmt(used)} / {unlimited ? t('unlimited') : fmt(limit)}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: over ? 'var(--color-amber-500)' : 'var(--color-blue-500)' }}
          />
        </div>
      )}
    </div>
  );
}
