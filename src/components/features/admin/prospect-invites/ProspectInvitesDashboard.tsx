'use client';

// Admin Prospect Invites dashboard (client orchestrator): stat cards, the
// invite composer/manager and the status table. Mirrors MailingDashboard.tsx
// (same shape: server page hands down `initial`, client refreshes via the
// overview action after mutations).

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gift, Clock, CheckCircle2, RotateCcw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getProspectInvitesOverview, type ProspectInvitesOverview } from '@/lib/actions/prospectInvites';
import InviteManager from './InviteManager';
import InviteStatusTable from './InviteStatusTable';

function StatCard({
  icon: Icon,
  label,
  value,
  accent = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: 'blue' | 'green' | 'amber' | 'neutral';
}) {
  const cls = {
    blue: 'text-blue-400 bg-blue-500/12',
    green: 'text-green-400 bg-green-500/12',
    amber: 'text-amber-500 bg-amber-500/12',
    neutral: 'text-neutral-400 bg-neutral-800',
  }[accent];
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cls}`}>
          <Icon size={15} />
        </div>
        <span className="text-[10.5px] font-medium uppercase leading-tight tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold leading-none tabular-nums text-neutral-100">{value}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon size={15} className="text-neutral-400" />
      <h2 className="text-sm font-medium text-neutral-300">{title}</h2>
      {hint && <span className="ml-1 text-xs text-neutral-600">{hint}</span>}
    </div>
  );
}

export default function ProspectInvitesDashboard({ initial }: { initial: ProspectInvitesOverview }) {
  const t = useTranslations('ProspectInvites');
  const [overview, setOverview] = useState<ProspectInvitesOverview>(initial);

  const refresh = useCallback(async () => {
    try {
      setOverview(await getProspectInvitesOverview());
    } catch {
      // keep the stale view — the next interaction retries
    }
  }, []);

  return (
    <div className="flex flex-col gap-9">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Gift} accent="blue" label={t('statTotal')} value={overview.counts.total} />
        <StatCard icon={Clock} accent="amber" label={t('statPending')} value={overview.counts.pending} />
        <StatCard icon={CheckCircle2} accent="green" label={t('statActive')} value={overview.counts.active} />
        <StatCard icon={RotateCcw} accent="neutral" label={t('statReverted')} value={overview.counts.reverted} />
      </div>

      {/* Composer */}
      <section>
        <SectionHeader icon={Gift} title={t('composerSection')} hint={t('composerHint')} />
        <InviteManager onChanged={refresh} />
      </section>

      {/* Status table */}
      <section className="pb-6">
        <SectionHeader icon={Clock} title={t('listSection')} />
        <InviteStatusTable invites={overview.invites} onChanged={refresh} />
      </section>
    </div>
  );
}
