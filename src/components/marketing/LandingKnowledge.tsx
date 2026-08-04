import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, Gauge, PackageOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const BENEFITS = [
  { icon: PackageOpen, titleKey: 'bridgeKnowledgeOpenTitle', bodyKey: 'bridgeKnowledgeOpenBody' },
  { icon: BadgeCheck, titleKey: 'bridgeKnowledgeTrustTitle', bodyKey: 'bridgeKnowledgeTrustBody' },
  { icon: Gauge, titleKey: 'bridgeKnowledgeContextTitle', bodyKey: 'bridgeKnowledgeContextBody' },
] as const;

export default async function LandingKnowledge() {
  const t = await getTranslations('Landing');

  return (
    <section id="knowledge" className="px-4 py-16 sm:px-8 lg:px-14 lg:py-[110px] bg-neutral-950">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 flex items-center gap-3 lg:mb-12">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            {t('bridgeKnowledgeSnum')}
          </span>
          <span className="h-px flex-1 bg-neutral-800" />
          <span className="hidden font-mono text-[11px] text-dim sm:block">OKF v0.2 · Context Pack v2</span>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-8 lg:mb-14 lg:grid-cols-2 lg:gap-20">
          <h2
            className="m-0 font-sans text-[32px] font-semibold leading-[0.98] text-neutral-100 sm:text-[42px] lg:text-[54px]"
            style={{ letterSpacing: '-0.035em' }}
          >
            {t('bridgeKnowledgeH2Part1')}{' '}
            <span className="font-serif text-[36px] italic text-accent-strong sm:text-[46px] lg:text-[58px]">
              {t('bridgeKnowledgeH2Accent')}
            </span>{' '}
            {t('bridgeKnowledgeH2Part2')}
          </h2>
          <div className="lg:mt-auto">
            <p className="m-0 text-[16.5px] leading-[1.65] text-neutral-50">
              {t('bridgeKnowledgeBody')}
            </p>
            <p className="mb-0 mt-3 text-[12.5px] leading-relaxed text-dim">
              {t('bridgeKnowledgeNote')}
            </p>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800 gap-px md:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, titleKey, bodyKey }) => (
            <article key={titleKey} className="flex min-h-[220px] flex-col bg-neutral-900 p-6 lg:p-8">
              <span className="mb-7 flex h-10 w-10 items-center justify-center rounded-md bg-blue-500/10 text-accent-strong">
                <Icon size={19} />
              </span>
              <h3 className="m-0 text-[18px] font-semibold text-neutral-100">{t(titleKey)}</h3>
              <p className="mb-0 mt-2 text-[13.5px] leading-[1.65] text-dim">{t(bodyKey)}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-5 py-4">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-green-400">
            {t('bridgeKnowledgeSmart')}
          </span>
          <span className="h-3 w-px bg-neutral-800" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-amber-500">
            {t('bridgeKnowledgeStrict')}
          </span>
          <span className="flex-1" />
          <Link
            href="/wiki/context-first"
            className="inline-flex items-center gap-1.5 font-mono text-[12px] text-accent-strong hover:underline"
          >
            {t('bridgeKnowledgeCta')}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
