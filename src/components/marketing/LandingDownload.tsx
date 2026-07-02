import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { Smartphone, Monitor } from 'lucide-react';

/**
 * Landing section 08 — "Take Remnus everywhere". Shows desktop visitors that
 * Remnus also installs on phones/tablets (PWA) next to the native desktop app,
 * with the real app screenshots peeking out of each card.
 */
export default async function LandingDownload() {
  const t = await getTranslations('Landing');

  return (
    <section id="apps" className="px-4 sm:px-8 lg:px-14 py-16 lg:py-27.5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
            {t('bridgeDownloadSnum')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>

        <h2
          className="m-0 font-sans font-semibold text-neutral-100 leading-[0.98] text-[30px] sm:text-[36px] lg:text-[44px]"
          style={{ letterSpacing: '-0.035em' }}
        >
          {t('bridgeDownloadH2Part1')}{' '}
          <span className="font-serif italic text-accent-strong text-[34px] sm:text-[40px] lg:text-[48px]">
            {t('bridgeDownloadH2Accent')}
          </span>
        </h2>

        {/* Two platform cards */}
        <div className="mt-10 lg:mt-12 grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-stretch">
          {/* Phone & tablet — installable web app */}
          <div
            className="relative flex flex-col rounded-xl border border-neutral-800 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(68,92,149,0.1) 0%, transparent 55%)' }}
          >
            <div className="p-6 lg:p-8 pb-0 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                  <Smartphone size={17} className="text-blue-300" />
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{
                    color: 'var(--color-blue-500)',
                    background: 'rgba(68,92,149,0.1)',
                    border: '1px solid rgba(68,92,149,0.45)',
                  }}
                >
                  {t('bridgeDownloadMobileTag')}
                </span>
              </div>
              <h3
                className="m-0 font-semibold text-neutral-100 text-[19px] lg:text-[21px]"
                style={{ letterSpacing: '-0.018em' }}
              >
                {t('bridgeDownloadMobileTitle')}
              </h3>
              <p className="m-0 mt-2.5 text-[13.5px] leading-[1.6] text-dim max-w-md">
                {t('bridgeDownloadMobileDesc')}
              </p>
              <Link
                href="/download#mobile-install"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-accent-strong text-white text-[13px] font-medium transition-colors duration-150"
              >
                {t('bridgeDownloadMobileCta')}
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Phone frame with the real mobile screenshot, cropped by the card */}
            <div className="relative mt-6 lg:mt-8 h-52 lg:h-60 overflow-hidden">
              <div className="mx-auto w-52 sm:w-56 rounded-t-[1.6rem] border border-b-0 border-neutral-700 bg-neutral-900 p-1.5 pb-0 shadow-2xl">
                <Image
                  src="/screenshots/mobile-board.png"
                  alt={t('bridgeDownloadMobileTitle')}
                  width={390}
                  height={844}
                  className="w-full rounded-t-[1.1rem] object-cover object-top"
                />
              </div>
            </div>
          </div>

          {/* Desktop — native app */}
          <div
            className="relative flex flex-col rounded-xl border border-neutral-800 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(127,195,109,0.05) 0%, transparent 55%)' }}
          >
            <div className="p-6 lg:p-8 pb-0 flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="w-9 h-9 rounded-lg bg-neutral-950/60 border border-neutral-800 flex items-center justify-center">
                  <Monitor size={17} className="text-neutral-300" />
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{
                    color: 'var(--color-green-400)',
                    background: 'rgba(127,195,109,0.08)',
                    border: '1px solid rgba(127,195,109,0.35)',
                  }}
                >
                  {t('bridgeDownloadDesktopTag')}
                </span>
              </div>
              <h3
                className="m-0 font-semibold text-neutral-100 text-[19px] lg:text-[21px]"
                style={{ letterSpacing: '-0.018em' }}
              >
                {t('bridgeDownloadDesktopTitle')}
              </h3>
              <p className="m-0 mt-2.5 text-[13.5px] leading-[1.6] text-dim max-w-md">
                {t('bridgeDownloadDesktopDesc')}
              </p>
              <Link
                href="/download"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-[13px] font-medium text-neutral-50 hover:border-neutral-500 hover:text-neutral-100 transition-colors duration-150"
              >
                {t('bridgeDownloadDesktopCta')}
                <span aria-hidden>→</span>
              </Link>
            </div>

            {/* Desktop screenshot in a browser-style frame, cropped by the card */}
            <div className="relative mt-6 lg:mt-8 h-52 lg:h-60 overflow-hidden pl-6 lg:pl-8">
              <div className="rounded-tl-xl border border-b-0 border-r-0 border-neutral-700 overflow-hidden shadow-2xl">
                <Image
                  src="/screenshots/desktop-board.png"
                  alt={t('bridgeDownloadDesktopTitle')}
                  width={1280}
                  height={800}
                  className="w-full object-cover object-top-left"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
