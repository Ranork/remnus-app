'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  getInstallPromptStatus,
  initInstallPromptCapture,
  triggerInstallPrompt,
} from '@/lib/pwa/installPrompt';
import { toast } from '@/components/ui/toast';
import PwaInstallModal from './PwaInstallModal';

const NUDGE_FLAG = 'remnus_pwa_nudge_done';
const NUDGE_TOAST = 'pwa-install-nudge';
const SHOW_DELAY_MS = 30_000;

/**
 * Gentle one-time install reminder for mobile browser users (coarse-pointer only), as
 * the app's toast. Appears once ~30s into the session, never again after being shown —
 * whether dismissed or not. Install uses the native prompt when captured, otherwise opens
 * the PwaInstallModal instructions.
 */
export default function PwaInstallNudge() {
  const t = useTranslations('Download');
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
      toast({
        id: NUDGE_TOAST,
        title: t('pwaNudgeText'),
        icon: (
          <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="rounded-control" aria-hidden />
        ),
        timeout: 0,
        action: {
          label: t('pwaInstallCta'),
          onClick: () => {
            toast.close(NUDGE_TOAST);
            if (getInstallPromptStatus() === 'available') void triggerInstallPrompt();
            else setModalOpen(true);
          },
        },
      });
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [t]);

  return <PwaInstallModal open={modalOpen} onClose={() => setModalOpen(false)} />;
}
