import type { Fragment } from '@tiptap/pm/model';

// ─────────────────────────────────────────────────────────────────────────────
// Clipboard markdown serialization.
//
// The editor's STORAGE serializer (getMarkdown / manager.serialize) emits the
// atom blocks (callout, image, bookmark, file, youtube, child page, page link)
// as single-line `<div data-*>` / `<a data-page-link>` HTML blocks so they
// round-trip losslessly back into the same node on reload. That HTML is correct
// for storage but ugly on the CLIPBOARD — copying a callout would put a raw
// `<div data-callout-…>` onto the clipboard.
//
// This module post-processes that storage markdown into clipboard-friendly
// markdown: the HTML atom blocks become readable markdown (a blockquote, an
// image, a link, a URL…) and excess blank lines are collapsed. Used by BOTH
// copy paths so a native text selection and the marquee block selection produce
// identical, clean markdown.
// ─────────────────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return (s || '')
    .replace(/&#10;/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Read a single `name="value"` attribute out of a matched HTML element string.
function getAttr(el: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`).exec(el);
  return m ? decodeEntities(m[1]) : '';
}

/**
 * Turn the editor's storage markdown (which may contain `<div data-*>` /
 * `<a data-page-link>` atom blocks) into clipboard-friendly markdown.
 */
export function cleanupCopiedMarkdown(md: string): string {
  let out = md;

  // Callout → blockquote (`> 💡 text`), each inner line prefixed so multi-line
  // callout bodies stay inside the quote.
  out = out.replace(/<div [^>]*data-callout-color="[^"]*"[^>]*><\/div>/g, (el) => {
    const icon = getAttr(el, 'data-callout-icon');
    const text = getAttr(el, 'data-callout-text');
    const body = `${icon ? icon + ' ' : ''}${text}`.trim();
    return body
      .split('\n')
      .map((line) => `> ${line}`.trimEnd())
      .join('\n');
  });

  // Image → ![alt](src)
  out = out.replace(/<div [^>]*data-img-src="[^"]*"[^>]*><\/div>/g, (el) => {
    const src = getAttr(el, 'data-img-src');
    const alt = getAttr(el, 'data-img-alt');
    return src ? `![${alt}](${src})` : '';
  });

  // Bookmark → [title](url)
  out = out.replace(/<div [^>]*data-bm-url="[^"]*"[^>]*><\/div>/g, (el) => {
    const url = getAttr(el, 'data-bm-url');
    const title = getAttr(el, 'data-bm-title') || url;
    return url ? `[${title}](${url})` : '';
  });

  // File → [name](url)
  out = out.replace(/<div [^>]*data-file-url="[^"]*"[^>]*><\/div>/g, (el) => {
    const url = getAttr(el, 'data-file-url');
    const name = getAttr(el, 'data-file-name') || url;
    return url ? `[${name}](${url})` : '';
  });

  // YouTube → watch URL
  out = out.replace(/<div [^>]*data-yt-id="([^"]*)"[^>]*><\/div>/g, (_el, id) =>
    id ? `https://www.youtube.com/watch?v=${id}` : '',
  );

  // Child page / database reference → its title as plain text.
  out = out.replace(/<div [^>]*data-cb-id="[^"]*"[^>]*><\/div>/g, (el) => {
    const title = getAttr(el, 'data-cb-title');
    const icon = getAttr(el, 'data-cb-icon');
    const label = `${icon && !icon.startsWith('lucide:') && !icon.startsWith('http') ? icon + ' ' : ''}${title}`.trim();
    return label;
  });

  // Inline page link → its label as plain text.
  out = out.replace(/<a [^>]*data-page-link[^>]*>([^<]*)<\/a>/g, (_el, label) =>
    decodeEntities(label),
  );

  // Indented paragraph → strip the <p data-indent> wrapper, keep inline content.
  // IndentedParagraph serializes indent>0 paragraphs as HTML blocks so the
  // indent level round-trips; these should not appear verbatim in clipboard text.
  out = out.replace(/<p\b[^>]*data-indent="[^"]*"[^>]*>([\s\S]*?)<\/p>/g, '$1');

  // Indented heading → convert back to markdown `##` heading.
  // CollapsibleHeading serializes indent>0 headings as <h1 data-indent="N">…</h1>.
  out = out.replace(
    /<h([1-6])\b[^>]*data-indent="[^"]*"[^>]*>([\s\S]*?)<\/h\1>/g,
    (_, level, content) => '#'.repeat(Number(level)) + ' ' + content,
  );

  // Strip inline color-mark HTML wrappers. The storage serializer emits
  // <span style="color:…"> (ColorTextStyle) and <mark data-color="…"> (ColorHighlight)
  // so colors round-trip on reload; but these appear LITERALLY when pasted through
  // the markdown path (text/plain). Colors are preserved via text/html (ProseMirror's
  // default serializer) — so the text/plain path only needs the bare text.
  out = out.replace(/<span style="color:[^"]*">/g, '');
  out = out.replace(/<\/span>/g, '');
  out = out.replace(/<mark\b[^>]*>/g, '');
  out = out.replace(/<\/mark>/g, '');

  // Normalize whitespace: drop blank-only (`&nbsp;`) lines the paragraph
  // serializer leaves behind, collapse 3+ newlines to a single blank line, and
  // trim — so pasting never produces the "doubled blank line" look.
  out = out
    .replace(/^[ \t]*(?:&nbsp;| )[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return out;
}

// Resolve the @tiptap/markdown manager from an editor instance.
function getManager(editor: any): any {
  return editor?.markdown ?? editor?.storage?.markdown?.manager ?? null;
}

const LIST_TYPE_NAMES = new Set(['bulletList', 'orderedList', 'taskList']);
const LIST_ITEM_TYPE_NAMES = new Set(['listItem', 'taskItem']);

/**
 * A plain text selection spanning across list items (e.g. from mid-item-1 to
 * mid-item-3) slices down to a flat array of `listItem`/`taskItem` nodes, not
 * wrapped in their `bulletList`/`orderedList`/`taskList` parent — ProseMirror's
 * `Node.slice` only ever returns the CHILDREN of the shared ancestor, never
 * the ancestor itself. Serializing those loose items renders each as its own
 * one-item list, which markdown separates with a blank line, so pasting the
 * selection back shows an extra blank line between every item instead of one
 * tight list. Replicates the exact shared-ancestor lookup `Node.slice` used
 * internally, so we can tell whether the fragment actually came from cutting
 * through a single list.
 */
function wrappingListNode(editor: any): { type: string; attrs: Record<string, any> } | null {
  try {
    const sel = editor?.state?.selection;
    if (!sel?.$from) return null;
    const depth = sel.$from.sharedDepth(sel.to);
    const node = sel.$from.node(depth);
    if (!node || !LIST_TYPE_NAMES.has(node.type.name)) return null;
    return { type: node.type.name, attrs: node.attrs ?? {} };
  } catch {
    return null;
  }
}

/**
 * A copy of exactly one table cell always slices down to this exact shape —
 * one `tableRow` containing one `tableCell`/`tableHeader` — regardless of
 * which Selection subclass produced it (a single-cell CellSelection is the
 * common case, via triple-click or a drag that grazed the cell border, but
 * this is a structural check rather than an `instanceof` one so it also
 * catches any other path that lands on the same shape). A real multi-cell
 * copy has more than one cell and/or more than one row, so it's untouched.
 */
function unwrapSingleCellTableFragment(json: any[]): any[] | null {
  if (json.length !== 1) return null;
  const row = json[0];
  if (!row || row.type !== 'tableRow') return null;
  const cells = row.content ?? [];
  if (cells.length !== 1) return null;
  const cell = cells[0];
  if (cell?.type !== 'tableCell' && cell?.type !== 'tableHeader') return null;
  return cell.content ?? [];
}

/**
 * Serialize a ProseMirror fragment to clipboard-friendly markdown. Loose inline
 * (text) nodes — e.g. a partial selection inside one paragraph — are wrapped in
 * a paragraph so the markdown manager always receives a valid document.
 */
export function fragmentToCleanMarkdown(editor: any, fragment: Fragment): string {
  const manager = getManager(editor);
  if (!manager?.serialize) {
    return fragment.textBetween(0, fragment.size, '\n\n', '\n');
  }

  let json: any = fragment.toJSON() ?? [];
  if (!Array.isArray(json)) json = [json];

  const singleCellContent = unwrapSingleCellTableFragment(json);
  if (singleCellContent) {
    const md = contentToCleanMarkdown(editor, singleCellContent);
    if (md != null) return md;
  }

  const listWrap = wrappingListNode(editor);
  if (listWrap && json.length && json.every((n: any) => LIST_ITEM_TYPE_NAMES.has(n?.type))) {
    const md = contentToCleanMarkdown(editor, [{ type: listWrap.type, attrs: listWrap.attrs, content: json }]);
    if (md != null) return md;
  }

  // Group loose inline nodes into paragraphs; pass block nodes through.
  const content: any[] = [];
  let inline: any[] = [];
  const flush = () => {
    if (inline.length) {
      content.push({ type: 'paragraph', content: inline });
      inline = [];
    }
  };
  for (const n of json) {
    if (n && (n.type === 'text' || n.type === 'hardBreak')) {
      inline.push(n);
    } else {
      flush();
      content.push(n);
    }
  }
  flush();

  let md = '';
  try {
    md = manager.serialize({ type: 'doc', content });
  } catch {
    return fragment.textBetween(0, fragment.size, '\n\n', '\n');
  }
  return cleanupCopiedMarkdown(md);
}

/**
 * Serialize a pre-built JSON content array (doc children) to clean markdown.
 * Callers that need to massage the structure first (e.g. regrouping loose list
 * items back into their parent list) build the content themselves and pass it here.
 */
export function contentToCleanMarkdown(editor: any, content: any[]): string | null {
  const manager = getManager(editor);
  if (!manager?.serialize) return null;
  try {
    const md = manager.serialize({ type: 'doc', content });
    return cleanupCopiedMarkdown(md) || null;
  } catch {
    return null;
  }
}

/**
 * Serialize an explicit list of block nodes (block selection) to clean markdown.
 */
export function nodesToCleanMarkdown(editor: any, nodes: any[]): string | null {
  const fallback = () => nodes.map((n) => n.textContent).join('\n\n') || null;
  return contentToCleanMarkdown(editor, nodes.map((n) => n.toJSON())) ?? fallback();
}
