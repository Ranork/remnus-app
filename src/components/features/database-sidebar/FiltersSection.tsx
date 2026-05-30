'use client';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { type SelectOption, normalizeOption } from '@/lib/types/properties';
import type { ViewFilter, FilterOperator } from '@/lib/types/views';
import { Checkbox, selectCls } from './shared';

const OPERATOR_KEYS: { value: FilterOperator; key: string; needsValue: boolean }[] = [
  { value: 'contains',     key: 'operatorContains',       needsValue: true  },
  { value: 'not_contains', key: 'operatorDoesNotContain', needsValue: true  },
  { value: 'equals',       key: 'operatorIs',             needsValue: true  },
  { value: 'not_equals',   key: 'operatorIsNot',          needsValue: true  },
  { value: 'is_empty',     key: 'operatorIsEmpty',        needsValue: false },
  { value: 'is_not_empty', key: 'operatorIsNotEmpty',     needsValue: false },
];

interface FiltersSectionProps {
  filters: ViewFilter[];
  schema: any[];
  onFiltersChange: (filters: ViewFilter[]) => void;
}

export default function FiltersSection({ filters, schema, onFiltersChange }: FiltersSectionProps) {
  const t = useTranslations('Database');
  const OPERATORS = OPERATOR_KEYS.map((op) => ({ ...op, label: t(op.key as Parameters<typeof t>[0]) }));

  const addFilter = () => {
    const col = schema[0];
    if (!col) return;
    onFiltersChange([...filters, { id: crypto.randomUUID(), columnId: col.id, operator: 'contains', value: '' }]);
  };
  const updateFilter = (id: string, patch: Partial<ViewFilter>) =>
    onFiltersChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const deleteFilter = (id: string) =>
    onFiltersChange(filters.filter((f) => f.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
          {t('filters')}{filters.length > 0 && ` (${filters.length})`}
        </span>
        <button onClick={addFilter} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
          <Plus size={10} /> Add
        </button>
      </div>
      {filters.length === 0 ? (
        <p className="text-[11px] text-neutral-700 text-center py-4">{t('noFilters')}</p>
      ) : (
        <div className="flex flex-col">
          {filters.map((filter) => {
            const opDef = OPERATORS.find((o) => o.value === filter.operator);
            const colSchema = schema.find((c) => c.id === filter.columnId);
            const isSelectType = colSchema && (colSchema.type === 'select' || colSchema.type === 'multi_select');

            let selectedList: string[] = [];
            if (filter.value) {
              if (filter.value.startsWith('[') && filter.value.endsWith(']')) {
                try { selectedList = JSON.parse(filter.value); } catch { selectedList = [filter.value]; }
              } else {
                selectedList = [filter.value];
              }
            }

            return (
              <div key={filter.id} className="px-4 py-2.5 border-b border-neutral-800/40 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={filter.columnId}
                    onChange={(e) => updateFilter(filter.id, { columnId: e.target.value })}
                    className={`${selectCls} flex-1 min-w-0`}
                  >
                    {schema.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                  <select
                    value={filter.operator}
                    onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                    className={`${selectCls} flex-1 min-w-0`}
                  >
                    {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  <button
                    onClick={() => deleteFilter(filter.id)}
                    className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer shrink-0 p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
                {opDef?.needsValue && isSelectType && (
                  <div className="flex flex-col gap-1 border border-neutral-800 bg-neutral-950/40 p-2 rounded max-h-36 overflow-y-auto">
                    <span className="text-[10px] text-neutral-500 font-semibold mb-1">Select Options:</span>
                    {(colSchema.options || []).map((rawOpt: string | SelectOption) => {
                      const opt = normalizeOption(rawOpt);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => {
                            const next = selectedList.includes(opt.value)
                              ? selectedList.filter(v => v !== opt.value)
                              : [...selectedList, opt.value];
                            updateFilter(filter.id, { value: JSON.stringify(next) });
                          }}
                          className="flex items-center gap-2 text-left text-xs text-neutral-300 hover:bg-neutral-800/40 px-1.5 py-1 rounded cursor-pointer transition-colors"
                        >
                          <Checkbox checked={selectedList.includes(opt.value)} />
                          <span className="truncate">{opt.value}</span>
                        </button>
                      );
                    })}
                    {(colSchema.options || []).length === 0 && (
                      <span className="text-[10px] text-neutral-600 italic">{t('noOptionsDefined')}</span>
                    )}
                  </div>
                )}
                {opDef?.needsValue && !isSelectType && (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                    placeholder={t('filterValue')}
                    className={`${selectCls} w-full focus:border-neutral-700`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
