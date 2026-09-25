'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Clock, Eye, Lock, Terminal } from 'lucide-react';

/**
 * The `remnus join` screen — a teammate connecting to a workspace someone else
 * already wired this project to.
 *
 * It deliberately shows **no workspace metadata**: no name, no members, no icon.
 * The only thing named here is the project directory, which came off this person's
 * own disk via the CLI. The workspace id that got them here sits in a committed
 * file, so it proves nothing about who they are — see `joinView` in `page.tsx`.
 */
interface Props {
  /** Directory name the CLI was run in — from the joiner's own machine. */
  projectName: string;
  userName: string;
  /** `oauth` = no token is minted here; the agent asks for its own permission later. */
  authMode: 'pat' | 'oauth';
  access:
    | { state: 'member'; maxScope: 'read' | 'write'; viewer: boolean }
    | { state: 'pending' }
    | { state: 'denied'; retryAt: string }
    | { state: 'none' };
  error?: string;
  onJoin: (formData: FormData) => Promise<void>;
}

export function JoinForm({ projectName, userName, authMode, access, error, onJoin }: Props) {
  const t = useTranslations('Install');

  const isMember = access.state === 'member';
  const viewerOnly = isMember && access.viewer;

  // A viewer cannot hold a write token at all, so the control is not offered rather
  // than offered-and-rejected. The server clamps this again regardless.
  const [scope, setScope] = useState<'read' | 'write'>(
    isMember && access.maxScope === 'read' ? 'read' : 'write',
  );
  const [note, setNote] = useState('');

  const heading = isMember ? t('joinTitle') : t('requestTitle');

  const retryDate =
    access.state === 'denied'
      ? new Date(access.retryAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  const permissions = scope === 'write' ? [t('permRead'), t('permWrite')] : [t('permRead')];

  // Even a refusal gets a submit button: the CLI is sitting on the poll channel, and
  // the only way it hears "denied" instead of timing out after five minutes is if this
  // page reports back. The action re-checks and refuses to create anything.
  const submitLabel = isMember
    ? t('joinConnect')
    : access.state === 'denied'
      ? t('deniedContinue')
      : access.state === 'pending'
        ? t('requestResend')
        : t('requestSubmit');

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Remnus</span>
        </Link>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex flex-col items-center hover:opacity-80 transition-opacity">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-square-dark.png"
              alt="Remnus"
              className="w-14 h-14 object-contain rounded-xl mb-4 shadow-lg"
            />
            <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">{heading}</h1>
          </Link>
          <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800">
            <Terminal size={13} className="text-neutral-500 shrink-0" />
            <span className="text-sm text-neutral-300 font-mono truncate max-w-[16rem]">{projectName}</span>
          </div>
          <p className="text-neutral-600 text-xs mt-3">{t('signedInAs', { user: userName })}</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
            {error}
          </div>
        )}

        {access.state === 'denied' && retryDate && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-neutral-400 flex gap-2.5">
            <Lock size={15} className="text-neutral-500 shrink-0 mt-0.5" />
            <span>{t('deniedRetryHint', { date: retryDate })}</span>
          </div>
        )}

        {access.state === 'pending' && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/25 text-sm text-amber-200/80 flex gap-2.5">
            <Clock size={15} className="text-amber-400/80 shrink-0 mt-0.5" />
            <span>{t('pendingHint')}</span>
          </div>
        )}

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
            <p className="text-sm text-neutral-400 leading-relaxed">
              {isMember ? t('joinIntro') : t('requestIntro')}
            </p>
          </div>

          {isMember && authMode === 'oauth' ? (
            <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2.5">{t('accessLevel')}</p>
              <p className="text-sm text-neutral-400 leading-relaxed">{t('oauthScopeHint')}</p>
            </div>
          ) : (
            <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2.5">{t('accessLevel')}</p>

              {viewerOnly ? (
                <p className="text-sm text-neutral-400 leading-relaxed flex gap-2.5">
                  <Eye size={15} className="text-blue-400/80 shrink-0 mt-0.5" />
                  <span>{t('viewerScopeHint')}</span>
                </p>
              ) : (
                <div className="flex gap-2 mb-3">
                  {(['read', 'write'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                        scope === s
                          ? s === 'write'
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                            : 'bg-blue-500/10 border-blue-500/40 text-blue-300'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                      }`}
                    >
                      {s === 'read' ? t('scopeReadLabel') : t('scopeWriteLabel')}
                    </button>
                  ))}
                </div>
              )}

              {!viewerOnly && (
                <ul className="space-y-2">
                  {permissions.map((perm) => (
                    <li key={perm} className="flex items-center gap-2.5 text-sm text-neutral-300">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#7fc36d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {perm}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <form action={onJoin} className="px-6 py-5">
            <input type="hidden" name="scope" value={viewerOnly ? 'read' : scope} />

            {!isMember && access.state !== 'denied' && (
              <>
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                  {t('noteLabel')}
                </label>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('notePlaceholder')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 mb-4 placeholder:text-neutral-600 resize-none"
                />
              </>
            )}

            <button
              type="submit"
              className={`w-full font-medium text-sm py-2.5 rounded-lg transition-colors ${
                access.state === 'denied'
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white'
              }`}
            >
              {submitLabel}
            </button>
          </form>
        </div>

        <p className="text-xs text-neutral-700 mt-4 px-4 text-center">{t('disclaimer')}</p>
      </div>
    </div>
  );
}
