'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle, Layers, FileText, Database, Image as ImageIcon, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';
import { cn } from '@/lib/cn';
import { DropZone, ImportError, ImportHeader, Working, formatBytes } from './importParts';
import OkfImport from '@/components/features/workspace-settings/OkfImport';
import {
  parseNotionExport,
  materializeItems,
  getImageBlobFromZip,
  type NotionParseResult,
  type NotionSpace,
} from '@/lib/import/notion-parser';

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
    <SettingsPage>
      <ImportHeader
        icon={<NotionIcon size={20} />}
        title={t('importTitle')}
        hint={t('importHint')}
        backLabel={t('okfImportBack')}
        onBack={onBack}
      />

      {/* How-to steps */}
      {step === 'idle' && (
        <SettingsSection title={t('importStepsTitle')}>
          <ol className="flex flex-col gap-1.5">
            {(['importStep1', 'importStep2', 'importStep3', 'importStep4'] as const).map((key, i) => (
              <li key={key} className="flex gap-2 text-xs leading-relaxed text-fg-2">
                <span className="w-4 shrink-0 text-fg-4">{i + 1}.</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs leading-relaxed text-fg-3">{t('importNote')}</p>
        </SettingsSection>
      )}

      {/* Drop zone */}
      {(step === 'idle' || step === 'error') && (
        <DropZone
          file={file}
          onPick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          label={t('importDropZone')}
          hint={t('importDropHint')}
        >
          <input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={handleFileChange} />
        </DropZone>
      )}

      {/* Analyzing */}
      {step === 'analyzing' && <Working label={t('importAnalyzing')} />}

      {/* Space selection */}
      {step === 'preview' && spaces.length > 0 && (
        <SettingsSection
          title={t('importSpacesFound', { count: spaces.length })}
          action={
            <>
              <Button variant="ghost" size="xs" onClick={() => setSelected(new Set(spaces.map(s => s.name)))}>{t('importSelectAll')}</Button>
              <Button variant="ghost" size="xs" onClick={() => setSelected(new Set())}>{t('importSelectNone')}</Button>
            </>
          }
        >
          <div className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
            {spaces.map(space => {
              const isSelected = selected.has(space.name);
              return (
                <label
                  key={space.name}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-hover/50"
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSpace(space.name)} />
                  <Layers size={14} className="shrink-0 text-fg-3" />
                  <span className={cn('min-w-0 flex-1 truncate text-ui font-medium', isSelected ? 'text-fg' : 'text-fg-2')}>{space.name}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-fg-3">
                    {space.stats.pages > 0 && (
                      <span className="flex items-center gap-1"><FileText size={12} />{space.stats.pages}</span>
                    )}
                    {space.stats.databases > 0 && (
                      <span className="flex items-center gap-1"><Database size={12} />{space.stats.databases}</span>
                    )}
                    {space.stats.imageCount > 0 && (
                      <span className="flex items-center gap-1" title={formatBytes(space.stats.imageBytes)}>
                        <ImageIcon size={12} />
                        {space.stats.imageCount}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {totalSelected.imageCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <Checkbox checked={importImages} onCheckedChange={(v) => setImportImages(v)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="text-ui font-medium text-fg">{t('importIncludeImages')}</span>
                  <span className="mt-0.5 block text-xs text-fg-3">
                    {totalSelected.imageCount} {t('importImageCount')}, {formatBytes(totalSelected.imageBytes)}
                  </span>
                </span>
              </label>
              {importImages && <p className="pl-6.5 text-xs leading-relaxed text-amber-400">{t('importImagesWarning')}</p>}
            </div>
          )}

          {selected.size > 0 && (
            <div className="flex flex-col gap-0.5 text-xs text-fg-3">
              <p>{t('importWillCreate', { count: selected.size })}</p>
              <p>{t('importTotalItems', { pages: totalSelected.pages, databases: totalSelected.databases, rows: totalSelected.rows })}</p>
            </div>
          )}
        </SettingsSection>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <Working label={t('importRunning')} hint={importImages ? t('importImagesUploading') : undefined} />
      )}

      {/* Results */}
      {step === 'done' && results.length > 0 && (
        <SettingsSection>
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <CheckCircle size={16} className="text-green-400" />
            {t('importSuccess')}
          </p>
          <div className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
            {results.map(r => (
              <div key={r.workspaceId} className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="flex min-w-0 items-center gap-2 text-ui font-medium text-fg">
                  <Layers size={14} className="shrink-0 text-fg-3" />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="flex items-center gap-3 text-xs text-fg-3">
                  <span>{t('importTotalItems', { pages: r.imported.pages, databases: r.imported.databases, rows: r.imported.rows })}</span>
                  {r.imported.images > 0 && (
                    <span className="flex items-center gap-1"><ImageIcon size={12} />{r.imported.images}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-fg-3">{t('importRefreshHint')}</p>
        </SettingsSection>
      )}

      {/* Error */}
      {step === 'error' && (
        <ImportError title={t('importFailed')} message={error} />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {(step === 'idle' || step === 'error') && (
          <Button variant="primary" onClick={handleAnalyze} disabled={!file}>
            {t('importAnalyze')}
          </Button>
        )}
        {step === 'preview' && (
          <Button variant="primary" onClick={handleImport} disabled={selected.size === 0}>
            {t('importStart')} ({selected.size})
          </Button>
        )}
        {(step !== 'idle' && step !== 'analyzing' && step !== 'importing') && (
          <Button variant="ghost" onClick={reset}>
            {t('importReset')}
          </Button>
        )}
      </div>
    </SettingsPage>
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
      icon: <BookOpen size={28} className="text-fg-2" />,
      name: t('importSourceOkfName'),
      description: t('importSourceOkfDesc'),
      available: true,
    },
    {
      id: 'notion',
      icon: <NotionIcon size={28} />,
      name: 'Notion',
      description: t('importSourceNotionDesc'),
      available: true,
    },
    {
      id: null,
      icon: <ExcelIcon size={28} />,
      name: 'Microsoft Excel',
      description: t('importSourceExcelDesc'),
      available: false,
    },
    {
      id: null,
      icon: <GoogleDriveIcon size={28} />,
      name: 'Google Drive',
      description: t('importSourceDriveDesc'),
      available: false,
    },
  ];

  return (
    <SettingsPage>
      <SettingsSection title={t('importSourceTitle')} description={t('importSourceHint')}>
        <div className="flex flex-col divide-y divide-line rounded-surface shadow-[inset_0_0_0_1px_var(--color-line)]">
          {sources.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => src.available && src.id && setSource(src.id)}
              disabled={!src.available}
              className="flex items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-surface last:rounded-b-surface enabled:cursor-pointer enabled:hover:bg-hover/50 disabled:opacity-50"
            >
              <span className="shrink-0">{src.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-ui font-medium text-fg">{src.name}</span>
                  {!src.available && <Badge size="sm">{t('importSourceComingSoon')}</Badge>}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-fg-3">{src.description}</span>
              </span>
              {src.available && <ChevronRight size={16} className="shrink-0 text-fg-4" />}
            </button>
          ))}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
