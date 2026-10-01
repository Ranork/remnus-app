'use client';

import { useEffect, useState } from 'react';
import { Users, Bot, HardDrive, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getMySubscription, createPortalSession } from '@/lib/actions/billing';
import PlanPickerModal from './PlanPickerModal';
import PoolPeopleSection from './PoolPeopleSection';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';
import { cn } from '@/lib/cn';

type Usage = Awaited<ReturnType<typeof getMySubscription>>;

function formatBytes(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export default function BillingModal({ isDemo = false, initialPickerOpen = false, onClose }: { isDemo?: boolean; initialPickerOpen?: boolean; onClose: () => void }) {
  const t = useTranslations('Billing');
  const [data, setData] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(initialPickerOpen);

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          {loading ? (
            <div role="status" className="flex justify-center py-10">
              <Loader2 size={18} className="animate-spin text-fg-3" />
            </div>
          ) : !data ? (
            <p role="alert" className="text-ui text-red-400">{error ?? t('loadError')}</p>
          ) : (
            <SettingsPage>
              <SettingsSection>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-fg-3">{t('currentPlan')}</p>
                    <p className="mt-0.5 text-lg font-semibold text-fg">{tierLabel}</p>
                  </div>
                  {data.status !== 'active' && (
                    <Badge variant="warning">{t(`status_${data.status}` as 'status_past_due')}</Badge>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <Meter icon={<Users size={14} />} label={t('seats')} used={data.usage.seats.used} limit={data.usage.seats.limit} />
                  <Meter icon={<Bot size={14} />} label={t('agents')} used={data.usage.agents.used} limit={data.usage.agents.limit} />
                  <Meter
                    icon={<HardDrive size={14} />}
                    label={t('storage')}
                    used={data.usage.storageBytes.used}
                    limit={data.usage.storageBytes.limit}
                    format={formatBytes}
                  />
                </div>
              </SettingsSection>

              <PoolPeopleSection />

              {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            </SettingsPage>
          )}
        </DialogBody>

        {data && (
          <DialogFooter>
            {!isDemo && (
              <Button onClick={() => go(createPortalSession, 'portal')} disabled={!!busy && busy !== 'portal'} loading={busy === 'portal'}>
                <ExternalLink />
                {t('manageBilling')}
              </Button>
            )}
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              {t('changePlan')}
            </Button>
          </DialogFooter>
        )}

        {pickerOpen && data && (
          <PlanPickerModal currentTier={tier} isDemo={isDemo} onClose={() => setPickerOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
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
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-fg-2 [&_svg]:text-fg-3">{icon}{label}</span>
        <span className={over ? 'font-medium text-amber-400' : 'text-fg-3'}>
          {fmt(used)} / {unlimited ? t('unlimited') : fmt(limit)}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 overflow-hidden rounded-full bg-hover">
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', over ? 'bg-amber-400' : 'bg-fg-2')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
