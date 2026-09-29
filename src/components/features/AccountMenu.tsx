'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, CreditCard, LogOut, MonitorSmartphone, Settings, Shield, Sparkles, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The one place the sidebar keeps everything that isn't the workspace tree or the AI
 * agents entry: the avatar row opens a menu with settings, plan, trash, app install,
 * what's new, the admin panel and sign-out. The rows are plain menu items; the modals
 * they open belong to the caller (they must outlive the menu closing).
 *
 * Unread "What's New" is the one thing worth interrupting for, so it is mirrored as a
 * dot on the avatar — closed menu, still visible.
 *
 * `isProjectWindow`: a session locked to one workspace. Only the rows that are workspace
 * content or product news are rendered (not merely disabled) — settings, billing,
 * install, admin and sign-out are account-level and the server denies them there.
 */
export default function AccountMenu({
  user,
  isProjectWindow,
  planBadge,
  trashCount,
  whatsNewUnseen,
  canInstall,
  onOpenSettings,
  onOpenBilling,
  onOpenTrash,
  onOpenWhatsNew,
  onInstall,
  onSignOut,
}: {
  user: { name: string | null; email: string | null; image: string | null; role: string };
  isProjectWindow: boolean;
  /** Small pill after "Plan & billing" (the current tier). */
  planBadge?: ReactNode;
  trashCount: number | null;
  whatsNewUnseen: number;
  canInstall: boolean;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenTrash: () => void;
  onOpenWhatsNew: () => void;
  onInstall: () => void;
  onSignOut: () => void;
}) {
  const t = useTranslations('Workspace');
  const tPwa = useTranslations('Download');
  const tNew = useTranslations('WhatsNew');
  const [avatarError, setAvatarError] = useState(false);

  const showImage = !!user.image && user.image !== 'null' && !avatarError;
  const displayName = user.name ?? user.email ?? 'User';
  const isAdmin = user.role === 'admin' && !isProjectWindow;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('accountMenu')}
        className="group/account flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left outline-none transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-blue-500/60 data-popup-open:bg-neutral-800"
      >
        <span className="relative shrink-0">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image!}
              alt={displayName}
              className="h-7 w-7 rounded-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <span
              translate="no"
              className="notranslate flex h-7 w-7 items-center justify-center rounded-full bg-neutral-700 text-xs font-semibold text-neutral-200"
            >
              {displayName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          {whatsNewUnseen > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-neutral-900"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-neutral-200">{displayName}</span>
          {user.name && user.email && (
            <span className="block truncate text-[10px] text-neutral-500">{user.email}</span>
          )}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-neutral-500 group-hover/account:text-neutral-300" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-(--anchor-width) min-w-56">
        {!isProjectWindow && (
          <>
            <DropdownMenuItem onClick={onOpenSettings}>
              <Settings />
              <span className="truncate">{t('settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenBilling}>
              <CreditCard />
              <span className="truncate">{t('planBilling')}</span>
              {planBadge && <span className="ml-auto shrink-0">{planBadge}</span>}
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuItem onClick={onOpenTrash}>
          <Trash2 />
          <span className="truncate">{t('myTrash')}</span>
          {trashCount !== null && trashCount > 0 && (
            <span className="ml-auto shrink-0 rounded-full border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] leading-none font-bold text-neutral-400">
              {trashCount}
            </span>
          )}
        </DropdownMenuItem>

        {!isProjectWindow && canInstall && (
          <DropdownMenuItem onClick={onInstall}>
            <MonitorSmartphone />
            <span className="truncate">{tPwa('pwaShortLabel')}</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={onOpenWhatsNew}>
          <Sparkles />
          <span className="truncate">{tNew('title')}</span>
          {whatsNewUnseen > 0 && (
            <span className="ml-auto min-w-4 shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] leading-none font-bold text-white">
              {whatsNewUnseen > 9 ? '9+' : whatsNewUnseen}
            </span>
          )}
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <Shield className="text-blue-400" />
            <span className="truncate">{t('adminLink')}</span>
          </DropdownMenuItem>
        )}

        {!isProjectWindow && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut />
              <span className="truncate">{t('signOut')}</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
