'use client';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Plus, GripVertical, Smile, Star } from 'lucide-react';
import {
  type SelectOption,
  type SelectOptionColor,
  type StatusGroup,
  normalizeOption,
  getOptionColor,
  getStatusGroup,
  SELECT_COLOR_ORDER,
  SELECT_COLORS,
  STATUS_GROUP_DEFAULT_COLOR,
  DEFAULT_STATUS_OPTIONS,
} from '@/lib/types/properties';
import { getPropertyIcon } from './shared';
import { SimpleSelect } from '@/components/ui/select';
import PageIcon from '../PageIcon';
import IconPicker from '../IconPicker';

interface PropertiesPanelProps {
  database: any;
  schema: any[];
  isSavingSchema: boolean;
  isSchemaDirty: boolean;
  onUpdateColumn: (index: number, updates: any) => void;
  onRemoveColumn: (index: number) => void;
  onAddColumn: () => void;
  onSave: () => void;
  onReset: () => void;
}

export default function PropertiesPanel({
  schema,
  isSavingSchema,
  isSchemaDirty,
  onUpdateColumn,
  onRemoveColumn,
  onAddColumn,
  onSave,
  onReset,
}: PropertiesPanelProps) {
  const t = useTranslations('Database');
  const tWs = useTranslations('Workspace');

  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerOpen]);

  const [iconPickerOpen, setIconPickerOpen] = useState<string | null>(null);
  const iconBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  return (
    <div className="flex flex-col">
      {schema.map((col, idx) => {
        const isTitle = col.id === 'title';
        const isIdColumn = col.type === 'id';
        return (
          <div key={col.id}>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800/50 hover:bg-neutral-800/10 group transition-colors">
              <GripVertical size={11} className={`shrink-0 ${isTitle ? 'invisible' : 'text-neutral-700 cursor-grab'}`} />
              {getPropertyIcon(col.type)}
              <input
                type="text"
                value={col.name}
                onChange={(e) => onUpdateColumn(idx, { name: e.target.value })}
                disabled={isTitle}
                placeholder={t('propertyName')}
                className="flex-1 min-w-0 bg-transparent text-xs text-neutral-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <SimpleSelect
                value={col.type}
                onValueChange={(nextType) => {
                  // Seed sensible defaults so the new type is usable immediately.
                  const options = nextType === 'status' ? DEFAULT_STATUS_OPTIONS : [];
                  onUpdateColumn(idx, { type: nextType, options, defaultValue: undefined });
                }}
                disabled={isTitle || isIdColumn}
                size="sm"
                className="w-28 text-neutral-400"
                options={[
                  ...(isIdColumn ? [{ value: 'id', label: t('typeId') }] : []),
                  { value: 'text', label: t('typeText') },
                  { value: 'select', label: t('typeSelect') },
                  { value: 'multi_select', label: t('typeMultiSelect') },
                  { value: 'status', label: t('typeStatus') },
                  { value: 'user', label: t('typeUser') },
                  { value: 'multi_user', label: t('typeMultiUser') },
                  { value: 'number', label: t('typeNumber') },
                  { value: 'date', label: t('typeDate') },
                  { value: 'datetime', label: t('typeDateTime') },
                  { value: 'checkbox', label: t('typeCheckbox') },
                  { value: 'url', label: t('typeUrl') },
                  { value: 'email', label: t('typeEmail') },
                  { value: 'phone', label: t('typePhone') },
                ]}
              />
              {!isTitle ? (
                <button onClick={() => onRemoveColumn(idx)} className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer shrink-0">
                  <X size={12} />
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
            </div>

            {(col.type === 'date' || col.type === 'datetime') && (
              <div className="pl-10 pr-3 py-2 bg-neutral-900/30 border-b border-neutral-800/50 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{t('dateFormat')}</span>
                  <div className="flex items-center gap-2">
                    <SimpleSelect
                      value={col.dateFormat || 'default'}
                      onValueChange={(v) => onUpdateColumn(idx, { dateFormat: v })}
                      size="sm"
                      className="w-28 text-neutral-400"
                      aria-label={t('dateFormat')}
                      options={[
                        { value: 'default', label: t('dateFormatDefault') },
                        { value: 'iso', label: t('dateFormatISO') },
                        { value: 'uk', label: t('dateFormatUK') },
                        { value: 'us', label: t('dateFormatUS') },
                        { value: 'relative', label: t('dateFormatRelative') },
                      ]}
                    />
                    <span className="w-5 shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {(col.type === 'select' || col.type === 'multi_select' || col.type === 'status') && (
              <div className="pl-10 pr-3 py-2 bg-neutral-900/30 border-b border-neutral-800/50">
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {(col.options || []).map((rawOpt: string | SelectOption, optIdx: number) => {
                    const opt = normalizeOption(rawOpt);
                    const c = getOptionColor(opt);
                    const pickerKey = `${idx}-${optIdx}`;
                    return (
                      <span key={optIdx} className="relative flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 border border-neutral-700/30 rounded" style={{ backgroundColor: c.bg, color: c.text }}>
                        <button
                          ref={(el) => { if (el) iconBtnRefs.current.set(pickerKey, el); else iconBtnRefs.current.delete(pickerKey); }}
                          title="Icon"
                          onClick={(e) => { e.stopPropagation(); setIconPickerOpen(iconPickerOpen === pickerKey ? null : pickerKey); }}
                          className="w-3 h-3 flex items-center justify-center shrink-0 mr-0.5 cursor-pointer opacity-70 hover:opacity-100"
                        >
                          {opt.icon
                            ? <PageIcon icon={opt.icon} iconColor={opt.color} size={11} hideFallback />
                            : <Smile size={10} />}
                        </button>
                        {iconPickerOpen === pickerKey && (
                          <IconPicker
                            currentIcon={opt.icon ?? null}
                            currentIconColor={opt.color ?? 'default'}
                            onSelect={(newIcon, newIconColor) => {
                              const newOpts = [...(col.options || [])].map((o: string | SelectOption, i: number) => {
                                if (i !== optIdx) return o;
                                const base: SelectOption = { ...normalizeOption(o), icon: newIcon ?? undefined };
                                // A lucide icon carries its own color choice from the picker — keep
                                // the chip color in sync so the icon and its background match.
                                if (newIcon?.startsWith('lucide:') && newIconColor) {
                                  base.color = newIconColor as SelectOptionColor;
                                }
                                return base;
                              });
                              onUpdateColumn(idx, { options: newOpts });
                            }}
                            onClose={() => setIconPickerOpen(null)}
                            anchorRef={{ current: iconBtnRefs.current.get(pickerKey) ?? null }}
                          />
                        )}
                        <button
                          title="Change color"
                          onClick={(e) => { e.stopPropagation(); setColorPickerOpen(colorPickerOpen === pickerKey ? null : pickerKey); }}
                          className="w-2.5 h-2.5 rounded-full shrink-0 mr-0.5 cursor-pointer border border-white/10 hover:scale-110 transition-transform"
                          style={{ backgroundColor: c.dot }}
                        />
                        <input
                          type="text"
                          value={opt.value}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            const newOpts = [...(col.options || [])].map((o: string | SelectOption, i: number) =>
                              i === optIdx ? { ...normalizeOption(o), value: newVal } : o,
                            );
                            const updates: any = { options: newOpts };
                            if (col.defaultValue === opt.value) updates.defaultValue = newVal;
                            onUpdateColumn(idx, updates);
                          }}
                          className="bg-transparent border-none focus:outline-none focus:bg-white/10 px-0.5 rounded text-[10px] py-0 font-medium cursor-text"
                          style={{ color: c.text, width: `${Math.max(30, opt.value.length * 6 + 8)}px`, minWidth: '24px' }}
                        />
                        {col.type === 'status' && (
                          <SimpleSelect
                            value={getStatusGroup(opt)}
                            stopPropagation
                            onValueChange={(v) => {
                              const group = v as StatusGroup;
                              const newOpts = [...(col.options || [])].map((o: string | SelectOption, i: number) =>
                                i === optIdx ? { ...normalizeOption(o), group } : o,
                              );
                              onUpdateColumn(idx, { options: newOpts });
                            }}
                            size="xs"
                            className="ml-0.5 h-4 min-w-0 border-none bg-black/20 px-0.5 text-[9px] font-normal hover:border-transparent"
                            style={{ color: c.text }}
                            title={t('statusGroup')}
                            aria-label={t('statusGroup')}
                            options={[
                              { value: 'todo', label: t('statusGroupTodo') },
                              { value: 'in_progress', label: t('statusGroupInProgress') },
                              { value: 'complete', label: t('statusGroupComplete') },
                            ]}
                          />
                        )}
                        {col.type !== 'multi_select' && (
                          <button
                            onClick={() => {
                              const isDefault = col.defaultValue === opt.value;
                              onUpdateColumn(idx, { defaultValue: isDefault ? undefined : opt.value });
                            }}
                            title={t('setAsDefaultOption')}
                            className="ml-0.5 cursor-pointer shrink-0"
                            style={{ color: c.text, opacity: col.defaultValue === opt.value ? 1 : 0.35 }}
                          >
                            <Star size={9} fill={col.defaultValue === opt.value ? 'currentColor' : 'none'} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const newOpts = [...(col.options || [])];
                            newOpts.splice(optIdx, 1);
                            const updates: any = { options: newOpts };
                            if (col.defaultValue === opt.value) updates.defaultValue = undefined;
                            onUpdateColumn(idx, updates);
                          }}
                          className="ml-0.5 cursor-pointer opacity-60 hover:opacity-100"
                          style={{ color: c.text }}
                        >
                          <X size={8} />
                        </button>

                        {colorPickerOpen === pickerKey && (
                          <div
                            ref={colorPickerRef}
                            className="absolute z-50 top-full left-0 mt-1 p-1.5 bg-neutral-900 border border-neutral-700 flex flex-wrap gap-1 rounded shadow-xl overflow-hidden"
                            style={{ width: 110 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {SELECT_COLOR_ORDER.map((colorKey) => {
                              const cc = SELECT_COLORS[colorKey as SelectOptionColor];
                              const isActive = (opt.color ?? 'default') === colorKey;
                              return (
                                <button
                                  key={colorKey}
                                  title={colorKey}
                                  onClick={() => {
                                    const newOpts = [...(col.options || [])].map((o: string | SelectOption, i: number) =>
                                      i === optIdx ? { ...normalizeOption(o), color: colorKey as SelectOptionColor } : o,
                                    );
                                    onUpdateColumn(idx, { options: newOpts });
                                    setColorPickerOpen(null);
                                  }}
                                  className={`w-5 h-5 rounded-full border cursor-pointer hover:scale-110 transition-transform ${isActive ? 'border-white/60 ring-1 ring-white/30' : 'border-white/10'}`}
                                  style={{ backgroundColor: cc.dot }}
                                />
                              );
                            })}
                          </div>
                        )}
                      </span>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder={t('addOption')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.currentTarget.value.trim();
                      const existing = (col.options || []).map((o: string | SelectOption) => normalizeOption(o).value);
                      if (val && !existing.includes(val)) {
                        const newOpt: SelectOption = col.type === 'status'
                          ? { value: val, color: STATUS_GROUP_DEFAULT_COLOR.todo, group: 'todo' }
                          : { value: val, color: 'default' };
                        onUpdateColumn(idx, { options: [...(col.options || []), newOpt] });
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                  className="w-full bg-transparent text-[10px] text-neutral-400 placeholder-neutral-600 focus:outline-none focus:text-neutral-200 transition-colors"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={onAddColumn}
        className="flex items-center gap-1.5 px-4 py-2.5 w-full text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/10 transition-colors text-left cursor-pointer border-b border-neutral-800/50"
      >
        <Plus size={12} />
        {t('addProperty')}
      </button>

      {isSchemaDirty && (
        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-4 py-2.5 bg-neutral-850 border-t border-neutral-800">
          <button onClick={onReset} disabled={isSavingSchema} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer">
            {tWs('cancel')}
          </button>
          <button onClick={onSave} disabled={isSavingSchema} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer">
            {isSavingSchema ? tWs('saving') : tWs('save')}
          </button>
        </div>
      )}
    </div>
  );
}
