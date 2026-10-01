'use client';
import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FolderOpen, FolderInput, RefreshCw, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';
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
    <SettingsPage>
      <SettingsSection
        title={t('zoom')}
        action={<Badge variant="outline" className="font-mono">{pct}%</Badge>}
      >
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
            <ZoomOut />
            {t('zoomOut')}
          </Button>
          <Button
            size="icon-sm"
            onClick={() => changeZoom(ZOOM_DEFAULT)}
            disabled={zoom === ZOOM_DEFAULT}
            aria-label={t('resetZoom')}
            title={t('resetZoom')}
          >
            <RotateCcw />
          </Button>
          <Button size="sm" className="flex-1" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
            <ZoomIn />
            {t('zoomIn')}
          </Button>
        </div>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          value={zoom}
          aria-label={t('zoom')}
          onChange={(e) => changeZoom(parseFloat(e.target.value))}
          className="w-full cursor-pointer accent-signal"
        />
      </SettingsSection>

      <SettingsSection title={t('downloadFolder')}>
        <p
          className="truncate rounded-control bg-raised px-2.5 py-1.5 font-mono text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)]"
          title={downloadDir ?? undefined}
        >
          {downloadDir ?? t('downloadFolderDefault')}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={chooseDownloadDir}>
            <FolderInput />
            {t('downloadChooseFolder')}
          </Button>
          <Button size="sm" variant="ghost" onClick={resetDownloadDir} disabled={!downloadDir}>
            <FolderOpen />
            {t('downloadFolderReset')}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection title={tUpdater('checkSection')} description={tUpdater('checkHint')}>
        <Button
          size="sm"
          className="self-start"
          onClick={checkForUpdates}
          loading={updateCheck === 'checking'}
        >
          <RefreshCw />
          {tUpdater('checkButton')}
        </Button>
        {updateCheck === 'upToDate' && (
          <p className="flex items-center gap-1.5 text-xs text-green-400">
            <Check size={12} className="shrink-0" />
            {tUpdater('upToDate')}
          </p>
        )}
        {updateCheck === 'found' && (
          <p className="text-xs text-fg-2">{tUpdater('availableTitle')}</p>
        )}
        {updateCheck === 'error' && (
          <p role="alert" className="text-xs text-red-400">{tUpdater('checkError')}</p>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
