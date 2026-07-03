import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import WikiArticle from '@/components/docs/WikiArticle';
import { getWikiPage, WIKI_PAGES } from '@/lib/content';
import { wikiMetadata, wikiJsonLd, wikiBreadcrumbJsonLd } from '@/lib/content/seo';

interface Props {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  return WIKI_PAGES.filter((p) => p.slug).map((p) => ({ slug: p.slug.split('/') }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return wikiMetadata(slug.join('/'));
}

export default async function WikiSlugPage({ params }: Props) {
  const { slug } = await params;
  const key = slug.join('/');
  const t = await getTranslations('Docs');
  const page = getWikiPage(key);
  if (!page) notFound();

  const jsonLd = wikiJsonLd(key);
  const breadcrumbJsonLd = wikiBreadcrumbJsonLd(key);

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
          { name: t('breadcrumbWiki'), href: '/wiki' },
          { name: page.meta.title },
        ]}
      />
    </>
  );
}
