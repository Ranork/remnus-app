import { Fragment } from 'react';
import { ArrowRight, Check, History, Lock, ScrollText } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import AIMark from '../AIMark';
import { Section, SectionHead, StatusPill } from './parts';
import styles from './landing-next.module.css';

export default async function NextFinalSay() {
  const t = await getTranslations('LandingNext.finalSay');

  const facts = [
    { icon: History, text: t('f1') },
    { icon: Lock, text: t('f2') },
    { icon: ScrollText, text: t('f3') },
  ];

  const card = 'flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5 lg:p-6';
  const label = 'font-mono text-[11px] uppercase tracking-[0.12em] text-dim';

  return (
    <Section id="final-say">
      <SectionHead kicker={t('kicker')} pre={t('titlePre')} accent={t('titleAccent')} body={t('body')} />

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_24px_1fr_24px_1fr]">
        {/* 1 · the agent proposes */}
        <div className={card}>
          <span className={label}>{t('s1Label')}</span>
          <div className="flex flex-1 flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <div className="flex items-center gap-2">
              <AIMark name="claude" size={15} />
              <span className="text-[15px] font-medium text-neutral-100">{t('s1Title')}</span>
            </div>
            <span className="font-mono text-[11px] text-dim">{t('s1Meta')}</span>
            <span className="mt-auto"><StatusPill tone="warn">{t('s1Status')}</StatusPill></span>
          </div>
        </div>

        <Arrow />

        {/* 2 · the human decides */}
        <div className={`${card} border-blue-500/50`}>
          <span className={`${label} text-accent-strong`}>{t('s2Label')}</span>
          <div className="flex flex-1 flex-col gap-3 rounded-lg border border-blue-500/30 bg-blue-500/[0.06] p-4">
            <span className="text-[13px] text-dim line-through">{t('s1Title')}</span>
            <span className="text-[15px] font-medium text-neutral-100">{t('s2Title')}</span>
            <span className="text-[13px] italic text-neutral-50">“{t('s2Note')}”</span>
            <span className="mt-auto"><StatusPill tone="good"><Check size={11} />{t('s2Status')}</StatusPill></span>
          </div>
        </div>

        <Arrow />

        {/* 3 · the next session follows */}
        <div className={card}>
          <span className={label}>{t('s3Label')}</span>
          <div
            className="flex flex-1 flex-col gap-2 rounded-lg border p-4 font-mono text-[12px]"
            style={{ background: '#0c0d10', borderColor: '#23262c', color: '#cfd3da' }}
          >
            <span style={{ color: '#8a8f9a' }}>{t('s3Line1')}</span>
            <span style={{ color: '#7fc36d' }}>{t('s3Line2')}</span>
            <span className="mt-auto flex items-center gap-2 pt-2">
              <AIMark name="codex" size={13} />
              {t('s3Line3')}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-x-4 gap-y-6 md:grid-cols-3 lg:grid-cols-[1fr_24px_1fr_24px_1fr]">
        {facts.map(({ icon: Icon, text }, i) => (
          <Fragment key={text}>
            {i > 0 && <span className="hidden lg:block" aria-hidden />}
            <div className="flex gap-3 lg:px-6">
              <Icon size={17} className="mt-0.5 shrink-0 text-accent-strong" />
              <p className="m-0 text-[14.5px] leading-[1.6] text-neutral-50">{text}</p>
            </div>
          </Fragment>
        ))}
      </div>
      <p className="mt-8 mb-0 font-mono text-[11.5px] text-dim lg:px-6">{t('tech')}</p>
    </Section>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0" aria-hidden>
      <ArrowRight size={18} className={`${styles.flowArrow} rotate-90 text-dim lg:rotate-0`} />
    </div>
  );
}
