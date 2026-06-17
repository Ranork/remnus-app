'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, RefreshCw, X } from 'lucide-react';

type UpdatePhase =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; progress: number }
  | { phase: 'ready' }
  | { phase: 'error'; message: string; version: string };

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export default function UpdateBanner() {
  const t = useTranslations('Updater');
  const [state, setState] = useState<UpdatePhase>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;

    async function init() {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<{ version: string }>('update-available', (event) => {
        setState({ phase: 'available', version: event.payload.version });
      });
    }

    init();
    return () => { unlisten?.(); };
  }, []);

  async function handleInstall() {
    const version = state.phase === 'available' ? state.version : '';
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        // The native check at startup found an update but this re-check did
        // not — surface it instead of silently doing nothing.
        console.error('[Remnus] Update re-check returned no update.');
        setState({ phase: 'error', message: t('errorNoUpdate'), version });
        return;
      }

      setState({ phase: 'downloading', progress: 0 });

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
          setState({ phase: 'downloading', progress: pct });
        } else if (event.event === 'Finished') {
          setState({ phase: 'ready' });
        }
      });
    } catch (err) {
      console.error('[Remnus] Update install failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setState({ phase: 'error', message, version });
    }
  }

  async function handleQuitAndReopen() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('quit_app');
    } catch {
      // Fallback: if invoke fails for any reason the user can quit from the tray
    }
  }

  if (state.phase === 'idle' || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-neutral-900 border border-neutral-800 shadow-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-neutral-100">
            {state.phase === 'ready'
              ? t('readyTitle')
              : state.phase === 'error'
                ? t('errorTitle')
                : t('availableTitle')}
          </span>
          {state.phase === 'available' && (
            <span className="text-xs text-neutral-400">
              {t('availableDesc', { version: state.version })}
            </span>
          )}
          {state.phase === 'downloading' && (
            <span className="text-xs text-neutral-400">
              {t('downloadingDesc', { progress: state.progress })}
            </span>
          )}
          {state.phase === 'ready' && (
            <span className="text-xs text-neutral-400">{t('readyDesc')}</span>
          )}
          {state.phase === 'error' && (
            <span className="text-xs text-red-400 wrap-break-word">{state.message}</span>
          )}
        </div>
        {state.phase !== 'downloading' && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {state.phase === 'downloading' && (
        <div className="h-1 w-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      )}

      {state.phase === 'available' && (
        <button
          onClick={handleInstall}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
        >
          <Download size={13} />
          {t('installButton')}
        </button>
      )}

      {state.phase === 'error' && (
        <button
          onClick={handleInstall}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
        >
          <RefreshCw size={13} />
          {t('retryButton')}
        </button>
      )}

      {state.phase === 'ready' && (
        <button
          onClick={handleQuitAndReopen}
          className="flex items-center justify-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/20 text-green-400 text-xs font-medium transition-colors"
        >
          <RefreshCw size={13} />
          {t('restartNote')}
        </button>
      )}
    </div>
  );
}
