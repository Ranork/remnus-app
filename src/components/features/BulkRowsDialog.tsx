'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    <>
      <div onClick={onClose} className="fixed inset-0 z-300 bg-black/60" />
      <div className="fixed z-300 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl max-h-[85vh] bg-neutral-850 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 shrink-0">
          <p className="text-sm font-semibold text-neutral-100">{t('bulkImport.title')}</p>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1 rounded cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'committing' && (
            <div className="flex flex-col items-center gap-2 py-10 text-neutral-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">{t('bulkImport.committing')}</span>
            </div>
          )}

          {step === 'done' && summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-400" />
                <p className="text-sm font-semibold text-green-300">
                  {summary.mode === 'add'
                    ? t('bulkImport.summaryCreated', { count: summary.created ?? 0 })
                    : t('bulkImport.summaryUpdated', { count: summary.updated ?? 0 })}
                </p>
              </div>
              {summary.mode === 'update' && (summary.unmatched ?? 0) > 0 && (
                <p className="text-xs text-amber-400">{t('bulkImport.summaryUnmatched', { count: summary.unmatched ?? 0 })}</p>
              )}
              {summary.errors > 0 && (
                <p className="text-xs text-red-400">{t('bulkImport.summaryErrors', { count: summary.errors })}</p>
              )}
              {summary.addedOptions.length > 0 && (
                <div className="text-xs text-neutral-400">
                  <p className="font-medium text-neutral-300 mb-1">{t('bulkImport.summaryNewOptions')}</p>
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
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('add')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    mode === 'add' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {t('bulkImport.modeAdd')}
                </button>
                <button
                  onClick={() => setMode('update')}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    mode === 'update' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  {t('bulkImport.modeUpdate')}
                </button>
              </div>

              {mode === 'update' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400 shrink-0">{t('bulkImport.matchColumn')}</label>
                  <select
                    value={matchColumnId}
                    onChange={(e) => setMatchColumnId(e.target.value)}
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-neutral-200"
                  >
                    {matchableColumns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-neutral-400 mb-1 block">{t('bulkImport.textareaLabel')}</label>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={t('bulkImport.textareaPlaceholder')}
                  rows={8}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono resize-y focus:outline-none focus:border-blue-500/50"
                />
                {!raw.trim() && (
                  <>
                    <p className="text-[11px] text-neutral-600 mt-1">{t('bulkImport.emptyInput')}</p>
                    {!hasContentColumn && (
                      <p className="text-[11px] text-neutral-600 mt-1">{t('bulkImport.contentColumn')}</p>
                    )}
                  </>
                )}
              </div>

              {commitError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">{commitError}</p>
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
                  <p className="text-xs font-semibold text-neutral-300">{t('bulkImport.previewRowsSummary', { count: parsed.rows.length })}</p>
                  {contentHeader && (
                    <p className="text-[11px] text-neutral-400">{t('bulkImport.contentColumn')}</p>
                  )}
                  {ignoredHeaders.length > 0 && (
                    <p className="text-[11px] text-neutral-500">
                      {ignoredHeaders.join(', ')} — {t('bulkImport.ignoredColumn')}
                    </p>
                  )}
                  <div className="border border-neutral-800 rounded overflow-x-auto max-h-48">
                    <table className="w-full text-[11px]">
                      <thead className="bg-neutral-900 sticky top-0">
                        <tr>
                          {matchedHeaders.map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 font-medium text-neutral-400 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.slice(0, PREVIEW_ROW_LIMIT).map((row, i) => (
                          <tr key={i} className="border-t border-neutral-800/60">
                            {matchedHeaders.map((h) => (
                              <td key={h} className="px-2 py-1.5 text-neutral-300 whitespace-nowrap max-w-[180px] truncate">{row[h]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsed.rows.length > PREVIEW_ROW_LIMIT && (
                    <p className="text-[11px] text-neutral-600">+{parsed.rows.length - PREVIEW_ROW_LIMIT}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-neutral-800 shrink-0">
          {step === 'done' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-700 hover:bg-neutral-600 rounded-lg transition-colors cursor-pointer"
            >
              {t('bulkImport.close')}
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                {t('bulkImport.cancel')}
              </button>
              <button
                onClick={handleCommit}
                disabled={!canCommit || step === 'committing'}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
              >
                {mode === 'add'
                  ? t('bulkImport.confirmAdd', { count: parsed.rows.length })
                  : t('bulkImport.confirmUpdate', { count: parsed.rows.length })}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
