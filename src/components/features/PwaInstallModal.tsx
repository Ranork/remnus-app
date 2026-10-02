'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import {
  Share,
  SquarePlus,
  MoreVertical,
  MonitorDown,
  AppWindow,
  RefreshCw,
  ShieldCheck,
  Download,
  Check,
  Compass,
  Globe,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import {
  subscribeInstallPrompt,
  getInstallPromptStatus,
  getServerInstallPromptStatus,
  initInstallPromptCapture,
  triggerInstallPrompt,
  detectInstallPlatform,
  type InstallPlatform,
} from '@/lib/pwa/installPrompt';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEP_ICONS: Record<Exclude<InstallPlatform, 'desktop'>, LucideIcon[]> = {
  ios: [Compass, Share, SquarePlus],
  android: [Globe, MoreVertical, MonitorDown],
};

type TabPlatform = Exclude<InstallPlatform, 'desktop'>;

const TAB_KEYS: Record<TabPlatform, 'pwaTabIos' | 'pwaTabAndroid'> = {
  ios: 'pwaTabIos',
  android: 'pwaTabAndroid',
};

const STEP_KEY_PREFIX: Record<Exclude<InstallPlatform, 'desktop'>, 'pwaIos' | 'pwaAndroid'> = {
  ios: 'pwaIos',
  android: 'pwaAndroid',
};

/**
 * "Install Remnus" modal — the single, polished PWA install explainer opened
 * from the sidebar row, the landing nav button, and the mobile nudge. Shows a
 * one-click native install button when the captured `beforeinstallprompt` is
 * available; otherwise platform-tabbed add-to-home-screen instructions.
 */
export default function PwaInstallModal({ open, onClose }: Props) {
  const t = useTranslations('Download');
  const status = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptStatus,
    getServerInstallPromptStatus
  );
  const [platform, setPlatform] = useState<TabPlatform>('ios');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initInstallPromptCapture();
    // Desktop visitors default to the iOS tab — the tabs only cover mobile;
    // desktop users get the one-click prompt (Chrome/Edge) or the /download link.
    if (detectInstallPlatform() === 'android') setPlatform('android');
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const benefits: { icon: LucideIcon; key: 'pwaBenefit1' | 'pwaBenefit2' | 'pwaBenefit3' }[] = [
    { icon: AppWindow, key: 'pwaBenefit1' },
    { icon: RefreshCw, key: 'pwaBenefit2' },
    { icon: ShieldCheck, key: 'pwaBenefit3' },
  ];

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent size="md" className="dialog-compact:gap-5 sm:max-w-md">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 px-4 pt-3 text-center">
          <Image
            src="/icons/icon-192.png"
            alt="Remnus"
            width={56}
            height={56}
            className="rounded-surface shadow-[0_0_0_1px_var(--color-line)]"
          />
          <DialogTitle className="text-xl">{t('pwaInstallCta')}</DialogTitle>
          <DialogDescription className="max-w-xs">{t('pwaModalTagline')}</DialogDescription>
        </div>

        {/* Benefits */}
        <ul className="grid grid-cols-3 gap-2">
          {benefits.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="flex flex-col items-center gap-1.5 rounded-control bg-raised px-2 py-3 text-center shadow-[inset_0_0_0_1px_var(--color-line)]"
            >
              <Icon size={16} className="text-fg-3" />
              <span className="text-xs leading-tight text-fg-2">{t(key)}</span>
            </li>
          ))}
        </ul>

        {/* Action zone */}
        {status === 'installed' ? (
          <p role="status" className="flex items-center gap-2.5 rounded-control bg-green-500/10 px-4 py-3 text-ui text-fg">
            <Check size={16} className="shrink-0 text-green-400" />
            {t('pwaInstalledBadge')}
          </p>
        ) : status === 'available' ? (
          <Button variant="primary" size="lg" className="w-full" onClick={() => void triggerInstallPrompt()}>
            <Download aria-hidden />
            {t('pwaInstallCta')}
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-fg-3">{t('pwaHowTitle')}</p>
            <Tabs variant="segmented" value={platform} onValueChange={(v) => setPlatform(v as TabPlatform)}>
              <TabsList className="w-full">
                {(['ios', 'android'] as const).map((p) => (
                  <TabsTab key={p} value={p} className="flex-1 justify-center">{t(TAB_KEYS[p])}</TabsTab>
                ))}
              </TabsList>
            </Tabs>
            <ol className="flex flex-col gap-2.5">
              {STEP_ICONS[platform].map((Icon, i) => (
                <li key={i} className="flex items-center gap-3 px-1">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-control bg-raised shadow-[inset_0_0_0_1px_var(--color-line)]">
                    <Icon size={14} className="text-fg-2" />
                  </span>
                  <span className="text-ui leading-snug text-fg">
                    <span className="mr-1.5 text-xs text-fg-3">{i + 1}.</span>
                    {t(`${STEP_KEY_PREFIX[platform]}Step${i + 1}` as Parameters<typeof t>[0])}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Desktop apps pointer */}
        <Link
          href="/download"
          onClick={onClose}
          className="-mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-fg-3 transition-colors hover:text-fg"
        >
          <span className="leading-snug">{t('pwaModalDesktopLink')}</span>
          <ChevronRight size={14} className="shrink-0" aria-hidden />
        </Link>
      </DialogContent>
    </Dialog>
  );
}
