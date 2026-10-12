'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';

/**
 * Shown in a page, database or dashboard header when the person is a Viewer in its
 * workspace: says why nothing there can be changed, instead of edits silently failing.
 */
export default function ViewOnlyBadge({ className }: { className?: string }) {
  const t = useTranslations('Workspace');
  return (
    <Tooltip content={t('viewOnlyHint')}>
      <Badge className={className} tabIndex={0} aria-label={t('viewOnlyHint')}>
        <Eye className="size-3" aria-hidden />
        {t('viewOnly')}
      </Badge>
    </Tooltip>
  );
}
