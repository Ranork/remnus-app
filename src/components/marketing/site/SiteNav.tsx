import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';
import { buttonVariants } from '@/components/ui/button';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';
import LandingThemeToggle from '../LandingThemeToggle';
import SiteMobileMenu from './SiteMobileMenu';

export type SiteLink = { label: string; href: string };

/** The site's top bar: brand, five plain links, then theme, language and the two ways in. */
export default async function SiteNav({ home }: { home: string }) {
  const t = await getTranslations('Site.nav');
  const tLanding = await getTranslations('Landing');
  const session = await auth();
  const isAuthed = !!session?.user;

  const links: SiteLink[] = [
    { label: t('product'), href: `${home}#product` },
    { label: t('docs'), href: '/wiki' },
    { label: t('blog'), href: '/docs' },
    { label: t('pricing'), href: '/pricing' },
    { label: t('download'), href: '/download' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-desk/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:px-8">
        <Link href={home} className="mr-4 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-fg">
          <RemnusMark className="size-[18px]" />
          Remnus
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-control px-3 py-2 text-sm text-fg-2 transition-colors duration-150 hover:bg-hover hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="flex-1" />

        <LandingThemeToggle
          label={tLanding('navThemeToggle')}
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'cursor-pointer')}
        />
        <LanguageSwitcher variant="compact" />

        {isAuthed ? (
          <Link href="/app" className={cn(buttonVariants({ variant: 'primary' }), 'ml-1')}>
            {t('openApp')}
          </Link>
        ) : (
          <>
            <Link href="/login" className={cn(buttonVariants({ variant: 'ghost' }), 'hidden text-fg-2 sm:inline-flex')}>
              {t('signIn')}
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: 'primary' }), 'ml-1')}>
              {t('start')}
            </Link>
          </>
        )}

        <SiteMobileMenu label={t('menu')} links={links} signIn={isAuthed ? null : { label: t('signIn'), href: '/login' }} />
      </div>
    </header>
  );
}
