/**
 * Query side of the `search_workspace` full-text index. The write side is the
 * trigger set in src/db/apply-0052-search-index.ts; the two must agree on the
 * workspace token and on folding (see foldText in ./textFold).
 */
import { foldText } from './textFold';

/** Below this many letters/digits the old substring scan answers instead. */
export const MIN_INDEXED_QUERY_CHARS = 3;
const MAX_QUERY_TERMS = 12;

// Scripts written without spaces: unicode61 makes a whole run one token, so a word
// inside it is not a token prefix and FTS cannot find it. The substring scan can.
const NO_WORD_BREAKS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/** The `ws` column value the triggers write: 'w' + the workspace id without dashes. */
export function workspaceSearchToken(workspaceId: string): string {
  return `w${workspaceId.replace(/-/g, '')}`;
}

/** The query's words as the index sees them (folded; one-letter words dropped). */
export function searchTerms(query: string): string[] {
  return foldText(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(term => term.length >= 2)
    .slice(0, MAX_QUERY_TERMS);
}

/**
 * The FTS5 MATCH expression for `query` inside one workspace, or null when the
 * substring scan should answer instead (too short, or a script without spaces).
 *
 * Every word becomes a quoted prefix phrase (`"cozum"*`), so no user text can
 * reach FTS5 as syntax, and a word the tokenizer splits (Hindi vowel signs are
 * separators to unicode61) still matches because the document was split the
 * same way. Only the dotless "ı" is folded here — case and Latin accents are
 * the tokenizer's job, and stripping combining marks in JS would break Hindi.
 */
export function searchMatchExpression(workspaceId: string, query: string): string | null {
  if (foldText(query).replace(/[^\p{L}\p{N}]/gu, '').length < MIN_INDEXED_QUERY_CHARS) return null;
  if (NO_WORD_BREAKS.test(query)) return null;
  const words = query
    .replace(/ı/g, 'i')
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(word => foldText(word).length >= 2)
    .slice(0, MAX_QUERY_TERMS);
  if (words.length === 0) return null;
  const ws = workspaceSearchToken(workspaceId).replace(/"/g, '""');
  return `ws : "${ws}" AND {title body} : (${words.map(word => `"${word}"*`).join(' ')})`;
}
