'use client';

import { useRouter } from 'next/navigation';

export default function KanbanBoard({ database, pages, groupByCol }: { database: any, pages: any[], groupByCol: string }) {
  const router = useRouter();
  const schema = database.schema as any[];
  
  // Find the column we are grouping by
  const groupColumn = schema.find(col => col.id === groupByCol);
  
  // If it's a select column, it should have options. Otherwise, we just fall back to empty.
  const options: string[] = groupColumn?.options || [];
  
  // Prepare column definitions: The defined options + 'Uncategorized'
  const kanbanColumns = [...options, 'Uncategorized'];

  // Group pages by the column value
  const groupedPages: Record<string, any[]> = {};
  kanbanColumns.forEach(col => {
    groupedPages[col] = [];
  });

  pages.forEach(page => {
    const val = page.properties[groupByCol];
    if (val && options.includes(val)) {
      groupedPages[val].push(page);
    } else {
      groupedPages['Uncategorized'].push(page);
    }
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start">
      {kanbanColumns.map(columnName => (
        <div key={columnName} className="flex-shrink-0 w-80 bg-neutral-900/50 border border-neutral-800 rounded-lg flex flex-col max-h-full">
          <div className="p-3 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/30 rounded-t-lg">
            <h3 className="font-medium text-sm text-neutral-300">
              {columnName === 'Uncategorized' ? 'No Status' : columnName}
            </h3>
            <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
              {groupedPages[columnName].length}
            </span>
          </div>
          
          <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-3 min-h-[100px]">
            {groupedPages[columnName].map(page => (
              <div 
                key={page.id}
                onClick={() => router.push(`/db/${database.id}/${page.id}`)}
                className="bg-neutral-800 border border-neutral-700/50 p-4 rounded-md shadow-sm cursor-pointer hover:border-neutral-500 hover:bg-neutral-750 transition-all group"
              >
                <h4 className="font-medium text-sm text-white group-hover:text-blue-400 transition-colors">
                  {page.properties['title'] || 'Untitled'}
                </h4>
                
                {/* Render other properties briefly if needed */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {schema.filter(c => c.id !== 'title' && c.id !== groupByCol).slice(0, 2).map(c => {
                    const val = page.properties[c.id];
                    if (!val) return null;
                    return (
                      <div key={c.id} className="text-xs flex items-center gap-2">
                        <span className="text-neutral-500">{c.name}:</span>
                        <span className="text-neutral-300 truncate">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {groupedPages[columnName].length === 0 && (
              <div className="text-center text-xs text-neutral-600 py-4 border-2 border-dashed border-neutral-800 rounded-md">
                No pages
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
