import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getAllUsers } from '@/lib/actions/auth';
import { getAdminWorkspacesOverview, getAllWorkspaceItems } from '@/lib/actions/workspace';
import { Shield, Users, Layers, FileText, TrendingUp } from 'lucide-react';
import AdminUsersTable from '@/components/features/AdminUsersTable';
import AdminWorkspacesTable from '@/components/features/AdminWorkspacesTable';
import { getTranslations } from 'next-intl/server';

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

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') redirect('/login');

  const t = await getTranslations('Admin');

  const [usersResult, workspaces, allItems] = await Promise.all([
    getAllUsers(),
    getAdminWorkspacesOverview(),
    getAllWorkspaceItems(),
  ]);

  const userList = Array.isArray(usersResult) ? usersResult : [];

  const now = Date.now();
  const msWeek = 7 * 24 * 60 * 60 * 1000;
  const msMonth = 30 * 24 * 60 * 60 * 1000;

  const newThisWeek = userList.filter((u) => {
    const d = safeDate(u.createdAt);
    return d && now - d.getTime() <= msWeek;
  }).length;

  const newThisMonth = userList.filter((u) => {
    const d = safeDate(u.createdAt);
    return d && now - d.getTime() <= msMonth;
  }).length;

  const newWorkspacesThisMonth = workspaces.filter((ws) => {
    const d = safeDate(ws.createdAt);
    return d && now - d.getTime() <= msMonth;
  }).length;

  const totalItems = workspaces.reduce((sum, ws) => sum + (ws.itemCount ?? 0), 0);

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            icon={<Users size={14} />}
            label={t('totalUsers')}
            value={userList.length}
          />
          <StatCard
            icon={<TrendingUp size={14} />}
            label={t('newThisWeek')}
            value={newThisWeek}
            sub={t('last7Days')}
          />
          <StatCard
            icon={<TrendingUp size={14} />}
            label={t('newThisMonth')}
            value={newThisMonth}
            sub={t('last30Days')}
          />
          <StatCard
            icon={<Layers size={14} />}
            label={t('workspaces')}
            value={workspaces.length}
          />
          <StatCard
            icon={<Layers size={14} />}
            label={t('newWorkspaces')}
            value={newWorkspacesThisMonth}
            sub={t('last30Days')}
          />
          <StatCard
            icon={<FileText size={14} />}
            label={t('totalItems')}
            value={totalItems}
            sub={t('pagesDatabases')}
          />
        </div>

        {/* Users section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users size={15} className="text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-300">{t('usersSection')}</h2>
            <span className="text-xs text-neutral-600 ml-1">{userList.length} {t('total')}</span>
          </div>
          <AdminUsersTable users={sortedUsers} currentUserId={session.user.id} />
        </section>

        {/* Workspaces section */}
        <section className="pb-6">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={15} className="text-neutral-400" />
            <h2 className="text-sm font-medium text-neutral-300">{t('workspacesSection')}</h2>
            <span className="text-xs text-neutral-600 ml-1">{workspaces.length} {t('total')}</span>
          </div>
          <AdminWorkspacesTable workspaces={workspaces} items={allItems} />
        </section>

      </div>
    </div>
  );
}
