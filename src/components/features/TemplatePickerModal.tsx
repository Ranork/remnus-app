'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { TEMPLATES, type TemplateDefinition, type DatabaseTemplateDefinition } from '@/lib/templates';
import { createStandalonePage, createWorkspaceDatabase, switchWorkspace } from '@/lib/actions/workspace';
import { createPage } from '@/lib/actions/page';

interface TemplatePickerModalProps {
  workspaceId: string;
  activeWorkspaceId: string;
  onClose: () => void;
  onCreated: (type: 'page' | 'database', id: string) => void;
  parentId?: string;
}

const BLANK_TEMPLATES = TEMPLATES.filter(t => t.id === 'page-blank' || t.id === 'db-blank');
const OTHER_TEMPLATES = TEMPLATES.filter(t => t.id !== 'page-blank' && t.id !== 'db-blank');

export default function TemplatePickerModal({
  workspaceId,
  activeWorkspaceId,
  onClose,
  onCreated,
  parentId,
}: TemplatePickerModalProps) {
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
    startTransition(async () => {
      if (workspaceId !== activeWorkspaceId) {
        await switchWorkspace(workspaceId);
      }
      if (selectedTemplate.category === 'page') {
        const { itemId } = await createStandalonePage(workspaceId, title.trim(), parentId, {
          initialContent: selectedTemplate.initialContent,
          icon: selectedTemplate.icon,
          iconColor: selectedTemplate.iconColor ?? null,
        });
        onCreated('page', itemId);
      } else {
        const db = selectedTemplate as DatabaseTemplateDefinition;
        const freshViews = db.views.map(v => ({
          ...v,
          id: crypto.randomUUID().slice(0, 8),
        }));
        const { dbId } = await createWorkspaceDatabase(workspaceId, title.trim(), {
          schema: db.schema,
          views: freshViews,
          icon: db.icon,
          iconColor: db.iconColor ?? null,
          parentId,
        });
        if (db.seedRows?.length) {
          for (const row of db.seedRows) {
            await createPage(dbId, row.title, row.properties as Record<string, unknown>);
          }
        }
        onCreated('database', dbId);
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
          className="w-full max-w-2xl bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in"
          style={{ maxHeight: '82vh' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-850 bg-neutral-900/30 shrink-0">
            <h2 className="text-sm font-semibold text-neutral-100">New Item</h2>
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
                Blank
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {BLANK_TEMPLATES.map(template => (
                  <TemplateCard key={template.id} template={template} onClick={() => selectTemplate(template)} />
                ))}
              </div>
            </div>

            {/* Templates group */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-3">
                Templates
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {OTHER_TEMPLATES.map(template => (
                  <TemplateCard key={template.id} template={template} onClick={() => selectTemplate(template)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="w-full max-w-sm bg-neutral-850 border border-neutral-800 rounded-lg shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden animate-scale-in"
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
                {selectedTemplate?.name}
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
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || isPending}
              className="flex items-center gap-1.5 text-sm bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded font-medium transition-colors"
            >
              {isPending && (
                <div className="w-3 h-3 rounded-full border-2 border-white/25 border-t-white animate-spin shrink-0" />
              )}
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onClick,
}: {
  template: TemplateDefinition;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-3.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-600 rounded-md transition-colors group"
    >
      <div className="text-xl mb-2 leading-none">{template.icon}</div>
      <p className="text-xs font-semibold text-neutral-200 group-hover:text-white transition-colors mb-0.5">
        {template.name}
      </p>
      <p className="text-[11px] text-neutral-500 leading-relaxed">{template.description}</p>
    </button>
  );
}
