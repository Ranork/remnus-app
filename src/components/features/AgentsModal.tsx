'use client';
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X, Bot, ChevronDown, RefreshCw, Link2, Check } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import ConnectModal from '@/components/features/agents/ConnectModal';
import AgentMark, { AGENT_MARKS, MarkIcon, markForId, resolveAgentMark } from '@/components/features/agents/AgentMark';
import { formatTokens } from '@/components/features/admin/format';
import {
  getUserWorkspacesWithTokens,
  getUserAgentActivity,
  getUserOAuthTokens,
  getMyAgentUsage,
  revokeAgentToken,
  revokeOAuthToken,
  setAgentTokenAgent,
  setOAuthTokenAgent,
} from '@/lib/actions/agentToken';

type WsWithTokens = Awaited<ReturnType<typeof getUserWorkspacesWithTokens>>[number];
type WorkspaceToken = WsWithTokens['tokens'][number];
type ActivityRow = Awaited<ReturnType<typeof getUserAgentActivity>>[number];
type OAuthToken = Awaited<ReturnType<typeof getUserOAuthTokens>>[number];

type UnifiedRow =
  | { kind: 'pat';   data: WorkspaceToken }
  | { kind: 'oauth'; data: OAuthToken };

type AgentUsage = Awaited<ReturnType<typeof getMyAgentUsage>>;

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

