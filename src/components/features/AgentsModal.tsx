'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { X, Bot, ChevronDown, Zap, Globe, RefreshCw, Link2 } from 'lucide-react';
import AIMark from '@/components/marketing/AIMark';
import PageIcon from '@/components/features/PageIcon';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import ConnectFlow from '@/components/features/agents/ConnectFlow';
import {
  getUserWorkspacesWithTokens,
  getUserAgentActivity,
  getUserOAuthTokens,
  revokeAgentToken,
  revokeOAuthToken,
} from '@/lib/actions/agentToken';
import { AGENT_OPTIONS } from '@/components/features/workspace-settings/types';

type WsWithTokens = Awaited<ReturnType<typeof getUserWorkspacesWithTokens>>[number];
type WorkspaceToken = WsWithTokens['tokens'][number];
type ActivityRow = Awaited<ReturnType<typeof getUserAgentActivity>>[number];
type OAuthToken = Awaited<ReturnType<typeof getUserOAuthTokens>>[number];

type UnifiedRow =
  | { kind: 'pat';   data: WorkspaceToken }
  | { kind: 'oauth'; data: OAuthToken };

// ── helpers ───────────────────────────────────────────────────────────────────

function expiryState(d: Date | null): 'expired' | 'soon' | 'ok' | 'never' {
  if (!d) return 'never';
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  if (ms < 14 * 86_400_000) return 'soon';
  return 'ok';
}

function expiryLabel(d: Date | null, t: ReturnType<typeof useTranslations>): string {
  if (!d) return t('tokenExpiryForever');
  const ms = new Date(d).getTime() - Date.now();
  if (ms <= 0) return t('tokenExpired');
  return t('tokenExpiresInDays', { days: Math.ceil(ms / 86_400_000) });
}

function expiryCls(state: ReturnType<typeof expiryState>): string {
  if (state === 'expired') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (state === 'soon')    return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (state === 'ok')      return 'text-green-400 bg-green-500/10 border-green-500/20';
  return 'text-neutral-500 bg-neutral-800 border-neutral-700';
}

