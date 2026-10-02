'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, ArrowUp, Wrench } from 'lucide-react';
import { CHANGELOG, localizedText, type ChangelogCategory, type ChangelogEntry } from '@/lib/changelog';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

// The "What's New" list. Its own module so the changelog — every entry in eight
// languages — loads when the list is opened, not with every app page (V2 R9). The
// unread badge and the seen cookie live in `useWhatsNew` (WhatsNewButton.tsx).

// The category is a kind of change, not a state: told apart by its glyph, not a colour.
const CATEGORY_ICON: Record<ChangelogCategory, typeof Plus> = {
  new: Plus,
  improved: ArrowUp,
  fixed: Wrench,
};

export default function WhatsNewModal({ unseenIds, onClose }: { unseenIds: Set<string>; onClose: () => void }) {
  const t = useTranslations('WhatsNew');
  const locale = useLocale();

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
    [locale],
  );

  // Entries grouped by ship date. CHANGELOG order is the "seen" order (everything
  // above the last-seen id is new), so an entry that shipped from another branch
  // can sit below newer-dated ones; grouping by date — not by adjacency — still
  // shows it under its own day, and a date is never two groups (it is the key).
  const groups = useMemo(() => {
    const byDate = new Map<string, ChangelogEntry[]>();
    for (const entry of CHANGELOG) {
      const list = byDate.get(entry.date);
      if (list) list.push(entry);
      else byDate.set(entry.date, [entry]);
    }
    return [...byDate]
      .map(([date, entries]) => ({ date, entries }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, []);

  const formatDate = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : dateFormatter.format(d);
  };

  // Wide and a fixed height (`full`) rather than narrow and tall: the list grows forever,
  // so a height that tracked the content produced a long thin column.
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {unseenIds.size > 0 ? t('unseenSubtitle', { count: unseenIds.size }) : t('subtitle')}
          </DialogDescription>
        </DialogHeader>

        {/* Timeline */}
        <DialogBody className="sm:px-6">
          {groups.map((group) => (
            <section key={group.date} className="relative pb-1 pl-5">
              {/* Spine: one continuous rule behind every card of this date. */}
              <span className="absolute top-2 bottom-0 left-[3px] w-px bg-line" aria-hidden />
              <span className="absolute top-1.5 left-0 size-[7px] rounded-full bg-line-strong ring-4 ring-float" aria-hidden />

              <h3 className="mb-2 text-xs font-medium text-fg-3">{formatDate(group.date)}</h3>

              {/* Two columns once there is room for them: one would run ~90 characters a line. */}
              <div className="grid gap-2 pb-4 md:grid-cols-2">
                {group.entries.map((entry) => {
                  const CategoryIcon = CATEGORY_ICON[entry.category];
                  const isUnseen = unseenIds.has(entry.id);
                  return (
                    <article
                      key={entry.id}
                      className="rounded-control bg-raised px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--color-line)]"
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Badge variant="outline" size="sm">
                          <CategoryIcon className="size-2.5" />
                          {t(`category_${entry.category}` as 'category_new')}
                        </Badge>
                        {isUnseen && <Badge variant="signal" size="sm">{t('badgeNew')}</Badge>}
                      </div>
                      <h4 className="mb-1 text-ui leading-snug font-semibold text-fg">
                        {localizedText(entry.title, locale)}
                      </h4>
                      <p className="text-xs leading-relaxed text-fg-2">
                        {localizedText(entry.summary, locale)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          <p className="pt-1 pl-5 text-xs text-fg-3">{t('footerNote')}</p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
