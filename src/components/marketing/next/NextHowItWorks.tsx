import { getTranslations } from 'next-intl/server';
import AgentPrompt, { PROMPT_REQUEST } from './AgentPrompt';
import { Section, SectionHead } from './parts';
import styles from './landing-next.module.css';

export default async function NextHowItWorks() {
  const t = await getTranslations('LandingNext.how');
  const th = await getTranslations('LandingNext.hero');
  const terminal = t.raw('terminal') as string[];

  const steps = [
    { title: t('s1Title'), body: t('s1Body') },
    { title: t('s2Title'), body: t('s2Body') },
    { title: t('s3Title'), body: t('s3Body') },
  ];

  return (
    <Section id="how">
      <SectionHead kicker={t('kicker')} pre={t('titlePre')} accent={t('titleAccent')} />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 lg:items-start">
        {/* The three steps are a real sequence, so they are numbered. */}
        <ol className="m-0 flex list-none flex-col p-0">
          {steps.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[44px_1fr] gap-4 border-t border-neutral-800 py-7 first:border-t-0 first:pt-0">
              <span className="pt-[5px] font-mono text-[13px] leading-none text-accent-strong tabular-nums">0{i + 1}</span>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="m-0 text-[19px] font-semibold leading-[1.25] tracking-[-0.015em] text-neutral-100">{s.title}</h3>
                <p className="m-0 text-[15px] leading-[1.6] text-dim">{s.body}</p>
                {i === 0 && (
                  <div className="mt-3">
                    <AgentPrompt label={th('promptLabel')} copyLabel={th('promptCopy')} copiedLabel={th('promptCopied')} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        {/* What happens after the prompt: the agent, not the human, runs the CLI. */}
        <div
          className="overflow-hidden rounded-xl border font-mono text-[13px] lg:sticky lg:top-24"
          style={{ background: '#0c0d10', borderColor: '#23262c', color: '#cfd3da' }}
        >
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: '#23262c' }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full opacity-80" style={{ background: c }} />
            ))}
            <span className="ml-3 text-[11.5px]" style={{ color: '#6f7480' }}>claude · ~/acme-api</span>
          </div>
          <div className="flex flex-col gap-2 p-5 leading-[1.5]">
            <span className="rounded-md px-3 py-2" style={{ background: '#15171c', color: '#dfe2e8' }}>
              <span style={{ color: '#8aa3d8' }}>› </span>
              {PROMPT_REQUEST}
            </span>
            <span className="mt-1" style={{ color: '#e08a6c' }}>● <span style={{ color: '#cfd3da' }}>{t('termReading')}</span></span>
            <span>
              <span style={{ color: '#6f7480' }}>$ </span>npx remnus init
            </span>
            {terminal.map((line) => (
              <span key={line} style={{ color: line.startsWith('✓') ? '#7fc36d' : '#8a8f9a' }}>
                {line}
              </span>
            ))}
            <span className="mt-1" style={{ color: '#e08a6c' }}>
              ● <span style={{ color: '#8aa3d8' }}>{t('termDone')}</span>
              <span className={`${styles.caret} ml-1.5`} aria-hidden style={{ color: '#8aa3d8' }} />
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
