'use client';

import { useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { AlignLeft, Calendar, CheckSquare, CircleDashed, Clock, Hash, Link2, List, Mail, Phone, Tags, Type, User, Users, Fingerprint } from 'lucide-react';
import {
  type SelectOption,
  type StatusGroup,
  normalizeOption,
  getStatusGroup,
  getOptionColorByValue,
  getCardAccentColors,
  getCardTint,
} from '@/lib/types/properties';
import type { CardAccentSide } from '@/lib/types/views';
import { useMember, type WorkspaceMember } from './MembersContext';
import PageIcon from './PageIcon';

// ── Property type glyph ──────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof Type> = {
  text: Type,
  select: List,
  multi_select: Tags,
  status: CircleDashed,
  user: User,
  multi_user: Users,
  number: Hash,
  date: Calendar,
  datetime: Clock,
  checkbox: CheckSquare,
  url: Link2,
  email: Mail,
  phone: Phone,
  id: Fingerprint,
};

/** The small glyph that says what kind of property a column is (table header, row page). */
export function PropertyTypeIcon({ type, size = 14, className = 'text-fg-4' }: { type: string; size?: number; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? AlignLeft;
  return <Icon size={size} className={`shrink-0 ${className}`} aria-hidden />;
}

// ── Select / multi-select option icon ───────────────────────────────────────

/** The option's configured icon (emoji/lucide/upload), tinted by its chip color. Null when unset. */
export function OptionIcon({
  value,
  options,
  size = 12,
}: {
  value: string;
  options?: (string | SelectOption)[];
  size?: number;
}) {
  const opt = (options ?? []).map(normalizeOption).find((o) => o.value === value);
  if (!opt?.icon) return null;
  return <PageIcon icon={opt.icon} iconColor={opt.color} size={size} hideFallback className="shrink-0" />;
}

// ── Status ───────────────────────────────────────────────────────────────────

/**
 * A small progress-ring glyph indicating a status option's group:
 * todo = dashed empty ring, in_progress = half-filled, complete = filled check.
 */
export function StatusIcon({
  group,
  color,
  size = 13,
}: {
  group: StatusGroup;
  color: string;
  size?: number;
}) {
  if (group === 'complete') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="7" fill={color} />
        {/* The tick is cut out in the sheet colour, so it reads in every theme. */}
        <path d="M4.8 8.2l2 2 4.4-4.6" fill="none" stroke="var(--color-sheet)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (group === 'in_progress') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
        <circle cx="8" cy="8" r="7" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M8 1.5 A6.5 6.5 0 0 1 8 14.5 Z" fill={color} />
      </svg>
    );
  }
  // todo
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="2.2 2" />
    </svg>
  );
}

export function StatusChip({
  value,
  options,
  iconSize = 12,
  dense = false,
}: {
  value: string;
  options?: (string | SelectOption)[];
  iconSize?: number;
  /** The tighter pill for calendar events. */
  dense?: boolean;
}) {
  if (!value) return null;
  const opt = (options ?? []).map(normalizeOption).find((o) => o.value === value);
  const group = opt ? getStatusGroup(opt) : 'todo';
  const c = getOptionColorByValue(options ?? [], value);
  return (
    <span
      className={`inline-flex min-w-0 items-center rounded-full font-medium align-middle ${dense ? 'gap-1 px-1.5 py-px text-2xs' : 'gap-1.5 px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <StatusIcon group={group} color={c.dot} size={iconSize} />
      <span className="truncate">{value}</span>
    </span>
  );
}

// ── Select option chip + card marks (V2 R8.2) ────────────────────────────────

/** A select / multi-select value: the option's own colour (user data) on a pill. */
export function OptionChip({
  value,
  options,
  className,
  dense = false,
}: {
  value: string;
  options?: (string | SelectOption)[];
  className?: string;
  /** The tighter pill for calendar events. */
  dense?: boolean;
}) {
  const c = getOptionColorByValue(options ?? [], value);
  return (
    <span
      className={`inline-flex max-w-full shrink-0 items-center rounded-full font-medium ${dense ? 'gap-0.5 px-1.5 py-px text-2xs' : 'gap-1 px-2 py-0.5 text-xs'} ${className ?? ''}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <OptionIcon value={value} options={options} size={dense ? 10 : 12} />
      <span className="truncate">{value}</span>
    </span>
  );
}

/**
 * The value that marks a card (the view's "Mark cards by" property), drawn as a badge:
 * a status chip with its ring glyph, or option chips. The default mark style; the
 * alternative is `CardAccent`.
 */
export function PropertyMark({ column, value }: { column: { type: string; options?: (string | SelectOption)[] }; value: unknown }) {
  if (value === undefined || value === null || value === '') return null;
  if (column.type === 'status' && typeof value === 'string') {
    return <StatusChip value={value} options={column.options} />;
  }
  const values = Array.isArray(value) ? (value as string[]) : [String(value)];
  if (values.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v) => <OptionChip key={v} value={v} options={column.options} />)}
    </span>
  );
}

