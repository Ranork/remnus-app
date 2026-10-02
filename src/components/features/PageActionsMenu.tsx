'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeftRight, Check, Copy, FileCode2, Globe, History, MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';
import { preloadDialogs } from './lazyDialogs';

export type PageWidthMode = 'narrow' | 'wide' | 'full';

/**
 * The "⋯" menu at the top of a page (standalone pages and database rows share it):
 * width, share, markdown, history — and for rows, duplicate + delete. One component so
 * both editors open the same menu (they used to draw two hand-made dropdowns).
 */
export default function PageActionsMenu({
  widthMode,
  onWidthChange,
  onShare,
  onMarkdown,
  onHistory,
  onDuplicate,
  onDelete,
}: {
  widthMode: PageWidthMode;
  onWidthChange: (mode: PageWidthMode) => void;
  onShare: () => void;
  onMarkdown: () => void;
  onHistory: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations('Page');
  const tWs = useTranslations('Workspace');
  const tSharing = useTranslations('Sharing');
  const widthLabels: Record<PageWidthMode, string> = { narrow: t('narrow'), wide: t('wide'), full: t('full') };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('pageOptions')}
        title={t('pageOptions')}
        className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        // Share, history and markdown open from this menu: fetch their code on approach.
        onPointerEnter={preloadDialogs}
        onFocus={preloadDialogs}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 min-w-52">
        {/* Width — desktop only; on a phone the page is always full-bleed. */}
        <DropdownMenuGroup className="hidden lg:block">
          <DropdownMenuLabel>{t('widthLabel')}</DropdownMenuLabel>
          {(['narrow', 'wide', 'full'] as PageWidthMode[]).map((mode) => (
            <DropdownMenuItem key={mode} onClick={() => onWidthChange(mode)}>
              <ArrowLeftRight />
              <span className="flex-1">{widthLabels[mode]}</span>
              {widthMode === mode && <Check className="text-fg" aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="hidden lg:block" />

        <DropdownMenuItem onClick={onShare}>
          <Globe />
          {tSharing('shareButton')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMarkdown}>
          <FileCode2 />
          {t('markdown.button')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onHistory}>
          <History />
          {t('history.button')}
        </DropdownMenuItem>

        {(onDuplicate || onDelete) && <DropdownMenuSeparator />}
        {onDuplicate && (
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy />
            {tWs('duplicate')}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 />
            {t('deletePage')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
