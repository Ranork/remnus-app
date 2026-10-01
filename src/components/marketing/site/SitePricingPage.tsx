import { getTranslations } from 'next-intl/server';
import type { LucideIcon } from 'lucide-react';
import {
  Bot, Check, FolderTree, Gauge, Globe, HardDrive, KeyRound, LifeBuoy, Minus, Plug, ScrollText, Share2, Table2, UserCog, Users,
} from 'lucide-react';
import { auth } from '@/auth';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import type { PlanTier } from '@/lib/billing/plans';
import { cn } from '@/lib/cn';
import PricingCtaButton from '../PricingCtaButton';
import PageHead from './PageHead';

/**
 * /pricing: four plans, the self-host option and the full comparison. Plan copy comes
 * from the `Landing` plan keys (8 locales); checkout behaviour is PricingCtaButton's.
 * The recommended plan carries the yellow: a signal ring, a filled badge, the one
 * signal button.
 */
export default async function SitePricingPage() {
  const t = await getTranslations('Landing');
  const tSite = await getTranslations('Site.pricing');
  const session = await auth();
  const isAuthed = !!session?.user;
  const isDemo = session?.user?.role === 'demo';

  const plans = [
    {
      tier: 'free' as PlanTier, title: t('bridgePricingFreeTitle'), tag: t('bridgePricingFreeTag'), sub: t('bridgePricingFreeSub'),
      price: t('bridgePricingFreePrice'), was: null, per: false,
      features: [1, 2, 3, 4, 5].map((n) => t(`bridgePricingFreeF${n}` as 'bridgePricingFreeF1')),
      cta: t('bridgePricingFreeCta'), href: '/login', featured: false,
    },
    {
      tier: 'startup' as PlanTier, title: t('bridgePricingStartupTitle'), tag: null, sub: t('bridgePricingStartupSub'),
      price: t('bridgePricingStartupPrice'), was: t('bridgePricingStartupOriginalPrice').split(' ')[0], per: true,
      features: [1, 2, 3, 4, 5].map((n) => t(`bridgePricingStartupF${n}` as 'bridgePricingStartupF1')),
      cta: t('bridgePricingStartupCta'), href: '/login', featured: true,
    },
    {
      tier: 'professional' as PlanTier, title: t('bridgePricingProTitle'), tag: null, sub: t('bridgePricingProSub'),
      price: t('bridgePricingProPrice'), was: t('bridgePricingProOriginalPrice').split(' ')[0], per: true,
      features: [1, 2, 3, 4, 5].map((n) => t(`bridgePricingProF${n}` as 'bridgePricingProF1')),
      cta: t('bridgePricingProCta'), href: '/login', featured: false,
    },
    {
      tier: 'enterprise' as PlanTier, title: t('bridgePricingEntTitle'), tag: null, sub: t('bridgePricingEntSub'),
      price: t('bridgePricingEntPrice'), was: null, per: false,
      features: [1, 2, 3, 4, 5].map((n) => t(`bridgePricingEntF${n}` as 'bridgePricingEntF1')),
      cta: t('bridgePricingEntCta'), href: '/contact', featured: false,
    },
  ];

  const tU = t('bridgePricingTblValUnlimited');
  const tCustom = t('bridgePricingTblValCustom');
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

  return (
    <section id="pricing" className="px-4 sm:px-8">
      <div className="mx-auto max-w-[1200px] pt-14 pb-24 sm:pt-20 lg:pb-32">
        <PageHead title={tSite('title')} lede={tSite('lede')} />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={cn(
                'flex flex-col rounded-[14px] bg-sheet p-6 shadow-sheet',
                plan.featured && 'shadow-[0_0_0_1.5px_var(--color-signal),var(--shadow-sheet)]',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[17px] font-semibold tracking-[-0.015em] text-fg">{plan.title}</span>
                {plan.featured ? <Badge variant="solid">{tSite('popular')}</Badge> : plan.tag && <Badge variant="outline">{plan.tag}</Badge>}
              </div>
              <p className="m-0 mt-2 min-h-[2.75rem] text-ui leading-relaxed text-fg-3">{plan.sub}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-[38px] leading-none font-semibold tracking-[-0.04em] text-fg">{plan.price}</span>
                {plan.was && <span className="text-ui text-fg-4 line-through">{plan.was}</span>}
                {plan.per && <span className="text-ui text-fg-3">{tSite('perMonth')}</span>}
              </div>
              <ul className="m-0 mt-6 flex-1 list-none space-y-2.5 border-t border-line p-0 pt-5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-fg-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <PricingCtaButton
                  tier={plan.tier}
                  isAuthed={isAuthed}
                  isDemo={isDemo}
                  href={plan.href}
                  label={plan.cta}
                  variant={plan.featured ? 'solid' : 'outline'}
                  accentColor=""
                  solidTextLight={false}
                  className={cn(buttonVariants({ variant: plan.featured ? 'signal' : 'outline', size: 'lg' }), 'w-full', !plan.featured && 'text-fg')}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Self-host */}
        <div className="mt-4 flex flex-col gap-4 rounded-[14px] bg-sheet p-6 shadow-sheet lg:flex-row lg:items-center lg:gap-8">
          <div className="lg:w-64 lg:shrink-0">
            <div className="text-[15px] font-semibold text-fg">{t('bridgePricingSelfTitle')}</div>
            <div className="mt-1 text-ui text-fg-3">{t('bridgePricingSelfSub')}</div>
          </div>
          <ul className="m-0 flex flex-1 list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {[t('bridgePricingSelfF1'), t('bridgePricingSelfF3'), t('bridgePricingSelfF5')].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-fg-2">
                <Check className="size-4 shrink-0 text-fg-3" aria-hidden />
                {feature}
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/Ranork/remnus-app"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'shrink-0 text-fg')}
          >
            {t('bridgePricingSelfCta')}
          </a>
        </div>

        {/* Full comparison */}
        <div id="compare" className="mt-20 scroll-mt-24">
          <h2 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-fg sm:text-[34px]">{t('bridgePricingTblHeading')}</h2>
          <div className="mt-8 overflow-x-auto rounded-[14px] bg-sheet shadow-sheet">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-4 text-ui font-medium text-fg-3">{t('bridgePricingTblFeatureCol')}</th>
                  {plans.map((plan) => (
                    <th key={plan.tier} className={cn('px-4 py-4 text-center text-sm font-semibold text-fg', plan.featured && 'bg-signal-soft/40')}>
                      {plan.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <tr key={row.label}>
                      <td className="px-5 py-3 text-sm text-fg-2">
                        <Tooltip content={row.desc}>
                          <span tabIndex={0} className="inline-flex cursor-help items-center gap-2.5 decoration-line-strong decoration-dotted underline-offset-4 hover:underline">
                            <Icon className="size-4 shrink-0 text-fg-3" strokeWidth={1.75} aria-hidden />
                            {row.label}
                          </span>
                        </Tooltip>
                      </td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className={cn('px-4 py-3 text-center text-sm text-fg', plans[i].featured && 'bg-signal-soft/40')}>
                          {typeof cell === 'boolean' ? (
                            cell ? (
                              <><Check className="mx-auto size-4 text-fg" aria-hidden /><span className="sr-only">{tSite('included')}</span></>
                            ) : (
                              <><Minus className="mx-auto size-4 text-fg-4" aria-hidden /><span className="sr-only">{tSite('notIncluded')}</span></>
                            )
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
