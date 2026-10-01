'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardBlockEditor from './DashboardBlockEditor';

/** "Add block" — opens the block editor with nothing selected yet. */
export default function DashboardAddBlock({ itemId, prominent = false }: { itemId: string; prominent?: boolean }) {
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
