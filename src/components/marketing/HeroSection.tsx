import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight } from 'lucide-react';

export default async function HeroSection() {
  const t = await getTranslations('Landing');

  return (
    <section className="relative overflow-hidden">
      {/* Subtle radial glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-125 w-225 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-36 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 mb-8">
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-xs text-neutral-400">Open source · Free to use</span>
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-100 leading-tight">
          {t('heroTitle').split('\n').map((line, i) => (
            <span key={i}>
              {i === 1 ? <span className="text-blue-500"> {line}</span> : line}
              {i === 0 && <br />}
            </span>
          ))}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg md:text-xl text-neutral-400 leading-relaxed">
          {t('heroSubtitle')}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500/90 transition-colors"
          >
            {t('heroCtaPrimary')}
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-6 py-3 text-sm font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
          >
            {t('heroCtaSecondary')}
          </Link>
        </div>

        <p className="mt-5 text-xs text-neutral-600">{t('heroNote')}</p>
      </div>
    </section>
  );
}
