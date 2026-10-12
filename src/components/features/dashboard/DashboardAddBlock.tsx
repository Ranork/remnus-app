'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardBlockEditor from './DashboardBlockEditor';
import { useCanEdit } from '@/components/providers/WorkspaceRoleContext';

/** "Add block" — opens the block editor with nothing selected yet. Not offered to a Viewer. */
export default function DashboardAddBlock({ itemId, workspaceId, prominent = false }: { itemId: string; workspaceId: string; prominent?: boolean }) {
  const canEdit = useCanEdit(workspaceId);
  return canEdit ? <AddBlockButton itemId={itemId} prominent={prominent} /> : null;
}

function AddBlockButton({ itemId, prominent }: { itemId: string; prominent: boolean }) {
  const t = useTranslations('Dashboard');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={prominent ? 'primary' : 'ghost'} size={prominent ? 'default' : 'sm'} onClick={() => setOpen(true)}>
        <Plus />
        {t('addBlock')}
      </Button>
      {open && <DashboardBlockEditor itemId={itemId} onClose={() => setOpen(false)} />}
    </>
  );
}
