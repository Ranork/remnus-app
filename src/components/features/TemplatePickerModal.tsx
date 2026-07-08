'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TEMPLATES, type TemplateDefinition, type DatabaseTemplateDefinition, type PageTemplateDefinition } from '@/lib/templates';
import { createStandalonePage, createWorkspaceDatabase, switchWorkspace } from '@/lib/actions/workspace';
import { createPage } from '@/lib/actions/page';

interface TemplatePickerModalProps {
  workspaceId: string;
  activeWorkspaceId: string;
  onClose: () => void;
  /** navId = URL id (dbId for databases, itemId for pages), sidebarItemId = workspace_items.id */
  onCreated: (type: 'page' | 'database', navId: string, tempId: string, sidebarItemId?: string) => void;
  /** Called immediately on Create click with a temp ID — for optimistic sidebar insertion */
  onOptimisticCreate?: (type: 'page' | 'database', tempId: string, title: string, icon: string | null, iconColor: string | null) => void;
  parentId?: string;
}

const BLANK_TEMPLATES = TEMPLATES.filter(t => t.id === 'page-blank' || t.id === 'db-blank');
const OTHER_TEMPLATES = TEMPLATES.filter(t => t.id !== 'page-blank' && t.id !== 'db-blank');

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

  const templateName = (name: string) => {
    const map: Record<string, string> = {
      'Blank Page': t('blankPage'),
      'Meeting Notes': t('meetingNotes'),
      'Project Brief': t('projectBrief'),
      'Blank Database': t('blankDatabase'),
      'Task Tracker': t('taskTracker'),
      'Event Calendar': t('eventCalendar'),
      'Reading List': t('readingList'),
      'Agent Memory': t('agentMemory'),
    };
    return map[name] ?? name;
  };

  const templateDesc = (name: string, desc: string) => {
    const map: Record<string, string> = {
      'Blank Page': t('blankPageDesc'),
      'Meeting Notes': t('meetingNotesDesc'),
      'Project Brief': t('projectBriefDesc'),
      'Blank Database': t('blankDatabaseDesc'),
      'Task Tracker': t('taskTrackerDesc'),
      'Event Calendar': t('eventCalendarDesc'),
      'Reading List': t('readingListDesc'),
      'Agent Memory': t('agentMemoryDesc'),
    };
    return map[name] ?? desc;
  };

  const [step, setStep] = useState<'pick' | 'confirm'>('pick');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDefinition | null>(null);
  const [title, setTitle] = useState('');
  const [isPending, startTransition] = useTransition();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'confirm') {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [step]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'confirm') setStep('pick');
        else onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, step]);

  const selectTemplate = (template: TemplateDefinition) => {
    setSelectedTemplate(template);
    setTitle(template.name);
    setStep('confirm');
  };

  const handleCreate = () => {
    if (!selectedTemplate || !title.trim() || isPending) return;

    const type = selectedTemplate.category as 'page' | 'database';
    const tempId = `temp-${crypto.randomUUID().slice(0, 8)}`;
    const icon = selectedTemplate.icon ?? null;
    const iconColor = selectedTemplate.iconColor ?? null;

    // Close modal and insert optimistic item immediately
    onOptimisticCreate?.(type, tempId, title.trim(), icon, iconColor);
    onClose();

    // Persist to server in background
    startTransition(async () => {
      if (workspaceId !== activeWorkspaceId) {
        await switchWorkspace(workspaceId);
      }
      if (type === 'page') {
        const pageTpl = selectedTemplate as PageTemplateDefinition;
        const { itemId } = await createStandalonePage(workspaceId, title.trim(), parentId, {
          initialContent: pageTpl.initialContent,
          icon,
          iconColor,
        });
        onCreated('page', itemId, tempId);
      } else {
        const db = selectedTemplate as DatabaseTemplateDefinition;
        const freshViews = db.views.map(v => ({
          ...v,
          id: crypto.randomUUID().slice(0, 8),
        }));
        const result = await createWorkspaceDatabase(workspaceId, title.trim(), {
          schema: db.schema,
          views: freshViews,
          icon,
          iconColor,
          parentId,
        });
        if (db.seedRows?.length) {
          for (const row of db.seedRows) {
            await createPage(result.dbId, row.title, row.properties as Record<string, unknown>);
          }
        }
        onCreated('database', result.dbId, tempId, result.itemId);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 md:p-10"
      onClick={step === 'confirm' ? () => setStep('pick') : onClose}
    >
      {step === 'pick' ? (
        <div
          className="w-full max-w-full sm:max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
          style={{ maxHeight: '82vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-850 bg-neutral-900/30 shrink-0">
            <h2 className="text-sm font-semibold text-neutral-100">{t('modalTitle')}</h2>
            <button
              onClick={onClose}
              className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto p-5 space-y-6">
            {/* Blank group */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                {t('groupBlank')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BLANK_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    localizedName={templateName(template.name)}
                    localizedDesc={templateDesc(template.name, template.description)}
                    onClick={() => selectTemplate(template)}
                  />
                ))}
              </div>
            </div>

            {/* Templates group */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                {t('groupTemplates')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {OTHER_TEMPLATES.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    localizedName={templateName(template.name)}
                    localizedDesc={templateDesc(template.name, template.description)}
                    onClick={() => selectTemplate(template)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-sm bg-neutral-850 border border-neutral-800 rounded-lg modal-shadow flex flex-col overflow-hidden animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-neutral-850 bg-neutral-900/30">
            <button
              onClick={() => setStep('pick')}
              className="p-1 text-neutral-500 hover:text-neutral-200 transition-colors rounded shrink-0"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base leading-none shrink-0">{selectedTemplate?.icon}</span>
              <span className="text-sm font-semibold text-neutral-100 truncate">
                {selectedTemplate ? templateName(selectedTemplate.name) : ''}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">
              Name
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="Enter a name..."
              disabled={isPending}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-md text-neutral-100 placeholder-neutral-600 px-3 py-2 text-sm outline-none focus:border-blue-500/60 transition-colors disabled:opacity-50"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-neutral-850 bg-neutral-900/30">
            <button
              onClick={() => setStep('pick')}
              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors px-3 py-1.5 rounded"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded font-medium transition-colors"
            >
              {isPending && (
                <div className="w-3 h-3 rounded-full border-2 border-white/25 border-t-white animate-spin shrink-0" />
              )}
              {isPending ? tCommon('creating') : tCommon('create')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  localizedName,
  localizedDesc,
  onClick,
}: {
  template: TemplateDefinition;
  localizedName: string;
  localizedDesc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-3.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-md transition-colors group"
    >
      <div className="text-xl mb-2 leading-none">{template.icon}</div>
      <p className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors mb-0.5">
        {localizedName}
      </p>
      <p className="text-[11px] text-neutral-500 leading-relaxed">{localizedDesc}</p>
    </button>
  );
}
