import { SELECT_COLOR_ORDER, type SelectOptionColor } from '@/lib/types/properties';

// ── Icons that pages, databases and rows can carry ───────────────────────────
//
// One list for both sides: PageIcon renders these (anything else falls back to the default
// glyph), and the MCP tools validate against them, so an agent asking for an icon the
// sidebar can't draw is told so up front instead of silently getting the fallback.
// PageIcon's `satisfies` check keeps its component map and this list in lockstep.

export const CURATED_ICON_NAMES = [
  'Heart', 'Smile', 'Star', 'Book', 'Compass', 'Briefcase', 'Gift', 'Bell', 'Target', 'Code',
  'Flame', 'Zap', 'Award', 'HelpCircle', 'Activity', 'FileText', 'Database', 'Calendar', 'Layers',
  'Map', 'ShoppingBag', 'Music', 'Globe', 'Coffee', 'Bookmark', 'CheckSquare', 'TrendingUp', 'Mail',
  'User', 'Users', 'Settings', 'Lock', 'Key', 'Shield', 'Laptop', 'Cpu', 'Folder', 'Link', 'Hash',
  'Sun', 'Moon', 'Cloud', 'Flag', 'Tag', 'Sparkles', 'Lightbulb', 'MapPin', 'DollarSign', 'Tv',
  'Headphones', 'Camera', 'Video', 'Phone', 'CreditCard', 'ShoppingCart', 'Package', 'Truck', 'Wand2',
  'Umbrella', 'Wind', 'Droplet', 'Terminal', 'MessageSquare', 'Send', 'PieChart', 'BarChart2',
  'LineChart', 'Trophy', 'Eye', 'Search', 'Trash2', 'HeartHandshake',
] as const;

export type CuratedIconName = (typeof CURATED_ICON_NAMES)[number];

/** Icon colors share their keys with select-option colors (see PageIcon's ICON_COLORS). */
export const ICON_COLOR_KEYS = SELECT_COLOR_ORDER as [SelectOptionColor, ...SelectOptionColor[]];

const CURATED = new Set<string>(CURATED_ICON_NAMES);
const MAX_EMOJI_LENGTH = 16;

/**
 * Checks an icon an agent wants to set. Returns a message to hand back, or null when it's
 * fine. Accepted: an emoji, or `lucide:<Name>` for a name the sidebar can render.
 * `null`/`undefined` pass (clear / leave as is).
 *
 * Image URLs are refused on purpose: an agent must not be able to make every viewer's
 * browser fetch an arbitrary remote image. People can still upload image icons in the app.
 */
export function iconInputError(
  icon: string | null | undefined,
  iconColor: string | null | undefined,
): string | null {
  if (iconColor != null && !(SELECT_COLOR_ORDER as string[]).includes(iconColor)) {
    return `Unknown iconColor "${iconColor}". Use one of: ${SELECT_COLOR_ORDER.join(', ')}.`;
  }
  if (icon == null) return null;
  if (!icon) return 'icon is empty. Pass null to clear it.';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(icon)) {
    return 'Image URLs cannot be set as icons over MCP. Use an emoji or "lucide:Name".';
  }
  if (icon.startsWith('lucide:')) {
    const name = icon.slice('lucide:'.length);
    return CURATED.has(name)
      ? null
      : `Unknown Lucide icon "${name}". Use an emoji, or one of: ${CURATED_ICON_NAMES.join(', ')}.`;
  }
  if (icon.length > MAX_EMOJI_LENGTH || /\s/.test(icon)) {
    return 'icon must be a single emoji or "lucide:Name".';
  }
  return null;
}
