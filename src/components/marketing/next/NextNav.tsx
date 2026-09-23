import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import LandingThemeToggle from '../LandingThemeToggle';
import PwaNavButton from '../PwaNavButton';
import ResourcesNavDropdown from '../ResourcesNavDropdown';
import ThemedLogo from './ThemedLogo';

// Draft copy of LandingNav for /landing-next. Same chrome, but the in-page links
// point at this page's own sections instead of the live landing's anchors.
export default async function NextNav() {
  const t = await getTranslations('Landing');
  const tn = await getTranslations('LandingNext.nav');
  const session = await auth();
  const isAuthed = !!session?.user;

  const links = [
    { label: tn('how'), href: '#how' },
    { label: tn('dashboards'), href: '#dashboards' },
    { label: tn('trust'), href: '#trust' },
  ];

  return (
    <header className="marketing-nav sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950">
      <div className="px-4 sm:px-8 lg:px-14 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-4 lg:gap-7">
          <Link href="/landing-next" className="inline-flex items-center gap-2.5 shrink-0">
            <ThemedLogo size={22} alt="Remnus" />
            <span className="font-sans font-semibold text-base tracking-[-0.01em] text-neutral-100">Remnus</span>
          </Link>

          <span className="flex-1" />

          <nav className="hidden lg:flex items-center gap-5 xl:gap-6.5 text-[13.5px] text-neutral-50">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors duration-150 hover:text-neutral-100">
                {l.label}
              </a>
            ))}
            <ResourcesNavDropdown
              label={t('bridgeNavResources')}
              wikiTitle={t('bridgeNavWiki')}
              wikiDesc={t('bridgeNavResourcesWikiDesc')}
              docsTitle={t('bridgeNavDocs')}
              docsDesc={t('bridgeNavResourcesDocsDesc')}
            />
            <Link href="/pricing" className="transition-colors duration-150 hover:text-neutral-100">
              {t('bridgeNavPricing')}
            </Link>
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
                    className="hidden sm:block px-4 py-2 text-[13px] text-neutral-50 hover:text-neutral-100 transition-colors duration-150 rounded-md hover:bg-neutral-900"
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
