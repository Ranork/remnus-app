'use client';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import type { ViewSort } from '@/lib/types/views';
import { selectCls } from './shared';

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
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
          {t('sorts')}{sorts.length > 0 && ` (${sorts.length})`}
        </span>
        <button onClick={addSort} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
          <Plus size={10} /> Add
        </button>
      </div>
      {sorts.length === 0 ? (
        <p className="text-[11px] text-neutral-700 text-center py-4">{t('noSorts')}</p>
      ) : (
        <div className="flex flex-col">
          {sorts.map((sort) => (
            <div key={sort.id} className="flex items-center gap-1.5 px-4 py-2.5 border-b border-neutral-800/40">
              <select
                value={sort.columnId}
                onChange={(e) => updateSort(sort.id, { columnId: e.target.value })}
                className={`${selectCls} flex-1 min-w-0`}
              >
                {schema.map((col) => <option key={col.id} value={col.id}>{col.name}</option>)}
              </select>
              <button
                onClick={() => updateSort(sort.id, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                className={`${selectCls} shrink-0 hover:bg-neutral-800 transition-colors`}
              >
                {sort.direction === 'asc' ? t('sortAscending') : t('sortDescending')}
              </button>
              <button
                onClick={() => deleteSort(sort.id)}
                className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer p-0.5 shrink-0"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
