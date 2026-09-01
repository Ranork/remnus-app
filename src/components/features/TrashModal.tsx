'use client';
import { useEffect, useState } from 'react';
import { X, Trash2, FileText, Database as DatabaseIcon, Loader2, RotateCcw, ChevronRight } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import PageIcon from '@/components/features/PageIcon';
import AgentMark from './agents/AgentMark';
import { getMyTrash, restoreTrashItem, type TrashWorkspaceGroup, type TrashEntry } from '@/lib/actions/trash';

const TYPE_ICON: Record<TrashEntry['itemType'], typeof FileText> = {
  page: FileText,
  database: DatabaseIcon,
  database_row: FileText,
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
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <Icon size={14} className="shrink-0 text-neutral-500" />
      <div className="min-w-0 flex-1">
        {entry.breadcrumb.length > 0 && (
          <div className="mb-0.5 flex items-center gap-1 truncate text-[10px] text-neutral-600">
            {entry.breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 truncate">
                {i > 0 && <ChevronRight size={9} className="shrink-0" />}
                <span className="truncate">{crumb}</span>
              </span>
            ))}
          </div>
        )}
        <p className="truncate text-[13px] text-neutral-200">{entry.title || t('trashUntitled')}</p>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
          {isAgent ? (
            <span className="flex items-center gap-1 font-medium text-amber-500/90">
              <AgentMark hint={entry.deletedByLabel} size={11} fallback="globe" />
              {t('trashDeletedByAgent', { name: entry.deletedByLabel })}
            </span>
          ) : (
            <span className="text-neutral-400">{t('trashDeletedByHuman', { name: entry.deletedByLabel })}</span>
          )}
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-600">{relativeTime(new Date(entry.createdAt), locale)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRestore(entry.id)}
        disabled={restoring}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-neutral-800 px-2.5 py-1 text-[11px] font-medium text-neutral-300 transition-colors hover:border-neutral-700 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {restoring ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
        {t('trashRestore')}
      </button>
    </div>
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
    <div className="space-y-1">
      <div className="mb-1 flex items-center gap-2 px-1">
        {ws.icon
          ? <PageIcon icon={ws.icon} iconColor={ws.iconColor} size={13} />
          : <div className="flex h-3.5 w-3.5 items-center justify-center rounded bg-neutral-700 text-[8px] font-bold text-neutral-400">
              {ws.name.charAt(0).toUpperCase()}
            </div>
        }
        <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          {ws.name}
        </span>
      </div>
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/20">
        {entries.length === 0 ? (
          <div className="px-3 py-2.5">
            <span className="text-[11px] italic text-neutral-600">{t('trashWorkspaceEmpty')}</span>
          </div>
        ) : (
          entries.map((entry) => (
            <TrashRow
              key={entry.id}
              entry={entry}
              t={t}
              locale={locale}
              restoring={restoringId === entry.id}
              onRestore={(id) => onRestore(ws.id, id)}
            />
          ))
        )}
      </div>
    </div>
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4 md:p-6"
      onClick={onClose}
    >
      <div
        className="modal-shadow flex w-full max-w-full animate-scale-in flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-850 sm:max-w-2xl"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/30 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-700 bg-neutral-800">
              <Trash2 size={14} className="text-neutral-400" />
            </div>
            <span className="text-sm font-semibold text-neutral-100">{t('trashModalTitle')}</span>
            {totalEntries > 0 && (
              <span className="rounded-full border border-neutral-700 bg-neutral-800 px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">
                {totalEntries}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {notice && (
            <div className="rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
              {notice}
            </div>
          )}

          {groups === null ? (
            <div className="flex justify-center py-16">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-800 border-t-neutral-500" />
            </div>
          ) : totalEntries === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Trash2 size={20} className="text-neutral-700" />
              <p className="text-xs text-neutral-500">{t('trashEmpty')}</p>
            </div>
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
        </div>
      </div>
    </div>
  );
}
