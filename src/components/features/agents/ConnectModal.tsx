'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X, Link2 } from 'lucide-react';
import ConnectFlow, { type MintTarget } from './ConnectFlow';

interface Props {
  mcpUrl: string;
  /** Workspaces the user can mint a PAT in. Empty = OAuth-only (token mode unavailable). */
  mintTargets?: MintTarget[];
  onClose: () => void;
  /** Funnel attribution for where the connect flow was opened from. */
  source?: string;
}

/**
 * Standalone full-screen modal wrapping {@link ConnectFlow}.
 * Layered above the AI Agents control center (and Workspace Settings) — z-110.
 */
export default function ConnectModal({ mcpUrl, mintTargets = [], onClose, source }: Props) {
  const t = useTranslations('WorkspaceSettings');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Link2 size={14} className="text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-neutral-100">{t('connectTitle')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">
          <ConnectFlow bare mcpUrl={mcpUrl} mintTargets={mintTargets} onClose={onClose} source={source} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
