'use client';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { SimpleSelect } from '@/components/ui/select';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import type { CardAccentSide, CardAppearance, CardMarkStyle } from '@/lib/types/views';

const SIDES = [
  { side: 'left', Icon: ArrowLeft, labelKey: 'accentLeft' },
  { side: 'top', Icon: ArrowUp, labelKey: 'accentTop' },
  { side: 'right', Icon: ArrowRight, labelKey: 'accentRight' },
  { side: 'bottom', Icon: ArrowDown, labelKey: 'accentBottom' },
] as const;

/**
 * The card colouring settings shared by the kanban and calendar layout sections: which
 * property marks a card and how (a badge/dot, or an accent line on one edge), and which
 * property tints the whole card. Only select, multi-select and status properties carry
 * a colour, so nothing renders when the database has none.
 */
export default function CardAppearanceControls({
  schema,
  appearance,
  onChange,
  view,
}: {
  schema: any[];
  appearance: CardAppearance;
  onChange?: (patch: Partial<CardAppearance>) => void;
  view: 'kanban' | 'calendar';
}) {
  const t = useTranslations('Database');
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select' || c.type === 'status');
  if (colorColumns.length === 0) return null;

  const columnOptions = [{ value: '', label: t('none') }, ...colorColumns.map((col: any) => ({ value: col.id, label: col.name }))];
  const isAccent = appearance.markStyle === 'accent';
  const markHint = isAccent ? t('cardMarkAccentHint') : view === 'calendar' ? t('cardMarkCalendarHint') : t('cardMarkHint');

  return (
    <div className="flex flex-col gap-2 px-4 pt-1">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-fg-2 shrink-0">{t('cardMark')}</span>
        <SimpleSelect
          value={appearance.markCol ?? ''}
          onValueChange={(v) => onChange?.({ markCol: v })}
          options={columnOptions}
          size="sm"
          className="w-32"
        />
      </div>
      {appearance.markCol && (
        <>
          <SegmentedControl<CardMarkStyle>
            value={appearance.markStyle}
            onValueChange={(markStyle) => onChange?.({ markStyle })}
            aria-label={t('cardMarkStyle')}
            className="w-full"
          >
            <SegmentedControlItem value="mark">{view === 'calendar' ? t('cardMarkStyleDot') : t('cardMarkStyleBadge')}</SegmentedControlItem>
            <SegmentedControlItem value="accent">{t('accentLine')}</SegmentedControlItem>
          </SegmentedControl>
          {isAccent && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-fg-2 shrink-0">{t('accentPosition')}</span>
              <SegmentedControl<CardAccentSide>
                value={appearance.accentSide}
                onValueChange={(accentSide) => onChange?.({ accentSide })}
                aria-label={t('accentPosition')}
              >
                {SIDES.map(({ side, Icon, labelKey }) => (
                  <SegmentedControlItem key={side} value={side} aria-label={t(labelKey)} title={t(labelKey)} className="px-2">
                    <Icon />
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </div>
          )}
        </>
      )}
      <p className="text-xs leading-relaxed text-fg-3">{markHint}</p>

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-fg-2 shrink-0">{t('cardBackground')}</span>
        <SimpleSelect
          value={appearance.tintCol ?? ''}
          onValueChange={(v) => onChange?.({ tintCol: v })}
          options={columnOptions}
          size="sm"
          className="w-32"
        />
      </div>
      <p className="text-xs leading-relaxed text-fg-3">{t('cardBackgroundHint')}</p>
    </div>
  );
}
