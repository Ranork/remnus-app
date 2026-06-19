'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { GripVertical, Settings, Trash2, Plus, Copy, CheckSquare, Square, ExternalLink, ArrowUpRight, Maximize2, Link2 } from 'lucide-react';
import { normalizeOption, getOptionColorByValue, getCardBorderDots, getCardBgColor, formatDateValue } from '@/lib/types/properties';
import { useTranslations } from 'next-intl';
import type { SelectOption } from '@/lib/types/properties';
import InlineCellEditor from './InlineCellEditor';
import { useContextMenu, type MenuItem } from './ContextMenu';
import { StatusChip, UserChip, UserTags } from './PropertyTags';
import PageIcon from './PageIcon';
import IconPicker from './IconPicker';
import AgentEditBadge from './AgentEditBadge';
import { updatePageIcon } from '@/lib/actions/page';
import { ConfirmDialog } from './ConfirmDialog';

function getEffectiveGroupOrder(options: string[], groupOrder: string[]): string[] {
  if (!groupOrder || groupOrder.length === 0) return options;
  const optSet = new Set(options);
  const ordered = groupOrder.filter((g) => optSet.has(g));
  const extras = options.filter((o) => !groupOrder.includes(o));
  return [...ordered, ...extras];
}

export default function KanbanBoard({
  database,
  pages,
  groupByCol,
  groupOrder,
  onGroupOrderChange,
  onCardClick,
  onCardMove,
  onDeletePage,
  onDuplicatePage,
  hasSorts,
  cardProperties,
  showPropertyLabels = true,
  propertyTextClamp = 'truncate',
  cardColorCol,
  cardBorderSide = 'left',
  cardBgCol,
  groupColBg = false,
  onUpdatePageProperties,
  onCreatePage,
  defaultPageIcon,
  defaultPageIconColor,
  onPageIconChange,
  hiddenGroups = [],
}: {
  database: any;
  pages: any[];
  groupByCol: string;
  groupOrder: string[];
  onGroupOrderChange: (order: string[]) => void;
  onCardClick: (pageId: string) => void;
  onCardMove: (pageId: string, targetGroupId: string, targetPageId?: string) => void;
  onDeletePage: (pageId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  hasSorts: boolean;
  cardProperties?: string[];
  showPropertyLabels?: boolean;
  propertyTextClamp?: 'truncate' | 'wrap';
  cardColorCol?: string;
  cardBorderSide?: 'left' | 'top' | 'right' | 'bottom';
  cardBgCol?: string;
  groupColBg?: boolean;
  onUpdatePageProperties: (pageId: string, properties: Record<string, any>) => void;
  onCreatePage?: (initialProperties?: Record<string, any>) => void;
  defaultPageIcon?: string;
  defaultPageIconColor?: string;
  onPageIconChange?: (pageId: string, icon: string | null, iconColor: string | null) => void;
  hiddenGroups?: string[];
}) {
  const t = useTranslations('Database');
  const tPage = useTranslations('Page');
  const router = useRouter();
  const schema = database.schema as any[];

  // Notion-style right-click menu for cards
  const cardMenu = useContextMenu();
  const buildCardMenu = (pageId: string): MenuItem[] => [
    { id: 'open', label: t('open'), icon: ArrowUpRight, onSelect: () => onCardClick(pageId) },
    { id: 'open-full', label: t('openInFullPage'), icon: Maximize2, onSelect: () => router.push(`/db/${database.id}/${pageId}`) },
    { id: 'copy-link', label: t('copyLink'), icon: Link2, onSelect: () => { navigator.clipboard?.writeText(`${window.location.origin}/db/${database.id}/${pageId}`); } },
    { kind: 'separator' },
    { id: 'duplicate', label: t('duplicatePage'), icon: Copy, onSelect: () => onDuplicatePage(pageId) },
    { id: 'delete', label: tPage('deletePage'), icon: Trash2, danger: true, onSelect: () => setConfirmDeleteId(pageId) },
  ];

  const [editingCell, setEditingCell] = useState<{ pageId: string; colId: string } | null>(null);
  const [activeIconPickerPageId, setActiveIconPickerPageId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKanbanIconSelect = (pageId: string, newIcon: string | null, newColor: string | null) => {
    onPageIconChange?.(pageId, newIcon, newColor);
    updatePageIcon(pageId, newIcon, newColor);
  };

  const handleCellSave = (pageId: string, colId: string, newVal: any) => {
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;
    const nextProps = { ...page.properties, [colId]: newVal };
    onUpdatePageProperties(pageId, nextProps);
  };

  const groupColumn = schema.find((col) => col.id === groupByCol);
  const options: string[] = (groupColumn?.options ?? []).map((o: string | SelectOption) => normalizeOption(o).value);

  const availableProps = schema.filter((c) => c.id !== 'title' && c.id !== groupByCol);
  const propsToShow = cardProperties !== undefined && cardProperties.length > 0
    ? cardProperties.map((id) => availableProps.find((c) => c.id === id)).filter(Boolean) as any[]
    : availableProps.slice(0, 2);

  const textClass = propertyTextClamp === 'wrap' ? 'break-words whitespace-pre-wrap' : 'truncate';
  const orderedOptions = getEffectiveGroupOrder(options, groupOrder);
  const allColumns = [...orderedOptions, 'Uncategorized'].filter(
    (colName) => !hiddenGroups.includes(colName)
  );

  const groupedPages: Record<string, any[]> = {};
  allColumns.forEach((col) => { groupedPages[col] = []; });
  pages.forEach((page) => {
    const val = page.properties[groupByCol];
    if (val && options.includes(val)) {
      groupedPages[val]?.push(page);
    } else {
      groupedPages['Uncategorized']?.push(page);
    }
  });

  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);
  const [isGroupDragReady, setIsGroupDragReady] = useState<string | null>(null);

  // Card dragging states
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverColumnName, setDragOverColumnName] = useState<string | null>(null);
  const [isCardDragReady, setIsCardDragReady] = useState(false);
  const [activeMenuCardId, setActiveMenuCardId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);

  const handleGroupDragStart = (e: React.DragEvent, group: string) => {
    if (group === 'Uncategorized') return;
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGroupDragOver = (e: React.DragEvent, group: string) => {
    e.preventDefault();
    if (draggedGroup && draggedGroup !== group && group !== 'Uncategorized') {
      setDragOverGroup(group);
    }
  };

  const handleGroupDrop = (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup || targetGroup === 'Uncategorized') {
      setDraggedGroup(null);
      setDragOverGroup(null);
      return;
    }

    const current = orderedOptions;
    const fromIdx = current.indexOf(draggedGroup);
    const toIdx = current.indexOf(targetGroup);

    if (fromIdx !== -1 && toIdx !== -1) {
      const newOrder = [...current];
      const [moved] = newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, moved);
      onGroupOrderChange(newOrder);
    }

    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroup(null);
    setDragOverGroup(null);
  };

  // Card drag and drop handlers
  const handleCardDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId);
    e.dataTransfer.setData('text/plain', cardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCardDragOver = (e: React.DragEvent, targetCardId: string, columnName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedCardId && draggedCardId !== targetCardId) {
      setDragOverCardId(targetCardId);
      setDragOverColumnName(columnName);
    }
  };

  const handleCardDrop = (e: React.DragEvent, targetCardId: string, targetColumnName: string) => {
    e.preventDefault();
    e.stopPropagation();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    onCardMove(cardId, targetColumnName, targetCardId);

    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnName(null);
    setIsCardDragReady(false);
  };

  const handleCardDragEnd = () => {
    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnName(null);
    setIsCardDragReady(false);
  };

  const handleColumnCardAreaDragOver = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    if (draggedCardId) {
      setDragOverColumnName(columnName);
    }
  };

  const handleColumnCardAreaDrop = (e: React.DragEvent, columnName: string) => {
    e.preventDefault();
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain');
    if (!cardId) return;

    onCardMove(cardId, columnName);

    setDraggedCardId(null);
    setDragOverCardId(null);
    setDragOverColumnName(null);
    setIsCardDragReady(false);
  };

  if (!groupByCol) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        Select a property to group by using the &ldquo;Group by&rdquo; selector above.
      </div>
    );
  }

  return (
    <div className={`flex overflow-x-auto pb-4 items-start ${groupColBg ? 'gap-2' : 'gap-6'}`}>
      {allColumns.map((columnName) => {
        const isUncategorized = columnName === 'Uncategorized';
        const isDraggingThis = draggedGroup === columnName;
        const isOver = dragOverGroup === columnName;
        const groupBgStyle = groupColBg
          ? (isUncategorized
              ? { backgroundColor: 'rgba(56, 59, 65, 0.08)' }
              : { backgroundColor: getOptionColorByValue(groupColumn?.options || [], columnName).groupBg })
          : undefined;

        const hasBg = groupColBg;

        return (
          <div
            key={columnName}
            draggable={!isUncategorized && isGroupDragReady === columnName}
            onDragStart={(e) => handleGroupDragStart(e, columnName)}
            onDragOver={(e) => handleGroupDragOver(e, columnName)}
            onDrop={(e) => handleGroupDrop(e, columnName)}
            onDragEnd={() => {
              handleGroupDragEnd();
              setIsGroupDragReady(null);
            }}
            onMouseLeave={() => setIsGroupDragReady(null)}
            className={`shrink-0 w-68 flex flex-col transition-opacity group/col ${
              hasBg ? 'p-3 rounded' : ''
            } ${isDraggingThis ? 'opacity-30' : ''} ${isOver ? 'ring-1 ring-blue-500/40' : ''}`}
            style={groupBgStyle}
          >
            <div
              onMouseDown={() => {
                if (!isUncategorized) {
                  setIsGroupDragReady(columnName);
                }
              }}
              onMouseUp={() => setIsGroupDragReady(null)}
              className={`pb-2 mb-2 flex justify-between items-baseline ${
                hasBg ? 'border-b border-white/8' : 'border-b border-neutral-800/50'
              } ${!isUncategorized ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                {isUncategorized ? t('uncategorized') : columnName}
              </h3>
              <span className="text-xs text-neutral-500 tabular-nums">
                {groupedPages[columnName].length}
              </span>
            </div>

            <div
              onDragOver={(e) => handleColumnCardAreaDragOver(e, columnName)}
              onDrop={(e) => handleColumnCardAreaDrop(e, columnName)}
              className={`flex flex-col min-h-16 transition-colors ${
                dragOverColumnName === columnName && !dragOverCardId ? 'bg-neutral-800/10' : ''
              }`}
            >
              {groupedPages[columnName].length === 0 ? (
                <div className="text-xs text-neutral-500 py-4">{t('noPages')}</div>
              ) : (
                groupedPages[columnName].map((page) => {
                  const colorColSchema = cardColorCol ? schema.find((c) => c.id === cardColorCol) : null;
                  const borderDots = getCardBorderDots(colorColSchema, page.properties[cardColorCol ?? '']);
                  const bgColSchema = cardBgCol ? schema.find((c) => c.id === cardBgCol) : null;
                  const bgColor = getCardBgColor(bgColSchema, page.properties[cardBgCol ?? '']);
                  const isCardEditing = editingCell?.pageId === page.id;
                  const isHorizontalBorder = cardBorderSide === 'top' || cardBorderSide === 'bottom';
                  const borderLineClass = cardBorderSide === 'top'
                    ? 'absolute top-0 inset-x-0 h-0.75 flex flex-row'
                    : cardBorderSide === 'right'
                    ? 'absolute right-0 inset-y-0 w-0.75 flex flex-col'
                    : cardBorderSide === 'bottom'
                    ? 'absolute bottom-0 inset-x-0 h-0.75 flex flex-row'
                    : 'absolute left-0 inset-y-0 w-0.75 flex flex-col';
                  return (
                  <div
                    key={page.id}
                    onClick={() => onCardClick(page.id)}
                    onContextMenu={(e) => cardMenu.open(e, buildCardMenu(page.id))}
                    draggable={isCardDragReady}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      handleCardDragStart(e, page.id);
                    }}
                    onDragOver={(e) => handleCardDragOver(e, page.id, columnName)}
                    onDrop={(e) => handleCardDrop(e, page.id, columnName)}
                    onDragEnd={handleCardDragEnd}
                    className={`relative py-3 px-3 mb-1.5 cursor-pointer transition-colors group rounded
                      ${isCardEditing ? 'overflow-visible z-30' : 'overflow-hidden'}
                      ${draggedCardId === page.id ? 'opacity-25' : ''}
                      ${dragOverCardId === page.id ? 'border-t-2 border-t-blue-500/60' : ''}
                    `}
                    style={{ backgroundColor: bgColor ?? 'rgba(64,68,75,0.55)' }}
                  >
                    {borderDots.length > 0 && (
                      <div className={`${borderLineClass} pointer-events-none`} aria-hidden>
                        {borderDots.map((dot, i) => (
                          <div key={i} className="flex-1" style={{ backgroundColor: dot }} />
                        ))}
                      </div>
                    )}
                    {/* Hover Card Actions */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center transition-opacity z-10" onClick={(e) => e.stopPropagation()}>
                      {/* Drag handle & Actions */}
                      <button
                        draggable={true}
                        onDragStart={(e) => {
                          e.stopPropagation();
                          handleCardDragStart(e, page.id);
                        }}
                        onMouseDown={() => {
                          setIsCardDragReady(true);
                        }}
                        onMouseLeave={() => {
                          setIsCardDragReady(false);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeMenuCardId === page.id) {
                            setActiveMenuCardId(null);
                            setMenuCoords(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuCoords({ top: rect.bottom + 4, left: rect.right - 144 });
                            setActiveMenuCardId(page.id);
                          }
                        }}
                        className="p-1 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 cursor-grab active:cursor-grabbing transition-colors rounded"
                        title={t('dragMove')}
                      >
                        <GripVertical size={13} />
                      </button>
                    </div>

                    {/* Card Dropdown Menu — rendered via portal to escape overflow-hidden */}
                    {activeMenuCardId === page.id && menuCoords && createPortal(
                      <div onClick={(e) => e.stopPropagation()}>
                        <div
                          className="fixed inset-0 z-9998 cursor-default"
                          onClick={(e) => { e.stopPropagation(); setActiveMenuCardId(null); setMenuCoords(null); }}
                        />
                        <div
                          className="fixed z-9999 bg-neutral-900 border border-neutral-800 shadow-xl py-1 w-36 rounded text-left animate-fade-in animate-duration-100 overflow-hidden"
                          style={{ top: menuCoords.top, left: menuCoords.left }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDuplicatePage(page.id);
                              setActiveMenuCardId(null);
                              setMenuCoords(null);
                            }}
                            className="w-full px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors border-b border-neutral-850"
                          >
                            <Copy size={13} />
                            <span>{t('duplicatePage')}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(page.id);
                              setActiveMenuCardId(null);
                              setMenuCoords(null);
                            }}
                            className="w-full px-3 py-2 text-xs text-red-400 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Trash2 size={13} />
                            <span>{tPage('deletePage')}</span>
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}

                    <h4 className={`text-sm font-medium text-neutral-100 group-hover:text-neutral-50 transition-colors pr-8 flex items-center gap-1.5 ${propertyTextClamp === 'truncate' ? 'overflow-hidden' : 'wrap-break-word whitespace-normal overflow-visible'}`}>
                      <div className="relative shrink-0 select-none">
                        <button
                          ref={(el) => { itemRefs.current[page.id] = el; }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveIconPickerPageId(activeIconPickerPageId === page.id ? null : page.id);
                          }}
                          className="hover:bg-neutral-800 p-0.5 rounded transition-colors flex items-center justify-center cursor-pointer"
                          title="Change icon"
                        >
                          <PageIcon 
                            icon={page.icon || defaultPageIcon} 
                            iconColor={page.iconColor || defaultPageIconColor} 
                            size={16} 
                            fallbackType="page" 
                            className="shrink-0" 
                          />
                        </button>
                        {activeIconPickerPageId === page.id && (
                          <IconPicker
                            currentIcon={page.icon}
                            currentIconColor={page.iconColor}
                            onSelect={(newIcon, newColor) => handleKanbanIconSelect(page.id, newIcon, newColor)}
                            onClose={() => setActiveIconPickerPageId(null)}
                            anchorRef={{ current: itemRefs.current[page.id] }}
                          />
                        )}
                      </div>
                      <span className={propertyTextClamp === 'truncate' ? 'truncate min-w-0' : ''}>{page.properties['title'] || tPage('untitled')}</span>
                    </h4>

                    <AgentEditBadge
                      agentName={page.agentName ?? null}
                      tokenName={page.agentTokenName ?? null}
                      editedAt={page.agentEditedAt ?? null}
                      className="absolute bottom-0 right-0 rounded-tl-xl p-1.5 z-10 translate-x-0.5 translate-y-0.5"
                    />

                    <div className="mt-1.5 flex flex-col gap-1.5">
                      {propsToShow.map((c) => {
                          const val = page.properties[c.id];
                          const isEditing = editingCell?.pageId === page.id && editingCell?.colId === c.id;
                          const isEmpty =
                            val === undefined ||
                            val === null ||
                            val === '' ||
                            (Array.isArray(val) && val.length === 0);
                          if (isEmpty && !isEditing) return null;

                          let display: React.ReactNode;
                          if (c.type === 'select' && typeof val === 'string') {
                            const sc = getOptionColorByValue(c.options || [], val);
                            display = (
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                                {val}
                              </span>
                            );
                          } else if (c.type === 'status' && typeof val === 'string') {
                            display = <StatusChip value={val} options={c.options} />;
                          } else if (c.type === 'user') {
                            display = <UserChip userId={String(val)} />;
                          } else if (c.type === 'multi_user' && Array.isArray(val)) {
                            display = <UserTags value={val} wrap={propertyTextClamp === 'wrap'} />;
                          } else if (c.type === 'multi_select' && Array.isArray(val)) {
                            display = (
                              <span className={`flex gap-1 ${propertyTextClamp === 'wrap' ? 'flex-wrap' : 'flex-nowrap overflow-hidden'}`}>
                                {val.map((optVal: string) => {
                                  const mc = getOptionColorByValue(c.options || [], optVal);
                                  return (
                                    <span key={optVal} className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: mc.bg, color: mc.text }}>
                                      {optVal}
                                    </span>
                                  );
                                })}
                              </span>
                            );
                          } else if ((c.type === 'date' || c.type === 'datetime') && val) {
                            display = (
                              <span className={`text-neutral-100 ${textClass}`}>
                                {formatDateValue(val, c.type as 'date' | 'datetime', c.dateFormat)}
                              </span>
                            );
                          } else if (c.type === 'checkbox') {
                            display = (val === true || val === 'true')
                              ? <CheckSquare size={13} className="text-blue-400" />
                              : <Square size={13} className="text-neutral-600" />;
                          } else if (c.type === 'url' && val) {
                            const safeHref = typeof val === 'string' && /^https?:\/\//i.test(val) ? val : null;
                            display = safeHref ? (
                              <a href={safeHref} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`text-blue-400 hover:text-blue-300 flex items-center gap-0.5 ${textClass}`}>
                                <span className="truncate">{val}</span>
                                <ExternalLink size={9} className="shrink-0" />
                              </a>
                            ) : (
                              <span className={`text-neutral-100 ${textClass}`}>{val}</span>
                            );
                          } else if (c.type === 'email' && val) {
                            display = (
                              <a href={`mailto:${val}`} onClick={(e) => e.stopPropagation()} className={`text-blue-400 hover:text-blue-300 ${textClass}`}>{val}</a>
                            );
                          } else {
                            display = (
                              <span className={`text-neutral-100 ${textClass}`}>{val !== undefined && val !== null ? String(val) : ''}</span>
                            );
                          }

                          const handlePropClick = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            setEditingCell({ pageId: page.id, colId: c.id });
                          };

                          return (
                            <div
                              key={c.id}
                              className={`text-xs leading-relaxed flex gap-1.5 ${propertyTextClamp === 'wrap' ? 'items-start' : 'items-center'} overflow-visible relative`}
                            >
                              {showPropertyLabels && (
                                <span className="text-neutral-300 shrink-0 select-none">{c.name}</span>
                              )}
                              {isEditing ? (
                                <InlineCellEditor
                                  column={c}
                                  value={val}
                                  onSave={(newVal) => handleCellSave(page.id, c.id, newVal)}
                                  onClose={() => setEditingCell(null)}
                                />
                              ) : (
                                <div
                                  onClick={handlePropClick}
                                  className="inline-flex items-center cursor-pointer max-w-full hover:brightness-110"
                                >
                                  {display}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  );
                })
              )}
              {/* "+ New" Button at the bottom of the group, visible on hover of the column */}
              <button
                onClick={() => onCreatePage?.(isUncategorized ? {} : { [groupByCol]: columnName })}
                className="w-full text-left py-1.5 px-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/20 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer mt-1 opacity-0 group-hover/col:opacity-100 transition duration-150 shrink-0"
              >
                <Plus size={13} />
                <span>New</span>
              </button>
            </div>
          </div>
        );
      })}
      {confirmDeleteId && (
        <ConfirmDialog
          title={t('deletePageConfirm')}
          confirmLabel={t('delete')}
          cancelLabel={t('deleteCancel')}
          onConfirm={() => { onDeletePage(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {cardMenu.node}
    </div>
  );
}
