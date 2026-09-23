import Link from 'next/link';
import { EyeOff, GitFork, KeyRound, Lock, ScrollText, Split, Users, Briefcase, User } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import AIMark, { type AIMarkName } from '../AIMark';
import AgentPrompt from './AgentPrompt';
import { Headline, Kicker, Placeholder, Section, SectionHead } from './parts';

// The smaller sections of /landing-next, kept together so the page file stays a
// readable table of contents.

export async function NextDemo() {
  const t = await getTranslations('LandingNext.demo');
  return (
    <Section id="demo">
      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <Kicker>{t('kicker')}</Kicker>
        <h2 className="m-0 text-[30px] font-semibold tracking-[-0.03em] text-neutral-100 lg:text-[42px]">{t('title')}</h2>
      </div>
      <Placeholder
        title="90 saniyelik demo videosu"
        note="Senaryo plan dokümanında (E bölümü): pazartesi sabahı git log → This week dashboard'u → kararı düzeltip onaylama → sonraki oturumun onaylı karara uyması → prompt'u ajana verip kurulumu izletme. Poster görseli + 8 dil WebVTT altyazı. Önerilen: MP4/WebM, kendi sunucumuzdan veya YouTube-nocookie."
      />
    </Section>
  );
}

const AGENTS: { id: AIMarkName; name: string }[] = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'codex', name: 'Codex' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'windsurf', name: 'Windsurf' },
  { id: 'antigravity', name: 'Antigravity' },
  { id: 'continue', name: 'Continue' },
];

export async function NextAgents() {
  const t = await getTranslations('LandingNext.agents');
  return (
    <Section id="agents" className="!py-16 lg:!py-20">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-4">
          <Headline pre={t('titlePre')} accent={t('titleAccent')} />
          <p className="m-0 max-w-[48ch] text-[16px] leading-[1.6] text-neutral-50">{t('body')}</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-3">
          {AGENTS.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-neutral-900 px-5 py-5">
              <AIMark name={a.id} size={22} />
              <span className="text-[14px] font-medium text-neutral-100">{a.name}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export async function NextTrust() {
  const t = await getTranslations('LandingNext.trust');
  const items = [
    { icon: KeyRound, title: t('tokenTitle'), body: t('tokenBody') },
    { icon: Split, title: t('isolationTitle'), body: t('isolationBody') },
    { icon: Lock, title: t('windowTitle'), body: t('windowBody') },
    { icon: ScrollText, title: t('auditTitle'), body: t('auditBody') },
    { icon: GitFork, title: t('openTitle'), body: t('openBody') },
  ];
  return (
    <Section id="trust">
      <SectionHead kicker={t('kicker')} pre={t('titlePre')} accent={t('titleAccent')} />
      <div className="grid gap-px overflow-hidden rounded-xl border border-neutral-800 bg-neutral-800 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-3 bg-neutral-900 p-6">
            <Icon size={18} className="text-accent-strong" />
            <h3 className="m-0 text-[15.5px] font-semibold text-neutral-100">{title}</h3>
            <p className="m-0 text-[13.5px] leading-[1.6] text-dim">{body}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <p className="m-0 flex items-start gap-2.5 text-[13.5px] leading-[1.6] text-dim">
          <EyeOff size={15} className="mt-0.5 shrink-0" />
          {t('limit')}
        </p>
        <p className="m-0 shrink-0 font-mono text-[11px] leading-[1.8] text-dim lg:text-right">
          {t('verified')}
          <br />
          {t('openSource')}
        </p>
      </div>
    </Section>
  );
}

export async function NextAudience() {
  const t = await getTranslations('LandingNext.audience');
  const cards = [
    { icon: User, title: t('soloTitle'), body: t('soloBody') },
    { icon: Users, title: t('leadTitle'), body: t('leadBody') },
    { icon: Briefcase, title: t('agencyTitle'), body: t('agencyBody') },
  ];
  return (
    <Section id="audience">
      <div className="mb-12 flex flex-col gap-5">
        <Kicker>{t('kicker')}</Kicker>
        <h2 className="m-0 max-w-[22ch] text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-neutral-100 sm:text-[40px] lg:text-[50px]">
          {t('title')}
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, body }) => (
          <article key={title} className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-7">
            <Icon size={19} className="text-accent-strong" />
            <h3 className="m-0 text-[19px] font-semibold tracking-[-0.015em] text-neutral-100">{title}</h3>
            <p className="m-0 text-[15px] leading-[1.6] text-dim">{body}</p>
          </article>
        ))}
      </div>
    </Section>
  );
}

