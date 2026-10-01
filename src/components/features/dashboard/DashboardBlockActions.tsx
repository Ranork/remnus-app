'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/features/ConfirmDialog';
import { Tooltip } from '@/components/ui/tooltip';
import { deleteDashboardBlock, moveDashboardBlock } from '@/lib/actions/dashboard';
import DashboardBlockEditor from './DashboardBlockEditor';

/**
 * Per-block controls: edit settings, move up or down, remove. Adding a block
 * lives in `DashboardAddBlock`.
 *
 * Every operation addresses the block by its id, never by position, so two
 * people reordering at once can't swap the wrong pair.
 */
export default function DashboardBlockActions({
  itemId,
  blockId,
  block,
  canMoveUp,
  canMoveDown,
}: {
  itemId: string;
  blockId: string;
  /** The readable block, for the editor. Absent for a block that could not be read — it can only be removed. */
  block?: Record<string, unknown>;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const t = useTranslations('Dashboard');
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const buttonClass =
    'flex size-6 cursor-pointer items-center justify-center rounded text-fg-3 transition-colors hover:bg-hover hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-3';

  return (
    <>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/block:opacity-100">
        {block && (
          <Tooltip content={t('editBlock')}>
            <button type="button" className={buttonClass} aria-label={t('editBlock')} disabled={pending} onClick={() => setEditing(true)}>
              <SlidersHorizontal size={14} />
            </button>
          </Tooltip>
        )}
        <Tooltip content={t('moveUp')}>
          <button
            type="button"
            className={buttonClass}
            aria-label={t('moveUp')}
            disabled={!canMoveUp || pending}
            onClick={() => run(() => moveDashboardBlock(itemId, blockId, 'up'))}
          >
            <ChevronUp size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('moveDown')}>
          <button
            type="button"
            className={buttonClass}
            aria-label={t('moveDown')}
            disabled={!canMoveDown || pending}
            onClick={() => run(() => moveDashboardBlock(itemId, blockId, 'down'))}
          >
            <ChevronDown size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('removeBlock')}>
          <button
            type="button"
            className={`${buttonClass} hover:text-red-400`}
            aria-label={t('removeBlock')}
            disabled={pending}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      {editing && block && <DashboardBlockEditor itemId={itemId} block={block} onClose={() => setEditing(false)} />}

      {confirming && (
        <ConfirmDialog
          title={t('removeBlockConfirmTitle')}
          description={t('removeBlockConfirmBody')}
          confirmLabel={t('removeBlock')}
          cancelLabel={t('cancel')}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            // Stays open with a spinner until the block is gone and the page refreshed.
            await deleteDashboardBlock(itemId, blockId);
            router.refresh();
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}
