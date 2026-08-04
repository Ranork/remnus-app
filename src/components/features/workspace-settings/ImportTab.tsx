'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Upload, FileArchive, CheckCircle, AlertCircle, Loader2, Layers, FileText, Database, Image, ArrowLeft, BookOpen } from 'lucide-react';
import OkfImport from '@/components/features/workspace-settings/OkfImport';
import {
  parseNotionExport,
  materializeItems,
  getImageBlobFromZip,
  type NotionParseResult,
  type NotionSpace,
} from '@/lib/import/notion-parser';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Brand icons ────────────────────────────────────────────────────────────────

function NotionIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="white" />
      <path
        d="M20.5 17.2c3.3 2.7 4.6 2.5 10.9 2.1l59.2-3.5c1.2 0 .2-1.2-.2-1.4l-9.9-7.2C78.9 5.6 77 5 74.8 5.3L17.6 9.7c-2.5.3-3 1.5-2 2.5l4.9 5zm2.1 10.5v62.2c0 3.4 1.7 4.6 5.5 4.4l65.1-3.8c3.8-.2 4.2-2.5 4.2-5.3V23.8c0-2.8-1.1-4.3-3.5-4.1l-68 4c-2.6.2-3.3 1.5-3.3 3.9zm62.5 3.8c.4 1.7 0 3.4-1.7 3.6l-2.8.5v41.3c-2.5 1.3-4.7 2-6.6 2-3.1 0-3.9-1-6.2-3.9L47.6 52.7v30.4l5.9 1.3s0 3.4-4.7 3.4l-13-0.8c-.4-.8 0-2.7 1.3-3.1l3.4-0.9V40.6l-4.7-.3c-.4-1.7.5-4.2 3-4.4l14-.8 22.7 34.7V37.4l-5-.6c-.4-2.1 1.2-3.6 3.2-3.8l13.7-.8z"
        fill="black"
      />
    </svg>
  );
}

function ExcelIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#217346" />
      <path d="M58 16H82C84.2 16 86 17.8 86 20V80C86 82.2 84.2 84 82 84H58V16Z" fill="#185C37" />
      <path d="M14 16H58V84H14C11.8 84 10 82.2 10 80V20C10 17.8 11.8 16 14 16Z" fill="#21A366" />
      <rect x="58" y="16" width="28" height="68" fill="#107C41" opacity="0.4" />
      <path d="M58 16V84" stroke="white" strokeWidth="2" opacity="0.3" />
      <path d="M58 42H86" stroke="white" strokeWidth="1.5" opacity="0.3" />
      <path d="M58 58H86" stroke="white" strokeWidth="1.5" opacity="0.3" />
      <text x="34" y="62" fill="white" fontSize="36" fontWeight="bold" fontFamily="Arial" textAnchor="middle">X</text>
    </svg>
  );
}

function GoogleDriveIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="18" fill="#F8F9FA" />
      <path d="M50 14L20 64H35L50 38L65 64H80L50 14Z" fill="#4285F4" />
      <path d="M20 64L8 85H46L58 64H20Z" fill="#34A853" />
      <path d="M80 64L92 85H54L42 64H80Z" fill="#FBBC04" />
      <path d="M35 64H65L50 38L35 64Z" fill="#4285F4" opacity="0.2" />
    </svg>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface SpaceStats {
  pages: number;
  databases: number;
  rows: number;
  imageCount: number;
  imageBytes: number;
}

interface SpacePreview {
  name: string;
  stats: SpaceStats;
}

interface ImportResult {
  name: string;
  workspaceId: string;
  imported: { pages: number; databases: number; rows: number; images: number };
}

type Step = 'idle' | 'analyzing' | 'preview' | 'importing' | 'done' | 'error';
type Source = 'notion' | 'okf' | null;

interface ImportTabProps {
  workspaceId: string;
}

// ── Notion import flow ─────────────────────────────────────────────────────────