export async function NextStory() {
  const t = await getTranslations('LandingNext.story');
  return (
    <Section id="story">
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-5">
          <Kicker>{t('kicker')}</Kicker>
          <Headline pre={t('titlePre')} accent={t('titleAccent')} breakBefore />
          <p className="m-0 max-w-[46ch] text-[16.5px] leading-[1.65] text-neutral-50">{t('body')}</p>
        </div>
        <Placeholder
          ratio="4 / 3"
          title="Remnus'un kendi çalışma alanından ekran görüntüsü"
          note="Remnus'u yönettiğimiz workspace'ten anonimleştirilmiş bir 'This week' dashboard'u veya kararlar tablosu. Hassas müşteri/kişi verisi olmamalı. Varsa altına tek cümlelik kurucu alıntısı eklenebilir."
        />
      </div>
    </Section>
  );
}

export async function NextPricing() {
  const t = await getTranslations('LandingNext.pricing');
  const tl = await getTranslations('Landing');
  const plans = [
    { name: tl('bridgePricingFreeTitle'), price: tl('bridgePricingFreePrice'), sub: tl('bridgePricingFreeSub'), featured: false },
    { name: tl('bridgePricingStartupTitle'), price: tl('bridgePricingStartupPrice'), sub: tl('bridgePricingStartupSub'), featured: true, was: tl('bridgePricingStartupOriginalPrice') },
    { name: tl('bridgePricingProTitle'), price: tl('bridgePricingProPrice'), sub: tl('bridgePricingProSub'), featured: false, was: tl('bridgePricingProOriginalPrice') },
  ];
  return (
    <Section id="pricing">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:items-center">
        <div className="flex flex-col gap-5">
          <Kicker>{t('kicker')}</Kicker>
          <h2 className="m-0 text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-neutral-100 sm:text-[40px]">{t('title')}</h2>
          <p className="m-0 max-w-[44ch] text-[16px] leading-[1.6] text-neutral-50">{t('body')}</p>
          <Link href="/pricing" className="inline-flex w-fit items-center gap-1.5 text-[14px] text-accent-strong hover:underline">
            {t('cta')} <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col gap-3 rounded-xl border p-6 ${p.featured ? 'border-blue-500/50 bg-blue-500/[0.06]' : 'border-neutral-800 bg-neutral-900'}`}
            >
              <span className="text-[14px] font-medium text-neutral-100">{p.name}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[32px] font-semibold leading-none text-neutral-100 tabular-nums">{p.price}</span>
                {p.price !== '$0' && <span className="text-[12.5px] text-dim">{t('perMonth')}</span>}
              </span>
              {p.was && <span className="text-[12px] text-dim line-through">{p.was}</span>}
              <span className="text-[13px] leading-[1.5] text-dim">{p.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

export async function NextFaq() {
  const t = await getTranslations('LandingNext.faq');
  const items = t.raw('items') as { q: string; a: string }[];
  return (
    <Section id="faq">
      <div className="grid gap-10 lg:grid-cols-[0.6fr_1.4fr] lg:gap-16">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Kicker>{t('kicker')}</Kicker>
          <h2 className="m-0 text-[30px] font-semibold tracking-[-0.035em] text-neutral-100 sm:text-[40px]">{t('title')}</h2>
        </div>
        <div className="flex flex-col">
          {items.map((it) => (
            <details key={it.q} className="group border-b border-neutral-800">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 group-first:pt-0 text-[16px] font-medium text-neutral-100 [&::-webkit-details-marker]:hidden">
                {it.q}
                <span className="shrink-0 text-[20px] leading-none text-dim transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="m-0 max-w-[68ch] pb-6 text-[15px] leading-[1.65] text-dim">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}

export async function NextClosing() {
  const t = await getTranslations('LandingNext.closing');
  const th = await getTranslations('LandingNext.hero');
  return (
    <section className="relative overflow-hidden px-4 sm:px-8 lg:px-14 py-24 lg:py-36 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse at center, rgba(68,92,149,0.18), transparent 62%)' }}
      />
      <div className="relative mx-auto flex max-w-[980px] flex-col items-center gap-8">
        <Headline pre={t('titlePre')} accent={t('titleAccent')} size="closing" breakBefore />
        <p className="m-0 text-[17px] text-neutral-50">{t('sub')}</p>
        <div className="w-full max-w-[640px]">
          <AgentPrompt label={th('promptLabel')} copyLabel={th('promptCopy')} copiedLabel={th('promptCopied')} />
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-accent-strong"
          >
            {t('ctaPrimary')} <span aria-hidden>→</span>
          </Link>
          <Link
            href="/wiki/project-install"
            className="inline-flex items-center rounded-md border border-neutral-800 px-6 py-3.5 text-[15px] text-neutral-50 transition-colors hover:border-neutral-100"
          >
            {t('ctaSecondary')}
          </Link>
        </div>
      </div>
    </section>
  );
}
