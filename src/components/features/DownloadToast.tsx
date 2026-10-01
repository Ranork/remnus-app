'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { toast } from '@/components/ui/toast';

type DownloadPayload = {
  success: boolean;
  path: string | null;
  name: string | null;
};

/**
 * Desktop-only: when a WebView download finishes the Rust `on_download` handler emits
 * `download-finished`; this turns it into the app's toast (with a "show in folder"
 * action) — downloads used to complete silently in the desktop shell. Renders nothing.
 */
export default function DownloadToast() {
  const t = useTranslations('Workspace');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function reveal(path: string) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('reveal_download', { path });
      } catch (err) {
        console.error('[Remnus] reveal_download failed:', err);
      }
    }

    async function init() {
      const { listen } = await import('@tauri-apps/api/event');
      const stop = await listen<DownloadPayload>('download-finished', (event) => {
        const { success, path, name } = event.payload;
        toast({
          title: success ? t('downloadComplete') : t('downloadFailed'),
          description: name ?? undefined,
          tone: success ? 'success' : 'error',
          icon: success ? <Download className="text-green-400" /> : undefined,
          action: success && path ? { label: t('downloadShowInFolder'), onClick: () => reveal(path) } : undefined,
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
