'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { Download, ArrowRight, Smartphone } from 'lucide-react';
import {
  subscribeInstallPrompt,
  getInstallPromptStatus,
  getServerInstallPromptStatus,
  initInstallPromptCapture,
  triggerInstallPrompt,
} from '@/lib/pwa/installPrompt';

const REPO = 'Ranork/remnus-app';
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const downloadUrl = (file: string) => `${RELEASES_URL}/latest/download/${file}`;

type DetectedOS = 'windows' | 'mac' | 'linux' | 'android' | 'ios' | 'unknown';

type Platform = {
  id: string;
  logo: string;
  labelKey: string;
  hintKey: string;
  file: string;
};

const PLATFORMS: Platform[] = [
  { id: 'windows',  logo: '/os/windows.svg', labelKey: 'osWindows',  hintKey: 'fileExe',      file: 'Remnus-windows-x64-setup.exe' },
  { id: 'macApple', logo: '/os/apple.svg',   labelKey: 'osMacApple', hintKey: 'fileDmgApple', file: 'Remnus-macos-aarch64.dmg' },
  { id: 'macIntel', logo: '/os/apple.svg',   labelKey: 'osMacIntel', hintKey: 'fileDmgIntel', file: 'Remnus-macos-intel.dmg' },
  { id: 'linuxApp', logo: '/os/linux.svg',   labelKey: 'osLinuxApp', hintKey: 'fileAppImage', file: 'Remnus-linux-x86_64.AppImage' },
  { id: 'linuxDeb', logo: '/os/linux.svg',   labelKey: 'osLinuxDeb', hintKey: 'fileDeb',      file: 'Remnus-linux-amd64.deb' },
];

function detectOS(): DetectedOS {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator.platform || '').toLowerCase();
  // Mobile checks first: Android UAs contain "linux", iPadOS 13+ reports as Mac.
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua) || (plat.includes('mac') && navigator.maxTouchPoints > 1)) return 'ios';
  if (ua.includes('win') || plat.includes('win')) return 'windows';
  if (ua.includes('mac') || plat.includes('mac')) return 'mac';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  return 'unknown';
}

// Coarse OS family for a PLATFORMS grid entry, so download-click analytics
// group macApple/macIntel and linuxApp/linuxDeb into one 'mac'/'linux' bucket
// (matching the smart primary button's already-coarse `os` state).
function coarseOs(platformId: string): 'windows' | 'mac' | 'linux' {
  if (platformId.startsWith('mac')) return 'mac';
  if (platformId.startsWith('linux')) return 'linux';
  return 'windows';
}

// The single asset recommended for a detected desktop OS (Apple Silicon / AppImage as sensible defaults).
const PRIMARY_BY_OS: Record<'windows' | 'mac' | 'linux', { osKey: string; file: string; logo: string }> = {
  windows: { osKey: 'osWindows',  file: 'Remnus-windows-x64-setup.exe',  logo: '/os/windows.svg' },
  mac:     { osKey: 'osMac',      file: 'Remnus-macos-aarch64.dmg',      logo: '/os/apple.svg' },
  linux:   { osKey: 'osLinux',    file: 'Remnus-linux-x86_64.AppImage',  logo: '/os/linux.svg' },
};

