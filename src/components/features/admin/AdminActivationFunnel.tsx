'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getActivationFunnel } from '@/lib/actions/analytics';
import type { ActivationFunnel } from '@/lib/actions/analytics';

// ── Activation funnel — compact 3-row list (stacked under User Acquisition) ─
function ActivationFunnelList({ stages }: { stages: { label: string; count: number }[] }) {
  const base = Math.max(1, stages[0]?.count ?? 0);
  return (
    <div className="flex flex-col">
      {stages.map((s, i) => {
        const prev = i === 0 ? null : stages[i - 1].count;
        const conv = prev == null ? null : prev === 0 ? 0 : Math.round((s.count / prev) * 100);
        const widthPct = Math.max(4, Math.round((s.count / base) * 100));
        return (
          <div
            key={s.label}
            className={`flex flex-col gap-1.5 py-2.5 ${i < stages.length - 1 ? 'border-b border-neutral-800/70' : 'pb-0.5'} ${i === 0 ? 'pt-0.5' : ''}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-300">{s.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-neutral-100">{s.count}</span>
                {conv != null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      conv >= 50 ? 'bg-green-500/12 text-green-400' : conv >= 25 ? 'bg-amber-500/12 text-amber-400' : 'bg-red-500/12 text-red-400'
                    }`}
                  >
                    {conv}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-neutral-850">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Activation funnel card. Renders the all-time funnel computed server-side
 * (`initialFunnel`) by default, and lets the admin narrow it to signups
 * on/after a chosen date — e.g. to see conversion since an onboarding change —
 * by re-calling `getActivationFunnel(sinceMs)` client-side.
 */
export default function AdminActivationFunnel({ initialFunnel }: { initialFunnel: ActivationFunnel }) {
  const t = useTranslations('Admin');
  const [sinceDate, setSinceDate] = useState(''); // yyyy-mm-dd from <input type="date">; '' = all time
  const [funnel, setFunnel] = useState(initialFunnel);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (sinceDate === '') {
      setFunnel(initialFunnel);
      return;
    }
    const sinceMs = new Date(`${sinceDate}T00:00:00`).getTime();
    if (isNaN(sinceMs)) return;

    let alive = true;
    startTransition(() => {
      getActivationFunnel(sinceMs)
        .then((f) => {
          if (alive) setFunnel(f);
        })
        .catch(() => {
          if (alive) setFunnel(initialFunnel);
        });
    });
    return () => {
      alive = false;
    };
  }, [sinceDate, initialFunnel]);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => setSinceDate('')}
          className={`rounded-full px-2.5 py-1 font-medium transition-colors cursor-pointer ${
            sinceDate === '' ? 'bg-blue-500/15 text-blue-400' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {t('funnelFilterAllTime')}
        </button>
        <label className="flex items-center gap-1.5 text-neutral-500">
          {t('funnelFilterSince')}
          <input
            type="date"
            value={sinceDate}
            max={today}
            onChange={(e) => setSinceDate(e.target.value)}
            className="rounded-md border border-neutral-800 bg-neutral-850 px-2 py-1 text-[11px] text-neutral-200 [color-scheme:dark]"
          />
        </label>
        {isPending && <span className="text-neutral-600">…</span>}
      </div>
      <ActivationFunnelList
        stages={[
          { label: t('funnelSignup'), count: funnel.signups },
          { label: t('funnelConnected'), count: funnel.connected },
          { label: t('funnelActivated'), count: funnel.activated },
        ]}
      />
    </div>
  );
}
