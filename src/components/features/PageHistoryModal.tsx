'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { X, RotateCcw, Loader2, History } from 'lucide-react';
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
    <>
      <div onClick={onClose} className="fixed inset-0 z-300 bg-black/60" />
      <div className="fixed z-300 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl max-h-[85vh] bg-neutral-850 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-neutral-800 shrink-0">
          <History size={14} className="text-neutral-500" />
          <p className="flex-1 text-sm font-semibold text-neutral-100">{t('history.title')}</p>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1 rounded cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}

        {versions === null ? (
          <div className="flex justify-center py-16">
            <Loader2 size={16} className="animate-spin text-neutral-600" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <History size={20} className="text-neutral-700" />
            <p className="text-xs text-neutral-500">{t('history.empty')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col sm:flex-row min-h-0">
            {/* Version list */}
            <div className="sm:w-56 shrink-0 overflow-y-auto border-b sm:border-b-0 sm:border-r border-neutral-800 py-1.5">
              {versions.map((v, i) => {
                const succeedingContent = i === 0 ? currentContent : versions[i - 1].content;
                const { added, removed } = lineDelta(v.content, succeedingContent);
                const isAgent = v.changedByKind === 'agent';
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer ${
                      selectedId === v.id ? 'bg-neutral-800' : 'hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      {isAgent && <AgentMark hint={v.changedByLabel} size={11} fallback="globe" />}
                      <span className={isAgent ? 'text-amber-500/90 font-medium truncate' : 'truncate'}>
                        {isAgent ? t('history.byAgent', { name: v.changedByLabel }) : v.changedByLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 text-neutral-400">{relativeTime(new Date(v.createdAt), locale)}</div>
                    <div className="mt-0.5 font-mono text-[11px]">
                      {added > 0 && <span className="text-green-400">+{added}</span>}
                      {added > 0 && removed > 0 && <span className="text-neutral-500"> / </span>}
                      {removed > 0 && <span className="text-red-400">−{removed}</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-neutral-400">
                  {selected?.content}
                </pre>
              </div>
              <div className="flex justify-end px-4 py-3 border-t border-neutral-800 shrink-0">
                <button
                  onClick={() => selected && handleRestore(selected.id)}
                  disabled={!selected || restoringId !== null}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  {restoringId === selected?.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  {t('history.restore')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
