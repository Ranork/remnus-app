'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Repeat } from 'lucide-react';
import type { RecurrenceRule } from '@/lib/recurrence/rule';
import { formatRuleSummary } from '@/lib/recurrence/summary';

// The "this repeats" marker, shared by every view that lists rows.
//
// It carries the rule in words as its tooltip because that is the only thing a
// glance can't otherwise answer: a card sitting on a Thursday tells you nothing
// about whether it is weekly, fortnightly, or the third Thursday of the month.
//
// A detached card keeps a muted, struck-through icon rather than losing the
// marker entirely — "this used to follow a series and no longer does" is
// information the user needs when they wonder why it stopped moving with the
// rest.

export default function RecurringBadge({
  seriesId,
  detached,
  rule,
  size = 10,
}: {
  seriesId?: string | null;
  detached?: boolean | null;
  rule?: RecurrenceRule | null;
  size?: number;
}) {
  const t = useTranslations('Recurrence');
  const locale = useLocale();

  if (!seriesId) return null;

  const title = detached
    ? t('badgeDetached')
    : (rule ? formatRuleSummary(rule, t as never, locale) : '') || t('badgeRecurring');

  return (
    <span className="relative shrink-0 inline-flex items-center" title={title}>
      <Repeat size={size} className={detached ? 'text-neutral-600' : 'text-blue-400/80'} />
      {detached && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="h-px bg-neutral-500 rotate-45" style={{ width: size + 3 }} />
        </span>
      )}
    </span>
  );
}
