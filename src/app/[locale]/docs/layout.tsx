import type { ReactNode } from 'react';
import MarketingShell from '@/components/marketing/MarketingShell';

// Shared chrome for /docs (index) and /docs/[slug] (article): the site frame on the desk.
export default function DocsLayout({ children }: { children: ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
