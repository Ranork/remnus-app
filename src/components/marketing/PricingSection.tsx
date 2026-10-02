import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export default async function PricingSection({ compact = false }: Props) {
  const t = await getTranslations('Pricing');

  const freeFeatures = [
    t('freeFeature1'),
    t('freeFeature2'),
    t('freeFeature3'),
    t('freeFeature4'),
    t('freeFeature5'),
  ];

  const proFeatures = [
    t('proFeature1'),
    t('proFeature2'),
    t('proFeature3'),
    t('proFeature4'),
    t('proFeature5'),
  ];

  return (
    <section className="border-t border-neutral-800/60">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="text-center mb-14">
          {compact ? (
            <h2 className="text-2xl md:text-4xl font-bold text-neutral-100">{t('title')}</h2>
          ) : (
            <h1 className="text-3xl md:text-5xl font-bold text-neutral-100">{t('title')}</h1>
          )}
          <p className="mt-3 text-neutral-400 max-w-lg mx-auto">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {/* Free tier */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 flex flex-col">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-3">
                {t('freeName')}
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-neutral-100">{t('freePrice')}</span>
                <span className="text-sm text-neutral-500">{t('freePriceSuffix')}</span>
              </div>
            </div>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">{t('freeDesc')}</p>
            <ul className="flex flex-col gap-3 mb-10 flex-1">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-300">
                  <Check size={15} className="mt-0.5 shrink-0 text-green-400" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="block text-center rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500/90 transition-colors"
            >
              {t('freeCta')}
            </Link>
          </div>

          {/* Pro tier */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
                  {t('proName')}
                </p>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400">
                  {t('proBadge')}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-neutral-500">{t('proPrice')}</span>
              </div>
            </div>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">{t('proDesc')}</p>
            <ul className="flex flex-col gap-3 mb-10 flex-1">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-500">
                  <Check size={15} className="mt-0.5 shrink-0 text-neutral-600" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-600 leading-relaxed">{t('proNote')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
