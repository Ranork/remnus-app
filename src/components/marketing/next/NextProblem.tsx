import { ArrowUpRight, FileDiff, MessagesSquare } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Headline, Kicker, Section } from './parts';
import ThemedLogo from './ThemedLogo';

export default async function NextProblem() {
  const t = await getTranslations('LandingNext.problem');

  const columns = [
    { key: 'diffs', icon: <FileDiff size={18} />, title: t('diffsTitle'), body: t('diffsBody'), verdict: t('diffsVerdict'), strong: false },
    { key: 'chat', icon: <MessagesSquare size={18} />, title: t('chatTitle'), body: t('chatBody'), verdict: t('chatVerdict'), strong: false },
    {
      key: 'remnus',
      icon: <ThemedLogo size={18} />,
      title: t('remnusTitle'),
      body: t('remnusBody'),
      verdict: t('remnusVerdict'),
      strong: true,
    },
  ];

  return (
    <Section id="problem">
      <div className="grid gap-12 lg:grid-cols-[1.3fr_0.7fr] lg:gap-20 lg:items-center mb-14 lg:mb-20">
        <div className="flex flex-col gap-6">
          <Kicker>{t('kicker')}</Kicker>
          <Headline pre={t('titlePre')} accent={t('titleAccent')} />
          <p className="m-0 max-w-[60ch] text-[17px] leading-[1.65] text-neutral-50">{t('body')}</p>
          <a
            href="https://addyosmani.com/blog/comprehension-debt/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 font-mono text-[12px] text-accent-strong hover:underline"
          >
            {t('sourceLabel')}
            <ArrowUpRight size={13} />
          </a>
        </div>

        <figure className="m-0 flex flex-col gap-2 border-l-2 border-accent-strong pl-6">
          <span
            className="font-sans font-semibold text-neutral-100 leading-none text-[72px] lg:text-[96px] tabular-nums"
            style={{ letterSpacing: '-0.05em' }}
          >
            {t('stat')}
          </span>
          <span className="text-[15px] text-neutral-50">{t('statLabel')}</span>
          <a
            href="https://getdx.com/blog/the-state-of-ai-impact-in-engineering-q2-2026/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-dim hover:text-neutral-50"
          >
            {t('statSource')}
          </a>
        </figure>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {columns.map((c) => (
          <article
            key={c.key}
            className={`flex flex-col gap-4 rounded-xl border p-6 lg:p-7 ${
              c.strong ? 'border-blue-500/50 bg-blue-500/[0.07]' : 'border-neutral-800 bg-neutral-900'
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                c.strong ? 'bg-blue-500/15 text-accent-strong' : 'bg-neutral-800/60 text-dim'
              }`}
            >
              {c.icon}
            </span>
            <h3 className="m-0 text-[18px] font-semibold tracking-[-0.015em] text-neutral-100">{c.title}</h3>
            <p className="m-0 flex-1 text-[14.5px] leading-[1.6] text-dim">{c.body}</p>
            <span
              className={`font-mono text-[11.5px] uppercase tracking-[0.1em] ${c.strong ? 'text-accent-strong' : 'text-dim'}`}
            >
              {c.strong ? '✓ ' : '× '}
              {c.verdict}
            </span>
          </article>
        ))}
      </div>

      <p
        className="mt-14 lg:mt-16 mb-0 text-center font-serif italic text-[28px] lg:text-[36px] text-neutral-100"
        style={{ letterSpacing: '-0.02em' }}
      >
        {t('closing')}
      </p>
    </Section>
  );
}
