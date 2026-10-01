'use client';

import { useTranslations } from 'next-intl';
import { normalizeOption } from '@/lib/types/properties';
import { CollapsibleSection, ToggleRow } from './shared';
import { SimpleSelect } from '@/components/ui/select';

interface GroupingLayoutSectionProps {
  schema: any[];
  groupByCol?: string;
  onGroupByColChange?: (colId: string) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
  allowNoGrouping?: boolean;
}

// Groups no longer take a background tint (V2 R8.2: the group's colour shows as its
// heading glyph), so the old "group background" toggle is gone; a stored
// `groupColBg` is simply ignored.
export default function GroupingLayoutSection({
  schema,
  groupByCol,
  onGroupByColChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
  allowNoGrouping = false,
}: GroupingLayoutSectionProps) {
  const t = useTranslations('Database');
  const selectColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'status');
  const groupColumn = schema.find((c: any) => c.id === groupByCol);
  const options = groupColumn?.options ? groupColumn.options.map((o: any) => normalizeOption(o).value) : [];

  return (
    <CollapsibleSection label={t('sectionGrouping')}>
      <div className="px-4 pb-3 flex flex-col gap-2">
        {selectColumns.length > 0 ? (
          <div>
            <span className="block text-xs text-fg-3 mb-1.5">{t('groupBy')}</span>
            <SimpleSelect
              value={groupByCol ?? ''}
              onValueChange={(v) => onGroupByColChange?.(v)}
              options={[
                ...(allowNoGrouping ? [{ value: '', label: t('noGrouping') }] : []),
                ...selectColumns.map((col: any) => ({ value: col.id, label: col.name })),
              ]}
              className="w-full"
            />
          </div>
        ) : (
          <span className="text-xs text-fg-3">{t('addSelectForGroup')}</span>
        )}
      </div>

      {groupColumn && (
        <div className="pb-2">
          <span className="block px-4 pb-1 text-xs text-fg-3">{t('visibleGroups')}</span>
          {[...options, 'Uncategorized'].map((colName) => {
            const isHidden = hiddenGroups.includes(colName);
            return (
              <ToggleRow
                key={colName}
                checked={!isHidden}
                onToggle={() => onHiddenGroupsChange?.(isHidden ? hiddenGroups.filter((g) => g !== colName) : [...hiddenGroups, colName])}
              >
                <span className="truncate text-fg-2">{colName === 'Uncategorized' ? t('uncategorized') : colName}</span>
              </ToggleRow>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
