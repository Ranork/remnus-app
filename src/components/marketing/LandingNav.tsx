import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';

export default async function LandingNav() {
  const t = await getTranslations('Landing');
  const session = await auth();
  const isAuthed = !!session?.user;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950">
      <div className="px-4 sm:px-8 lg:px-14 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4 lg:gap-7">
          <Link href="/" className="inline-flex items-center gap-2.5 shrink-0">
            <Image src="/logo-square-transparent.png" alt="Remnus" width={22} height={22} className="block" />
            <span className="font-sans font-semibold text-base tracking-[-0.01em] text-neutral-100">
              Remnus
            </span>
          </Link>

          <span className="font-mono text-[11px] text-dimmer tracking-widest ml-2 hidden md:block">
            {t('bridgeNavCaption')}
          </span>

          <span className="flex-1" />

          <nav className="hidden lg:flex items-center gap-6.5 text-[13.5px] text-neutral-50">
            {[
              { key: 'bridgeNavWhyRemnus',    href: '#why'          },
              { key: 'bridgeNavIntegrations', href: '#integrations'  },
              { key: 'bridgeNavMcp',          href: '#tools'         },
              { key: 'bridgeNavPricing',      href: '#pricing'       },
              { key: 'bridgeNavDownload',     href: '/download'      },
              // { key: 'bridgeNavDocs',         href: '#'              },
            ].map(({ key, href }) => (
              href.startsWith('/') ? (
                <Link
                  key={key}
                  href={href}
                  className="transition-colors duration-150 hover:text-neutral-100"
                >
                  {t(key as Parameters<typeof t>[0])}
                </Link>
              ) : (
                <a
                  key={key}
                  href={href}
                  className="transition-colors duration-150 hover:text-neutral-100"
                >
                  {t(key as Parameters<typeof t>[0])}
                </a>
              )
            ))}
          </nav>

          <LanguageSwitcher variant="header" />

          <div className="flex items-center gap-2">
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
    </header>
  );
}
