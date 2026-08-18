'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Repeat, Unlink } from 'lucide-react';
import { parseDateValue, type RecurrenceRule } from '@/lib/recurrence/rule';
import { formatRuleSummary } from '@/lib/recurrence/summary';
import { detachPageFromSeries, loadRecurrenceState } from '@/lib/actions/recurrence';
import { useRecurrenceControls } from './useRecurrenceControls';

// The recurrence surface inside an opened card.
//
// This is where it matters most: the customer's whole pattern is opening a
// future occurrence and filling it in, so "is this card part of a series, and
// what is the rhythm?" has to be answerable without going back to the calendar
// grid and hunting through a context menu.

interface SeriesPanelProps {
  page: {
    id: string;
    properties?: Record<string, unknown> | null;
    seriesId?: string | null;
    seriesDetached?: boolean | null;
  };
  databaseId: string;
  /** Date column the rule hangs off; null when the database has no date column. */
  dateColId: string | null;
  /** Compact spacing for the peek drawer. */
  isPeek?: boolean;
  onChanged?: () => void;
}

export default function SeriesPanel({
  page,
  databaseId,
  dateColId,
  isPeek = false,
  onChanged,
}: SeriesPanelProps) {
  const t = useTranslations('Recurrence');
  const locale = useLocale();
  const [seriesRules, setSeriesRules] = useState<Record<string, RecurrenceRule>>({});

  const hasDate = !!dateColId && !!parseDateValue(page.properties?.[dateColId]);
  const inSeries = !!page.seriesId && !page.seriesDetached;
  const wasInSeries = !!page.seriesId && !!page.seriesDetached;

  // Only fetch when a rule could actually be shown or set — an ordinary row in
  // a database with no date column never needs this round-trip.
  const needsRules = !!page.seriesId;

  useEffect(() => {
    if (!needsRules || !databaseId) return;
    let cancelled = false;
    loadRecurrenceState(databaseId)
      .then(({ series }) => {
        if (!cancelled) setSeriesRules(Object.fromEntries(series.map((s) => [s.id, s.rule])));
      })
      // A failed lookup costs the summary line, not the panel — the card's own
      // series flags come from the row itself and are still correct.
      .catch(() => {});
    return () => { cancelled = true; };
  }, [needsRules, databaseId]);

  const recurrence = useRecurrenceControls({
    dateColId: dateColId ?? '',
    seriesRules,
    getPage: (id) => (id === page.id ? page : undefined),
    onChanged,
  });

  const summary = useMemo(() => {
    const rule = page.seriesId ? seriesRules[page.seriesId] : null;
    return rule ? formatRuleSummary(rule, t as never, locale) : '';
  }, [page.seriesId, seriesRules, t, locale]);

  // Nothing to show and nothing to offer.
  if (!dateColId) return null;
  if (!inSeries && !wasInSeries && !hasDate) return null;

  return (
    <div className={isPeek ? 'mb-5' : 'mb-10'}>
      {inSeries ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] px-3.5 py-3">
          <Repeat size={14} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-xs font-medium text-neutral-100">{t('seriesPanelTitle')}</p>
            {summary && <p className="m-0 mt-0.5 text-[11px] text-blue-300/80 leading-snug">{summary}</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                onClick={() => recurrence.openRepeat(page.id)}
                className="text-[11px] font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-750 px-2.5 py-1 rounded-md transition-colors"
              >
                {t('seriesPanelEdit')}
              </button>
              <button
                onClick={() => recurrence.run(() => detachPageFromSeries(page.id))}
                className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 px-2.5 py-1 rounded-md hover:bg-neutral-800 transition-colors"
              >
                <Unlink size={11} />
                {t('menuDetach')}
              </button>
            </div>
          </div>
        </div>
      ) : wasInSeries ? (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3.5 py-2.5">
          <span className="relative inline-flex items-center shrink-0">
            <Repeat size={12} className="text-neutral-600" />
            <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <span className="w-4 h-px bg-neutral-500 rotate-45" />
            </span>
          </span>
          <p className="m-0 text-[11px] text-neutral-500">{t('seriesPanelDetached')}</p>
        </div>
      ) : (
        <button
          onClick={() => recurrence.openRepeat(page.id)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 hover:text-neutral-100 border border-dashed border-neutral-800 hover:border-neutral-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Repeat size={12} />
          {t('seriesPanelAdd')}
        </button>
      )}

      {recurrence.node}
    </div>
  );
}
