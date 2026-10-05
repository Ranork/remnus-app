'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { BrainCircuit, Link2, Loader2, MessageSquare, Repeat, Waypoints, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { lazyComponent } from '@/lib/lazyComponent';
import { loadPagePanels } from '@/lib/pagePanels';
import type { PagePanels } from '@/lib/actions/pagePanels';
import type { CommentRow } from '@/lib/services/comments';
import type { KnowledgeCorpusItem } from '@/lib/services/knowledge';
import { parseDateValue } from '@/lib/recurrence/rule';
import { cn } from '@/lib/cn';

/**
 * A page's side material — comments, knowledge context, backlinks, the local map and,
 * on a database row, its repeat rhythm — as a floating group of buttons in the page's
 * corner (U4, Hakan: at the bottom of a long page nobody saw them). A button opens its
 * panel as a card beside the group; one card at a time, closed by its ×, Esc or the same
 * button — not by clicking the page, so a thread can stay open while you write. On a
 * phone the panel rises from the bottom instead. In a row peek the group sits outside
 * the peek's box, on its edge (`slot`, provided by DatabaseView).
 *
 * The panels' first data — comments, knowledge, backlinks — is one `getPagePanels` read
 * at mount (same count as when they were sections under the body); the panels' code
 * loads when the group is approached, the local map's only when its button is.
 */

export type PageFloatPanel = 'comments' | 'knowledge' | 'backlinks' | 'map' | 'repeat';

export interface PageFloatRepeat {
  page: {
    id: string;
    properties?: Record<string, unknown> | null;
    seriesId?: string | null;
    seriesDetached?: boolean | null;
  };
  databaseId: string;
  /** Date column a repeat rule hangs off; null when the database has none. */
  dateColId: string | null;
  onChanged?: () => void;
}

const CommentsThread = lazyComponent(() => import('./PageCommentsPanel').then((m) => m.default));
const KnowledgeForm = lazyComponent(() => import('./KnowledgeContextPanel').then((m) => m.default));
const BacklinksList = lazyComponent(() => import('./PageBacklinksPanel').then((m) => m.default));
const LocalMap = lazyComponent(() => import('./graph/LocalGraphPanel').then((m) => m.default));
const SeriesPanel = lazyComponent(() => import('./recurrence/SeriesPanel').then((m) => m.default));

/** Everything but the map (sigma + WebGL is fetched only on its own button). */
function preloadPanels() {
  for (const panel of [CommentsThread, KnowledgeForm, BacklinksList, SeriesPanel]) void panel.preload().catch(() => {});
}

/** Panels that keep their state (a half-written comment, an edited form) while closed. */
const KEEP_ALIVE = new Set<PageFloatPanel>(['comments', 'knowledge']);

const CARD_WIDTH: Record<PageFloatPanel, string> = {
  comments: 'w-[23rem]',
  knowledge: 'w-[26rem]',
  backlinks: 'w-[20rem]',
  map: 'w-[32rem]',
  repeat: 'w-[22rem]',
};

const ICONS: Record<PageFloatPanel, ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  comments: MessageSquare,
  knowledge: BrainCircuit,
  backlinks: Link2,
  map: Waypoints,
  repeat: Repeat,
};

// The card beside the group on tablets and up; a bottom sheet on phones (as DatabaseView's peek).
const WIDE_QUERY = '(min-width: 640px)';
function subscribeWide(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
const getWide = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_QUERY).matches;

/** "3 comments" under the page title — only when there are any; opens the thread. */
export function CommentsJumpLink({ count, onJump, className }: { count: number; onJump: () => void; className?: string }) {
  const t = useTranslations('Comments');
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onJump}
      className={cn(
        '-ml-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-fg-3 transition-colors hover:bg-hover hover:text-fg',
        className,
      )}
    >
      <MessageSquare size={13} aria-hidden />
      {t('count', { count })}
    </button>
  );
}

