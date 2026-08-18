'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles, X, Plus, ArrowUp, Wrench } from 'lucide-react';
import {
  CHANGELOG,
  CHANGELOG_SEEN_COOKIE,
  countUnseenEntries,
  localizedText,
  newestEntryId,
  type ChangelogCategory,
  type ChangelogEntry,
} from '@/lib/changelog';

// Sidebar "What's New" entry point: a nav button carrying an unread badge, plus
// the modal it opens. Self-contained on purpose — the sidebar is rendered twice
// (desktop shell + mobile drawer), so keeping the seen-state inside the button
// avoids threading a prop through both layouts. The seen marker is a plain
// client-readable cookie (same `remnus_*` convention as the other UI
// preferences in `lib/actions/preferences.ts`, which are also per-device).

const YEAR_SECONDS = 60 * 60 * 24 * 365;

function readSeenCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CHANGELOG_SEEN_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeSeenCookie(id: string) {
  document.cookie =
    `${CHANGELOG_SEEN_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`;
}

const CATEGORY_STYLE: Record<ChangelogCategory, { chip: string; dot: string; icon: typeof Plus }> = {
  new: {
    chip: 'text-green-400 bg-green-500/10 border-green-500/20',
    dot: 'bg-green-400',
    icon: Plus,
  },
  improved: {
    chip: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    dot: 'bg-blue-400',
    icon: ArrowUp,
  },
  fixed: {
    chip: 'text-neutral-400 bg-neutral-800 border-neutral-700',
    dot: 'bg-neutral-500',
    icon: Wrench,
  },
};

export default function WhatsNewButton() {
  const t = useTranslations('WhatsNew');
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Frozen at open time: the highlight ring must not vanish out from under the
  // reader the moment the cookie is written.
  const [unseenIds, setUnseenIds] = useState<Set<string>>(new Set());
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    setUnseenCount(countUnseenEntries(readSeenCookie()));
  }, []);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    [locale],
  );

  // Entries grouped by ship date, newest first — CHANGELOG is already ordered.
  const groups = useMemo(() => {
    const out: { date: string; entries: ChangelogEntry[] }[] = [];
    for (const entry of CHANGELOG) {
      const last = out[out.length - 1];
      if (last && last.date === entry.date) last.entries.push(entry);
      else out.push({ date: entry.date, entries: [entry] });
    }
    return out;
  }, []);

  const handleOpen = () => {
    const count = countUnseenEntries(readSeenCookie());
    setUnseenIds(new Set(CHANGELOG.slice(0, count).map((e) => e.id)));
    setOpen(true);
    // Reading the list is what marks it read — clearing on close would leave the
    // badge up if the user navigates away from the modal instead of closing it.
    writeSeenCookie(newestEntryId());
    setUnseenCount(0);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const formatDate = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : dateFormatter.format(d);
  };

  return (
    <>
      <div className="shrink-0 px-2">
        <button
          onClick={handleOpen}
          className="w-full flex items-center gap-1.5 min-w-0 px-2 py-1.5 rounded-md text-sm text-neutral-300 hover:bg-neutral-800 hover:text-neutral-50 transition-all duration-200"
        >
          <Sparkles size={14} className="shrink-0 text-neutral-400" />
          <span className="truncate">{t('title')}</span>
          {unseenCount > 0 && (
            <span className="ml-auto shrink-0 min-w-4 text-center text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </button>
      </div>

      {open && mounted && createPortal(
        <div
          // z-300 (not the z-[100] most modals use): on mobile this button lives
          // inside MobileNavWrapper's z-200 workspace bottom sheet, and the modal
          // portals to document.body — anything lower renders behind the sheet.
          className="fixed inset-0 bg-black/60 z-300 flex items-center justify-center p-4 md:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-full sm:max-w-lg max-h-full bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-neutral-800 bg-neutral-900/30 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 text-sm font-semibold text-neutral-100 truncate">{t('title')}</h2>
                  <p className="m-0 text-[11px] text-neutral-500 truncate">
                    {unseenIds.size > 0 ? t('unseenSubtitle', { count: unseenIds.size }) : t('subtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('close')}
                className="shrink-0 p-1.5 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {groups.map((group) => (
                <div key={group.date} className="relative pl-5 pb-1">
                  {/* Spine: one continuous rule behind every card of this date. */}
                  <span className="absolute left-[3px] top-2 bottom-0 w-px bg-neutral-800" aria-hidden />
                  <span className="absolute left-0 top-1.5 w-[7px] h-[7px] rounded-full bg-neutral-700 ring-4 ring-neutral-850" aria-hidden />

                  <p className="m-0 mb-2 text-[11px] font-medium text-neutral-500">
                    {formatDate(group.date)}
                  </p>

                  <div className="flex flex-col gap-2 pb-4">
                    {group.entries.map((entry) => {
                      const style = CATEGORY_STYLE[entry.category];
                      const CategoryIcon = style.icon;
                      const isUnseen = unseenIds.has(entry.id);
                      return (
                        <div
                          key={entry.id}
                          className={`rounded-lg border px-3.5 py-3 transition-colors ${
                            isUnseen
                              ? 'border-blue-500/25 bg-blue-500/[0.04]'
                              : 'border-neutral-800 bg-neutral-900/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border leading-none ${style.chip}`}
                            >
                              <CategoryIcon size={9} />
                              {t(`category_${entry.category}` as 'category_new')}
                            </span>
                            {isUnseen && (
                              <span className="flex items-center gap-1 text-[9px] font-semibold text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                {t('badgeNew')}
                              </span>
                            )}
                          </div>
                          <h3 className="m-0 mb-1 text-[13px] font-semibold text-neutral-100 leading-snug">
                            {localizedText(entry.title, locale)}
                          </h3>
                          <p className="m-0 text-xs text-neutral-400 leading-relaxed">
                            {localizedText(entry.summary, locale)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <p className="m-0 pt-1 pl-5 text-[11px] text-neutral-600">{t('footerNote')}</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
