'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { updateDatabaseSchema } from '@/lib/actions/database';
import { GripHorizontal, Type, List, Hash, AlignLeft } from 'lucide-react';

function getPropertyIcon(type: string) {
  switch (type) {
    case 'text':
      return <Type size={14} className="text-neutral-500" />;
    case 'select':
      return <List size={14} className="text-neutral-500" />;
    case 'number':
      return <Hash size={14} className="text-neutral-500" />;
    default:
      return <AlignLeft size={14} className="text-neutral-500" />;
  }
}

export default function TableLayout({ database, pages }: { database: any, pages: any[] }) {
  const router = useRouter();
  
  const [localSchema, setLocalSchema] = useState<any[]>(database.schema || []);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  useEffect(() => {
    setLocalSchema(database.schema || []);
  }, [database.schema]);

  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggedColId === colId) return;
    setDragOverColId(colId);
  };

  const handleDragLeave = (colId: string) => {
    if (dragOverColId === colId) {
      setDragOverColId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }

    const draggedIndex = localSchema.findIndex(c => c.id === draggedColId);
    const targetIndex = localSchema.findIndex(c => c.id === targetColId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newSchema = [...localSchema];
      const [draggedItem] = newSchema.splice(draggedIndex, 1);
      newSchema.splice(targetIndex, 0, draggedItem);
      
      // Update local state immediately for visual responsiveness
      setLocalSchema(newSchema);

      // Save to database
      try {
        await updateDatabaseSchema(database.id, newSchema);
      } catch (error) {
        console.error("Failed to update schema order", error);
        // Revert on error
        setLocalSchema(database.schema || []);
      }
    }

    setDraggedColId(null);
    setDragOverColId(null);
  };

  const handleDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-md overflow-hidden shadow-xl flex-1 flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-neutral-300 border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-neutral-800/60 border-b border-neutral-800 sticky top-0 z-10">
            <tr>
              {localSchema.map((col) => {
                const isOver = dragOverColId === col.id;
                const isDraggingThis = draggedColId === col.id;

                return (
                  <th 
                    key={col.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={() => handleDragLeave(col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    onDragEnd={handleDragEnd}
                    className={`group px-3 py-2 font-medium whitespace-nowrap border-r border-neutral-800/60 last:border-r-0 hover:bg-neutral-700/40 cursor-grab active:cursor-grabbing transition-all w-48 relative
                      ${isOver ? 'bg-neutral-700/50 border-l-2 border-l-blue-500 scale-[0.98]' : ''}
                      ${isDraggingThis ? 'opacity-40' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        {getPropertyIcon(col.type)}
                        <span className="truncate text-neutral-400 group-hover:text-neutral-300 text-xs uppercase tracking-wider">{col.name}</span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 text-neutral-600 cursor-grab active:cursor-grabbing transition-opacity pl-1">
                        <GripHorizontal size={14} />
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pages.length === 0 ? (
              <tr>
                <td colSpan={localSchema.length} className="px-6 py-12 text-center text-neutral-500 text-sm bg-neutral-900/50">
                  <div className="flex flex-col items-center gap-2">
                    <p>No pages found in this database.</p>
                    <p className="text-xs text-neutral-600">Click the "New" button to create your first page.</p>
                  </div>
                </td>
              </tr>
            ) : (
              pages.map((page) => (
                <tr 
                  key={page.id} 
                  onClick={() => router.push(`/db/${database.id}/${page.id}`)}
                  className="border-b border-neutral-800/40 hover:bg-neutral-800/80 cursor-pointer transition-colors group"
                >
                  {localSchema.map((col) => {
                    const val = page.properties[col.id];
                    return (
                      <td key={col.id} className="px-3 py-2 whitespace-nowrap overflow-hidden text-ellipsis border-r border-neutral-800/60 last:border-r-0 group-hover:border-neutral-700/50 transition-colors">
                        {col.id === 'title' ? (
                          <span className="font-medium text-white">{val || 'Untitled'}</span>
                        ) : col.type === 'select' ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${val ? 'bg-neutral-700/60 border border-neutral-600 text-neutral-200' : 'text-neutral-600'}`}>
                            {val || 'Empty'}
                          </span>
                        ) : (
                          <span className="text-neutral-400">{val || ''}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {pages.length > 0 && (
              <tr className="flex-1 h-full bg-neutral-900/20">
                {localSchema.map((col) => (
                  <td key={`filler-${col.id}`} className="border-r border-neutral-800/60 last:border-r-0"></td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
