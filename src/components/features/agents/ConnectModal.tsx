'use client';
import { useTranslations } from 'next-intl';
import ConnectFlow, { type MintTarget } from './ConnectFlow';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  mcpUrl: string;
  /** Workspaces the user can mint a PAT in. Empty = OAuth-only (token mode unavailable). */
  mintTargets?: MintTarget[];
  onClose: () => void;
  /** Funnel attribution for where the connect flow was opened from. */
  source?: string;
}

/**
 * The connect flow ({@link ConnectFlow}) in a dialog. Opened from the AI Agents dialog it
 * nests on top of it (the parent dims); opened on its own it is a plain dialog.
 */
export default function ConnectModal({ mcpUrl, mintTargets = [], onClose, source }: Props) {
  const t = useTranslations('WorkspaceSettings');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('connectTitle')}</DialogTitle>
        </DialogHeader>
        <DialogBody className="sm:px-6 sm:py-5">
          <ConnectFlow bare mcpUrl={mcpUrl} mintTargets={mintTargets} onClose={onClose} source={source} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
