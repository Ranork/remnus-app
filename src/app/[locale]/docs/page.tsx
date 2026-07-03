import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import BlogCard from '@/components/docs/BlogCard';
import BreadcrumbTrail from '@/components/docs/BreadcrumbTrail';
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
    <section className="px-4 sm:px-8 lg:px-14 py-16 lg:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="max-w-6xl mx-auto">
        <BreadcrumbTrail
          items={[
            { name: t('breadcrumbHome'), href: '/' },
            { name: t('breadcrumbDocs') },
          ]}
        />
        <header className="mb-12 lg:mb-16">
          <p className="font-mono text-[11px] uppercase tracking-widest text-blue-500 mb-3">
            {t('docsEyebrow')}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-neutral-100 tracking-tight mb-4">
            {t('docsTitle')}
          </h1>
          <p className="text-neutral-300 text-[15px] leading-relaxed max-w-2xl">
            {t('docsIntro')}
          </p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} dateLabel={fmt.format(new Date(post.date))} />
          ))}
        </div>
      </div>
    </section>
  );
}
