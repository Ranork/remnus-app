'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Zap, Settings, Users, Link, Share2 } from 'lucide-react';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import GeneralTab from './workspace-settings/GeneralTab';
import MembersTab from './workspace-settings/MembersTab';
import TokensTab from './workspace-settings/TokensTab';
import SharingTab from './workspace-settings/SharingTab';
import type { CurrentUser, WorkspaceMember } from './workspace-settings/types';

interface WorkspaceSettingsModalProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  workspaceIconColor?: string | null;
  currentUser: CurrentUser;
  initialTab?: 'general' | 'members' | 'tokens' | 'sharing';
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onIconChanged?: (icon: string | null, iconColor: string | null) => void;
  onDeleted: () => void;
}

type Tab = 'general' | 'members' | 'tokens' | 'sharing';

export default function WorkspaceSettingsModal({
  workspaceId,
  workspaceName,
  workspaceIcon,
  workspaceIconColor,
  currentUser,
  initialTab,
  onClose,
  onRenamed,
  onIconChanged,
  onDeleted,
}: WorkspaceSettingsModalProps) {
  const t = useTranslations('WorkspaceSettings');
  const tSharing = useTranslations('Sharing');
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'general');

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);

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

  useEffect(() => { loadMembers(); }, [workspaceId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const myRole = members.find((m) => m.id === currentUser.id)?.role;
  const hasPrivilegedAccess = myRole === 'owner' || currentUser.role === 'admin';

  const tabs: { id: Tab; label: string; icon: React.ReactNode; accent?: string }[] = [
    { id: 'general',  label: t('tabGeneral'),         icon: <Settings size={13} /> },
    { id: 'tokens',   label: t('tabTokens'),           icon: <Zap size={13} />,   accent: 'amber' },
    { id: 'members',  label: t('tabMembers'),          icon: <Users size={13} /> },
    { id: 'sharing',  label: tSharing('tabSharing'),   icon: <Share2 size={13} />, accent: 'green' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-100 flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-3xl bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', minHeight: 'min(520px, 85vh)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-neutral-100 shrink-0">{t('title')}</span>
            <span className="text-neutral-700 shrink-0">·</span>
            <span className="text-sm text-neutral-400 truncate">{workspaceName}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mobile tab strip */}
        <div className="flex sm:hidden border-b border-neutral-800 bg-neutral-900/50 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs whitespace-nowrap border-b-2 transition-colors cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? tab.accent === 'amber'
                    ? 'border-amber-400 text-amber-300 font-medium'
                    : tab.accent === 'green'
                      ? 'border-green-400 text-green-300 font-medium'
                      : 'border-blue-500 text-neutral-100 font-medium'
                  : tab.accent === 'amber'
                    ? 'border-transparent text-amber-500/70 hover:text-amber-400'
                    : 'border-transparent text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === 'tokens' && activeTab !== 'tokens' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Body: left nav + content */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Desktop left nav */}
          <div className="hidden sm:flex w-44 shrink-0 border-r border-neutral-800 flex-col bg-neutral-900/50">
            <nav className="flex-1 p-2 space-y-0.5 pt-3">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer rounded ${
                    activeTab === tab.id
                      ? tab.accent === 'amber'
                        ? 'bg-neutral-800 text-amber-300 font-medium'
                        : tab.accent === 'green'
                          ? 'bg-neutral-800 text-green-300 font-medium'
                          : 'bg-neutral-800 text-neutral-100 font-medium'
                      : tab.accent === 'amber'
                        ? 'text-amber-500/80 hover:text-amber-400 hover:bg-neutral-800/60'
                        : tab.accent === 'green'
                          ? 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
                          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                  {tab.id === 'tokens' && activeTab !== 'tokens' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Scrollable content */}
          <div key={activeTab} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 animate-tab-fade">
            {activeTab === 'general' && (
              <GeneralTab
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                workspaceIcon={workspaceIcon}
                workspaceIconColor={workspaceIconColor}
                hasPrivilegedAccess={hasPrivilegedAccess}
                onRenamed={onRenamed}
                onIconChanged={onIconChanged}
                onDeleted={onDeleted}
                onClose={onClose}
              />
            )}
            {activeTab === 'members' && (
              <MembersTab
                workspaceId={workspaceId}
                currentUser={currentUser}
                hasPrivilegedAccess={hasPrivilegedAccess}
                members={members}
                isLoadingMembers={isLoadingMembers}
                onMembersChanged={loadMembers}
              />
            )}
            {activeTab === 'tokens' && (
              <TokensTab
                workspaceId={workspaceId}
                workspaceName={workspaceName}
                hasPrivilegedAccess={hasPrivilegedAccess}
              />
            )}
            {activeTab === 'sharing' && (
              <SharingTab
                workspaceId={workspaceId}
                isAdmin={currentUser.role === 'admin'}
                onNavigateToMembers={() => setActiveTab('members')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