function NotionImport({ onBack }: { onBack: () => void }) {
  const t = useTranslations('WorkspaceSettings');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [spaces, setSpaces] = useState<SpacePreview[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importImages, setImportImages] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState('');
  // Parsed export is held in a ref — it contains a JSZip instance (not
  // serializable) and never needs to trigger a re-render.
  const parsedRef = useRef<NotionParseResult | null>(null);

  function reset() {
    setFile(null);
    setStep('idle');
    setSpaces([]);
    setSelected(new Set());
    setImportImages(false);
    setResults([]);
    setError('');
    parsedRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  }

  // Parse the ZIP entirely in the browser (no upload). Reuses a prior parse of
  // the same file.
  async function parseFile(f: File): Promise<NotionParseResult> {
    if (parsedRef.current) return parsedRef.current;
    const buf = await f.arrayBuffer();
    const parsed = await parseNotionExport(buf);
    parsedRef.current = parsed;
    return parsed;
  }

  // Upload one image straight to Cloudinary via our existing /api/upload route
  // (each image is small — well under the per-file limits). Best-effort: a
  // failed image is simply skipped and its placeholder stripped from content.
  async function uploadImage(blob: Blob, name: string): Promise<string | null> {
    try {
      const form = new FormData();
      form.append('file', blob, name);
      form.append('kind', 'image');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.url as string) ?? null;
    } catch {
      return null;
    }
  }

  // Build a zipPath → Cloudinary URL map for one space's images.
  async function buildImageMap(parsed: NotionParseResult, space: NotionSpace): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const BATCH = 4;
    for (let i = 0; i < space.images.length; i += BATCH) {
      const batch = space.images.slice(i, i + BATCH);
      const uploaded = await Promise.all(
        batch.map(async ({ zipPath }) => {
          const blob = await getImageBlobFromZip(parsed.zip, zipPath);
          if (!blob) return { zipPath, url: null as string | null };
          const name = zipPath.split('/').pop() || 'image';
          return { zipPath, url: await uploadImage(blob, name) };
        }),
      );
      for (const { zipPath, url } of uploaded) {
        if (url) map.set(zipPath, url);
      }
    }
    return map;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    reset();
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith('.zip')) { reset(); setFile(f); }
  }

  async function handleAnalyze() {
    if (!file) return;
    setStep('analyzing');
    setError('');
    try {
      const parsed = await parseFile(file);
      const previews: SpacePreview[] = parsed.spaces.map(s => ({ name: s.name, stats: s.stats }));
      setSpaces(previews);
      setSelected(new Set<string>(previews.map(s => s.name)));
      setStep('preview');
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      setStep('error');
    }
  }

  async function handleImport() {
    if (!file || selected.size === 0) return;
    setStep('importing');
    setError('');
    try {
      const parsed = await parseFile(file);
      const collected: ImportResult[] = [];

      // One request per space keeps each JSON payload small (well under Vercel's
      // 4.5 MB body limit) and naturally splits very large imports.
      for (const space of parsed.spaces) {
        if (!selected.has(space.name)) continue;

        const imageMap = importImages && space.images.length > 0
          ? await buildImageMap(parsed, space)
          : new Map<string, string>();

        const items = materializeItems(space.items, imageMap);

        const res = await fetch('/api/import/notion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ space: { name: space.name, items } }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Import failed');

        collected.push({
          name: data.name,
          workspaceId: data.workspaceId,
          imported: { ...data.imported, images: imageMap.size },
        });
      }

      setResults(collected);
      setStep('done');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      setStep('error');
    }
  }

  function toggleSpace(name: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const selectedSpaces = spaces.filter(s => selected.has(s.name));
  const totalSelected = selectedSpaces.reduce(
    (acc, s) => ({
      pages: acc.pages + s.stats.pages,
      databases: acc.databases + s.stats.databases,
      rows: acc.rows + s.stats.rows,
      imageCount: acc.imageCount + s.stats.imageCount,
      imageBytes: acc.imageBytes + s.stats.imageBytes,
    }),
    { pages: 0, databases: 0, rows: 0, imageCount: 0, imageBytes: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer">
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-2">
          <NotionIcon size={18} />
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">{t('importTitle')}</h3>
            <p className="text-xs text-neutral-400">{t('importHint')}</p>
          </div>
        </div>
      </div>

      {/* How-to steps */}
      {step === 'idle' && (
        <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-300">{t('importStepsTitle')}</p>
          <ol className="space-y-1">
            {(['importStep1', 'importStep2', 'importStep3', 'importStep4'] as const).map((key, i) => (
              <li key={key} className="flex gap-2 text-xs text-neutral-400">
                <span className="text-neutral-600 shrink-0">{i + 1}.</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-neutral-500 mt-2">{t('importNote')}</p>
        </div>
      )}

      {/* Drop zone */}
      {(step === 'idle' || step === 'error') && (
        <div
          className={`border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            file ? 'border-blue-500/50 bg-blue-500/5' : 'border-neutral-700 hover:border-neutral-500'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileArchive size={24} className="text-blue-400" />
              <p className="text-sm text-neutral-200 font-medium truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-neutral-600" />
              <p className="text-sm text-neutral-400">{t('importDropZone')}</p>
              <p className="text-xs text-neutral-600">{t('importDropHint')}</p>
            </div>
          )}
        </div>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && (
        <div className="flex items-center gap-3 py-6 justify-center text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('importAnalyzing')}</span>
        </div>
      )}

      {/* Space selection */}
      {step === 'preview' && spaces.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-300">{t('importSpacesFound', { count: spaces.length })}</p>
            <div className="flex gap-3 text-xs text-neutral-500">
              <button onClick={() => setSelected(new Set(spaces.map(s => s.name)))} className="hover:text-neutral-300 cursor-pointer">{t('importSelectAll')}</button>
              <button onClick={() => setSelected(new Set())} className="hover:text-neutral-300 cursor-pointer">{t('importSelectNone')}</button>
            </div>
          </div>

          <div className="space-y-1">
            {spaces.map(space => {
              const isSelected = selected.has(space.name);
              return (
                <button
                  key={space.name}
                  onClick={() => toggleSpace(space.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border transition-colors text-left cursor-pointer ${
                    isSelected
                      ? 'border-blue-500/40 bg-blue-500/5 text-neutral-100'
                      : 'border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 shrink-0 border rounded-sm flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'}`}>
                    {isSelected && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                  <Layers size={13} className="shrink-0 text-neutral-500" />
                  <span className="flex-1 text-sm font-medium truncate">{space.name}</span>
                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-neutral-500">
                    {space.stats.pages > 0 && (
                      <span className="flex items-center gap-1"><FileText size={10} />{space.stats.pages}</span>
                    )}
                    {space.stats.databases > 0 && (
                      <span className="flex items-center gap-1"><Database size={10} />{space.stats.databases}</span>
                    )}
                    {space.stats.imageCount > 0 && (
                      <span className={`flex items-center gap-1 ${isSelected && importImages ? 'text-amber-400' : ''}`}>
                        <Image size={10} />
                        {space.stats.imageCount}
                        <span className="text-neutral-600">({formatBytes(space.stats.imageBytes)})</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {totalSelected.imageCount > 0 && (
            <div className="pt-3 mt-1 border-t border-neutral-800">
              <button onClick={() => setImportImages(v => !v)} className="w-full flex items-center gap-3 text-left cursor-pointer group">
                <div className={`w-4 h-4 shrink-0 border rounded-sm flex items-center justify-center transition-colors ${importImages ? 'bg-amber-500 border-amber-500' : 'border-neutral-600 group-hover:border-neutral-400'}`}>
                  {importImages && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-neutral-300 group-hover:text-neutral-200 transition-colors">{t('importIncludeImages')}</span>
                  <span className="ml-1.5 text-[11px] text-neutral-600">{totalSelected.imageCount} {t('importImageCount')} · {formatBytes(totalSelected.imageBytes)}</span>
                </div>
              </button>
              {importImages && <p className="text-[11px] text-amber-400/60 mt-2 pl-7">{t('importImagesWarning')}</p>}
            </div>
          )}

          {selected.size > 0 && (
            <p className="text-xs text-neutral-500">
              {t('importWillCreate', { count: selected.size })}
              {' · '}
              {t('importTotalItems', { pages: totalSelected.pages, databases: totalSelected.databases, rows: totalSelected.rows })}
              {importImages && totalSelected.imageCount > 0 && (
                <> · <span className="text-amber-400">{totalSelected.imageCount} {t('importImageCount')}</span></>
              )}
            </p>
          )}
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div className="flex flex-col items-center gap-2 py-8 text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('importRunning')}</span>
          {importImages && <span className="text-xs text-neutral-600">{t('importImagesUploading')}</span>}
        </div>
      )}

      {/* Results */}
      {step === 'done' && results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-green-400" />
            <p className="text-sm font-semibold text-green-300">{t('importSuccess')}</p>
          </div>
          <div className="space-y-1">
            {results.map(r => (
              <div key={r.workspaceId} className="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-800 text-xs">
                <div className="flex items-center gap-2">
                  <Layers size={12} className="text-neutral-500" />
                  <span className="text-neutral-200 font-medium">{r.name}</span>
                </div>
                <span className="text-neutral-500 flex items-center gap-2">
                  <span>{r.imported.pages}p · {r.imported.databases}db · {r.imported.rows}r</span>
                  {r.imported.images > 0 && (
                    <span className="flex items-center gap-1 text-amber-400/70"><Image size={10} />{r.imported.images}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500">{t('importRefreshHint')}</p>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 p-4">
          <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="text-xs text-red-300">
            <p className="font-semibold">{t('importFailed')}</p>
            <p className="text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {(step === 'idle' || step === 'error') && (
          <button
            onClick={handleAnalyze}
            disabled={!file}
            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('importAnalyze')}
          </button>
        )}
        {step === 'preview' && (
          <button
            onClick={handleImport}
            disabled={selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {t('importStart')} ({selected.size})
          </button>
        )}
        {(step !== 'idle' && step !== 'analyzing' && step !== 'importing') && (
          <button onClick={reset} className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer">
            {t('importReset')}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Source picker ──────────────────────────────────────────────────────────────

interface SourceCard {
  id: Source;
  icon: React.ReactNode;
  name: string;
  description: string;
  available: boolean;
}

export default function ImportTab({ workspaceId: _workspaceId }: ImportTabProps) {
  const t = useTranslations('WorkspaceSettings');
  const [source, setSource] = useState<Source>(null);

  if (source === 'notion') {
    return <NotionImport onBack={() => setSource(null)} />;
  }
  if (source === 'okf') {
    return <OkfImport onBack={() => setSource(null)} />;
  }

  const sources: SourceCard[] = [
    {
      id: 'okf',
      icon: <BookOpen size={32} className="text-blue-400" />,
      name: t('importSourceOkfName'),
      description: t('importSourceOkfDesc'),
      available: true,
    },
    {
      id: 'notion',
      icon: <NotionIcon size={32} />,
      name: 'Notion',
      description: t('importSourceNotionDesc'),
      available: true,
    },
    {
      id: null,
      icon: <ExcelIcon size={32} />,
      name: 'Microsoft Excel',
      description: t('importSourceExcelDesc'),
      available: false,
    },
    {
      id: null,
      icon: <GoogleDriveIcon size={32} />,
      name: 'Google Drive',
      description: t('importSourceDriveDesc'),
      available: false,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-100">{t('importSourceTitle')}</h3>
        <p className="text-xs text-neutral-400 mt-1">{t('importSourceHint')}</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {sources.map((src, i) => (
          <button
            key={i}
            onClick={() => src.available && src.id && setSource(src.id)}
            disabled={!src.available}
            className={`flex items-center gap-4 px-4 py-3.5 border text-left transition-colors ${
              src.available
                ? 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/40 cursor-pointer'
                : 'border-neutral-800 opacity-50 cursor-default'
            }`}
          >
            <div className="shrink-0">{src.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-200">{src.name}</span>
                {!src.available && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-800 text-neutral-500 border border-neutral-700 shrink-0">
                    {t('importSourceComingSoon')}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">{src.description}</p>
            </div>
            {src.available && (
              <span className="text-neutral-600 shrink-0">›</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
