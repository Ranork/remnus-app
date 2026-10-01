'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from '@/components/ui/toast';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

// One toast id for the whole update: each phase replaces the last in place.
const UPDATE_TOAST = 'desktop-update';

/**
 * Desktop-only: the native updater (startup) and the Desktop settings tab emit
 * `update-available`; this walks the update through the app's toast — offered, downloading
 * (live bar), ready, or failed with a retry. Renders nothing itself.
 */
export default function UpdateBanner() {
  const t = useTranslations('Updater');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function quitApp() {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('quit_app');
      } catch {
        // Fallback: if invoke fails for any reason the user can quit from the tray
      }
    }

    function showError(message: string, version: string) {
      toast({
        id: UPDATE_TOAST,
        title: t('errorTitle'),
        description: message,
        tone: 'error',
        timeout: 0,
        action: { label: t('retryButton'), onClick: () => install(version) },
      });
    }

    async function install(version: string) {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (!update) {
          // The native check at startup found an update but this re-check did
          // not — surface it instead of silently doing nothing.
          console.error('[Remnus] Update re-check returned no update.');
          showError(t('errorNoUpdate'), version);
          return;
        }

        toast({
          id: UPDATE_TOAST,
          title: t('availableTitle'),
          description: t('downloadingDesc', { progress: 0 }),
          progress: 0,
          timeout: 0,
          dismissible: false,
        });

        let downloaded = 0;
        let contentLength = 0;

        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            contentLength = event.data.contentLength ?? 0;
          } else if (event.event === 'Progress') {
            downloaded += event.data.chunkLength;
            const pct = contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0;
            toast.update(UPDATE_TOAST, { description: t('downloadingDesc', { progress: pct }), progress: pct });
          } else if (event.event === 'Finished') {
            toast({
              id: UPDATE_TOAST,
              title: t('readyTitle'),
              description: t('readyDesc'),
              tone: 'success',
              timeout: 0,
              action: { label: t('restartNote'), onClick: quitApp },
            });
          }
        });

        // downloadAndInstall resolved — on Windows the NSIS installer has been
        // launched as a subprocess and is waiting for this process to exit before
        // it can replace the running executable. Quit immediately so the installer
        // can proceed; do not wait for the user to click another button.
        await quitApp();
      } catch (err) {
        console.error('[Remnus] Update install failed:', err);
        showError(err instanceof Error ? err.message : String(err), version);
      }
    }

    async function init() {
      const { listen } = await import('@tauri-apps/api/event');
      const stop = await listen<{ version: string }>('update-available', (event) => {
        const { version } = event.payload;
        toast({
          id: UPDATE_TOAST,
          title: t('availableTitle'),
          description: t('availableDesc', { version }),
          timeout: 0,
          action: { label: t('installButton'), onClick: () => install(version) },
        });
      });
      if (cancelled) stop();
      else unlisten = stop;
    }

    init();
    return () => { cancelled = true; unlisten?.(); };
  }, [t]);

  return null;
}
