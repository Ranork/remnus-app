'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import {
  getDashboardEditorOptions,
  saveDashboardBlock,
  type DashboardEditorDatabase,
  type DashboardEditorOptions,
} from '@/lib/actions/dashboard';
// Type-only: the schema module is zod, and the form needs none of it at runtime.
import type { DashboardBlockType } from '@/lib/dashboard/schema';

/**
 * The human's block builder: add a block, or change the settings of one an
 * agent (or a person) already placed. It edits the same JSON an agent writes,
 * through the same service, so a correction here is exactly what
 * `update_dashboard` would have produced — there is no second model.
 *
 * Every field is a picker over the workspace's real databases, columns and
 * views, so a human cannot type a column that does not exist; the few
 * required fields gate the Save button instead of producing a server error.
 */

type Draft = Record<string, any>;
type Filter = { columnId: string; operator: string; value?: string };

const BLOCK_TYPES: DashboardBlockType[] = ['metric', 'chart', 'database_embed', 'list', 'text', 'links', 'activity'];
/** Filter operators, labelled with the database view's own wording (`Database` namespace). */
const OPERATOR_LABELS = {
  equals: 'operatorIs',
  not_equals: 'operatorIsNot',
  contains: 'operatorContains',
  not_contains: 'operatorDoesNotContain',
  is_empty: 'operatorIsEmpty',
  is_not_empty: 'operatorIsNotEmpty',
} as const;
const OPERATORS = Object.keys(OPERATOR_LABELS) as (keyof typeof OPERATOR_LABELS)[];
const SELECT_TYPES = new Set(['select', 'multi_select', 'status']);
const DATE_TYPES = new Set(['date', 'datetime']);
const SOURCE_TYPES = new Set<DashboardBlockType>(['metric', 'chart', 'list']);

const inputCls = 'w-full border-b border-neutral-700 bg-transparent px-1 py-1.5 text-xs text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-500';
const selectCls = `${inputCls} bg-neutral-900`;

function emptyDraft(type: DashboardBlockType): Draft {
  switch (type) {
    case 'metric':
      return { type, source: { databaseId: '' }, aggregate: 'count' };
    case 'chart':
      return { type, source: { databaseId: '' }, variant: 'donut', groupBy: '', aggregate: 'count' };
    case 'list':
      return { type, source: { databaseId: '' } };
    case 'database_embed':
      return { type, databaseId: '' };
    case 'text':
      return { type, markdown: '' };
    case 'links':
      return { type, items: [{ itemId: '' }] };
    case 'activity':
      return { type };
  }
}

/** Drop what the form leaves empty, so the stored block stays as small as an agent's. */
function cleanDraft(draft: Draft): Draft {
  const out: Draft = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === '' || value === undefined || value === null) continue;
    out[key] = value;
  }
  if (out.source) {
    const filters = ((out.source.filters ?? []) as Filter[])
      .filter((f) => f.columnId)
      .map((f) => (f.operator === 'is_empty' || f.operator === 'is_not_empty' ? { columnId: f.columnId, operator: f.operator } : f));
    out.source = { databaseId: out.source.databaseId, ...(filters.length ? { filters } : {}) };
  }
  // Defaults are applied when the spec is read; storing them only lengthens it.
  if (out.aggregate === 'count') delete out.aggregate;
  if (out.tone === 'default') delete out.tone;
  if (out.type === 'metric' && !out.aggregate) delete out.columnId;
  if (out.type === 'chart' && out.aggregate !== 'sum') delete out.valueColumnId;
  if (Array.isArray(out.showColumns) && !out.showColumns.length) delete out.showColumns;
  if (out.type === 'links') {
    out.items = (out.items as { itemId: string; label?: string }[])
      .filter((i) => i.itemId)
      .map((i) => (i.label ? { itemId: i.itemId, label: i.label } : { itemId: i.itemId }));
  }
  return out;
}

