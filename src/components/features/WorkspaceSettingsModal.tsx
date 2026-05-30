'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Zap } from 'lucide-react';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import GeneralTab from './workspace-settings/GeneralTab';
import MembersTab from './workspace-settings/MembersTab';
import TokensTab from './workspace-settings/TokensTab';
import type { CurrentUser, WorkspaceMember } from './workspace-settings/types';

interface WorkspaceSettingsModalProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  workspaceIconColor?: string | null;
  currentUser: CurrentUser;
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onIconChanged?: (icon: string | null, iconColor: string | null) => void;
  onDeleted: () => void;
}

export default function WorkspaceSettingsModal({
  workspaceId,
  workspaceName,
  workspaceIcon,
  workspaceIconColor,
  currentUser,
  onClose,
  onRenamed,
  onIconChanged,
  onDeleted,
}: WorkspaceSettingsModalProps) {
  const t = useTranslations('WorkspaceSettings');
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'tokens'>('general');

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
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === 'tokens'
                  ? activeTab === tab
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent text-amber-500/70 hover:text-amber-400'
                  : activeTab === tab
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tab === 'tokens' && <Zap size={11} className="shrink-0" />}
              {tab === 'general' ? t('tabGeneral') : tab === 'members' ? t('tabMembers') : t('tabTokens')}
            </button>
          ))}
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
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
              hasPrivilegedAccess={hasPrivilegedAccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
