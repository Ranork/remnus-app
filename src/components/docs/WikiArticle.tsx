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
    <div className="flex gap-12 rounded-[14px] bg-sheet px-5 py-8 shadow-sheet sm:px-10 sm:py-10 lg:px-12">
      <article className="min-w-0 max-w-[46rem] flex-1">
        <header className="mb-8">
          <BreadcrumbTrail items={breadcrumb} />
          <Icon size={24} className="mb-4 text-fg-3" aria-hidden />
          <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg sm:text-[40px]">
            {title}
          </h1>
        </header>
        <DocsProse html={html} />
      </article>
      <WikiToc headings={headings} label={tocLabel} />
    </div>
  );
}
