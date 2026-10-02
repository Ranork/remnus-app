'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X, Database, LayoutTemplate } from 'lucide-react';
import { CollapsibleSection, ToggleRow } from './database-sidebar/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import PageIcon from './PageIcon';
import { IconPicker } from './lazyDialogs';
import { updateDatabaseSchema } from '@/lib/actions/database';
import type { DatabaseView, ViewFilter, ViewSort } from '@/lib/types/views';
import PropertiesPanel from './database-sidebar/PropertiesPanel';
import FiltersSection from './database-sidebar/FiltersSection';
import SortsSection from './database-sidebar/SortsSection';
import KanbanLayoutSection from './database-sidebar/KanbanLayoutSection';
import CalendarLayoutSection from './database-sidebar/CalendarLayoutSection';
import GroupingLayoutSection from './database-sidebar/GroupingLayoutSection';
import { SimpleSelect } from '@/components/ui/select';

interface DatabasePropertiesSidebarProps {
  database: any;
  onSchemaChange?: (schema: any[]) => void;
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
  cardMarkCol?: string;
  onCardMarkColChange?: (colId: string) => void;
  rowColorCol?: string;
  onRowColorColChange?: (colId: string) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onDefaultPageIconChange?: (icon: string | null, color: string | null) => void;
  hiddenGroups?: string[];
  onHiddenGroupsChange?: (hidden: string[]) => void;
}

export default function DatabasePropertiesSidebar({
  database,
  onSchemaChange,
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
  cardMarkCol,
  onCardMarkColChange,
  rowColorCol,
  onRowColorColChange,
  defaultPageIcon,
  defaultPageIconColor,
  onDefaultPageIconChange,
  hiddenGroups = [],
  onHiddenGroupsChange,
}: DatabasePropertiesSidebarProps) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const tUi = useTranslations('UI');

  const [schema, setSchema] = useState<any[]>(() => database.schema || []);
  const [isSavingSchema, setIsSavingSchema] = useState(false);
  const [showDefaultIconPicker, setShowDefaultIconPicker] = useState(false);
  const defaultIconBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setSchema(database.schema || []); }, [database.schema]);

  const isSchemaDirty = JSON.stringify(schema) !== JSON.stringify(database.schema);
  const colorColumns = schema.filter((c: any) => c.type === 'select' || c.type === 'multi_select' || c.type === 'status');

  const addColumn = () =>
    setSchema([...schema, { id: `col_${crypto.randomUUID().slice(0, 8)}`, name: t('newProperty'), type: 'text', options: [] }]);
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
    onSchemaChange?.(schema);
    setIsSavingSchema(false);
  };

  const viewType = activeView.config.type;

  return (
    // A raised panel with a hairline on the sheet (V2 R8.2) — the same surface as a
    // field or a card inside the page, not a second sheet.
    <div className="w-full sm:w-72 sm:shrink-0 bg-raised sm:border-l border-line flex flex-col sm:h-full overflow-y-auto sm:overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-line shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ui font-semibold text-fg">{t('settings')}</span>
          <Badge variant="outline" className="min-w-0"><span className="truncate">{activeView.name}</span></Badge>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={tUi('close')} title={tUi('close')}>
          <X />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'properties' | 'layout')} className="shrink-0 px-2">
        <TabsList>
          {([
            { id: 'layout',     label: t('layout'),     icon: LayoutTemplate },
            { id: 'properties', label: t('properties'), icon: Database },
          ] as const).map(({ id, label, icon: Icon }) => (
            <TabsTab key={id} value={id} className="flex-1 justify-center">
              <Icon />
              {label}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>

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
          <div className="flex flex-col">
            {/* Pages group */}
            <CollapsibleSection label={t('sectionPages')}>
              <div className="px-4 pb-3 flex flex-col gap-3 relative">
                <div>
                  <span className="block text-xs text-fg-3 mb-1.5">{t('openPagesAs')}</span>
                  <SimpleSelect
                    value={openBehavior}
                    onValueChange={(v) => onOpenBehaviorChange(v as 'center' | 'side' | 'full')}
                    options={[
                      { value: 'full', label: t('openFull') },
                      { value: 'side', label: t('openSide') },
                      { value: 'center', label: t('openCenter') },
                    ]}
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="block text-xs text-fg-3 mb-1.5">{t('defaultPageIcon')}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      ref={defaultIconBtnRef}
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDefaultIconPicker(!showDefaultIconPicker)}
                    >
                      <PageIcon icon={defaultPageIcon || null} iconColor={defaultPageIconColor || null} size={14} fallbackType="page" />
                      <span>{defaultPageIcon ? tPage('changeIcon') : tPage('addIcon')}</span>
                    </Button>
                    {defaultPageIcon && (
                      <Button variant="ghost" size="sm" onClick={() => onDefaultPageIconChange?.(null, null)} className="hover:text-red-400">
                        {t('remove')}
                      </Button>
                    )}
                  </div>
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
            </CollapsibleSection>

            {/* Table: appearance */}
            {viewType === 'table' && (
              <>
                <GroupingLayoutSection
                  schema={schema}
                  groupByCol={groupByCol}
                  onGroupByColChange={onGroupByColChange}
                  hiddenGroups={hiddenGroups}
                  onHiddenGroupsChange={onHiddenGroupsChange}
                  allowNoGrouping
                />
                <CollapsibleSection label={t('sectionAppearance')}>
                  <div className="px-4 pb-2 flex flex-col gap-3">
                    <div>
                      <span className="block text-xs text-fg-3 mb-1.5">{t('rowColor')}</span>
                      {colorColumns.length > 0 ? (
                        <SimpleSelect
                          value={rowColorCol ?? ''}
                          onValueChange={(v) => onRowColorColChange?.(v)}
                          options={[{ value: '', label: t('none') }, ...colorColumns.map((col: any) => ({ value: col.id, label: col.name }))]}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-xs text-fg-3">{t('addSelectProperty')}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-fg-3">{t('columns')}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="xs" onClick={() => onHiddenColumnsChange([])}>{t('showAll')}</Button>
                        <Button variant="ghost" size="xs" onClick={() => onHiddenColumnsChange(schema.map((c) => c.id).filter((id) => id !== 'title'))}>{t('hideAll')}</Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col pb-2">
                    {schema.map((col) => {
                      const isHidden = hiddenColumns.includes(col.id);
                      const isTitle = col.id === 'title';
                      return (
                        <ToggleRow
                          key={col.id}
                          checked={!isHidden}
                          disabled={isTitle}
                          onToggle={() => { if (!isTitle) onToggleHideColumn(col.id); }}
                        >
                          <span className="flex-1 truncate text-fg-2">{col.name}</span>
                        </ToggleRow>
                      );
                    })}
                  </div>
                </CollapsibleSection>
              </>
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
                cardMarkCol={cardMarkCol}
                onCardMarkColChange={onCardMarkColChange}
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
                cardMarkCol={cardMarkCol}
                onCardMarkColChange={onCardMarkColChange}
                cardProperties={cardProperties}
                onCardPropertiesChange={onCardPropertiesChange}
                showPropertyLabels={showPropertyLabels}
                onShowPropertyLabelsChange={onShowPropertyLabelsChange}
                propertyTextClamp={propertyTextClamp}
                onPropertyTextClampChange={onPropertyTextClampChange}
              />
            )}

            <FiltersSection filters={filters} schema={schema} onFiltersChange={onFiltersChange} />
            <SortsSection sorts={sorts} schema={schema} onSortsChange={onSortsChange} />
          </div>
        )}
      </div>
    </div>
  );
}
