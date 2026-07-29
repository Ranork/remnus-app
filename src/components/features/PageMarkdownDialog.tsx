'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Copy, Check } from 'lucide-react';

interface PageMarkdownDialogProps {
  initialMarkdown: string;
  onApply: (markdown: string) => void;
  onClose: () => void;
}

// Separate copy/edit surface for a page's full content, mirroring how
// BulkRowsDialog gives database rows a paste-driven surface next to (not
// inside) the table. The textarea uses the editor's storage-markdown format
// (same string persisted as page.content), not the clipboard-cleaned version —
// atom blocks (callout, image, bookmark, file, youtube, child page, page link)
// serialize as their `<div data-*>`/`<a data-page-link>` HTML there, which
// round-trips losslessly back into the same block on Apply. The clipboard-clean
// format would downgrade those into plain markdown on parse, silently losing
// e.g. an embedded child page reference.
export function PageMarkdownDialog({ initialMarkdown, onApply, onClose }: PageMarkdownDialogProps) {
  const t = useTranslations('Page');
  const [value, setValue] = useState(initialMarkdown);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable/denied — the textarea text is still selectable manually.
    }
  };

  const dirty = value !== initialMarkdown;

  const handleApply = () => {
    if (!dirty) return;
    onApply(value);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-300 bg-black/60" />
      <div className="fixed z-300 inset-x-4 top-1/2 -translate-y-1/2 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-2xl max-h-[85vh] bg-neutral-850 border border-neutral-800 rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 shrink-0">
          <p className="text-sm font-semibold text-neutral-100">{t('markdown.title')}</p>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 p-1 rounded cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-[11px] text-neutral-500">{t('markdown.description')}</p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={18}
            spellCheck={false}
            className="w-full min-h-[320px] bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-xs text-neutral-200 font-mono resize-y focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-neutral-800 shrink-0">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? t('markdown.copied') : t('markdown.copy')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors cursor-pointer"
            >
              {t('markdown.cancel')}
            </button>
            <button
              onClick={handleApply}
              disabled={!dirty}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              {t('markdown.apply')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
