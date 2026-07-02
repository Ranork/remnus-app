'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useIsTauri } from '@/lib/hooks/useIsTauri';
import {
  subscribeInstallPrompt,
  getInstallPromptStatus,
  getServerInstallPromptStatus,
  initInstallPromptCapture,
  triggerInstallPrompt,
} from '@/lib/pwa/installPrompt';
import PwaInstallModal from './PwaInstallModal';

const NUDGE_FLAG = 'remnus_pwa_nudge_done';
const SHOW_DELAY_MS = 30_000;

/**
 * Gentle one-time install reminder for mobile browser users (coarse-pointer
 * only). Appears once ~30s into the session, never again after being shown —
 * whether dismissed or not. Install CTA uses the native prompt when captured,
 * otherwise opens the PwaInstallModal instructions.
 */
export default function PwaInstallNudge() {
  const t = useTranslations('Download');
  const isTauri = useIsTauri();
  const status = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptStatus,
    getServerInstallPromptStatus
  );
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    initInstallPromptCapture();
    if ('__TAURI_INTERNALS__' in window || '__TAURI__' in window) return;
    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    if (getInstallPromptStatus() === 'installed') return;
    try {
      if (localStorage.getItem(NUDGE_FLAG)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => {
      if (getInstallPromptStatus() === 'installed') return;
      try {
        localStorage.setItem(NUDGE_FLAG, '1');
      } catch {}
      setVisible(true);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (isTauri || status === 'installed' || !visible) {
    // Keep the modal reachable even after the toast is gone (user tapped Install).
    return modalOpen ? <PwaInstallModal open onClose={() => setModalOpen(false)} /> : null;
  }

  const handleInstall = () => {
    setVisible(false);
    if (status === 'available') {
      void triggerInstallPrompt();
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-20 left-3 right-3 z-50 md:left-auto md:right-6 md:max-w-sm animate-scale-in">
        <div className="relative flex items-start gap-3 bg-neutral-850 border border-neutral-800 rounded-2xl modal-shadow px-4 py-3.5">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={36}
            height={36}
            className="shrink-0 rounded-xl ring-1 ring-neutral-800 mt-0.5"
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-neutral-200 leading-snug pr-4">{t('pwaNudgeText')}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={handleInstall}
                className="px-3 py-1.5 text-[12px] font-semibold bg-blue-500 hover:bg-accent-strong text-white rounded-md transition-colors duration-150"
              >
                {t('pwaInstallCta')}
              </button>
              <button
                onClick={() => setVisible(false)}
                className="px-2.5 py-1.5 text-[12px] text-neutral-400 hover:text-neutral-200 transition-colors duration-150"
              >
                {t('pwaNudgeLater')}
              </button>
            </div>
          </div>
          <button
            onClick={() => setVisible(false)}
            aria-label={t('pwaNudgeLater')}
            className="absolute top-2.5 right-2.5 p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          >
            <X size={13} />
          </button>
        </div>
      </div>
      <PwaInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
