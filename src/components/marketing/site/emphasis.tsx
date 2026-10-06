import type { ReactNode } from 'react';

/**
 * Headline emphasis (U1). A heading's message marks at most one word group with
 * `<em>…</em>` — the same group in every locale — and the site draws it as `.site-em`
 * (globals.css). Render the heading with `t.rich(key, { em })`.
 */
export const em = (chunks: ReactNode) => <em className="site-em">{chunks}</em>;
