import type { PageWidthMode } from './PageActionsMenu';

/**
 * The page column for each width mode (standalone pages and database rows share it).
 * Narrow — the default — is sized for reading: a 560px text column, where the 16px
 * Onest body sets 70–75 characters a line (measured; a comfortable measure is 65–75,
 * V2 R8.1 — the old 768px column ran to ~95). Wide and full are the reader's own
 * choice for tables and boards, so they are not held to it.
 */
export function pageContainerClass(mode: PageWidthMode): string {
  if (mode === 'full') return 'px-4 sm:px-8 md:px-16 py-6 sm:py-10';
  if (mode === 'wide') return 'max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6 sm:py-10';
  return 'max-w-[43rem] mx-auto px-4 sm:px-8 lg:px-16 py-6 sm:py-10';
}
