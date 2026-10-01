'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { RotateCcw, Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';
import AgentMark from './agents/AgentMark';
import { getPageHistory, restoreVersion, type ContentVersion } from '@/lib/actions/history';

// Same Intl.RelativeTimeFormat helper duplicated across PageCommentsPanel /
// TrashModal — locale-aware wording with no per-unit translation key.
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

// Common-prefix/suffix trim — only used as a fallback for pathologically
// large documents (see MAX_DIFF_LINES below). Badly overcounts whenever a
// document has more than one separate edited region: any single difference
// near the end stops the suffix trim from matching at all, so nearly the
// entire middle gets counted as changed even if 99% of it is identical.
function charDeltaFallback(oldStr: string, newStr: string): { added: number; removed: number } {
  let start = 0;
  const maxStart = Math.min(oldStr.length, newStr.length);
  while (start < maxStart && oldStr[start] === newStr[start]) start++;
  let endOld = oldStr.length;
  let endNew = newStr.length;
  while (endOld > start && endNew > start && oldStr[endOld - 1] === newStr[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { added: endNew - start, removed: endOld - start };
}

// Line-based LCS diff — not a diff VIEW (the spec explicitly excludes one),
// only used to compute the compact "+N / −M" label, but a per-line LCS
// handles multiple separate edited regions correctly (a small deletion near
// the top and an unrelated change near the bottom no longer inflate each
// other), unlike a naive prefix/suffix trim. O(lines²) time/space, capped for
// very large documents where an approximate label is an acceptable trade-off.
const MAX_DIFF_LINES = 2000;

function lineDelta(oldStr: string, newStr: string): { added: number; removed: number } {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');
  if (oldLines.length > MAX_DIFF_LINES || newLines.length > MAX_DIFF_LINES) {
    return charDeltaFallback(oldStr, newStr);
  }

  const m = oldLines.length;
  const n = newLines.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  let i = m;
  let j = n;
  let added = 0;
  let removed = 0;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) { i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { i--; removed += oldLines[i].length + 1; }
    else { j--; added += newLines[j].length + 1; }
  }
  while (i > 0) { i--; removed += oldLines[i].length + 1; }
  while (j > 0) { j--; added += newLines[j].length + 1; }
  return { added, removed };
}

interface PageHistoryModalProps {
  workspaceId: string;
  pageId: string;
  /** The editor's current live content — the newest entry's delta is shown
   *  against this (there's no "current" snapshot row, it's live). */
  currentContent: string;
  /** Called after a successful restore with the restored content, so the
   *  open editor can update immediately without waiting on a page reload. */
  onRestored: (content: string) => void;
  onClose: () => void;
}

export function PageHistoryModal({ workspaceId, pageId, currentContent, onRestored, onClose }: PageHistoryModalProps) {
  const t = useTranslations('Page');
  const locale = useLocale();
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getPageHistory(workspaceId, pageId)
      .then((v) => {
        if (cancelled) return;
        setVersions(v);
        setSelectedId(v[0]?.id ?? null);
      })
      .catch(() => { if (!cancelled) setVersions([]); });
    return () => { cancelled = true; };
  }, [workspaceId, pageId]);

  async function handleRestore(id: string) {
    setRestoringId(id);
    setError('');
    try {
      const result = await restoreVersion(workspaceId, pageId, id);
      if (result.restored) {
        const version = versions?.find((v) => v.id === id);
        if (version) onRestored(version.content);
        onClose();
      } else {
        setError(result.reason);
      }
    } catch {
      setError(t('history.restoreFailed'));
    } finally {
      setRestoringId(null);
    }
  }

  const selected = versions?.find((v) => v.id === selectedId) ?? null;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // A restore in flight holds the dialog, like ConfirmDialog does.
        if (!open && restoringId === null) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={15} className="shrink-0 text-fg-3" aria-hidden />
            {t('history.title')}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <p role="alert" className="mx-5 mt-3 rounded-control border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-xs text-amber-400">
            {error}
          </p>
        )}

        {versions === null ? (
          <DialogBody className="flex justify-center py-16">
            <Loader2 size={16} className="animate-spin text-fg-4" aria-hidden />
          </DialogBody>
        ) : versions.length === 0 ? (
          <DialogBody>
            <EmptyState icon={<History />} title={t('history.empty')} />
          </DialogBody>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
            {/* Version list */}
            <div className="max-h-48 shrink-0 overflow-y-auto border-b border-line p-1.5 sm:max-h-none sm:w-60 sm:border-r sm:border-b-0">
              {versions.map((v, i) => {
                const succeedingContent = i === 0 ? currentContent : versions[i - 1].content;
                const { added, removed } = lineDelta(v.content, succeedingContent);
                const isAgent = v.changedByKind === 'agent';
                const active = selectedId === v.id;
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    aria-pressed={active}
                    className={cn(
                      'w-full cursor-pointer rounded-control px-2.5 py-2 text-left text-xs transition-colors',
                      active ? 'bg-hover' : 'hover:bg-hover/60',
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-ui font-medium text-fg">
                      {isAgent && <AgentMark hint={v.changedByLabel} size={12} fallback="globe" />}
                      <span className="truncate">
                        {isAgent ? t('history.byAgent', { name: v.changedByLabel }) : v.changedByLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 text-fg-3">{relativeTime(new Date(v.createdAt), locale)}</div>
                    {(added > 0 || removed > 0) && (
                      <div className="mt-0.5 font-mono text-2xs">
                        {added > 0 && <span className="text-green-400">+{added}</span>}
                        {added > 0 && removed > 0 && <span className="text-fg-4"> / </span>}
                        {removed > 0 && <span className="text-red-400">−{removed}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            <div className="flex min-h-0 flex-1 flex-col">
              <DialogBody>
                <pre className="font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-fg-2">
                  {selected?.content}
                </pre>
              </DialogBody>
              <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
                <Button
                  variant="primary"
                  onClick={() => selected && handleRestore(selected.id)}
                  loading={restoringId !== null && restoringId === selected?.id}
                  disabled={!selected || restoringId !== null}
                >
                  <RotateCcw />
                  {t('history.restore')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
