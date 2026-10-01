'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';

interface PageMarkdownDialogProps {
  initialMarkdown: string;
  onApply: (markdown: string) => void;
  onClose: () => void;
}

// Separate copy/edit surface for a page's full content, mirroring how
// BulkRowsDialog gives database rows a paste-driven surface next to (not
// inside) the table. The textarea uses the editor's storage-markdown format
// (same string persisted as page.content), not the clipboard-cleaned version —
// atom blocks (callout, image, bookmark, file, youtube, child page, page link)
// serialize as their `<div data-*>`/`<a data-page-link>` HTML there, which
// round-trips losslessly back into the same block on Apply. The clipboard-clean
// format would downgrade those into plain markdown on parse, silently losing
// e.g. an embedded child page reference.
export function PageMarkdownDialog({ initialMarkdown, onApply, onClose }: PageMarkdownDialogProps) {
  const t = useTranslations('Page');
  const [value, setValue] = useState(initialMarkdown);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable/denied — the textarea text is still selectable manually.
    }
  };

  const dirty = value !== initialMarkdown;

  const handleApply = () => {
    if (!dirty) return;
    onApply(value);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('markdown.title')}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <DialogDescription className="text-xs">{t('markdown.description')}</DialogDescription>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={18}
            spellCheck={false}
            aria-label={t('markdown.title')}
            className="min-h-80 font-mono text-xs leading-relaxed"
          />
        </DialogBody>

        <DialogFooter className="justify-between">
          <Button variant="ghost" onClick={handleCopy}>
            {copied ? <Check className="text-green-400" /> : <Copy />}
            {copied ? t('markdown.copied') : t('markdown.copy')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t('markdown.cancel')}
            </Button>
            <Button variant="primary" onClick={handleApply} disabled={!dirty}>
              {t('markdown.apply')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
