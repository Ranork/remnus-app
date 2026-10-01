// Colours a person picks for text, highlights and table cells. They are baked into the
// content as inline styles, so they are user data: the same values in every theme, blue
// included (the R8 "no blue in the chrome" rule is about the interface, not about what
// people write). Changing a value orphans the colour already stored in pages — the
// active-state checks compare against these strings.

export type EditorColorName = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'gray';

export type EditorColor = { name: EditorColorName; value: string };

/** Editor namespace key for each colour's name (tooltips / aria-labels). */
export const COLOR_LABEL_KEY: Record<EditorColorName, string> = {
  red: 'colorRed',
  orange: 'colorOrange',
  yellow: 'colorYellow',
  green: 'colorGreen',
  blue: 'colorBlue',
  purple: 'colorPurple',
  pink: 'colorPink',
  gray: 'colorGray',
};

export const TEXT_COLORS: EditorColor[] = [
  { name: 'red', value: '#ef4444' },
  { name: 'orange', value: '#f97316' },
  { name: 'yellow', value: '#eab308' },
  { name: 'green', value: '#22c55e' },
  { name: 'blue', value: '#60a5fa' },
  { name: 'purple', value: '#a78bfa' },
  { name: 'pink', value: '#f472b6' },
  { name: 'gray', value: '#9ca3af' },
];

// Semi-transparent so a highlight blends with whatever theme sits behind it — soft on
// dark and light alike (a fixed opaque hex looked garish on dark, far too dark on light).
export const HIGHLIGHT_COLORS: EditorColor[] = [
  { name: 'red', value: 'rgba(248, 113, 113, 0.25)' },
  { name: 'orange', value: 'rgba(251, 146, 60, 0.25)' },
  { name: 'yellow', value: 'rgba(250, 204, 21, 0.28)' },
  { name: 'green', value: 'rgba(74, 222, 128, 0.25)' },
  { name: 'blue', value: 'rgba(96, 165, 250, 0.25)' },
  { name: 'purple', value: 'rgba(192, 132, 252, 0.25)' },
  { name: 'pink', value: 'rgba(244, 114, 182, 0.25)' },
];

// Table cell tints — same idea, a touch lighter so cell text stays readable.
export const CELL_COLORS: EditorColor[] = [
  { name: 'gray', value: 'rgba(156, 163, 175, 0.22)' },
  { name: 'red', value: 'rgba(248, 113, 113, 0.22)' },
  { name: 'orange', value: 'rgba(251, 146, 60, 0.22)' },
  { name: 'yellow', value: 'rgba(250, 204, 21, 0.24)' },
  { name: 'green', value: 'rgba(74, 222, 128, 0.22)' },
  { name: 'blue', value: 'rgba(96, 165, 250, 0.22)' },
  { name: 'purple', value: 'rgba(192, 132, 252, 0.22)' },
  { name: 'pink', value: 'rgba(244, 114, 182, 0.22)' },
];