export default function PageFloat({
  workspaceId,
  pageId,
  open,
  onOpenChange,
  onCommentCount,
  reviewSignal = 0,
  onReviewed,
  repeat = null,
  slot,
}: {
  workspaceId: string;
  pageId: string;
  open: PageFloatPanel | null;
  onOpenChange: (panel: PageFloatPanel | null) => void;
  /** The thread's length once read and after every post or delete (the link under the title). */
  onCommentCount?: (count: number) => void;
  /** Bumped by a review on the provenance line; the knowledge panel reloads. */
  reviewSignal?: number;
  onReviewed?: () => void;
  /** A database row's repeat rule; a standalone page has none. */
  repeat?: PageFloatRepeat | null;
  /**
   * In a row peek: the element to render into, outside the peek's box. `undefined` is a
   * full page (the group is fixed in the page's corner); `null` is a peek whose slot is
   * not mounted yet (nothing renders until it is).
   */
  slot?: HTMLElement | null;
}) {
  const tPage = useTranslations('Page');
  const tComments = useTranslations('Comments');
  const tGraph = useTranslations('Graph');
  const tUi = useTranslations('UI');
  const wide = useSyncExternalStore(subscribeWide, getWide, () => true);
  const cardId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<PageFloatPanel, HTMLButtonElement | null>>>({});

  // ── Data: one read per page opening ───────────────────────────────────────────
  const [data, setData] = useState<PagePanels | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [kept, setKept] = useState<PageFloatPanel[]>([]);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setKept([]);
    loadPagePanels(workspaceId, pageId)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setCommentCount(value.comments?.comments.length ?? 0);
      })
      .catch(() => { if (!cancelled) setData({ comments: null, knowledge: null, relations: null }); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId]);

  useEffect(() => { onCommentCount?.(commentCount); }, [commentCount, onCommentCount]);

  // A reopened panel (or the phone sheet, which does not keep its content) starts from
  // the latest thread and form, not from the page-opening read.
  const keepComments = useCallback((comments: CommentRow[]) => {
    setData((current) => (current?.comments ? { ...current, comments: { ...current.comments, comments } } : current));
  }, []);
  const keepKnowledge = useCallback((knowledge: KnowledgeCorpusItem) => {
    setData((current) => (current ? { ...current, knowledge } : current));
  }, []);

  // ── Which buttons ─────────────────────────────────────────────────────────────
  const backlinks = data?.relations?.backlinks ?? [];
  const repeatState = (() => {
    if (!repeat?.dateColId) return null;
    const hasDate = !!parseDateValue(repeat.page.properties?.[repeat.dateColId]);
    const inSeries = !!repeat.page.seriesId && !repeat.page.seriesDetached;
    const wasInSeries = !!repeat.page.seriesId && !!repeat.page.seriesDetached;
    return inSeries || wasInSeries || hasDate ? { inSeries } : null;
  })();

  const labels: Record<PageFloatPanel, string> = {
    comments: tComments('title'),
    knowledge: tPage('knowledgeTitle'),
    backlinks: tPage('backlinksTitle', { count: backlinks.length }),
    map: tGraph('localTitle'),
    repeat: tPage('floatRepeat'),
  };

  const items: { kind: PageFloatPanel; count?: number; live?: boolean }[] = [
    { kind: 'comments', count: commentCount },
    { kind: 'knowledge' },
    ...(backlinks.length > 0 ? [{ kind: 'backlinks' as const, count: backlinks.length }] : []),
    { kind: 'map' },
    ...(repeatState ? [{ kind: 'repeat' as const, live: repeatState.inSeries }] : []),
  ];
  const visible = new Set(items.map((item) => item.kind));

  // A panel whose button went away (the last backlink removed, the date cleared) closes.
  const openVisible = open !== null && visible.has(open);
  useEffect(() => {
    if (open !== null && data !== null && !openVisible) onOpenChange(null);
  }, [open, data, openVisible, onOpenChange]);

  // Keep-alive panels stay mounted once opened (hidden while another one shows).
  const alive = open && KEEP_ALIVE.has(open) && !kept.includes(open) ? [...kept, open] : kept;
  useEffect(() => {
    if (open && KEEP_ALIVE.has(open)) setKept((current) => (current.includes(open) ? current : [...current, open]));
  }, [open]);

  const close = useCallback(() => {
    const was = open;
    onOpenChange(null);
    if (was) buttonRefs.current[was]?.focus();
  }, [open, onOpenChange]);

  const toggle = (kind: PageFloatPanel) => onOpenChange(open === kind ? null : kind);

  const onKeyDown = (event: React.KeyboardEvent) => {
    // Only from inside the group or its card: a dialog opened from a panel (a repeat
    // rule, a delete confirm) is portaled elsewhere and handles its own Escape.
    if (event.key !== 'Escape' || !open || !rootRef.current?.contains(event.target as Node)) return;
    event.stopPropagation();
    close();
  };

  // ── Bodies ────────────────────────────────────────────────────────────────────
  const body = (kind: PageFloatPanel) => {
    if (data === null && kind !== 'map' && kind !== 'repeat') return <PanelLoading />;
    switch (kind) {
      case 'comments':
        return (
          <CommentsThread
            workspaceId={workspaceId}
            pageId={pageId}
            initial={data?.comments ?? null}
            onCountChange={setCommentCount}
            onCommentsChange={keepComments}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeForm
            workspaceId={workspaceId}
            pageId={pageId}
            initial={data?.knowledge ?? null}
            refreshKey={reviewSignal}
            onReviewed={onReviewed}
            onChange={keepKnowledge}
          />
        );
      case 'backlinks':
        return <BacklinksList backlinks={backlinks} />;
      case 'map':
        return <LocalMap workspaceId={workspaceId} pageId={pageId} />;
      case 'repeat':
        return repeat ? (
          <SeriesPanel
            page={repeat.page}
            databaseId={repeat.databaseId}
            dateColId={repeat.dateColId}
            onChanged={repeat.onChanged}
            bare
          />
        ) : null;
    }
  };

  const ActiveIcon = open ? ICONS[open] : null;
  // The card opens beside the group, to its left — or to its right where the slot says so
  // (a side peek: left of its drawer there is only a strip of the dimmed board).
  const cardOnRight = slot?.dataset.cardSide === 'right';

  const card = wide && (openVisible || alive.length > 0) && (
    <section
      id={cardId}
      role="dialog"
      aria-modal={false}
      aria-labelledby={titleId}
      hidden={!openVisible}
      className={cn(
        'absolute bottom-0 flex max-h-[min(72vh,36rem)] animate-scale-in flex-col overflow-hidden rounded-surface bg-float text-fg-2 shadow-float',
        cardOnRight ? 'left-full ml-2.5 origin-bottom-left' : 'right-full mr-2.5 origin-bottom-right',
        open && CARD_WIDTH[open],
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line pr-1.5 pl-4">
        {ActiveIcon && <ActiveIcon size={15} className="shrink-0 text-fg-3" aria-hidden />}
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-ui font-medium text-fg">
          {open ? labels[open] : null}
        </h2>
        <Tooltip content={tUi('close')}>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label={tUi('close')}>
            <X />
          </Button>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        {alive.map((kind) => (
          <div key={kind} hidden={open !== kind}>{body(kind)}</div>
        ))}
        {open && openVisible && !KEEP_ALIVE.has(open) && <div key={open}>{body(open)}</div>}
      </div>
    </section>
  );

  const sheet = !wide && openVisible && open && (
    <Dialog open onOpenChange={(next) => { if (!next) onOpenChange(null); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ActiveIcon && <ActiveIcon size={16} className="shrink-0 text-fg-3" aria-hidden />}
            {labels[open]}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>{body(open)}</DialogBody>
      </DialogContent>
    </Dialog>
  );

  const group = (
    <div
      ref={rootRef}
      onKeyDown={onKeyDown}
      onPointerEnter={preloadPanels}
      onFocus={preloadPanels}
      className={cn(
        'relative',
        slot === undefined &&
          'fixed right-4 bottom-[calc(4.5rem+var(--consent-banner-height,0px))] z-30 lg:right-6 lg:bottom-[calc(1.5rem+var(--consent-banner-height,0px))]',
      )}
    >
      {card}
      <div
        role="group"
        aria-label={tPage('floatGroupLabel')}
        className="flex flex-col items-center gap-0.5 rounded-full bg-float p-1 shadow-float"
      >
        {items.map(({ kind, count, live }) => {
          const Icon = ICONS[kind];
          const active = open === kind;
          return (
            <Tooltip key={kind} content={labels[kind]} side="left">
              <button
                ref={(el) => { buttonRefs.current[kind] = el; }}
                type="button"
                onClick={() => toggle(kind)}
                onPointerEnter={kind === 'map' ? () => void LocalMap.preload().catch(() => {}) : undefined}
                aria-label={count ? `${labels[kind]} (${count})` : labels[kind]}
                aria-expanded={active}
                aria-controls={active && wide ? cardId : undefined}
                className={cn(
                  'relative flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
                  active ? 'bg-signal-soft text-signal-text' : 'text-fg-3 hover:bg-hover hover:text-fg',
                )}
              >
                <Icon size={17} aria-hidden />
                {count ? (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-2xs leading-none font-semibold text-ink-fg tabular-nums ring-2 ring-float">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : live ? (
                  <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-signal ring-2 ring-float" />
                ) : null}
              </button>
            </Tooltip>
          );
        })}
      </div>
      {sheet}
    </div>
  );

  if (slot === null) return null;
  return slot ? createPortal(group, slot) : group;
}

function PanelLoading() {
  return <Loader2 size={14} className="animate-spin text-fg-4" aria-hidden />;
}
