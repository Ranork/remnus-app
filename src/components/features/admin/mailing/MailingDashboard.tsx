'use client';

// Admin mailing dashboard (client orchestrator): delivery stat cards, the
// newsletter campaign manager and the recent-send log. Receives the initial
// overview from the server page and refreshes it via getMailingOverview after
// mutations (save/delete/send).

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, XCircle, MailX, ShieldAlert, Users, Newspaper, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getMailingOverview, type MailingOverview } from '@/lib/actions/mailing';
import CampaignManager from './CampaignManager';
import EmailLogTable from './EmailLogTable';

const KIND_LABEL_KEYS: Record<string, string> = {
  welcome: 'kindWelcome',
  inactivity: 'kindInactivity',
  agent_nudge: 'kindAgentNudge',
  agent_connected: 'kindAgentConnected',
  newsletter: 'kindNewsletter',
  test: 'kindTest',
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
}) {
  const cls = {
    blue: 'text-blue-400 bg-blue-500/12',
    green: 'text-green-400 bg-green-500/12',
    amber: 'text-amber-500 bg-amber-500/12',
    red: 'text-red-400 bg-red-500/12',
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
      <div className="flex flex-col gap-0.5">
        <div className="text-2xl font-semibold leading-none tabular-nums text-neutral-100">{value}</div>
        {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
      </div>
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

export default function MailingDashboard({ initial }: { initial: MailingOverview }) {
  const t = useTranslations('Mailing');
  const [overview, setOverview] = useState<MailingOverview>(initial);

  const refresh = useCallback(async () => {
    try {
      setOverview(await getMailingOverview());
    } catch {
      // keep the stale view — the next interaction retries
    }
  }, []);

  const kindChips = Object.entries(overview.kindCounts).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-9">
      {/* Stats row */}
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={Send} accent="blue" label={t('sent30d')} value={overview.sent30d} sub={t('last30Days')} />
          <StatCard icon={XCircle} accent={overview.failed30d > 0 ? 'red' : 'neutral'} label={t('failed30d')} value={overview.failed30d} sub={t('last30Days')} />
          <StatCard icon={MailX} accent="neutral" label={t('unsubscribed')} value={overview.unsubscribedCount} />
          <StatCard icon={ShieldAlert} accent={overview.suppressedCount > 0 ? 'amber' : 'neutral'} label={t('suppressed')} value={overview.suppressedCount} sub={t('suppressedSub')} />
          <StatCard icon={Users} accent="green" label={t('audience')} value={overview.newsletterAudience} sub={t('audienceSub')} />
        </div>
        {kindChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {kindChips.map(([kind, n]) => (
              <span key={kind} className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs text-neutral-400">
                {t(KIND_LABEL_KEYS[kind] ?? 'kindTest')}
                <span className="font-medium tabular-nums text-neutral-200">{n}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Newsletter campaigns */}
      <section>
        <SectionHeader icon={Newspaper} title={t('campaignsSection')} hint={t('campaignsHint')} />
        <CampaignManager campaigns={overview.campaigns} audience={overview.newsletterAudience} onChanged={refresh} />
      </section>

      {/* Recent sends */}
      <section className="pb-6">
        <SectionHeader icon={History} title={t('logSection')} hint={t('logHint')} />
        <EmailLogTable rows={overview.recent} />
      </section>
    </div>
  );
}
