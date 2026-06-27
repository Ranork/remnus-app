import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { generateHTML } from '@tiptap/core';

// Sanitize cell colors — mirrors BlockEditor.safeColor (hex / rgb(a) / hsl(a) /
// named). The value can originate from pasted/imported HTML (parseHTML), so it
// is never trusted: anything outside this whitelist is dropped, so no quotes /
// angle brackets / `;` can break out of the style attribute.
const SAFE_COLOR_RE =
  /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/]+\)$|^[a-zA-Z]{1,32}$/;
function safeColor(value: unknown): string | null {
  return typeof value === 'string' && SAFE_COLOR_RE.test(value.trim()) ? value.trim() : null;
}

// A `backgroundColor` cell attribute, shared by tableCell + tableHeader. It
// renders as an inline `background-color` style (so it shows live in the editor)
// plus a `data-bg-color` mirror carrying the exact picked value, which parseHTML
// prefers over the browser-normalized `style.backgroundColor` for an exact
// round-trip.
function backgroundColorAttribute() {
  return {
    backgroundColor: {
      default: null as string | null,
      parseHTML: (el: HTMLElement) =>
        el.getAttribute('data-bg-color') || (el.style.backgroundColor || null),
      renderHTML: (attrs: Record<string, any>) => {
        const c = safeColor(attrs.backgroundColor);
        if (!c) return {};
        return { 'data-bg-color': c, style: `background-color: ${c}` };
      },
    },
  };
}

export const BgTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute() };
  },
});

export const BgTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...backgroundColorAttribute() };
  },
});

/**
 * True when the table carries state GFM can't represent — a cell background
 * color or a manual column width (`colwidth`, set by the column-resize drag).
 * Such tables are serialized as HTML so that state survives a reload.
 */
function tableNeedsHtml(node: any): boolean {
  if (!node?.content) return false;
  for (const row of node.content) {
    for (const cell of row?.content ?? []) {
      if (safeColor(cell?.attrs?.backgroundColor)) return true;
      if (cell?.attrs?.colwidth) return true;
    }
  }
  return false;
}

// Captured at editor create — generateHTML needs the full extension set to
// render cell inner content (marks, links, colors) faithfully. All BlockEditor
// instances share the same extension config, so a single module-level ref is
// safe (the last-created editor wins; the sets are identical).
let extensionsForHtml: any[] | null = null;

export const MarkdownTable = Table.extend({
  onCreate() {
    extensionsForHtml = (this as any).editor.extensionManager.extensions;
  },

  // GFM tables carry only text + alignment, so per-cell background colors and
  // manual column widths are lost through the default markdown serializer (same
  // limitation the inline color marks work around with inline HTML). Such a
  // table is therefore serialized as a single-line HTML <table> block, which
  // round-trips via @tiptap/markdown's HTML token → generateJSON →
  // BgTableCell.parseHTML (colors) + the cell `colwidth` attribute (widths). A
  // plain table keeps the clean GFM serialization (this.parent — the base
  // extension's renderMarkdown, bound by getExtensionField).
  // renderMarkdown is a @tiptap/markdown extension field, not in Tiptap core types
  renderMarkdown(this: any, node: any, helpers: any, context: any) {
    if (!tableNeedsHtml(node) || !extensionsForHtml) {
      return this.parent ? this.parent(node, helpers, context) : '';
    }
    const html = generateHTML({ type: 'doc', content: [node] }, extensionsForHtml as any);
    return '\n\n' + html.replace(/\n+/g, ' ').trim() + '\n\n';
  },
});
