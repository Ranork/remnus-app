'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  subscribeInstallPrompt,
  getInstallPromptStatus,
  getServerInstallPromptStatus,
  initInstallPromptCapture,
} from '@/lib/pwa/installPrompt';
import PwaInstallModal from './PwaInstallModal';

/**
 * "Install app" as a hook, for the account menu. Web only — `available` is false inside
 * the Tauri shell (already a desktop app) and once the PWA is installed/running
 * standalone. The caller renders `modal` somewhere that stays mounted while the menu
 * closes, and shows its own row when `available`.
 */
export function usePwaInstall() {
  const isTauri = useIsTauri();
  const status = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptStatus,
    getServerInstallPromptStatus
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    initInstallPromptCapture();
  }, []);

  return {
    available: !isTauri && status !== 'installed',
    open: () => setOpen(true),
    modal: <PwaInstallModal open={open} onClose={() => setOpen(false)} />,
  };
}
