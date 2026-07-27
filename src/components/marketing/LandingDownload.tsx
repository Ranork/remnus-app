import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Laptop, TabletSmartphone } from 'lucide-react';

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
            className="marketing-download-card relative flex flex-col rounded-xl border border-neutral-800 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(68,92,149,0.1) 0%, transparent 55%)' }}
          >
            <div className="p-6 lg:p-8 pb-0 flex-1">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500 ring-1 ring-inset ring-blue-500/5">
                  <TabletSmartphone size={22} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <span className="inline-flex rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-blue-500">
                    {t('bridgeDownloadMobileTag')}
                  </span>
                  <h3
                    className="m-0 mt-2.5 font-semibold text-neutral-100 text-[19px] lg:text-[21px]"
                    style={{ letterSpacing: '-0.018em' }}
                  >
                    {t('bridgeDownloadMobileTitle')}
                  </h3>
                </div>
              </div>
              <p className="m-0 mt-4 text-[13.5px] leading-[1.6] text-dim max-w-md">
                {t('bridgeDownloadMobileDesc')}
              </p>
              <Link
                href="/download#mobile-install"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-accent-strong text-white text-[13px] font-medium transition-colors duration-150"
              >
                {t('bridgeDownloadMobileCta')}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>

            {/* Phone frame with the real mobile screenshot, cropped by the card */}
            <div className="marketing-device-stage relative mt-6 lg:mt-8 h-52 lg:h-60 overflow-hidden border-t border-neutral-800/60 bg-neutral-850/40 pt-6">
              <div className="relative mx-auto w-52 sm:w-56 rounded-t-[1.65rem] border border-b-0 border-neutral-700 bg-neutral-900 p-1.5 pb-0 shadow-2xl">
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-neutral-700/80"
                />
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
            className="marketing-download-card relative flex flex-col rounded-xl border border-neutral-800 overflow-hidden"
            style={{ background: 'linear-gradient(160deg, rgba(127,195,109,0.05) 0%, transparent 55%)' }}
          >
            <div className="p-6 lg:p-8 pb-0 flex-1">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-green-400/20 bg-green-400/10 text-green-400 ring-1 ring-inset ring-green-400/5">
                  <Laptop size={22} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <span className="inline-flex rounded-full border border-green-400/25 bg-green-400/10 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-green-400">
                    {t('bridgeDownloadDesktopTag')}
                  </span>
                  <h3
                    className="m-0 mt-2.5 font-semibold text-neutral-100 text-[19px] lg:text-[21px]"
                    style={{ letterSpacing: '-0.018em' }}
                  >
                    {t('bridgeDownloadDesktopTitle')}
                  </h3>
                </div>
              </div>
              <p className="m-0 mt-4 text-[13.5px] leading-[1.6] text-dim max-w-md">
                {t('bridgeDownloadDesktopDesc')}
              </p>
              <Link
                href="/download"
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-700 text-[13px] font-medium text-neutral-50 hover:border-neutral-500 hover:text-neutral-100 transition-colors duration-150"
              >
                {t('bridgeDownloadDesktopCta')}
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </div>

            {/* Desktop screenshot in a browser-style frame, cropped by the card */}
            <div className="marketing-device-stage relative mt-6 lg:mt-8 h-52 lg:h-60 overflow-hidden border-t border-neutral-800/60 bg-neutral-850/40 pl-6 pt-6 lg:pl-8">
              <div className="rounded-tl-xl border border-b-0 border-r-0 border-neutral-700 overflow-hidden shadow-2xl">
                <div
                  aria-hidden="true"
                  className="flex h-7 items-center gap-1.5 border-b border-neutral-800 bg-neutral-900 px-3"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70" />
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400/70" />
                </div>
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
