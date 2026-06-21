'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  X, Shield, Globe, Mail, Calendar, Clock, Activity, Layers, FileText, Database, HardDrive, CreditCard, Sparkles,
  Bot, Key, Zap, Crown,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { getUserDetail, type UserDetail } from '@/lib/actions/analytics';
import { setUserRole } from '@/lib/actions/auth';
import { adminSetUserPlan } from '@/lib/actions/billing';
import type { PlanTier } from '@/lib/billing/plans';
import { formatDate, formatDuration, formatRelative, formatBytes } from './format';

const PLAN_TIERS: PlanTier[] = ['free', 'startup', 'professional', 'enterprise'];

function ItemIcon({ icon, type }: { icon: string | null; type: 'page' | 'database' }) {
  const isEmoji = icon && [...icon].length <= 2;
  if (isEmoji) return <span className="text-sm leading-none" translate="no">{icon}</span>;
  return type === 'database'
    ? <Database size={13} className="text-neutral-500" />
    : <FileText size={13} className="text-neutral-500" />;
}

export default function AdminUserDetailModal({
  userId,
  currentUserId,
  onClose,
}: {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [planPending, startPlanTransition] = useTransition();
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    // Modal mounts fresh per open (keyed by userId in the parent), so the
    // initial loading=true state is correct without resetting it here.
    let active = true;
    getUserDetail(userId)
      .then((d) => { if (active) setDetail(d); })
      .catch(() => { if (active) setDetail(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const relLabels = {
    now: t('justNow'),
    minutesAgo: (n: number) => t('minutesAgo', { count: n }),
    hoursAgo: (n: number) => t('hoursAgo', { count: n }),
    daysAgo: (n: number) => t('daysAgo', { count: n }),
  };

  const toggleRole = () => {
    if (!detail || detail.account.role === 'demo') return;
    const next = detail.account.role === 'admin' ? 'user' : 'admin';
    startTransition(async () => {
      await setUserRole(userId, next);
      setDetail((d) => (d ? { ...d, account: { ...d.account, role: next } } : d));
      router.refresh();
    });
  };

  const changePlan = (tier: PlanTier) => {
    if (!detail || detail.subscription.tier === tier || detail.subscription.source === 'stripe') return;
    setPlanError(null);
    startPlanTransition(async () => {
      const res = await adminSetUserPlan(userId, tier);
      if (res.error) {
        setPlanError(res.error);
        return;
      }
      setDetail((d) =>
        d
          ? {
              ...d,
              subscription: {
                ...d.subscription,
                tier,
                status: 'active',
                source: tier === 'free' ? 'none' : 'manual',
              },
            }
          : d,
      );
      router.refresh();
    });
  };

  const acct = detail?.account;
  const isSelf = userId === currentUserId;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-110 flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {acct?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={acct.image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-sm font-medium shrink-0">
                {(acct?.name ?? acct?.email ?? '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-neutral-100 truncate">
                {acct?.name ?? acct?.email ?? t('loading')}
              </div>
              {acct?.email && <div className="text-xs text-neutral-500 truncate">{acct.email}</div>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
            </div>
          ) : !detail ? (
            <div className="py-16 text-center text-xs text-neutral-600">{t('userNotFound')}</div>
          ) : (
            <>
              {/* Account details */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('accountDetails')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field icon={<Calendar size={12} />} label={t('colJoined')} value={formatDate(detail.account.createdAt, locale)} />
                  <Field
                    icon={detail.account.authType === 'github' ? <GithubIcon /> : detail.account.authType === 'email' ? <Mail size={12} /> : <Globe size={12} />}
                    label={t('colSignIn')}
                    value={
                      detail.account.authType === 'google' ? t('signInGoogle')
                        : detail.account.authType === 'github' ? t('signInGithub')
                          : detail.account.authType === 'email' ? t('signInEmail')
                            : t('signInUnknown')
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-600"><Shield size={12} />{t('colRole')}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${detail.account.role === 'admin' ? 'text-blue-400' : detail.account.role === 'demo' ? 'text-amber-500/80' : 'text-neutral-300'}`}>
                        {detail.account.role === 'admin' ? t('roleAdmin') : detail.account.role === 'demo' ? t('roleDemo') : t('roleUser')}
                      </span>
                      {!isSelf && detail.account.role !== 'demo' && (
                        <button
                          onClick={toggleRole}
                          disabled={isPending}
                          className="text-[10px] font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                        >
                          {detail.account.role === 'admin' ? t('demoteToUser') : t('promoteToAdmin')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Activity summary */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('activitySummary')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat icon={<Clock size={13} />} label={t('totalTime')} value={formatDuration(detail.activity.totalSeconds)} />
                  <Stat icon={<Layers size={13} />} label={t('sessions')} value={String(detail.activity.sessionCount)} />
                  <Stat icon={<Activity size={13} />} label={t('lastActive')} value={formatRelative(detail.activity.lastActive, relLabels)} />
                  <Stat icon={<HardDrive size={13} />} label={t('storageUsed')} value={formatBytes(detail.storageBytes)} />
                </div>
              </section>

              {/* Content */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('contentSection')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat icon={<Crown size={13} />} label={t('ownedWorkspaces')} value={String(detail.account.ownedWorkspaces)} />
                  <Stat icon={<FileText size={13} />} label={t('contentPages')} value={String(detail.content.pages)} />
                  <Stat icon={<Database size={13} />} label={t('contentDatabases')} value={String(detail.content.databases)} />
                  <Stat icon={<Layers size={13} />} label={t('contentRecords')} value={String(detail.content.records)} />
                </div>
              </section>

              {/* AI agents (MCP) */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('agentsSection')}</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Stat icon={<Bot size={13} />} label={t('agentsConnected')} value={String(detail.agents.active)} />
                  <Stat icon={<Zap size={13} />} label={t('agentsCalls')} value={detail.agents.calls.toLocaleString(locale)} />
                  <Stat icon={<Activity size={13} />} label={t('agentsLastCall')} value={formatRelative(detail.agents.lastCall, relLabels)} />
                </div>
                {detail.agents.tokens.length === 0 && detail.agents.oauthActive === 0 ? (
                  <p className="text-xs text-neutral-600 italic">{t('agentsNone')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.agents.tokens.map((tok) => (
                      <div key={tok.id} className="flex items-center gap-2.5 border border-neutral-800 rounded-md bg-neutral-900/40 px-3 py-2">
                        <Key size={12} className="text-neutral-500 shrink-0" />
                        <span className="text-xs text-neutral-200 truncate flex-1 min-w-0">{tok.agentName || tok.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 uppercase shrink-0">{tok.scope}</span>
                        <span className="text-[10px] text-neutral-500 shrink-0 hidden sm:inline">{formatRelative(tok.lastUsedAt, relLabels)}</span>
                        <AgentStatusBadge status={tok.status} t={t} />
                      </div>
                    ))}
                    {detail.agents.oauthActive > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-neutral-500">
                        <Sparkles size={11} className="text-blue-400 shrink-0" />
                        {t('agentsOauthCount', { count: detail.agents.oauthActive })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Subscription / plan */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">{t('subscriptionPlan')}</h3>
                <div className="rounded-md border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <CreditCard size={14} className="text-neutral-500 shrink-0" />
                      <span className="text-sm font-semibold text-neutral-100">{t(`planTier_${detail.subscription.tier}`)}</span>
                      <SourceBadge source={detail.subscription.source} t={t} />
                    </div>
                    {detail.subscription.currentPeriodEnd && (
                      <span className="text-[10px] text-neutral-500">
                        {t('planRenews')} {formatDate(detail.subscription.currentPeriodEnd, locale)}
                      </span>
                    )}
                  </div>

                  {detail.subscription.source === 'stripe' ? (
                    <p className="text-xs text-neutral-500 flex items-start gap-1.5">
                      <Sparkles size={12} className="text-blue-400 mt-0.5 shrink-0" />
                      {t('planManagedByStripe')}
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-neutral-600">{t('setPlanManually')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {PLAN_TIERS.map((tier) => {
                            const active = detail.subscription.tier === tier;
                            return (
                              <button
                                key={tier}
                                onClick={() => changePlan(tier)}
                                disabled={planPending || active}
                                className={`text-xs px-2.5 py-1 rounded border transition-colors disabled:cursor-default ${
                                  active
                                    ? 'border-blue-500/60 bg-blue-500/15 text-blue-300 font-medium'
                                    : 'border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/50 disabled:opacity-50'
                                }`}
                              >
                                {t(`planTier_${tier}`)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {planError && <p className="text-[11px] text-red-400">{planError}</p>}
                    </>
                  )}
                </div>
              </section>

              {/* Workspaces */}
              <section>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
                  {t('userWorkspaces')} <span className="text-neutral-600 normal-case">({detail.workspaces.length})</span>
                </h3>
                {detail.workspaces.length === 0 ? (
                  <p className="text-xs text-neutral-600 italic">{t('noWorkspacesForUser')}</p>
                ) : (
                  <div className="space-y-3">
                    {detail.workspaces.map((ws) => (
                      <div key={ws.id} className="border border-neutral-800 rounded-md overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/40 border-b border-neutral-800">
                          <div className="flex items-center gap-2 min-w-0">
                            <Layers size={13} className="text-neutral-500 shrink-0" />
                            <span className="text-sm text-neutral-200 truncate">{ws.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 capitalize">
                              {ws.role === 'owner' ? t('roleOwner') : ws.role === 'viewer' ? t('roleViewer') : t('roleMember')}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-neutral-500"><HardDrive size={10} />{formatBytes(ws.storageBytes)}</span>
                            <span className="flex items-center gap-1 text-[10px] text-neutral-500"><FileText size={10} />{ws.items.length}</span>
                          </div>
                        </div>
                        {ws.items.length > 0 && (
                          <div className="px-3 py-2 flex flex-col gap-1.5">
                            {ws.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2.5">
                                <ItemIcon icon={item.icon} type={item.type} />
                                <span className="text-xs text-neutral-300 truncate">{item.title}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${item.type === 'database' ? 'bg-blue-500/10 text-blue-400' : 'bg-neutral-800 text-neutral-500'}`}>
                                  {item.type === 'database' ? t('roleDatabase') : t('rolePage')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source, t }: { source: 'stripe' | 'manual' | 'none'; t: (k: string) => string }) {
  if (source === 'stripe') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">{t('planSourceStripe')}</span>;
  }
  if (source === 'manual') {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500/90 font-medium">{t('planSourceManual')}</span>;
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-500">{t('planSourceNone')}</span>;
}

function AgentStatusBadge({ status, t }: { status: 'active' | 'revoked' | 'expired'; t: (k: string) => string }) {
  const cls =
    status === 'active'
      ? 'bg-green-500/15 text-green-400'
      : status === 'expired'
        ? 'bg-amber-500/15 text-amber-500/90'
        : 'bg-neutral-800 text-neutral-500';
  const label = status === 'active' ? t('agentStatusActive') : status === 'expired' ? t('agentStatusExpired') : t('agentStatusRevoked');
  return <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${cls}`}>{label}</span>;
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-600">{icon}{label}</span>
      <span className="text-xs text-neutral-300">{value}</span>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2.5 flex flex-col gap-1.5 min-w-0">
      <span className="flex items-center gap-1.5 text-neutral-500 text-[10px] uppercase tracking-wider">{icon}{label}</span>
      <span className="text-sm font-semibold text-neutral-100 truncate">{value}</span>
    </div>
  );
}

function GithubIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
