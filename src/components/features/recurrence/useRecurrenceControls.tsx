'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Unlink, X } from 'lucide-react';
import { parseDateValue, type RecurrenceRule } from '@/lib/recurrence/rule';
import type { RecurrenceScope } from '@/lib/services/recurrence';
import {
  changeSeriesRule,
  deleteRecurringPage,
  endSeriesRecurrence,
  previewScopeImpact,
  setPageRecurrence,
} from '@/lib/actions/recurrence';
import RecurrenceDialog from './RecurrenceDialog';
import RecurrenceScopeDialog, { type ScopeImpact } from './RecurrenceScopeDialog';

/** Post-action result the confirm dialog itself can't show, since it is
 *  already gone by the time the mutation resolves. Without this, a delete
 *  that preserves content (or one that outright fails) closes the dialog and
 *  looks exactly like nothing happened. */
type RecurrenceFeedback =
  | { type: 'preserved'; count: number }
  | { type: 'removed'; count: number }
  | { type: 'error' };

const FEEDBACK_AUTO_DISMISS_MS = 6000;

// Recurrence needs the same three-step conversation (pick a rule → if it is
// already a series, pick a scope → apply) wherever it is offered: the calendar
// card menu, the card's right-click menu, and the page editor. Bundling the
// state, the dialogs and the actions here keeps those surfaces from each
// growing their own half-copy that drifts.
//
// Follows the `useContextMenu()` idiom already used in this codebase: the hook
// returns imperative openers plus a `node` the caller renders once.

export interface RecurrencePageLike {
  id: string;
  properties?: Record<string, unknown> | null;
  seriesId?: string | null;
  seriesDetached?: boolean | null;
}

export interface UseRecurrenceControlsOptions {
  /** The date column the rule hangs off — the calendar view's `dateCol`. */
  dateColId: string;
  /** seriesId → rule, for rendering the existing rhythm when editing. */
  seriesRules: Record<string, RecurrenceRule>;
  getPage: (pageId: string) => RecurrencePageLike | undefined;
  /** Called after any successful mutation; a series change rewrites many rows,
   *  so callers re-fetch rather than patching local state. */
  onChanged?: () => void;
  /** Delete path for a card that is NOT part of a series — lets each surface
   *  keep its own existing confirmation instead of this hook inventing one. */
  onPlainDelete?: (pageId: string) => void;
}

