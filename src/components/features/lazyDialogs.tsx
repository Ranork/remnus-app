'use client';

import { lazyComponent } from '@/lib/lazyComponent';

/**
 * Dialogs and pickers that open on a click, loaded when first opened instead of with
 * every app page (V2 R9). Imported statically they were part of the first JavaScript of
 * every route — settings, agents, billing, trash, sharing, history, the template picker
 * and the import parsers (JSZip) included — so a dashboard or the knowledge map paid for
 * all of them before showing anything. `preloadDialogs()` fetches their code when the
 * pointer comes near where they open (the sidebar, a page's actions menu), so a first
 * open is usually instant; `lazyComponent` avoids Suspense's reveal delay when it is not.
 *
 * Every one of them is rendered conditionally (`open && <X/>`), never on the server.
 */
export const AgentsModal = lazyComponent(() => import('./AgentsModal').then((m) => m.default));
export const BillingModal = lazyComponent(() => import('./BillingModal').then((m) => m.default));
export const TrashModal = lazyComponent(() => import('./TrashModal').then((m) => m.default));
export const UserSettingsModal = lazyComponent(() => import('./UserSettingsModal').then((m) => m.default));
export const WorkspaceSettingsModal = lazyComponent(() => import('./WorkspaceSettingsModal').then((m) => m.default));
export const TemplatePickerModal = lazyComponent(() => import('./TemplatePickerModal').then((m) => m.default));
export const IconPicker = lazyComponent(() => import('./IconPicker').then((m) => m.default));
export const ShareModal = lazyComponent(() => import('@/components/share/ShareModal').then((m) => m.default));
export const PageMarkdownDialog = lazyComponent(() => import('./PageMarkdownDialog').then((m) => m.PageMarkdownDialog));
export const PageHistoryModal = lazyComponent(() => import('./PageHistoryModal').then((m) => m.PageHistoryModal));
export const BulkRowsDialog = lazyComponent(() => import('./BulkRowsDialog').then((m) => m.BulkRowsDialog));
export const ConnectModal = lazyComponent(() => import('./agents/ConnectModal').then((m) => m.default));

const ALL = [
  AgentsModal, BillingModal, TrashModal, UserSettingsModal, WorkspaceSettingsModal, TemplatePickerModal,
  IconPicker, ShareModal, PageMarkdownDialog, PageHistoryModal, BulkRowsDialog, ConnectModal,
];

let preloaded = false;

/** Fetch every dialog's code in the background (once per page load). */
export function preloadDialogs(): void {
  if (preloaded) return;
  preloaded = true;
  void Promise.all(ALL.map((dialog) => dialog.preload())).catch(() => { preloaded = false; });
}
