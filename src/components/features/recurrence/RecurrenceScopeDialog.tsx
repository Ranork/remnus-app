'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info } from 'lucide-react';
import type { RecurrenceScope } from '@/lib/services/recurrence';
import { OptionTile } from './parts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// The "this / this and following / all" question, shared by deleting a
// recurring card and by changing its rhythm.
//
// A dedicated component rather than a three-button ConfirmDialog because the
// honest answer to "what will this do?" depends on the scope AND on how many of
// the affected cards already have content — so each option carries its own live
// count, and the warning re-reads as the highlighted option changes.

export interface ScopeImpact {
  affected: number;
  dirty: number;
}

/** `remove` = "Kaldır tekrarı": stop repeating, but nothing is ever deleted —
 *  same three-question shape as delete/edit, just no dirty-content checkbox. */
type ScopeDialogMode = 'delete' | 'edit' | 'remove';

const COPY_KEY: Record<ScopeDialogMode, { title: string; hint: string; option: string; impact: string; confirm: string }> = {
  delete: { title: 'scopeDeleteTitle', hint: 'scopeDeleteHint', option: 'scopeDelete', impact: 'scopeImpactDelete', confirm: 'scopeConfirmDelete' },
  edit: { title: 'scopeEditTitle', hint: 'scopeEditHint', option: 'scopeEdit', impact: 'scopeImpactEdit', confirm: 'scopeConfirmEdit' },
  remove: { title: 'scopeRemoveTitle', hint: 'scopeRemoveHint', option: 'scopeRemove', impact: 'scopeImpactRemove', confirm: 'scopeConfirmRemove' },
};

interface RecurrenceScopeDialogProps {
  mode: ScopeDialogMode;
  /** Which scopes to offer. A rule change (or ending one) has no meaningful "just this one". */
  scopes?: RecurrenceScope[];
  /** Impact per scope; undefined while it is still being fetched. */
  impact: Partial<Record<RecurrenceScope, ScopeImpact>>;
  /** May return a promise: the confirm button then shows a spinner (and Cancel/Escape are
   *  held) until it settles. */
  onConfirm: (scope: RecurrenceScope, includeDirty: boolean) => void | Promise<unknown>;
  onCancel: () => void;
}

export default function RecurrenceScopeDialog({
  mode,
  scopes = ['this', 'thisAndFollowing', 'all'],
  impact,
  onConfirm,
  onCancel,
}: RecurrenceScopeDialogProps) {
  const t = useTranslations('Recurrence');
  const [scope, setScope] = useState<RecurrenceScope>(scopes[0]);
  const [includeDirty, setIncludeDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const current = impact[scope];
  // Remove ("Kaldır tekrarı") never deletes content, so there is nothing to
  // protect — the dirty-content note/checkbox only makes sense for delete/edit.
  const hasDirty = mode !== 'remove' && (current?.dirty ?? 0) > 0;
  const isDelete = mode === 'delete';
  const copy = COPY_KEY[mode];

  /** Each option's own count, so the choice is made with the number visible
   *  rather than after committing to it. */
  const subtitleFor = (id: RecurrenceScope): string | undefined => {
    const entry = impact[id];
    if (entry === undefined) return t('scopeImpactLoading');
    return t(copy.impact as 'scopeImpactDelete', { count: entry.affected });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
      <DialogContent size="md" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(copy.title as 'scopeDeleteTitle')}</DialogTitle>
          <DialogDescription className="text-xs">{t(copy.hint as 'scopeDeleteHint')}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {scopes.map((id) => (
              <OptionTile
                key={id}
                wide
                tone={isDelete ? 'red' : 'signal'}
                title={t(`${copy.option}_${id}` as 'scopeDelete_this')}
                subtitle={subtitleFor(id)}
                selected={scope === id}
                onSelect={() => { setScope(id); setIncludeDirty(false); }}
              />
            ))}
          </div>

          {/* Remove only stops the rhythm and unlinks — it never deletes a page.
              Point at the option that actually does, so "I removed repeat but
              the cards are still there" doesn't read as a bug. */}
          {mode === 'remove' && (
            <p className="m-0 flex items-start gap-1.5 text-xs text-fg-3 leading-snug">
              <Info size={14} className="shrink-0 mt-px" aria-hidden />
              <span>{t('scopeRemoveDeleteHint')}</span>
            </p>
          )}

          {/* Content protection. Only shown when there is actually something to
              protect, so the dialog stays quiet in the common case. */}
          {hasDirty && (
            <div className="rounded-control bg-raised px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
              <p className="m-0 flex items-start gap-1.5 text-xs text-fg-2 leading-snug">
                <AlertTriangle size={14} className="shrink-0 mt-px text-fg-3" aria-hidden />
                <span>{t('scopeDirtyNote', { count: current!.dirty })}</span>
              </p>
              {isDelete && (
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <Checkbox size="sm" checked={includeDirty} onCheckedChange={(next) => setIncludeDirty(next)} />
                  <span className="text-xs text-fg-2">{t('scopeIncludeDirty')}</span>
                </label>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant={isDelete ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await onConfirm(scope, includeDirty);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t(copy.confirm as 'scopeConfirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
