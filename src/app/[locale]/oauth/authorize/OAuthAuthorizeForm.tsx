'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import PageIcon from '@/components/features/PageIcon';
import { AGENT_MARKS, MarkIcon, resolveAgentMark } from '@/components/features/agents/AgentMark';

interface Workspace {
  id: string;
  name: string;
  icon: string | null;
  iconColor?: string | null;
  /** Viewer role here: a connection can only read (the server clamps it regardless). */
  viewer?: boolean;
}

interface Props {
  clientName: string;
  scope: 'read' | 'write';
  workspaces: Workspace[];
  userName: string;
  onApprove: (formData: FormData) => Promise<void>;
  onDeny: () => Promise<void>;
}

export function OAuthAuthorizeForm({ clientName, scope, workspaces, userName, onApprove, onDeny }: Props) {
  const t = useTranslations('OAuthAuthorize');

  // Default to the scope the client requested, but let the user choose (incl. upgrading to write).
  const [selectedScope, setSelectedScope] = useState<'read' | 'write'>(scope);

  // Workspace selection (icon picker grid instead of a bare <select>).
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(workspaces[0]?.id ?? '');

  // Agent brand (icon). Default to whatever we can infer from the client name.
  const inferred = AGENT_MARKS.find(a => a.mark === resolveAgentMark(clientName))?.id ?? null;
  const [selectedAgent, setSelectedAgent] = useState<string | null>(inferred);

  // Friendly label for the connection — defaults to the client-reported name.
  const [agentLabel, setAgentLabel] = useState<string>(clientName ?? '');

  // A viewer's connection can only read — say so instead of offering a choice the
  // server would quietly overrule.
  const viewerOnly = workspaces.find((ws) => ws.id === selectedWorkspace)?.viewer === true;
  const effectiveScope = viewerOnly ? 'read' : selectedScope;

  const scopePermissions = effectiveScope === 'write'
    ? [t('permReadWrite'), t('permCreateEdit')]
    : [t('permReadOnly')];

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
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex flex-col items-center hover:opacity-80 transition-opacity">
            <img
              src="/logo-square-dark.png"
              alt="Remnus"
              className="w-14 h-14 object-contain rounded-xl mb-4 shadow-lg"
            />
            <h1 className="text-2xl font-bold text-neutral-50 tracking-tight">Remnus</h1>
          </Link>
          <p className="text-neutral-400 text-sm mt-2 text-center px-2">
            {t('subtitle', { client: clientName })}
          </p>
          <p className="text-neutral-600 text-xs mt-1">{t('signedInAs', { user: userName })}</p>
        </div>

        {/* Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          {/* Access level selector */}
          <div className="px-6 pt-5 pb-4 border-b border-neutral-800">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2.5">{t('accessLevel')}</p>
            <div className="flex gap-2 mb-3">
              {(['read', 'write'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedScope(s)}
                  disabled={viewerOnly && s === 'write'}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    effectiveScope === s
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
            {viewerOnly && (
              <p className="text-xs text-neutral-500 leading-relaxed mb-3">{t('viewerScopeHint')}</p>
            )}
            <ul className="space-y-2">
              {scopePermissions.map((perm) => (
                <li key={perm} className="flex items-center gap-2.5 text-sm text-neutral-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#7fc36d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {perm}
                </li>
              ))}
            </ul>
          </div>

          <form action={onApprove} className="px-6 py-5">
            <input type="hidden" name="scope" value={effectiveScope} />
            <input type="hidden" name="workspace_id" value={selectedWorkspace} />
            <input type="hidden" name="agent_name" value={selectedAgent ?? ''} />

            {/* Workspace selector — icon list */}
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              {t('selectWorkspace')}
            </label>
            <div className="space-y-1.5 mb-5 max-h-44 overflow-y-auto pr-0.5">
              {workspaces.map((ws) => {
                const active = selectedWorkspace === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWorkspace(ws.id)}
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
                    <span className={`flex-1 text-sm truncate ${active ? 'text-blue-400' : 'text-neutral-200'}`}>
                      {ws.name}
                    </span>
                    {active && <Check size={15} className="text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Agent identity — brand + friendly name */}
            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              {t('agentTypeLabel')}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {AGENT_MARKS.map((a) => {
                const active = selectedAgent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    title={a.label}
                    onClick={() => setSelectedAgent(active ? null : a.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                      active
                        ? 'bg-blue-500/10 border-blue-500/40'
                        : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                    }`}
                  >
                    <MarkIcon mark={a.mark} size={15} />
                  </button>
                );
              })}
            </div>

            <label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">
              {t('agentNameLabel')}
            </label>
            <input
              name="display_name"
              type="text"
              maxLength={60}
              value={agentLabel}
              onChange={(e) => setAgentLabel(e.target.value)}
              placeholder={t('agentNamePlaceholder')}
              className="w-full bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 mb-4 placeholder:text-neutral-600"
            />

            <button
              type="submit"
              disabled={!selectedWorkspace}
              className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50 text-white font-medium text-sm py-2.5 rounded-lg transition-colors"
            >
              {t('authorize')}
            </button>
          </form>
        </div>

        {/* Deny + disclaimer */}
        <div className="mt-4 text-center">
          <form action={onDeny}>
            <button
              type="submit"
              className="text-neutral-500 hover:text-neutral-300 text-sm py-1.5 transition-colors"
            >
              {t('deny')}
            </button>
          </form>
          <p className="text-xs text-neutral-700 mt-3 px-4">{t('disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
