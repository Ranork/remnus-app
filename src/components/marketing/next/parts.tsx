import type { ReactNode } from 'react';
import styles from './landing-next.module.css';

// Shared building blocks for the /landing-next draft.

export function Section({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 sm:px-8 lg:px-14 py-20 lg:py-28 ${className}`}>
      {/* Same 1280px container as the nav and footer, so every section's left
          edge lines up with the logo. */}
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" aria-hidden />
      {children}
    </span>
  );
}

/** Sans headline with the brand's serif-italic accent tail. */
export function Headline({
  pre,
  accent,
  as: Tag = 'h2',
  size = 'section',
  breakBefore = false,
}: {
  pre: string;
  accent: string;
  as?: 'h1' | 'h2';
  size?: 'hero' | 'section' | 'closing';
  breakBefore?: boolean;
}) {
  const sizes = {
    hero: 'text-[40px] sm:text-[60px] lg:text-[76px]',
    section: 'text-[30px] sm:text-[40px] lg:text-[50px]',
    closing: 'text-[38px] sm:text-[56px] lg:text-[72px]',
  } as const;
  const accentSizes = {
    hero: 'text-[44px] sm:text-[66px] lg:text-[84px]',
    section: 'text-[33px] sm:text-[44px] lg:text-[55px]',
    closing: 'text-[42px] sm:text-[62px] lg:text-[80px]',
  } as const;

  return (
    <Tag
      className={`m-0 font-sans font-semibold text-neutral-100 leading-[1.02] text-balance ${sizes[size]}`}
      style={{ letterSpacing: '-0.035em' }}
    >
      {pre}
      {breakBefore ? <br /> : ' '}
      <span className={`font-serif italic font-medium text-accent-strong ${accentSizes[size]}`} style={{ letterSpacing: '-0.02em' }}>
        {accent}
      </span>
    </Tag>
  );
}

export function SectionHead({
  kicker,
  pre,
  accent,
  body,
  aside,
}: {
  kicker: string;
  pre: string;
  accent: string;
  body?: string;
  aside?: ReactNode;
}) {
  // One left-aligned column: kicker, headline, then the body right under it. A
  // body parked in a right-hand column ends up floating away from its headline on
  // wide screens.
  return (
    <div className="flex flex-col gap-5 mb-12 lg:mb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Kicker>{kicker}</Kicker>
        {aside}
      </div>
      <div className="max-w-230">
        <Headline pre={pre} accent={accent} />
      </div>
      {body && <p className="m-0 text-[17px] leading-[1.65] text-neutral-50 max-w-[62ch]">{body}</p>}
    </div>
  );
}

/**
 * Draft-only slot for an asset the team still has to supply (video, real
 * screenshot, quote). Deliberately loud so it can't ship by accident; the copy
 * inside is a note to the team, not customer copy, so it is not translated.
 */
export function Placeholder({
  title,
  note,
  ratio = '16 / 9',
  className = '',
}: {
  title: string;
  note: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      data-placeholder
      className={`relative w-full max-w-full rounded-xl border-2 border-dashed border-amber-500/60 bg-amber-500/5 flex items-center justify-center p-6 ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <div className="flex flex-col items-center gap-2 text-center max-w-[52ch]">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-amber-500">Placeholder · doldurulacak</span>
        <span className="text-[16px] font-semibold text-neutral-100">{title}</span>
        <span className="text-[13px] leading-[1.55] text-dim">{note}</span>
      </div>
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: 'good' | 'warn' | 'dim'; children: ReactNode }) {
  const tones = {
    good: 'text-green-400 bg-green-400/10 border-green-400/25',
    warn: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    dim: 'text-dim bg-neutral-800/40 border-neutral-800',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Small amber "something is waiting for you" badge, styled like an app notification. */
export function NoticeBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-medium leading-[1.4] text-amber-400">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className={`${styles.ping} absolute inline-flex h-full w-full rounded-full bg-amber-400`} />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      {children}
    </span>
  );
}
