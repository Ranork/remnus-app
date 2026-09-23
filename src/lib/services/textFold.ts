/**
 * Language-neutral letter folding for retrieval: "Çözüm" ≡ "cozum",
 * "Invites" ≡ "invites", "İstanbul" ≡ "istanbul", "ılık" ≡ "ilik".
 *
 * Used on BOTH sides of every match (the task/query and the corpus), so a
 * workspace written in one script variant is found from the other. Never use
 * `toLocaleLowerCase('tr-TR')` for matching: it turns an English capital "I"
 * into a dotless "ı", so "Invites"/"API" stopped matching a lowercase task.
 *
 * Also matches what an FTS5 `unicode61 remove_diacritics 2` tokenizer does
 * (verified 2026-09-23 on SQLite 3.45.1), with one deliberate difference: that
 * tokenizer keeps the dotless "ı" as its own letter, so an FTS index would
 * have to `replace(…, 'ı', 'i')` before indexing to agree with this function.
 */
export function foldText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/ı/g, 'i');
}

// The accented letters of the Latin-script languages Remnus ships in (tr, es,
// fr, de) plus a few neighbours, grouped by the ASCII letter they fold to:
// 'c' → "cCçÇ", 'i' → "iIíÍìÌîÎïÏıİ", … Deliberately not all of Latin
// Extended-A: every letter in a group becomes a wildcard in the LIKE prefilter
// below, and a wildcard-only prefilter filters nothing.
const SEARCH_FOLD_GROUPS: Map<string, string> = (() => {
  const groups = new Map<string, Set<string>>();
  for (const char of 'áàâäãåçéèêëíìîïıİñóòôöõúùûüýÿğş') {
    const key = foldText(char);
    const group = groups.get(key) ?? new Set([key, key.toUpperCase()]);
    group.add(char);
    const upper = char.toUpperCase();
    if (upper.length === 1) group.add(upper);
    groups.set(key, group);
  }
  return new Map([...groups].map(([key, chars]) => [key, [...chars].join('')]));
})();

/**
 * SQLite patterns that find `query` as a case- and accent-insensitive
 * substring — "cozum", "çözüm" and "ÇÖZÜM" all find "Çözüm Notları", and
 * "istanbul" finds "İstanbul Ofisi". Use both, in this order:
 *
 *   col LIKE :like ESCAPE '\' AND col GLOB :glob
 *
 * `LIKE` folds ASCII case only, so on its own it never matched a Turkish or
 * accented letter written differently. `glob` is the exact test: one
 * character class per foldable letter (`[cCçÇ][oOöÖõÕ…]…`), which GLOB checks
 * as whole UTF-8 characters — accent folding with no per-row `replace()` and
 * no schema change. It is slow on its own, though (a class at every position
 * of every body: ~10× LIKE, measured on a 3.3M-character workspace), so `like`
 * runs first as a cheap superset: the same shape with each foldable letter
 * turned into `_`, which keeps LIKE on its fast skip-to-the-next-literal path.
 *
 * A letter outside the Latin fold groups (Cyrillic, CJK, …) stays literal in
 * both, so it matches exactly what the old `LIKE` search matched — never less.
 */
export function foldingSearchPatterns(query: string): { like: string; glob: string } {
  let like = '';
  let glob = '';
  for (const char of query) {
    const group = SEARCH_FOLD_GROUPS.get(foldText(char));
    if (group) {
      like += '_';
      glob += `[${group.includes(char) ? group : group + char}]`;
    } else if (/[A-Za-z]/.test(char)) {
      like += char; // LIKE already folds ASCII case
      glob += `[${char.toLowerCase()}${char.toUpperCase()}]`;
    } else {
      like += /[%_\\]/.test(char) ? `\\${char}` : char;
      glob += /[*?[\]]/.test(char) ? `[${char}]` : char;
    }
  }
  return { like: `%${like}%`, glob: `*${glob}*` };
}

/**
 * `foldText` plus, for every UTF-16 unit of the folded string, the index of the
 * original character it came from — so a match found in folded text can be cut
 * out of the original (for a snippet) without showing the folded spelling.
 */
export function foldTextWithOffsets(value: string): { folded: string; offsets: number[] } {
  let folded = '';
  const offsets: number[] = [];
  let index = 0;
  for (const char of value) {
    const piece = foldText(char);
    folded += piece;
    for (let i = 0; i < piece.length; i++) offsets.push(index);
    index += char.length;
  }
  return { folded, offsets };
}
