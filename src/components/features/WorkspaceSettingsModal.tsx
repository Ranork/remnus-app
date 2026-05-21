'use client';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { X, Trash, UserPlus, Check, AlertCircle, Copy, KeyRound, Plus, Terminal, Wind, Zap, Crosshair, ChevronDown } from 'lucide-react';
import { renameWorkspace, deleteWorkspace } from '@/lib/actions/workspace';
import {
  getWorkspaceMembers,
  inviteToWorkspace,
  removeFromWorkspace,
  updateWorkspaceMemberRole,
  transferWorkspaceOwnership,
} from '@/lib/actions/auth';
import { mintAgentToken, getAgentTokens, revokeAgentToken } from '@/lib/actions/agentToken';

type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
};

type WorkspaceMember = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: 'owner' | 'member' | 'viewer';
};

type AgentToken = {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: 'read' | 'write';
  createdAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

interface WorkspaceSettingsModalProps {
  workspaceId: string;
  workspaceName: string;
  currentUser: CurrentUser;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}

export default function WorkspaceSettingsModal({
  workspaceId,
  workspaceName,
  currentUser,
  onClose,
  onRenamed,
  onDeleted,
}: WorkspaceSettingsModalProps) {
  const t = useTranslations('WorkspaceSettings');
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'tokens'>('general');

  // General Tab state
  const [newName, setNewName] = useState(workspaceName);
  const [renameError, setRenameError] = useState('');
  const [renameSuccess, setRenameSuccess] = useState('');
  const [isRenaming, startRenameTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  // Members Tab state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'viewer'>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [isInviting, startInviteTransition] = useTransition();
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Tokens Tab state
  const [tokens, setTokens] = useState<AgentToken[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenScope, setTokenScope] = useState<'read' | 'write'>('read');
  const [isMinting, startMintTransition] = useTransition();
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [cmdCopied, setCmdCopied] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [activeGuide, setActiveGuide] = useState<'claude' | 'cursor' | 'windsurf' | 'continue'>('claude');
  const [claudeMode, setClaudeMode] = useState<'cli' | 'json'>('cli');
  const [os, setOs] = useState<'mac' | 'linux' | 'windows'>('mac');

  const mcpUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '/api/mcp';

  const loadMembers = async () => {
    setIsLoadingMembers(true);
    try {
      const list = await getWorkspaceMembers(workspaceId);
      setMembers(list as WorkspaceMember[]);
    } catch (err) {
      console.error('Failed to load workspace members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const loadTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const list = await getAgentTokens(workspaceId);
      setTokens(list as AgentToken[]);
    } catch (err) {
      console.error('Failed to load tokens:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  useEffect(() => {
    if (activeTab === 'tokens') loadTokens();
  }, [activeTab, workspaceId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRename = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setRenameError(t('nameRequired'));
      return;
    }
    setRenameError('');
    setRenameSuccess('');
    startRenameTransition(async () => {
      const res = await renameWorkspace(workspaceId, trimmed) as { success?: boolean; error?: string };
      if (res && 'error' in res) {
        setRenameError(res.error || 'Failed to rename workspace');
      } else {
        setRenameSuccess(t('renameSuccess'));
        onRenamed(trimmed);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(t('deleteConfirm'))) return;
    startDeleteTransition(async () => {
      const res = await deleteWorkspace(workspaceId);
      if (res && 'error' in res) {
        alert(res.error);
      } else {
        onDeleted();
        onClose();
      }
    });
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError(t('emailRequired'));
      return;
    }
    setInviteError('');
    setInviteSuccess('');
    startInviteTransition(async () => {
      const res = await inviteToWorkspace(workspaceId, email, inviteRole);
      if (res && 'error' in res) {
        setInviteError(res.error || 'Failed to invite user');
      } else {
        setInviteSuccess(t('inviteSuccess', { email }));
        setInviteEmail('');
        loadMembers();
      }
    });
  };

  const handleRoleChange = async (userId: string, newRole: 'member' | 'viewer') => {
    setActionPendingId(userId);
    try {
      const res = await updateWorkspaceMemberRole(workspaceId, userId, newRole);
      if (res && 'error' in res) alert(res.error);
      else loadMembers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const handleTransferOwnership = async (userId: string, userName: string | null) => {
    if (!confirm(t('transferConfirm', { name: userName || 'this user' }))) return;
    setActionPendingId(userId);
    try {
      const res = await transferWorkspaceOwnership(workspaceId, userId);
      if (res && 'error' in res) alert(res.error);
      else loadMembers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string | null) => {
    if (!confirm(t('removeConfirm', { name: userName || 'this user' }))) return;
    setActionPendingId(userId);
    try {
      const res = await removeFromWorkspace(workspaceId, userId);
      if (res && 'error' in res) alert(res.error);
      else loadMembers();
    } catch (err) {
      console.error(err);
    } finally {
      setActionPendingId(null);
    }
  };

  const handleMintToken = (e: React.FormEvent) => {
    e.preventDefault();
    const name = tokenName.trim();
    if (!name) return;
    setNewTokenValue(null);
    startMintTransition(async () => {
      try {
        const res = await mintAgentToken(workspaceId, name, tokenScope);
        setNewTokenValue(res.token);
        setTokenName('');
        setTokenScope('read');
        setShowCreateForm(false);
        loadTokens();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleCopyToken = () => {
    if (!newTokenValue) return;
    navigator.clipboard.writeText(newTokenValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRevokeToken = async (tokenId: string) => {
    setRevokingId(tokenId);
    try {
      await revokeAgentToken(tokenId);
      loadTokens();
    } catch (err) {
      console.error(err);
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyCmd = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCmdCopied(key);
      setTimeout(() => setCmdCopied(null), 2000);
    });
  };

  const myWorkspaceMembership = members.find((m) => m.id === currentUser.id);
  const isWorkspaceOwner = myWorkspaceMembership?.role === 'owner';
  const isGlobalAdmin = currentUser.role === 'admin';
  const hasPrivilegedAccess = isWorkspaceOwner || isGlobalAdmin;

  const formatDate = (d: Date | null) => {
    if (!d) return t('never');
    return new Date(d).toLocaleDateString();
  };

  const claudeCliCmd = `claude mcp add --transport http remnus ${mcpUrl} --header "Authorization: Bearer <your-token>"`;
  const makeJsonConfig = (url: string) =>
    JSON.stringify(
      { mcpServers: { remnus: { url, headers: { Authorization: 'Bearer <your-token>' } } } },
      null,
      2,
    );
  const standardJsonConfig = makeJsonConfig(mcpUrl);
  const claudeJsonConfig = JSON.stringify(
    { mcpServers: { remnus: { type: 'http', url: mcpUrl, headers: { Authorization: 'Bearer <your-token>' } } } },
    null,
    2,
  );

  const guides = [
    { id: 'claude' as const, label: 'Claude Code', Icon: Terminal },
    { id: 'cursor' as const, label: 'Cursor', Icon: Crosshair },
    { id: 'windsurf' as const, label: 'Windsurf', Icon: Wind },
    { id: 'continue' as const, label: 'Continue', Icon: Zap },
  ];

  const filePaths: Record<Exclude<typeof guides[number]['id'], 'claude'>, Record<'mac' | 'linux' | 'windows', string>> = {
    cursor: {
      mac: '~/.cursor/mcp.json',
      linux: '~/.cursor/mcp.json',
      windows: '%USERPROFILE%\\.cursor\\mcp.json',
    },
    windsurf: {
      mac: '~/.codeium/windsurf/mcp_config.json',
      linux: '~/.codeium/windsurf/mcp_config.json',
      windows: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json',
    },
    continue: {
      mac: '~/.continue/config.json',
      linux: '~/.continue/config.json',
      windows: '%USERPROFILE%\\.continue\\config.json',
    },
  };

  const testPrompt = 'List all pages and databases in my Remnus workspace';

  return (
    <div
      className="fixed inset-0 bg-black/60 z-100 flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <span className="text-sm font-semibold text-neutral-100">{t('title')}</span>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/10 px-6 shrink-0">
          {(['general', 'members', 'tokens'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab === 'general' ? t('tabGeneral') : tab === 'members' ? t('tabMembers') : t('tabTokens')}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                  {t('workspaceName')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={isRenaming || !hasPrivilegedAccess}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 placeholder-neutral-600 px-3 py-1.5 text-sm outline-none focus:border-blue-500/60 transition-colors disabled:opacity-50"
                  />
                  {hasPrivilegedAccess && (
                    <button
                      onClick={handleRename}
                      disabled={isRenaming || newName.trim() === workspaceName}
                      className="text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md font-medium transition-colors"
                    >
                      {isRenaming ? t('saving') : t('save')}
                    </button>
                  )}
                </div>
                {renameError && (
                  <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> {renameError}
                  </p>
                )}
                {renameSuccess && (
                  <p className="text-xs text-sky-400 flex items-center gap-1 mt-1">
                    <Check size={12} /> {renameSuccess}
                  </p>
                )}
                {!hasPrivilegedAccess && (
                  <p className="text-[11px] text-neutral-500 italic">{t('ownerOnlyHint')}</p>
                )}
              </div>

              {hasPrivilegedAccess && (
                <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-lg space-y-3">
                  <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                    {t('dangerZone')}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">{t('deleteWarning')}</p>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-xs bg-red-400 hover:bg-red-500 text-white font-semibold py-1.5 px-3 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? t('deleting') : t('deleteWorkspace')}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6">
              {hasPrivilegedAccess && (
                <form onSubmit={handleInvite} className="space-y-2">
                  <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                    {t('inviteNewMember')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      disabled={isInviting}
                      className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 placeholder-neutral-600 px-3 py-1.5 text-sm outline-none focus:border-blue-500/60 transition-colors disabled:opacity-50"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'member' | 'viewer')}
                      disabled={isInviting}
                      className="bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-blue-500/60"
                    >
                      <option value="member">{t('roleMember')}</option>
                      <option value="viewer">{t('roleViewer')}</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail.trim()}
                      className="text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1"
                    >
                      <UserPlus size={13} />
                      {isInviting ? t('inviting') : t('invite')}
                    </button>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} /> {inviteError}
                    </p>
                  )}
                  {inviteSuccess && (
                    <p className="text-xs text-sky-400 flex items-center gap-1 mt-1">
                      <Check size={12} /> {inviteSuccess}
                    </p>
                  )}
                </form>
              )}

              <div className="space-y-3">
                <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest">
                  {t('membersCount', { count: members.length })}
                </label>
                {isLoadingMembers ? (
                  <div className="py-8 flex justify-center items-center">
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/20">
                    {members.map((member) => {
                      const isMe = member.id === currentUser.id;
                      const isOwner = member.role === 'owner';
                      const isPending = actionPendingId === member.id;
                      return (
                        <div key={member.id} className="flex items-center justify-between p-3 gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {member.image && member.image !== '' && member.image !== 'null' && !brokenImages[member.id] ? (
                              <img
                                src={member.image}
                                alt={member.name || 'User'}
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                                onError={() => setBrokenImages(prev => ({ ...prev, [member.id]: true }))}
                              />
                            ) : (
                              <div
                                translate="no"
                                className="w-7 h-7 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-semibold text-neutral-200 shrink-0 notranslate"
                              >
                                {(member.name || member.email || 'U').trim().charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-neutral-200 truncate">
                                  {member.name || member.email || 'User'}
                                </span>
                                {isMe && (
                                  <span className="text-[9px] font-semibold text-neutral-500 bg-neutral-800 px-1 py-0.5 rounded">
                                    {t('you')}
                                  </span>
                                )}
                              </div>
                              {member.name && member.email && (
                                <p className="text-[10px] text-neutral-500 truncate">{member.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isOwner ? (
                              <span className="text-[9px] font-bold text-sky-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                {t('roleOwner')}
                              </span>
                            ) : isPending ? (
                              <div className="w-3.5 h-3.5 rounded-full border border-neutral-700 border-t-neutral-400 animate-spin shrink-0" />
                            ) : hasPrivilegedAccess && !isMe ? (
                              <select
                                value={member.role}
                                onChange={(e) => handleRoleChange(member.id, e.target.value as 'member' | 'viewer')}
                                className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300 outline-none cursor-pointer hover:border-neutral-600 focus:border-blue-500/60"
                              >
                                <option value="member">{t('roleMember')}</option>
                                <option value="viewer">{t('roleViewer')}</option>
                              </select>
                            ) : (
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                member.role === 'viewer'
                                  ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                  : 'text-neutral-300 bg-neutral-800 border-neutral-700'
                              }`}>
                                {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                              </span>
                            )}
                            {hasPrivilegedAccess && !isMe && !isOwner && !isPending && (
                              <div className="flex items-center gap-1.5 ml-1">
                                <button
                                  onClick={() => handleTransferOwnership(member.id, member.name || member.email)}
                                  className="text-[10px] font-semibold text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-1.5 py-0.5 rounded border border-neutral-700 transition-colors"
                                >
                                  {t('makeOwner')}
                                </button>
                                <button
                                  onClick={() => handleRemoveMember(member.id, member.name || member.email)}
                                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors rounded hover:bg-neutral-800"
                                >
                                  <Trash size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tokens' && (
            <div className="space-y-6">
              <p className="text-[11px] text-neutral-500 leading-relaxed">{t('tokensSectionHint')}</p>

              {hasPrivilegedAccess ? (
                <div className="space-y-4">
                  {/* Newly created token — shown once */}
                  {newTokenValue && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4 space-y-3">
                      <p className="text-xs text-amber-400 font-semibold flex items-center gap-1.5">
                        <AlertCircle size={13} /> {t('tokenCreatedHint')}
                      </p>
                      <div className="flex gap-2">
                        <code className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-sky-400 font-mono break-all select-all">
                          {newTokenValue}
                        </code>
                        <button
                          onClick={handleCopyToken}
                          className="shrink-0 flex items-center gap-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 px-3 py-2 rounded border border-neutral-700 transition-colors"
                        >
                          {copied ? <Check size={13} className="text-sky-400" /> : <Copy size={13} />}
                          {copied ? t('copied') : t('copyToken')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Token list */}
                  {isLoadingTokens ? (
                    <div className="py-6 flex justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-neutral-800 border-t-neutral-500 animate-spin" />
                    </div>
                  ) : tokens.length === 0 && !showCreateForm ? (
                    /* Empty state — centered create button */
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                        <KeyRound size={18} className="text-neutral-500" />
                      </div>
                      <p className="text-xs text-neutral-500">{t('noTokens')}</p>
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-4 py-2 rounded-md transition-colors mt-1"
                      >
                        <Plus size={13} />
                        {t('createToken')}
                      </button>
                    </div>
                  ) : (
                    /* Token list + add button at bottom */
                    <div className="space-y-2">
                      {tokens.length > 0 && (
                        <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/20">
                          {tokens.map((token) => {
                            const isRevoked = !!token.revokedAt;
                            const isRevoking = revokingId === token.id;
                            return (
                              <div key={token.id} className="flex items-center justify-between p-3 gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-semibold truncate ${isRevoked ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>
                                      {token.name}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                                      isRevoked
                                        ? 'text-neutral-500 bg-neutral-800 border-neutral-700'
                                        : token.scope === 'write'
                                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                          : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    }`}>
                                      {isRevoked ? t('revoked') : token.scope === 'write' ? t('tokenScopeWrite') : t('tokenScopeRead')}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                                    {token.tokenPrefix}… · {t('lastUsed')}: {formatDate(token.lastUsedAt)}
                                  </p>
                                </div>
                                {!isRevoked && (
                                  <button
                                    onClick={() => handleRevokeToken(token.id)}
                                    disabled={isRevoking}
                                    className="shrink-0 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded border border-red-500/20 transition-colors disabled:opacity-50"
                                  >
                                    {isRevoking ? t('revoking') : t('revokeToken')}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Inline create form or add button */}
                      {showCreateForm ? (
                        <form
                          onSubmit={handleMintToken}
                          className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4 space-y-3"
                        >
                          <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                            {t('createToken')}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tokenName}
                              onChange={(e) => setTokenName(e.target.value)}
                              placeholder={t('tokenNamePlaceholder')}
                              disabled={isMinting}
                              autoFocus
                              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 placeholder-neutral-600 px-3 py-1.5 text-sm outline-none focus:border-blue-500/60 transition-colors disabled:opacity-50"
                            />
                            <select
                              value={tokenScope}
                              onChange={(e) => setTokenScope(e.target.value as 'read' | 'write')}
                              disabled={isMinting}
                              className="bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 px-2 py-1.5 text-xs outline-none cursor-pointer focus:border-blue-500/60"
                            >
                              <option value="read">{t('tokenScopeRead')}</option>
                              <option value="write">{t('tokenScopeWrite')}</option>
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => { setShowCreateForm(false); setTokenName(''); setTokenScope('read'); }}
                              disabled={isMinting}
                              className="text-xs text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded-md border border-neutral-700 hover:border-neutral-600 transition-colors"
                            >
                              {t('cancelCreate')}
                            </button>
                            <button
                              type="submit"
                              disabled={isMinting || !tokenName.trim()}
                              className="flex items-center gap-1.5 text-xs bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md font-medium transition-colors"
                            >
                              <KeyRound size={13} />
                              {isMinting ? t('creating') : t('addToken')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-blue-400 border border-dashed border-neutral-700 hover:border-blue-500/40 px-4 py-2.5 rounded-lg transition-colors"
                        >
                          <Plus size={13} />
                          {t('createToken')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 italic">{t('ownerOnlyTokens')}</p>
              )}

              {/* Integration Guide — collapsible */}
              <div className="border-t border-neutral-800 pt-4">
                <button
                  onClick={() => setShowGuide(v => !v)}
                  className="w-full flex items-center justify-between group py-1"
                >
                  <span className="text-[11px] font-semibold text-neutral-300 group-hover:text-white transition-colors uppercase tracking-widest">
                    {t('integrateSetup')}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-neutral-400 group-hover:text-neutral-200 transition-all ${showGuide ? 'rotate-180' : ''}`}
                  />
                </button>

                {showGuide && (
                  <div className="mt-4 space-y-4">
                    <p className="text-[11px] text-neutral-400 leading-relaxed">{t('integrateHint')}</p>

                    {/* OS selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-400 mr-1">OS:</span>
                      {(['mac', 'linux', 'windows'] as const).map((key) => (
                        <button
                          key={key}
                          onClick={() => setOs(key)}
                          className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-colors ${
                            os === key
                              ? 'bg-neutral-700 border-neutral-600 text-neutral-100'
                              : 'border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                          }`}
                        >
                          {key === 'mac' ? 'macOS' : key === 'linux' ? 'Linux' : 'Windows'}
                        </button>
                      ))}
                    </div>

                    {/* Agent tabs */}
                    <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
                      {guides.map(({ id, label, Icon }) => (
                        <button
                          key={id}
                          onClick={() => setActiveGuide(id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                            activeGuide === id
                              ? 'bg-neutral-700 text-white'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          <Icon size={12} className="shrink-0" />
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>

                    {/* Claude tab: CLI vs JSON sub-toggle */}
                    {activeGuide === 'claude' && (
                      <div className="flex gap-1 w-fit border border-neutral-800 rounded-md p-0.5 bg-neutral-900">
                        {(['cli', 'json'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setClaudeMode(mode)}
                            className={`px-3 py-1 rounded text-[10px] font-semibold transition-colors ${
                              claudeMode === mode
                                ? 'bg-neutral-700 text-white'
                                : 'text-neutral-400 hover:text-neutral-200'
                            }`}
                          >
                            {mode === 'cli' ? 'CLI' : 'JSON'}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Code block */}
                    {(() => {
                      let code: string;
                      let hint: string;
                      let filePath: string | undefined;
                      let codeKey: string;
                      let isCmd = false;

                      if (activeGuide === 'claude') {
                        codeKey = `claude-${claudeMode}`;
                        if (claudeMode === 'cli') {
                          code = claudeCliCmd;
                          hint = t('integrateCliStep');
                          isCmd = true;
                        } else {
                          code = claudeJsonConfig;
                          hint = t('integrateJsonStep');
                          filePath = '.mcp.json';
                        }
                      } else {
                        codeKey = activeGuide;
                        code = standardJsonConfig;
                        hint = t('integrateJsonStep');
                        filePath = filePaths[activeGuide][os];
                      }

                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] text-neutral-400">{hint}</p>
                            {filePath && (
                              <code className="shrink-0 text-[10px] text-neutral-300 font-mono bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
                                {filePath}
                              </code>
                            )}
                          </div>
                          <div className="relative group">
                            {isCmd ? (
                              <code className="block bg-neutral-950 border border-neutral-800 rounded-md px-4 py-3 text-[11px] text-sky-400 font-mono break-all leading-relaxed">
                                {code}
                              </code>
                            ) : (
                              <pre className="bg-neutral-950 border border-neutral-800 rounded-md px-4 py-3 text-[11px] text-sky-400 font-mono overflow-x-auto leading-relaxed">
                                {code}
                              </pre>
                            )}
                            <button
                              onClick={() => handleCopyCmd(codeKey, code)}
                              className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-neutral-800/90 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded border border-neutral-700 transition-all opacity-0 group-hover:opacity-100"
                            >
                              {cmdCopied === codeKey ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
                              {cmdCopied === codeKey ? t('copied') : t('copyToken')}
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Test prompt */}
                    <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-neutral-300 uppercase tracking-wider">
                          {t('integrateTestPrompt')}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400">{t('integrateTestHint')}</p>
                      <div className="relative group flex items-center gap-2">
                        <p className="flex-1 text-[11px] text-neutral-200 italic bg-neutral-950 border border-neutral-700 rounded px-3 py-2 leading-relaxed">
                          &ldquo;{testPrompt}&rdquo;
                        </p>
                        <button
                          onClick={() => handleCopyCmd('test', testPrompt)}
                          className="shrink-0 flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 px-2 py-2 rounded border border-neutral-700 transition-colors"
                        >
                          {cmdCopied === 'test' ? <Check size={11} className="text-sky-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
