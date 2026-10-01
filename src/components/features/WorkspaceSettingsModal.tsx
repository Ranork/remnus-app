'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Zap, Settings, Users, Share2, CreditCard, Archive } from 'lucide-react';
import { getWorkspaceMembers } from '@/lib/actions/auth';
import GeneralTab from './workspace-settings/GeneralTab';
import MembersTab from './workspace-settings/MembersTab';
import TokensTab from './workspace-settings/TokensTab';
import SharingTab from './workspace-settings/SharingTab';
import BillingTab from './workspace-settings/BillingTab';
import PortabilityTab from './workspace-settings/PortabilityTab';
import type { CurrentUser, WorkspaceMember } from './workspace-settings/types';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';

interface WorkspaceSettingsModalProps {
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string | null;
  workspaceIconColor?: string | null;
  currentUser: CurrentUser;
  initialTab?: 'general' | 'members' | 'tokens' | 'sharing' | 'billing' | 'portability';
  onClose: () => void;
  onRenamed: (newName: string) => void;
  onIconChanged?: (icon: string | null, iconColor: string | null) => void;
  onDeleted: () => void;
  /** Closes this modal and opens the AI Agents control center (from the Tokens tab). */
  onOpenAgents: () => void;
  /** Closes this modal and opens the global Billing center (from the Billing tab). */
  onOpenBilling: () => void;
}

type Tab = 'general' | 'members' | 'tokens' | 'sharing' | 'billing' | 'portability';

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
  onOpenAgents,
  onOpenBilling,
}: WorkspaceSettingsModalProps) {
  const t = useTranslations('WorkspaceSettings');
  const tSharing = useTranslations('Sharing');
  const tBilling = useTranslations('Billing');
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMembers(); }, [workspaceId]);

  const myRole = members.find((m) => m.id === currentUser.id)?.role;
  const hasPrivilegedAccess = myRole === 'owner' || currentUser.role === 'admin';

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general',     label: t('tabGeneral'),       icon: <Settings /> },
    { id: 'tokens',      label: t('tabTokens'),        icon: <Zap /> },
    { id: 'members',     label: t('tabMembers'),       icon: <Users /> },
    { id: 'sharing',     label: tSharing('tabSharing'), icon: <Share2 /> },
    { id: 'billing',     label: tBilling('tab'),       icon: <CreditCard /> },
    { id: 'portability', label: t('tabPortability'),   icon: <Archive /> },
  ];

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="truncate">{workspaceName}</DialogDescription>
        </DialogHeader>

        <Tabs
          variant="nav"
          orientation="vertical"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
        >
          <TabsList aria-label={t('title')}>
            {tabs.map(tab => (
              <TabsTab key={tab.id} value={tab.id}>
                {tab.icon}
                <span className="truncate">{tab.label}</span>
              </TabsTab>
            ))}
          </TabsList>

          <DialogBody className="sm:px-6 sm:py-5">
            <TabsPanel value="general" className="animate-tab-fade">
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
            </TabsPanel>
            <TabsPanel value="members" className="animate-tab-fade">
              <MembersTab
                workspaceId={workspaceId}
                currentUser={currentUser}
                hasPrivilegedAccess={hasPrivilegedAccess}
                members={members}
                isLoadingMembers={isLoadingMembers}
                onMembersChanged={loadMembers}
              />
            </TabsPanel>
            <TabsPanel value="tokens" className="animate-tab-fade">
              <TokensTab onOpenAgents={onOpenAgents} />
            </TabsPanel>
            <TabsPanel value="sharing" className="animate-tab-fade">
              <SharingTab
                workspaceId={workspaceId}
                isAdmin={currentUser.role === 'admin'}
                onNavigateToMembers={() => setActiveTab('members')}
              />
            </TabsPanel>
            <TabsPanel value="billing" className="animate-tab-fade">
              <BillingTab onOpenBilling={onOpenBilling} />
            </TabsPanel>
            <TabsPanel value="portability" className="animate-tab-fade">
              <PortabilityTab workspaceId={workspaceId} workspaceName={workspaceName} />
            </TabsPanel>
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
