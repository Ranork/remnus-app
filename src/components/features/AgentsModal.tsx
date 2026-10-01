'use client';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bot, ChevronDown, RefreshCw, Link2, Check, User, Loader2 } from 'lucide-react';
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
import { getMyAgentMetrics, type AgentMetrics } from '@/lib/actions/agentMetrics';
import AgentSavingsCard from './AgentSavingsCard';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

type WsWithTokens = Awaited<ReturnType<typeof getUserWorkspacesWithTokens>>[number];
type WorkspaceToken = WsWithTokens['tokens'][number];
type ActivityRow = Awaited<ReturnType<typeof getUserAgentActivity>>[number];
type OAuthToken = Awaited<ReturnType<typeof getUserOAuthTokens>>[number];

type UnifiedRow =
  | { kind: 'pat';   data: WorkspaceToken }
  | { kind: 'oauth'; data: OAuthToken };

type AgentUsage = Awaited<ReturnType<typeof getMyAgentUsage>>;

/** A hairline-divided list in a hairline frame. */
const LIST = 'flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]';

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

const EXPIRY_BADGE = {
  expired: 'danger',
  soon: 'warning',
  ok: 'outline',
  never: 'outline',
} as const;

/** "52 sn önce" / "52s ago" in the UI locale — this used to be English everywhere. */
function relativeTime(d: Date | null, locale: string): string {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (s < 60)    return rtf.format(-s, 'second');
  if (s < 3600)  return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  return rtf.format(-Math.floor(s / 86400), 'day');
}

