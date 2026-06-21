'use client';
import { useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import WorkspaceSidebar from './WorkspaceSidebar';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import { logout } from '@/lib/actions/auth';
import { createPage } from '@/lib/actions/page';
import { setLocale } from '@/lib/actions/locale';
import { X, Plus, Layers, LogOut, Shield, User, Settings, Bot, CreditCard } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import TemplatePickerModal from './TemplatePickerModal';
import FlagIcon from './FlagIcon';
import UserSettingsModal from './UserSettingsModal';
import AgentsModal from './AgentsModal';
import BillingModal from './BillingModal';

type WorkspaceType = { id: string; name: string };
type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
};

type Sheet = 'workspace' | 'user' | null;

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const;

function BottomSheet({
  isOpen,
  onClose,
  children,
  maxHeight = '90vh',
  topOffset,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string;
  topOffset?: string;
}) {
  return (
    <div
      className={`fixed inset-0 z-200 lg:hidden transition-all duration-300 ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 bg-neutral-900 border-t border-neutral-800 rounded-t-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={topOffset ? { top: topOffset } : { maxHeight }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-700" />
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MobileNavWrapper({
  items,
  workspaces,
  activeWorkspace,
  currentUser,
}: {
  items: WorkspaceItemRow[];
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType;
  currentUser: CurrentUser;
}) {
  const t = useTranslations('MobileNav');
  const tw = useTranslations('Workspace');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [openSheet, setOpenSheet] = useState<Sheet>(null);
  const [templatePickerParentId, setTemplatePickerParentId] = useState<string | undefined>();
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [agentsModalOpen, setAgentsModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [, startLangTransition] = useTransition();

  // Close sheets on route change
  useEffect(() => {
    setOpenSheet(null);
  }, [pathname]);

  // Lock body scroll when any sheet is open
  useEffect(() => {
    const locked = openSheet !== null || isTemplatePickerOpen;
    document.body.style.overflow = locked ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [openSheet, isTemplatePickerOpen]);

  const closeSheet = () => setOpenSheet(null);

  // Parse current context from pathname
  const dbMatch = pathname.match(/^\/db\/([^/]+)/);
  const pageMatch = pathname.match(/^\/page\/([^/]+)/);
  const currentDatabaseId = dbMatch?.[1] ?? null;
  const currentPageItemId = pageMatch?.[1] ?? null;

  const handleNew = async () => {
    if (currentDatabaseId) {
      // Add a new row to the current database
      setIsAdding(true);
      try {
        const pageId = await createPage(currentDatabaseId, 'New Page');
        if (pageId) router.push(`/db/${currentDatabaseId}/${pageId}`);
      } finally {
        setIsAdding(false);
      }
    } else if (currentPageItemId) {
      // Create a sub-item inside the current page
      setTemplatePickerParentId(currentPageItemId);
      setIsTemplatePickerOpen(true);
    } else {
      // Workspace root
      setTemplatePickerParentId(undefined);
      setIsTemplatePickerOpen(true);
    }
  };

  function handleLangSelect(code: string) {
    startLangTransition(async () => {
      await setLocale(code);
      router.refresh();
    });
  }

  return (
    <>
      {/* Workspace bottom sheet */}
      <BottomSheet isOpen={openSheet === 'workspace'} onClose={closeSheet} topOffset="72px">
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-neutral-800">
          <span className="text-sm font-semibold text-neutral-200">{activeWorkspace.name}</span>
          <button
            onClick={closeSheet}
            className="p-1.5 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <WorkspaceSidebar
            items={items}
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            currentUser={currentUser}
            hideBrandHeader
          />
        </div>
      </BottomSheet>

      {/* User bottom sheet */}
      <BottomSheet isOpen={openSheet === 'user'} onClose={closeSheet} maxHeight="70vh">
        <div className="flex flex-col px-4 pt-2 pb-8 gap-4 overflow-y-auto">
          {/* User info */}
          <div className="flex items-center gap-3 py-1">
            <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center text-sm font-semibold text-neutral-200">
              {(currentUser.name || currentUser.email || 'U').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-100 truncate">
                  {currentUser.name ?? currentUser.email ?? 'User'}
                </span>
                {currentUser.role === 'admin' && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    <Shield size={9} /> Admin
                  </span>
                )}
              </div>
              {currentUser.name && currentUser.email && (
                <p className="text-xs text-neutral-500 truncate">{currentUser.email}</p>
              )}
            </div>
          </div>

          {/* Account actions */}
          <div className="border-t border-neutral-800 pt-3 flex flex-col gap-1">
            <button
              onClick={() => { setOpenSheet(null); setUserSettingsOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm font-medium"
            >
              <Settings size={16} className="shrink-0 text-neutral-400" />
              <span>{tw('settings')}</span>
            </button>
            <button
              onClick={() => { setOpenSheet(null); setAgentsModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm font-medium"
            >
              <Bot size={16} className="shrink-0 text-amber-400" />
              <span>{tw('myAgents')}</span>
            </button>
            <button
              onClick={() => { setOpenSheet(null); setBillingModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm font-medium"
            >
              <CreditCard size={16} className="shrink-0 text-neutral-400" />
              <span>{tw('planBilling')}</span>
            </button>
          </div>

          {/* Language grid */}
          <div className="border-t border-neutral-800 pt-4">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">Language</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors text-xs font-medium ${
                    lang.code === locale
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                      : 'border-neutral-800 bg-neutral-850 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <FlagIcon code={lang.code} size={22} />
                  <span className="text-[10px] truncate w-full text-center">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors text-sm font-medium"
          >
            <LogOut size={16} />
            <span>{t('signOut')}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Account modals */}
      {userSettingsOpen && (
        <UserSettingsModal currentUser={currentUser} onClose={() => setUserSettingsOpen(false)} />
      )}
      {agentsModalOpen && (
        <AgentsModal onClose={() => setAgentsModalOpen(false)} />
      )}
      {billingModalOpen && (
        <BillingModal isDemo={currentUser.role === 'demo'} onClose={() => setBillingModalOpen(false)} />
      )}

      {/* Template picker */}
      {isTemplatePickerOpen && activeWorkspace.id && (
        <TemplatePickerModal
          workspaceId={activeWorkspace.id}
          activeWorkspaceId={activeWorkspace.id}
          parentId={templatePickerParentId}
          onClose={() => setIsTemplatePickerOpen(false)}
          onOptimisticCreate={() => {}}
          onCreated={(type, navId) => {
            setIsTemplatePickerOpen(false);
            router.push(type === 'database' ? `/db/${navId}` : `/page/${navId}`);
          }}
        />
      )}

      {/* Bottom navigation bar — icon-only, uniform buttons */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden h-14 bg-neutral-900 border-t border-neutral-800 flex items-stretch">
        <button
          onClick={() => setOpenSheet(openSheet === 'workspace' ? null : 'workspace')}
          className={`flex-1 flex items-center justify-center transition-colors active:bg-neutral-800 ${
            openSheet === 'workspace' ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-200'
          }`}
          aria-label={t('workspace')}
        >
          <Layers size={22} />
        </button>

        {activeWorkspace.id && (
          <button
            onClick={handleNew}
            disabled={isAdding}
            className="flex-1 flex items-center justify-center text-neutral-500 hover:text-neutral-200 transition-colors active:bg-neutral-800 disabled:opacity-40"
            aria-label={t('new')}
          >
            <Plus size={22} />
          </button>
        )}

        <button
          onClick={() => setOpenSheet(openSheet === 'user' ? null : 'user')}
          className={`flex-1 flex items-center justify-center transition-colors active:bg-neutral-800 ${
            openSheet === 'user' ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-200'
          }`}
          aria-label={t('user')}
        >
          <User size={22} />
        </button>
      </nav>
    </>
  );
}
