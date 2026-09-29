'use client';
import { useMemo, useState } from 'react';
import {
  Shield, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Mail, Globe, Search, Clock, Activity, HardDrive, Bot, Laptop, CreditCard,
} from 'lucide-react';
import type { PerUserActivity } from '@/lib/actions/analytics';
import type { PlanTier } from '@/lib/billing/plans';
import { useTranslations, useLocale } from 'next-intl';
import { formatDate, formatDuration, formatRelative, formatBytes } from './admin/format';
import AdminUserDetailModal from './admin/AdminUserDetailModal';
import { SimpleSelect } from '@/components/ui/select';

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  createdAt: Date | string | number | null;
  tier: PlanTier;
  authType: 'google' | 'github' | 'email' | 'unknown';
};

type SortKey = 'name' | 'email' | 'authType' | 'createdAt' | 'lastActive' | 'totalSeconds' | 'storageBytes' | 'mcpCalls' | 'tier';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const TIER_RANK: Record<PlanTier, number> = { free: 0, startup: 1, professional: 2, enterprise: 3 };

export default function AdminUsersTable({
  users,
  currentUserId,
  activity,
}: {
  users: UserRow[];
  currentUserId: string;
  activity: Record<string, PerUserActivity>;
}) {
  const t = useTranslations('Admin');
  const locale = useLocale();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [authFilter, setAuthFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey | null>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const relLabels = {
    now: t('justNow'),
    minutesAgo: (n: number) => t('minutesAgo', { count: n }),
    hoursAgo: (n: number) => t('hoursAgo', { count: n }),
    daysAgo: (n: number) => t('daysAgo', { count: n }),
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (authFilter !== 'all' && u.authType !== authFilter) return false;
      if (q) {
        const hay = `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        let va: string | number = '';
        let vb: string | number = '';
        switch (sortKey) {
          case 'name': va = (a.name ?? '').toLowerCase(); vb = (b.name ?? '').toLowerCase(); break;
          case 'email': va = (a.email ?? '').toLowerCase(); vb = (b.email ?? '').toLowerCase(); break;
          case 'authType': va = a.authType; vb = b.authType; break;
          case 'tier': va = TIER_RANK[a.tier]; vb = TIER_RANK[b.tier]; break;
          case 'createdAt': va = new Date(a.createdAt ?? 0).getTime() || 0; vb = new Date(b.createdAt ?? 0).getTime() || 0; break;
          case 'lastActive': va = activity[a.id]?.lastActive ?? 0; vb = activity[b.id]?.lastActive ?? 0; break;
          case 'totalSeconds': va = activity[a.id]?.totalSeconds ?? 0; vb = activity[b.id]?.totalSeconds ?? 0; break;
          case 'storageBytes': va = activity[a.id]?.storageBytes ?? 0; vb = activity[b.id]?.storageBytes ?? 0; break;
          case 'mcpCalls': va = activity[a.id]?.mcpCalls ?? 0; vb = activity[b.id]?.mcpCalls ?? 0; break;
        }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
    }
    return rows;
  }, [users, activity, search, roleFilter, authFilter, sortKey, sortDir]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const slice = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min((safePage + 1) * pageSize, total);

  const toggleSort = (key: SortKey) => {
    setPage(0);
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return; }
    if (sortDir === 'asc') { setSortDir('desc'); return; }
    setSortKey(null); // third click clears sort
  };


  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-neutral-900/40">
        <div className="relative flex-1 min-w-45">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-200 pl-8 pr-2 py-1.5 placeholder:text-neutral-600 focus:outline-none focus:border-blue-500"
          />
        </div>
        <SimpleSelect
          value={roleFilter}
          onValueChange={(v) => { setRoleFilter(v); setPage(0); }}
          options={[
            { value: 'all', label: t('allRoles') },
            { value: 'admin', label: t('roleAdmin') },
            { value: 'user', label: t('roleUser') },
          ]}
          aria-label={t('allRoles')}
        />
        <SimpleSelect
          value={authFilter}
          onValueChange={(v) => { setAuthFilter(v); setPage(0); }}
          options={[
            { value: 'all', label: t('allMethods') },
            { value: 'google', label: t('signInGoogle') },
            { value: 'github', label: t('signInGithub') },
            { value: 'email', label: t('signInEmail') },
          ]}
          aria-label={t('allMethods')}
        />
      </div>

      {total === 0 ? (
        <div className="py-10 text-center text-xs text-neutral-600">{t('noUsers')}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-900/60">
                <th className="w-10 px-4 py-2.5 text-left text-xs font-medium text-neutral-500">#</th>
                <Th sk="name" label={t('colName')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th sk="email" label={t('colEmail')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <Th sk="authType" label={t('colSignIn')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell w-28" />
                <Th sk="tier" label={t('colPlan')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell w-28" />
                <Th sk="lastActive" label={t('colLastActive')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell w-32" />
                <Th sk="totalSeconds" label={t('colTotalTime')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell w-28" />
                <Th sk="mcpCalls" label={t('colMcpCalls')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell w-24" />
                <Th sk="storageBytes" label={t('colStorage')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell w-24" />
                <Th sk="createdAt" label={t('colJoined')} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell w-36" />
              </tr>
            </thead>
            <tbody>
              {slice.map((u, i) => {
                const isSelf = u.id === currentUserId;
                const act = activity[u.id];
                const rowNumber = safePage * pageSize + i + 1;

                return (
                  <tr
                    key={u.id}
                    onClick={() => setDetailUserId(u.id)}
                    className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors last:border-0 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs tabular-nums text-neutral-600">{rowNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.image} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-medium shrink-0">
                            {(u.name ?? u.email ?? '?').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        {u.role === 'admin' && (
                          <span title={t('roleAdmin')} className="shrink-0 inline-flex text-blue-400">
                            <Shield size={12} />
                          </span>
                        )}
                        <span className="text-neutral-200 font-medium truncate">{u.name ?? <span className="text-neutral-600 italic">—</span>}</span>
                        {act?.usesDesktop && (
                          <span title={t('desktopBadgeTooltip')} className="shrink-0 inline-flex">
                            <Laptop size={11} className="text-blue-400" />
                          </span>
                        )}
                        {isSelf && <span className="shrink-0 text-[10px] text-neutral-600">({t('youBadge')})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-neutral-400 text-xs">{u.email ?? '—'}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      {u.authType === 'google' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-300 bg-neutral-800 px-1.5 py-0.5 rounded">
                          <Globe size={9} />
                          {t('signInGoogle')}
                        </span>
                      ) : u.authType === 'github' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-300 bg-neutral-800 px-1.5 py-0.5 rounded">
                          <GithubIcon size={9} />
                          {t('signInGithub')}
                        </span>
                      ) : u.authType === 'email' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-300 bg-neutral-800 px-1.5 py-0.5 rounded">
                          <Mail size={9} />
                          {t('signInEmail')}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      {u.tier === 'free' ? (
                        <span className="text-xs text-neutral-500">{t('planTier_free')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <CreditCard size={9} />
                          {t(`planTier_${u.tier}`)}
                        </span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                        <Activity size={11} />
                        {formatRelative(act?.lastActive, relLabels)}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                        <Clock size={11} />
                        {formatDuration(act?.totalSeconds)}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                        <Bot size={11} className={act?.mcpCalls ? 'text-amber-400/80' : ''} />
                        {act?.mcpCalls ?? 0}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                        <HardDrive size={11} />
                        {formatBytes(act?.storageBytes)}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <div className="flex items-center gap-1.5 text-neutral-500 text-xs">
                        <Calendar size={11} />
                        {formatDate(u.createdAt, locale)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-neutral-800 bg-neutral-900/40">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">
                  {from}–{to} {t('ofTotal')} {total}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-neutral-500">
                  {t('rowsPerPage')}
                  <SimpleSelect
                    value={String(pageSize)}
                    onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}
                    options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                    size="sm"
                    contentClassName="min-w-20"
                  />
                </label>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-neutral-500 px-1">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="p-1 text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {detailUserId && (
        <AdminUserDetailModal
          userId={detailUserId}
          currentUserId={currentUserId}
          onClose={() => setDetailUserId(null)}
        />
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronDown size={11} className="opacity-0 group-hover:opacity-40" />;
  return dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

function Th({ sk, label, sortKey, sortDir, onSort, className }: {
  sk: SortKey;
  label: string;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  return (
    <th className={`text-left px-4 py-2.5 ${className ?? ''}`}>
      <button
        onClick={() => onSort(sk)}
        className="group inline-flex items-center gap-1 text-xs font-medium text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors"
      >
        {label}
        <SortIcon active={sortKey === sk} dir={sortDir} />
      </button>
    </th>
  );
}

function GithubIcon({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
