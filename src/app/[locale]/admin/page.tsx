import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAllUsers } from '@/lib/actions/auth';
import { getEngagementOverview } from '@/lib/actions/analytics';
import { Shield, Users, TrendingUp, Clock, Activity, Timer, MonitorPlay } from 'lucide-react';
import AdminUsersTable from '@/components/features/AdminUsersTable';
import { formatDuration } from '@/components/features/admin/format';
import { getTranslations, getLocale } from 'next-intl/server';

export const metadata = { title: 'Admin | Remnus' };

function safeDate(val: Date | string | number | null | undefined): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2 text-neutral-500">
        {icon}
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-neutral-100">{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function SignupTrend({ data, locale }: { data: { date: string; count: number }[]; locale: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  return (
    <div className="flex items-end gap-0.75 h-24">
      {data.map((d) => {
        const h = d.count === 0 ? 2 : Math.round((d.count / max) * 88) + 8;
        return (
          <div
            key={d.date}
            className="flex-1 min-w-0 rounded-sm bg-blue-500/40 hover:bg-blue-500/70 transition-colors"
            style={{ height: `${h}px` }}
            title={`${fmt.format(new Date(d.date))}: ${d.count}`}
          />
        );
      })}
    </div>
  );
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') redirect('/login');

  const [t, locale] = await Promise.all([getTranslations('Admin'), getLocale()]);

  const [usersResult, engagement] = await Promise.all([
    getAllUsers(),
    getEngagementOverview(),
  ]);

  const userList = Array.isArray(usersResult) ? usersResult : [];

  const sortedUsers = [...userList].sort((a, b) => {
    const da = safeDate(a.createdAt)?.getTime() ?? 0;
    const db = safeDate(b.createdAt)?.getTime() ?? 0;
    return db - da;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto bg-neutral-850">

      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-blue-400" />
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">{t('panelTitle')}</h1>
            <p className="text-xs text-neutral-500 mt-0.5">{t('panelSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6 flex flex-col gap-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard icon={<Users size={14} />} label={t('totalUsers')} value={userList.length} />
          <StatCard icon={<TrendingUp size={14} />} label={t('newThisWeek')} value={engagement.newThisWeek} sub={t('last7Days')} />
          <StatCard icon={<TrendingUp size={14} />} label={t('newThisMonth')} value={engagement.newThisMonth} sub={t('last30Days')} />
          <StatCard icon={<Activity size={14} />} label={t('activeUsers')} value={engagement.wau} sub={t('last7Days')} />
          <StatCard icon={<Timer size={14} />} label={t('avgSession')} value={formatDuration(engagement.avgSessionSeconds)} sub={t('perSession')} />
          <StatCard icon={<Clock size={14} />} label={t('totalTime')} value={formatDuration(engagement.totalSeconds)} sub={t('allUsers')} />
          <StatCard icon={<MonitorPlay size={14} className="text-amber-500" />} label={t('activeDemoSessions')} value={engagement.demoActiveSessions} sub={t('demoTotalSub', { count: engagement.demoTotal })} />
        </div>

        {/* Acquisition trend */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-300">{t('acquisitionTrend')}</h2>
            <span className="text-xs text-neutral-600 ml-1">{t('last30Days')}</span>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-5 py-4">
            <SignupTrend data={engagement.signupTrend} locale={locale} />
          </div>
        </section>

        {/* Users section */}
        <section className="pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-300">{t('usersSection')}</h2>
            <span className="text-xs text-neutral-600 ml-1">{userList.length} {t('total')}</span>
          </div>
          <AdminUsersTable users={sortedUsers} currentUserId={session.user.id} activity={engagement.perUser} />
        </section>

      </div>
    </div>
  );
}
