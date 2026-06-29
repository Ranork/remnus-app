'use client';
import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FolderOpen, FolderInput, RefreshCw, Loader2, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  applyDesktopZoom, getSavedZoom, round1,
  ZOOM_MIN, ZOOM_MAX, ZOOM_STEP, ZOOM_DEFAULT,
} from '@/lib/desktop/zoom';

/**
 * Desktop-only settings (Tauri): WebView zoom + download folder. Rendered as a
 * tab inside `UserSettingsModal` (the standalone `DesktopSettingsModal` and its
 * sidebar entry were removed in favor of this). Only mounted when running in the
 * desktop shell.
 */
type UpdateCheck = 'idle' | 'checking' | 'upToDate' | 'found' | 'error';

export default function DesktopTab() {
  const t = useTranslations('Workspace');
  const tUpdater = useTranslations('Updater');
  const [zoom, setZoom] = useState<number>(getSavedZoom);
  const [downloadDir, setDownloadDir] = useState<string | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck>('idle');

  // Manual update check — the native updater only runs at startup, so without
  // this the app must be closed and reopened to notice a new release. Delegates
  // the actual download/install to the existing UpdateBanner by re-emitting the
  // same `update-available` event it listens for.
  async function checkForUpdates() {
    setUpdateCheck('checking');
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('update-available', { version: update.version });
        setUpdateCheck('found');
      } else {
        setUpdateCheck('upToDate');
      }
    } catch {
      setUpdateCheck('error');
    }
  }

  // Load the currently configured custom download folder (desktop only).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;
    let cancelled = false;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir = await invoke<string | null>('get_download_dir');
        if (!cancelled) setDownloadDir(dir ?? null);
      } catch {
        /* not running in the desktop shell — leave as default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function chooseDownloadDir() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dir = await invoke<string | null>('pick_download_dir');
      if (dir) setDownloadDir(dir);
    } catch {
      /* user cancelled or not in desktop shell */
    }
  }

  async function resetDownloadDir() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('reset_download_dir');
      setDownloadDir(null);
    } catch {
      /* not in desktop shell */
    }
  }

  function changeZoom(next: number) {
    const clamped = round1(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)));
    setZoom(clamped);
    applyDesktopZoom(clamped); // fire-and-forget, updates are immediate
  }

  const pct = Math.round(zoom * 100);

  return (
    <div>
      {/* Zoom section */}
      <div className="py-4 border-b border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-200">{t('zoom')}</p>
          </div>
          <span className="text-xs text-neutral-500 font-mono tabular-nums bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700/40 shrink-0">
            {pct}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
          >
            <ZoomOut size={12} />
            {t('zoomOut')}
          </button>

          <button
            onClick={() => changeZoom(ZOOM_DEFAULT)}
            disabled={zoom === ZOOM_DEFAULT}
            className="flex items-center justify-center p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
            title={t('resetZoom')}
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
          >
            <ZoomIn size={12} />
            {t('zoomIn')}
          </button>
        </div>

        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={zoom}
          onChange={(e) => changeZoom(parseFloat(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Download folder section */}
      <div className="py-4 border-b border-neutral-800 space-y-3">
        <p className="text-sm font-medium text-neutral-200">{t('downloadFolder')}</p>

        <div className="text-xs text-neutral-500 font-mono truncate bg-neutral-800 px-2.5 py-1.5 rounded border border-neutral-700/40" title={downloadDir ?? undefined}>
          {downloadDir ?? t('downloadFolderDefault')}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={chooseDownloadDir}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-neutral-800 cursor-pointer rounded transition-colors"
          >
            <FolderInput size={12} />
            {t('downloadChooseFolder')}
          </button>

          <button
            onClick={resetDownloadDir}
            disabled={!downloadDir}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-30 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
            title={t('downloadFolderReset')}
          >
            <FolderOpen size={12} />
            {t('downloadFolderReset')}
          </button>
        </div>
      </div>

      {/* Updates section */}
      <div className="py-4 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200">{tUpdater('checkSection')}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{tUpdater('checkHint')}</p>
        </div>

        <button
          onClick={checkForUpdates}
          disabled={updateCheck === 'checking'}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 disabled:opacity-50 disabled:cursor-not-allowed border border-neutral-800 cursor-pointer rounded transition-colors"
        >
          {updateCheck === 'checking'
            ? <Loader2 size={12} className="animate-spin" />
            : <RefreshCw size={12} />}
          {updateCheck === 'checking' ? tUpdater('checking') : tUpdater('checkButton')}
        </button>

        {updateCheck === 'upToDate' && (
          <p className="flex items-center gap-1.5 text-[11px] text-green-400">
            <Check size={12} className="shrink-0" />
            {tUpdater('upToDate')}
          </p>
        )}
        {updateCheck === 'found' && (
          <p className="text-[11px] text-blue-400">{tUpdater('availableTitle')}</p>
        )}
        {updateCheck === 'error' && (
          <p className="text-[11px] text-red-400">{tUpdater('checkError')}</p>
        )}
      </div>
    </div>
  );
}
