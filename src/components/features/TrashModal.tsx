'use client';
import { useEffect, useState } from 'react';
import { Trash2, FileText, Database as DatabaseIcon, LayoutDashboard, Loader2, RotateCcw, ChevronRight } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import PageIcon from '@/components/features/PageIcon';
import AgentMark from './agents/AgentMark';
import { getMyTrash, restoreTrashItem, type TrashWorkspaceGroup, type TrashEntry } from '@/lib/actions/trash';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const TYPE_ICON: Record<TrashEntry['itemType'], typeof FileText> = {
  page: FileText,
  database: DatabaseIcon,
  database_row: FileText,
  dashboard: LayoutDashboard,
};

// Same Intl.RelativeTimeFormat helper as PageCommentsPanel — locale-aware
// wording with no per-unit translation key.
function relativeTime(date: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['day', 86400],
    ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === 'second') {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, 'second');
}

function TrashRow({
  entry, t, locale, onRestore, restoring,
}: {
  entry: TrashEntry;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onRestore: (id: string) => void;
  restoring: boolean;
}) {
  const Icon = TYPE_ICON[entry.itemType];
  const isAgent = entry.deletedByKind === 'agent';

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Icon size={16} className="shrink-0 text-fg-3" />
      <div className="min-w-0 flex-1">
        {entry.breadcrumb.length > 0 && (
          <div className="mb-0.5 flex items-center gap-1 truncate text-xs text-fg-4">
            {entry.breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 truncate">
                {i > 0 && <ChevronRight size={12} className="shrink-0" />}
                <span className="truncate">{crumb}</span>
              </span>
            ))}
          </div>
        )}
        <p className="truncate text-ui text-fg">{entry.title || t('trashUntitled')}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-3">
          {isAgent ? (
            <span className="flex items-center gap-1 text-fg-2">
              <AgentMark hint={entry.deletedByLabel} size={12} fallback="globe" />
              {t('trashDeletedByAgent', { name: entry.deletedByLabel })}
            </span>
          ) : (
            <span>{t('trashDeletedByHuman', { name: entry.deletedByLabel })}</span>
          )}
          <span>{relativeTime(new Date(entry.createdAt), locale)}</span>
        </div>
      </div>
      <Button size="sm" onClick={() => onRestore(entry.id)} loading={restoring} className="shrink-0">
        <RotateCcw />
        {t('trashRestore')}
      </Button>
    </li>
  );
}

function WorkspaceSection({
  group, t, locale, onRestore, restoringId,
}: {
  group: TrashWorkspaceGroup;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  onRestore: (workspaceId: string, id: string) => void;
  restoringId: string | null;
}) {
  const { workspace: ws, entries } = group;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 px-1 text-xs font-medium text-fg-3">
        {ws.icon
          ? <PageIcon icon={ws.icon} iconColor={ws.iconColor} size={14} />
          : <span className="flex size-3.5 items-center justify-center rounded-sm bg-hover text-2xs leading-none font-semibold text-fg-3">
              {ws.name.charAt(0).toUpperCase()}
            </span>
        }
        <span className="truncate">{ws.name}</span>
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-surface px-3 py-2.5 text-xs text-fg-3 shadow-[inset_0_0_0_1px_var(--color-line)]">
          {t('trashWorkspaceEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
          {entries.map((entry) => (
            <TrashRow
              key={entry.id}
              entry={entry}
              t={t}
              locale={locale}
              restoring={restoringId === entry.id}
              onRestore={(id) => onRestore(ws.id, id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// Cross-workspace Trash — reachable from the sidebar next to AI Agents
// ("common ground", not buried in a per-workspace Settings tab), same
// grouped-by-workspace shape as AgentsModal's getUserWorkspacesWithTokens.
// Restore is human-only by design (see actions/trash.ts) — no bulk action,
// no search, no permanent-delete button, no diff view. Items age out on
// their own via the daily cron after 30 days.
export default function TrashModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations('WorkspaceSettings');
  const locale = useLocale();
  const [groups, setGroups] = useState<TrashWorkspaceGroup[] | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () => {
    setGroups(null);
    getMyTrash().then(setGroups).catch(() => setGroups([]));
  };

  useEffect(load, []);

  const totalEntries = groups?.reduce((sum, g) => sum + g.entries.length, 0) ?? 0;

  async function restore(workspaceId: string, id: string) {
    setRestoringId(id);
    setNotice(null);
    try {
      const result = await restoreTrashItem(workspaceId, id);
      if (result.restored) {
        setGroups((current) => current?.map((g) => (
          g.workspace.id === workspaceId ? { ...g, entries: g.entries.filter((e) => e.id !== id) } : g
        )) ?? current);
        if (result.rerootedToRoot) setNotice(t('trashRestoredToRoot'));
      } else {
        setNotice(result.reason);
      }
    } catch {
      setNotice(t('trashRestoreFailed'));
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('trashModalTitle')}
            {totalEntries > 0 && <Badge>{totalEntries}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          {notice && (
            <p role="status" className="rounded-control bg-hover px-3 py-2 text-xs leading-relaxed text-fg-2">
              {notice}
            </p>
          )}

          {groups === null ? (
            <div role="status" className="flex justify-center py-16">
              <Loader2 size={18} className="animate-spin text-fg-3" />
            </div>
          ) : totalEntries === 0 ? (
            <EmptyState icon={<Trash2 />} title={t('trashEmpty')} />
          ) : (
            groups.map((group) => (
              <WorkspaceSection
                key={group.workspace.id}
                group={group}
                t={t}
                locale={locale}
                onRestore={restore}
                restoringId={restoringId}
              />
            ))
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
