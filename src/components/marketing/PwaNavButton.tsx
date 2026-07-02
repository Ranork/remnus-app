'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MonitorSmartphone } from 'lucide-react';
import PwaInstallModal from '@/components/features/PwaInstallModal';

/**
 * Landing nav "Install app" button — opens the shared PwaInstallModal so
 * visitors discover Remnus installs as a web app. Mobile/tablet only (< lg):
 * on desktop widths the nav's "Download" link covers this instead (the nav
 * link list itself is hidden below lg).
 */
export default function PwaNavButton() {
  const t = useTranslations('Download');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-2 text-[13px] text-neutral-50 hover:text-neutral-100 transition-colors duration-150 rounded-md hover:bg-white/5"
        aria-label={t('pwaShortLabel')}
        title={t('pwaShortLabel')}
      >
        <MonitorSmartphone size={15} aria-hidden />
        <span className="hidden sm:inline">{t('pwaShortLabel')}</span>
      </button>
      <PwaInstallModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
