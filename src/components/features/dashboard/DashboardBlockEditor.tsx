'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { SimpleSelect, type SelectOption } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, Textarea } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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

const BLOCK_TYPES: DashboardBlockType[] = ['metric', 'chart', 'database_embed', 'list', 'text', 'links', 'activity', 'project', 'savings'];
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

/** A block-editor dropdown: full width, string values. */
function Sel({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: SelectOption[] }) {
  return <SimpleSelect value={value} onValueChange={onChange} options={options} className="w-full" />;
}

function emptyDraft(type: DashboardBlockType): Draft {
  switch (type) {
    case 'metric':
      return { type, source: { databaseId: '' }, aggregate: 'count' };
    case 'chart':
      return { type, source: { databaseId: '' }, variant: 'bar', groupBy: '', aggregate: 'count' };
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
    case 'project':
      return { type, summary: '' };
    case 'savings':
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
  if (out.type === 'project') {
    const stack = ((out.stack ?? []) as string[]).map((s) => s.trim()).filter(Boolean);
    if (stack.length) out.stack = stack;
    else delete out.stack;
  }
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
    case 'project':
      return !!String(d.summary ?? '').trim();
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
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isNew ? t('editor.addTitle') : t('editor.editTitle')}</SheetTitle>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {isNew && (
            <Field label={t('editor.type')}>
              {/* Block kinds as a 2-column picker: the chosen one lifted, like a selected tab. */}
              <div className="grid grid-cols-2 gap-1 rounded-control bg-raised p-1 shadow-[inset_0_0_0_1px_var(--color-line)]">
                {BLOCK_TYPES.map((option, i) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={option === type}
                    onClick={() => setDraft({ ...emptyDraft(option), ...(draft.title ? { title: draft.title } : {}) })}
                    // An odd last type spans the row.
                    className={`h-8 cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-2.5 text-left text-xs transition-colors ${i === BLOCK_TYPES.length - 1 && BLOCK_TYPES.length % 2 ? 'col-span-2 ' : ''}${
                      option === type ? 'bg-sheet font-medium text-fg shadow-lift' : 'text-fg-3 hover:bg-hover hover:text-fg'
                    }`}
                  >
                    {t(`blockTypes.${option}`)}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label={t('editor.title')}>
            <Input value={draft.title ?? ''} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
          </Field>

          <Field label={t('editor.width')}>
            <Sel
              value={draft.width ?? ''}
              onChange={(v) => set({ width: v || undefined })}
              options={[
                { value: '', label: t('editor.widthAuto') },
                { value: 'quarter', label: t('editor.widthQuarter') },
                { value: 'half', label: t('editor.widthHalf') },
                { value: 'full', label: t('editor.widthFull') },
              ]}
            />
          </Field>

          {!options && !failed && <p className="text-xs text-fg-3">{t('editor.loading')}</p>}

          {options && (SOURCE_TYPES.has(type) || type === 'database_embed') && (
            <Field label={`${t('editor.database')} *`}>
              <Sel
                value={databaseId}
                onChange={changeDatabase}
                options={[{ value: '', label: t('editor.chooseDatabase') }, ...options.databases.map((d) => ({ value: d.id, label: d.name }))]}
              />
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
                <Sel
                  value={draft.aggregate ?? 'count'}
                  onChange={(aggregate) => set({ aggregate })}
                  options={(['count', 'sum', 'avg', 'min', 'max'] as const).map((a) => ({ value: a, label: t(`editor.aggregates.${a}`) }))}
                />
              </Field>
              {draft.aggregate && draft.aggregate !== 'count' && (
                <ColumnSelect label={`${t('editor.column')} *`} database={database} value={draft.columnId} only={(c) => c.type === 'number'} onChange={(columnId) => set({ columnId })} />
              )}
              <Field label={t('editor.unit')}>
                <Input value={draft.unit ?? ''} maxLength={16} onChange={(e) => set({ unit: e.target.value })} />
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-ui text-fg-2">
                <Checkbox
                  checked={!!draft.trend}
                  onCheckedChange={(checked) => {
                    const dateCol = database.columns.find((c) => DATE_TYPES.has(c.type));
                    set({ trend: checked ? { columnId: dateCol?.id ?? '', days: 7 } : undefined });
                  }}
                />
                {t('editor.trend')}
              </label>
              {draft.trend && (
                <div className="grid grid-cols-2 gap-3">
                  <ColumnSelect label={t('editor.dateColumn')} database={database} value={draft.trend.columnId} only={(c) => DATE_TYPES.has(c.type)} onChange={(columnId) => set({ trend: { ...draft.trend, columnId } })} />
                  <Field label={t('editor.trendDays')}>
                    <Input type="number" min={1} max={365} value={draft.trend.days} onChange={(e) => set({ trend: { ...draft.trend, days: clamp(e.target.value, 1, 365) } })} />
                  </Field>
                </div>
              )}
            </>
          )}

          {options && type === 'chart' && database && (
            <>
              <Field label={t('editor.variant')}>
                <Sel
                  value={draft.variant}
                  onChange={(variant) => set({ variant })}
                  options={(['stack', 'bar', 'donut', 'line'] as const).map((v) => ({ value: v, label: t(`editor.variants.${v}`) }))}
                />
              </Field>
              <ColumnSelect label={`${tDb('groupBy')} *`} database={database} value={draft.groupBy} onChange={(groupBy) => set({ groupBy })} />
              {DATE_TYPES.has(database.columns.find((c) => c.id === draft.groupBy)?.type ?? '') && (
                <Field label={t('editor.bucket')}>
                  <Sel
                    value={draft.bucket ?? ''}
                    onChange={(v) => set({ bucket: v || undefined })}
                    options={[
                      { value: '', label: t('editor.buckets.day') },
                      { value: 'week', label: t('editor.buckets.week') },
                      { value: 'month', label: t('editor.buckets.month') },
                    ]}
                  />
                </Field>
              )}
              <Field label={t('editor.aggregate')}>
                <Sel
                  value={draft.aggregate ?? 'count'}
                  onChange={(aggregate) => set({ aggregate })}
                  options={[
                    { value: 'count', label: t('editor.aggregates.count') },
                    { value: 'sum', label: t('editor.aggregates.sum') },
                  ]}
                />
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
                  <Sel
                    value={draft.sort?.columnId ?? ''}
                    onChange={(columnId) => set({ sort: columnId ? { columnId, direction: draft.sort?.direction ?? 'asc' } : undefined })}
                    options={[{ value: '', label: t('editor.sortNone') }, ...database.columns.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                </Field>
                {draft.sort && (
                  <Field label={t('editor.direction')}>
                    <Sel
                      value={draft.sort.direction}
                      onChange={(direction) => set({ sort: { ...draft.sort, direction } })}
                      options={[
                        { value: 'asc', label: tDb('sortAscending') },
                        { value: 'desc', label: tDb('sortDescending') },
                      ]}
                    />
                  </Field>
                )}
              </div>
              <Field label={t('editor.showColumns')}>
                <div className="space-y-1 pt-1">
                  {database.columns.filter((c) => c.id !== 'title').map((c) => {
                    const chosen: string[] = draft.showColumns ?? [];
                    const on = chosen.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-ui text-fg-2">
                        <Checkbox
                          size="sm"
                          checked={on}
                          disabled={!on && chosen.length >= 3}
                          onCheckedChange={() => set({ showColumns: on ? chosen.filter((id) => id !== c.id) : [...chosen, c.id] })}
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
                <Sel
                  value={draft.viewId ?? ''}
                  onChange={(v) => set({ viewId: v || undefined })}
                  options={[{ value: '', label: t('editor.firstView') }, ...database.views.map((v) => ({ value: v.id, label: v.name }))]}
                />
              </Field>
              <LimitField value={draft.limit} fallback={10} min={1} max={50} onChange={(limit) => set({ limit })} />
            </>
          )}

          {type === 'text' && (
            <>
              <Field label={`${t('editor.markdown')} *`}>
                <Textarea
                  className="min-h-36 font-mono text-xs"
                  value={draft.markdown ?? ''}
                  maxLength={2000}
                  onChange={(e) => set({ markdown: e.target.value })}
                />
              </Field>
              <Field label={t('editor.tone')}>
                <Sel
                  value={draft.tone ?? 'default'}
                  onChange={(tone) => set({ tone: tone === 'default' ? undefined : tone })}
                  options={(['default', 'info', 'warning'] as const).map((tone) => ({ value: tone, label: t(`editor.tones.${tone}`) }))}
                />
              </Field>
            </>
          )}

          {options && type === 'links' && (
            <Field label={`${t('editor.links')} *`}>
              <div className="space-y-2 pt-1">
                {(draft.items as { itemId: string; label?: string }[]).map((link, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Sel
                        value={link.itemId}
                        onChange={(itemId) => set({ items: draft.items.map((l: object, k: number) => (k === i ? { ...l, itemId } : l)) })}
                        options={[{ value: '', label: t('editor.chooseItem') }, ...options.items.map((item) => ({ value: item.id, label: item.title || t('untitled') }))]}
                      />
                      <Input
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

          {type === 'project' && (
            <>
              <Field label={`${t('editor.summary')} *`}>
                <Textarea
                  className="min-h-22"
                  value={draft.summary ?? ''}
                  maxLength={280}
                  onChange={(e) => set({ summary: e.target.value })}
                />
              </Field>
              <Field label={t('editor.stack')}>
                <Input
                  placeholder={t('editor.stackPlaceholder')}
                  // Kept as typed while editing; split into chips (≤ 8 × 24 chars) on save.
                  value={Array.isArray(draft.stack) ? draft.stack.join(', ') : ''}
                  onChange={(e) => set({ stack: e.target.value.split(',').map((s) => s.trimStart().slice(0, 24)).slice(0, 8) })}
                />
              </Field>
            </>
          )}
        </SheetBody>

        <SheetFooter className="justify-between">
          <p className={`min-w-0 flex-1 text-xs ${failed ? 'text-red-400' : 'text-fg-3'}`}>
            {failed ? (options ? t('editor.saveFailed') : t('editor.loadFailed')) : !complete ? t('editor.requiredHint') : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={save} disabled={!complete || !options} loading={pending}>
              {t('editor.save')}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function LimitField({ value, fallback, min, max, onChange }: { value?: number; fallback: number; min: number; max: number; onChange: (v: number) => void }) {
  const t = useTranslations('Dashboard');
  return (
    <Field label={t('editor.limit')}>
      <Input type="number" min={min} max={max} value={value ?? fallback} onChange={(e) => onChange(clamp(e.target.value, min, max))} />
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
      <p className="mb-1.5 text-xs font-medium text-fg-3">{label}</p>
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
      <Sel
        value={value ?? ''}
        onChange={onChange}
        options={[{ value: '', label: t('editor.chooseColumn') }, ...columns.map((c) => ({ value: c.id, label: c.name }))]}
      />
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
                <Sel
                  value={filter.columnId}
                  onChange={(columnId) => update(i, { columnId, value: '' })}
                  options={[{ value: '', label: t('editor.chooseColumn') }, ...database.columns.map((c) => ({ value: c.id, label: c.name }))]}
                />
                <Sel
                  value={filter.operator}
                  onChange={(operator) => update(i, { operator })}
                  options={OPERATORS.map((op) => ({ value: op, label: tDb(OPERATOR_LABELS[op]) }))}
                />
                {needsValue && (
                  <div className="col-span-2">
                    {pickOption ? (
                      <Sel
                        value={filter.value ?? ''}
                        onChange={(v) => update(i, { value: v })}
                        options={[{ value: '', label: t('editor.chooseValue') }, ...column.options.map((o) => ({ value: o, label: o }))]}
                      />
                    ) : (
                      <Input size="sm" placeholder={tDb('filterValue')} value={filter.value ?? ''} onChange={(e) => update(i, { value: e.target.value })} />
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
    <Button variant="ghost" size="xs" onClick={onClick} className="-ml-2">
      <Plus />
      {label}
    </Button>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" onClick={onClick} title={label} aria-label={label} className="shrink-0 hover:text-red-400">
      <X />
    </Button>
  );
}
