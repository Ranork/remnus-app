import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { RotateCcw } from 'lucide-react';
import AIMark from '../AIMark';
import CopyCommand from './CopyCommand';
import { em } from './emphasis';
import SectionHead from './SectionHead';

/** How it starts: three real steps, each with the small piece of product it ends in. */
export default async function SiteSteps() {
  const t = await getTranslations('Site.steps');

  const steps = [
    {
      title: t('s1Title'),
      body: t('s1Body'),
      visual: (
        <div className="flex flex-col gap-3">
          <CopyCommand command="npx remnus init" copyLabel={t('copy')} copiedLabel={t('copied')} />
          <p className="m-0 text-ui text-fg-3">
            {t.rich('s1Alt', {
              link: (chunks) => (
                <Link href="/wiki/connect-editors" className="text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg-3">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      ),
    },
    {
      title: t('s2Title'),
      body: t('s2Body'),
      visual: (
        <div className="rounded-surface bg-sheet p-3 shadow-sheet">
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: '12', label: t('miniOpen') },
              { n: '4', label: t('miniDone') },
              { n: '3', label: t('miniDecisions') },
            ].map((tile) => (
              <div key={tile.label} className="rounded-control bg-raised px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <div className="text-xl leading-none font-semibold tracking-[-0.02em] text-fg">{tile.n}</div>
                <div className="mt-1.5 truncate text-xs text-fg-3">{tile.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            <span className="w-[56%] bg-(--chart-1)" />
            <span className="w-[19%] bg-(--chart-2)" />
            <span className="w-[25%] bg-(--chart-3)" />
          </div>
        </div>
      ),
    },
    {
      title: t('s3Title'),
      body: t('s3Body'),
      visual: (
        <ul className="m-0 list-none divide-y divide-line rounded-surface bg-sheet p-0 shadow-sheet">
          {[
            { text: t('miniMoved'), when: t('miniWhen1'), restore: true },
            { text: t('miniCreated'), when: t('miniWhen2'), restore: false },
          ].map((row) => (
            <li key={row.text} className="flex items-center gap-2.5 px-3 py-2.5 text-ui">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hover">
                <AIMark name="claude" size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate text-fg-2">{row.text}</span>
              {row.restore ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-1 text-xs text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                  <RotateCcw className="size-3" aria-hidden />
                  {t('miniRestore')}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-fg-3">{row.when}</span>
              )}
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t.rich('title', { em })} lede={t('lede')} />
        <ol className="m-0 mt-12 grid list-none grid-cols-1 gap-10 p-0 md:grid-cols-3 md:gap-8 lg:mt-16">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col border-t border-line-strong pt-6">
              <span className="flex size-7 items-center justify-center rounded-full text-ui font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]">
                {i + 1}
              </span>
              <h3 className="m-0 mt-5 text-lg font-semibold tracking-[-0.015em] text-fg">{step.title}</h3>
              <p className="m-0 mt-2 max-w-[22rem] text-[15px] leading-[1.6] text-fg-2">{step.body}</p>
              <div className="mt-6">{step.visual}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
