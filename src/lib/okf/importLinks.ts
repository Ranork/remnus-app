import { resolveBundleMarkdownLink } from './paths';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface ImportedConceptTarget {
  id: string;
  title: string;
}

export function rewriteImportedConceptLinks(
  content: string,
  sourcePath: string,
  databaseId: string,
  targetsByPath: Map<string, ImportedConceptTarget>,
): { content: string; rewritten: number } {
  let rewritten = 0;
  const next = content.replace(/(!?)\[([^\]]+)\]\(([^)]+)\)/g, (whole, imagePrefix: string, label: string, href: string) => {
    if (imagePrefix) return whole;
    const targetPath = resolveBundleMarkdownLink(sourcePath, href.trim());
    if (!targetPath) return whole;
    const target = targetsByPath.get(targetPath.toLowerCase());
    if (!target) return whole;
    rewritten++;
    return `<a data-page-link href="/db/${escapeHtml(databaseId)}/${escapeHtml(target.id)}" data-type="database_row">${escapeHtml(label)}</a>`;
  });
  return { content: next, rewritten };
}
