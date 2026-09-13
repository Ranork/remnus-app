'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Check, Plus, Terminal } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';

interface Workspace {
  id: string;
  name: string;
  icon: string | null;
  iconColor?: string | null;
}

interface Props {
  /** Directory name the CLI was run in — what the user recognizes this install by. */
  projectName: string;
  /** `oauth` = no token is minted here; the agent asks for its own permission later. */
  authMode: 'pat' | 'oauth';
  /** Workspaces the user owns. Membership alone isn't enough to mint a token. */
  workspaces: Workspace[];
  userName: string;
  error?: string;
  onInstall: (formData: FormData) => Promise<void>;
}

const NEW_WORKSPACE = '__new__';

export function InstallForm({ projectName, authMode, workspaces, userName, error, onInstall }: Props) {
  const t = useTranslations('Install');

  // Write is preselected because the whole point of connecting a project is that the
  // agent can build and maintain the workspace; a read-only install would leave the
  // calibration step unable to create anything. Still an explicit, visible choice.
  const [scope, setScope] = useState<'read' | 'write'>('write');

  // No owned workspace yet → the only sensible path is creating one for this project.
  const [target, setTarget] = useState<string>(workspaces[0]?.id ?? NEW_WORKSPACE);
  const [newName, setNewName] = useState<string>(projectName);

  const creatingNew = target === NEW_WORKSPACE;
  const canSubmit = creatingNew ? newName.trim().length > 0 : Boolean(target);

  const permissions = scope === 'write'
    ? [t('permRead'), t('permWrite')]
    : [t('permRead')];

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
            <h1 className="text-2xl font-bold text-white tracking-tight">{t('title')}</h1>
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

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {authMode === 'oauth' ? (
            <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2.5">{t('accessLevel')}</p>
              <p className="text-sm text-neutral-400 leading-relaxed">{t('oauthScopeHint')}</p>
            </div>
          ) : (
          <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2.5">{t('accessLevel')}</p>
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
          </div>
          )}

          <form action={onInstall} className="px-6 py-5">
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="workspace_id" value={target} />

            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              {t('workspaceLabel')}
            </label>

            <div className="space-y-1.5 mb-4 max-h-44 overflow-y-auto pr-0.5">
              {workspaces.map((ws) => {
                const active = target === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setTarget(ws.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                      active
                        ? 'bg-blue-500/10 border-blue-500/40'
                        : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    {ws.icon
                      ? <PageIcon icon={ws.icon} iconColor={ws.iconColor} size={18} />
                      : <span className="w-4.5 h-4.5 rounded bg-neutral-700 flex items-center justify-center text-[10px] font-bold text-neutral-300 shrink-0">
                          {ws.name.charAt(0).toUpperCase()}
                        </span>
                    }
                    <span className={`flex-1 text-sm truncate ${active ? 'text-blue-100' : 'text-neutral-200'}`}>
                      {ws.name}
                    </span>
                    {active && <Check size={15} className="text-blue-400 shrink-0" />}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setTarget(NEW_WORKSPACE)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  creatingNew
                    ? 'bg-blue-500/10 border-blue-500/40'
                    : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <Plus size={16} className={creatingNew ? 'text-blue-300 shrink-0' : 'text-neutral-400 shrink-0'} />
                <span className={`flex-1 text-sm truncate ${creatingNew ? 'text-blue-100' : 'text-neutral-200'}`}>
                  {t('newWorkspaceOption')}
                </span>
                {creatingNew && <Check size={15} className="text-blue-400 shrink-0" />}
              </button>
            </div>

            {creatingNew && (
              <>
                <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
                  {t('newWorkspaceNameLabel')}
                </label>
                <input
                  name="new_workspace_name"
                  type="text"
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('newWorkspaceNamePlaceholder')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 mb-4 placeholder:text-neutral-600"
                />
              </>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
            >
              {t('connect')}
            </button>
          </form>
        </div>

        <p className="text-xs text-neutral-700 mt-4 px-4 text-center">{t('disclaimer')}</p>
      </div>
    </div>
  );
}
