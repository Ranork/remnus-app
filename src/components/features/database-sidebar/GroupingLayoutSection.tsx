'use client';

import { useTranslations } from 'next-intl';
import { normalizeOption } from '@/lib/types/properties';
import { Checkbox, CollapsibleSection } from './shared';
import { SimpleSelect } from '@/components/ui/select';

interface GroupingLayoutSectionProps {
  schema: any[];
  groupByCol?: string;
  onGroupByColChange?: (colId: string) => void;
  groupColBg?: boolean;
  onGroupColBgChange?: (enabled: boolean) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
  allowNoGrouping?: boolean;
}

export default function GroupingLayoutSection({
  schema,
  groupByCol,
  onGroupByColChange,
  groupColBg,
  onGroupColBgChange,
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
            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">{t('groupBy')}</span>
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
          <span className="text-xs text-amber-500/80">{t('addSelectForGroup')}</span>
        )}
        <button onClick={() => onGroupColBgChange?.(!groupColBg)} className="w-full flex items-center justify-between py-1.5 hover:bg-neutral-800/10 transition-colors cursor-pointer rounded">
          <span className="text-xs text-neutral-300">{t('groupBackground')}</span>
          <Checkbox checked={!!groupColBg} />
        </button>
      </div>

      {groupColumn && (
        <div className="pb-2">
          <div className="flex flex-col">
            {[...options, 'Uncategorized'].map((colName) => {
              const isHidden = hiddenGroups.includes(colName);
              return (
                <button
                  key={colName}
                  onClick={() => onHiddenGroupsChange?.(isHidden ? hiddenGroups.filter((g) => g !== colName) : [...hiddenGroups, colName])}
                  className="w-full flex items-center justify-between px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left"
                >
                  <span className="text-xs text-neutral-300 truncate">{colName === 'Uncategorized' ? t('uncategorized') : colName}</span>
                  <Checkbox checked={!isHidden} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
