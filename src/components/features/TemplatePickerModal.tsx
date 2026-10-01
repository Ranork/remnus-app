'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/settings';
import { TEMPLATE_CATALOG, type TemplateCatalogEntry } from '@/lib/templates';
import { switchWorkspace } from '@/lib/actions/workspace';
import { createFromTemplate } from '@/lib/actions/templates';

interface TemplatePickerModalProps {
  workspaceId: string;
  activeWorkspaceId: string;
  onClose: () => void;
  /** navId = URL id (dbId for databases, itemId for pages and dashboards), sidebarItemId = workspace_items.id */
  onCreated: (type: 'page' | 'database' | 'dashboard', navId: string, tempId: string, sidebarItemId?: string) => void;
  /** Called immediately on Create click with a temp ID — for optimistic sidebar insertion */
  onOptimisticCreate?: (type: 'page' | 'database' | 'dashboard', tempId: string, title: string, icon: string | null, iconColor: string | null) => void;
  parentId?: string;
}

const BLANK_IDS = ['page-blank', 'db-blank', 'dashboard-blank'];
const BLANK_TEMPLATES = TEMPLATE_CATALOG.filter(t => BLANK_IDS.includes(t.id));
const OTHER_TEMPLATES = TEMPLATE_CATALOG.filter(t => !BLANK_IDS.includes(t.id));

export default function TemplatePickerModal({
  workspaceId,
  activeWorkspaceId,
  onClose,
  onCreated,
  onOptimisticCreate,
  parentId,
}: TemplatePickerModalProps) {
  const t = useTranslations('Templates');
  const tCommon = useTranslations('Workspace');
  const tPage = useTranslations('Page');

  const templateName = (template: TemplateCatalogEntry) => t(template.nameKey);
  const templateDesc = (template: TemplateCatalogEntry) => t(`${template.nameKey}Desc`);

  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCatalogEntry | null>(null);
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'confirm') {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [step]);

  const selectTemplate = (template: TemplateCatalogEntry) => {
    setSelectedTemplate(template);
    setTitle(templateName(template));
    setStep('confirm');
  };

  const handleCreate = () => {
    if (!selectedTemplate || !title.trim() || isPending) return;

    const type = selectedTemplate.category;
    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const icon = selectedTemplate.icon ?? null;
    const iconColor = selectedTemplate.iconColor ?? null;

    // Close modal and insert optimistic item immediately
    onOptimisticCreate?.(type, tempId, title.trim(), icon, iconColor);
    onClose();

    // Persist to server in background. The server fills the template in the UI
    // language (columns, options, views, sample rows, page body).
    startTransition(async () => {
      if (workspaceId !== activeWorkspaceId) {
        await switchWorkspace(workspaceId);
      }
      const created = await createFromTemplate(workspaceId, selectedTemplate.id, title.trim(), parentId);
      onCreated(created.type, created.navId, tempId, created.type === 'database' ? created.itemId : undefined);
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open, details) => {
        if (open) return;
        // Escape on the naming step steps back to the list instead of closing.
        if (step === 'confirm' && details.reason === 'escape-key') {
          setStep('pick');
          return;
        }
        onClose();
      }}
    >
      {step === 'pick' ? (
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{t('modalTitle')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-fg-3">{t('groupBlank')}</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {BLANK_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    localizedName={templateName(template)}
                    localizedDesc={templateDesc(template)}
                    onClick={() => selectTemplate(template)}
                  />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-xs font-medium text-fg-3">{t('groupTemplates')}</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {OTHER_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    localizedName={templateName(template)}
                    localizedDesc={templateDesc(template)}
                    onClick={() => selectTemplate(template)}
                  />
                ))}
              </div>
            </section>
          </DialogBody>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader className="flex-row items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => setStep('pick')} aria-label={tPage('back')} className="-ml-1.5">
              <ArrowLeft />
            </Button>
            <DialogTitle className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-base leading-none">{selectedTemplate?.icon}</span>
              <span className="truncate">{selectedTemplate ? templateName(selectedTemplate) : ''}</span>
            </DialogTitle>
          </DialogHeader>

          <Field label={t('nameLabel')} htmlFor="template-picker-name">
            <Input
              id="template-picker-name"
              ref={titleInputRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder={t('namePlaceholder')}
              disabled={isPending}
            />
          </Field>

          <DialogFooter>
            <Button onClick={() => setStep('pick')}>{tCommon('cancel')}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!title.trim()} loading={isPending}>
              {tCommon('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

function TemplateCard({
  template,
  localizedName,
  localizedDesc,
  onClick,
}: {
  template: TemplateCatalogEntry;
  localizedName: string;
  localizedDesc: string;
  onClick: () => void;
}) {
  return (
    // Role tokens, not white: the hover used to turn the name white, which vanished on
    // the light theme's white card.
    <button
      onClick={onClick}
      className="group rounded-control border border-line bg-raised p-3.5 text-left transition-colors hover:border-line-strong hover:bg-hover/50"
    >
      <div className="text-xl mb-2 leading-none">{template.icon}</div>
      <p className="mb-0.5 text-xs font-semibold text-fg-2 transition-colors group-hover:text-fg">
        {localizedName}
      </p>
      <p className="text-2xs leading-relaxed text-fg-3">{localizedDesc}</p>
    </button>
  );
}
