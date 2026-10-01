import type { CSSProperties } from 'react';
import { Fraunces } from 'next/font/google';

// The serif of the pre-R8.7 landings (/landing-old, /landing-next). Loaded only by those
// two pages — the site and the app no longer use a serif, so it stays off every other
// page. `--font-serif` is re-pointed on the wrapper because the @theme value resolves at
// :root, where `--font-fraunces` is no longer defined.
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

export const legacyFontClass = fraunces.variable;
export const legacyFontStyle = { '--font-serif': 'var(--font-fraunces)' } as CSSProperties;
