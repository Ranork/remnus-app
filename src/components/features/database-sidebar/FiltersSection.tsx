'use client';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { type SelectOption, normalizeOption } from '@/lib/types/properties';
import type { ViewFilter, FilterOperator } from '@/lib/types/views';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SimpleSelect } from '@/components/ui/select';

const OPERATOR_KEYS: { value: FilterOperator; key: string; needsValue: boolean }[] = [
  { value: 'contains',     key: 'operatorContains',       needsValue: true  },
  { value: 'not_contains', key: 'operatorDoesNotContain', needsValue: true  },
  { value: 'equals',       key: 'operatorIs',             needsValue: true  },
  { value: 'not_equals',   key: 'operatorIsNot',          needsValue: true  },
  { value: 'is_empty',     key: 'operatorIsEmpty',        needsValue: false },
  { value: 'is_not_empty', key: 'operatorIsNotEmpty',     needsValue: false },
];

/** The filter operators with their translated labels (shared with the table's column menu). */
export function useFilterOperators() {
  const t = useTranslations('Database');
  return OPERATOR_KEYS.map((op) => ({ ...op, label: t(op.key as Parameters<typeof t>[0]) }));
}

/** A select-type filter stores its chosen options as a JSON array (older rows: one bare value). */
function parseSelectedOptions(value: string): string[] {
  if (!value) return [];
  if (value.startsWith('[') && value.endsWith(']')) {
    try { return JSON.parse(value); } catch { return [value]; }
  }
  return [value];
}

/**
 * The value half of a filter: option checkboxes for a select/status column, a text field
 * otherwise. Shared by this section and the table's column menu so both edit a filter
 * the same way.
 */
export function FilterValueField({
  filter,
  column,
  onChange,
}: {
  filter: ViewFilter;
  column: any;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('Database');
  const isSelectType = column && (column.type === 'select' || column.type === 'multi_select' || column.type === 'status');

  if (!isSelectType) {
    return (
      <Input
        size="sm"
        value={filter.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('filterValue')}
      />
    );
  }

  const selectedList = parseSelectedOptions(filter.value);
  return (
    <div className="flex max-h-40 flex-col overflow-y-auto rounded-control border border-line bg-sheet py-1">
      {(column.options || []).map((rawOpt: string | SelectOption) => {
        const opt = normalizeOption(rawOpt);
        const on = selectedList.includes(opt.value);
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-fg-2 transition-colors hover:bg-hover/60"
          >
            <Checkbox
              size="sm"
              checked={on}
              onCheckedChange={() => {
                const next = on ? selectedList.filter((v) => v !== opt.value) : [...selectedList, opt.value];
                onChange(JSON.stringify(next));
              }}
            />
            <span className="truncate">{opt.value}</span>
          </label>
        );
      })}
      {(column.options || []).length === 0 && (
        <span className="px-2 py-1 text-xs text-fg-3">{t('noOptionsDefined')}</span>
      )}
    </div>
  );
}

interface FiltersSectionProps {
  filters: ViewFilter[];
  schema: any[];
  onFiltersChange: (filters: ViewFilter[]) => void;
}

export default function FiltersSection({ filters, schema, onFiltersChange }: FiltersSectionProps) {
  const t = useTranslations('Database');
  const OPERATORS = useFilterOperators();

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
    <div className="border-b border-line">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-ui font-medium text-fg-2">
          {t('filters')}{filters.length > 0 && <span className="font-normal text-fg-3"> ({filters.length})</span>}
        </span>
        <Button variant="ghost" size="xs" onClick={addFilter}>
          <Plus /> {t('addFilter')}
        </Button>
      </div>
      {filters.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-fg-3">{t('noFilters')}</p>
      ) : (
        <div className="flex flex-col pb-1">
          {filters.map((filter) => {
            const opDef = OPERATORS.find((o) => o.value === filter.operator);
            const colSchema = schema.find((c) => c.id === filter.columnId);

            return (
              <div key={filter.id} className="px-4 py-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <SimpleSelect
                    value={filter.columnId}
                    onValueChange={(v) => updateFilter(filter.id, { columnId: v })}
                    options={schema.map((col) => ({ value: col.id, label: col.name }))}
                    size="sm"
                    className="min-w-0 flex-1 shrink"
                  />
                  <SimpleSelect
                    value={filter.operator}
                    onValueChange={(v) => updateFilter(filter.id, { operator: v as FilterOperator })}
                    options={OPERATORS.map((op) => ({ value: op.value, label: op.label }))}
                    size="sm"
                    className="min-w-0 flex-1 shrink"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => deleteFilter(filter.id)}
                    aria-label={t('remove')}
                    title={t('remove')}
                    className="shrink-0 hover:text-red-400"
                  >
                    <X />
                  </Button>
                </div>
                {opDef?.needsValue && (
                  <FilterValueField
                    filter={filter}
                    column={colSchema}
                    onChange={(value) => updateFilter(filter.id, { value })}
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
