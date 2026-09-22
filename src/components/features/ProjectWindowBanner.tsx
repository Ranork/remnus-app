'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { logout } from '@/lib/actions/auth';

/**
 * The strip across the top of a project window (`npx remnus open`), saying why
 * this window only has one workspace in it and where the rest of the account is.
 *
 * It used to offer "Sign in for full Remnus", which signed the window out and
 * left the user on a login page. That went nowhere: the window runs in a
 * throwaway Chromium profile of its own (`--user-data-dir`), so signing in
 * again there just rebuilds the same single-workspace window in a browser
 * profile the user never uses. The one useful move is getting to their *own*
 * browser — and the web has no API to open the OS default browser (`_blank`
 * opens another window in this same isolated profile). So the honest options
 * are: a link to the public /download page, and the address on the clipboard to
 * paste wherever they actually browse.
 *
 * Signing out stays, demoted and renamed to what it really does here: end this
 * window's session.
 */
export default function ProjectWindowBanner({ workspaceName }: { workspaceName: string }) {
  const t = useTranslations('Layout');
  const [copied, setCopied] = useState(false);

  const copyAppLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (permissions, insecure origin) — the /download
      // link next to it still works, so failing quietly is better than an alert.
    }
  };

  return (
    <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-4 py-2 bg-neutral-900 border-b border-neutral-800">
      <span className="text-xs text-neutral-400 truncate min-w-0">
        {t('projectWindowNotice', { workspace: workspaceName })}
      </span>

      <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
        <a
          href="/download"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-neutral-300 hover:text-neutral-100 transition-colors"
        >
          {t('projectWindowGetApp')}
          <ExternalLink size={11} className="shrink-0" />
        </a>

        <button
          type="button"
          onClick={copyAppLink}
          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {copied ? <Check size={11} className="shrink-0" /> : <Copy size={11} className="shrink-0" />}
          {copied ? t('projectWindowCopied') : t('projectWindowCopyLink')}
        </button>

        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          {t('projectWindowEndSession')}
        </button>
      </div>
    </div>
  );
}