function relativeTime(d: Date | null): string {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTool(tool: string): string {
  return tool.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ── TokenRow ──────────────────────────────────────────────────────────────────

function TokenRow({
  row, t, onRevoked,
}: {
  row: UnifiedRow;
  t: ReturnType<typeof useTranslations>;
  onRevoked: () => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Normalize fields across the two token kinds
  const isPat = row.kind === 'pat';
  const name = isPat
    ? row.data.name
    : (row.data.clientName ?? row.data.clientId.slice(0, 12));
  const scope = row.data.scope;
  const canRevoke = isPat ? row.data.canRevoke : row.data.canRevoke;
  const id = row.data.id;

  // For PAT: agent icon from agentName; for OAuth: client icon
  const agent = isPat ? AGENT_OPTIONS.find(a => a.id === row.data.agentName) : null;

  const doRevoke = async () => {
    setShowConfirm(false);
    setRevoking(true);
    try {
      if (isPat) await revokeAgentToken(id);
      else        await revokeOAuthToken(id);
      onRevoked();
    } catch { /* silent */ }
    finally { setRevoking(false); }
  };

  const expiryBadge = isPat
    ? (() => {
        const state = expiryState(row.data.expiresAt);
        return (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${expiryCls(state)}`}>
            {expiryLabel(row.data.expiresAt, t)}
          </span>
        );
      })()
    : (
        <span className="flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 text-green-400 bg-green-500/10 border-green-500/20" title="Access token auto-refreshes every hour; session valid for 30 days from initial login">
          <RefreshCw size={8} />
          Auto-renewing
        </span>
      );

  const subline = isPat
    ? `${row.data.tokenPrefix}… · ${t('lastUsed')}: ${row.data.lastUsedAt ? relativeTime(row.data.lastUsedAt) : t('never')}`
    : `OAuth · ${relativeTime(row.data.createdAt)}`;

  return (
    <div className="flex items-center gap-2.5 p-3 group">
      <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center border ${
        isPat ? 'bg-neutral-800 border-neutral-700' : 'bg-blue-500/10 border-blue-500/20'
      }`}>
        {isPat
          ? (agent ? <AIMark name={agent.aiMarkName} size={14} /> : <Zap size={12} className="text-amber-400/60" />)
          : <Globe size={12} className="text-blue-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-neutral-200 truncate">{name}</span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
            isPat
              ? 'text-neutral-400 bg-neutral-800 border-neutral-700'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          }`}>
            {isPat ? 'PAT' : 'OAuth'}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
            scope === 'write'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          }`}>
            {scope === 'write' ? t('tokenScopeWrite') : t('tokenScopeRead')}
          </span>
          {expiryBadge}
        </div>
        <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">{subline}</p>
      </div>
      {canRevoke && (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={revoking}
          className="shrink-0 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/20 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
        >
          {revoking ? t('revoking') : t('revokeToken')}
        </button>
      )}
      {showConfirm && (
        <ConfirmDialog
          title={t('revokeToken')}
          description={t('removeConfirm', { name })}
          confirmLabel={t('revokeToken')}
          cancelLabel={t('cancel')}
          onConfirm={doRevoke}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ── WorkspaceSection ──────────────────────────────────────────────────────────

function WorkspaceSection({
  ws, oauthTokens, t, onRevoked,
}: {
  ws: WsWithTokens;
  oauthTokens: OAuthToken[];
  t: ReturnType<typeof useTranslations>;
  onRevoked: () => void;
}) {
  // Combine PAT + OAuth into a single ordered list
  const rows: UnifiedRow[] = [
    ...ws.tokens.map<UnifiedRow>(t => ({ kind: 'pat', data: t })),
    ...oauthTokens.map<UnifiedRow>(t => ({ kind: 'oauth', data: t })),
  ];

  return (
    <div className="space-y-1">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-1 mb-1">
        {ws.icon
          ? <PageIcon icon={ws.icon} iconColor={ws.iconColor} size={13} />
          : <div className="w-3.5 h-3.5 rounded bg-neutral-700 flex items-center justify-center text-[8px] font-bold text-neutral-400">
              {ws.name.charAt(0).toUpperCase()}
            </div>
        }
        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest truncate flex-1">
          {ws.name}
        </span>
      </div>

      {/* Token list or empty state */}
      <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/20">
        {rows.length === 0 ? (
          <div className="px-3 py-2.5">
            <span className="text-[11px] text-neutral-600 italic">{t('agentsWorkspaceEmpty')}</span>
          </div>
        ) : (
          rows.map(row => (
            <TokenRow key={`${row.kind}-${row.data.id}`} row={row} t={t} onRevoked={onRevoked} />
          ))
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function AgentsModal({ onClose }: Props) {
  const t = useTranslations('WorkspaceSettings');

  const [workspaces,    setWorkspaces]    = useState<WsWithTokens[]>([]);
  const [activity,      setActivity]      = useState<ActivityRow[]>([]);
  const [oauthTokens,   setOAuthTokens]   = useState<OAuthToken[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showActivity,  setShowActivity]  = useState(false);
  const [showConnect,   setShowConnect]   = useState(false);

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  const totalPat   = workspaces.reduce((s, ws) => s + ws.tokens.length, 0);
  const totalTokens = totalPat + oauthTokens.length;

  // Workspaces the user can mint a PAT in — passed to ConnectFlow's Advanced/token section.
  const mintTargets = workspaces
    .filter(ws => ws.canManage)
    .map(ws => ({ id: ws.id, name: ws.name }));

  const oauthByWorkspace = oauthTokens.reduce<Record<string, OAuthToken[]>>((acc, tok) => {
    (acc[tok.workspaceId] ??= []).push(tok);
    return acc;
  }, {});

  const load = () => {
    setLoading(true);
    Promise.all([getUserWorkspacesWithTokens(), getUserAgentActivity(), getUserOAuthTokens()])
      .then(([ws, acts, oauth]) => { setWorkspaces(ws); setActivity(acts); setOAuthTokens(oauth); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bot size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-neutral-100">{t('agentsTitle')}</span>
            {totalTokens > 0 && (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                {totalTokens}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!showConnect && (
              <button
                onClick={() => setShowConnect(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-blue-500 hover:bg-blue-400 px-3 py-1.5 rounded-md transition-colors"
              >
                <Link2 size={12} />
                {t('connectButton')}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {showConnect && (
            <ConnectFlow
              mcpUrl={mcpUrl}
              onClose={() => { setShowConnect(false); load(); }}
              mintTargets={mintTargets}
            />
          )}
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <Bot size={20} className="text-neutral-500" />
              </div>
              <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">{t('agentsNoTokens')}</p>
            </div>
          ) : (
            workspaces.map(ws => (
              <WorkspaceSection
                key={ws.id}
                ws={ws}
                oauthTokens={oauthByWorkspace[ws.id] ?? []}
                t={t}
                onRevoked={load}
              />
            ))
          )}

          {/* Activity section */}
          {!loading && (
            <div className="border-t border-neutral-800 pt-4">
              <button
                onClick={() => setShowActivity(v => !v)}
                className="w-full flex items-center justify-between group py-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-neutral-300 group-hover:text-white transition-colors uppercase tracking-widest">
                    {t('agentsActivity')}
                  </span>
                  {activity.length > 0 && (
                    <span className="text-[9px] font-bold text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded-full">
                      {activity.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  size={14}
                  className={`text-neutral-400 group-hover:text-neutral-200 transition-all ${showActivity ? 'rotate-180' : ''}`}
                />
              </button>

              {showActivity && (
                <div className="mt-3">
                  {activity.length === 0 ? (
                    <p className="text-[11px] text-neutral-500 italic py-2">{t('agentsNoActivity')}</p>
                  ) : (
                    <div className="space-y-px">
                      {activity.map(act => {
                        const agent = AGENT_OPTIONS.find(a => a.id === act.agentName);
                        return (
                          <div
                            key={act.id}
                            className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-neutral-800/40 transition-colors"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${act.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                            <span className="text-[11px] font-mono font-semibold text-neutral-200 shrink-0">
                              {formatTool(act.tool)}
                            </span>
                            <div className="flex items-center gap-1 min-w-0">
                              {agent && (
                                <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded-full shrink-0">
                                  <AIMark name={agent.aiMarkName} size={9} />
                                  {agent.label}
                                </span>
                              )}
                              <span className="text-[9px] text-neutral-500 bg-neutral-800/60 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">
                                {act.tokenName}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-600 truncate flex-1 hidden sm:block">
                              {act.workspaceName}
                            </span>
                            <span className="text-[10px] text-neutral-600 shrink-0 ml-auto font-mono">
                              {relativeTime(act.createdAt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