/** The mark as a single dot in the option's colour — for tight places (calendar events, table rows). */
export function MarkDot({
  column,
  value,
  size = 8,
}: {
  column: { type: string; options?: (string | SelectOption)[] };
  value: unknown;
  size?: number;
}) {
  const first = Array.isArray(value) ? (value as string[])[0] : value;
  if (first === undefined || first === null || first === '') return null;
  const c = getOptionColorByValue(column.options ?? [], String(first));
  if (column.type === 'status') {
    const opt = (column.options ?? []).map(normalizeOption).find((o) => o.value === first);
    return <StatusIcon group={opt ? getStatusGroup(opt) : 'todo'} color={c.dot} size={size + 4} />;
  }
  return (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, backgroundColor: c.dot }}
    />
  );
}

// The accent is a rounded bar set just inside the card's edge (not a stripe glued to
// it and cut by the corners): `md` for kanban cards (12px padding), `sm` for the
// tighter calendar events.
const ACCENT_EDGE: Record<'sm' | 'md', Record<CardAccentSide, string>> = {
  md: {
    left: 'left-1 inset-y-2.5 w-[3px] flex-col',
    right: 'right-1 inset-y-2.5 w-[3px] flex-col',
    top: 'top-1 inset-x-3 h-[3px] flex-row',
    bottom: 'bottom-1 inset-x-3 h-[3px] flex-row',
  },
  sm: {
    left: 'left-[3px] inset-y-1.5 w-[2.5px] flex-col',
    right: 'right-[3px] inset-y-1.5 w-[2.5px] flex-col',
    top: 'top-[3px] inset-x-2 h-[2.5px] flex-row',
    bottom: 'bottom-[3px] inset-x-2 h-[2.5px] flex-row',
  },
};

/**
 * The mark drawn as an accent bar along one edge of a card (the "Accent line" mark
 * style): one rounded segment per selected option. Place it inside the card (which
 * must be `relative`).
 */
export function CardAccent({
  column,
  value,
  side,
  size = 'md',
}: {
  column: { type: string; options?: (string | SelectOption)[] };
  value: unknown;
  side: CardAccentSide;
  size?: 'sm' | 'md';
}) {
  const colors = getCardAccentColors(column, value);
  if (colors.length === 0) return null;
  return (
    <span aria-hidden className={`pointer-events-none absolute flex gap-0.5 ${ACCENT_EDGE[size][side]}`}>
      {colors.map((color, i) => <span key={i} className="flex-1 rounded-full" style={{ backgroundColor: color }} />)}
    </span>
  );
}

/**
 * The style that tints a card with its "Card background" option colour: a soft wash
 * laid over the card's own surface (`bg-raised`, a touch stronger at the top) and the
 * same hue for its hairline — read by the card through `--card-edge` /
 * `--card-edge-strong`, which fall back to the neutral lines on an untinted card.
 */
export function cardTintStyle(
  column: { type: string; options?: (string | SelectOption)[] } | null | undefined,
  value: unknown,
): CSSProperties | undefined {
  const tint = getCardTint(column, value);
  if (!tint) return undefined;
  return {
    // Dark themes let the wash fade out like light falling from the top (a flat dark
    // tint turns yellow olive and red brown); the light theme keeps more of its pastel.
    backgroundImage: `linear-gradient(to bottom, ${tint.wash}, color-mix(in srgb, ${tint.wash} var(--card-wash-fade, 30%), transparent))`,
    '--card-edge': tint.edge,
    '--card-edge-strong': `color-mix(in srgb, ${tint.edge}, ${tint.dot} 35%)`,
  } as CSSProperties;
}

/**
 * A group heading's glyph (kanban column, grouped-table section): the option's ring or
 * dot, or a hollow ring for the "no value" group. The group's colour lives here, not in
 * a tinted column or section background.
 */
export function GroupGlyph({
  column,
  value,
}: {
  column?: { type: string; options?: (string | SelectOption)[] };
  /** The group's option value; null for the "no value" group. */
  value: string | null;
}) {
  if (!column || value === null) {
    return <span aria-hidden className="size-2 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--color-fg-4)]" />;
  }
  return <MarkDot column={column} value={value} />;
}

// ── Users ────────────────────────────────────────────────────────────────────

