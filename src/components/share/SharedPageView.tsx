'use client';
import { useState, useCallback, useRef } from 'react';
import { Lock, PenLine, AlertCircle, Check, ChevronLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import BlockEditor from '@/components/features/editor/BlockEditor';
import SharedPageNav from '@/components/share/SharedPageNav';
import { pageContainerClass } from '@/components/features/pageLayout';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { updateSharedPageContent } from '@/lib/actions/sharing';
import type { ShareRecord } from '@/lib/actions/sharing';
import type { SharedNavItem } from '@/app/[locale]/share/[...slug]/page';
import { cn } from '@/lib/cn';

interface PageData {
  id: string;
  type: string;
  title: string;
  content: string;
  properties?: Record<string, unknown>;
}

interface Props {
  page: PageData;
  share: ShareRecord;
  canEdit: boolean;
  isLoggedIn: boolean;
  shareMap: Record<string, string>;
  parentSlug?: string;
  navTree: SharedNavItem[];
  notFoundLabel: string;
  readOnlyBadge: string;
  writeBadge: string;
  saveErrorLabel: string;
  savingLabel: string;
}

/**
 * A publicly shared page, in the app's own frame (V2 R8.6): the bar and the shared tree
 * sit on the desk, the page is one sheet — the same column, title and body as in the
 * workspace, so a shared page reads exactly like the original. Below `lg` the sheet is
 * the screen and the tree folds into a "Contents" toggle.
 */
export default function SharedPageView({
  page,
  share,
  canEdit,
  isLoggedIn,
  shareMap,
  parentSlug,
  navTree,
  readOnlyBadge,
  writeBadge,
  saveErrorLabel,
  savingLabel,
}: Props) {
  const tLanding = useTranslations('Landing');
  const tPage = useTranslations('Page');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(async (content: string) => {
    if (!canEdit) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const result = await updateSharedPageContent(share.id, content);
    setSaveStatus(result.error ? 'error' : 'saved');
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [share.id, canEdit]);

  const hasNav = navTree.length > 0;
  const title = page.title || tPage('untitled');

  return (
    <div className="flex min-h-dvh flex-col bg-desk text-fg-2">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 bg-desk/90 px-4 backdrop-blur-sm">
        <Link
          href="/"
          className="-mx-1.5 flex shrink-0 items-center gap-2 rounded-control px-1.5 py-1 text-fg transition-opacity hover:opacity-75"
        >
          <RemnusMark className="size-4.5" />
          <span className="text-sm font-semibold tracking-[-0.01em]">Remnus</span>
        </Link>

        <span aria-hidden className="hidden h-4 w-px shrink-0 bg-line sm:block" />
        <span className="hidden min-w-0 flex-1 truncate text-ui text-fg-3 sm:block">{title}</span>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {canEdit && saveStatus !== 'idle' && (
            <span
              role="status"
              className={cn(
                'flex items-center gap-1 text-xs',
                saveStatus === 'error' ? 'text-red-400' : 'text-fg-3',
              )}
            >
              {saveStatus === 'saving' && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {saveStatus === 'saved' && <Check className="size-3.5" aria-hidden />}
              {saveStatus === 'error' && <AlertCircle className="size-3.5" aria-hidden />}
              {saveStatus === 'saving' ? savingLabel : saveStatus === 'saved' ? tPage('saved') : saveErrorLabel}
            </span>
          )}

          <Badge variant={canEdit ? 'signal' : 'neutral'}>
            {canEdit ? <PenLine /> : <Lock />}
            {canEdit ? writeBadge : readOnlyBadge}
          </Badge>

          {isLoggedIn ? (
            <Link href="/app" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>
              {tLanding('navGoToApp')}
            </Link>
          ) : (
            <>
              <Link href="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'hidden sm:inline-flex')}>
                {tLanding('navSignIn')}
              </Link>
              <Link href="/login" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                {tLanding('navGetStarted')}
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1">
        {hasNav && <SharedPageNav navTree={navTree} currentPageId={page.id} desktopOnly />}

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col bg-sheet lg:mb-2 lg:rounded-surface lg:shadow-sheet',
            hasNav ? 'lg:mr-2' : 'lg:mx-2',
          )}
        >
          {hasNav && <SharedPageNav navTree={navTree} currentPageId={page.id} mobileOnly />}

          <main className={cn('w-full', pageContainerClass(share.width))}>
            {parentSlug && !hasNav && (
              <Link
                href={`/share/${parentSlug}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2.5 mb-4')}
              >
                <ChevronLeft aria-hidden />
                {tPage('back')}
              </Link>
            )}

            <h1 className="mb-6 text-[28px] leading-tight font-semibold tracking-[-0.025em] text-fg sm:text-[34px]">
              {title}
            </h1>

            <BlockEditor
              key={page.id}
              initialContent={page.content}
              onChange={canEdit ? handleChange : () => {}}
              shareMap={shareMap}
              editable={canEdit}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
