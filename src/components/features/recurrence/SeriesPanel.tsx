'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Repeat, Unlink } from 'lucide-react';
import { parseDateValue, type RecurrenceRule } from '@/lib/recurrence/rule';
import { formatRuleSummary } from '@/lib/recurrence/summary';
import { detachPageFromSeries, loadRecurrenceState } from '@/lib/actions/recurrence';
import { Button } from '@/components/ui/button';
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
  /** No outer spacing: inside the page's floating "Repeat" panel (U4). */
  bare?: boolean;
  onChanged?: () => void;
}

export default function SeriesPanel({
  page,
  databaseId,
  dateColId,
  isPeek = false,
  bare = false,
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
    <div className={bare ? undefined : isPeek ? 'mb-5' : 'mb-10'}>
      {inSeries ? (
        <div className="flex items-start gap-3 rounded-control bg-raised px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <Repeat size={16} className="text-fg-3 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-ui font-medium text-fg">{t('seriesPanelTitle')}</p>
            {summary && <p className="m-0 mt-0.5 text-xs text-fg-3 leading-snug">{summary}</p>}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <Button variant="secondary" size="xs" onClick={() => recurrence.openRepeat(page.id)}>
                {t('seriesPanelEdit')}
              </Button>
              <Button variant="ghost" size="xs" onClick={() => recurrence.run(() => detachPageFromSeries(page.id))}>
                <Unlink />
                {t('menuDetach')}
              </Button>
            </div>
          </div>
        </div>
      ) : wasInSeries ? (
        <div className="flex items-center gap-2.5 rounded-control bg-raised px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <span className="relative inline-flex items-center shrink-0" aria-hidden>
            <Repeat size={14} className="text-fg-4" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-4 h-px bg-fg-4 rotate-45" />
            </span>
          </span>
          <p className="m-0 text-xs text-fg-3">{t('seriesPanelDetached')}</p>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => recurrence.openRepeat(page.id)} className="-ml-2.5">
          <Repeat />
          {t('seriesPanelAdd')}
        </Button>
      )}

      {recurrence.node}
    </div>
  );
}
