'use client';
import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { addComment, deleteComment, getComments } from '@/lib/actions/comments';
import type { PagePanels } from '@/lib/actions/pagePanels';
import type { CommentRow } from '@/lib/services/comments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fieldClass } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { ConfirmDialog } from './ConfirmDialog';
import { UserAvatar } from './PropertyTags';
import AgentMark from './agents/AgentMark';

type CommentsData = NonNullable<PagePanels['comments']>;

const MAX_COMMENT_LENGTH = 4_000;

// Intl.RelativeTimeFormat picks the right unit and localizes the wording
// ("3 hours ago" / "3 saat önce" / ...) without a translation key per unit.
function relativeTime(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, 'second');
}

// Same auto-grow approach as PageEditor's own AutoGrowTextarea (duplicated
// locally, same as that file duplicates its own copy — small enough that a
// shared import isn't worth the coupling).
function AutoGrowTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(() => { resize(); }, [value, resize]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => { onChange(e); resize(); }}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      aria-label={placeholder}
      maxLength={MAX_COMMENT_LENGTH}
      className={className}
    />
  );
}

// No second colour for agents (R8): an agent is told apart by its mark and the
// "(agent)" after its name, not by a tint.
function AuthorAvatar({ comment, size }: { comment: Pick<CommentRow, 'authorKind' | 'authorUserId' | 'authorLabel' | 'authorImage'>; size: number }) {
  if (comment.authorKind === 'agent') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-raised shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
        style={{ width: size, height: size }}
      >
        <AgentMark hint={comment.authorLabel} size={Math.round(size * 0.6)} fallback="globe" />
      </span>
    );
  }
  return (
    <UserAvatar
      member={comment.authorUserId ? { id: comment.authorUserId, name: comment.authorLabel, email: null, image: comment.authorImage } : undefined}
      size={size}
    />
  );
}

// A page's or database row's comment thread, separate from its markdown body. Since U4
// it lives in the page's floating panel group (`PageFloat`), which already read the
// thread with the page's other panels and hands it over as `initial`. Agent comments
// (via the MCP add_comment tool) are append-only — there is no edit/delete affordance
// for them here, only for the viewer's own comments or, for any comment, the workspace
// owner.
export default function CommentsThread({
  workspaceId,
  pageId,
  initial,
  onCountChange,
  onCommentsChange,
}: {
  workspaceId: string;
  pageId: string;
  /** The thread as the floating group read it; read here only when it could not be. */
  initial?: CommentsData | null;
  /** Reports the number of comments once loaded and after every change. */
  onCountChange?: (count: number) => void;
  /** The thread after a post or a delete, so a reopened panel starts from it. */
  onCommentsChange?: (comments: CommentRow[]) => void;
}) {
  const t = useTranslations('Comments');
  const locale = useLocale();
  const [comments, setComments] = useState<CommentRow[] | null>(() => initial?.comments ?? null);
  const [viewer, setViewer] = useState<{ id: string; name: string | null; image: string | null; isOwner: boolean } | null>(
    () => (initial ? { id: initial.viewerUserId, name: initial.viewerName, image: initial.viewerImage, isOwner: initial.isOwner } : null),
  );
  const [draft, setDraft] = useState('');
  const [composeFocused, setComposeFocused] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    getComments(workspaceId, pageId)
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setViewer({ id: res.viewerUserId, name: res.viewerName, image: res.viewerImage, isOwner: res.isOwner });
      })
      .catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId, initial]);

  const count = comments?.length ?? 0;
  useEffect(() => {
    if (comments === null) return;
    onCountChange?.(count);
    onCommentsChange?.(comments);
  }, [comments, count, onCountChange, onCommentsChange]);

  function submit() {
    const body = draft.trim();
    if (!body || pending || !viewer) return;
    if (body.length > MAX_COMMENT_LENGTH) { setError(t('tooLong')); return; }
    setError('');
    startTransition(async () => {
      try {
        const result = await addComment(workspaceId, pageId, body);
        setComments((current) => [
          ...(current ?? []),
          {
            id: result.id,
            body,
            kind: 'note',
            authorKind: 'human',
            authorUserId: viewer.id,
            authorLabel: result.authorLabel,
            authorImage: result.authorImage,
            createdAt: new Date(result.createdAt),
          },
        ]);
        setDraft('');
      } catch {
        setError(t('tooLong'));
      }
    });
  }

  function confirmDelete() {
    const id = confirmDeleteId;
    if (!id) return;
    setConfirmDeleteId(null);
    setComments((current) => current?.filter((c) => c.id !== id) ?? current);
    deleteComment(workspaceId, id).catch(() => {
      // Best-effort rollback — re-sync with the server rather than guessing.
      getComments(workspaceId, pageId).then((res) => setComments(res.comments)).catch(() => {});
    });
  }

  // Collapsed to a single field-shaped row by default — only grows into the full
  // textarea + submit affordance once the viewer actually starts typing, so a
  // page with zero comments doesn't pay for the compose box's full height.
  const composeExpanded = composeFocused || draft.length > 0;
  const avatarSize = 22;

  return (
    <div aria-busy={comments === null || undefined}>
      {comments === null ? (
        <Loader2 size={14} className="animate-spin text-fg-4" aria-hidden />
      ) : (
        <>
          {comments.length === 0 ? (
            <p className="text-xs text-fg-3">{t('empty')}</p>
          ) : (
            <ol className="space-y-4">
              {comments.map((c) => {
                const canDelete = c.authorUserId === viewer?.id || viewer?.isOwner;
                const isAgent = c.authorKind === 'agent';
                const created = new Date(c.createdAt);
                return (
                  <li key={c.id} className="group flex items-start gap-3">
                    <AuthorAvatar comment={c} size={avatarSize} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-ui font-medium text-fg">
                          {isAgent ? t('byAgent', { name: c.authorLabel }) : c.authorLabel}
                        </span>
                        <time
                          dateTime={created.toISOString()}
                          title={created.toLocaleString(locale)}
                          className="text-xs text-fg-3"
                        >
                          {relativeTime(created, locale)}
                        </time>
                        {c.kind === 'closure' && (
                          <Badge variant="outline" size="sm">{t('closureLabel')}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-fg-2">{c.body}</p>
                    </div>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfirmDeleteId(c.id)}
                        title={t('delete')}
                        aria-label={t('delete')}
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-500/12 hover:text-red-400 focus-visible:opacity-100"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-9 shrink-0 items-center">
              <UserAvatar member={viewer ? { id: viewer.id, name: viewer.name, email: null, image: viewer.image } : undefined} size={avatarSize} />
            </div>
            <div className="min-w-0 flex-1">
              {composeExpanded ? (
                <div className="space-y-2">
                  <AutoGrowTextarea
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); if (error) setError(''); }}
                    onFocus={() => setComposeFocused(true)}
                    onBlur={() => setComposeFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
                    }}
                    placeholder={t('placeholder')}
                    autoFocus
                    className={cn(fieldClass, 'block min-h-9 resize-none overflow-hidden px-3 py-2 text-sm leading-relaxed')}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-xs text-red-400">{error}</span>
                    <Button
                      variant="primary"
                      size="sm"
                      // Stops the button from stealing focus (which would blur the
                      // textarea) so the box stays open after posting, ready for
                      // the next comment, the same way Enter/Cmd+Enter already does.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={submit}
                      loading={pending}
                      disabled={!draft.trim()}
                    >
                      {t('submit')}
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setComposeFocused(true)}
                  className={cn(fieldClass, 'flex h-9 cursor-text items-center px-3 text-left text-sm text-fg-4')}
                >
                  {t('placeholder')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title={t('deleteConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
