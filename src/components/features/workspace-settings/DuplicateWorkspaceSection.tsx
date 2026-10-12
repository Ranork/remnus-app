'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { duplicateWorkspace } from '@/lib/actions/workspace';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioCard, RadioCards } from '@/components/ui/radio-cards';
import { Field, SettingsSection } from '@/components/ui/settings';

interface DuplicateWorkspaceSectionProps {
  workspaceId: string;
  workspaceName: string;
  /** Closes the settings modal once the copy exists. */
  onDone: () => void;
}

type Mode = 'everything' | 'structure';

/**
 * "Duplicate workspace" — the copy keeps the workspace's shape (pages, boards with their
 * columns and views, dashboards); the choice is whether the database rows come along.
 * Members, agent connections, share links and comments never do.
 */
export default function DuplicateWorkspaceSection({ workspaceId, workspaceName, onDone }: DuplicateWorkspaceSectionProps) {
  const t = useTranslations('WorkspaceSettings');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(workspaceName);
  const [mode, setMode] = useState<Mode>('everything');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const openDialog = () => {
    setName(workspaceName);
    setMode('everything');
    setError('');
    setOpen(true);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError(t('nameRequired')); return; }
    setError('');
    startTransition(async () => {
      try {
        const res = await duplicateWorkspace(workspaceId, trimmed, mode === 'everything');
        if (res.error) {
          setError(res.error);
          return;
        }
        setOpen(false);
        onDone();
        router.push('/app');
      } catch (err) {
        console.error(err);
        setError(t('duplicateFailed'));
      }
    });
  };

  return (
    <SettingsSection title={t('duplicateTitle')} description={t('duplicateHint')}>
      <div>
        <Button variant="secondary" size="sm" onClick={openDialog}>{t('duplicateAction')}</Button>
      </div>

      {open && (
        <Dialog open onOpenChange={(next) => { if (!next && !pending) setOpen(false); }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>{t('duplicateTitle')}</DialogTitle>
              <DialogDescription>{t('duplicateDialogHint')}</DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <Field label={t('duplicateNameLabel')} htmlFor="duplicate-workspace-name" error={error || undefined}>
                <Input
                  id="duplicate-workspace-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !pending) submit(); }}
                  disabled={pending}
                  autoFocus
                />
              </Field>
              <RadioCards<Mode> value={mode} onValueChange={setMode} aria-label={t('duplicateTitle')} disabled={pending}>
                <RadioCard value="everything" title={t('duplicateEverything')} description={t('duplicateEverythingDesc')} />
                <RadioCard value="structure" title={t('duplicateStructure')} description={t('duplicateStructureDesc')} />
              </RadioCards>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>{t('cancel')}</Button>
              <Button variant="primary" onClick={submit} loading={pending}>{t('duplicateConfirm')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </SettingsSection>
  );
}
