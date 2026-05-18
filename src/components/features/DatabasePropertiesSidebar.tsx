'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Type,
  List,
  Hash,
  Calendar,
  Clock,
  AlignLeft,
  Tags,
  GripVertical,
  Database,
  LayoutTemplate,
} from 'lucide-react';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import { updateDatabaseSchema } from '@/lib/actions/database';
import {
  type SelectOption,
  type SelectOptionColor,
  normalizeOption,
  getOptionColor,
  SELECT_COLOR_ORDER,
  SELECT_COLORS,
} from '@/lib/types/properties';
import type {
  DatabaseView,
  ViewFilter,
  ViewSort,
  FilterOperator,
} from '@/lib/types/views';

interface DatabasePropertiesSidebarProps {
  database: any;
  activeView: DatabaseView;
  activeTab: 'properties' | 'layout';
  setActiveTab: (tab: 'properties' | 'layout') => void;
  onClose: () => void;
  columnOrder: string[];
  hiddenColumns: string[];
  onToggleHideColumn: (colId: string) => void;
  onHiddenColumnsChange: (hidden: string[]) => void;
  filters: ViewFilter[];
  sorts: ViewSort[];
  onFiltersChange: (filters: ViewFilter[]) => void;
  onSortsChange: (sorts: ViewSort[]) => void;
  openBehavior: 'center' | 'side' | 'full';
  onOpenBehaviorChange: (behavior: 'center' | 'side' | 'full') => void;
  groupByCol?: string;
  onGroupByColChange?: (colId: string) => void;
  cardProperties?: string[];
  onCardPropertiesChange?: (props: string[]) => void;
  showPropertyLabels?: boolean;
  onShowPropertyLabelsChange?: (show: boolean) => void;
  propertyTextClamp?: 'truncate' | 'wrap';
  onPropertyTextClampChange?: (clamp: 'truncate' | 'wrap') => void;
  dateCol?: string;
  onDateColChange?: (colId: string) => void;
  viewMode?: 'month' | 'week';
  onViewModeChange?: (mode: 'month' | 'week') => void;
  firstDayOfWeek?: 'sunday' | 'monday';
  onFirstDayOfWeekChange?: (day: 'sunday' | 'monday') => void;
  cardColorCol?: string;
  onCardColorColChange?: (colId: string) => void;
  groupColBg?: boolean;
  onGroupColBgChange?: (enabled: boolean) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onDefaultPageIconChange?: (icon: string | null, color: string | null) => void;
}

const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: 'contains',     label: 'contains',        needsValue: true  },
  { value: 'not_contains', label: "doesn't contain", needsValue: true  },
  { value: 'equals',       label: 'is',              needsValue: true  },
  { value: 'not_equals',   label: 'is not',          needsValue: true  },
  { value: 'is_empty',     label: 'is empty',        needsValue: false },
  { value: 'is_not_empty', label: 'is not empty',    needsValue: false },
];

