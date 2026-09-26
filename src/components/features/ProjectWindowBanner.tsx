'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink, Info, LogOut } from 'lucide-react';
import { logout } from '@/lib/actions/auth';

/**
 * The strip across the top of a project window (`npx remnus open`): a quiet label saying
 * which workspace this window is, with everything else one click away behind "About this
 * window". It used to be one line holding the whole explanation plus three actions, which
 * got cut off and read as clutter on every screen of the window.
 *
 * It stays in the banner slot rather than moving to the sidebar header: the sidebar can be
 * hidden, and on a phone it is a drawer, but "this window is only one workspace" should be
 * visible wherever the person is.
 *
 * What the popover offers, and why: the window runs in a throwaway Chromium profile of its
 * own (`--user-data-dir`), so signing in again there would only rebuild the same
 * single-workspace window, and the web has no API to open the OS default browser (`_blank`
 * opens another window in this same profile). So the honest options are the public
 * /download page and the address on the clipboard, to paste wherever they actually browse.
 * Signing out stays, last and demoted, named for what it does here: end this window's session.
 */
export default function ProjectWindowBanner({ workspaceName }: { workspaceName: string }) {
  const t = useTranslations('Layout');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const copyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (permissions, insecure origin) — the /download link
      // next to it still works, so failing quietly is better than an alert.
    }
  };

  const itemClass =
    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 transition-colors';

  return (
    <div
      ref={rootRef}
      className="relative shrink-0 flex items-center gap-2 h-8 px-4 bg-neutral-900 border-b border-neutral-800 text-xs"
    >
      <span className="shrink-0 font-medium text-neutral-400">{t('projectWindowLabel')}</span>
      <span className="shrink-0 text-neutral-600" aria-hidden>·</span>
      <span className="min-w-0 truncate text-neutral-300">{workspaceName}</span>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('projectWindowAbout')}
        title={t('projectWindowAbout')}
        className={`ml-auto shrink-0 flex items-center justify-center w-6 h-6 rounded transition-colors ${
          open ? 'bg-neutral-800 text-neutral-200' : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
        }`}
      >
        <Info size={13} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('projectWindowAbout')}
          className="absolute right-3 top-full z-50 mt-1 w-72 max-w-[calc(100vw-1.5rem)] rounded-lg border border-neutral-800 bg-neutral-900 p-1 shadow-2xl animate-scale-in"
        >
          <p className="px-2 pt-1.5 pb-2 text-xs leading-relaxed text-neutral-400">
            {t('projectWindowExplain', { workspace: workspaceName })}
          </p>

          <a href="/download" target="_blank" rel="noopener noreferrer" className={itemClass}>
            <ExternalLink size={13} className="shrink-0 text-neutral-500" />
            {t('projectWindowGetApp')}
          </a>

          <button type="button" onClick={copyAppLink} className={`${itemClass} items-start`}>
            {copied ? (
              <Check size={13} className="shrink-0 mt-0.5 text-green-500" />
            ) : (
              <Copy size={13} className="shrink-0 mt-0.5 text-neutral-500" />
            )}
            <span className="flex flex-col">
              <span>{copied ? t('projectWindowCopied') : t('projectWindowCopyLink')}</span>
              <span className="text-[11px] leading-snug text-neutral-500">{t('projectWindowCopyHint')}</span>
            </span>
          </button>

          <div className="my-1 border-t border-neutral-800" />

          <button
            type="button"
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
          >
            <LogOut size={13} className="shrink-0" />
            {t('projectWindowEndSession')}
          </button>
        </div>
      )}
    </div>
  );
}
