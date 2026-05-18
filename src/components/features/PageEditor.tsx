'use client';
import { useState, useMemo } from 'react';
import { updatePageContent, updatePageProperties } from '@/lib/actions/page';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import BlockEditor from '@/components/features/editor/BlockEditor';

function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function PageEditor({
  database,
  initialPage,
  isPeek = false,
  onClose,
  onPageUpdated,
}: {
  database: any;
  initialPage: any;
  isPeek?: boolean;
  onClose?: () => void;
  onPageUpdated?: (updatedPage: any) => void;
}) {
  const [properties, setProperties] = useState<Record<string, any>>(initialPage.properties || {});

  const schema = database.schema as any[];

  const handleContentChange = useMemo(
    () =>
      debounce((md: string) => {
        updatePageContent(initialPage.id, md);
        if (onPageUpdated) {
          onPageUpdated({ ...initialPage, properties, content: md });
        }
      }, 1000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialPage.id]
  );

  const handlePropertyChange = async (colId: string, value: any) => {
    const newProps = { ...properties, [colId]: value };
    setProperties(newProps);
    await updatePageProperties(initialPage.id, newProps);
    if (onPageUpdated) {
      onPageUpdated({ ...initialPage, properties: newProps });
    }
  };

  const handleMultiSelectToggle = async (colId: string, option: string) => {
    const current: string[] = Array.isArray(properties[colId]) ? properties[colId] : [];
    const newVal = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    await handlePropertyChange(colId, newVal);
  };

  return (
    <div className={`${isPeek ? 'p-6 md:p-8 lg:p-10' : 'max-w-4xl mx-auto p-8 lg:p-12'}`}>
      {!isPeek && (
        <Link href={`/db/${database.id}`} className="inline-flex items-center gap-2 text-neutral-400 hover:text-white mb-10 transition-colors text-sm font-medium">
          <ArrowLeft size={16} /> Back to {database.name}
        </Link>
      )}

      {/* Properties Section */}
      <div className="mb-12 space-y-4">
        {schema.map((col) => {
          const val = properties[col.id];

          return (
            <div key={col.id} className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-8 border-b border-neutral-800/60 pb-3 group">
              <div className="text-neutral-500 w-32 shrink-0 text-sm font-medium group-hover:text-neutral-400 transition-colors pt-1">{col.name}</div>

              {col.id === 'title' ? (
                <input
                  type="text"
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  placeholder="Untitled"
                  className="bg-transparent text-white focus:outline-none rounded p-1 -ml-1 font-bold text-4xl flex-1 placeholder:text-neutral-800 tracking-tight"
                />
              ) : col.type === 'select' ? (
                <select
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 max-w-xs text-sm transition-shadow"
                >
                  <option value="" className="bg-neutral-900">Empty</option>
                  {col.options?.map((opt: string) => (
                    <option key={opt} value={opt} className="bg-neutral-900">{opt}</option>
                  ))}
                </select>
              ) : col.type === 'multi_select' ? (
                <div className="flex-1 flex flex-col gap-2 pt-0.5">
                  {/* Selected chips */}
                  {Array.isArray(val) && val.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {val.map((opt: string) => (
                        <span key={opt} className="inline-flex items-center gap-1 bg-neutral-800 text-neutral-300 text-xs px-2 py-0.5 rounded border border-neutral-700">
                          {opt}
                          <button
                            onClick={() => handleMultiSelectToggle(col.id, opt)}
                            className="text-neutral-500 hover:text-white transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Available options to add */}
                  {col.options && col.options.filter((opt: string) => !(Array.isArray(val) && val.includes(opt))).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {col.options
                        .filter((opt: string) => !(Array.isArray(val) && val.includes(opt)))
                        .map((opt: string) => (
                          <button
                            key={opt}
                            onClick={() => handleMultiSelectToggle(col.id, opt)}
                            className="text-xs px-2 py-0.5 rounded border border-neutral-800 text-neutral-600 hover:border-neutral-600 hover:text-neutral-400 transition-colors"
                          >
                            + {opt}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ) : col.type === 'date' ? (
                <input
                  type="date"
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 text-sm transition-shadow scheme-dark"
                />
              ) : col.type === 'datetime' ? (
                <input
                  type="datetime-local"
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 text-sm transition-shadow scheme-dark"
                />
              ) : (
                <input
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={val || ''}
                  onChange={(e) => handlePropertyChange(col.id, e.target.value)}
                  placeholder="Empty"
                  className="bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-neutral-700 rounded p-1 -ml-1 flex-1 text-sm placeholder:text-neutral-700 transition-shadow"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Content Editor */}
      <BlockEditor
        key={initialPage.id}
        initialContent={initialPage.content || ''}
        onChange={handleContentChange}
        placeholder="Press '/' for commands or start writing..."
      />
    </div>
  );
}