function getPropertyIcon(type: string) {
  switch (type) {
    case 'text':         return <Type size={11} className="text-neutral-500 shrink-0" />;
    case 'select':       return <List size={11} className="text-neutral-500 shrink-0" />;
    case 'multi_select': return <Tags size={11} className="text-neutral-500 shrink-0" />;
    case 'number':       return <Hash size={11} className="text-neutral-500 shrink-0" />;
    case 'date':         return <Calendar size={11} className="text-neutral-500 shrink-0" />;
    case 'datetime':     return <Clock size={11} className="text-neutral-500 shrink-0" />;
    default:             return <AlignLeft size={11} className="text-neutral-500 shrink-0" />;
  }
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors rounded-sm ${
      checked ? 'bg-blue-500 border-blue-500' : 'border-neutral-700'
    }`}>
      {checked && <span className="text-[8px] font-bold text-white leading-none">✓</span>}
    </span>
  );
}

const selectCls = 'bg-neutral-900 border border-neutral-800 text-neutral-300 outline-none cursor-pointer focus:border-neutral-700 transition-colors rounded text-xs py-1.5 px-2';

export default function DatabasePropertiesSidebar({
  database,
  activeView,
  activeTab,
  setActiveTab,
  onClose,
  hiddenColumns,
  onToggleHideColumn,
  onHiddenColumnsChange,
  filters,
  sorts,
  onFiltersChange,
  onSortsChange,
  openBehavior,
  onOpenBehaviorChange,
  groupByCol,
  onGroupByColChange,
  cardProperties,
  onCardPropertiesChange,
  showPropertyLabels = true,
  onShowPropertyLabelsChange,
  propertyTextClamp = 'truncate',
  onPropertyTextClampChange,
  dateCol,
  onDateColChange,
  viewMode,
  onViewModeChange,
  firstDayOfWeek,
  onFirstDayOfWeekChange,
  cardColorCol,
  onCardColorColChange,
  groupColBg = false,
  onGroupColBgChange,
  defaultPageIcon,
  defaultPageIconColor,
  onDefaultPageIconChange,
}: DatabasePropertiesSidebarProps) {
  const [schema, setSchema] = useState<any[]>(() => database.schema || []);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [showDefaultIconPicker, setShowDefaultIconPicker] = useState(false);
  const defaultIconBtnRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    setSchema(database.schema || []);
  }, [database.schema]);

  const isSchemaDirty = JSON.stringify(schema) !== JSON.stringify(database.schema);
  const selectColumns = schema.filter((c: any) => c.type === 'select');
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select');
  const dateColumns = schema.filter((c: any) => c.type === 'date' || c.type === 'datetime');

  const addColumn = () =>
    setSchema([...schema, { id: `col_${crypto.randomUUID().slice(0, 8)}`, name: 'New Column', type: 'text', options: [] }]);

  const updateColumn = (index: number, updates: any) => {
    const next = [...schema];
    next[index] = { ...next[index], ...updates };
    setSchema(next);
  };

  const removeColumn = (index: number) => {
    if (schema[index].id === 'title') return;
    const next = [...schema];
    next.splice(index, 1);
    setSchema(next);
  };

  const handleSaveSchema = async () => {
    setIsSavingSchema(true);
    await updateDatabaseSchema(database.id, schema);
    setIsSavingSchema(false);
  };

  const addFilter = () => {
    const col = schema[0];
    if (!col) return;
    onFiltersChange([...filters, { id: crypto.randomUUID(), columnId: col.id, operator: 'contains', value: '' }]);
  };
  const updateFilter = (id: string, patch: Partial<ViewFilter>) =>
    onFiltersChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const deleteFilter = (id: string) =>
    onFiltersChange(filters.filter((f) => f.id !== id));

  const addSort = () => {
    const usedIds = new Set(sorts.map((s) => s.columnId));
    const col = schema.find((c) => !usedIds.has(c.id));
    if (!col) return;
    onSortsChange([...sorts, { id: crypto.randomUUID(), columnId: col.id, direction: 'asc' }]);
  };
  const updateSort = (id: string, patch: Partial<ViewSort>) =>
    onSortsChange(sorts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const deleteSort = (id: string) =>
    onSortsChange(sorts.filter((s) => s.id !== id));

  const handleShowAll = () => onHiddenColumnsChange([]);
  const handleHideAll = () =>
    onHiddenColumnsChange(schema.map((c) => c.id).filter((id) => id !== 'title'));

  const [draggingCardProp, setDraggingCardProp] = useState<string | null>(null);
  const [dragOverCardProp, setDragOverCardProp] = useState<string | null>(null);

  const availableCardProps = schema.filter((c: any) => c.id !== 'title' && c.id !== groupByCol);
  const effectiveVisible: string[] =
    cardProperties !== undefined
      ? cardProperties.filter((id) => availableCardProps.some((c: any) => c.id === id))
      : availableCardProps.slice(0, 2).map((c: any) => c.id);

  const visibleCardProps = effectiveVisible
    .map((id) => availableCardProps.find((c: any) => c.id === id))
    .filter(Boolean) as any[];
  const hiddenCardProps = availableCardProps.filter((c: any) => !effectiveVisible.includes(c.id));

  const toggleCardProp = (colId: string) => {
    if (effectiveVisible.includes(colId)) {
      onCardPropertiesChange?.(effectiveVisible.filter((id) => id !== colId));
    } else {
      onCardPropertiesChange?.([...effectiveVisible, colId]);
    }
  };

  const handleCardPropDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggingCardProp && draggingCardProp !== colId) setDragOverCardProp(colId);
  };

  const handleCardPropDrop = (targetColId: string) => {
    if (!draggingCardProp || draggingCardProp === targetColId) return;
    const current = [...effectiveVisible];
    const fromIdx = current.indexOf(draggingCardProp);
    const toIdx = current.indexOf(targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      onCardPropertiesChange?.(current);
    }
    setDraggingCardProp(null);
    setDragOverCardProp(null);
  };

  // Calendar card props
  const [draggingCalProp, setDraggingCalProp] = useState<string | null>(null);
  const [dragOverCalProp, setDragOverCalProp] = useState<string | null>(null);

  const calAvailableCardProps = schema.filter((c: any) => c.id !== 'title' && c.id !== dateCol);
  const effectiveCalVisible: string[] =
    cardProperties !== undefined
      ? cardProperties.filter((id) => calAvailableCardProps.some((c: any) => c.id === id))
      : calAvailableCardProps.slice(0, 1).map((c: any) => c.id);

  const visibleCalCardProps = effectiveCalVisible
    .map((id) => calAvailableCardProps.find((c: any) => c.id === id))
    .filter(Boolean) as any[];
  const hiddenCalCardProps = calAvailableCardProps.filter((c: any) => !effectiveCalVisible.includes(c.id));

  const toggleCalCardProp = (colId: string) => {
    if (effectiveCalVisible.includes(colId)) {
      onCardPropertiesChange?.(effectiveCalVisible.filter((id) => id !== colId));
    } else {
      onCardPropertiesChange?.([...effectiveCalVisible, colId]);
    }
  };

  const handleCalPropDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggingCalProp && draggingCalProp !== colId) setDragOverCalProp(colId);
  };

  const handleCalPropDrop = (targetColId: string) => {
    if (!draggingCalProp || draggingCalProp === targetColId) return;
    const current = [...effectiveCalVisible];
    const fromIdx = current.indexOf(draggingCalProp);
    const toIdx = current.indexOf(targetColId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = current.splice(fromIdx, 1);
      current.splice(toIdx, 0, moved);
      onCardPropertiesChange?.(current);
    }
    setDraggingCalProp(null);
    setDragOverCalProp(null);
  };

  return (
    <div className="w-72 shrink-0 bg-neutral-900 border-l border-neutral-800 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-neutral-200">Settings</span>
          <span className="text-[10px] text-neutral-500 border border-neutral-800 px-1.5 py-0.5 shrink-0 rounded">
            {activeView.name}
          </span>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer ml-2">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 shrink-0">
        {([
          { id: 'layout',     label: 'Layout',     icon: LayoutTemplate },
          { id: 'properties', label: 'Properties', icon: Database },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── PROPERTIES TAB ── */}
        {activeTab === 'properties' && (
          <div className="flex flex-col">
            {schema.map((col, idx) => {
              const isTitle = col.id === 'title';
              return (
                <div key={col.id}>
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800/50 hover:bg-neutral-800/10 group transition-colors">
                    <GripVertical size={11} className={`shrink-0 ${isTitle ? 'invisible' : 'text-neutral-700 cursor-grab'}`} />
                    {getPropertyIcon(col.type)}
                    <input
                      type="text"
                      value={col.name}
                      onChange={(e) => updateColumn(idx, { name: e.target.value })}
                      disabled={isTitle}
                      placeholder="Property name"
                      className="flex-1 min-w-0 bg-transparent text-xs text-neutral-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => updateColumn(idx, { type: e.target.value, options: [] })}
                      disabled={isTitle}
                      className={`${selectCls} text-neutral-400 py-1 px-1.5 shrink-0 disabled:opacity-40 w-28 cursor-pointer truncate`}
                    >
                      <option value="text">Text</option>
                      <option value="select">Select</option>
                      <option value="multi_select">Multi</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="datetime">DateTime</option>
                    </select>
                    {!isTitle ? (
                      <button
                        onClick={() => removeColumn(idx)}
                        className="text-neutral-500 hover:text-red-400 p-0.5 transition-colors cursor-pointer shrink-0"
                      >
                        <X size={12} />
                      </button>
                    ) : (
                      <span className="w-5 shrink-0" />
                    )}
                  </div>

                  {(col.type === 'date' || col.type === 'datetime') && (
                    <div className="pl-10 pr-3 py-2 bg-neutral-900/30 border-b border-neutral-800/50 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Date format</span>
                        <div className="flex items-center gap-2">
                          <select
                            value={col.dateFormat || 'default'}
                            onChange={(e) => updateColumn(idx, { dateFormat: e.target.value })}
                            className={`${selectCls} text-neutral-400 py-1 px-1.5 cursor-pointer w-28 truncate`}
                          >
                            <option value="default">Month Day, Year</option>
                            <option value="iso">YYYY-MM-DD</option>
                            <option value="uk">DD/MM/YYYY</option>
                            <option value="us">MM/DD/YYYY</option>
                            <option value="relative">Relative time</option>
                          </select>
                          <span className="w-5 shrink-0" />
                        </div>
                      </div>
                    </div>
                  )}

                  {(col.type === 'select' || col.type === 'multi_select') && (
                    <div className="pl-10 pr-3 py-2 bg-neutral-900/30 border-b border-neutral-800/50">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {(col.options || []).map((rawOpt: string | SelectOption, optIdx: number) => {
                          const opt = normalizeOption(rawOpt);
                          const c = getOptionColor(opt);
                          const pickerKey = `${idx}-${optIdx}`;
                          return (
                            <span key={optIdx} className="relative flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 border border-neutral-700/30 rounded" style={{ backgroundColor: c.bg, color: c.text }}>
                              <button
                                title="Change color"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setColorPickerOpen(colorPickerOpen === pickerKey ? null : pickerKey);
                                }}
                                className="w-2.5 h-2.5 rounded-full shrink-0 mr-0.5 cursor-pointer border border-white/10 hover:scale-110 transition-transform"
                                style={{ backgroundColor: c.dot }}
                              />
                              {opt.value}
                              <button
                                onClick={() => {
                                  const newOpts = [...(col.options || [])];
                                  newOpts.splice(optIdx, 1);
                                  updateColumn(idx, { options: newOpts });
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
                                            i === optIdx
                                              ? { ...normalizeOption(o), color: colorKey as SelectOptionColor }
                                              : o,
                                          );
                                          updateColumn(idx, { options: newOpts });
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
                        placeholder="Add option…"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.currentTarget.value.trim();
                            const existing = (col.options || []).map((o: string | SelectOption) => normalizeOption(o).value);
                            if (val && !existing.includes(val)) {
                              const newOpt: SelectOption = { value: val, color: 'default' };
                              updateColumn(idx, { options: [...(col.options || []), newOpt] });
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
              onClick={addColumn}
              className="flex items-center gap-1.5 px-4 py-2.5 w-full text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/10 transition-colors text-left cursor-pointer border-b border-neutral-800/50"
            >
              <Plus size={12} />
              Add property
            </button>

            {isSchemaDirty && (
              <div className="sticky bottom-0 flex items-center justify-end gap-2 px-4 py-2.5 bg-neutral-900 border-t border-neutral-800">
                <button
                  onClick={() => setSchema(database.schema || [])}
                  disabled={isSavingSchema}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={handleSaveSchema}
                  disabled={isSavingSchema}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSavingSchema ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── LAYOUT TAB ── */}
        {activeTab === 'layout' && (
          <div className="flex flex-col divide-y divide-neutral-800/60">

            {/* Open behavior */}
            <div className="px-4 py-3">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Open pages as</span>
              <select
                value={openBehavior}
                onChange={(e) => onOpenBehaviorChange(e.target.value as 'center' | 'side' | 'full')}
                className={`${selectCls} w-full text-xs py-1.5 px-2`}
              >
                <option value="full">Full page</option>
                <option value="side">Side peek</option>
                <option value="center">Center peek</option>
              </select>
            </div>

            {/* Default Page Icon */}
            <div className="px-4 py-3 relative">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Default page icon</span>
              <div className="flex items-center gap-2">
                <button
                  ref={defaultIconBtnRef}
                  onClick={() => setShowDefaultIconPicker(!showDefaultIconPicker)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors rounded text-xs cursor-pointer shrink-0 font-medium"
                >
                  <PageIcon 
                    icon={defaultPageIcon || null} 
                    iconColor={defaultPageIconColor || null} 
                    size={14} 
                    fallbackType="page" 
                  />
                  <span>{defaultPageIcon ? 'Change icon' : 'Choose icon'}</span>
                </button>
                {defaultPageIcon && (
                  <button
                    onClick={() => onDefaultPageIconChange?.(null, null)}
                    className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              {showDefaultIconPicker && (
                <IconPicker
                  currentIcon={defaultPageIcon || null}
                  currentIconColor={defaultPageIconColor || null}
                  onSelect={(icon, color) => {
                    onDefaultPageIconChange?.(icon, color);
                    setShowDefaultIconPicker(false);
                  }}
                  onClose={() => setShowDefaultIconPicker(false)}
                  anchorRef={defaultIconBtnRef}
                />
              )}
            </div>

            {/* Kanban: Group by */}
            {activeView.config.type === 'kanban' && (
              <div className="px-4 py-3">
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Group by</span>
                {selectColumns.length > 0 ? (
                  <select
                    value={groupByCol}
                    onChange={(e) => onGroupByColChange?.(e.target.value)}
                    className={`${selectCls} w-full text-xs py-1.5 px-2`}
                  >
                    {selectColumns.map((col: any) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-amber-500/80">Add a Select property to enable grouping</span>
                )}
              </div>
            )}

            {/* Kanban: Card properties */}
            {activeView.config.type === 'kanban' && (
              <div>
                <div className="px-4 py-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Card properties</span>
                </div>
                {availableCardProps.length === 0 ? (
                  <p className="text-[11px] text-neutral-700 text-center pb-3">No additional properties.</p>
                ) : (
                  <div className="flex flex-col">
                    {visibleCardProps.map((col) => (
                      <div
                        key={col.id}
                        draggable
                        onDragStart={() => setDraggingCardProp(col.id)}
                        onDragOver={(e) => handleCardPropDragOver(e, col.id)}
                        onDrop={() => handleCardPropDrop(col.id)}
                        onDragEnd={() => { setDraggingCardProp(null); setDragOverCardProp(null); }}
                        className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-default ${
                          draggingCardProp === col.id ? 'opacity-30' : ''
                        } ${dragOverCardProp === col.id ? 'border-t-2 border-t-blue-500/50' : ''}`}
                      >
                        <GripVertical size={11} className="text-neutral-600 cursor-grab shrink-0" />
                        {getPropertyIcon(col.type)}
                        <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                        <button onClick={() => toggleCardProp(col.id)} className="cursor-pointer">
                          <Checkbox checked={true} />
                        </button>
                      </div>
                    ))}
                    {hiddenCardProps.map((col: any) => (
                      <button
                        key={col.id}
                        onClick={() => toggleCardProp(col.id)}
                        className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left"
                      >
                        <span className="w-[11px] shrink-0" />
                        {getPropertyIcon(col.type)}
                        <span className="flex-1 text-xs text-neutral-500 truncate">{col.name}</span>
                        <Checkbox checked={false} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Kanban: Show labels + text wrap */}
            {activeView.config.type === 'kanban' && (
              <div>
                <button
                  onClick={() => onShowPropertyLabelsChange?.(!showPropertyLabels)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer border-b border-neutral-800/30"
                >
                  <span className="text-xs text-neutral-300">Show property labels</span>
                  <Checkbox checked={showPropertyLabels} />
                </button>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-neutral-300">Property text</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={propertyTextClamp}
                      onChange={(e) => onPropertyTextClampChange?.(e.target.value as 'truncate' | 'wrap')}
                      className={`${selectCls} text-neutral-400 py-1 px-1.5 w-28 cursor-pointer truncate`}
                    >
                      <option value="truncate">Single line</option>
                      <option value="wrap">Multi-line</option>
                    </select>
                    <span className="w-5 shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* Kanban: Card color */}
            {activeView.config.type === 'kanban' && (
              <div className="px-4 py-3 border-b border-neutral-800/30 flex items-center justify-between gap-3">
                <span className="text-xs text-neutral-300 shrink-0">Card color</span>
                <div className="flex items-center gap-2">
                  <select
                    value={cardColorCol ?? ''}
                    onChange={(e) => onCardColorColChange?.(e.target.value)}
                    className={`${selectCls} text-neutral-400 py-1 px-1.5 w-28 shrink-0 cursor-pointer truncate`}
                  >
                    <option value="">None</option>
                    {colorColumns.map((col: any) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                  <span className="w-5 shrink-0" />
                </div>
              </div>
            )}

            {/* Kanban: Group column background */}
            {activeView.config.type === 'kanban' && (
              <button
                onClick={() => onGroupColBgChange?.(!groupColBg)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer border-b border-neutral-800/30"
              >
                <span className="text-xs text-neutral-300">Group background color</span>
                <Checkbox checked={groupColBg} />
              </button>
            )}

            {/* Calendar settings */}
            {activeView.config.type === 'calendar' && (
              <div className="px-4 py-3 flex flex-col gap-3">
                <div>
                  <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Date property</span>
                  {dateColumns.length > 0 ? (
                    <select
                      value={dateCol}
                      onChange={(e) => onDateColChange?.(e.target.value)}
                      className={`${selectCls} w-full text-xs py-1.5 px-2`}
                    >
                      <option value="">Select property…</option>
                      {dateColumns.map((col: any) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-amber-500/80">Add a Date property to enable calendar</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">View</span>
                    <select
                      value={viewMode}
                      onChange={(e) => onViewModeChange?.(e.target.value as 'month' | 'week')}
                      className={`${selectCls} w-full text-xs py-1.5 px-2`}
                    >
                      <option value="month">Month</option>
                      <option value="week">Week</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Week starts</span>
                    <select
                      value={firstDayOfWeek || 'sunday'}
                      onChange={(e) => onFirstDayOfWeekChange?.(e.target.value as 'sunday' | 'monday')}
                      className={`${selectCls} w-full text-xs py-1.5 px-2`}
                    >
                      <option value="sunday">Sunday</option>
                      <option value="monday">Monday</option>
                    </select>
                  </div>
                </div>
                {colorColumns.length > 0 && (
                  <div>
                    <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1.5">Card color</span>
                    <select
                      value={cardColorCol ?? ''}
                      onChange={(e) => onCardColorColChange?.(e.target.value)}
                      className={`${selectCls} w-full text-xs py-1.5 px-2`}
                    >
                      <option value="">None</option>
                      {colorColumns.map((col: any) => (
                        <option key={col.id} value={col.id}>{col.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Calendar: Card properties */}
            {activeView.config.type === 'calendar' && (
              <div>
                <div className="px-4 py-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Card properties</span>
                </div>
                {calAvailableCardProps.length === 0 ? (
                  <p className="text-[11px] text-neutral-700 text-center pb-3">No additional properties.</p>
                ) : (
                  <div className="flex flex-col">
                    {visibleCalCardProps.map((col) => (
                      <div
                        key={col.id}
                        draggable
                        onDragStart={() => setDraggingCalProp(col.id)}
                        onDragOver={(e) => handleCalPropDragOver(e, col.id)}
                        onDrop={() => handleCalPropDrop(col.id)}
                        onDragEnd={() => { setDraggingCalProp(null); setDragOverCalProp(null); }}
                        className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-default ${
                          draggingCalProp === col.id ? 'opacity-30' : ''
                        } ${dragOverCalProp === col.id ? 'border-t-2 border-t-blue-500/50' : ''}`}
                      >
                        <GripVertical size={11} className="text-neutral-600 cursor-grab shrink-0" />
                        {getPropertyIcon(col.type)}
                        <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                        <button onClick={() => toggleCalCardProp(col.id)} className="cursor-pointer">
                          <Checkbox checked={true} />
                        </button>
                      </div>
                    ))}
                    {hiddenCalCardProps.map((col: any) => (
                      <button
                        key={col.id}
                        onClick={() => toggleCalCardProp(col.id)}
                        className="flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 hover:bg-neutral-800/10 transition-colors cursor-pointer text-left"
                      >
                        <span className="w-2.75 shrink-0" />
                        {getPropertyIcon(col.type)}
                        <span className="flex-1 text-xs text-neutral-500 truncate">{col.name}</span>
                        <Checkbox checked={false} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Calendar: Show labels + text wrap */}
            {activeView.config.type === 'calendar' && (
              <div>
                <button
                  onClick={() => onShowPropertyLabelsChange?.(!showPropertyLabels)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800/10 transition-colors cursor-pointer border-b border-neutral-800/30"
                >
                  <span className="text-xs text-neutral-300">Show property labels</span>
                  <Checkbox checked={showPropertyLabels} />
                </button>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-neutral-300">Property text</span>
                  <div className="flex items-center gap-2">
                    <select
                      value={propertyTextClamp}
                      onChange={(e) => onPropertyTextClampChange?.(e.target.value as 'truncate' | 'wrap')}
                      className={`${selectCls} text-neutral-400 py-1 px-1.5 w-28 cursor-pointer truncate`}
                    >
                      <option value="truncate">Single line</option>
                      <option value="wrap">Multi-line</option>
                    </select>
                    <span className="w-5 shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {/* Table: Columns visibility */}
            {activeView.config.type === 'table' && (
              <div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Columns</span>
                  <div className="flex gap-3">
                    <button onClick={handleShowAll} className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">Show all</button>
                    <button onClick={handleHideAll} className="text-[10px] text-neutral-500 hover:text-neutral-300 cursor-pointer">Hide all</button>
                  </div>
                </div>
                <div className="flex flex-col">
                  {schema.map((col) => {
                    const isHidden = hiddenColumns.includes(col.id);
                    const isTitle = col.id === 'title';
                    return (
                      <button
                        key={col.id}
                        onClick={() => !isTitle && onToggleHideColumn(col.id)}
                        disabled={isTitle}
                        className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 text-left transition-colors ${
                          isTitle ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-800/10 cursor-pointer'
                        }`}
                      >
                        {getPropertyIcon(col.type)}
                        <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                        <Checkbox checked={!isHidden} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filters */}
            <div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Filters{filters.length > 0 && ` (${filters.length})`}
                </span>
                <button onClick={addFilter} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                  <Plus size={10} /> Add
                </button>
              </div>
              {filters.length === 0 ? (
                <p className="text-[11px] text-neutral-700 text-center py-4">No filters applied.</p>
              ) : (
                <div className="flex flex-col">
                  {filters.map((filter) => {
                    const opDef = OPERATORS.find((o) => o.value === filter.operator);
                    return (
                      <div key={filter.id} className="px-4 py-2.5 border-b border-neutral-800/40 flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={filter.columnId}
                            onChange={(e) => updateFilter(filter.id, { columnId: e.target.value })}
                            className={`${selectCls} flex-1 min-w-0`}
                          >
                            {schema.map((col) => (
                              <option key={col.id} value={col.id}>{col.name}</option>
                            ))}
                          </select>
                          <select
                            value={filter.operator}
                            onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
                            className={`${selectCls} flex-1 min-w-0`}
                          >
                            {OPERATORS.map((op) => (
                              <option key={op.value} value={op.value}>{op.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => deleteFilter(filter.id)}
                            className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer shrink-0 p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        {opDef?.needsValue && (
                          <input
                            type="text"
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                            placeholder="Value…"
                            className={`${selectCls} w-full focus:border-neutral-700`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sorts */}
            <div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Sorts{sorts.length > 0 && ` (${sorts.length})`}
                </span>
                <button onClick={addSort} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">
                  <Plus size={10} /> Add
                </button>
              </div>
              {sorts.length === 0 ? (
                <p className="text-[11px] text-neutral-700 text-center py-4">No sorts applied.</p>
              ) : (
                <div className="flex flex-col">
                  {sorts.map((sort) => (
                    <div key={sort.id} className="flex items-center gap-1.5 px-4 py-2.5 border-b border-neutral-800/40">
                      <select
                        value={sort.columnId}
                        onChange={(e) => updateSort(sort.id, { columnId: e.target.value })}
                        className={`${selectCls} flex-1 min-w-0`}
                      >
                        {schema.map((col) => (
                          <option key={col.id} value={col.id}>{col.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => updateSort(sort.id, { direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
                        className={`${selectCls} shrink-0 hover:bg-neutral-800 transition-colors`}
                      >
                        {sort.direction === 'asc' ? 'A → Z' : 'Z → A'}
                      </button>
                      <button
                        onClick={() => deleteSort(sort.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer p-0.5 shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
