import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import SectionHead from './SectionHead';

/** Pricing at a glance: four plans in one ruled row; the details live on /pricing. */
export default async function SitePricing() {
  const t = await getTranslations('Site.pricing');
  const l = await getTranslations('Landing');

  const plans = [
    { title: l('bridgePricingFreeTitle'), price: l('bridgePricingFreePrice'), per: false, lines: [l('bridgePricingFreeF1'), l('bridgePricingFreeF3')] },
    {
      title: l('bridgePricingStartupTitle'),
      price: l('bridgePricingStartupPrice'),
      was: l('bridgePricingStartupOriginalPrice').split(' ')[0],
      per: true,
      popular: true,
      lines: [l('bridgePricingStartupF1'), l('bridgePricingStartupF2')],
    },
    {
      title: l('bridgePricingProTitle'),
      price: l('bridgePricingProPrice'),
      was: l('bridgePricingProOriginalPrice').split(' ')[0],
      per: true,
      lines: [l('bridgePricingProF1'), l('bridgePricingProF2')],
    },
    { title: l('bridgePricingEntTitle'), price: l('bridgePricingEntPrice'), per: false, lines: [l('bridgePricingEntF1'), l('bridgePricingEntF2')] },
  ];

  return (
    <section className="px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t('title')} lede={t('lede')} />
        <div className="mt-12 grid gap-x-8 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.title} className="border-t border-line-strong py-6">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold text-fg">{plan.title}</span>
                {plan.popular && <Badge variant="solid">{t('popular')}</Badge>}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[34px] leading-none font-semibold tracking-[-0.035em] text-fg">{plan.price}</span>
                {plan.was && <span className="text-ui text-fg-4 line-through">{plan.was}</span>}
                {plan.per && <span className="text-ui text-fg-3">{t('perMonth')}</span>}
              </div>
              <ul className="m-0 mt-4 list-none space-y-1.5 p-0 text-[15px] text-fg-2">
                {plan.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/pricing" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'text-fg')}>
            {t('compare')}
          </Link>
          <a
            href="https://github.com/Ranork/remnus-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg-3"
          >
            {t('selfHost')}
          </a>
        </div>
      </div>
    </section>
  );
}