function initialsOf(member: WorkspaceMember | undefined): string {
  const src = member?.name || member?.email || '';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic avatar tint from a user id (stable across renders).
const AVATAR_TINTS = ['#6366f1', '#14b8a6', '#a855f7', '#ec4899', '#f97316', '#22c55e', '#eab308', '#ef4444'];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function UserAvatar({
  member,
  size = 18,
}: {
  member: WorkspaceMember | undefined;
  size?: number;
}) {
  const dim = { width: size, height: size };
  if (member?.image) {
     
    return (
      <img
        src={member.image}
        alt={member.name || ''}
        className="rounded-full object-cover shrink-0 border border-line-strong/40"
        style={dim}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="rounded-full shrink-0 flex items-center justify-center font-semibold text-white border border-white/10"
      style={{ ...dim, backgroundColor: member ? tintFor(member.id) : '#52525b', fontSize: Math.round(size * 0.42) }}
    >
      {initialsOf(member)}
    </span>
  );
}

/** A single user pill — avatar + name. Resolves the id against workspace members. */
export function UserChip({ userId, avatarSize = 16 }: { userId: string; avatarSize?: number }) {
  const t = useTranslations('Database');
  const member = useMember(userId);
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full align-middle text-xs text-fg">
      <UserAvatar member={member} size={avatarSize} />
      <span className="truncate">{member ? member.name || member.email : t('unknownUser')}</span>
    </span>
  );
}

/**
 * Avatar-only stack for `user`/`multi_user` cells (no name text) — used on
 * calendar cards where space is tight. Avatars **overlap** (GitHub/Notion-style
 * stack) via a negative margin, each carrying a thin ring in the card colour so
 * neighbours read as separate. The viewer's own avatar (when among the
 * assignees) gets an ink ring (the one accent is not spent on identity) and is
 * lifted above its neighbours so the ring never gets clipped.
 *
 * The accent/separator is a **`ring` (box-shadow), never a `border`** so it does
 * NOT grow the avatar's box — a bordered self-avatar used to be a few px taller
 * than its siblings and stretched the whole calendar card. Hovering the stack
 * shows one tooltip listing every assignee's avatar + name.
 */
export function UserAvatarStack({
  value,
  currentUserId,
  size = 18,
}: {
  value: unknown;
  currentUserId?: string | null;
  size?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const ids = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
  if (ids.length === 0) return null;

  const handleEnter = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top - 6, left: rect.left });
    setHovered(true);
  };

  return (
    <div
      ref={anchorRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHovered(false)}
    >
      {ids.map((id, i) => (
        <StackedAvatar key={id} userId={id} isSelf={!!currentUserId && id === currentUserId} size={size} first={i === 0} />
      ))}
      {hovered && coords && createPortal(
        <div
          className="fixed z-9999 -translate-y-full bg-float rounded-control shadow-float py-1.5 px-2 flex flex-col gap-1.5 pointer-events-none"
          style={{ top: coords.top, left: coords.left }}
        >
          {ids.map((id) => <TooltipRow key={id} userId={id} />)}
        </div>,
        document.body,
      )}
    </div>
  );
}

function StackedAvatar({ userId, isSelf, size, first }: { userId: string; isSelf: boolean; size: number; first: boolean }) {
  const member = useMember(userId);
  return (
    <span
      // Separator ring in the card colour; "you" gets an ink ring (monochrome — the one
      // accent is not spent on identity) and sits above its neighbours.
      className={`shrink-0 rounded-full ${first ? '' : '-ml-1.5'} ${
        isSelf ? 'ring-2 ring-fg relative z-10' : 'ring-2 ring-raised'
      }`}
    >
      <UserAvatar member={member} size={size} />
    </span>
  );
}

function TooltipRow({ userId }: { userId: string }) {
  const t = useTranslations('Database');
  const member = useMember(userId);
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg whitespace-nowrap">
      <UserAvatar member={member} size={16} />
      {member ? member.name || member.email : t('unknownUser')}
    </span>
  );
}

/** Renders one or many user chips for `user` / `multi_user` cells. */
export function UserTags({
  value,
  avatarSize = 16,
  wrap = true,
}: {
  value: unknown;
  avatarSize?: number;
  wrap?: boolean;
}) {
  const ids = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
  if (ids.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 ${wrap ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
      {ids.map((id) => (
        <span
          key={id}
          className="inline-flex items-center gap-1.5 bg-hover/60 rounded-full pl-0.5 pr-2 py-0.5 max-w-full"
        >
          <UserChip userId={id} avatarSize={avatarSize} />
        </span>
      ))}
    </span>
  );
}
