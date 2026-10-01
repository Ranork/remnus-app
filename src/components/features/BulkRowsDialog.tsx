'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SimpleSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { parseTabularPaste } from '@/lib/utils/parseTabularPaste';
import { CONTENT_HEADER } from '@/lib/utils/propertyCoercion';
import { bulkCreatePages, bulkUpdatePagesByMatch } from '@/lib/actions/page';

interface SchemaColumn {
  id: string;
  name: string;
  type: string;
}

interface BulkRowsDialogProps {
  databaseId: string;
  schema: SchemaColumn[];
  onClose: () => void;
}

type Mode = 'add' | 'update';
type Step = 'input' | 'committing' | 'done';

interface CommitSummary {
  mode: Mode;
  created?: number;
  updated?: number;
  unmatched?: number;
  errors: number;
  addedOptions: { column: string; values: string[] }[];
}

const PREVIEW_ROW_LIMIT = 20;
const MAX_BULK_ROWS = 500;

function isWritableColumn(col: SchemaColumn): boolean {
  return col.type !== 'user' && col.type !== 'multi_user' && col.type !== 'id';
}

// The row's real primary key can't be written via paste, but — unlike user/multi_user —
// it's still the single most precise way to target an existing row, so it belongs in the
// match-column picker even though it's excluded from `isWritableColumn`.
function isMatchableColumn(col: SchemaColumn): boolean {
  return col.type !== 'user' && col.type !== 'multi_user';
}

