import type { LucideIcon } from 'lucide-react';
import DocsProse from './DocsProse';
import WikiToc from './WikiToc';
import BreadcrumbTrail, { type BreadcrumbItem } from './BreadcrumbTrail';
import type { DocHeading } from '@/lib/content';

// The content column of a wiki page: breadcrumb + title header + prose body +
// right-rail TOC. Rendered inside WikiShell's content slot (the left nav lives
// in the shell). The breadcrumb deliberately mirrors the BreadcrumbList JSON-LD
// built in src/lib/content/seo.ts.
export default function WikiArticle({
  title,
  icon: Icon,
  html,
  headings,
  tocLabel,
  breadcrumb,
}: {
  title: string;
  icon: LucideIcon;
  html: string;
  headings: DocHeading[];
  tocLabel: string;
  breadcrumb: BreadcrumbItem[];
}) {
  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1 max-w-4xl">
        <header className="mb-8">
          <BreadcrumbTrail items={breadcrumb} />
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 mb-4">
            <Icon size={22} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-neutral-100 tracking-tight m-0">
            {title}
          </h1>
        </header>
        <DocsProse html={html} />
      </article>
      <WikiToc headings={headings} label={tocLabel} />
    </div>
  );
}
