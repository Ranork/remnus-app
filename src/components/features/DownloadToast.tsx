'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FolderOpen, X, AlertTriangle } from 'lucide-react';

type DownloadPayload = {
  success: boolean;
  path: string | null;
  name: string | null;
};

type Toast = {
  id: number;
  success: boolean;
  path: string | null;
  name: string | null;
};

const AUTO_DISMISS_MS = 6000;

/**
 * Desktop-only toast surfaced when a WebView download finishes. The Rust
 * `on_download` handler emits `download-finished`; this listens for it so the
 * user gets clear feedback (and a "show in folder" shortcut) that was missing
 * before — downloads previously completed silently in the desktop shell.
 */
export default function DownloadToast() {
  const t = useTranslations('Workspace');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;

    async function init() {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<DownloadPayload>('download-finished', (event) => {
        const { success, path, name } = event.payload;
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, success, path, name }]);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, AUTO_DISMISS_MS);
      });
    }

    init();
    return () => { unlisten?.(); };
  }, []);

  async function reveal(path: string | null) {
    if (!path) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reveal_download', { path });
    } catch (err) {
      console.error('[Remnus] reveal_download failed:', err);
    }
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="w-72 bg-neutral-900 border border-neutral-800 shadow-xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
        >
          <div className={`shrink-0 mt-0.5 ${toast.success ? 'text-green-400' : 'text-red-400'}`}>
            {toast.success ? <Download size={16} /> : <AlertTriangle size={16} />}
          </div>

          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="text-sm font-semibold text-neutral-100">
              {toast.success ? t('downloadComplete') : t('downloadFailed')}
            </span>
            {toast.name && (
              <span className="text-xs text-neutral-400 truncate" title={toast.name}>
                {toast.name}
              </span>
            )}
            {toast.success && toast.path && (
              <button
                onClick={() => reveal(toast.path)}
                className="mt-1 self-start flex items-center gap-1.5 text-xs font-medium text-signal-text hover:text-fg transition-colors"
              >
                <FolderOpen size={12} />
                {t('downloadShowInFolder')}
              </button>
            )}
          </div>

          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
