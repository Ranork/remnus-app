export type SelectOptionColor =
  | 'default' | 'red' | 'orange' | 'yellow'
  | 'green' | 'teal' | 'blue' | 'purple' | 'pink';

// Status columns group their options into three work-tracking buckets.
export type StatusGroup = 'todo' | 'in_progress' | 'complete';

export interface SelectOption {
  value: string;
  color?: SelectOptionColor;
  // Only meaningful for `status` columns — which bucket the option belongs to.
  group?: StatusGroup;
  // Emoji / `lucide:Name` / uploaded image URL — same format as PageIcon. Tinted
  // by `color` when it's a lucide icon (SelectOptionColor keys match ICON_COLORS).
  icon?: string;
}

export const STATUS_GROUP_ORDER: StatusGroup[] = ['todo', 'in_progress', 'complete'];

// Default chip color applied to a freshly-created status option per group.
export const STATUS_GROUP_DEFAULT_COLOR: Record<StatusGroup, SelectOptionColor> = {
  todo: 'default',
  in_progress: 'blue',
  complete: 'green',
};

export function getStatusGroup(opt: string | SelectOption): StatusGroup {
  const o = normalizeOption(opt);
  return o.group && STATUS_GROUP_ORDER.includes(o.group) ? o.group : 'todo';
}

// The default option set a new `status` column is seeded with.
export const DEFAULT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'Not started', color: 'default', group: 'todo' },
  { value: 'In progress', color: 'blue', group: 'in_progress' },
  { value: 'Done', color: 'green', group: 'complete' },
];

// Dark-theme fallbacks: semi-transparent tinted bg + bright matching text (Linear/GitHub style).
// Light themes override via --chip-*-* CSS vars (defined in Catppuccin theme block).
export const SELECT_COLORS: Record<SelectOptionColor, { bg: string; text: string; dot: string; groupBg: string }> = {
  default: { bg: 'var(--chip-default-bg, rgba(148,163,184,0.14))', text: 'var(--chip-default-text, #94a3b8)', dot: 'var(--chip-default-dot, #64748b)', groupBg: 'var(--chip-default-group, rgba(148,163,184,0.06))' },
  red:     { bg: 'var(--chip-red-bg, rgba(239,68,68,0.18))',       text: 'var(--chip-red-text, #f87171)',     dot: 'var(--chip-red-dot, #ef4444)',     groupBg: 'var(--chip-red-group, rgba(239,68,68,0.07))'      },
  orange:  { bg: 'var(--chip-orange-bg, rgba(249,115,22,0.18))',   text: 'var(--chip-orange-text, #fb923c)',  dot: 'var(--chip-orange-dot, #f97316)',  groupBg: 'var(--chip-orange-group, rgba(249,115,22,0.07))'  },
  yellow:  { bg: 'var(--chip-yellow-bg, rgba(234,179,8,0.18))',    text: 'var(--chip-yellow-text, #facc15)',  dot: 'var(--chip-yellow-dot, #eab308)',  groupBg: 'var(--chip-yellow-group, rgba(234,179,8,0.07))'   },
  green:   { bg: 'var(--chip-green-bg, rgba(34,197,94,0.18))',     text: 'var(--chip-green-text, #4ade80)',   dot: 'var(--chip-green-dot, #22c55e)',   groupBg: 'var(--chip-green-group, rgba(34,197,94,0.07))'    },
  teal:    { bg: 'var(--chip-teal-bg, rgba(20,184,166,0.18))',     text: 'var(--chip-teal-text, #2dd4bf)',    dot: 'var(--chip-teal-dot, #14b8a6)',    groupBg: 'var(--chip-teal-group, rgba(20,184,166,0.07))'    },
  blue:    { bg: 'var(--chip-blue-bg, rgba(99,102,241,0.18))',     text: 'var(--chip-blue-text, #818cf8)',    dot: 'var(--chip-blue-dot, #6366f1)',    groupBg: 'var(--chip-blue-group, rgba(99,102,241,0.07))'    },
  purple:  { bg: 'var(--chip-purple-bg, rgba(168,85,247,0.18))',   text: 'var(--chip-purple-text, #c084fc)',  dot: 'var(--chip-purple-dot, #a855f7)',  groupBg: 'var(--chip-purple-group, rgba(168,85,247,0.07))'  },
  pink:    { bg: 'var(--chip-pink-bg, rgba(236,72,153,0.18))',     text: 'var(--chip-pink-text, #f472b6)',    dot: 'var(--chip-pink-dot, #ec4899)',    groupBg: 'var(--chip-pink-group, rgba(236,72,153,0.07))'    },
};

export const SELECT_COLOR_ORDER: SelectOptionColor[] = [
  'default', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink',
];

export function normalizeOption(opt: string | SelectOption): SelectOption {
  if (typeof opt === 'string') return { value: opt };
  return opt;
}

export function getOptionColor(
  opt: string | SelectOption,
): { bg: string; text: string; dot: string; groupBg: string } {
  const { color } = normalizeOption(opt);
  return SELECT_COLORS[color ?? 'default'] ?? SELECT_COLORS.default;
}

export function getOptionColorByValue(
  options: (string | SelectOption)[],
  value: string,
): { bg: string; text: string; dot: string; groupBg: string } {
  if (!value) return SELECT_COLORS.default;
  const found = (options ?? []).find((o) => normalizeOption(o).value === value);
  return found ? getOptionColor(found) : SELECT_COLORS.default;
}