// ── AgentTypePicker ─────────────────────────────────────────────────────────────
// The agent's brand mark; clicking it sets which agent this connection is.
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
  const mark = (
    <AgentMark override={override} hint={hint} size={14} fallback={fallback} />
  );
  const box = 'flex size-7 shrink-0 items-center justify-center rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]';
  if (!canEdit) return <span className={box}>{mark}</span>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('agentSetType')}
        title={t('agentSetType')}
        className={cn(box, 'cursor-pointer transition-shadow hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-popup-open:shadow-[inset_0_0_0_1px_var(--color-line-strong)]')}
      >
        {mark}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t('agentSetType')}</DropdownMenuLabel>
          {AGENT_MARKS.map(a => (
            <DropdownMenuItem key={a.id} onClick={() => onPick(a.id)}>
              <MarkIcon mark={a.mark} size={14} />
              <span className="flex-1">{a.label}</span>
              {override === a.id && <Check className="text-signal-text" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onPick(null)}>
          <span aria-hidden className="w-4 text-center text-fg-4">∅</span>
          <span className="flex-1">{t('agentAutoDetect')}</span>
          {!override && <Check className="text-signal-text" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [showConfirm, setShowConfirm] = useState(false);
  const locale = useLocale();

  // Normalize fields across the two token kinds
  const isPat = row.kind === 'pat';
  const name = isPat
    ? row.data.name
    : (row.data.displayName ?? row.data.clientName ?? row.data.clientId.slice(0, 12));
  const scope = row.data.scope;
  const canRevoke = row.data.canRevoke;
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

  // Async: the confirm dialog keeps a spinner until the token is gone, then the list
  // reload unmounts this row (and the dialog with it).
  const doRevoke = async () => {
    if (isPat) await revokeAgentToken(id);
    else        await revokeOAuthToken(id);
    setShowConfirm(false);
    onRevoked();
  };

  // Whose agent this is: anyone's in the workspace, or — for a PAT — nobody's once the
  // creator's account is gone.
  const owner = row.data.owner;
  // Only the grantee (or an admin) may relabel an OAuth connection; a PAT's owner-level
  // controls follow the revoke permission.
  const canEditType = isPat ? canRevoke : row.data.canEditType;
  const ownerLabel = !owner
    ? t('tokenOwnerDeleted')
    : owner.isYou ? t('you') : (owner.name || owner.email || '—');
  const ownerEmail = owner && !owner.isYou && owner.name ? owner.email : null;
  const roleLabel = owner?.role === 'owner' ? t('roleOwner')
    : owner?.role === 'member' ? t('roleMember')
    : owner?.role === 'viewer' ? t('roleViewer')
    : null;

  return (
    <li className="group flex items-start gap-3 px-3 py-3">
      <AgentTypePicker
        override={override}
        hint={iconHint}
        fallback={isPat ? 'zap' : 'globe'}
        canEdit={canEditType}
        onPick={handlePickAgent}
        t={t}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 truncate text-ui font-medium text-fg">{name}</span>
          <Badge variant={scope === 'write' ? 'signal' : 'neutral'} size="sm">
            {scope === 'write' ? t('tokenScopeWrite') : t('tokenScopeRead')}
          </Badge>
          {isPat ? (
            <Badge variant={EXPIRY_BADGE[expiryState(row.data.expiresAt)]} size="sm">
              {expiryLabel(row.data.expiresAt, t)}
            </Badge>
          ) : (
            <Badge variant="outline" size="sm" title={t('tokenAutoRenewingHint')}>
              <RefreshCw className="size-2.5" />
              {t('tokenAutoRenewing')}
            </Badge>
          )}
          <Badge variant="outline" size="sm">{isPat ? 'PAT' : 'OAuth'}</Badge>
        </div>
        <div
          className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs"
          title={owner && !owner.isYou ? t('tokenOwnerTitle', { name: [owner.name, owner.email].filter(Boolean).join(', ') || '—' }) : undefined}
        >
          <User size={12} className="shrink-0 text-fg-4" />
          <span className={cn('truncate', owner ? 'text-fg-2' : 'text-fg-3 italic')}>{ownerLabel}</span>
          {ownerEmail && <span className="hidden truncate text-fg-3 sm:inline">{ownerEmail}</span>}
          {roleLabel && <span className="shrink-0 text-fg-3">({roleLabel})</span>}
          {owner && !owner.active && (
            <Badge variant="danger" size="sm" title={t('tokenOwnerNotMemberHint')}>
              {t('tokenOwnerNotMember')}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-fg-3">
          {isPat ? (
            <>
              <span className="font-mono">{row.data.tokenPrefix}…</span>
              <span>{t('lastUsed')}: {row.data.lastUsedAt ? relativeTime(row.data.lastUsedAt, locale) : t('never')}</span>
            </>
          ) : (
            <span>{relativeTime(row.data.createdAt, locale)}</span>
          )}
        </p>
      </div>
      {canRevoke && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setShowConfirm(true)}
          className="shrink-0 hover:bg-red-500/12 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-popup-open:opacity-100"
        >
          {t('revokeToken')}
        </Button>
      )}
      {showConfirm && (
        <ConfirmDialog
          title={t('revokeToken')}
          description={t('revokeTokenConfirm', { name, owner: ownerLabel })}
          confirmLabel={t('revokeToken')}
          cancelLabel={t('cancel')}
          onConfirm={doRevoke}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </li>
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
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 px-1 text-xs font-medium text-fg-3">
        {ws.icon
          ? <PageIcon icon={ws.icon} iconColor={ws.iconColor} size={14} />
          : <span className="flex size-3.5 items-center justify-center rounded-sm bg-hover text-2xs leading-none font-semibold text-fg-3">
              {ws.name.charAt(0).toUpperCase()}
            </span>
        }
        <span className="truncate">{ws.name}</span>
      </h3>

      {rows.length === 0 ? (
        <p className="rounded-surface px-3 py-2.5 text-xs text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
          {t('agentsWorkspaceEmpty')}
        </p>
      ) : (
        <ul className={LIST}>
          {rows.map(row => (
            <TokenRow key={`${row.kind}-${row.data.id}`} row={row} t={t} onRevoked={onRevoked} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function AgentsModal({ onClose }: Props) {
  const t = useTranslations('WorkspaceSettings');
  const locale = useLocale();

  const [workspaces,    setWorkspaces]    = useState<WsWithTokens[]>([]);
  const [activity,      setActivity]      = useState<ActivityRow[]>([]);
  const [oauthTokens,   setOAuthTokens]   = useState<OAuthToken[]>([]);
  const [usage,         setUsage]         = useState<AgentUsage | null>(null);
  const [metrics,       setMetrics]       = useState<AgentMetrics | null>(null);
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
    Promise.all([getUserWorkspacesWithTokens(), getUserAgentActivity(), getUserOAuthTokens(), getMyAgentUsage(), getMyAgentMetrics()])
      .then(([ws, acts, oauth, use, mets]) => { setWorkspaces(ws); setActivity(acts); setOAuthTokens(oauth); setUsage(use); setMetrics(mets); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader className="flex-row items-center gap-3">
          <DialogTitle className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{t('agentsTitle')}</span>
            {totalTokens > 0 && <Badge>{totalTokens}</Badge>}
          </DialogTitle>
          {totalTokens > 0 && (
            <Button size="sm" variant="primary" onClick={() => setShowConnect(true)}>
              <Link2 />
              {t('connectButton')}
            </Button>
          )}
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          {/* What the agents have saved, first: it is why the rest of this list exists. */}
          {!loading && totalTokens > 0 && <AgentSavingsCard variant="modal" metrics={metrics} />}

          {loading ? (
            <div role="status" className="flex justify-center py-16">
              <Loader2 size={18} className="animate-spin text-fg-3" />
            </div>
          ) : totalTokens === 0 ? (
            /* First-run: no agent connected anywhere → the one action */
            <EmptyState icon={<Bot />} title={t('mcpHeroTitle')} description={t('agentsNoTokens')}>
              <Button variant="primary" onClick={() => setShowConnect(true)}>
                <Link2 />
                {t('connectButton')}
              </Button>
            </EmptyState>
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
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-4">
              <span className="text-ui font-medium text-fg">{t('agentsUsageLabel')}</span>
              <span className="text-xs text-fg-3">
                {t('agentsUsageValue', { tokens: formatTokens(usage.bytes), calls: usage.calls })}
              </span>
            </div>
          )}

          {/* Activity — hidden until at least one agent is connected */}
          {!loading && totalTokens > 0 && (
            <section className="border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setShowActivity(v => !v)}
                aria-expanded={showActivity}
                className="group flex w-full cursor-pointer items-center justify-between rounded-control py-1.5"
              >
                <span className="flex items-center gap-2 text-ui font-medium text-fg-2 transition-colors group-hover:text-fg">
                  {t('agentsActivity')}
                  {activity.length > 0 && <Badge size="sm">{activity.length}</Badge>}
                </span>
                <ChevronDown
                  size={16}
                  className={cn('text-fg-3 transition-transform duration-150', showActivity && 'rotate-180')}
                />
              </button>

              {showActivity && (
                <div className="mt-2">
                  {activity.length === 0 ? (
                    <p className="py-2 text-xs text-fg-3">{t('agentsNoActivity')}</p>
                  ) : (
                    <ul className="flex flex-col">
                      {activity.map(act => {
                        const actMark = markForId(act.agentName) ?? resolveAgentMark(act.agentName) ?? resolveAgentMark(act.tokenName);
                        const actLabel = AGENT_MARKS.find(a => a.id === act.agentName)?.label;
                        return (
                          <li
                            key={act.id}
                            className="flex items-center gap-3 rounded-control px-2 py-1.5 transition-colors hover:bg-hover/50"
                          >
                            <span
                              aria-hidden
                              className={cn('size-1.5 shrink-0 rounded-full', act.status === 'success' ? 'bg-fg-4' : 'bg-red-400')}
                            />
                            <span className="w-28 shrink-0 truncate font-mono text-xs text-fg sm:w-36" title={act.tool}>{act.tool}</span>
                            <span className="flex min-w-0 items-center gap-1">
                              {actMark && (
                                <Badge size="sm">
                                  <MarkIcon mark={actMark} size={10} />
                                  {actLabel && <span>{actLabel}</span>}
                                </Badge>
                              )}
                              <Badge size="sm" variant="outline" className="max-w-32 truncate">
                                <span className="truncate">{act.tokenName}</span>
                              </Badge>
                            </span>
                            <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-3 sm:block">
                              {act.workspaceName}
                            </span>
                            <span className="ml-auto shrink-0 text-xs text-fg-3">
                              {relativeTime(act.createdAt, locale)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}
        </DialogBody>

        {showConnect && (
          <ConnectModal
            mcpUrl={mcpUrl}
            mintTargets={mintTargets}
            source="agents_modal"
            onClose={() => { setShowConnect(false); load(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
