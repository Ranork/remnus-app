import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, getLocale } from 'next-intl/server';
import { Clock } from 'lucide-react';
import DocsProse from '@/components/docs/DocsProse';
import DocsArticleFooter from '@/components/docs/DocsArticleFooter';
import BreadcrumbTrail from '@/components/docs/BreadcrumbTrail';
import { getBlogPost, getAdjacentPosts } from '@/lib/content';
import { blogMetadata, blogJsonLd, blogBreadcrumbJsonLd } from '@/lib/content/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return blogMetadata(slug);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const t = await getTranslations('Docs');
  const locale = await getLocale();
  const { prev, next } = getAdjacentPosts(slug);
  const jsonLd = blogJsonLd(slug);
  const breadcrumbJsonLd = blogBreadcrumbJsonLd(slug);

  const dateLabel = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(post.meta.date));

  const Icon = post.meta.icon;

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
      <article className="px-4 sm:px-8 lg:px-14 py-14 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <BreadcrumbTrail
            items={[
              { name: t('breadcrumbHome'), href: '/' },
              { name: t('breadcrumbDocs'), href: '/docs' },
              { name: post.meta.title },
            ]}
          />
          <header className="mb-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 mb-5">
              <Icon size={22} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-100 tracking-tight leading-[1.15] mb-4">
              {post.meta.title}
            </h1>
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wide text-neutral-500">
              <time dateTime={post.meta.date}>{dateLabel}</time>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={12} />
                {t('readingTime', { min: post.readingTime })}
              </span>
            </div>
          </header>

          <DocsProse html={post.html} />

          <DocsArticleFooter
            prev={prev}
            next={next}
            backLabel={t('backToDocs')}
            prevLabel={t('previous')}
            nextLabel={t('next')}
          />
        </div>
      </article>
    </>
  );
}