export function BulkRowsDialog({ databaseId, schema, onClose }: BulkRowsDialogProps) {
  const t = useTranslations('Database');
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('add');
  const writableColumns = useMemo(() => schema.filter(isWritableColumn), [schema]);
  const matchableColumns = useMemo(() => schema.filter(isMatchableColumn), [schema]);
  const [matchColumnId, setMatchColumnId] = useState<string>(() => (schema.some((c) => c.id === 'title') ? 'title' : matchableColumns[0]?.id ?? ''));
  const [raw, setRaw] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [commitError, setCommitError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommitSummary | null>(null);

  const parsed = useMemo<{ headers: string[]; rows: Record<string, string>[]; error: boolean }>(() => {
    if (!raw.trim()) return { headers: [], rows: [], error: false };
    try {
      const { headers, rows } = parseTabularPaste(raw);
      return { headers, rows, error: false };
    } catch {
      return { headers: [], rows: [], error: true };
    }
  }, [raw]);

  // The active match column (e.g. "ID") isn't writable, but while it's selected it's
  // clearly being put to use — treat it as "matched" in the preview instead of ignored.
  const activeMatchCol = mode === 'update' ? matchableColumns.find((c) => c.id === matchColumnId) : undefined;
  const nameToCol = useMemo(() => {
    const map = new Map(writableColumns.map((c) => [c.name.trim().toLowerCase(), c]));
    if (activeMatchCol) map.set(activeMatchCol.name.trim().toLowerCase(), activeMatchCol);
    return map;
  }, [writableColumns, activeMatchCol]);
  const matchedHeaders = parsed.headers.filter((h) => nameToCol.has(h.trim().toLowerCase()));

  // `content` isn't a property — it writes the row's page body. A database that
  // actually has a column by that name keeps the column (see extractRowContent),
  // so only treat the header as reserved when no such column exists.
  const hasContentColumn = useMemo(
    () => schema.some((c) => c.name.trim().toLowerCase() === CONTENT_HEADER),
    [schema],
  );
  const contentHeader = hasContentColumn
    ? undefined
    : parsed.headers.find((h) => h.trim().toLowerCase() === CONTENT_HEADER);

  const ignoredHeaders = parsed.headers.filter(
    (h) => !nameToCol.has(h.trim().toLowerCase()) && h !== contentHeader,
  );

  const tooManyRows = parsed.rows.length > MAX_BULK_ROWS;
  const canCommit = parsed.rows.length > 0 && !parsed.error && !tooManyRows;

  async function handleCommit() {
    if (!canCommit) return;
    setStep('committing');
    setCommitError(null);
    try {
      if (mode === 'add') {
        const result = await bulkCreatePages(databaseId, parsed.rows);
        setSummary({ mode, created: result.created, errors: result.errors.length, addedOptions: result.addedOptions });
      } else {
        const result = await bulkUpdatePagesByMatch(databaseId, matchColumnId, parsed.rows);
        setSummary({ mode, updated: result.updated, unmatched: result.unmatched.length, errors: result.errors.length, addedOptions: result.addedOptions });
      }
      setStep('done');
      router.refresh();
    } catch (err: any) {
      setCommitError(err?.message ?? 'Failed');
      setStep('input');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && step !== 'committing') onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('bulkImport.title')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {step === 'committing' && (
            <div className="flex flex-col items-center gap-2 py-10 text-fg-3">
              <Loader2 size={20} className="animate-spin" aria-hidden />
              <span className="text-sm">{t('bulkImport.committing')}</span>
            </div>
          )}

          {step === 'done' && summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <p className="text-sm font-semibold text-fg">
                  {summary.mode === 'add'
                    ? t('bulkImport.summaryCreated', { count: summary.created ?? 0 })
                    : t('bulkImport.summaryUpdated', { count: summary.updated ?? 0 })}
                </p>
              </div>
              {summary.mode === 'update' && (summary.unmatched ?? 0) > 0 && (
                <p className="text-xs text-fg-2">{t('bulkImport.summaryUnmatched', { count: summary.unmatched ?? 0 })}</p>
              )}
              {summary.errors > 0 && (
                <p className="text-xs text-red-400">{t('bulkImport.summaryErrors', { count: summary.errors })}</p>
              )}
              {summary.addedOptions.length > 0 && (
                <div className="text-xs text-fg-3">
                  <p className="font-medium text-fg-2 mb-1">{t('bulkImport.summaryNewOptions')}</p>
                  <ul className="space-y-0.5">
                    {summary.addedOptions.map((o) => (
                      <li key={o.column}>{o.column}: {o.values.join(', ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'input' && (
            <>
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} variant="segmented">
                <TabsList>
                  <TabsTab value="add">{t('bulkImport.modeAdd')}</TabsTab>
                  <TabsTab value="update">{t('bulkImport.modeUpdate')}</TabsTab>
                </TabsList>
              </Tabs>

              {mode === 'update' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-fg-3 shrink-0">{t('bulkImport.matchColumn')}</label>
                  <SimpleSelect
                    value={matchColumnId}
                    onValueChange={setMatchColumnId}
                    options={matchableColumns.map((c) => ({ value: c.id, label: c.name }))}
                    aria-label={t('bulkImport.matchColumn')}
                    className="flex-1"
                  />
                </div>
              )}

              <div>
                <label htmlFor="bulk-rows-paste" className="text-xs text-fg-3 mb-1.5 block">{t('bulkImport.textareaLabel')}</label>
                <Textarea
                  id="bulk-rows-paste"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={t('bulkImport.textareaPlaceholder')}
                  rows={8}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                {!raw.trim() && (
                  <>
                    <p className="text-xs text-fg-3 mt-1.5">{t('bulkImport.emptyInput')}</p>
                    {!hasContentColumn && (
                      <p className="text-xs text-fg-3 mt-1">{t('bulkImport.contentColumn')}</p>
                    )}
                  </>
                )}
              </div>

              {commitError && (
                <div className="flex items-start gap-2 rounded-control bg-red-500/10 px-3 py-2">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-400">{commitError}</p>
                </div>
              )}

              {parsed.error && (
                <p className="text-xs text-red-400">{t('bulkImport.parseError')}</p>
              )}

              {tooManyRows && (
                <p className="text-xs text-red-400">{t('bulkImport.tooManyRows', { max: MAX_BULK_ROWS })}</p>
              )}

              {!parsed.error && parsed.rows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-fg-2">{t('bulkImport.previewRowsSummary', { count: parsed.rows.length })}</p>
                  {contentHeader && (
                    <p className="text-xs text-fg-3">{t('bulkImport.contentColumn')}</p>
                  )}
                  {ignoredHeaders.length > 0 && (
                    <p className="text-xs text-fg-3">
                      {t('bulkImport.ignoredColumns', { columns: ignoredHeaders.join(', ') })}
                    </p>
                  )}
                  <div className="rounded-control border border-line overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead className="bg-raised sticky top-0">
                        <tr>
                          {matchedHeaders.map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 font-medium text-fg-3 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                          <tr key={i} className="border-t border-line">
                            {matchedHeaders.map((h) => (
                              <td key={h} className="px-2 py-1.5 text-fg-2 whitespace-nowrap max-w-45 truncate">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > PREVIEW_ROW_LIMIT && (
                    <p className="text-xs text-fg-3">{t('bulkImport.moreRows', { count: parsed.rows.length - PREVIEW_ROW_LIMIT })}</p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 'done' ? (
            <Button variant="primary" onClick={onClose}>
              {t('bulkImport.close')}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={step === 'committing'}>
                {t('bulkImport.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleCommit}
                disabled={!canCommit}
                loading={step === 'committing'}
              >
                {mode === 'add'
                  ? t('bulkImport.confirmAdd', { count: parsed.rows.length })
                  : t('bulkImport.confirmUpdate', { count: parsed.rows.length })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
