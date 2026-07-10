import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAllUsers } from '@/lib/actions/auth';
import { getEngagementOverview, getActivationFunnel } from '@/lib/actions/analytics';
import { getDemoFeedback } from '@/lib/actions/demoFeedback';
import Link from 'next/link';
import { Shield, Users, TrendingUp, MonitorPlay, Share2, Workflow, MessageCircle, Mail, Laptop, Download } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AdminUsersTable from '@/components/features/AdminUsersTable';
import { SignupTrendChart } from '@/components/features/admin/AdminCharts';
import AdminTrafficSources from '@/components/features/admin/AdminTrafficSources';
import AdminDesktopStats from '@/components/features/admin/AdminDesktopStats';
import AdminShell from '@/components/features/admin/AdminShell';
import { formatDuration } from '@/components/features/admin/format';
import { getTranslations, getLocale } from 'next-intl/server';

export const metadata = { title: 'Admin | Remnus' };

function safeDate(val: Date | string | number | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
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

// ── Hero KPI cluster ──────────────────────────────────────────────────────
// Three headline tiles (users, active users, engagement) sized for the metrics
// that matter right now, plus one compact multi-row tile bundling the
// currently-low-signal stats (demo sessions, desktop usage) instead of giving
// them equal weight to the headline numbers.

function HeroTile({ label, value, unit, sub, children }: {
  label: string;
  value: number | string;
  unit?: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-neutral-500">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-neutral-100">{value}</span>
        {unit && <span className="text-sm font-medium text-neutral-500">{unit}</span>}
      </div>
      {children}
      {sub && <span className="text-[11.5px] text-neutral-500">{sub}</span>}
    </div>
  );
}

function SignalRow({ icon: Icon, label, value, meta }: { icon: LucideIcon; label: string; value: number | string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="flex items-center gap-2 text-[11.5px] text-neutral-400">
        <Icon size={13} className="text-neutral-600" />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-neutral-200">
        {value}
        {meta && <span className="ml-1.5 text-[10.5px] font-medium text-neutral-600">{meta}</span>}
      </span>
    </div>
  );
}

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

const SENTIMENT: Record<'positive' | 'neutral' | 'negative', { emoji: string; cls: string }> = {
  positive: { emoji: '😍', cls: 'bg-green-500/10 text-green-400' },
  neutral: { emoji: '🙂', cls: 'bg-neutral-800 text-neutral-300' },
  negative: { emoji: '😕', cls: 'bg-red-500/10 text-red-400' },
};

function DemoFeedbackSection({
  data,
  locale,
  totalLabel,
  emptyLabel,
}: {
  data: Awaited<ReturnType<typeof getDemoFeedback>>;
  locale: string;
  totalLabel: string;
  emptyLabel: string;
}) {
  const withComments = data.recent.filter((r) => r.comment);
  const fmt = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const counts: [keyof typeof SENTIMENT, number][] = [
    ['positive', data.positive],
    ['neutral', data.neutral],
    ['negative', data.negative],
  ];
  return (
    <div className="flex flex-1 flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {counts.map(([key, n]) => (
          <span
            key={key}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${SENTIMENT[key].cls}`}
          >
            <span>{SENTIMENT[key].emoji}</span>
            <span className="font-medium tabular-nums">{n}</span>
          </span>
        ))}
        <span className="ml-auto text-xs text-neutral-500">
          {data.total} {totalLabel}
        </span>
      </div>
      {withComments.length === 0 ? (
        <p className="text-xs text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {withComments.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2.5 rounded-lg bg-neutral-850/60 px-3 py-2"
            >
              <span className="shrink-0 text-base leading-5">{SENTIMENT[r.sentiment].emoji}</span>
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-300 wrap-break-word">
                {r.comment}
              </p>
              <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">
                {r.createdAt ? fmt.format(new Date(r.createdAt)) : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') redirect('/login');

  const [t, tMailing, locale] = await Promise.all([getTranslations('Admin'), getTranslations('Mailing'), getLocale()]);

  const [usersResult, engagement, funnel, demoFeedback] = await Promise.all([
    getAllUsers(),
    getEngagementOverview(),
    getActivationFunnel(),
    getDemoFeedback(),
  ]);

  const userList = Array.isArray(usersResult) ? usersResult : [];

  const sortedUsers = [...userList].sort((a, b) => {
    const da = safeDate(a.createdAt)?.getTime() ?? 0;
    const db = safeDate(b.createdAt)?.getTime() ?? 0;
    return db - da;
  });

  const activePct = userList.length > 0 ? Math.round((engagement.wau / userList.length) * 100) : 0;

  return (
    <AdminShell
      icon={
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
          <Shield size={18} />
        </div>
      }
      title={t('panelTitle')}
      subtitle={t('panelSubtitle')}
      widthLabels={{ narrow: t('widthNarrow'), wide: t('widthWide'), full: t('widthFull') }}
      headerActions={
        <Link
          href="/admin/mailing"
          className="flex items-center gap-2 rounded-lg border border-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800/40"
        >
          <Mail size={14} className="text-blue-400" />
          {tMailing('title')}
        </Link>
      }
    >
        {/* Hero KPI cluster */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1.05fr]">
          <HeroTile
            label={t('totalUsers')}
            value={userList.length}
            sub={t('newUsersSub', { week: engagement.newThisWeek, month: engagement.newThisMonth })}
          />

          <HeroTile
            label={t('activeUsers')}
            value={engagement.wau}
            unit={`/ ${userList.length}`}
            sub={t('weeklyActiveSub', { pct: activePct })}
          >
            <div className="h-1.25 overflow-hidden rounded-full border border-neutral-800 bg-neutral-850">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${activePct}%` }} />
            </div>
          </HeroTile>

          <HeroTile
            label={t('avgSession')}
            value={formatDuration(engagement.avgSessionSeconds)}
            sub={t('engagementSub', { time: formatDuration(engagement.totalSeconds) })}
          />

          <div className="flex flex-col justify-center divide-y divide-neutral-800/70 rounded-xl border border-neutral-800 bg-neutral-900">
            <SignalRow
              icon={MonitorPlay}
              label={t('activeDemoSessions')}
              value={engagement.demoActiveSessions}
              meta={t('demoTotalSub', { count: engagement.demoTotal })}
            />
            <SignalRow icon={Laptop} label={t('desktopUsersStat')} value={engagement.desktopUsersTotal} />
            <SignalRow icon={Download} label={t('desktopActiveStat')} value={engagement.desktopUsersActive30d} />
          </div>
        </div>

        {/* Acquisition trend + activation funnel / traffic sources */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
          <div className="flex flex-col gap-6">
            <section className="flex flex-1 flex-col">
              <SectionHeader icon={TrendingUp} title={t('acquisitionTrend')} hint={t('last30Days')} />
              <div className="flex flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
                <SignupTrendChart data={engagement.signupTrend} />
              </div>
            </section>

            <section className="flex flex-1 flex-col">
              <SectionHeader icon={Workflow} title={t('activationFunnel')} hint={t('activationFunnelHint')} />
              <div className="flex flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
                <ActivationFunnelList
                  stages={[
                    { label: t('funnelSignup'), count: funnel.signups },
                    { label: t('funnelConnected'), count: funnel.connected },
                    { label: t('funnelActivated'), count: funnel.activated },
                  ]}
                />
              </div>
            </section>
          </div>

          <section className="flex flex-col">
            <SectionHeader icon={Share2} title={t('trafficSources')} hint={t('trafficSourcesHint')} />
            <div className="flex flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
              <AdminTrafficSources />
            </div>
          </section>
        </div>

        {/* Desktop / Tauri + demo feedback */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
          <section className="flex flex-col">
            <SectionHeader icon={Laptop} title={t('desktopSection')} hint={t('desktopSectionHint')} />
            <div className="flex flex-1 flex-col rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
              <AdminDesktopStats />
            </div>
          </section>

          <section className="flex flex-col">
            <SectionHeader icon={MessageCircle} title={t('demoFeedbackSection')} hint={t('demoFeedbackHint')} />
            <DemoFeedbackSection
              data={demoFeedback}
              locale={locale}
              totalLabel={t('demoFeedbackTotal')}
              emptyLabel={t('demoFeedbackEmpty')}
            />
          </section>
        </div>

        {/* Users section */}
        <section className="pb-6">
          <SectionHeader icon={Users} title={t('usersSection')} hint={`${userList.length} ${t('total')}`} />
          <AdminUsersTable users={sortedUsers} currentUserId={session.user.id} activity={engagement.perUser} />
        </section>
    </AdminShell>
  );
}
