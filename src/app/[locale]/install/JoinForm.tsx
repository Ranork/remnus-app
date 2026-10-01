'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, Clock, Eye, Lock } from 'lucide-react';
import { AuthCard, AuthNotice, AuthScreen, AuthSection } from '@/components/features/auth/AuthScreen';
import { ProjectChip, SubmitButton } from '@/components/features/auth/parts';
import { RadioCard, RadioCards } from '@/components/ui/radio-cards';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/settings';

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
  const locale = useLocale();

  const isMember = access.state === 'member';
  const viewerOnly = isMember && access.viewer;
  const denied = access.state === 'denied';

  // A viewer cannot hold a write token at all, so the control is not offered rather
  // than offered-and-rejected. The server clamps this again regardless.
  const [scope, setScope] = useState<'read' | 'write'>(
    isMember && access.maxScope === 'read' ? 'read' : 'write',
  );
  const [note, setNote] = useState('');

  const heading = isMember ? t('joinTitle') : t('requestTitle');

  const retryDate =
    access.state === 'denied'
      ? new Date(access.retryAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
      : null;

  // Even a refusal gets a submit button: the CLI is sitting on the poll channel, and
  // the only way it hears "denied" instead of timing out after five minutes is if this
  // page reports back. The action re-checks and refuses to create anything.
  const submitLabel = isMember
    ? t('joinConnect')
    : denied
      ? t('deniedContinue')
      : access.state === 'pending'
        ? t('requestResend')
        : t('requestSubmit');

  return (
    <AuthScreen footer={t('disclaimer')}>
      <AuthCard
        title={heading}
        description={isMember ? t('joinIntro') : t('requestIntro')}
        meta={
          <>
            <ProjectChip name={projectName} />
            <span className="text-xs text-fg-3">{t('signedInAs', { user: userName })}</span>
          </>
        }
      >
        {error && <AuthNotice tone="danger" icon={<AlertCircle />}>{error}</AuthNotice>}

        {denied && retryDate && (
          <AuthNotice icon={<Lock />}>{t('deniedRetryHint', { date: retryDate })}</AuthNotice>
        )}

        {access.state === 'pending' && <AuthNotice icon={<Clock />}>{t('pendingHint')}</AuthNotice>}

        <form action={onJoin} className="flex flex-col gap-6">
          <input type="hidden" name="scope" value={viewerOnly ? 'read' : scope} />

          {!denied && (
            <AuthSection label={t('accessLevel')} labelId="join-scope">
              {isMember && authMode === 'oauth' ? (
                <p className="text-ui leading-relaxed text-fg-3">{t('oauthScopeHint')}</p>
              ) : viewerOnly ? (
                <AuthNotice icon={<Eye />}>{t('viewerScopeHint')}</AuthNotice>
              ) : (
                <RadioCards value={scope} onValueChange={setScope} aria-labelledby="join-scope">
                  <RadioCard value="read" title={t('scopeReadLabel')} description={t('permRead')} />
                  <RadioCard value="write" title={t('scopeWriteLabel')} description={t('permWrite')} />
                </RadioCards>
              )}
            </AuthSection>
          )}

          {!isMember && !denied && (
            <Field label={t('noteLabel')} htmlFor="join-note">
              <Textarea
                id="join-note"
                name="note"
                rows={3}
                maxLength={280}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('notePlaceholder')}
                className="resize-none"
              />
            </Field>
          )}

          <SubmitButton variant={denied ? 'secondary' : 'primary'}>{submitLabel}</SubmitButton>
        </form>
      </AuthCard>
    </AuthScreen>
  );
}
