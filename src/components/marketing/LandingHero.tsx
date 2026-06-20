import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import AIMark from './AIMark';
import { HeroDemoOverlay } from './HeroDemoOverlay';

const AI_TILES = [
  { id: 'claude',      name: 'Claude',      sub: 'Desktop · Claude Code', color: '#d97757', action: 'creating page' },
  { id: 'cursor',      name: 'Cursor',      sub: 'IDE · Composer',        color: '#dfe2ea', action: 'editing status' },
  { id: 'antigravity', name: 'Antigravity', sub: 'Agent · Google Gemini', color: '#4d8df0', action: 'removing page' },
] as const;

const KANBAN_COLS = [
  {
    name: 'Backlog', color: 'var(--color-dim)', cards: [
      { t: 'Set up i18n message loader',    tag: 'infra',  tc: 'var(--color-opt-purple)' },
      { t: 'Audit Auth.js session caching', tag: 'perf',   tc: 'var(--color-opt-teal)' },
    ],
  },
  {
    name: 'In progress', color: 'var(--color-blue-500)', cards: [
      { t: 'Kanban segmented border accent', tag: 'design', tc: 'var(--color-opt-pink)' },
      { t: 'Inline cell editor — date',      tag: 'editor', tc: 'var(--color-amber-500)' },
    ],
  },
  {
    name: 'Review', color: 'var(--color-opt-yellow)', cards: [
      { t: 'Drag-reorder workspaces', tag: 'sidebar', tc: 'var(--color-opt-purple)' },
    ],
  },
  {
    name: 'Done', color: 'var(--color-green-400)', cards: [
      { t: 'TanStack Query provider', tag: 'infra', tc: 'var(--color-opt-purple)' },
      { t: 'Demo mode reset action',  tag: 'auth',  tc: 'var(--color-opt-teal)' },
    ],
  },
] as const;

// Flat starting index per kanban column, so each card gets a unique --i
// for the left→right "agent editing" ripple in HeroWorkspaceShot.
const CARD_OFFSETS = KANBAN_COLS.reduce<number[]>((acc, _col, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + KANBAN_COLS[i - 1].cards.length);
  return acc;
}, []);

