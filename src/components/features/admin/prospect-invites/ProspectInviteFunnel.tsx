'use client';

// Created → Opened → Claimed funnel for outreach invites. Mirrors
// AdminActivationFunnel.tsx's exact composition (date-filter chip/input +
// shared FunnelList) — same UX for "since date" narrowing, just scoped to
// getProspectInvitesOverview(sinceMs) instead of getActivationFunnel(sinceMs).

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getProspectInvitesOverview, type ProspectInvitesOverview } from '@/lib/actions/prospectInvites';
import FunnelList from '../FunnelList';

export default function ProspectInviteFunnel({ initialCounts }: { initialCounts: ProspectInvitesOverview['counts'] }) {
  const t = useTranslations('ProspectInvites');
  const [sinceDate, setSinceDate] = useState(''); // yyyy-mm-dd from <input type="date">; '' = all time
  const [counts, setCounts] = useState(initialCounts);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (sinceDate === '') {
      setCounts(initialCounts);
      return;
    }
    const sinceMs = new Date(`${sinceDate}T00:00:00`).getTime();
    if (isNaN(sinceMs)) return;

    let alive = true;
    startTransition(() => {
      getProspectInvitesOverview(sinceMs)
        .then((o) => {
          if (alive) setCounts(o.counts);
        })
        .catch(() => {
          if (alive) setCounts(initialCounts);
        });
    });
    return () => {
      alive = false;
    };
  }, [sinceDate, initialCounts]);

  const claimed = counts.active + counts.reverted;

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
            className="rounded-md border border-neutral-800 bg-neutral-850 px-2 py-1 text-[11px] text-neutral-200 scheme-dark"
          />
        </label>
        {isPending && <span className="text-neutral-600">…</span>}
      </div>
      <FunnelList
        stages={[
          { label: t('funnelCreated'), count: counts.total },
          { label: t('funnelOpened'), count: counts.opened },
          { label: t('funnelClaimed'), count: claimed },
        ]}
      />
    </div>
  );
}
