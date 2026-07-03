import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAllUsers } from '@/lib/actions/auth';
import { getEngagementOverview, getActivationFunnel } from '@/lib/actions/analytics';
import { getDemoFeedback } from '@/lib/actions/demoFeedback';
import Link from 'next/link';
import { Shield, Users, TrendingUp, Clock, Activity, Timer, MonitorPlay, Share2, Workflow, MessageCircle, UserPlus, CalendarPlus, Mail } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AdminUsersTable from '@/components/features/AdminUsersTable';
import { SignupTrendChart, ActivationFunnelChart } from '@/components/features/admin/AdminCharts';
import AdminTrafficSources from '@/components/features/admin/AdminTrafficSources';
import { formatDuration } from '@/components/features/admin/format';
import { getTranslations, getLocale } from 'next-intl/server';

export const metadata = { title: 'Admin | Remnus' };

function safeDate(val: Date | string | number | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

type Accent = 'blue' | 'green' | 'amber' | 'neutral';

const ACCENT_CLS: Record<Accent, string> = {
  blue: 'text-blue-400 bg-blue-500/12',
  green: 'text-green-400 bg-green-500/12',
  amber: 'text-amber-400 bg-amber-500/12',
  neutral: 'text-neutral-400 bg-neutral-800',
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
  accent?: Accent;
}) {
  return (
    <div className="group flex min-w-0 flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLS[accent]}`}>
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
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
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

  return (
    <div className="flex h-full flex-1 flex-col overflow-auto bg-neutral-850">
      {/* Header */}
      <div className="shrink-0 border-b border-neutral-800 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
            <Shield size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('panelTitle')}</h1>
            <p className="mt-0.5 text-xs text-neutral-500">{t('panelSubtitle')}</p>
          </div>
          <Link
            href="/admin/mailing"
            className="ml-auto flex items-center gap-2 rounded-lg border border-neutral-800 px-3.5 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800/40"
          >
            <Mail size={14} className="text-blue-400" />
            {tMailing('title')}
          </Link>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-9 px-8 py-7">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <StatCard icon={Users} accent="blue" label={t('totalUsers')} value={userList.length} />
          <StatCard icon={UserPlus} accent="blue" label={t('newThisWeek')} value={engagement.newThisWeek} sub={t('last7Days')} />
          <StatCard icon={CalendarPlus} accent="blue" label={t('newThisMonth')} value={engagement.newThisMonth} sub={t('last30Days')} />
          <StatCard icon={Activity} accent="green" label={t('activeUsers')} value={engagement.wau} sub={t('last7Days')} />
          <StatCard icon={Timer} accent="neutral" label={t('avgSession')} value={formatDuration(engagement.avgSessionSeconds)} sub={t('perSession')} />
          <StatCard icon={Clock} accent="neutral" label={t('totalTime')} value={formatDuration(engagement.totalSeconds)} sub={t('allUsers')} />
          <StatCard icon={MonitorPlay} accent="amber" label={t('activeDemoSessions')} value={engagement.demoActiveSessions} sub={t('demoTotalSub', { count: engagement.demoTotal })} />
        </div>

        {/* Acquisition trend + sources */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <SectionHeader icon={TrendingUp} title={t('acquisitionTrend')} hint={t('last30Days')} />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
              <SignupTrendChart data={engagement.signupTrend} />
            </div>
          </section>

          <section>
            <SectionHeader icon={Share2} title={t('trafficSources')} hint={t('trafficSourcesHint')} />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
              <AdminTrafficSources />
            </div>
          </section>
        </div>

        {/* Activation funnel */}
        <section>
          <SectionHeader icon={Workflow} title={t('activationFunnel')} hint={t('activationFunnelHint')} />
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
            <ActivationFunnelChart
              stages={[
                { label: t('funnelSignup'), count: funnel.signups },
                { label: t('funnelConnected'), count: funnel.connected },
                { label: t('funnelActivated'), count: funnel.activated },
              ]}
            />
          </div>
        </section>

        {/* Demo feedback */}
        <section>
          <SectionHeader icon={MessageCircle} title={t('demoFeedbackSection')} hint={t('demoFeedbackHint')} />
          <DemoFeedbackSection
            data={demoFeedback}
            locale={locale}
            totalLabel={t('demoFeedbackTotal')}
            emptyLabel={t('demoFeedbackEmpty')}
          />
        </section>

        {/* Users section */}
        <section className="pb-6">
          <SectionHeader icon={Users} title={t('usersSection')} hint={`${userList.length} ${t('total')}`} />
          <AdminUsersTable users={sortedUsers} currentUserId={session.user.id} activity={engagement.perUser} />
        </section>
      </div>
    </div>
  );
}
