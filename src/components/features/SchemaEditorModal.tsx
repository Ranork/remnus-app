'use client';
import { useState } from 'react';
import { updateDatabaseSchema } from '@/lib/actions/database';
import { X, Plus, Trash2 } from 'lucide-react';

export default function SchemaEditorModal({ 
  database, 
  onClose 
}: { 
  database: any, 
  onClose: () => void 
}) {
  const [schema, setSchema] = useState<any[]>(database.schema || []);
  const [isSaving, setIsSaving] = useState(false);

  const addColumn = () => {
    setSchema([...schema, { id: `col_${crypto.randomUUID().slice(0, 8)}`, name: 'New Column', type: 'text', options: [] }]);
  };

  const updateColumn = (index: number, updates: any) => {
    const newSchema = [...schema];
    newSchema[index] = { ...newSchema[index], ...updates };
    setSchema(newSchema);
  };

  const removeColumn = (index: number) => {
    if (schema[index].id === 'title') return; // Cannot delete title
    const newSchema = [...schema];
    newSchema.splice(index, 1);
    setSchema(newSchema);
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateDatabaseSchema(database.id, schema);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Database Properties</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[60vh]">
          {schema.map((col, idx) => (
            <div key={col.id} className="flex flex-col gap-2 p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={col.name} 
                  onChange={(e) => updateColumn(idx, { name: e.target.value })}
                  disabled={col.id === 'title'}
                  placeholder="Property Name"
                  className="bg-transparent text-white focus:outline-none focus:border-neutral-500 border-b border-transparent flex-1 text-sm px-1 py-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
                
                <select
                  value={col.type}
                  onChange={(e) => updateColumn(idx, { type: e.target.value })}
                  disabled={col.id === 'title'}
                  className="bg-neutral-800 text-white border border-neutral-700 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-neutral-500 disabled:opacity-50"
                >
                  <option value="text">Text</option>
                  <option value="select">Select</option>
                  <option value="number">Number</option>
                </select>

                <button 
                  onClick={() => removeColumn(idx)}
                  disabled={col.id === 'title'}
                  className="text-red-400 hover:text-red-300 disabled:opacity-30 disabled:hover:text-red-400 p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {col.type === 'select' && (
                <div className="pl-2 pt-2 border-t border-neutral-800/50">
                  <div className="text-xs text-neutral-500 mb-2">Options</div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(col.options || []).map((opt: string, optIdx: number) => (
                      <span key={optIdx} className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded-md text-xs flex items-center gap-1 border border-neutral-700/50">
                        {opt}
                        <button 
                          onClick={() => {
                            const newOpts = [...(col.options || [])];
                            newOpts.splice(optIdx, 1);
                            updateColumn(idx, { options: newOpts });
                          }}
                          className="hover:text-white transition-colors ml-1"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    placeholder="Type an option and press Enter..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !(col.options || []).includes(val)) {
                          updateColumn(idx, { options: [...(col.options || []), val] });
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-neutral-600 transition-colors"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-neutral-800 flex justify-between items-center bg-neutral-900">
          <button 
            onClick={addColumn}
            className="flex items-center gap-1 text-sm text-neutral-300 hover:text-white transition-colors"
          >
            <Plus size={16} /> Add Property
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="bg-white text-black hover:bg-neutral-200 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
