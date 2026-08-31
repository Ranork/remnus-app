'use client';
import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { MessageSquare, Loader2, Trash2 } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { addComment, deleteComment, getComments } from '@/lib/actions/comments';
import type { CommentRow } from '@/lib/services/comments';
import { ConfirmDialog } from './ConfirmDialog';
import { UserAvatar } from './PropertyTags';
import AgentMark from './agents/AgentMark';

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
      maxLength={MAX_COMMENT_LENGTH}
      className={className}
    />
  );
}

function AuthorAvatar({ comment, size }: { comment: Pick<CommentRow, 'authorKind' | 'authorUserId' | 'authorLabel' | 'authorImage'>; size: number }) {
  if (comment.authorKind === 'agent') {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-neutral-800"
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

// Comment thread attached to a page or database row, separate from its
// markdown body. Agent comments (via the MCP add_comment tool) are
// append-only — there is no edit/delete affordance for them here, only for
// the viewer's own comments or, for any comment, the workspace owner.
export default function PageCommentsPanel({ workspaceId, pageId, isPeek = false }: { workspaceId: string; pageId: string; isPeek?: boolean }) {
  const t = useTranslations('Comments');
  const locale = useLocale();
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [viewer, setViewer] = useState<{ id: string; name: string | null; image: string | null; isOwner: boolean } | null>(null);
  const [draft, setDraft] = useState('');
  const [composeFocused, setComposeFocused] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getComments(workspaceId, pageId)
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setViewer({ id: res.viewerUserId, name: res.viewerName, image: res.viewerImage, isOwner: res.isOwner });
      })
      .catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId]);

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

  if (comments === null) {
    return (
      <div className={isPeek ? 'mb-6' : 'mb-8'}>
        <Loader2 size={13} className="animate-spin text-neutral-600" />
      </div>
    );
  }

  // Collapsed to a single compact row by default — only grows into the full
  // textarea + submit affordance once the viewer actually starts typing, so a
  // page with zero comments doesn't pay for the compose box's full height.
  const composeExpanded = composeFocused || draft.length > 0;
  const avatarSize = isPeek ? 18 : 20;

  return (
    <div className={isPeek ? 'mb-6' : 'mb-8'}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <MessageSquare size={12} />
        {t('title')}
        {comments.length > 0 && <span className="text-neutral-600">({comments.length})</span>}
      </div>

      {comments.length > 0 && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => {
            const canDelete = c.authorUserId === viewer?.id || viewer?.isOwner;
            const isAgent = c.authorKind === 'agent';
            return (
              <div key={c.id} className="group flex items-start gap-2.5">
                <AuthorAvatar comment={c} size={avatarSize} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={isAgent ? 'font-medium text-amber-500/90' : 'font-medium text-neutral-300'}>
                      {isAgent ? t('byAgent', { name: c.authorLabel }) : c.authorLabel}
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-600">{relativeTime(new Date(c.createdAt), locale)}</span>
                    {c.kind === 'closure' && (
                      <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">
                        {t('closureLabel')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-200">{c.body}</p>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="shrink-0 cursor-pointer self-start text-neutral-700 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2.5">
        <div className="mt-0.75">
          <UserAvatar member={viewer ? { id: viewer.id, name: viewer.name, email: null, image: viewer.image } : undefined} size={avatarSize} />
        </div>
        <div className="min-w-0 flex-1">
          {composeExpanded ? (
            <div className="space-y-1.5">
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
                className="w-full resize-none overflow-hidden rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-[13px] text-neutral-200 outline-none focus:border-neutral-600"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-red-400">{error}</span>
                <button
                  type="button"
                  // Stops the button from stealing focus (which would blur the
                  // textarea) so the box stays open after posting, ready for
                  // the next comment, the same way Enter/Cmd+Enter already does.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={submit}
                  disabled={pending || !draft.trim()}
                  className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                >
                  {pending && <Loader2 size={12} className="animate-spin" />}
                  {t('submit')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setComposeFocused(true)}
              className="w-full cursor-pointer rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-left text-[13px] text-neutral-600 transition-colors hover:border-neutral-700 hover:text-neutral-500"
            >
              {t('placeholder')}
            </button>
          )}
        </div>
      </div>

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
