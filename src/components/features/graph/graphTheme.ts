/**
 * Knowledge-map colours, read from the live CSS tokens (`globals.css` `@theme`,
 * redefined per `[data-theme]`) rather than hard-coded: WebGL cannot use
 * `var(--…)`, so the renderer asks for the resolved values and asks again
 * whenever `<html data-theme>` changes. Light themes invert the neutral scale,
 * so "neutral-700 for quiet things" stays quiet on either background.
 *
 * Only tokens that every theme defines as a plain hex are used — Tailwind's
 * own defaults are `oklch()`, which sigma's colour parser does not read.
 *
 * V2 R8.4: blue stays a DATA colour here (databases, confirmed knowledge), the theme's
 * one accent — `--color-signal` — is spent on what is live or chosen: the hover and
 * selection ring and, in agent mode, what an agent wrote. Nothing else on the map is
 * yellow (a draft is violet, not the old option-yellow), so the accent keeps meaning
 * "this one". Clusters use the dashboards' validated `--chart-1…8`.
 */

export type GraphTheme = {
  canvas: string;
  panel: string;
  border: string;
  label: string;
  labelMuted: string;
  dim: string;
  dimEdge: string;
  /** The theme's signal: hover/selection ring, agent writes. */
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

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast of two hex colours (1 when either cannot be read). */
export function contrast(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  if (!x || !y) return 1;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
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
  const blue400 = token('blue-400', '#5e75b0');
  const green = token('green-400', '#7fc36d');
  const amber500 = token('amber-500', '#cc7d45');
  const red = token('red-400', '#cd4d55');
  const teal = token('opt-teal', '#4cb5a8');
  const purple = token('opt-purple', '#8a6dba');
  const pink = token('opt-pink', '#c66d99');
  const signalFill = token('signal', '#f0b43c');
  // The ring is the focus colour: the signal on the dark themes, a dark gold on the light
  // one, where the bright yellow measures 1.85:1 on the white canvas and a 2px ring of it
  // disappears (measured over the five themes, V2 R8.4).
  const focus = token('focus', signalFill);
  const canvas = token('neutral-850', '#171a1e');
  const chart = (i: number, fallback: string) => style.getPropertyValue(`--chart-${i}`).trim() || fallback;
  const over = (color: string, alpha: number) => blend(color, canvas, alpha);
  // Agent writes are signal fills; on a canvas where the fill would fall under 3:1 the
  // node takes the focus gold instead, so a written page stays findable.
  const signal = contrast(signalFill, canvas) >= 3 ? signalFill : focus;

  return {
    canvas,
    panel: token('neutral-900', '#1d2025'),
    border: n800,
    label: n300,
    labelMuted: n500,
    dim: over(n700, 0.45),
    dimEdge: over(n800, 0.5),
    accent: focus,
    font: getComputedStyle(document.body).fontFamily || 'sans-serif',
    // Code files (P13) keep this colour in every mode: the one option hue no
    // type, trust or agent colour uses (clusters may, sixth in line).
    kind: { page: n400, database: blue400, dashboard: purple, row: n600, tag: teal, file: pink, folder: over(pink, 0.55) },
    trust: { reviewed: green, confirmed: blue400, draft: purple, stale: amber500, deprecated: red, none: n700 },
    // Agent activity is the signal (R8: live activity and attention are the one
    // accent): a write is the full colour, a read the same colour faded, untouched
    // the quiet neutral.
    agent: { wrote: signal, read: over(signal, 0.4), none: n700 },
    edge: {
      hierarchy: over(n600, 0.7),
      membership: over(n700, 0.6),
      link: over(blue400, 0.9),
      mention: over(n500, 0.8),
      tag: over(teal, 0.5),
      source: over(pink, 0.55),
      folder: over(pink, 0.35),
    },
    clusters: [
      chart(1, '#3987e5'), chart(2, '#d95926'), chart(3, '#199e70'), chart(4, '#c98500'),
      chart(5, '#d55181'), chart(6, '#008300'), chart(7, '#9085e9'), chart(8, '#e66767'),
    ],
    clusterRest: n700,
  };
}

/** Calls `onChange` whenever `<html data-theme>` changes. Returns the unsubscribe. */
export function watchTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
