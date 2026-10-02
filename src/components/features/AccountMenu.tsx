'use client';

import { useState, type ReactNode } from 'react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { ChevronsUpDown, CreditCard, LogOut, MonitorSmartphone, Settings, Shield, Sparkles, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

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
        className="group/account flex h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control px-1.5 text-left transition-[background-color,box-shadow] hover:bg-sheet/55 data-popup-open:bg-sheet data-popup-open:shadow-lift"
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
              className="notranslate flex h-7 w-7 items-center justify-center rounded-full bg-hover text-xs font-semibold text-fg-2"
            >
              {displayName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          {whatsNewUnseen > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-desk"
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui font-medium text-fg">{displayName}</span>
          {user.name && user.email && (
            <span className="block truncate text-2xs text-fg-3">{user.email}</span>
          )}
        </span>
        <ChevronsUpDown size={14} className="shrink-0 text-fg-4 group-hover/account:text-fg-2" />
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
            <Badge variant="neutral" size="sm" className="ml-auto">{trashCount}</Badge>
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
            <Badge variant="count" size="sm" className="ml-auto">{whatsNewUnseen > 9 ? '9+' : whatsNewUnseen}</Badge>
          )}
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <Shield />
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
