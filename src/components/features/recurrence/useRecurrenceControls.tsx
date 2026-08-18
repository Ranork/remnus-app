'use client';

import { useCallback, useState } from 'react';
import { parseDateValue, type RecurrenceRule } from '@/lib/recurrence/rule';
import type { RecurrenceScope } from '@/lib/services/recurrence';
import {
  changeSeriesRule,
  clearSeriesRecurrence,
  deleteRecurringPage,
  previewScopeImpact,
  setPageRecurrence,
} from '@/lib/actions/recurrence';
import RecurrenceDialog from './RecurrenceDialog';
import RecurrenceScopeDialog, { type ScopeImpact } from './RecurrenceScopeDialog';

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
  const [repeatPageId, setRepeatPageId] = useState<string | null>(null);
  const [scopeDialog, setScopeDialog] = useState<
    | { mode: 'delete'; pageId: string }
    | { mode: 'edit'; pageId: string; rule: RecurrenceRule }
    | null
  >(null);
  const [impact, setImpact] = useState<Partial<Record<RecurrenceScope, ScopeImpact>>>({});

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
      next: { mode: 'delete'; pageId: string } | { mode: 'edit'; pageId: string; rule: RecurrenceRule },
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
      run(() => deleteRecurringPage(scopeDialog.pageId, scope, includeDirty));
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
              ? () => run(() => clearSeriesRecurrence(repeatPageId))
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
    </>
  );

  return { openRepeat, requestDelete, isSeriesCard, run, node };
}
