/**
 * Knowledge-map colours, read from the live CSS tokens (`globals.css` `@theme`,
 * redefined per `[data-theme]`) rather than hard-coded: WebGL cannot use
 * `var(--…)`, so the renderer asks for the resolved values and asks again
 * whenever `<html data-theme>` changes. Light themes invert the neutral scale,
 * so "neutral-700 for quiet things" stays quiet on either background.
 *
 * Only tokens that every theme defines as a plain hex are used — Tailwind's
 * own defaults are `oklch()`, which sigma's colour parser does not read.
 */

export type GraphTheme = {
  canvas: string;
  panel: string;
  border: string;
  label: string;
  labelMuted: string;
  dim: string;
  dimEdge: string;
  accent: string;
  font: string;
  kind: { page: string; database: string; dashboard: string; row: string; tag: string; file: string; folder: string };
  trust: { reviewed: string; confirmed: string; draft: string; stale: string; deprecated: string; none: string };
  agent: { wrote: string; read: string; none: string };
  edge: { hierarchy: string; membership: string; link: string; mention: string; tag: string; source: string; folder: string };
  /** Categorical hues for clusters, all from theme tokens. */
  clusters: string[];
  clusterRest: string;
};

function hexToRgb(hex: string): [number, number, number] | null {
  const value = hex.trim().replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/**
 * `color` at `alpha` over `background`, as an OPAQUE hex. Sigma's WebGL
 * blending treats colours as if premultiplied, so a translucent colour
 * lighter than its own alpha (any light grey on a light theme) came out
 * invisible — measured: rgba(135,146,162,.55) vanished on the light theme
 * while rgba(40,40,40,.55) drew. Mixing on the CPU sidesteps it everywhere.
 */
export function blend(color: string, background: string, alpha: number): string {
  const fg = hexToRgb(color);
  const bg = hexToRgb(background);
  if (!fg || !bg) return color;
  const mix = (i: number) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha)).toString(16).padStart(2, '0');
  return `#${mix(0)}${mix(1)}${mix(2)}`;
}

export function readGraphTheme(): GraphTheme {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => style.getPropertyValue(`--color-${name}`).trim() || fallback;

  const n300 = token('neutral-300', '#b8bbbe');
  const n400 = token('neutral-400', '#a0a3aa');
  const n500 = token('neutral-500', '#80838a');
  const n600 = token('neutral-600', '#5d6069');
  const n700 = token('neutral-700', '#4a4d54');
  const n800 = token('neutral-800', '#383b41');
  const blue300 = token('blue-300', '#7a94c5');
  const blue400 = token('blue-400', '#5e75b0');
  const green = token('green-400', '#7fc36d');
  const amber400 = token('amber-400', '#d9914d');
  const amber500 = token('amber-500', '#cc7d45');
  const red = token('red-400', '#cd4d55');
  const teal = token('opt-teal', '#4cb5a8');
  const purple = token('opt-purple', '#8a6dba');
  const pink = token('opt-pink', '#c66d99');
  const yellow = token('opt-yellow', '#d2b350');
  const canvas = token('neutral-850', '#171a1e');
  const over = (color: string, alpha: number) => blend(color, canvas, alpha);

  return {
    canvas,
    panel: token('neutral-900', '#1d2025'),
    border: n800,
    label: n300,
    labelMuted: n500,
    dim: over(n700, 0.45),
    dimEdge: over(n800, 0.5),
    accent: blue300,
    font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    // Code files (P13) keep this colour in every mode: the one option hue no
    // type, trust or agent colour uses (clusters may, sixth in line).
    kind: { page: n400, database: blue400, dashboard: purple, row: n600, tag: teal, file: pink, folder: over(pink, 0.55) },
    trust: { reviewed: green, confirmed: blue400, draft: yellow, stale: amber500, deprecated: red, none: n700 },
    // The app's agent colour is amber (the AI Agents entry): a write is the full
    // hue, a read the same hue faded, untouched the quiet neutral.
    agent: { wrote: amber400, read: over(amber400, 0.4), none: n700 },
    edge: {
      hierarchy: over(n600, 0.7),
      membership: over(n700, 0.6),
      link: over(blue400, 0.9),
      mention: over(n500, 0.8),
      tag: over(teal, 0.5),
      source: over(pink, 0.55),
      folder: over(pink, 0.35),
    },
    clusters: [blue400, teal, amber500, purple, green, pink, yellow, red],
    clusterRest: n700,
  };
}

/** Calls `onChange` whenever `<html data-theme>` changes. Returns the unsubscribe. */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
