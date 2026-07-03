import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { sharedPages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { WIKI_PAGES, BLOG_POSTS } from '@/lib/content/manifest';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only include shares explicitly opted-in to sitemap by an admin. The MCP docs
  // + blog moved to the file-driven /wiki and /docs routes (added below), so
  // filter out their legacy /share/docs/mcp* and /share/blog* rows — they now
  // 301-redirect and must not appear as canonical sitemap URLs.
  let sharedEntries: MetadataRoute.Sitemap = [];
  try {
    const shares = await db
      .select({ slug: sharedPages.slug, createdAt: sharedPages.createdAt })
      .from(sharedPages)
      .where(eq(sharedPages.inSitemap, true));
    sharedEntries = shares
      .filter((s) => !s.slug.startsWith('docs/mcp') && s.slug !== 'blog' && !s.slug.startsWith('blog/'))
      .map((s) => ({
        url: `https://remnus.com/share/${s.slug}`,
        lastModified: s.createdAt instanceof Date ? s.createdAt : new Date((s.createdAt as number) * 1000),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
  } catch { /* DB may not be available at build time */ }

  // Wiki (MCP reference) + Docs (blog) — file-driven, always in the sitemap.
  const wikiEntries: MetadataRoute.Sitemap = WIKI_PAGES.map((p) => ({
    url: p.slug ? `https://remnus.com/wiki/${p.slug}` : 'https://remnus.com/wiki',
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: p.slug ? 0.7 : 0.8,
  }));
  const blogEntries: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `https://remnus.com/docs/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    {
      url: 'https://remnus.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://remnus.com/pricing',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://remnus.com/docs',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: 'https://remnus.com/download',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: 'https://remnus.com/contact',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://remnus.com/privacy',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://remnus.com/brand',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    ...wikiEntries,
    ...blogEntries,
    ...sharedEntries,
  ];
}
