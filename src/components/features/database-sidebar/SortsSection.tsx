'use client';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import type { ViewSort } from '@/lib/types/views';
import { Button } from '@/components/ui/button';
import { selectCls } from './shared';
import { SimpleSelect } from '@/components/ui/select';

interface SortsSectionProps {
  sorts: ViewSort[];
  schema: any[];
  onSortsChange: (sorts: ViewSort[]) => void;
}

export default function SortsSection({ sorts, schema, onSortsChange }: SortsSectionProps) {
  const t = useTranslations('Database');

  const addSort = () => {
    const usedIds = new Set(sorts.map((s) => s.columnId));
    const col = schema.find((c) => !usedIds.has(c.id));
    if (!col) return;
    onSortsChange([...sorts, { id: crypto.randomUUID(), columnId: col.id, direction: 'asc' }]);
  };
  const updateSort = (id: string, patch: Partial<ViewSort>) =>
    onSortsChange(sorts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteSort = (id: string) =>
    onSortsChange(sorts.filter((s) => s.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-ui font-medium text-fg-2">
          {t('sorts')}{sorts.length > 0 && <span className="font-normal text-fg-3"> ({sorts.length})</span>}
        </span>
        <Button variant="ghost" size="xs" onClick={addSort}>
          <Plus /> {t('addSort')}
        </Button>
      </div>
      {sorts.length === 0 ? (
        <p className="px-4 pb-3 text-xs text-fg-3">{t('noSorts')}</p>
      ) : (
        <div className="flex flex-col pb-1">
          {sorts.map((sort) => (
            <div key={sort.id} className="flex items-center gap-1.5 px-4 py-2">
              <SimpleSelect
                value={sort.columnId}
                onValueChange={(v) => updateSort(sort.id, { columnId: v })}
                options={schema.map((col) => ({ value: col.id, label: col.name }))}
                size="sm"
                className="min-w-0 flex-1 shrink"
              />
              <button
                type="button"
                onClick={() => updateSort(sort.id, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                className={`${selectCls} shrink-0`}
              >
                {sort.direction === 'asc' ? t('sortAscending') : t('sortDescending')}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => deleteSort(sort.id)}
                aria-label={t('remove')}
                title={t('remove')}
                className="shrink-0 hover:text-red-400"
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
