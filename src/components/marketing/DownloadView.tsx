'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { Download, Smartphone } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { GitHubMark } from '@/components/ui/github-mark';
import { cn } from '@/lib/cn';
import PageHead from './site/PageHead';
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
    <section className="px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
        <PageHead align="center" title={t('title')} lede={t('subtitle')} />

        {/* The smart primary action for this device: centred, big, the page's one yellow. Its
            row keeps its height while the OS is detected, so nothing below jumps. */}
        <div className="mt-9 flex min-h-[5.75rem] flex-col items-center gap-3 sm:min-h-[6.25rem]">
          {!ready ? (
            <span className="flex h-12 items-center text-ui text-fg-3 sm:h-14">{t('detecting')}</span>
          ) : isMobileOs ? (
            <>
              {installStatus === 'installed' ? (
                <span className="flex h-12 items-center text-ui font-medium text-green-400 sm:h-14">{t('pwaInstalledBadge')}</span>
              ) : installStatus === 'available' ? (
                <Button variant="signal" size="lg" onClick={handleInstall} className={HERO_ACTION}>
                  <Smartphone aria-hidden />
                  {t('pwaInstallCta')}
                </Button>
              ) : (
                <a href="#mobile-install" className={cn(buttonVariants({ variant: 'signal', size: 'lg' }), HERO_ACTION)}>
                  <Smartphone aria-hidden />
                  {t('pwaInstallCta')}
                </a>
              )}
              <span className="text-ui text-fg-3">{t('yourSystemBadge')}</span>
            </>
          ) : primary ? (
            <>
              <a
                href={downloadUrl(primary.file)}
                onClick={() => posthog?.capture('desktop_download_clicked', { os, file: primary.file, surface: 'download_page_primary' })}
                className={cn(buttonVariants({ variant: 'signal', size: 'lg' }), HERO_ACTION)}
              >
                <OsLogo src={primary.logo} className="size-5" />
                {t('downloadFor', { os: t(primary.osKey as Parameters<typeof t>[0]) })}
              </a>
              <span className="text-ui text-fg-3">{t('yourSystemBadge')}</span>
            </>
          ) : (
            <span className="flex h-12 items-center text-ui text-fg-3 sm:h-14">{t('chooseBelow')}</span>
          )}
        </div>

        <DownloadStage desktopAlt={t('stageDesktopAlt')} phoneAlt={t('stagePhoneAlt')} />

        <div className="mt-16 grid gap-14 lg:mt-20 lg:grid-cols-2 lg:gap-12">
          {/* All desktop platforms */}
          <div>
            <h2 className={headCls}>{t('allPlatforms')}</h2>
            <ul className={listCls}>
              {PLATFORMS.map((p) => (
                <li key={p.id}>
                  <a
                    href={downloadUrl(p.file)}
                    onClick={() => posthog?.capture('desktop_download_clicked', { os: coarseOs(p.id), file: p.file, surface: 'download_page_grid' })}
                    className="group flex items-center gap-4 px-5 py-4 transition-colors duration-150 hover:bg-hover/50"
                  >
                    <OsLogo src={p.logo} className="size-5 text-fg-2" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium text-fg">{t(p.labelKey as Parameters<typeof t>[0])}</span>
                      <span className="font-mono text-xs text-fg-3">{t(p.hintKey as Parameters<typeof t>[0])}</span>
                    </span>
                    <Download size={16} className="ml-auto shrink-0 text-fg-3 transition-colors group-hover:text-fg" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-ui text-fg-3">{t('latestNote')}</span>
              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg-3"
              >
                <GitHubMark />
                {t('viewAllReleases')}
              </a>
            </div>
          </div>

          {/* Phone & tablet — installable web app (PWA) */}
          <div id="mobile-install" className="scroll-mt-24">
            <h2 className={headCls}>{t('pwaHeading')}</h2>
            <p className="m-0 mb-5 text-[15px] leading-[1.65] text-fg-2">{t('pwaIntro')}</p>
            {installStatus === 'installed' && <p className="m-0 mb-5 text-ui font-medium text-green-400">{t('pwaInstalledBadge')}</p>}
            <ul className={listCls}>
              <li className="flex items-start gap-4 px-5 py-4">
                <OsLogo src="/os/apple.svg" className="mt-0.5 size-5 text-fg-2" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">{t('pwaIosTitle')}</span>
                  <span className="mt-0.5 text-ui leading-[1.6] text-fg-2">{t('pwaIosBody')}</span>
                </span>
              </li>
              <li className="flex items-start gap-4 px-5 py-4">
                <Smartphone size={20} className="mt-0.5 shrink-0 text-fg-2" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">{t('pwaAndroidTitle')}</span>
                  <span className="mt-0.5 text-ui leading-[1.6] text-fg-2">{t('pwaAndroidBody')}</span>
                  {/* Android Chrome: one tap opens the browser's own "add to home screen" prompt.
                      Without the prompt (installed, or another browser) the steps above stand. */}
                  {os === 'android' && installStatus === 'available' && (
                    <Button variant="signal" onClick={handleInstall} className="mt-3 w-fit">
                      <Smartphone aria-hidden />
                      {t('pwaAndroidAdd')}
                    </Button>
                  )}
                </span>
              </li>
            </ul>
            {/* On a computer: scan to open this section on the phone, where the prompt above works. */}
            {!isMobileOs && (
              <div className="mt-4 hidden items-center gap-5 rounded-[14px] bg-sheet p-4 shadow-sheet sm:flex">
                <Image
                  src="/marketing/qr-mobile-install.svg"
                  alt={t('pwaQrAlt')}
                  width={120}
                  height={120}
                  unoptimized
                  className="size-[120px] shrink-0 rounded-control"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">{t('pwaQrTitle')}</span>
                  <span className="mt-1 text-ui leading-[1.6] text-fg-2">{t('pwaQrBody')}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* About + requirements + install — helpful content (also gives crawlers real text to index) */}
        <div className="mt-20 grid gap-14 border-t border-line-strong pt-14 lg:grid-cols-3 lg:gap-10">
          <div>
            <h2 className={headCls}>{t('aboutHeading')}</h2>
            <p className="m-0 text-[15px] leading-[1.65] text-fg-2">{t('aboutBody')}</p>
          </div>
          <div>
            <h2 className={headCls}>{t('requirementsHeading')}</h2>
            <ul className="m-0 list-none space-y-4 p-0">
              {[
                { logo: '/os/windows.svg', title: 'reqWindowsTitle', body: 'reqWindowsBody' },
                { logo: '/os/apple.svg', title: 'reqMacTitle', body: 'reqMacBody' },
                { logo: '/os/linux.svg', title: 'reqLinuxTitle', body: 'reqLinuxBody' },
              ].map((r) => (
                <li key={r.title} className="flex items-start gap-3">
                  <OsLogo src={r.logo} className="mt-0.5 size-4 text-fg-3" />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-fg">{t(r.title as Parameters<typeof t>[0])}</span>
                    <span className="text-ui leading-[1.6] text-fg-2">{t(r.body as Parameters<typeof t>[0])}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={headCls}>{t('installHeading')}</h2>
            <div className="space-y-4">
              {[
                { title: 'installWindowsTitle', body: 'installWindowsBody' },
                { title: 'installMacTitle', body: 'installMacBody' },
                { title: 'installLinuxTitle', body: 'installLinuxBody' },
              ].map((s) => (
                <div key={s.title}>
                  <h3 className="m-0 text-sm font-medium text-fg">{t(s.title as Parameters<typeof t>[0])}</h3>
                  <p className="m-0 mt-0.5 text-ui leading-[1.6] text-fg-2">{t(s.body as Parameters<typeof t>[0])}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const headCls = 'm-0 mb-4 text-lg font-semibold tracking-[-0.015em] text-fg';
const HERO_ACTION = 'h-12 px-6 text-base sm:h-14 sm:px-8 sm:text-[17px] [&_svg]:size-5';
const listCls = 'm-0 list-none divide-y divide-line overflow-hidden rounded-[14px] bg-sheet p-0 shadow-sheet';

/**
 * The page's picture, like the landing's hero stage: the desktop app on the desk and the
 * phone in front of it, from the real screenshots (one file per theme, `.site-shot-*`; the
 * hidden one is lazy and never loads). The phone hangs below the window by the figure's
 * bottom padding and stays inside the column, so nothing scrolls sideways.
 */
function DownloadStage({ desktopAlt, phoneAlt }: { desktopAlt: string; phoneAlt: string }) {
  return (
    <figure className="site-stage-glow relative m-0 mx-auto mt-10 max-w-[1080px] pb-10 sm:pb-14 lg:mt-14">
      <div className="mr-[8%] overflow-hidden rounded-[14px] bg-desk shadow-modal ring-1 ring-line-strong sm:mr-[10%]">
        {(['dark', 'light'] as const).map((tone) => (
          <Image
            key={tone}
            src={`/marketing/app-board-${tone}.webp`}
            alt={desktopAlt}
            width={2400}
            height={1500}
            sizes="(min-width: 1240px) 980px, 92vw"
            className={`site-shot-${tone} h-auto w-full`}
          />
        ))}
      </div>
      <div className="absolute right-0 bottom-0 w-[26%] max-w-[240px] min-w-[96px]">
        <div className="overflow-hidden rounded-[20px] bg-desk p-1 shadow-modal ring-1 ring-line-strong sm:rounded-[30px] sm:p-1.5">
          {(['dark', 'light'] as const).map((tone) => (
            <Image
              key={tone}
              src={`/marketing/app-phone-${tone}.webp`}
              alt={phoneAlt}
              width={780}
              height={1688}
              sizes="(min-width: 1240px) 240px, 26vw"
              className={`site-shot-${tone} h-auto w-full rounded-[16px] sm:rounded-[24px]`}
            />
          ))}
        </div>
      </div>
    </figure>
  );
}

/** The OS marks are single-colour SVGs; drawn as a mask so they take the text colour in both themes. */
function OsLogo({ src, className }: { src: string; className?: string }) {
  const mask = `url(${src}) center / contain no-repeat`;
  return <span aria-hidden className={cn('inline-block shrink-0 bg-current', className)} style={{ mask, WebkitMask: mask }} />;
}