/** One segment of a card's border-accent line: its dot color, plus the
 *  selected option's own icon when it has one (for the collapsed-card
 *  accent-icon treatment — see `getCardBorderAccents`). */
export interface CardBorderAccent {
  color: string;
  icon?: string;
  iconColor?: SelectOptionColor;
}

/**
 * Returns an ordered list of border-accent segments to paint the card's
 * accent line. For a `select`/`status` column this is one segment; for a
 * `multi_select` column one segment per selected value (preserving order).
 * Each segment carries the option's own icon when it has one — a collapsed
 * card (properties hidden) can then show that icon on the accent line itself
 * instead of losing the information entirely. Returns [] when there is
 * nothing to paint.
 */
export function getCardBorderAccents(
  colSchema: { type: string; options?: (string | SelectOption)[] } | null | undefined,
  value: unknown,
): CardBorderAccent[] {
  if (!colSchema) return [];
  const opts = colSchema.options ?? [];

  const toAccent = (v: string): CardBorderAccent => {
    const found = opts.map(normalizeOption).find((o) => o.value === v);
    const color = getOptionColorByValue(opts, v).dot;
    return found?.icon ? { color, icon: found.icon, iconColor: found.color } : { color };
  };

  if (colSchema.type === 'select' || colSchema.type === 'status') {
    if (typeof value !== 'string' || !value) return [];
    return [toAccent(value)];
  }

  if (colSchema.type === 'multi_select') {
    if (!Array.isArray(value) || value.length === 0) return [];
    return (value as string[]).map(toAccent);
  }

  return [];
}

/**
 * Returns an ordered list of dot-color hex strings to paint the card's
 * left-border accent. For a `select` column this is one color; for a
 * `multi_select` column one color per selected value (preserving order).
 * Returns [] when there is nothing to paint. Thin wrapper around
 * `getCardBorderAccents` for callers that only need the color.
 */
export function getCardBorderDots(
  colSchema: { type: string; options?: (string | SelectOption)[] } | null | undefined,
  value: unknown,
): string[] {
  return getCardBorderAccents(colSchema, value).map((a) => a.color);
}

/**
 * Returns the groupBg tint color for the card background based on a select/multi_select value.
 * For multi_select, uses the first selected value's color. Returns null when nothing to paint.
 */
export function getCardBgColor(
  colSchema: { type: string; options?: (string | SelectOption)[] } | null | undefined,
  value: unknown,
): string | null {
  if (!colSchema) return null;
  const opts = colSchema.options ?? [];

  if (colSchema.type === 'select' || colSchema.type === 'status') {
    if (typeof value !== 'string' || !value) return null;
    return getOptionColorByValue(opts, value).groupBg;
  }

  if (colSchema.type === 'multi_select') {
    if (!Array.isArray(value) || value.length === 0) return null;
    return getOptionColorByValue(opts, (value as string[])[0]).groupBg;
  }

  return null;
}

export function formatDateValue(val: string, type: 'date' | 'datetime', format?: string): string {
  if (!val) return '—';
  // Date range: "start/end"
  if (val.includes('/')) {
    const [startStr, endStr] = val.split('/');
    const startFmt = formatDateValue(startStr, type, format);
    const endFmt = endStr ? formatDateValue(endStr, type, format) : '';
    return endFmt ? `${startFmt} → ${endFmt}` : startFmt;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;

  const showTime = type === 'datetime';
  const formatStr = format || 'default';

  if (formatStr === 'relative') {
    if (type === 'datetime') {
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffMins = Math.round(diffMs / 60000);
      const diffHours = Math.round(diffMs / 3600000);
      const diffDays = Math.round(diffMs / 86400000);

      if (Math.abs(diffMins) < 1) return 'Just now';
      if (Math.abs(diffMins) < 60) {
        return diffMins > 0 ? `in ${diffMins}m` : `${Math.abs(diffMins)}m ago`;
      }
      if (Math.abs(diffHours) < 24) {
        return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
      }
      if (Math.abs(diffDays) < 30) {
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
      }
    } else {
      // Just 'date' property: work exclusively with calendar days
      const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const nowTemp = new Date();
      const nowDate = new Date(nowTemp.getFullYear(), nowTemp.getMonth(), nowTemp.getDate());
      const diffMs = dDate.getTime() - nowDate.getTime();
      const diffDays = Math.round(diffMs / 86400000);

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (Math.abs(diffDays) < 30) {
        return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
      }
    }
  }

  // YYYY-MM-DD
  if (formatStr === 'iso') {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePart = `${yyyy}-${mm}-${dd}`;
    if (showTime) {
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} ${hh}:${min}`;
    }
    return datePart;
  }

  // DD/MM/YYYY
  if (formatStr === 'uk') {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePart = `${dd}/${mm}/${yyyy}`;
    if (showTime) {
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} ${hh}:${min}`;
    }
    return datePart;
  }

  // MM/DD/YYYY
  if (formatStr === 'us') {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const datePart = `${mm}/${dd}/${yyyy}`;
    if (showTime) {
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${datePart} ${hh}:${min}`;
    }
    return datePart;
  }

  // Default: Month Day, Year (e.g. May 19, 2026)
  const datePart = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  if (showTime) {
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${datePart} ${timePart}`;
  }
  return datePart;
}