export function useRecurrenceControls({
  dateColId,
  seriesRules,
  getPage,
  onChanged,
  onPlainDelete,
}: UseRecurrenceControlsOptions) {
  const t = useTranslations('Recurrence');
  const [repeatPageId, setRepeatPageId] = useState<string | null>(null);
  const [scopeDialog, setScopeDialog] = useState<
    | { mode: 'delete'; pageId: string }
    | { mode: 'edit'; pageId: string; rule: RecurrenceRule }
    | { mode: 'remove'; pageId: string }
    | null
  >(null);
  const [impact, setImpact] = useState<Partial<Record<RecurrenceScope, ScopeImpact>>>({});
  const [feedback, setFeedback] = useState<RecurrenceFeedback | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), FEEDBACK_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const ruleFor = useCallback(
    (page: RecurrencePageLike | undefined): RecurrenceRule | null =>
      page?.seriesId ? seriesRules[page.seriesId] ?? null : null,
    [seriesRules],
  );

  const isSeriesCard = useCallback(
    (pageId: string) => {
      const page = getPage(pageId);
      return !!page?.seriesId && !page?.seriesDetached;
    },
    [getPage],
  );

  const run = useCallback(
    async (op: () => Promise<unknown>) => {
      try {
        await op();
      } catch (err) {
        console.error('[Remnus] recurrence action failed:', err);
        setFeedback({ type: 'error' });
      } finally {
        setRepeatPageId(null);
        setScopeDialog(null);
        setImpact({});
        onChanged?.();
      }
    },
    [onChanged],
  );

  const openScope = useCallback(
    (
      next:
        | { mode: 'delete'; pageId: string }
        | { mode: 'edit'; pageId: string; rule: RecurrenceRule }
        | { mode: 'remove'; pageId: string },
      scopes: RecurrenceScope[],
    ) => {
      setScopeDialog(next);
      setImpact({});
      // Fetched per scope so each option can show its own real count instead of
      // a vague "this may affect other cards".
      for (const scope of scopes) {
        previewScopeImpact(next.pageId, scope)
          .then((result) => {
            if (result) setImpact((prev) => ({ ...prev, [scope]: result }));
          })
          .catch(() => {});
      }
    },
    [],
  );

  const openRepeat = useCallback((pageId: string) => setRepeatPageId(pageId), []);

  const requestDelete = useCallback(
    (pageId: string) => {
      if (isSeriesCard(pageId)) {
        openScope({ mode: 'delete', pageId }, ['this', 'thisAndFollowing', 'all']);
      } else {
        onPlainDelete?.(pageId);
      }
    },
    [isSeriesCard, openScope, onPlainDelete],
  );

  const handleSaveRule = (rule: RecurrenceRule) => {
    const pageId = repeatPageId;
    if (!pageId) return;
    const existing = ruleFor(getPage(pageId));

    if (!existing) {
      run(() => setPageRecurrence(pageId, dateColId, rule));
      return;
    }

    // Already a series: changing the rhythm needs a scope, because "from here
    // on" and "the whole series" mean very different things to cards the user
    // has already filled in.
    setRepeatPageId(null);
    openScope({ mode: 'edit', pageId, rule }, ['thisAndFollowing', 'all']);
  };

  const handleScopeConfirm = (scope: RecurrenceScope, includeDirty: boolean) => {
    if (!scopeDialog) return;
    if (scopeDialog.mode === 'delete') {
      run(async () => {
        const result = await deleteRecurringPage(scopeDialog.pageId, scope, includeDirty);
        // Cards with content are kept (detached) rather than deleted — say so,
        // otherwise a delete that mostly no-oped looks identical to a bug.
        if (result.preserved > 0) setFeedback({ type: 'preserved', count: result.preserved });
        return result;
      });
    } else if (scopeDialog.mode === 'remove') {
      run(async () => {
        const result = await endSeriesRecurrence(scopeDialog.pageId, scope as 'thisAndFollowing' | 'all');
        if (result) setFeedback({ type: 'removed', count: result.removed });
        return result;
      });
    } else {
      run(() =>
        changeSeriesRule(scopeDialog.pageId, scopeDialog.rule, scope as 'thisAndFollowing' | 'all'),
      );
    }
  };

  const repeatPage = repeatPageId ? getPage(repeatPageId) : undefined;
  const repeatShape = repeatPage ? parseDateValue(repeatPage.properties?.[dateColId]) : null;

  const node = (
    <>
      {repeatPageId && repeatShape && (
        <RecurrenceDialog
          startDate={repeatShape.startDate}
          initialRule={ruleFor(repeatPage)}
          onSave={handleSaveRule}
          onRemove={
            ruleFor(repeatPage)
              // A blanket unlink of every occurrence deserves the same "which
              // ones?" question delete/edit already ask, not a silent one-click
              // action — so this opens the scope dialog instead of running
              // immediately.
              ? () => {
                  const pageId = repeatPageId;
                  if (!pageId) return;
                  setRepeatPageId(null);
                  openScope({ mode: 'remove', pageId }, ['thisAndFollowing', 'all']);
                }
              : undefined
          }
          onClose={() => setRepeatPageId(null)}
        />
      )}

      {scopeDialog && (
        <RecurrenceScopeDialog
          mode={scopeDialog.mode}
          scopes={
            scopeDialog.mode === 'delete'
              ? ['this', 'thisAndFollowing', 'all']
              : ['thisAndFollowing', 'all']
          }
          impact={impact}
          onConfirm={handleScopeConfirm}
          onCancel={() => { setScopeDialog(null); setImpact({}); }}
        />
      )}

      {feedback && typeof document !== 'undefined' && createPortal(
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[60] w-72 bg-neutral-900 border border-neutral-800 shadow-xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <div className={`shrink-0 mt-0.5 ${feedback.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
            {feedback.type === 'error' ? <AlertTriangle size={16} /> : <Unlink size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-neutral-100 leading-snug">
              {feedback.type === 'error'
                ? t('actionError')
                : feedback.type === 'removed'
                  ? t('removeResult', { count: feedback.count })
                  : t('deleteResultPreserved', { count: feedback.count })}
            </span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            aria-label={t('dismiss')}
            className="shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>,
        document.body,
      )}
    </>
  );

  return { openRepeat, requestDelete, isSeriesCard, run, node };
}
