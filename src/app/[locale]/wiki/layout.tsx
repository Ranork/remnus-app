import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import MarketingShell from '@/components/marketing/MarketingShell';
import WikiShell from '@/components/docs/WikiShell';
import { getWikiNav } from '@/lib/content';

export default async function WikiLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Docs');
  const items = getWikiNav();
  return (
    <MarketingShell>
      <WikiShell items={items} heading={t('wikiNavHeading')} menuLabel={t('menu')}>
        {children}
      </WikiShell>
    </MarketingShell>
  );
}
