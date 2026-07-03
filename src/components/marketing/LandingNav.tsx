import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import LandingThemeToggle from './LandingThemeToggle';
import PwaNavButton from './PwaNavButton';
import ResourcesNavDropdown from './ResourcesNavDropdown';

export default async function LandingNav() {
  const t = await getTranslations('Landing');
  const session = await auth();
  const isAuthed = !!session?.user;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950">
      <div className="px-4 sm:px-8 lg:px-14 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 lg:gap-7">
          <Link href="/" className="inline-flex items-center gap-2.5 shrink-0">
            <Image src="/logo-square-transparent.png" alt="Remnus" width={22} height={22} className="block" />
            <span className="font-sans font-semibold text-base tracking-[-0.01em] text-neutral-100">
              Remnus
            </span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-amber-400/70 bg-amber-500/8 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0 tracking-wide">
            {t('earlyAccess')}
          </span>

          <span className="flex-1" />

          <nav className="hidden lg:flex items-center gap-5 xl:gap-6.5 text-[13.5px] text-neutral-50">
            <Link href="/#integrations" className="transition-colors duration-150 hover:text-neutral-100">
              {t('bridgeNavIntegrations')}
            </Link>
            <ResourcesNavDropdown
              label={t('bridgeNavResources')}
              wikiTitle={t('bridgeNavWiki')}
              wikiDesc={t('bridgeNavResourcesWikiDesc')}
              docsTitle={t('bridgeNavDocs')}
              docsDesc={t('bridgeNavResourcesDocsDesc')}
            />
            {[
              { key: 'bridgeNavPricing',  href: '/pricing'  },
              { key: 'bridgeNavDownload', href: '/download' },
            ].map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="transition-colors duration-150 hover:text-neutral-100"
              >
                {t(key as Parameters<typeof t>[0])}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <PwaNavButton />

            <LandingThemeToggle label={t('navThemeToggle')} />

            <LanguageSwitcher variant="header" />

            <div className="flex items-center gap-1.5">
              {isAuthed ? (
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[13px] font-medium bg-blue-500 hover:bg-accent-strong text-white rounded-md transition-colors duration-150"
              >
                {t('navGoToApp')}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:block px-4 py-2 text-[13px] text-neutral-50 hover:text-neutral-100 transition-colors duration-150 rounded-md hover:bg-white/5"
                >
                  {t('navSignIn')}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-[13px] font-medium bg-blue-500 hover:bg-accent-strong text-white rounded-md transition-colors duration-150"
                >
                  {t('navGetStarted')}
                  <span aria-hidden className="hidden sm:inline">→</span>
                </Link>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
