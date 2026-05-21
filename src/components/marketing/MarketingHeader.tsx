'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/features/LanguageSwitcher';

interface Props {
  user?: { name: string | null; email: string | null } | null;
}

export default function MarketingHeader({ user }: Props) {
  const t = useTranslations('Landing');
  const [menuOpen, setMenuOpen] = useState(false);

  const displayName = user?.name || user?.email?.split('@')[0] || null;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo-square-dark.png" alt="Remnus" width={28} height={28} className="rounded-md" />
          <span className="text-base font-semibold text-neutral-100">Remnus</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors">
            {t('navHome')}
          </Link>
          <Link href="/pricing" className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors">
            {t('navPricing')}
          </Link>
          <Link href="/contact" className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors">
            {t('navContact')}
          </Link>
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-2">
          <LanguageSwitcher variant="header" />

          <div className="w-px h-4 bg-neutral-700 mx-1" />

          {user ? (
            <>
              <span className="text-sm text-neutral-400 max-w-32 truncate">{displayName}</span>
              <Link
                href="/app"
                className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
              >
                {t('navGoToApp')}
                <ArrowRight size={14} />
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors">
                {t('navSignIn')}
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-md bg-blue-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
              >
                {t('navGetStarted')}
                <ArrowRight size={14} />
              </Link>
            </>
          )}
        </div>

        {/* Mobile: language + toggle */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageSwitcher variant="header" />
          <button
            className="flex items-center justify-center w-8 h-8 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-neutral-800 bg-neutral-950 px-4 py-3 flex flex-col gap-1">
          <Link href="/" className="px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors" onClick={() => setMenuOpen(false)}>
            {t('navHome')}
          </Link>
          <Link href="/pricing" className="px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors" onClick={() => setMenuOpen(false)}>
            {t('navPricing')}
          </Link>
          <Link href="/contact" className="px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors" onClick={() => setMenuOpen(false)}>
            {t('navContact')}
          </Link>

          <div className="border-t border-neutral-800 mt-2 pt-3 flex flex-col gap-2">
            {user ? (
              <>
                <p className="px-3 text-xs text-neutral-500">{displayName}</p>
                <Link
                  href="/app"
                  className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('navGoToApp')}
                  <ArrowRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="px-3 py-2 text-sm text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50 rounded-md transition-colors" onClick={() => setMenuOpen(false)}>
                  {t('navSignIn')}
                </Link>
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-1.5 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-400 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {t('navGetStarted')}
                  <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
