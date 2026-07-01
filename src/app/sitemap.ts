import type { MetadataRoute } from 'next';
import { db } from '@/db';
import { sharedPages } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only include shares explicitly opted-in to sitemap by an admin
  let sharedEntries: MetadataRoute.Sitemap = [];
  try {
    const shares = await db
      .select({ slug: sharedPages.slug, createdAt: sharedPages.createdAt })
      .from(sharedPages)
      .where(eq(sharedPages.inSitemap, true));
    sharedEntries = shares.map(s => ({
      url: `https://remnus.com/share/${s.slug}`,
      lastModified: s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt as number * 1000),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch { /* DB may not be available at build time */ }

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
    ...sharedEntries,
  ];
}
