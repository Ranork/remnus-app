import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import BlogCard from '@/components/docs/BlogCard';
import BreadcrumbTrail from '@/components/docs/BreadcrumbTrail';
import PageHead from '@/components/marketing/site/PageHead';
import { getAllBlogPosts } from '@/lib/content';
import { blogIndexJsonLd, blogIndexBreadcrumbJsonLd } from '@/lib/content/seo';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Docs');
  const title = t('docsTitle');
  const description = t('docsIntro');
  return {
    metadataBase: new URL(METADATA_BASE_URL),
    title,
    description,
    alternates: { canonical: `${METADATA_BASE_URL}/docs` },
    openGraph: {
      title: `${title} | Remnus`,
      description,
      url: `${METADATA_BASE_URL}/docs`,
      siteName: 'Remnus',
      type: 'website',
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Remnus`,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export default async function DocsIndexPage() {
  const t = await getTranslations('Docs');
  const locale = await getLocale();
  const posts = getAllBlogPosts();
  const fmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const jsonLd = blogIndexJsonLd();
  const breadcrumbJsonLd = blogIndexBreadcrumbJsonLd();

  return (
    <section className="px-4 sm:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-[1200px] pt-10 pb-24 sm:pt-14 lg:pb-32">
        <BreadcrumbTrail
          items={[
            { name: t('breadcrumbHome'), href: '/' },
            { name: t('breadcrumbDocs') },
          ]}
        />
        <PageHead title={t('docsTitle')} lede={t('docsIntro')} className="mt-6 mb-12 lg:mb-16" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} dateLabel={fmt.format(new Date(post.date))} />
          ))}
        </div>
      </div>
    </section>
  );
}
