'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FolderInput, Trash2, X } from 'lucide-react';
import { deletePages, moveRowsToDatabase, type BulkRowResult } from '@/lib/actions/page';
import { getWorkspaceItems } from '@/lib/actions/workspace';
import { BULK_ROWS_PER_CALL } from '@/lib/constants/bulkRows';
import { reportClientError } from '@/lib/reportClientError';
import { ConfirmDialog } from './ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

interface RowSelectionBarProps {
  databaseId: string;
  workspaceId: string;
  /** The rows picked in the table / board. */
  selectedIds: string[];
  /** How many rows "Select all" would pick. */
  selectableCount: number;
  onSelectAll: () => void;
  /** Leave selection mode. */
  onDone: () => void;
  /** Rows that are gone from this database (deleted or moved) — the view drops them. */
  onRemoved: (ids: string[]) => void;
}

type TargetDatabase = { databaseId: string; title: string };

/** Sends `ids` through `run` in chunks the server accepts, collecting every row's result. */
async function inChunks(ids: string[], run: (chunk: string[]) => Promise<BulkRowResult[] | null>): Promise<BulkRowResult[] | null> {
  const all: BulkRowResult[] = [];
  for (let i = 0; i < ids.length; i += BULK_ROWS_PER_CALL) {
    const part = await run(ids.slice(i, i + BULK_ROWS_PER_CALL));
    if (part === null) return all.length > 0 ? all : null; // refused (columns do not match) before anything moved
    all.push(...part);
  }
  return all;
}

/**
 * The bar that appears while rows are being picked in a table or board: delete them (to the
 * Trash) or move them to another database. Every row reports its own result, so the view
 * only drops the rows that really left and the rest stay selected for another try.
 */
export default function RowSelectionBar({ databaseId, workspaceId, selectedIds, selectableCount, onSelectAll, onDone, onRemoved }: RowSelectionBarProps) {
  const t = useTranslations('Database');
  const count = selectedIds.length;
  const [dialog, setDialog] = useState<'delete' | 'move' | null>(null);

  const report = (results: BulkRowResult[], doneTitle: string) => {
    const ok = results.filter((r) => r.ok).map((r) => r.id);
    const failed = results.length - ok.length;
    if (ok.length > 0) onRemoved(ok);
    if (failed > 0) {
      toast({ title: t('bulkPartialFailed', { failed, total: results.length }), tone: 'error' });
    } else {
      toast({ title: doneTitle, tone: 'success' });
    }
  };

  const doDelete = async () => {
    try {
      const results = await inChunks(selectedIds, (chunk) => deletePages(chunk, databaseId));
      if (results) report(results, t('bulkDeleted', { count: results.length }));
    } catch (err) {
      reportClientError(err, { source: 'bulk-delete-rows', databaseId });
      toast({ title: t('bulkFailed'), tone: 'error' });
    }
    setDialog(null);
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('selectRows')}
        className="fixed bottom-20 left-1/2 z-[130] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-surface bg-float px-2 py-1.5 shadow-float"
      >
        <span className="px-2 text-ui font-medium whitespace-nowrap text-fg" aria-live="polite">
          {t('selectedCount', { count })}
        </span>
        {count < selectableCount && (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>{t('selectAll')}</Button>
        )}
        {/* On a phone only the icons show, so the name goes on the button itself. */}
        <Button variant="secondary" size="sm" onClick={() => setDialog('move')} disabled={count === 0} aria-label={t('bulkMove')}>
          <FolderInput /> <span className="hidden sm:inline">{t('bulkMove')}</span>
        </Button>
        <Button variant="danger" size="sm" onClick={() => setDialog('delete')} disabled={count === 0} aria-label={t('bulkDelete')}>
          <Trash2 /> <span className="hidden sm:inline">{t('bulkDelete')}</span>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDone} aria-label={t('selectDone')}>
          <X />
        </Button>
      </div>

      {dialog === 'delete' && (
        <ConfirmDialog
          title={t('bulkDeleteTitle', { count })}
          description={t('bulkDeleteBody')}
          confirmLabel={t('bulkDelete')}
          cancelLabel={t('selectCancel')}
          onConfirm={doDelete}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'move' && (
        <MoveRowsDialog
          databaseId={databaseId}
          workspaceId={workspaceId}
          selectedIds={selectedIds}
          onClose={() => setDialog(null)}
          onMoved={(results, databaseTitle) => {
            setDialog(null);
            report(results, t('bulkMoved', { count: results.length, database: databaseTitle }));
          }}
        />
      )}
    </>
  );
}

function MoveRowsDialog({ databaseId, workspaceId, selectedIds, onClose, onMoved }: {
  databaseId: string;
  workspaceId: string;
  selectedIds: string[];
  onClose: () => void;
  onMoved: (results: BulkRowResult[], databaseTitle: string) => void;
}) {
  const t = useTranslations('Database');
  const [targets, setTargets] = useState<TargetDatabase[] | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  // Read when the dialog opens, never on mount (AGENTS.md → App load and the client).
  useEffect(() => {
    let active = true;
    getWorkspaceItems(workspaceId)
      .then((items) => {
        if (!active) return;
        setTargets(
          items
            .filter((i) => i.type === 'database' && i.databaseId && i.databaseId !== databaseId)
            .map((i) => ({ databaseId: i.databaseId!, title: i.title })),
        );
      })
      .catch(() => { if (active) setTargets([]); });
    return () => { active = false; };
  }, [workspaceId, databaseId]);

  const submit = async () => {
    if (!target || pending) return;
    setPending(true);
    setError('');
    try {
      let mismatch: string[] | null = null;
      const results = await inChunks(selectedIds, async (chunk) => {
        const res = await moveRowsToDatabase(chunk, databaseId, target);
        if (res.mismatch) { mismatch = res.mismatch; return null; }
        return res.results;
      });
      if (mismatch) {
        setError(t('bulkMoveMismatch', { columns: (mismatch as string[]).join(', ') }));
        setPending(false);
        return;
      }
      onMoved(results ?? [], targets?.find((x) => x.databaseId === target)?.title ?? '');
    } catch (err) {
      reportClientError(err, { source: 'bulk-move-rows', databaseId });
      setError(t('bulkFailed'));
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('bulkMoveTitle', { count: selectedIds.length })}</DialogTitle>
          <DialogDescription>{t('bulkMoveHint')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          {targets !== null && targets.length === 0 ? (
            <p className="text-ui text-fg-3">{t('bulkMoveNoTargets')}</p>
          ) : (
            <SimpleSelect
              value={target}
              onValueChange={(v) => { setTarget(v); setError(''); }}
              options={(targets ?? []).map((x) => ({ value: x.databaseId, label: x.title }))}
              placeholder={t('bulkMoveTarget')}
              aria-label={t('bulkMoveTarget')}
              disabled={targets === null || pending}
            />
          )}
          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t('selectCancel')}</Button>
          <Button variant="primary" onClick={submit} loading={pending} disabled={!target}>{t('bulkMoveConfirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
