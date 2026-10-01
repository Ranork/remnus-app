'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Plus } from 'lucide-react';
import { AuthCard, AuthNotice, AuthScreen, AuthSection } from '@/components/features/auth/AuthScreen';
import { ProjectChip, SubmitButton, WorkspaceGlyph } from '@/components/features/auth/parts';
import { RadioCard, RadioCards } from '@/components/ui/radio-cards';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/settings';

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

  return (
    <AuthScreen footer={t('disclaimer')}>
      <AuthCard
        title={t('title')}
        meta={
          <>
            <ProjectChip name={projectName} />
            <span className="text-xs text-fg-3">{t('signedInAs', { user: userName })}</span>
          </>
        }
      >
        {error && <AuthNotice tone="danger" icon={<AlertCircle />}>{error}</AuthNotice>}

        <form action={onInstall} className="flex flex-col gap-6">
          <input type="hidden" name="scope" value={scope} />
          <input type="hidden" name="workspace_id" value={target} />

          <AuthSection label={t('workspaceLabel')} labelId="install-workspace">
            {/* p-1/-m-1: room for the focus ring inside the scrolling list */}
            <div className="-m-1 max-h-64 overflow-y-auto p-1">
              <RadioCards value={target} onValueChange={setTarget} aria-labelledby="install-workspace">
                {workspaces.map((ws) => (
                  <RadioCard
                    key={ws.id}
                    value={ws.id}
                    size="sm"
                    icon={<WorkspaceGlyph name={ws.name} icon={ws.icon} iconColor={ws.iconColor} />}
                    title={ws.name}
                  />
                ))}
                <RadioCard
                  value={NEW_WORKSPACE}
                  size="sm"
                  icon={<Plus className="size-4.5 text-fg-3" aria-hidden />}
                  title={t('newWorkspaceOption')}
                />
              </RadioCards>
            </div>

            {creatingNew && (
              <Field label={t('newWorkspaceNameLabel')} htmlFor="install-new-workspace" className="mt-2">
                <Input
                  id="install-new-workspace"
                  name="new_workspace_name"
                  size="lg"
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('newWorkspaceNamePlaceholder')}
                />
              </Field>
            )}
          </AuthSection>

          <AuthSection label={t('accessLevel')} labelId="install-scope">
            {authMode === 'oauth' ? (
              <p className="text-ui leading-relaxed text-fg-3">{t('oauthScopeHint')}</p>
            ) : (
              <RadioCards value={scope} onValueChange={setScope} aria-labelledby="install-scope">
                <RadioCard value="read" title={t('scopeReadLabel')} description={t('permRead')} />
                <RadioCard value="write" title={t('scopeWriteLabel')} description={t('permWrite')} />
              </RadioCards>
            )}
          </AuthSection>

          <SubmitButton disabled={!canSubmit}>{t('connect')}</SubmitButton>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}
