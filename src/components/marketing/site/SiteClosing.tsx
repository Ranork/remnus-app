import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/components/ui/button';
import { RemnusMark } from '@/components/ui/remnus-mark';
import { cn } from '@/lib/cn';
import SiteDemoButton from './SiteDemoButton';

export default async function SiteClosing() {
  const t = await getTranslations('Site.closing');
  const tHero = await getTranslations('Site.hero');

  return (
    <section className="px-4 pt-8 pb-24 sm:px-8 lg:pb-32">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 rounded-[18px] bg-sheet p-8 shadow-sheet sm:p-12 lg:flex-row lg:items-end lg:justify-between lg:p-16">
        <div>
          <RemnusMark className="size-8 text-fg" />
          <h2 className="m-0 mt-8 max-w-[16ch] text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance text-fg sm:text-[46px] lg:text-[54px]">
            {t('title')}
          </h2>
          <p className="m-0 mt-4 text-base text-fg-2 sm:text-[17px]">{t('body')}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <SiteDemoButton label={tHero('demo')} />
          <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'h-11 px-5 text-[15px] text-fg')}>
            {tHero('start')}
          </Link>
        </div>
      </div>
    </section>
  );
}
