import type { CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck } from 'lucide-react';
import AIMark from './AIMark';
import { HeroDemoButton, HeroDemoOverlay } from './HeroDemoOverlay';

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
    <section className="marketing-hero relative overflow-hidden px-4 sm:px-8 lg:px-14 pt-16 pb-12 lg:pt-[110px] lg:pb-[90px]">
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

            <div className="mt-8 lg:mt-9 flex max-w-[420px] flex-col gap-3">
              <HeroDemoButton
                buttonLabel={t('bridgeHeroDemoButton')}
                loadingLabel={t('bridgeHeroDemoLoading')}
              />
              <Link
                href="/login"
                className="group/free inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/45 px-5 py-3 text-sm font-medium text-neutral-100 transition-all duration-200 hover:border-blue-500/50 hover:bg-neutral-900"
              >
                {t('bridgeHeroCtaFree')}
                <span
                  aria-hidden="true"
                  className="text-xs text-accent-strong transition-transform duration-200 group-hover/free:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <Link
                href="#integrations"
                className="group/integrations self-center inline-flex items-center gap-1.5 pt-1 font-mono text-[10.5px] tracking-[0.03em] text-dim transition-colors duration-150 hover:text-accent-strong"
              >
                {t('bridgeHeroExploreIntegrations')}
                <span
                  aria-hidden="true"
                  className="text-[10px] transition-transform duration-150 group-hover/integrations:translate-y-0.5"
                >
                  ↓
                </span>
              </Link>
            </div>
          </div>

          {/* right — AI dock + workspace, hidden on mobile.
              overflow-hidden clips the enlarged board at THIS column's edges
              (i.e. the content container), not the viewport, so nothing sticks
              out past the layout and symmetry is kept. The AI tiles are left at
              their natural size so they never overflow; only the board is scaled. */}
          <div className="relative hidden lg:flex lg:flex-col">
            <div
              className="relative overflow-hidden group"
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

            {/* Trust badges — subtle, tucked just under the showcase (desktop
                only). Lighter styling: borderless, muted, faint hover. */}
            <div className="mt-4 flex flex-wrap items-center gap-4 pl-1">
              {/* Official MCP Registry listing */}
              <a
                href="https://registry.modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-trust-badge group/badge inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900/60 transition-colors duration-150"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 shrink-0">
                  <BadgeCheck className="w-7 h-7 text-accent-strong" strokeWidth={1.5} />
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[12px] text-neutral-50">MCP Registry</span>
                  <span className="font-mono text-[9.5px] text-dim tracking-[0.02em]">
                    {t('bridgeBadgeRegistrySub')}
                  </span>
                </span>
              </a>

              {/* Smithery quality score */}
              <a
                href="https://smithery.ai/servers/ranorkk/remnus"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-trust-badge group/badge inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900/60 transition-colors duration-150"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 shrink-0">
                  <svg
                    viewBox="0 0 211 211"
                    className="w-7 h-7 rounded-md"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect width="211" height="211" rx="36" fill="#EFEAD6" />
                    <g transform="translate(44.4 36.9) scale(0.65)" fill="#FF5601">
                      <path d="M41.7011 77.48H0V100.264C0 118.171 14.5275 132.698 32.4342 132.698H55.2183V90.9971C55.2183 83.5418 49.1565 77.48 41.7011 77.48Z" />
                      <path d="M66.0879 90.9971V132.698H107.789C115.244 132.698 121.306 126.636 121.306 119.181V77.48H79.6051C72.1497 77.48 66.0879 83.5418 66.0879 90.9971Z" />
                      <path d="M154.995 77.48H132.21V119.181C132.21 126.636 138.272 132.698 145.728 132.698H187.429V106.152C187.429 88.2449 172.901 77.5148 154.995 77.5148V77.48Z" />
                      <path d="M0 45.9514V66.6103H41.7011C49.1565 66.6103 55.2183 60.5485 55.2183 53.0932V0C25.8498 0.209028 0.034838 14.6668 0 45.9514Z" />
                      <path d="M66.0879 53.093C66.0879 60.5483 72.1497 66.6101 79.6051 66.6101H121.306V11.4615C100.926 8.36092 90.3003 1.74169 66.0879 0.243652V53.0581V53.093Z" />
                      <path d="M144.09 13.0639C139.77 13.0639 135.834 12.9246 132.21 12.6807V66.61H154.995C172.901 66.61 187.429 52.0825 187.429 34.1758V0.173828C177.291 8.1169 162.903 13.0639 144.09 13.0639Z" />
                      <path d="M0 176.002V210.004C10.1379 202.061 24.526 197.114 43.3385 197.114C47.6584 197.114 51.5951 197.253 55.2183 197.532V143.603H32.4342C14.5275 143.603 0 158.13 0 176.037L0 176.002Z" />
                      <path d="M107.789 143.603H66.0879V198.716C86.4681 201.817 97.0938 208.436 121.306 209.934V157.12C121.306 149.664 115.244 143.603 107.789 143.603Z" />
                      <path d="M132.21 157.085V210.178C161.544 209.969 187.324 195.511 187.429 164.296V143.568H145.728C138.272 143.568 132.21 149.63 132.21 157.085Z" />
                    </g>
                  </svg>
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[12px] text-neutral-50">Smithery <span className="text-dim ml-0.5">98/100</span></span>
                  <span className="font-mono text-[9.5px] text-dim tracking-[0.02em]">
                    {t('bridgeBadgeSmitherySub')}
                  </span>
                </span>
              </a>

              {/* Glama MCP directory listing */}
              <a
                href="https://glama.ai/mcp/connectors/io.github.Ranork/remnus"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-trust-badge group/badge inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900/60 transition-colors duration-150"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 shrink-0">
                  <svg
                    viewBox="0 0 330 330"
                    className="w-7 h-7 rounded-md"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M314 0H16C7.16344 0 0 7.16345 0 16V314C0 322.837 7.16345 330 16 330H314C322.837 330 330 322.837 330 314V16C330 7.16344 322.837 0 314 0Z" fill="black" />
                    <path d="M95 15H75V155H95V15ZM255 15H235V155H255V15ZM75 25H65V125H75V25ZM265 25H255V125H265V25ZM65 35H55V95H65V35ZM275 35H265V95H275V35ZM105 75H95V155H105V75ZM235 75H225V155H235V75ZM205 85H125V185H205V85ZM125 95H105V155H125V95ZM225 95H205V155H225V95ZM75 145H65V155H75V145ZM265 145H255V155H265V145ZM125 155H115V225H125V155ZM215 155H205V225H215V155ZM85 165H75V315H85V165ZM115 165H105V315H115V165ZM225 165H215V315H225V165ZM255 165H245V315H255V165ZM105 175H85V315H105V175ZM245 175H225V315H245V175ZM135 185H125V235H135V185ZM185 185H145V195H185V185ZM205 185H195V235H205V185ZM75 195H65V275H75V195ZM145 195H135V235H145V195ZM195 195H185V235H195V195ZM265 195H255V275H265V195ZM155 205H145V235H155V205ZM185 205H175V235H185V205ZM125 235H115V315H125V235ZM215 235H205V315H215V235ZM145 245H125V315H145V245ZM205 245H185V315H205V245ZM185 265H145V315H185V265Z" fill="white" />
                  </svg>
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[12px] text-neutral-50">Glama <span className="text-dim ml-0.5">4.2/5</span></span>
                  <span className="font-mono text-[9.5px] text-dim tracking-[0.02em]">
                    {t('bridgeBadgeGlamaSub')}
                  </span>
                </span>
              </a>

              {/* mcp.so directory listing */}
              <a
                href="https://mcp.so/server/remnus/Ranork"
                target="_blank"
                rel="noopener noreferrer"
                className="hero-trust-badge group/badge inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-900/60 transition-colors duration-150"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 shrink-0">
                  <svg
                    viewBox="0 0 32 32"
                    className="w-7 h-7 rounded-md"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <rect width="32" height="32" rx="8" fill="#2563EB" />
                    <g transform="translate(5 5) scale(0.9167)" fill="#ffffff">
                      <path d="M11.016 2.099a3.998 3.998 0 0 1 5.58.072l.073.074a3.991 3.991 0 0 1 1.058 3.318 3.994 3.994 0 0 1 3.32 1.06l.073.071.048.047.071.075a3.998 3.998 0 0 1 0 5.506l-.071.074-8.183 8.182-.034.042a.267.267 0 0 0 .034.335l1.68 1.68a.8.8 0 0 1-1.131 1.13l-1.68-1.679a1.866 1.866 0 0 1-.034-2.604l8.26-8.261a2.4 2.4 0 0 0-.044-3.349l-.047-.047-.044-.043a2.4 2.4 0 0 0-3.349.043l-6.832 6.832-.03.029a.8.8 0 0 1-1.1-1.16l6.876-6.875a2.4 2.4 0 0 0-.044-3.35l-.179-.161a2.399 2.399 0 0 0-3.169.119l-.045.043-9.047 9.047-.03.028a.8.8 0 0 1-1.1-1.16l9.046-9.046.074-.072Z" />
                      <path d="M13.234 4.404a.8.8 0 0 1 1.1 1.16l-6.69 6.691a2.399 2.399 0 1 0 3.393 3.393l6.691-6.692a.8.8 0 0 1 1.131 1.131l-6.691 6.692a4 4 0 0 1-5.581.07l-.073-.07a3.998 3.998 0 0 1 0-5.655l6.69-6.691.03-.029Z" />
                    </g>
                  </svg>
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[12px] text-neutral-50">MCP.so</span>
                  <span className="font-mono text-[9.5px] text-dim tracking-[0.02em]">
                    {t('bridgeBadgeMcpsoSub')}
                  </span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroWorkspaceShot() {
  return (
    <div
      className="marketing-preview-shadow bg-neutral-950 border border-neutral-800 rounded-[10px] overflow-hidden flex"
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