// ── AgentTypePicker ─────────────────────────────────────────────────────────────
// Clickable agent icon that opens a dropdown to set the agent type (brand icon).
function AgentTypePicker({
  override, hint, fallback, canEdit, onPick, t,
}: {
  override: string | null;
  hint: string | null;
  fallback: 'globe' | 'zap';
  canEdit: boolean;
  onPick: (agentId: string | null) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  // The token list lives inside an `overflow-hidden` card, so an absolutely-positioned
  // dropdown gets clipped. Render it in a portal with fixed viewport coords instead.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      const r = btnRef.current!.getBoundingClientRect();
      const W = 176, GAP = 6;
      let left = r.left;
      if (left + W > window.innerWidth - 8) left = window.innerWidth - 8 - W;
      setCoords({ top: r.bottom + GAP, left: Math.max(8, left) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const pick = (agentId: string | null) => { setOpen(false); onPick(agentId); };

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => canEdit && setOpen(v => !v)}
        disabled={!canEdit}
        title={canEdit ? t('agentSetType') : undefined}
        className={`w-7 h-7 rounded-md flex items-center justify-center border transition-colors ${
          fallback === 'zap' || override ? 'bg-neutral-800 border-neutral-700' : 'bg-blue-500/10 border-blue-500/20'
        } ${canEdit ? 'hover:border-neutral-500 cursor-pointer' : ''}`}
      >
        <AgentMark override={override} hint={hint} size={14} fallback={fallback} />
      </button>
      {open && coords && createPortal(
        <>
          <div className="fixed inset-0 z-200" onClick={() => setOpen(false)} />
          <div
            style={{ top: coords.top, left: coords.left }}
            className="fixed z-201 w-44 bg-neutral-900 border border-neutral-700 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.6)] py-1 max-h-64 overflow-y-auto"
          >
            <p className="px-2.5 py-1 text-[9px] font-semibold text-neutral-500 uppercase tracking-widest">{t('agentSetType')}</p>
            {AGENT_MARKS.map(a => (
              <button
                key={a.id}
                onClick={() => pick(a.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                <MarkIcon mark={a.mark} size={13} />
                <span className="flex-1 text-left">{a.label}</span>
                {override === a.id && <Check size={11} className="text-green-400 shrink-0" />}
              </button>
            ))}
            <div className="border-t border-neutral-800 my-1" />
            <button
              onClick={() => pick(null)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-neutral-400 hover:bg-neutral-800 transition-colors"
            >
              <span className="w-[13px] text-center text-neutral-500">∅</span>
              <span className="flex-1 text-left">{t('agentAutoDetect')}</span>
              {!override && <Check size={11} className="text-green-400 shrink-0" />}
            </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
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
    : (row.data.displayName ?? row.data.clientName ?? row.data.clientId.slice(0, 12));
  const scope = row.data.scope;
  const canRevoke = isPat ? row.data.canRevoke : row.data.canRevoke;
  const id = row.data.id;

  // Brand icon: explicit agentName override → else inferred from name/clientName → else fallback.
  const override = row.data.agentName ?? null;
  const iconHint = isPat ? row.data.name : (row.data.clientName ?? null);

  const handlePickAgent = async (agentId: string | null) => {
    try {
      if (isPat) await setAgentTokenAgent(id, agentId);
      else        await setOAuthTokenAgent(id, agentId);
      onRevoked();
    } catch { /* silent */ }
  };

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
      <AgentTypePicker
        override={override}
        hint={iconHint}
        fallback={isPat ? 'zap' : 'globe'}
        canEdit={canRevoke}
        onPick={handlePickAgent}
        t={t}
      />
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
  const [usage,         setUsage]         = useState<AgentUsage | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [showActivity,  setShowActivity]  = useState(false);
  const [showConnect,   setShowConnect]   = useState(false);

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  const totalPat   = workspaces.reduce((s, ws) => s + ws.tokens.length, 0);
  const totalTokens = totalPat + oauthTokens.length;

  // Workspaces the user can mint a PAT in — passed to ConnectFlow's Advanced/token section.
  const mintTargets = workspaces
    .filter(ws => ws.canManage)
    .map(ws => ({ id: ws.id, name: ws.name, icon: ws.icon, iconColor: ws.iconColor }));

  const oauthByWorkspace = oauthTokens.reduce<Record<string, OAuthToken[]>>((acc, tok) => {
    (acc[tok.workspaceId] ??= []).push(tok);
    return acc;
  }, {});

  const load = () => {
    setLoading(true);
    Promise.all([getUserWorkspacesWithTokens(), getUserAgentActivity(), getUserOAuthTokens(), getMyAgentUsage()])
      .then(([ws, acts, oauth, use]) => { setWorkspaces(ws); setActivity(acts); setOAuthTokens(oauth); setUsage(use); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
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
            <button
              onClick={() => setShowConnect(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-blue-500 hover:bg-blue-400 px-3 py-1.5 rounded-md transition-colors"
            >
              <Link2 size={12} />
              {t('connectButton')}
            </button>
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
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
            </div>
          ) : totalTokens === 0 ? (
            /* First-run: no agent connected anywhere → centered connect CTA */
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <Bot size={26} className="text-amber-400" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-sm font-semibold text-neutral-100">{t('mcpHeroTitle')}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{t('agentsNoTokens')}</p>
              </div>
              <button
                onClick={() => setShowConnect(true)}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-400 px-5 py-2.5 rounded-lg shadow-[0_0_20px_-6px_rgba(68,92,149,0.6)] transition-colors"
              >
                <Link2 size={15} />
                {t('connectButton')}
              </button>
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

          {/* Usage summary — last 30 days, by token owner (response payload → ~tokens) */}
          {!loading && totalTokens > 0 && usage && usage.calls > 0 && (
            <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
              <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-widest">
                {t('agentsUsageLabel')}
              </span>
              <span className="text-[11px] text-neutral-400">
                {t('agentsUsageValue', { tokens: formatTokens(usage.bytes), calls: usage.calls })}
              </span>
            </div>
          )}

          {/* Activity section — hidden until at least one agent is connected */}
          {!loading && totalTokens > 0 && (
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
                        const actMark = markForId(act.agentName) ?? resolveAgentMark(act.agentName) ?? resolveAgentMark(act.tokenName);
                        const actLabel = AGENT_MARKS.find(a => a.id === act.agentName)?.label;
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
                              {actMark && (
                                <span className="flex items-center gap-1 text-[9px] font-semibold text-neutral-400 bg-neutral-800 border border-neutral-700 px-1.5 py-0.5 rounded-full shrink-0">
                                  <MarkIcon mark={actMark} size={9} />
                                  {actLabel && <span>{actLabel}</span>}
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

    {showConnect && (
      <ConnectModal
        mcpUrl={mcpUrl}
        mintTargets={mintTargets}
        source="agents_modal"
        onClose={() => { setShowConnect(false); load(); }}
      />
    )}
    </>
  );
}
