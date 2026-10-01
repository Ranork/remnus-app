'use client';
import { useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import WorkspaceSidebar from './WorkspaceSidebar';
import type { AgentPresence } from '@/lib/agentPresence';
import type { WorkspaceItemRow } from '@/lib/actions/workspace';
import { logout } from '@/lib/actions/auth';
import { createPage } from '@/lib/actions/page';
import { setLocale } from '@/lib/actions/locale';
import { X, Plus, Layers, LogOut, Shield, User, Settings, Bot, CreditCard, Trash2, Sparkles } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import TemplatePickerModal from './TemplatePickerModal';
import FlagIcon from './FlagIcon';
import UserSettingsModal from './UserSettingsModal';
import AgentsModal from './AgentsModal';
import BillingModal from './BillingModal';
import TrashModal from './TrashModal';
import { useWhatsNew } from './WhatsNewButton';

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
        className={`absolute inset-0 bg-overlay transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 bg-float rounded-t-2xl shadow-modal flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={topOffset ? { top: topOffset } : { maxHeight }}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-line-strong" />
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
  isProjectWindow = false,
  presence,
}: {
  items: WorkspaceItemRow[];
  workspaces: WorkspaceType[];
  activeWorkspace: WorkspaceType;
  currentUser: CurrentUser;
  /** Session locked to one workspace (`npx remnus open`) — leave out everything
   *  account-level, which the server denies anyway. See the `(app)` layout. */
  isProjectWindow?: boolean;
  /** Agent presence for the drawer's copy of the sidebar (see `WorkspaceSidebar`). */
  presence?: AgentPresence;
}) {
  const t = useTranslations('MobileNav');
  const tLang = useTranslations('LanguageSwitcher');
  const tw = useTranslations('Workspace');
  const tNew = useTranslations('WhatsNew');
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
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const whatsNew = useWhatsNew();
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
        // Untitled, like a row added in the view: the page shows the localized placeholder.
        const pageId = await createPage(currentDatabaseId, '');
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
        <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-line">
          <span className="text-sm font-semibold text-fg">{activeWorkspace.name}</span>
          <button
            onClick={closeSheet}
            className="p-1.5 text-fg-3 hover:text-fg hover:bg-hover rounded-control transition-colors"
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
            isProjectWindow={isProjectWindow}
            presence={presence}
          />
        </div>
      </BottomSheet>

      {/* User bottom sheet */}
      <BottomSheet isOpen={openSheet === 'user'} onClose={closeSheet} maxHeight="70vh">
        <div className="flex flex-col px-4 pt-2 pb-8 gap-4 overflow-y-auto">
          {/* User info */}
          <div className="flex items-center gap-3 py-1">
            <div className="shrink-0 w-10 h-10 rounded-full bg-hover flex items-center justify-center text-sm font-semibold text-fg-2">
              {(currentUser.name || currentUser.email || 'U').trim().charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-fg truncate">
                  {currentUser.name ?? currentUser.email ?? 'User'}
                </span>
                {currentUser.role === 'admin' && !isProjectWindow && (
                  <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-signal-text bg-signal/10 px-1.5 py-0.5 rounded">
                    <Shield size={9} /> Admin
                  </span>
                )}
              </div>
              {currentUser.name && currentUser.email && (
                <p className="text-xs text-fg-3 truncate">{currentUser.email}</p>
              )}
            </div>
          </div>

          {/* Account actions — every one of these is denied to a locked session */}
          {!isProjectWindow && (
          <div className="border-t border-line pt-3 flex flex-col gap-1">
            <button
              onClick={() => { setOpenSheet(null); setUserSettingsOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-control text-fg-2 hover:bg-hover hover:text-fg transition-colors text-sm font-medium"
            >
              <Settings size={16} className="shrink-0 text-fg-3" />
              <span>{tw('settings')}</span>
            </button>
            <button
              onClick={() => { setOpenSheet(null); setAgentsModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-control text-fg-2 hover:bg-hover hover:text-fg transition-colors text-sm font-medium"
            >
              <Bot size={16} className="shrink-0 text-fg-3" />
              <span>{tw('myAgents')}</span>
            </button>
            <button
              onClick={() => { setOpenSheet(null); setBillingModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-control text-fg-2 hover:bg-hover hover:text-fg transition-colors text-sm font-medium"
            >
              <CreditCard size={16} className="shrink-0 text-fg-3" />
              <span>{tw('planBilling')}</span>
            </button>
          </div>
          )}

          {/* Trash and what's new: workspace content / product news, so a project window keeps
              them — same split as the desktop account menu. */}
          <div className="border-t border-line pt-3 flex flex-col gap-1">
            <button
              onClick={() => { setOpenSheet(null); setTrashModalOpen(true); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-control text-fg-2 hover:bg-hover hover:text-fg transition-colors text-sm font-medium"
            >
              <Trash2 size={16} className="shrink-0 text-fg-3" />
              <span>{tw('myTrash')}</span>
            </button>
            <button
              onClick={() => { setOpenSheet(null); whatsNew.open(); }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-control text-fg-2 hover:bg-hover hover:text-fg transition-colors text-sm font-medium"
            >
              <Sparkles size={16} className="shrink-0 text-fg-3" />
              <span>{tNew('title')}</span>
              {whatsNew.unseenCount > 0 && (
                <span className="ml-auto min-w-4 h-4 shrink-0 rounded-full bg-red-500 px-1 text-center text-2xs font-semibold leading-4 text-white">
                  {whatsNew.unseenCount > 9 ? '9+' : whatsNew.unseenCount}
                </span>
              )}
            </button>
          </div>

          {/* Language grid */}
          <div className="border-t border-line pt-4">
            <p className="text-xs font-medium text-fg-3 mb-3">{tLang('label')}</p>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-control border transition-colors text-xs font-medium ${
                    lang.code === locale
                      ? 'border-signal/60 bg-signal-soft text-fg'
                      : 'border-line bg-sheet text-fg-3 hover:border-line-strong hover:text-fg'
                  }`}
                >
                  <FlagIcon code={lang.code} size={22} />
                  <span className="text-2xs truncate w-full text-center">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logout — in a project window this only ends the window's session, so the
              banner carries it under that name instead. */}
          {!isProjectWindow && (
            <button
              onClick={() => logout()}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-hover text-fg-2 hover:text-fg transition-colors text-sm font-medium"
            >
              <LogOut size={16} />
              <span>{t('signOut')}</span>
            </button>
          )}
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

      {trashModalOpen && <TrashModal onClose={() => setTrashModalOpen(false)} />}
      {whatsNew.modal}

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
            router.push(
              type === 'database' ? `/db/${navId}` : type === 'dashboard' ? `/dashboard/${navId}` : `/page/${navId}`,
            );
          }}
        />
      )}

      {/* Bottom navigation bar — icon-only, uniform buttons */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden h-14 bg-desk border-t border-line flex items-stretch">
        <button
          onClick={() => setOpenSheet(openSheet === 'workspace' ? null : 'workspace')}
          className={`flex-1 flex items-center justify-center transition-colors active:bg-hover ${
            openSheet === 'workspace' ? 'text-fg' : 'text-fg-3 hover:text-fg'
          }`}
          aria-label={t('workspace')}
        >
          <Layers size={22} />
        </button>

        {activeWorkspace.id && (
          <button
            onClick={handleNew}
            disabled={isAdding}
            className="flex-1 flex items-center justify-center text-fg-3 hover:text-fg transition-colors active:bg-hover disabled:opacity-40"
            aria-label={t('new')}
          >
            <Plus size={22} />
          </button>
        )}

        <button
          onClick={() => setOpenSheet(openSheet === 'user' ? null : 'user')}
          className={`flex-1 flex items-center justify-center transition-colors active:bg-hover ${
            openSheet === 'user' ? 'text-fg' : 'text-fg-3 hover:text-fg'
          }`}
          aria-label={t('user')}
        >
          <User size={22} />
        </button>
      </nav>
    </>
  );
}
