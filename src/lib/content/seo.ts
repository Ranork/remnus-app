import type { Metadata } from 'next';
import { METADATA_BASE_URL, DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from '@/lib/metadata';
import { getWikiPage, getBlogPost, getAllBlogPosts } from './index';

const SITE = 'Remnus';
const LOGO = `${METADATA_BASE_URL}/logo-square-transparent.png`;
const ORG = { '@type': 'Organization', name: SITE, url: METADATA_BASE_URL };

export function wikiUrl(slug: string): string {
  return slug ? `${METADATA_BASE_URL}/wiki/${slug}` : `${METADATA_BASE_URL}/wiki`;
}

export function docsUrl(slug: string): string {
  return `${METADATA_BASE_URL}/docs/${slug}`;
}

// Shared breadcrumb builder (BreadcrumbList) — mirrors the visible breadcrumb
// trail rendered on each page (see BreadcrumbTrail component), which is best
// practice: the structured data should match what's actually on the page.
function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ── Wiki ───────────────────────────────────────────────────────────────────────

export function wikiMetadata(slug: string): Metadata {
  const page = getWikiPage(slug);
  if (!page) return { title: 'Not Found' };
  const url = wikiUrl(slug);
  const title = page.meta.title;
  const description = page.description || undefined;
  return {
    metadataBase: new URL(METADATA_BASE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE} Wiki`,
      description,
      url,
      siteName: SITE,
      type: 'article',
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE} Wiki`,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export function wikiJsonLd(slug: string) {
  const page = getWikiPage(slug);
  if (!page) return null;
  const url = wikiUrl(slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: page.meta.title,
    description: page.description || undefined,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    dateModified: page.lastModified ?? undefined,
    inLanguage: 'en',
    author: ORG,
    isPartOf: { '@type': 'WebSite', name: SITE, url: METADATA_BASE_URL },
    publisher: {
      '@type': 'Organization',
      name: SITE,
      logo: { '@type': 'ImageObject', url: LOGO },
    },
  };
}

// Breadcrumb for a wiki page: Home > Wiki [> Page title, if not the overview itself]
export function wikiBreadcrumbJsonLd(slug: string) {
  const page = getWikiPage(slug);
  if (!page) return null;
  const items = [
    { name: 'Home', url: METADATA_BASE_URL },
    { name: 'Wiki', url: wikiUrl('') },
  ];
  if (slug) items.push({ name: page.meta.title, url: wikiUrl(slug) });
  return breadcrumbJsonLd(items);
}

// ── Docs (blog) ─────────────────────────────────────────────────────────────────

export function blogMetadata(slug: string): Metadata {
  const post = getBlogPost(slug);
  if (!post) return { title: 'Not Found' };
  const url = docsUrl(slug);
  const { title, description, date } = post.meta;
  return {
    metadataBase: new URL(METADATA_BASE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${SITE}`,
      description,
      url,
      siteName: SITE,
      type: 'article',
      publishedTime: date,
      modifiedTime: post.lastModified ?? date,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE}`,
      description,
      images: [DEFAULT_TWITTER_IMAGE],
    },
  };
}

export function blogJsonLd(slug: string) {
  const post = getBlogPost(slug);
  if (!post) return null;
  const url = docsUrl(slug);
  const { title, description, date } = post.meta;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: date,
    dateModified: post.lastModified ?? date,
    inLanguage: 'en',
    image: DEFAULT_OG_IMAGE.url,
    author: ORG,
    publisher: {
      '@type': 'Organization',
      name: SITE,
      logo: { '@type': 'ImageObject', url: LOGO },
    },
  };
}

// Blog-section index schema — lists every post so crawlers/AI agents get the
// full picture from the /docs page alone, without needing to follow each link.
export function blogIndexJsonLd() {
  const posts = getAllBlogPosts();
  const url = `${METADATA_BASE_URL}/docs`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': url,
    name: `${SITE} Blog`,
    url,
    inLanguage: 'en',
    publisher: {
      '@type': 'Organization',
      name: SITE,
      logo: { '@type': 'ImageObject', url: LOGO },
    },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description,
      url: docsUrl(p.slug),
      datePublished: p.date,
    })),
  };
}

export function blogIndexBreadcrumbJsonLd() {
  return breadcrumbJsonLd([
    { name: 'Home', url: METADATA_BASE_URL },
    { name: 'Docs', url: `${METADATA_BASE_URL}/docs` },
  ]);
}

// Breadcrumb for a blog post: Home > Docs > Post title
export function blogBreadcrumbJsonLd(slug: string) {
  const post = getBlogPost(slug);
  if (!post) return null;
  return breadcrumbJsonLd([
    { name: 'Home', url: METADATA_BASE_URL },
    { name: 'Docs', url: `${METADATA_BASE_URL}/docs` },
    { name: post.meta.title, url: docsUrl(slug) },
  ]);
}
