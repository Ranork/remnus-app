import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth } from '@/auth';
import PricingCtaButton from './PricingCtaButton';
import type { PlanTier } from '@/lib/billing/plans';
import type { LucideIcon } from 'lucide-react';
import {
  Users, FolderTree, Table2, Bot, Plug, HardDrive, ScrollText,
  Share2, Globe, UserCog, Gauge, KeyRound, LifeBuoy,
} from 'lucide-react';

type Accent = 'green' | 'blue' | 'accent' | 'amber';

const ACCENTS: Record<Accent, { color: string; tintFrom: string; divider: string; tagBg: string; tagColor: string; tagBorder: string }> = {
  green: {
    color: 'var(--color-green-400)',
    tintFrom: 'rgba(127,195,109,0.05)',
    divider: 'rgba(127,195,109,0.2)',
    tagBg: 'rgba(127,195,109,0.08)',
    tagColor: 'var(--color-green-400)',
    tagBorder: 'rgba(127,195,109,0.35)',
  },
  blue: {
    color: 'var(--color-blue-500)',
    tintFrom: 'rgba(68,92,149,0.14)',
    divider: 'rgba(68,92,149,0.35)',
    tagBg: 'var(--color-blue-500)',
    tagColor: '#fff',
    tagBorder: 'transparent',
  },
  accent: {
    color: 'var(--color-accent-strong)',
    tintFrom: 'rgba(68,92,149,0.06)',
    divider: 'var(--color-neutral-800)',
    tagBg: 'rgba(68,92,149,0.1)',
    tagColor: 'var(--color-accent-strong)',
    tagBorder: 'rgba(68,92,149,0.45)',
  },
  amber: {
    color: 'var(--color-amber-500)',
    tintFrom: 'rgba(204,125,69,0.06)',
    divider: 'rgba(204,125,69,0.25)',
    tagBg: 'rgba(204,125,69,0.1)',
    tagColor: 'var(--color-amber-500)',
    tagBorder: 'rgba(204,125,69,0.4)',
  },
};

