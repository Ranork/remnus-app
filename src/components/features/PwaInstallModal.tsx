'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  X,
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
  ArrowRight,
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const benefits: { icon: LucideIcon; key: 'pwaBenefit1' | 'pwaBenefit2' | 'pwaBenefit3' }[] = [
    { icon: AppWindow, key: 'pwaBenefit1' },
    { icon: RefreshCw, key: 'pwaBenefit2' },
    { icon: ShieldCheck, key: 'pwaBenefit3' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-neutral-850 border border-neutral-800 rounded-2xl modal-shadow overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded hover:bg-neutral-800"
          aria-label={t('pwaNudgeLater')}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="px-7 pt-9 pb-5 flex flex-col items-center text-center gap-3">
          <Image
            src="/icons/icon-192.png"
            alt="Remnus"
            width={56}
            height={56}
            className="rounded-2xl ring-1 ring-neutral-800"
          />
          <h2 className="text-xl font-semibold text-neutral-50">{t('pwaInstallCta')}</h2>
          <p className="text-[13px] text-neutral-400 max-w-xs leading-relaxed">
            {t('pwaModalTagline')}
          </p>
        </div>

        {/* Benefits */}
        <div className="px-7 grid grid-cols-3 gap-2">
          {benefits.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-neutral-800 bg-neutral-900 text-center"
            >
              <span className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Icon size={14} className="text-blue-300" />
              </span>
              <span className="text-[10.5px] leading-tight text-neutral-300">{t(key)}</span>
            </div>
          ))}
        </div>

        {/* Action zone */}
        <div className="px-7 pt-5 pb-6">
          {status === 'installed' ? (
            <div className="flex items-center gap-2.5 border border-green-400/30 bg-green-400/10 rounded-xl px-4 py-3">
              <Check size={16} className="text-green-400 shrink-0" />
              <span className="text-[13px] text-neutral-100 leading-snug">
                {t('pwaInstalledBadge')}
              </span>
            </div>
          ) : status === 'available' ? (
            <button
              onClick={() => void triggerInstallPrompt()}
              className="w-full inline-flex items-center justify-center gap-2.5 bg-blue-500 hover:bg-accent-strong text-white px-6 py-3.5 rounded-xl text-[14px] font-medium transition-colors duration-150"
            >
              <Download size={16} aria-hidden />
              {t('pwaInstallCta')}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-[0.16em] shrink-0">
                  {t('pwaHowTitle')}
                </span>
                <span className="flex-1 h-px bg-neutral-800" />
              </div>

              {/* Platform tabs */}
              <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
                {(['ios', 'android'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatform(p)}
                    className={`flex-1 px-2 py-1.5 text-[11.5px] font-medium rounded-md transition-colors ${
                      platform === p
                        ? 'bg-neutral-800 text-neutral-100'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {t(TAB_KEYS[p])}
                  </button>
                ))}
              </div>

              <ol className="space-y-2.5">
                {STEP_ICONS[platform].map((Icon, i) => (
                  <li key={i} className="flex items-center gap-3 px-1">
                    <span className="w-7 h-7 shrink-0 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                      <Icon size={14} className="text-neutral-300" />
                    </span>
                    <span className="text-[13px] text-neutral-200 leading-snug">
                      <span className="font-mono text-[11px] text-neutral-500 mr-1.5">
                        {i + 1}.
                      </span>
                      {t(`${STEP_KEY_PREFIX[platform]}Step${i + 1}` as Parameters<typeof t>[0])}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Desktop apps pointer */}
        <div className="border-t border-neutral-800 bg-neutral-900/50">
          <Link
            href="/download"
            onClick={onClose}
            className="group flex items-center justify-between gap-3 px-7 py-3.5 text-[12px] text-neutral-400 hover:text-neutral-100 transition-colors duration-150"
          >
            <span className="leading-snug">{t('pwaModalDesktopLink')}</span>
            <ArrowRight
              size={13}
              className="shrink-0 group-hover:translate-x-0.5 transition-transform"
              aria-hidden
            />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