export default async function LandingHero() {
  const t = await getTranslations('Landing');

  return (
    <section className="relative overflow-hidden px-4 sm:px-8 lg:px-14 pt-16 pb-12 lg:pt-[110px] lg:pb-[90px]">
      {/* radial bg glow */}
      <div
        className="absolute top-20 -left-60 w-175 h-175 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(68,92,149,0.18), transparent 60%)' }}
      />

      <div className="relative max-w-[1280px] mx-auto">
        {/* section header */}
        <div className="flex items-center gap-3 mb-8 lg:mb-10">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
            {t('bridgeHeroSnum')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>

        {/* two-column grid — single column on mobile */}
        <div className="grid gap-12 items-center grid-cols-1 lg:grid-cols-[0.82fr_1.18fr]">
          {/* left — copy */}
          <div>
            <h1
              className="font-sans font-semibold text-neutral-100 leading-[0.98] m-0 text-[44px] sm:text-[62px] lg:text-[82px]"
              style={{ letterSpacing: '-0.035em' }}
            >
              {t('bridgeHeroH1Part1')}
              <br />
              {t('bridgeHeroH1Pre')}
              <span className="font-serif italic text-accent-strong text-[48px] sm:text-[68px] lg:text-[88px]">
                {t('bridgeHeroH1Accent')}
              </span>
              <br />
              {t('bridgeHeroH1Part2')}
            </h1>

            <p className="mt-6 lg:mt-[26px] text-base lg:text-[17px] leading-[1.5] text-neutral-50 max-w-[420px]">
              {t('bridgeHeroSubhead')}
            </p>

            <div className="mt-7 lg:mt-[32px] flex flex-wrap items-center gap-4 lg:gap-[18px]">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-blue-500 hover:bg-accent-strong text-white px-5 py-3.5 rounded-md text-[15px] font-medium transition-colors duration-150"
              >
                {t('bridgeHeroCtaPrimary')}
                <span aria-hidden>→</span>
              </Link>
              <Link
                href="#integrations"
                className="inline-flex items-center gap-1.5 text-sm text-neutral-100 border-b border-neutral-800 pb-1 hover:border-neutral-100 transition-colors duration-150"
              >
                {t('bridgeHeroCtaSecondary')}
                <span aria-hidden className="text-xs">→</span>
              </Link>
            </div>

            {/* stats row — scales down on mobile, never wraps */}
            <div className="mt-8 lg:mt-10 space-y-2">
              <div className="flex border border-neutral-800 rounded-md overflow-hidden w-fit max-w-full">
                {[
                  { num: t('bridgeHeroStat1Num'), label: t('bridgeHeroStat1Label') },
                  { num: t('bridgeHeroStat2Num'), label: t('bridgeHeroStat2Label') },
                  { num: t('bridgeHeroStat3Num'), label: t('bridgeHeroStat3Label') },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5"
                    style={{ borderLeft: i ? '1px solid var(--color-neutral-800)' : 'none' }}
                  >
                    <span className="font-sans font-bold text-neutral-100 text-[17px] sm:text-[20px] lg:text-[22px] tracking-[-0.02em] leading-none">
                      {s.num}
                    </span>
                    <span className="font-mono text-[10px] sm:text-[11px] text-dim leading-tight max-w-16.25 sm:max-w-22.5">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                href="#tools"
                className="inline-flex items-center gap-1 font-mono text-[10.5px] text-accent-strong tracking-[0.02em] hover:underline"
              >
                {t('bridgeHeroStatNote')}
                <span aria-hidden className="text-[10px]">→</span>
              </Link>
            </div>
          </div>

          {/* right — AI dock + workspace, hidden on mobile.
              overflow-hidden clips the enlarged board at THIS column's edges
              (i.e. the content container), not the viewport, so nothing sticks
              out past the layout and symmetry is kept. The AI tiles are left at
              their natural size so they never overflow; only the board is scaled. */}
          <div
            className="relative hidden lg:block overflow-hidden group"
            style={{ height: 580 }}
          >
            {/* AI tiles */}
            <div className="absolute top-0 left-0 right-0 grid grid-cols-3 gap-2 z-10">
              {AI_TILES.map((tile, i) => (
                <div
                  key={tile.id}
                  className="hero-ai-tile flex items-center gap-2.5 px-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-lg"
                  style={{ animationDelay: `${i * 8}s`, ['--tile-color' as string]: tile.color } as CSSProperties}
                >
                  <AIMark name={tile.id} size={20} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[13px] text-neutral-100 font-medium tracking-[-0.005em]">
                      {tile.name}
                    </span>
                    <span className="font-mono text-[10.5px] text-dim tracking-[0.02em]">
                      {tile.sub}
                    </span>
                  </div>
                  <span
                    className="hero-ai-dot w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"
                    style={{ animationDelay: `${i * 8}s`, ['--tile-color' as string]: tile.color } as CSSProperties}
                  />
                </div>
              ))}
            </div>

            {/* connector line + streaming command dot */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: 60, width: 1, height: 32, background: 'linear-gradient(180deg, var(--color-blue-500), transparent)', opacity: 0.6 }}
            >
              <span className="hero-flow-dot" />
            </div>

            {/* MCP pill — border/glow follows the active agent, text stays fixed.
                Hover reveals a short MCP explainer (CSS-only, named group). */}
            <div
              className="hero-mcp-pill group/mcp absolute left-1/2 -translate-x-1/2 z-10 bg-neutral-950 border border-blue-500 rounded-full px-6 py-1 font-mono text-[12px] tracking-[0.18em] cursor-help"
              style={{ top: 82 }}
            >
              <span className="text-accent-strong">{t('bridgeHeroPill')}</span>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-96 max-w-[90vw] rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2 font-sans text-[11px] leading-normal tracking-normal text-neutral-100 text-center opacity-0 transition-opacity duration-200 group-hover/mcp:opacity-100 z-20"
              >
                {t('bridgeHeroPillTip')}
              </span>
            </div>

            {/* Workspace shot — only this is scaled up. Origin top-left keeps the
                sidebar/topbar anchored while it grows down/right into the clipped,
                faded zone. */}
            <div
              className="absolute left-1"
              style={{ top: 124, transform: 'scale(1.14)', transformOrigin: 'top left' }}
            >
              <HeroWorkspaceShot />
            </div>

            {/* Edge fades — dissolve the enlarged board into the page background.
                Right fade starts earlier and widens for a gentler dissolve.
                Bottom fade grows to meet it so the corner blends smoothly. */}
            <div
              className="absolute right-0 z-20 pointer-events-none"
              style={{ top: 116, bottom: 0, width: 220, background: 'linear-gradient(to right, transparent 0%, var(--color-neutral-950) 72%)' }}
            />
            <div
              className="absolute left-0 right-0 bottom-0 z-20 pointer-events-none"
              style={{ height: 130, background: 'linear-gradient(to bottom, transparent 0%, var(--color-neutral-950) 75%)' }}
            />

            {/* Hover dim — radial: dims at centre, fades to transparent at corners.
                Colour is theme-aware (dark wash on dark themes, light wash on catppuccin). */}
            <div
              className="hero-hover-dim absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ top: 116, zIndex: 25 }}
            />

            {/* Demo CTA — fades in on hover, centered over the workspace shot */}
            <HeroDemoOverlay
              buttonLabel={t('bridgeHeroDemoButton')}
              loadingLabel={t('bridgeHeroDemoLoading')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroWorkspaceShot() {
  return (
    <div
      className="bg-neutral-950 border border-neutral-800 rounded-[10px] overflow-hidden flex"
      style={{
        width: 720,
        height: 445,
        fontSize: 11,
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.55), 0 10px 20px -8px rgba(0,0,0,0.4)',
      }}
    >
      {/* Sidebar */}
      <div className="w-47 shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col gap-1 px-2.5 py-3 text-[10px]">
        <div className="flex items-center gap-1.5 px-1.5 pb-2 mb-1.5 border-b border-neutral-800">
          <Image src="/logo-square-transparent.png" alt="Remnus" width={12} height={12} />
          <span className="font-semibold text-neutral-100 text-[11px]">Acme</span>
          {/* <span className="ml-auto text-dim text-[9px] font-mono">⌘K</span> */}
        </div>
        {[
          { i: '📋', t: 'Getting started' },
          { i: '📁', t: 'Projects', folder: true },
        ].map((it) => (
          <div key={it.t} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-neutral-50">
            {it.folder && <span className="text-dim text-[8px]">▾</span>}
            <span>{it.i}</span>
            <span>{it.t}</span>
          </div>
        ))}
        {['🚀 Remnus v2 Launch', '🎨 Design System'].map((t) => (
          <div key={t} className="flex items-center gap-1.5 pl-5.5 py-0.5 text-dim" style={{ borderLeft: '1px solid var(--color-border-soft)', marginLeft: 12 }}>
            <span>{t}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-neutral-100" style={{ background: 'rgba(68,92,149,0.18)' }}>
          <span>📊</span>
          <span>Sprint Board</span>
        </div>
        {['🐛 Bug Tracker', '🗓 Team Calendar', '📚 Reading List'].map((t) => (
          <div key={t} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-neutral-50">
            <span>{t}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 bg-neutral-850 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="border-b border-neutral-800 px-3 py-2 flex items-center gap-2.5 text-[10px]">
          {/* <span className="text-dim">Projects / Remnus v2 /</span> */}
          <span className="text-neutral-100 font-medium py-1">📊 Sprint Board</span>
          <span
            className="hero-agent-tint flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded-full font-mono text-[8.5px] tracking-[0.03em]"
            style={{ background: 'color-mix(in srgb, currentColor 14%, transparent)' }}
          >
            <span className="hero-agent-chip-dot w-1 h-1 rounded-full" />
            Agent editing
          </span>
          <span className="flex-1" />
          {/* <span className="text-dim">Table</span>
          <span className="text-neutral-100 font-medium pb-0.5" style={{ borderBottom: '1.5px solid var(--color-accent-strong)' }}>Board</span>
          <span className="text-dim">Calendar</span> */}
        </div>

        {/* Kanban */}
        <div className="relative flex-1 flex gap-2.5 p-3 overflow-hidden">
          {KANBAN_COLS.map((col, colIdx) => (
            <div key={col.name} className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 px-0.5">
                <span className="w-1.75 h-1.75 rounded-full shrink-0" style={{ background: col.color }} />
                <span className="text-neutral-100 font-medium text-[10px]">{col.name}</span>
              </div>
              {col.cards.map((c, cardIdx) => (
                <div
                  key={c.t}
                  className="hero-card flex flex-col gap-1 px-2 py-1.5 rounded bg-neutral-900"
                  style={{
                    border: '1px solid var(--color-neutral-800)',
                    borderLeft: `2.5px solid ${c.tc}`,
                    ['--i' as string]: CARD_OFFSETS[colIdx] + cardIdx,
                  } as CSSProperties}
                >
                  <span className="text-neutral-100 text-[9.5px] leading-[1.35]">{c.t}</span>
                  <span
                    className="self-start font-mono text-[8px] px-1 rounded-[3px]"
                    style={{ color: c.tc, background: `color-mix(in oklab, ${c.tc} 14%, transparent)` }}
                  >
                    {c.tag}
                  </span>
                </div>
              ))}

              {/* Continuous agent storyline — one card the agents work in turn:
                  Claude creates here → Cursor slides it to "Review" → Antigravity
                  edits → reset. Anchored to this real 3rd slot of "In progress" so
                  its size + create position come from the layout. The bottom-right
                  stamp shows whichever agent is currently working it. */}
              {colIdx === 1 && (
                <div className="relative">
                  <div className="hero-story-card flex flex-col gap-1 px-2 py-1.5 pr-5">
                    <span className="text-neutral-100 text-[9.5px] leading-[1.35]">Sync schema → API types</span>
                    <span
                      className="self-start font-mono text-[8px] px-1 rounded-[3px]"
                      style={{ color: 'currentColor', background: 'color-mix(in srgb, currentColor 16%, transparent)' }}
                    >
                      agent
                    </span>
                    {AI_TILES.map((tile, i) => (
                      <span key={tile.id} className="hero-story-icon" style={{ animationDelay: `${i * 8}s` }}>
                        <AIMark name={tile.id} size={13} />
                      </span>
                    ))}
                    {AI_TILES.map((tile, i) => (
                      <span
                        key={`act-${tile.id}`}
                        className="hero-story-label font-mono"
                        style={{ animationDelay: `${i * 8}s` }}
                      >
                        {tile.action}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
