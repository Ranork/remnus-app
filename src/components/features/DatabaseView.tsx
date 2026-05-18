'use client';
import { useState } from 'react';
import { createPage } from '@/lib/actions/page';
import { Plus, Settings, LayoutList, KanbanSquare } from 'lucide-react';
import SchemaEditorModal from './SchemaEditorModal';
import TableLayout from './TableLayout';
import KanbanBoard from './KanbanBoard';

export default function DatabaseView({ database, initialPages }: { database: any, initialPages: any[] }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingSchema, setIsEditingSchema] = useState(false);
  
  // View state: 'table' or 'kanban'
  const [activeView, setActiveView] = useState<'table' | 'kanban'>('table');
  
  const schema = database.schema as any[];
  
  // Get all select properties to use for Kanban grouping
  const selectColumns = schema.filter(col => col.type === 'select');
  
  // Default to the first select column if available
  const [groupByCol, setGroupByCol] = useState<string>(selectColumns.length > 0 ? selectColumns[0].id : '');

  const handleAddRow = async () => {
    setIsAdding(true);
    const title = 'New Page';
    await createPage(database.id, title);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-md p-1">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeView === 'table' 
                  ? 'bg-neutral-800 text-white shadow-sm' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <LayoutList size={16} /> Table
            </button>
            <button
              onClick={() => setActiveView('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeView === 'kanban' 
                  ? 'bg-neutral-800 text-white shadow-sm' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
            >
              <KanbanSquare size={16} /> Kanban
            </button>
          </div>

          {/* Group By selector (Only visible in Kanban view) */}
          {activeView === 'kanban' && selectColumns.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-neutral-400 font-medium">Group By:</span>
              <select
                value={groupByCol}
                onChange={(e) => setGroupByCol(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-sm text-white rounded-md px-3 py-1.5 outline-none focus:border-neutral-600 transition-colors cursor-pointer"
              >
                {selectColumns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          )}
          
          {activeView === 'kanban' && selectColumns.length === 0 && (
            <div className="ml-4 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-md">
              Add a "Select" property to use Kanban
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditingSchema(true)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white px-3 py-2 rounded-md transition-colors text-sm"
          >
            <Settings size={16} /> Properties
          </button>
          <button 
            onClick={handleAddRow}
            disabled={isAdding}
            className="flex items-center gap-2 bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {isEditingSchema && (
        <SchemaEditorModal 
          database={database} 
          onClose={() => setIsEditingSchema(false)} 
        />
      )}

      {/* Render the selected view */}
      <div className="flex-1 min-h-0">
        {activeView === 'table' ? (
          <TableLayout database={database} pages={initialPages} />
        ) : (
          <KanbanBoard database={database} pages={initialPages} groupByCol={groupByCol} />
        )}
      </div>
    </div>
  );
}
