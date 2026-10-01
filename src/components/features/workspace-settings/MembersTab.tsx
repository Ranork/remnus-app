'use client';
import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlus, AlertCircle, Check, Trash, Copy, Mail, Hand, X, Loader2 } from 'lucide-react';
import {
  inviteToWorkspace,
  removeFromWorkspace,
  updateWorkspaceMemberRole,
  transferWorkspaceOwnership,
} from '@/lib/actions/auth';
import { getWorkspaceSeatUsage } from '@/lib/actions/billing';
import { getWorkspaceInvites, revokeWorkspaceInvite } from '@/lib/actions/invites';
import {
  approveWorkspaceAccessRequest,
  denyWorkspaceAccessRequest,
  getWorkspaceAccessRequests,
} from '@/lib/actions/accessRequests';
import type { CurrentUser, WorkspaceMember } from './types';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { SimpleSelect } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';

/** A hairline-divided list in a hairline frame — the settings dialogs' one list look. */
const LIST = 'flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]';

interface MembersTabProps {
  workspaceId: string;
  currentUser: CurrentUser;
  hasPrivilegedAccess: boolean;
  members: WorkspaceMember[];
  isLoadingMembers: boolean;
  onMembersChanged: () => void;
}

export default function MembersTab({
  workspaceId,
  currentUser,
  hasPrivilegedAccess,
  members,
  isLoadingMembers,
  onMembersChanged,
}: MembersTabProps) {
  const t = useTranslations('WorkspaceSettings');
  const tBilling = useTranslations('Billing');
  const roleOptions = [
    { value: 'member', label: t('roleMember') },
    { value: 'viewer', label: t('roleViewer') },
  ];

  const [seatUsage, setSeatUsage] = useState<{ used: number; limit: number } | null>(null);
  const [invites, setInvites] = useState<{ id: string; email: string; role: string; inviteLink: string }[]>([]);
  // People who ran `npx remnus join` against this workspace without being members.
  // They are blocked until someone here answers, so this list sits above the roster.
  const [accessRequests, setAccessRequests] = useState<
    { id: string; name: string | null; email: string | null; projectName: string | null; note: string | null }[]
  >([]);
  const [requestPendingId, setRequestPendingId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadInvites = () => {
    if (!hasPrivilegedAccess) return;
    getWorkspaceInvites(workspaceId).then(setInvites).catch(() => {});
    getWorkspaceAccessRequests(workspaceId).then(setAccessRequests).catch(() => {});
  };
  useEffect(() => {
    getWorkspaceSeatUsage(workspaceId).then((u) => setSeatUsage(u)).catch(() => {});
    loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, members.length]);
  const atSeatLimit = !!seatUsage && isFinite(seatUsage.limit) && seatUsage.used >= seatUsage.limit;

  const copyLink = (link: string) => {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  const answerRequest = async (id: string, approve: boolean) => {
    setRequestPendingId(id);
    setActionError('');
    try {
      const res = approve
        ? await approveWorkspaceAccessRequest(id)
        : await denyWorkspaceAccessRequest(id);
      // A seat limit is the one refusal worth surfacing: the request is still
      // pending, so the owner can free a seat and approve the same row afterwards.
      if (res && 'error' in res && res.error) setActionError(res.error);
      else if (approve) onMembersChanged();
      loadInvites();
      getWorkspaceSeatUsage(workspaceId).then((u) => setSeatUsage(u)).catch(() => {});
    } finally {
      setRequestPendingId(null);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    if (revokingInviteId) return;
    setRevokingInviteId(id);
    await revokeWorkspaceInvite(id).catch(() => {});
    setRevokingInviteId(null);
    loadInvites();
    getWorkspaceSeatUsage(workspaceId).then((u) => setSeatUsage(u)).catch(() => {});
  };

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [isInviting, startInviteTransition] = useTransition();
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');
  const [showTransferConfirm, setShowTransferConfirm] = useState<{ userId: string; name: string } | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<{ userId: string; name: string } | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { setInviteError(t('emailRequired')); return; }
    setInviteError('');
    setInviteSuccess('');
    setInviteLink(null);
    startInviteTransition(async () => {
      const res = await inviteToWorkspace(workspaceId, email, inviteRole);
      if (res && 'error' in res && res.error) {
        setInviteError(res.error);
      } else if (res && 'inviteLink' in res && res.inviteLink) {
        // No account yet → show a shareable invite link.
        setInviteLink(res.inviteLink);
        setInviteEmail('');
        loadInvites();
        getWorkspaceSeatUsage(workspaceId).then((u) => setSeatUsage(u)).catch(() => {});
      } else {
        setInviteSuccess(t('inviteSuccess', { email }));
        setInviteEmail('');
        onMembersChanged();
      }
    });
  };

  const handleRoleChange = async (userId: string, newRole: 'member' | 'viewer') => {
    setActionPendingId(userId);
    setActionError('');
    try {
      const res = await updateWorkspaceMemberRole(workspaceId, userId, newRole);
      if (res && 'error' in res) setActionError(res.error ?? '');
      else onMembersChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const handleTransferOwnership = (userId: string, userName: string | null) => {
    setShowTransferConfirm({ userId, name: userName || 'this user' });
  };

  const doTransferOwnership = async () => {
    if (!showTransferConfirm) return;
    const { userId } = showTransferConfirm;
    setShowTransferConfirm(null);
    setActionPendingId(userId);
    setActionError('');
    try {
      const res = await transferWorkspaceOwnership(workspaceId, userId);
      if (res && 'error' in res) setActionError(res.error ?? '');
      else onMembersChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const handleRemoveMember = (userId: string, userName: string | null) => {
    setShowRemoveConfirm({ userId, name: userName || 'this user' });
  };

  const doRemoveMember = async () => {
    if (!showRemoveConfirm) return;
    const { userId } = showRemoveConfirm;
    setShowRemoveConfirm(null);
    setActionPendingId(userId);
    setActionError('');
    try {
      const res = await removeFromWorkspace(workspaceId, userId);
      if (res && 'error' in res) setActionError(res.error ?? '');
      else onMembersChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const roleLabel = (role: string) =>
    role === 'owner' ? t('roleOwner') : role === 'viewer' ? t('roleViewer') : t('roleMember');

  return (
    <SettingsPage>
      {hasPrivilegedAccess && (
        <SettingsSection
          title={t('inviteNewMember')}
          action={seatUsage && (
            <Badge variant={atSeatLimit ? 'danger' : 'outline'}>
              {tBilling('seatsUsage', { used: seatUsage.used, limit: isFinite(seatUsage.limit) ? String(seatUsage.limit) : '∞' })}
            </Badge>
          )}
        >
          <form onSubmit={handleInvite} className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                aria-label={t('emailPlaceholder')}
                disabled={isInviting}
                className="flex-1"
              />
              <div className="flex gap-2">
                <SimpleSelect
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as 'member' | 'viewer')}
                  options={roleOptions}
                  disabled={isInviting}
                  aria-label={t('roleLabel')}
                  className="flex-1 sm:w-32 sm:flex-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!inviteEmail.trim() || atSeatLimit}
                  loading={isInviting}
                >
                  <UserPlus />
                  {t('invite')}
                </Button>
              </div>
            </div>
            {atSeatLimit && (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertCircle size={12} className="shrink-0" /> {tBilling('seatLimitHint')}
              </p>
            )}
            {inviteError && (
              <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertCircle size={12} className="shrink-0" /> {inviteError}
              </p>
            )}
            {inviteSuccess && (
              <p role="status" className="flex items-center gap-1.5 text-xs text-fg-2">
                <Check size={12} className="shrink-0 text-green-400" /> {inviteSuccess}
              </p>
            )}
          </form>

          {/* Invite link for a not-yet-registered person */}
          {inviteLink && (
            <div className="flex flex-col gap-2 rounded-control bg-signal-soft p-3">
              <p className="flex items-center gap-1.5 text-xs text-fg">
                <Mail size={14} className="shrink-0 text-signal-text" /> {tBilling('inviteLinkReady')}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={inviteLink}
                  size="sm"
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={tBilling('inviteLinkReady')}
                  className="flex-1 font-mono"
                />
                <Button size="sm" variant="primary" onClick={() => copyLink(inviteLink)}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? tBilling('copied') : tBilling('copy')}
                </Button>
              </div>
            </div>
          )}
        </SettingsSection>
      )}

      {/* Access requests — someone asked to be let in (npx remnus join) */}
      {hasPrivilegedAccess && accessRequests.length > 0 && (
        <SettingsSection title={t('accessRequestsTitle')}>
          <ul className={LIST}>
            {accessRequests.map((req) => {
              const busy = requestPendingId === req.id;
              return (
                <li key={req.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Hand size={14} className="mt-0.5 shrink-0 text-signal-text" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ui font-medium text-fg">{req.name || req.email || 'User'}</p>
                    {req.name && req.email && <p className="truncate text-xs text-fg-3">{req.email}</p>}
                    {req.projectName && (
                      <p className="text-xs text-fg-3">{t('accessRequestFrom', { project: req.projectName })}</p>
                    )}
                    {req.note && (
                      <p className="mt-1 text-xs leading-relaxed break-words whitespace-pre-wrap text-fg-2">{req.note}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => answerRequest(req.id, true)}
                      disabled={atSeatLimit || (!!requestPendingId && !busy)}
                      loading={busy}
                      title={atSeatLimit ? tBilling('seatLimitHint') : undefined}
                    >
                      {t('approveRequest')}
                    </Button>
                    <Tooltip content={t('denyRequest')}>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => answerRequest(req.id, false)}
                        disabled={!!requestPendingId}
                        aria-label={t('denyRequest')}
                        className="hover:text-red-400"
                      >
                        <X />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      )}

      {/* Pending invites */}
      {hasPrivilegedAccess && invites.length > 0 && (
        <SettingsSection title={tBilling('pendingInvites')}>
          <ul className={LIST}>
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                <Mail size={14} className="shrink-0 text-fg-3" />
                <span className="min-w-0 flex-1 truncate text-ui text-fg">{inv.email}</span>
                <span className="shrink-0 text-xs text-fg-3">{roleLabel(inv.role)}</span>
                <div className="flex shrink-0 items-center">
                  <Tooltip content={tBilling('copy')}>
                    <Button size="icon-sm" variant="ghost" onClick={() => copyLink(inv.inviteLink)} aria-label={tBilling('copy')}>
                      <Copy />
                    </Button>
                  </Tooltip>
                  <Tooltip content={tBilling('revokeInvite')}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleRevokeInvite(inv.id)}
                      disabled={!!revokingInviteId && revokingInviteId !== inv.id}
                      loading={revokingInviteId === inv.id}
                      aria-label={tBilling('revokeInvite')}
                      className="hover:text-red-400"
                    >
                      <Trash />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}

      <SettingsSection title={t('membersCount', { count: members.length })}>
        {isLoadingMembers ? (
          <div role="status" className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-fg-3" />
          </div>
        ) : (
          <ul className={LIST}>
            {members.map((member) => {
              const isMe = member.id === currentUser.id;
              const isOwner = member.role === 'owner';
              const isPending = actionPendingId === member.id;
              return (
                <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {member.image && member.image !== '' && member.image !== 'null' && !brokenImages[member.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.image}
                        alt={member.name || 'User'}
                        className="size-7 shrink-0 rounded-full object-cover"
                        onError={() => setBrokenImages(prev => ({ ...prev, [member.id]: true }))}
                      />
                    ) : (
                      <div
                        translate="no"
                        className="notranslate flex size-7 shrink-0 items-center justify-center rounded-full bg-hover text-xs font-semibold text-fg-2"
                      >
                        {(member.name || member.email || 'U').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-ui font-medium text-fg">
                          {member.name || member.email || 'User'}
                        </span>
                        {isMe && <Badge size="sm">{t('you')}</Badge>}
                      </div>
                      {member.name && member.email && (
                        <p className="truncate text-xs text-fg-3">{member.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {isOwner ? (
                      <Badge variant="outline">{t('roleOwner')}</Badge>
                    ) : isPending ? (
                      <Loader2 size={14} className="animate-spin text-fg-3" aria-label={t('saving')} />
                    ) : hasPrivilegedAccess && !isMe ? (
                      <SimpleSelect
                        size="sm"
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v as 'member' | 'viewer')}
                        options={roleOptions}
                        aria-label={t('roleLabel')}
                      />
                    ) : (
                      <Badge>{roleLabel(member.role)}</Badge>
                    )}
                    {hasPrivilegedAccess && !isMe && !isOwner && !isPending && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => handleTransferOwnership(member.id, member.name || member.email)}>
                          {t('makeOwner')}
                        </Button>
                        <Tooltip content={t('remove')}>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                            aria-label={t('remove')}
                            className="hover:text-red-400"
                          >
                            <Trash />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      {actionError && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle size={12} className="shrink-0" /> {actionError}
        </p>
      )}

      {showTransferConfirm && (
        <ConfirmDialog
          title={t('transferOwnershipTitle')}
          description={t('transferConfirm', { name: showTransferConfirm.name })}
          confirmLabel={t('makeOwner')}
          cancelLabel={t('cancel')}
          onConfirm={doTransferOwnership}
          onCancel={() => setShowTransferConfirm(null)}
        />
      )}

      {showRemoveConfirm && (
        <ConfirmDialog
          title={t('removeMemberTitle')}
          description={t('removeConfirm', { name: showRemoveConfirm.name })}
          confirmLabel={t('remove')}
          cancelLabel={t('cancel')}
          onConfirm={doRemoveMember}
          onCancel={() => setShowRemoveConfirm(null)}
        />
      )}
    </SettingsPage>
  );
}
