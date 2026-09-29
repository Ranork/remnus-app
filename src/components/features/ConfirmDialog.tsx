'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Return a promise to keep the dialog open while the work runs: the confirm button
   * shows a spinner, both buttons and Escape/outside-click are held, and a rejection is
   * shown inside the dialog instead of vanishing. When the work succeeds the dialog
   * STAYS busy — the caller must stop rendering it (or navigate away). A plain
   * function behaves as before: the caller closes the dialog itself.
   */
  onConfirm: () => void | Promise<unknown>;
  onCancel: () => void;
  /** `danger` (default) for destructive confirms; `primary` for the rest. */
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) {
  const t = useTranslations('UI');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    if (pending) return;
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    setPending(true);
    setFailed(false);
    try {
      await result;
      // Success leaves the dialog busy on purpose: the caller closes it (or navigates
      // away), and until then a second click must not run the action again.
    } catch (err) {
      console.error(err);
      setFailed(true);
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {failed && (
          <p role="alert" className="text-xs text-red-400">{t('actionFailed')}</p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={confirm} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
