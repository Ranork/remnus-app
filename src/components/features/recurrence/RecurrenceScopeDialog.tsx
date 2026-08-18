'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Repeat, Trash2 } from 'lucide-react';
import type { RecurrenceScope } from '@/lib/services/recurrence';
import { OptionTile } from './parts';

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

interface RecurrenceScopeDialogProps {
  mode: 'delete' | 'edit';
  /** Which scopes to offer. A rule change has no meaningful "just this one". */
  scopes?: RecurrenceScope[];
  /** Impact per scope; undefined while it is still being fetched. */
  impact: Partial<Record<RecurrenceScope, ScopeImpact>>;
  onConfirm: (scope: RecurrenceScope, includeDirty: boolean) => void;
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const current = impact[scope];
  const hasDirty = (current?.dirty ?? 0) > 0;
  const isDelete = mode === 'delete';
  const Icon = isDelete ? Trash2 : Repeat;

  /** Each option's own count, so the choice is made with the number visible
   *  rather than after committing to it. */
  const subtitleFor = (id: RecurrenceScope): string | undefined => {
    const entry = impact[id];
    if (entry === undefined) return t('scopeImpactLoading');
    return t(isDelete ? 'scopeImpactDelete' : 'scopeImpactEdit', { count: entry.affected });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4 md:p-6"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-full sm:max-w-md max-h-full bg-neutral-850 border border-neutral-800 rounded-xl modal-shadow flex flex-col overflow-hidden animate-scale-in"
      >
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-800 shrink-0">
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
              isDelete ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'
            }`}
          >
            <Icon size={13} className={isDelete ? 'text-red-400' : 'text-blue-400'} />
          </div>
          <div className="min-w-0">
            <h2 className="m-0 text-sm font-semibold text-neutral-100 truncate">
              {isDelete ? t('scopeDeleteTitle') : t('scopeEditTitle')}
            </h2>
            <p className="m-0 text-[11px] text-neutral-500 truncate">
              {isDelete ? t('scopeDeleteHint') : t('scopeEditHint')}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {scopes.map((id) => (
              <OptionTile
                key={id}
                wide
                tone={isDelete ? 'red' : 'blue'}
                title={t(isDelete ? `scopeDelete_${id}` : `scopeEdit_${id}`)}
                subtitle={subtitleFor(id)}
                selected={scope === id}
                onSelect={() => { setScope(id); setIncludeDirty(false); }}
              />
            ))}
          </div>

          {/* Content protection. Only shown when there is actually something to
              protect, so the dialog stays quiet in the common case. */}
          {hasDirty && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5">
              <p className="m-0 flex items-start gap-1.5 text-[11px] text-amber-300/90 leading-snug">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>{t('scopeDirtyNote', { count: current!.dirty })}</span>
              </p>
              {isDelete && (
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDirty}
                    onChange={(e) => setIncludeDirty(e.target.checked)}
                    className="accent-red-500"
                  />
                  <span className="text-[11px] text-neutral-400">{t('scopeIncludeDirty')}</span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end px-5 py-3 border-t border-neutral-800 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-750 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(scope, includeDirty)}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
              isDelete ? 'bg-red-500/80 hover:bg-red-500' : 'bg-blue-500 hover:bg-blue-400'
            }`}
          >
            {isDelete ? t('scopeConfirmDelete') : t('scopeConfirmEdit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
