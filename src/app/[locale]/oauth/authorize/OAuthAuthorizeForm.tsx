'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { AuthCard, AuthNotice, AuthScreen, AuthSection } from '@/components/features/auth/AuthScreen';
import { WorkspaceGlyph } from '@/components/features/auth/parts';
import { AGENT_MARKS, MarkIcon, resolveAgentMark } from '@/components/features/agents/AgentMark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioCard, RadioCards } from '@/components/ui/radio-cards';
import { Field } from '@/components/ui/settings';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';

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

  // Default to the scope the client requested (read unless it asked for exactly
  // `write`), but let the user choose — including upgrading to write. The preselected
  // option is labelled, so what happens on a plain "Authorize" is never a guess.
  const [selectedScope, setSelectedScope] = useState<'read' | 'write'>(scope);

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

  const defaultBadge = <Badge variant="outline" size="sm">{t('scopeDefault')}</Badge>;
  const pinned = workspaces.length === 1 ? workspaces[0] : null;

  return (
    <AuthScreen footer={t('disclaimer')}>
      <AuthCard
        title={t('heading', { client: clientName })}
        description={t('headingHint')}
        meta={<span className="text-xs text-fg-3">{t('signedInAs', { user: userName })}</span>}
      >
        <form action={onApprove} className="flex flex-col gap-6">
          <input type="hidden" name="scope" value={effectiveScope} />
          <input type="hidden" name="workspace_id" value={selectedWorkspace} />
          <input type="hidden" name="agent_name" value={selectedAgent ?? ''} />

          <AuthSection label={t('selectWorkspace')} labelId="oauth-workspace">
            {pinned ? (
              // A project-pinned connection (`resource` names one workspace): nothing to pick.
              <div className="flex items-center gap-3 rounded-control bg-raised px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <WorkspaceGlyph name={pinned.name} icon={pinned.icon} iconColor={pinned.iconColor} />
                <span className="truncate text-ui font-medium text-fg">{pinned.name}</span>
              </div>
            ) : (
              <div className="-m-1 max-h-56 overflow-y-auto p-1">
                <RadioCards value={selectedWorkspace} onValueChange={setSelectedWorkspace} aria-labelledby="oauth-workspace">
                  {workspaces.map((ws) => (
                    <RadioCard
                      key={ws.id}
                      value={ws.id}
                      size="sm"
                      icon={<WorkspaceGlyph name={ws.name} icon={ws.icon} iconColor={ws.iconColor} />}
                      title={ws.name}
                    />
                  ))}
                </RadioCards>
              </div>
            )}
          </AuthSection>

          <AuthSection label={t('accessLevel')} labelId="oauth-scope">
            {viewerOnly && <AuthNotice icon={<Eye />}>{t('viewerScopeHint')}</AuthNotice>}
            <RadioCards value={effectiveScope} onValueChange={setSelectedScope} aria-labelledby="oauth-scope">
              <RadioCard
                value="read"
                title={t('scopeReadLabel')}
                description={t('permReadOnly')}
                badge={scope === 'read' ? defaultBadge : undefined}
              />
              <RadioCard
                value="write"
                disabled={viewerOnly}
                title={t('scopeWriteLabel')}
                description={t('permCreateEdit')}
                badge={scope === 'write' ? defaultBadge : undefined}
              />
            </RadioCards>
          </AuthSection>

          <Field label={t('agentNameLabel')} htmlFor="oauth-display-name">
            <Input
              id="oauth-display-name"
              name="display_name"
              size="lg"
              maxLength={60}
              value={agentLabel}
              onChange={(e) => setAgentLabel(e.target.value)}
              placeholder={t('agentNamePlaceholder')}
            />
          </Field>

          <AuthSection label={t('agentTypeLabel')}>
            <div className="flex flex-wrap gap-1.5">
              {AGENT_MARKS.map((a) => {
                const active = selectedAgent === a.id;
                return (
                  <Tooltip key={a.id} content={a.label}>
                    <button
                      type="button"
                      aria-label={a.label}
                      aria-pressed={active}
                      onClick={() => setSelectedAgent(active ? null : a.id)}
                      className={cn(
                        'flex size-9 cursor-pointer items-center justify-center rounded-control transition-[background-color,box-shadow]',
                        active
                          ? 'bg-signal-soft/50 shadow-[inset_0_0_0_1.5px_var(--color-signal)]'
                          : 'bg-raised shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
                      )}
                    >
                      <MarkIcon mark={a.mark} size={16} />
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </AuthSection>

          <ConsentActions
            canApprove={Boolean(selectedWorkspace)}
            onDeny={onDeny}
            approveLabel={t('authorize')}
            denyLabel={t('deny')}
          />
        </form>
      </AuthCard>
    </AuthScreen>
  );
}

/**
 * Deny and Authorize side by side, in the one form: Deny submits it to its own action
 * (`formAction`), so both buttons know the form is busy and only the clicked one spins.
 */
function ConsentActions({
  canApprove,
  onDeny,
  approveLabel,
  denyLabel,
}: {
  canApprove: boolean;
  onDeny: () => Promise<void>;
  approveLabel: string;
  denyLabel: string;
}) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState<'approve' | 'deny' | null>(null);

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="submit"
        size="lg"
        formAction={onDeny}
        onClick={() => setClicked('deny')}
        loading={pending && clicked === 'deny'}
        disabled={pending}
      >
        {denyLabel}
      </Button>
      <Button
        type="submit"
        variant="primary"
        size="lg"
        onClick={() => setClicked('approve')}
        loading={pending && clicked === 'approve'}
        disabled={pending || !canApprove}
      >
        {approveLabel}
      </Button>
    </div>
  );
}
