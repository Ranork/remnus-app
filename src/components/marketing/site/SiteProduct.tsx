import { getTranslations } from 'next-intl/server';
import { em } from './emphasis';
import ProductTabs from './ProductTabs';
import SectionHead from './SectionHead';

export default async function SiteProduct() {
  const t = await getTranslations('Site.product');
  const tabs = [
    { id: 'dashboard', label: t('tabDashboard'), body: t('dashboardBody'), alt: t('dashboardAlt') },
    { id: 'board', label: t('tabBoard'), body: t('boardBody'), alt: t('boardAlt') },
    { id: 'page', label: t('tabPages'), body: t('pagesBody'), alt: t('pagesAlt') },
    { id: 'map', label: t('tabMap'), body: t('mapBody'), alt: t('mapAlt') },
  ];

  return (
    <section id="product" className="site-product scroll-mt-20 px-4 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-[1200px]">
        <SectionHead title={t.rich('title', { em })} lede={t('lede')} />
        <div className="mt-12 lg:mt-14">
          <ProductTabs tabs={tabs} />
        </div>
      </div>
    </section>
  );
}