function isComplete(d: Draft): boolean {
  if (SOURCE_TYPES.has(d.type) && !d.source?.databaseId) return false;
  switch (d.type as DashboardBlockType) {
    case 'metric':
      return (!d.aggregate || d.aggregate === 'count' || !!d.columnId) && (!d.trend || !!d.trend.columnId);
    case 'chart':
      return !!d.groupBy && (d.aggregate !== 'sum' || !!d.valueColumnId);
    case 'database_embed':
      return !!d.databaseId;
    case 'text':
      return !!String(d.markdown ?? '').trim();
    case 'links':
      return (d.items ?? []).some((i: { itemId?: string }) => !!i.itemId);
    default:
      return true;
  }
}

export default function DashboardBlockEditor({
  itemId,
  block,
  onClose,
}: {
  itemId: string;
  /** The block to edit; omitted = add a new one. */
  block?: Draft;
  onClose: () => void;
}) {
  const t = useTranslations('Dashboard');
  const tDb = useTranslations('Database');
  const router = useRouter();
  const isNew = !block;
  const [options, setOptions] = useState<DashboardEditorOptions | null>(null);
  const [draft, setDraft] = useState<Draft>(() => (block ? structuredClone(block) : emptyDraft('metric')));
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getDashboardEditorOptions(itemId).then((o) => alive && setOptions(o)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [itemId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const type = draft.type as DashboardBlockType;
  const databaseId: string = type === 'database_embed' ? draft.databaseId : draft.source?.databaseId ?? '';
  const database = useMemo(() => options?.databases.find((d) => d.id === databaseId) ?? null, [options, databaseId]);

  const set = (patch: Draft) => setDraft((d) => ({ ...d, ...patch }));
  const setSource = (patch: Draft) => setDraft((d) => ({ ...d, source: { ...d.source, ...patch } }));

  // A new database invalidates every column the block names.
  const changeDatabase = (id: string) => {
    if (type === 'database_embed') set({ databaseId: id, viewId: undefined });
    else {
      setDraft((d) => {
        const next: Draft = { ...d, source: { databaseId: id } };
        for (const key of ['columnId', 'groupBy', 'valueColumnId', 'bucket', 'trend', 'sort', 'showColumns']) delete next[key];
        if (type === 'chart') next.groupBy = '';
        return next;
      });
    }
  };

  const save = () => {
    setFailed(false);
    startTransition(async () => {
      const result = await saveDashboardBlock(itemId, cleanDraft(draft), isNew ? 'add' : 'replace');
      if (!result.ok) {
        console.error('[dashboard] block not saved:', result.error);
        setFailed(true);
        return;
      }
      router.refresh();
      onClose();
    });
  };

  const complete = isComplete(draft);

  return (
    <>
      <div className="fixed inset-0 z-300 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={isNew ? t('editor.addTitle') : t('editor.editTitle')}
        className="fixed inset-y-0 right-0 z-300 flex w-full flex-col border-l border-neutral-800 bg-neutral-900 sm:w-[400px]"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-5 py-3.5">
          <p className="text-sm font-semibold text-neutral-100">{isNew ? t('editor.addTitle') : t('editor.editTitle')}</p>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="p-1 text-neutral-500 transition-colors hover:text-neutral-200">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {isNew && (
            <Field label={t('editor.type')}>
              <div className="grid grid-cols-2 gap-px bg-neutral-800">
                {BLOCK_TYPES.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDraft({ ...emptyDraft(option), ...(draft.title ? { title: draft.title } : {}) })}
                    // An odd last type spans the row, so no empty cell shows the grid's gap colour.
                    className={`px-2.5 py-2 text-left text-xs transition-colors ${i === BLOCK_TYPES.length - 1 && BLOCK_TYPES.length % 2 ? 'col-span-2 ' : ''}${
                      option === type ? 'bg-neutral-800 text-neutral-100' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-850 hover:text-neutral-200'
                    }`}
                  >
                    {t(`blockTypes.${option}`)}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label={t('editor.title')}>
            <input className={inputCls} value={draft.title ?? ''} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
          </Field>

          <Field label={t('editor.width')}>
            <select className={selectCls} value={draft.width ?? ''} onChange={(e) => set({ width: e.target.value || undefined })}>
              <option value="">{t('editor.widthAuto')}</option>
              <option value="quarter">{t('editor.widthQuarter')}</option>
              <option value="half">{t('editor.widthHalf')}</option>
              <option value="full">{t('editor.widthFull')}</option>
            </select>
          </Field>

          {!options && !failed && <p className="text-xs text-neutral-600">{t('editor.loading')}</p>}

          {options && (SOURCE_TYPES.has(type) || type === 'database_embed') && (
            <Field label={`${t('editor.database')} *`}>
              <select className={selectCls} value={databaseId} onChange={(e) => changeDatabase(e.target.value)}>
                <option value="">{t('editor.chooseDatabase')}</option>
                {options.databases.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          )}

          {options && database && SOURCE_TYPES.has(type) && (
            <FiltersEditor
              database={database}
              filters={(draft.source?.filters ?? []) as Filter[]}
              onChange={(filters) => setSource({ filters })}
            />
          )}

          {options && type === 'metric' && database && (
            <>
              <Field label={t('editor.aggregate')}>
                <select className={selectCls} value={draft.aggregate ?? 'count'} onChange={(e) => set({ aggregate: e.target.value })}>
                  {(['count', 'sum', 'avg', 'min', 'max'] as const).map((a) => (
                    <option key={a} value={a}>{t(`editor.aggregates.${a}`)}</option>
                  ))}
                </select>
              </Field>
              {draft.aggregate && draft.aggregate !== 'count' && (
                <ColumnSelect label={`${t('editor.column')} *`} database={database} value={draft.columnId} only={(c) => c.type === 'number'} onChange={(columnId) => set({ columnId })} />
              )}
              <Field label={t('editor.unit')}>
                <input className={inputCls} value={draft.unit ?? ''} maxLength={16} onChange={(e) => set({ unit: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={!!draft.trend}
                  onChange={(e) => {
                    const dateCol = database.columns.find((c) => DATE_TYPES.has(c.type));
                    set({ trend: e.target.checked ? { columnId: dateCol?.id ?? '', days: 7 } : undefined });
                  }}
                />
                {t('editor.trend')}
              </label>
              {draft.trend && (
                <div className="grid grid-cols-2 gap-3">
                  <ColumnSelect label={t('editor.dateColumn')} database={database} value={draft.trend.columnId} only={(c) => DATE_TYPES.has(c.type)} onChange={(columnId) => set({ trend: { ...draft.trend, columnId } })} />
                  <Field label={t('editor.trendDays')}>
                    <input type="number" min={1} max={365} className={inputCls} value={draft.trend.days} onChange={(e) => set({ trend: { ...draft.trend, days: clamp(e.target.value, 1, 365) } })} />
                  </Field>
                </div>
              )}
            </>
          )}

          {options && type === 'chart' && database && (
            <>
              <Field label={t('editor.variant')}>
                <select className={selectCls} value={draft.variant} onChange={(e) => set({ variant: e.target.value })}>
                  {(['donut', 'bar', 'line'] as const).map((v) => (
                    <option key={v} value={v}>{t(`editor.variants.${v}`)}</option>
                  ))}
                </select>
              </Field>
              <ColumnSelect label={`${tDb('groupBy')} *`} database={database} value={draft.groupBy} onChange={(groupBy) => set({ groupBy })} />
              {DATE_TYPES.has(database.columns.find((c) => c.id === draft.groupBy)?.type ?? '') && (
                <Field label={t('editor.bucket')}>
                  <select className={selectCls} value={draft.bucket ?? ''} onChange={(e) => set({ bucket: e.target.value || undefined })}>
                    <option value="">{t('editor.buckets.day')}</option>
                    <option value="week">{t('editor.buckets.week')}</option>
                    <option value="month">{t('editor.buckets.month')}</option>
                  </select>
                </Field>
              )}
              <Field label={t('editor.aggregate')}>
                <select className={selectCls} value={draft.aggregate ?? 'count'} onChange={(e) => set({ aggregate: e.target.value })}>
                  <option value="count">{t('editor.aggregates.count')}</option>
                  <option value="sum">{t('editor.aggregates.sum')}</option>
                </select>
              </Field>
              {draft.aggregate === 'sum' && (
                <ColumnSelect label={`${t('editor.valueColumn')} *`} database={database} value={draft.valueColumnId} only={(c) => c.type === 'number'} onChange={(valueColumnId) => set({ valueColumnId })} />
              )}
              <LimitField value={draft.limit} fallback={8} min={2} max={12} onChange={(limit) => set({ limit })} />
            </>
          )}

          {options && type === 'list' && database && (
            <>
              <LimitField value={draft.limit} fallback={5} min={1} max={20} onChange={(limit) => set({ limit })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('editor.sortBy')}>
                  <select
                    className={selectCls}
                    value={draft.sort?.columnId ?? ''}
                    onChange={(e) => set({ sort: e.target.value ? { columnId: e.target.value, direction: draft.sort?.direction ?? 'asc' } : undefined })}
                  >
                    <option value="">{t('editor.sortNone')}</option>
                    {database.columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
                {draft.sort && (
                  <Field label={t('editor.direction')}>
                    <select className={selectCls} value={draft.sort.direction} onChange={(e) => set({ sort: { ...draft.sort, direction: e.target.value } })}>
                      <option value="asc">{tDb('sortAscending')}</option>
                      <option value="desc">{tDb('sortDescending')}</option>
                    </select>
                  </Field>
                )}
              </div>
              <Field label={t('editor.showColumns')}>
                <div className="space-y-1 pt-1">
                  {database.columns.filter((c) => c.id !== 'title').map((c) => {
                    const chosen: string[] = draft.showColumns ?? [];
                    const on = chosen.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-xs text-neutral-300">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && chosen.length >= 3}
                          onChange={() => set({ showColumns: on ? chosen.filter((id) => id !== c.id) : [...chosen, c.id] })}
                        />
                        {c.name}
                      </label>
                    );
                  })}
                </div>
              </Field>
            </>
          )}

          {options && type === 'database_embed' && database && (
            <>
              <Field label={t('editor.view')}>
                <select className={selectCls} value={draft.viewId ?? ''} onChange={(e) => set({ viewId: e.target.value || undefined })}>
                  <option value="">{t('editor.firstView')}</option>
                  {database.views.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </Field>
              <LimitField value={draft.limit} fallback={10} min={1} max={50} onChange={(limit) => set({ limit })} />
            </>
          )}

          {type === 'text' && (
            <>
              <Field label={`${t('editor.markdown')} *`}>
                <textarea
                  className={`${inputCls} min-h-[140px] resize-y border border-neutral-800 bg-neutral-850 px-2 font-mono leading-relaxed`}
                  value={draft.markdown ?? ''}
                  maxLength={2000}
                  onChange={(e) => set({ markdown: e.target.value })}
                />
              </Field>
              <Field label={t('editor.tone')}>
                <select className={selectCls} value={draft.tone ?? 'default'} onChange={(e) => set({ tone: e.target.value === 'default' ? undefined : e.target.value })}>
                  {(['default', 'info', 'warning'] as const).map((tone) => (
                    <option key={tone} value={tone}>{t(`editor.tones.${tone}`)}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {options && type === 'links' && (
            <Field label={`${t('editor.links')} *`}>
              <div className="space-y-2 pt-1">
                {(draft.items as { itemId: string; label?: string }[]).map((link, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <select
                        className={selectCls}
                        value={link.itemId}
                        onChange={(e) => set({ items: draft.items.map((l: object, k: number) => (k === i ? { ...l, itemId: e.target.value } : l)) })}
                      >
                        <option value="">{t('editor.chooseItem')}</option>
                        {options.items.map((item) => (
                          <option key={item.id} value={item.id}>{item.title || t('untitled')}</option>
                        ))}
                      </select>
                      <input
                        className={inputCls}
                        placeholder={t('editor.linkLabel')}
                        value={link.label ?? ''}
                        maxLength={60}
                        onChange={(e) => set({ items: draft.items.map((l: object, k: number) => (k === i ? { ...l, label: e.target.value } : l)) })}
                      />
                    </div>
                    <RemoveButton label={t('editor.remove')} onClick={() => set({ items: draft.items.filter((_: unknown, k: number) => k !== i) })} />
                  </div>
                ))}
                {draft.items.length < 12 && (
                  <AddButton label={t('editor.addLink')} onClick={() => set({ items: [...draft.items, { itemId: '' }] })} />
                )}
              </div>
            </Field>
          )}

          {type === 'activity' && (
            <LimitField value={draft.limit} fallback={6} min={1} max={20} onChange={(limit) => set({ limit })} />
          )}
        </div>

        <footer className="shrink-0 space-y-2 border-t border-neutral-800 px-5 py-3">
          {failed && <p className="text-[11px] text-red-400">{options ? t('editor.saveFailed') : t('editor.loadFailed')}</p>}
          {!complete && !failed && <p className="text-[11px] text-neutral-500">{t('editor.requiredHint')}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-200">
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!complete || pending || !options}
              className="bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500/85 disabled:opacity-40"
            >
              {pending ? t('editor.saving') : t('editor.save')}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}

function LimitField({ value, fallback, min, max, onChange }: { value?: number; fallback: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = useTranslations('Dashboard');
  return (
    <Field label={t('editor.limit')}>
      <input type="number" min={min} max={max} className={inputCls} value={value ?? fallback} onChange={(e) => onChange(clamp(e.target.value, min, max))} />
    </Field>
  );
}

function clamp(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{label}</p>
      {children}
    </div>
  );
}

function ColumnSelect({
  label,
  database,
  value,
  only,
  onChange,
}: {
  label: string;
  database: DashboardEditorDatabase;
  value?: string;
  only?: (column: DashboardEditorDatabase['columns'][number]) => boolean;
  onChange: (id: string) => void;
}) {
  const t = useTranslations('Dashboard');
  const columns = only ? database.columns.filter(only) : database.columns;
  return (
    <Field label={label}>
      <select className={selectCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('editor.chooseColumn')}</option>
        {columns.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </Field>
  );
}

function FiltersEditor({
  database,
  filters,
  onChange,
}: {
  database: DashboardEditorDatabase;
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}) {
  const t = useTranslations('Dashboard');
  const tDb = useTranslations('Database');
  const update = (i: number, patch: Partial<Filter>) => onChange(filters.map((f, k) => (k === i ? { ...f, ...patch } : f)));

  return (
    <Field label={tDb('filters')}>
      <div className="space-y-2 pt-1">
        {filters.map((filter, i) => {
          const column = database.columns.find((c) => c.id === filter.columnId);
          const needsValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty';
          const pickOption = column && SELECT_TYPES.has(column.type) && column.options.length > 0 && !String(filter.value ?? '').startsWith('[');
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-1">
                <select className={selectCls} value={filter.columnId} onChange={(e) => update(i, { columnId: e.target.value, value: '' })}>
                  <option value="">{t('editor.chooseColumn')}</option>
                  {database.columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select className={selectCls} value={filter.operator} onChange={(e) => update(i, { operator: e.target.value })}>
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>{tDb(OPERATOR_LABELS[op])}</option>
                  ))}
                </select>
                {needsValue && (
                  <div className="col-span-2">
                    {pickOption ? (
                      <select className={selectCls} value={filter.value ?? ''} onChange={(e) => update(i, { value: e.target.value })}>
                        <option value="">{t('editor.chooseValue')}</option>
                        {column.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input className={inputCls} placeholder={tDb('filterValue')} value={filter.value ?? ''} onChange={(e) => update(i, { value: e.target.value })} />
                    )}
                  </div>
                )}
              </div>
              <RemoveButton label={t('editor.remove')} onClick={() => onChange(filters.filter((_, k) => k !== i))} />
            </div>
          );
        })}
        {filters.length < 8 && (
          <AddButton label={tDb('addFilter')} onClick={() => onChange([...filters, { columnId: '', operator: 'equals', value: '' }])} />
        )}
      </div>
    </Field>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[11px] text-neutral-500 transition-colors hover:text-neutral-200">
      <Plus size={12} />
      {label}
    </button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="mt-1 p-0.5 text-neutral-600 transition-colors hover:text-neutral-200">
      <X size={13} />
    </button>
  );
}
