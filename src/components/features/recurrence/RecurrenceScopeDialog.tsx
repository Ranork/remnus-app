'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import type { RecurrenceScope } from '@/lib/services/recurrence';

// The "this / this and following / all" question, shared by deleting a
// recurring card and by changing its rhythm.
//
// The reason this is a dedicated component rather than a `ConfirmDialog` with
// three buttons: the honest answer to "what will this do?" depends on the scope
// AND on how many of the affected cards already have content in them, so the
// impact line has to update live as the user moves between the options.

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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-300 bg-black/60" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed z-300 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-sm bg-neutral-850 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      >
        <div>
          <p className="m-0 text-sm font-semibold text-neutral-100 mb-1.5">
            {mode === 'delete' ? t('scopeDeleteTitle') : t('scopeEditTitle')}
          </p>
          <p className="m-0 text-xs text-neutral-400 leading-relaxed">
            {mode === 'delete' ? t('scopeDeleteHint') : t('scopeEditHint')}
          </p>
        </div>

        <div className="flex flex-col gap-0.5">
          {scopes.map((id) => (
            <label
              key={id}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors ${
                scope === id ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800/50'
              }`}
            >
              <input
                type="radio"
                name="recurrence-scope"
                checked={scope === id}
                onChange={() => { setScope(id); setIncludeDirty(false); }}
                className="accent-blue-500"
              />
              <span className="text-xs">
                {t(mode === 'delete' ? `scopeDelete_${id}` : `scopeEdit_${id}`)}
              </span>
            </label>
          ))}
        </div>

        {/* Live impact — never ask someone to confirm a number they can't see. */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/30 px-3.5 py-2.5">
          <p className="m-0 text-[11px] text-neutral-300">
            {current === undefined
              ? t('scopeImpactLoading')
              : t(mode === 'delete' ? 'scopeImpactDelete' : 'scopeImpactEdit', { count: current.affected })}
          </p>

          {hasDirty && (
            <>
              <p className="m-0 mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-400/90 leading-snug">
                <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                <span>{t('scopeDirtyNote', { count: current!.dirty })}</span>
              </p>
              {mode === 'delete' && (
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
            </>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={() => onConfirm(scope, includeDirty)}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors ${
              mode === 'delete' ? 'bg-red-500/80 hover:bg-red-500' : 'bg-blue-500 hover:bg-blue-400'
            }`}
          >
            {mode === 'delete' ? t('scopeConfirmDelete') : t('scopeConfirmEdit')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
