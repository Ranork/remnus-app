import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import WikiArticle from '@/components/docs/WikiArticle';
import { getWikiPage } from '@/lib/content';
import { wikiMetadata, wikiJsonLd, wikiBreadcrumbJsonLd } from '@/lib/content/seo';

export function generateMetadata(): Metadata {
  return wikiMetadata('');
}

export default async function WikiOverviewPage() {
  const t = await getTranslations('Docs');
  const page = getWikiPage('');
  if (!page) notFound();

  const jsonLd = wikiJsonLd('');
  const breadcrumbJsonLd = wikiBreadcrumbJsonLd('');

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <WikiArticle
        title={page.meta.title}
        icon={page.meta.icon}
        html={page.html}
        headings={page.headings}
        tocLabel={t('onThisPage')}
        breadcrumb={[
          { name: t('breadcrumbHome'), href: '/' },
          { name: t('breadcrumbWiki') },
        ]}
      />
    </>
  );
}