export default function DownloadView() {
  const t = useTranslations('Download');
  const posthog = usePostHog();
  const [os, setOs] = useState<DetectedOS>('unknown');
  const [ready, setReady] = useState(false);
  const installStatus = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptStatus,
    getServerInstallPromptStatus
  );

  useEffect(() => {
    // Idempotent — normally already installed by PwaInstallCapture in the layout.
    initInstallPromptCapture();
    setOs(detectOS());
    setReady(true);
  }, []);

  const primary = os === 'windows' || os === 'mac' || os === 'linux' ? PRIMARY_BY_OS[os] : null;
  const isMobileOs = os === 'android' || os === 'ios';

  const handleInstall = () => {
    void triggerInstallPrompt();
  };

  return (
    <section className="relative overflow-hidden px-4 sm:px-8 lg:px-14 pt-16 pb-20 lg:pt-24 lg:pb-28">
      <div
        className="absolute top-10 -right-60 w-[700px] h-[700px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.16), transparent 60%)' }}
      />

      <div className="relative max-w-3xl mx-auto text-center">
        <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
          {t('eyebrow')}
        </span>
        <h1
          className="mt-4 font-sans font-semibold text-neutral-100 leading-[1.02] text-[40px] sm:text-[56px] lg:text-[64px]"
          style={{ letterSpacing: '-0.035em' }}
        >
          {t('title')}
        </h1>
        <p className="mt-5 text-base lg:text-[17px] leading-[1.55] text-neutral-50 max-w-xl mx-auto">
          {t('subtitle')}
        </p>

        {/* Smart primary button */}
        <div className="mt-9 flex flex-col items-center gap-3">
          {!ready ? (
            <span className="font-mono text-[13px] text-dim animate-pulse">{t('detecting')}</span>
          ) : isMobileOs ? (
            <>
              {installStatus === 'installed' ? (
                <span className="font-mono text-[13px] text-green-400">{t('pwaInstalledBadge')}</span>
              ) : installStatus === 'available' ? (
                <button
                  onClick={handleInstall}
                  className="inline-flex items-center gap-2.5 bg-blue-500 hover:bg-accent-strong text-white px-7 py-4 rounded-md text-[15px] font-medium transition-colors duration-150"
                >
                  <Smartphone size={18} aria-hidden />
                  {t('pwaInstallCta')}
                </button>
              ) : (
                <a
                  href="#mobile-install"
                  className="inline-flex items-center gap-2.5 bg-blue-500 hover:bg-accent-strong text-white px-7 py-4 rounded-md text-[15px] font-medium transition-colors duration-150"
                >
                  <Smartphone size={18} aria-hidden />
                  {t('pwaInstallCta')}
                </a>
              )}
              <span className="font-mono text-[11px] text-dim">{t('yourSystemBadge')}</span>
            </>
          ) : primary ? (
            <>
              <a
                href={downloadUrl(primary.file)}
                onClick={() => posthog?.capture('desktop_download_clicked', { os, file: primary.file, surface: 'download_page_primary' })}
                className="inline-flex items-center gap-2.5 bg-blue-500 hover:bg-accent-strong text-white px-7 py-4 rounded-md text-[15px] font-medium transition-colors duration-150"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={primary.logo} alt="" width={18} height={18} className="brightness-0 invert" aria-hidden />
                {t('downloadFor', { os: t(primary.osKey as Parameters<typeof t>[0]) })}
              </a>
              <span className="font-mono text-[11px] text-dim">{t('yourSystemBadge')}</span>
            </>
          ) : (
            <span className="font-mono text-[13px] text-dim">{t('chooseBelow')}</span>
          )}
        </div>
      </div>

      {/* All platforms */}
      <div className="relative max-w-3xl mx-auto mt-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.16em]">
            {t('allPlatforms')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>

        <div className="grid gap-px bg-neutral-800 border border-neutral-800 rounded-md overflow-hidden">
          {PLATFORMS.map((p) => {
            return (
              <a
                key={p.id}
                href={downloadUrl(p.file)}
                onClick={() => posthog?.capture('desktop_download_clicked', { os: coarseOs(p.id), file: p.file, surface: 'download_page_grid' })}
                className="flex items-center gap-4 px-5 py-4 bg-neutral-900 hover:bg-neutral-850 transition-colors duration-150 group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo} alt="" width={22} height={22} className="shrink-0 opacity-90" aria-hidden />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] text-neutral-100 font-medium">
                    {t(p.labelKey as Parameters<typeof t>[0])}
                  </span>
                  <span className="font-mono text-[11px] text-dim">
                    {t(p.hintKey as Parameters<typeof t>[0])}
                  </span>
                </div>
                <Download
                  size={16}
                  className="ml-auto text-dim group-hover:text-neutral-100 transition-colors duration-150 shrink-0"
                  aria-hidden
                />
              </a>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] text-neutral-50 border-b border-neutral-800 pb-1 hover:border-neutral-100 hover:text-neutral-100 transition-colors duration-150"
          >
            {t('viewAllReleases')}
            <ArrowRight size={13} aria-hidden />
          </a>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-dimmer leading-relaxed">
          {t('latestNote')}
        </p>
      </div>

      {/* Phone & tablet — installable web app (PWA) */}
      <div id="mobile-install" className="relative max-w-3xl mx-auto mt-20 scroll-mt-24 text-left">
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.16em]">
            {t('pwaHeading')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>
        <p className="text-[15px] leading-[1.7] text-neutral-50">{t('pwaIntro')}</p>

        {installStatus === 'available' && (
          <button
            onClick={handleInstall}
            className="mt-6 inline-flex items-center gap-2.5 bg-blue-500 hover:bg-accent-strong text-white px-6 py-3.5 rounded-md text-[14px] font-medium transition-colors duration-150"
          >
            <Smartphone size={16} aria-hidden />
            {t('pwaInstallCta')}
          </button>
        )}
        {installStatus === 'installed' && (
          <p className="mt-6 font-mono text-[12px] text-green-400">{t('pwaInstalledBadge')}</p>
        )}

        <div className="mt-6 grid gap-px bg-neutral-800 border border-neutral-800 rounded-md overflow-hidden">
          <div className="flex items-start gap-4 px-5 py-4 bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/os/apple.svg" alt="" width={22} height={22} className="shrink-0 opacity-90 mt-0.5" aria-hidden />
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] text-neutral-100 font-medium">{t('pwaIosTitle')}</span>
              <span className="text-[13px] text-neutral-50 leading-[1.6] mt-0.5">{t('pwaIosBody')}</span>
            </div>
          </div>
          <div className="flex items-start gap-4 px-5 py-4 bg-neutral-900">
            <Smartphone size={22} className="shrink-0 text-neutral-100 opacity-90 mt-0.5" aria-hidden />
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] text-neutral-100 font-medium">{t('pwaAndroidTitle')}</span>
              <span className="text-[13px] text-neutral-50 leading-[1.6] mt-0.5">{t('pwaAndroidBody')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* About + requirements + install — helpful content (also gives crawlers real text to index) */}
      <div className="relative max-w-3xl mx-auto mt-20 space-y-14 text-left">
        {/* What is Remnus Desktop */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.16em]">
              {t('aboutHeading')}
            </span>
            <span className="flex-1 h-px bg-neutral-800" />
          </div>
          <p className="text-[15px] leading-[1.7] text-neutral-50">{t('aboutBody')}</p>
        </div>

        {/* System requirements */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.16em]">
              {t('requirementsHeading')}
            </span>
            <span className="flex-1 h-px bg-neutral-800" />
          </div>
          <div className="grid gap-px bg-neutral-800 border border-neutral-800 rounded-md overflow-hidden">
            {[
              { logo: '/os/windows.svg', title: 'reqWindowsTitle', body: 'reqWindowsBody' },
              { logo: '/os/apple.svg', title: 'reqMacTitle', body: 'reqMacBody' },
              { logo: '/os/linux.svg', title: 'reqLinuxTitle', body: 'reqLinuxBody' },
            ].map((r) => (
              <div key={r.title} className="flex items-start gap-4 px-5 py-4 bg-neutral-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.logo} alt="" width={22} height={22} className="shrink-0 opacity-90 mt-0.5" aria-hidden />
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] text-neutral-100 font-medium">
                    {t(r.title as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-[13px] text-neutral-50 leading-[1.6] mt-0.5">
                    {t(r.body as Parameters<typeof t>[0])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Installation notes */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.16em]">
              {t('installHeading')}
            </span>
            <span className="flex-1 h-px bg-neutral-800" />
          </div>
          <div className="space-y-5">
            {[
              { title: 'installWindowsTitle', body: 'installWindowsBody' },
              { title: 'installMacTitle', body: 'installMacBody' },
              { title: 'installLinuxTitle', body: 'installLinuxBody' },
            ].map((s) => (
              <div key={s.title}>
                <h3 className="text-[14px] text-neutral-100 font-medium mb-1">
                  {t(s.title as Parameters<typeof t>[0])}
                </h3>
                <p className="text-[13px] text-neutral-50 leading-[1.7]">
                  {t(s.body as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
