import { ArrowUpRight, Check, FileDiff, MessagesSquare, X } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';
import { em } from './emphasis';
import SectionHead from './SectionHead';

/**
 * The problem the rest of the page answers: comprehension debt. One sourced number, the
 * two ways people try to keep up today, and Remnus — the one column ruled in signal.
 */
export default async function SiteProblem() {
  const t = await getTranslations('Site.problem');
  const ways = [
    { key: 'diffs', icon: <FileDiff />, title: t('diffsTitle'), body: t('diffsBody'), verdict: t('diffsVerdict'), ours: false },
    { key: 'chat', icon: <MessagesSquare />, title: t('chatTitle'), body: t('chatBody'), verdict: t('chatVerdict'), ours: false },
    { key: 'remnus', icon: <RemnusMark />, title: t('remnusTitle'), body: t('remnusBody'), verdict: t('remnusVerdict'), ours: true },
  ];

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t.rich('title', { em })} lede={t('lede')} />

        <div className="mt-12 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          <figure className="m-0 border-t border-line-strong py-6">
            <div className="text-[56px] leading-none font-semibold tracking-[-0.045em] text-fg tabular-nums lg:text-[64px]">{t('stat')}</div>
            <figcaption className="mt-3 text-[15px] leading-[1.5] text-fg-2">{t('statLabel')}</figcaption>
            <a
              href="https://getdx.com/blog/the-state-of-ai-impact-in-engineering-q2-2026/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-xs text-fg-3 transition-colors hover:text-fg-2"
            >
              {t('statSource')}
            </a>
          </figure>

          {ways.map((way) => (
            <div key={way.key} className={cn('py-6', way.ours ? 'border-t-2 border-signal' : 'border-t border-line-strong')}>
              <span className="flex size-8 items-center justify-center rounded-control bg-raised text-fg-2 shadow-[inset_0_0_0_1px_var(--color-line)] [&_svg]:size-4">
                {way.icon}
              </span>
              <h3 className="m-0 mt-4 text-lg font-semibold tracking-[-0.015em] text-fg">{way.title}</h3>
              <p className="m-0 mt-2 text-[15px] leading-[1.6] text-fg-2">{way.body}</p>
              <p className={cn('m-0 mt-4 flex items-center gap-1.5 text-ui', way.ours ? 'font-medium text-fg' : 'text-fg-3')}>
                {way.ours ? <Check className="size-4 text-signal-text" aria-hidden /> : <X className="size-4" aria-hidden />}
                {way.verdict}
              </p>
            </div>
          ))}
        </div>

        <a
          href="https://addyosmani.com/blog/comprehension-debt/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-fg-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-fg hover:decoration-fg-3"
        >
          {t('sourceLabel')}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}
