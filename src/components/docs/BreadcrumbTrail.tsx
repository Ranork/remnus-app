import Link from '@/components/ui/link';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = { name: string; href?: string };

// Visible breadcrumb trail — deliberately mirrors the BreadcrumbList JSON-LD
// (see src/lib/content/seo.ts) so structured data matches what's on the page.
export default function BreadcrumbTrail({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-ui text-fg-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={12} className="shrink-0 text-fg-4" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="transition-colors duration-150 hover:text-fg">
                {item.name}
              </Link>
            ) : (
              <span className="text-fg-2" aria-current="page">{item.name}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
