import { NextResponse } from 'next/server';
import { getWikiMarkdown } from '@/lib/content';
import { wikiUrl } from '@/lib/content/seo';

// Serves /wiki/<slug>.md (and /wiki.md) via a next.config.ts rewrite: the wiki page's
// markdown file itself, hidden pages (calibrate, playbooks) included — they are the
// ones agents are sent to. Public and cookie-less like /llms.txt: the path is excluded
// from proxy.ts's matcher (the intl middleware would otherwise rewrite it to a locale
// route that 404s) and allowlisted in auth.config.ts.

interface Ctx {
  params: Promise<{ slug?: string[] }>;
}

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const key = (slug ?? []).join('/');
  const body = getWikiMarkdown(key);
  if (body === null) {
    return new NextResponse('Not found\n', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Same content as the HTML page: point search engines there instead of
      // indexing a duplicate.
      Link: `<${wikiUrl(key)}>; rel="canonical"`,
    },
  });
}