export default async function LandingPricing({ showComparison = false }: { showComparison?: boolean }) {
  const t = await getTranslations('Landing');
  const session = await auth();
  const isAuthed = !!session?.user;
  const isDemo = session?.user?.role === 'demo';

  const tU = t('bridgePricingTblValUnlimited');
  const tCustom = t('bridgePricingTblValCustom');

  const plans = [
    {
      key: 'free',
      tier: 'free' as PlanTier,
      accent: 'green' as Accent,
      title: t('bridgePricingFreeTitle'),
      tag: t('bridgePricingFreeTag'),
      sub: t('bridgePricingFreeSub'),
      price: t('bridgePricingFreePrice'),
      priceSub: null as string | null,
      features: [
        t('bridgePricingFreeF1'),
        t('bridgePricingFreeF2'),
        t('bridgePricingFreeF3'),
        t('bridgePricingFreeF4'),
        t('bridgePricingFreeF5'),
      ],
      cta: t('bridgePricingFreeCta'),
      ctaHref: '/login',
      ctaVariant: 'solid' as const,
      featured: false,
    },
    {
      key: 'startup',
      tier: 'startup' as PlanTier,
      accent: 'blue' as Accent,
      title: t('bridgePricingStartupTitle'),
      tag: t('bridgePricingStartupTag'),
      sub: t('bridgePricingStartupSub'),
      price: t('bridgePricingStartupPrice'),
      priceSub: t('bridgePricingStartupPriceSub'),
      originalPrice: t('bridgePricingStartupOriginalPrice'),
      discountLabel: t('bridgePricingStartupDiscountLabel'),
      features: [
        t('bridgePricingStartupF1'),
        t('bridgePricingStartupF2'),
        t('bridgePricingStartupF3'),
        t('bridgePricingStartupF4'),
        t('bridgePricingStartupF5'),
      ],
      cta: t('bridgePricingStartupCta'),
      ctaHref: '/login',
      ctaVariant: 'solid' as const,
      featured: true,
    },
    {
      key: 'pro',
      tier: 'professional' as PlanTier,
      accent: 'accent' as Accent,
      title: t('bridgePricingProTitle'),
      tag: t('bridgePricingProTag'),
      sub: t('bridgePricingProSub'),
      price: t('bridgePricingProPrice'),
      priceSub: t('bridgePricingProPriceSub'),
      originalPrice: t('bridgePricingProOriginalPrice'),
      discountLabel: t('bridgePricingStartupDiscountLabel'),
      features: [
        t('bridgePricingProF1'),
        t('bridgePricingProF2'),
        t('bridgePricingProF3'),
        t('bridgePricingProF4'),
        t('bridgePricingProF5'),
      ],
      cta: t('bridgePricingProCta'),
      ctaHref: '/login',
      ctaVariant: 'outline' as const,
      featured: false,
    },
    {
      key: 'enterprise',
      tier: 'enterprise' as PlanTier,
      accent: 'amber' as Accent,
      title: t('bridgePricingEntTitle'),
      tag: t('bridgePricingEntTag'),
      sub: t('bridgePricingEntSub'),
      price: t('bridgePricingEntPrice'),
      priceSub: null,
      features: [
        t('bridgePricingEntF1'),
        t('bridgePricingEntF2'),
        t('bridgePricingEntF3'),
        t('bridgePricingEntF4'),
        t('bridgePricingEntF5'),
      ],
      cta: t('bridgePricingEntCta'),
      ctaHref: '/contact',
      ctaVariant: 'outline' as const,
      featured: false,
    },
  ];

  const ossFeatures = [
    t('bridgePricingSelfF1'),
    t('bridgePricingSelfF3'),
    t('bridgePricingSelfF5'),
  ];

  // ── Detailed comparison table (Free / Startup / Professional / Enterprise) ──
  type Cell = string | boolean;
  const rows: { label: string; desc: string; icon: LucideIcon; cells: [Cell, Cell, Cell, Cell] }[] = [
    { label: t('bridgePricingTblMembers'), desc: t('bridgePricingTblMembersDesc'), icon: Users, cells: ['2', '5', '15', tU] },
    { label: t('bridgePricingTblWorkspaces'), desc: t('bridgePricingTblWorkspacesDesc'), icon: FolderTree, cells: ['2', tU, tU, tU] },
    { label: t('bridgePricingTblPages'), desc: t('bridgePricingTblPagesDesc'), icon: Table2, cells: [true, true, true, true] },
    { label: t('bridgePricingTblAgents'), desc: t('bridgePricingTblAgentsDesc'), icon: Bot, cells: ['2', '5', tU, tU] },
    { label: t('bridgePricingTblMcp'), desc: t('bridgePricingTblMcpDesc'), icon: Plug, cells: [true, true, true, true] },
    { label: t('bridgePricingTblStorage'), desc: t('bridgePricingTblStorageDesc'), icon: HardDrive, cells: ['512 MB', '5 GB', '20 GB', tCustom] },
    { label: t('bridgePricingTblAudit'), desc: t('bridgePricingTblAuditDesc'), icon: ScrollText, cells: [t('bridgePricingTblAudit7'), t('bridgePricingTblAudit30'), t('bridgePricingTblAudit90'), tCustom] },
    { label: t('bridgePricingTblSharing'), desc: t('bridgePricingTblSharingDesc'), icon: Share2, cells: [true, true, true, true] },
    { label: t('bridgePricingTblSeo'), desc: t('bridgePricingTblSeoDesc'), icon: Globe, cells: [false, false, true, true] },
    { label: t('bridgePricingTblMemberMgmt'), desc: t('bridgePricingTblMemberMgmtDesc'), icon: UserCog, cells: [true, true, true, true] },
    { label: t('bridgePricingTblStorageView'), desc: t('bridgePricingTblStorageViewDesc'), icon: Gauge, cells: [true, true, true, true] },
    { label: t('bridgePricingTblSso'), desc: t('bridgePricingTblSsoDesc'), icon: KeyRound, cells: [false, false, false, true] },
    { label: t('bridgePricingTblSupport'), desc: t('bridgePricingTblSupportDesc'), icon: LifeBuoy, cells: [t('bridgePricingTblSupportCommunity'), t('bridgePricingTblSupportEmail'), t('bridgePricingTblSupportPriority'), t('bridgePricingTblSupportDedicated')] },
  ];
  const colTitles = [
    t('bridgePricingFreeTitle'),
    t('bridgePricingStartupTitle'),
    t('bridgePricingProTitle'),
    t('bridgePricingEntTitle'),
  ];

  return (
    <section id="pricing" className="px-4 sm:px-8 lg:px-14 py-16 lg:py-27.5">

      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-10 lg:mb-12">
          <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
            {t('bridgePricingSnum')}
          </span>
          <span className="flex-1 h-px bg-neutral-800" />
        </div>

        <h2
          className="m-0 font-sans font-semibold text-neutral-100 leading-[0.98] text-[30px] sm:text-[36px] lg:text-[44px]"
          style={{ letterSpacing: '-0.035em' }}
        >
          {t('bridgePricingH2Part1')}{' '}
          <span className="font-serif italic text-accent-strong text-[34px] sm:text-[40px] lg:text-[48px]">
            {t('bridgePricingH2Accent')}
          </span>
        </h2>
      </div>

      {/* Plan cards — 4 columns */}
      <div className="max-w-7xl mx-auto mt-10 lg:mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 items-stretch">
          {plans.map(({ key, ...rest }) => (
            <PlanCard key={key} {...rest} isAuthed={isAuthed} isDemo={isDemo} />
          ))}
        </div>

        {/* ── Self-Host horizontal box ── */}
        <div className="mt-4 lg:mt-5 rounded-xl border border-neutral-800 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 px-6 lg:px-8 py-5 lg:py-6 bg-neutral-850">
            <div className="flex items-center gap-2.5 shrink-0">
              <GithubIcon size={16} />
              <span className="font-semibold text-neutral-100 text-[14px]">{t('bridgePricingSelfTitle')}</span>
            </div>
            <p className="m-0 text-[12.5px] text-dim shrink-0">{t('bridgePricingSelfSub')}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 flex-1">
              {ossFeatures.map((feat) => (
                <li key={feat} className="flex items-center gap-1.5 text-[12px] text-dim">
                  <CheckIcon color="var(--color-neutral-50)" />
                  {feat}
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/Ranork/remnus-app"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-700 text-[13px] text-neutral-50 hover:border-neutral-500 hover:text-neutral-100 transition-colors duration-150"
            >
              <GithubIcon size={13} />
              {t('bridgePricingSelfCta')}
              <span aria-hidden className="text-dim text-[11px]">↗</span>
            </a>
          </div>
        </div>

        {/* ── Detailed comparison: full table on /pricing, link on landing ── */}
        {showComparison ? (
          <div id="compare" className="mt-12 lg:mt-16 scroll-mt-24">
            <h3 className="m-0 mb-6 font-sans font-semibold text-neutral-100 text-[20px] lg:text-[24px]" style={{ letterSpacing: '-0.02em' }}>
              {t('bridgePricingTblHeading')}
            </h3>

            <div className="rounded-xl border border-neutral-800 overflow-x-auto md:overflow-visible">
              <table className="w-full min-w-170 border-collapse text-left">
                <thead>
                  <tr className="border-b border-neutral-800">
                    <th className="py-4 px-4 lg:px-6 text-[13px] font-medium text-dim">
                      {t('bridgePricingTblFeatureCol')}
                    </th>
                    {colTitles.map((title, i) => (
                      <th
                        key={title}
                        className="py-4 px-3 lg:px-4 text-center text-[13.5px] font-semibold text-neutral-100"
                        style={i === 1 ? { background: 'rgba(68,92,149,0.07)' } : undefined}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <tr
                        key={row.label}
                        className="border-b border-neutral-850 last:border-0 hover:bg-neutral-800/10 transition-colors duration-100"
                      >
                        <td className="py-3 px-4 lg:px-6 text-[13px] text-neutral-50">
                          <span className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4 shrink-0 text-dim" strokeWidth={1.75} />
                            <span>{row.label}</span>
                            <HelpTip text={row.desc} />
                          </span>
                        </td>
                        {row.cells.map((cell, i) => (
                          <td
                            key={i}
                            className="py-3 px-3 lg:px-4 text-center text-[13px] text-neutral-100"
                            style={i === 1 ? { background: 'rgba(68,92,149,0.07)' } : undefined}
                          >
                            {typeof cell === 'boolean'
                              ? (cell ? <CheckIcon color="var(--color-blue-500)" inline /> : <DashIcon />)
                              : cell}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-8 lg:mt-10 flex justify-center">
            <Link
              href="/pricing#compare"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-700 text-[13.5px] font-medium text-neutral-100 hover:border-neutral-500 transition-colors duration-150"
            >
              {t('bridgePricingCompareLink')}
              <span aria-hidden>→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <button
        type="button"
        aria-label={text}
        title={text}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-700 text-[10px] leading-none text-dim hover:text-neutral-100 hover:border-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors duration-150"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[12px] leading-[1.5] text-neutral-50 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 md:block"
      >
        {text}
      </span>
    </span>
  );
}

type PlanCardProps = {
  tier: PlanTier;
  isAuthed: boolean;
  isDemo: boolean;
  accent: Accent;
  title: string;
  tag: string;
  sub: string;
  price: string;
  priceSub: string | null;
  originalPrice?: string;
  discountLabel?: string;
  features: string[];
  cta: string;
  ctaHref: string;
  ctaVariant: 'solid' | 'outline';
  featured: boolean;
};

function PlanCard({
  tier, isAuthed, isDemo, accent, title, tag, sub, price, priceSub, originalPrice, discountLabel, features, cta, ctaHref, ctaVariant, featured,
}: PlanCardProps) {
  const a = ACCENTS[accent];
  return (
    <div
      className={`relative flex flex-col h-full rounded-xl border ${
        featured ? 'pricing-card-featured p-6 lg:p-8 lg:-my-4 lg:z-10' : 'p-6 lg:p-7'
      }`}
      style={
        featured
          ? {
              borderColor: 'rgba(68,92,149,0.5)',
              boxShadow: '0 0 0 1px rgba(68,92,149,0.15) inset, 0 24px 56px -16px rgba(68,92,149,0.3)',
            }
          : {
              background: `linear-gradient(160deg, ${a.tintFrom} 0%, transparent 50%)`,
              borderColor: 'var(--color-neutral-800)',
            }
      }
    >
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-neutral-100 text-[19px] lg:text-[21px]" style={{ letterSpacing: '-0.018em' }}>
          {title}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ color: a.tagColor, background: a.tagBg, border: `1px solid ${a.tagBorder}` }}
        >
          {tag}
        </span>
      </div>

      <p className="m-0 mb-6 text-dim text-[13px] leading-[1.6] min-h-[42px]">{sub}</p>

      {originalPrice && discountLabel && (
        <div className="mb-2 flex items-center gap-2.5">
          <span className="font-mono text-[12px] text-dim line-through">{originalPrice}</span>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded"
            style={{ color: 'var(--color-amber-500)', background: 'rgba(204,125,69,0.13)' }}
          >
            {discountLabel}
          </span>
        </div>
      )}

      <div className="mb-6 flex items-end gap-2">
        <span
          className="font-sans font-bold text-neutral-100 text-[40px] lg:text-[48px]"
          style={{ letterSpacing: '-0.04em', lineHeight: 1 }}
        >
          {price}
        </span>
        {priceSub && <span className="font-mono text-[12px] text-dim mb-1.5">{priceSub}</span>}
      </div>

      <div className="h-px mb-5" style={{ background: a.divider }} />

      <ul className="flex flex-col gap-2.5 flex-1 mb-6">
        {features.map((feat) => (
          <li key={feat} className="flex gap-2.5 items-start text-[13.5px] text-neutral-50">
            <CheckIcon color={a.color} />
            {feat}
          </li>
        ))}
      </ul>

      <PricingCtaButton
        tier={tier}
        isAuthed={isAuthed}
        isDemo={isDemo}
        href={ctaHref}
        label={cta}
        variant={ctaVariant}
        accentColor={a.color}
        solidTextLight={accent === 'blue'}
      />
    </div>
  );
}

function CheckIcon({ color, inline }: { color: string; inline?: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={inline ? 'inline-block' : 'shrink-0 mt-0.5'}>
      <path d="M5 12l5 5 9-12" />
    </svg>
  );
}

function DashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-700)" strokeWidth={2} strokeLinecap="round" className="inline-block">
      <path d="M6 12h12" />
    </svg>
  );
}

function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.4 3.4 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77a5 5 0 0 0-.09-3.77S18.73.65 16 2.48a13 13 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5 5 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.4 3.4 0 0 0 9 18.13V22" />
    </svg>
  );
}
