'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Database, LayoutTemplate } from 'lucide-react';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import { updateDatabaseSchema } from '@/lib/actions/database';
import type { DatabaseView, ViewFilter, ViewSort } from '@/lib/types/views';
import PropertiesPanel from './database-sidebar/PropertiesPanel';
import FiltersSection from './database-sidebar/FiltersSection';
import SortsSection from './database-sidebar/SortsSection';
import KanbanLayoutSection from './database-sidebar/KanbanLayoutSection';
import CalendarLayoutSection from './database-sidebar/CalendarLayoutSection';
import { selectCls } from './database-sidebar/shared';

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
  rowColorCol?: string;
  onRowColorColChange?: (colId: string) => void;
  groupColBg?: boolean;
  onGroupColBgChange?: (enabled: boolean) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onDefaultPageIconChange?: (icon: string | null, color: string | null) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
}

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
  rowColorCol,
  onRowColorColChange,
  groupColBg,
  onGroupColBgChange,
  defaultPageIcon,
  defaultPageIconColor,
  onDefaultPageIconChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
}: DatabasePropertiesSidebarProps) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');

  const [schema, setSchema] = useState<any[]>(() => database.schema || []);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [showDefaultIconPicker, setShowDefaultIconPicker] = useState(false);
  const defaultIconBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setSchema(database.schema || []); }, [database.schema]);

  const isSchemaDirty = JSON.stringify(schema) !== JSON.stringify(database.schema);
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select');

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

  const viewType = activeView.config.type;

  return (
    <div className="w-full sm:w-72 sm:shrink-0 bg-neutral-850 sm:border-l border-neutral-800 flex flex-col sm:h-full overflow-y-auto sm:overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-neutral-200">{t('settings')}</span>
          <span className="text-[10px] text-neutral-500 border border-neutral-800 px-1.5 py-0.5 shrink-0 rounded">{activeView.name}</span>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 transition-colors p-1 cursor-pointer ml-2">
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 shrink-0">
        {([
          { id: 'layout',     label: t('layout'),     icon: LayoutTemplate },
          { id: 'properties', label: t('properties'), icon: Database },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === id ? 'border-blue-500 text-white' : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'properties' && (
          <PropertiesPanel
            database={database}
            schema={schema}
            isSavingSchema={isSavingSchema}
            isSchemaDirty={isSchemaDirty}
            onUpdateColumn={updateColumn}
            onRemoveColumn={removeColumn}
            onAddColumn={addColumn}
            onSave={handleSaveSchema}
            onReset={() => setSchema(database.schema || [])}
          />
        )}

        {activeTab === 'layout' && (
          <div className="flex flex-col divide-y divide-neutral-800/60">
            {/* Open behavior */}
            <div className="px-4 py-3">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Open pages as</span>
              <select value={openBehavior} onChange={(e) => onOpenBehaviorChange(e.target.value as 'center' | 'side' | 'full')} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
                <option value="full">{t('openFull')}</option>
                <option value="side">{t('openSide')}</option>
                <option value="center">{t('openCenter')}</option>
              </select>
            </div>

            {/* Default page icon */}
            <div className="px-4 py-3 relative">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">{t('defaultPageIcon')}</span>
              <div className="flex items-center gap-2">
                <button
                  ref={defaultIconBtnRef}
                  onClick={() => setShowDefaultIconPicker(!showDefaultIconPicker)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white transition-colors rounded text-xs cursor-pointer shrink-0 font-medium"
                >
                  <PageIcon icon={defaultPageIcon || null} iconColor={defaultPageIconColor || null} size={14} fallbackType="page" />
                  <span>{defaultPageIcon ? tPage('changeIcon') : tPage('addIcon')}</span>
                </button>
                {defaultPageIcon && (
                  <button onClick={() => onDefaultPageIconChange?.(null, null)} className="text-[10px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer">
                    Remove
                  </button>
                )}
              </div>
              {showDefaultIconPicker && (
                <IconPicker
                  currentIcon={defaultPageIcon || null}
                  currentIconColor={defaultPageIconColor || null}
                  onSelect={(icon, color) => { onDefaultPageIconChange?.(icon, color); setShowDefaultIconPicker(false); }}
                  onClose={() => setShowDefaultIconPicker(false)}
                  anchorRef={defaultIconBtnRef}
                />
              )}
            </div>

            {/* Table: row color */}
            {viewType === 'table' && (
              <div className="px-4 py-3">
                <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-2">Row color</span>
                {colorColumns.length > 0 ? (
                  <select value={rowColorCol ?? ''} onChange={(e) => onRowColorColChange?.(e.target.value)} className={`${selectCls} w-full text-xs py-1.5 px-2`}>
                    <option value="">None</option>
                    {colorColumns.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                ) : (
                  <span className="text-xs text-amber-500/80">{t('addSelectProperty')}</span>
                )}
              </div>
            )}

            {/* Kanban-specific settings */}
            {viewType === 'kanban' && (
              <KanbanLayoutSection
                schema={schema}
                groupByCol={groupByCol}
                onGroupByColChange={onGroupByColChange}
                cardProperties={cardProperties}
                onCardPropertiesChange={onCardPropertiesChange}
                showPropertyLabels={showPropertyLabels}
                onShowPropertyLabelsChange={onShowPropertyLabelsChange}
                propertyTextClamp={propertyTextClamp}
                onPropertyTextClampChange={onPropertyTextClampChange}
                cardColorCol={cardColorCol}
                onCardColorColChange={onCardColorColChange}
                groupColBg={groupColBg}
                onGroupColBgChange={onGroupColBgChange}
                hiddenGroups={hiddenGroups}
                onHiddenGroupsChange={onHiddenGroupsChange}
              />
            )}

            {/* Calendar-specific settings */}
            {viewType === 'calendar' && (
              <CalendarLayoutSection
                schema={schema}
                dateCol={dateCol}
                onDateColChange={onDateColChange}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                firstDayOfWeek={firstDayOfWeek}
                onFirstDayOfWeekChange={onFirstDayOfWeekChange}
                cardColorCol={cardColorCol}
                onCardColorColChange={onCardColorColChange}
                cardProperties={cardProperties}
                onCardPropertiesChange={onCardPropertiesChange}
                showPropertyLabels={showPropertyLabels}
                onShowPropertyLabelsChange={onShowPropertyLabelsChange}
                propertyTextClamp={propertyTextClamp}
                onPropertyTextClampChange={onPropertyTextClampChange}
              />
            )}

            {/* Table: column visibility */}
            {viewType === 'table' && (
              <div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Columns</span>
                  <div className="flex gap-3">
                    <button onClick={() => onHiddenColumnsChange([])} className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer">Show all</button>
                    <button onClick={() => onHiddenColumnsChange(schema.map((c) => c.id).filter((id) => id !== 'title'))} className="text-[10px] text-neutral-500 hover:text-neutral-300 cursor-pointer">Hide all</button>
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
                        className={`flex items-center gap-2 px-4 py-2 border-b border-neutral-800/30 text-left transition-colors ${isTitle ? 'opacity-40 cursor-not-allowed' : 'hover:bg-neutral-800/10 cursor-pointer'}`}
                      >
                        <span className="flex-1 text-xs text-neutral-300 truncate">{col.name}</span>
                        <span className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 transition-colors rounded-sm ${!isHidden ? 'bg-blue-500 border-blue-500' : 'border-neutral-700'}`}>
                          {!isHidden && <span className="text-[8px] font-bold text-white leading-none">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FiltersSection filters={filters} schema={schema} onFiltersChange={onFiltersChange} />
            <SortsSection sorts={sorts} schema={schema} onSortsChange={onSortsChange} />
          </div>
        )}
      </div>
    </div>
  );
}
