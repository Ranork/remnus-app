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
      <article className="px-4 py-8 sm:px-8 lg:py-10">
        <div className="mx-auto max-w-[56rem] rounded-[14px] bg-sheet px-5 py-8 shadow-sheet sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <BreadcrumbTrail
            items={[
              { name: t('breadcrumbHome'), href: '/' },
              { name: t('breadcrumbDocs'), href: '/docs' },
              { name: post.meta.title },
            ]}
          />
          <header className="mb-10">
            <Icon size={24} className="mb-4 text-fg-3" />
            <h1 className="m-0 mb-4 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg sm:text-[40px]">
              {post.meta.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ui text-fg-3">
              <time dateTime={post.meta.date}>{dateLabel}</time>
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
