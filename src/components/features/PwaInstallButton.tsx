'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { MonitorSmartphone } from 'lucide-react';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  subscribeInstallPrompt,
  getInstallPromptStatus,
  getServerInstallPromptStatus,
  initInstallPromptCapture,
} from '@/lib/pwa/installPrompt';
import PwaInstallModal from './PwaInstallModal';

/**
 * Sidebar bottom-cluster "Install app" row. Web only — hidden inside the Tauri
 * shell (already a desktop app) and once the PWA is installed/running standalone.
 */
export default function PwaInstallButton() {
  const t = useTranslations('Download');
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

  if (isTauri || status === 'installed') return null;

  return (
    <div className="shrink-0 px-2">
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-1.5 min-w-0 px-2 py-1.5 rounded-md text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 transition-all duration-200"
      >
        <MonitorSmartphone size={14} className="shrink-0 text-neutral-400" />
        <span className="truncate">{t('pwaShortLabel')}</span>
      </button>
      <PwaInstallModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
