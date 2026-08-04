'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle,
  FileArchive,
  Link2,
  Loader2,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { isSafeOkfImportPayload, parseOkfBundle } from '@/lib/import/okf-parser';
import type { OkfImportPreview } from '@/lib/okf/types';

type Step = 'idle' | 'analyzing' | 'preview' | 'importing' | 'done' | 'error';

interface ImportResult {
  workspaceId: string;
  name: string;
  imported: { concepts: number; links: number };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function OkfImport({ onBack }: { onBack: () => void }) {
  const t = useTranslations('WorkspaceSettings');
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OkfImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');

  function reset(nextFile: File | null = null) {
    setFile(nextFile);
    setPreview(null);
    setResult(null);
    setStep('idle');
    setError('');
    if (!nextFile && inputRef.current) inputRef.current.value = '';
  }

  function chooseFile(nextFile: File | null) {
    if (!nextFile) return;
    reset(nextFile);
  }

  async function analyze() {
    if (!file) return;
    setStep('analyzing');
    setError('');
    try {
      const parsed = await parseOkfBundle(await file.arrayBuffer(), file.name);
      setPreview(parsed);
      setStep('preview');
    } catch {
      setError(t('okfImportAnalyzeFailed'));
      setStep('error');
    }
  }

  async function startImport() {
    if (!preview || !isSafeOkfImportPayload(preview)) return;
    setStep('importing');
    setError('');
    try {
      const response = await fetch('/api/import/okf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundleName: preview.bundleName,
          version: preview.version,
          concepts: preview.concepts,
        }),
      });
      const data = await response.json() as ImportResult & { error?: string };
      if (!response.ok) {
        const message = data.error === 'workspaceLimitReached'
          ? t('okfImportWorkspaceLimit')
          : t('okfImportFailed');
        throw new Error(message);
      }
      setResult(data);
      setStep('done');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('okfImportFailed'));
      setStep('error');
    }
  }

  const warningCount = preview?.issues.filter(issue => issue.severity === 'warning').length ?? 0;
  const errorCount = preview?.issues.filter(issue => issue.severity === 'error').length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('okfImportBack')}
          className="p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
        </button>
        <BookOpen size={18} className="text-blue-400" />
        <div>
          <h3 className="text-sm font-semibold text-neutral-100">{t('okfImportTitle')}</h3>
          <p className="text-xs text-neutral-400">{t('okfImportHint')}</p>
        </div>
      </div>

      {(step === 'idle' || step === 'error') && (
        <div
          className={`border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            file ? 'border-blue-500/50 bg-blue-500/5' : 'border-neutral-700 hover:border-neutral-500'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => event.preventDefault()}
          onDrop={event => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileArchive size={24} className="text-blue-400" />
              <p className="max-w-xs truncate text-sm font-medium text-neutral-200">{file.name}</p>
              <p className="text-xs text-neutral-500">{formatBytes(file.size)}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload size={24} className="text-neutral-600" />
              <p className="text-sm text-neutral-400">{t('okfImportDropZone')}</p>
              <p className="text-xs text-neutral-600">{t('okfImportDropHint')}</p>
            </div>
          )}
        </div>
      )}

      {step === 'analyzing' && (
        <div className="flex items-center justify-center gap-3 py-8 text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('okfImportAnalyzing')}</span>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-neutral-800 bg-neutral-800 sm:grid-cols-4">
            {[
              [t('okfImportConcepts'), preview.stats.concepts],
              [t('okfImportLinks'), preview.stats.brokenLinks],
              [t('okfImportAssets'), preview.stats.assets],
              [t('okfImportVersion'), preview.version ?? t('okfImportUnknown')],
            ].map(([label, value]) => (
              <div key={label} className="bg-neutral-900 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-neutral-200">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-amber-300">
              <AlertCircle size={12} /> {t('okfImportWarnings')}: {warningCount}
            </span>
            <span className={`flex items-center gap-1.5 border px-2 py-1 ${errorCount ? 'border-red-500/30 bg-red-500/5 text-red-300' : 'border-green-500/30 bg-green-500/5 text-green-300'}`}>
              <ShieldCheck size={12} /> {t('okfImportErrors')}: {errorCount}
            </span>
          </div>

          {preview.stats.executableConcepts > 0 && (
            <div className="border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              {t('okfImportInertComputations', { count: preview.stats.executableConcepts })}
            </div>
          )}

          {preview.issues.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto border-y border-neutral-800 py-2">
              {preview.issues.slice(0, 20).map((issue, index) => (
                <div key={`${issue.code}-${issue.path}-${index}`} className="flex items-start gap-2 px-1 text-xs">
                  <span className={issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'}>•</span>
                  <span className="min-w-0 text-neutral-400">
                    <span className="font-mono text-neutral-500">{issue.path}</span>: {t('okfImportIssueLabel', { code: issue.code })}
                  </span>
                </div>
              ))}
              {preview.issues.length > 20 && (
                <p className="px-1 text-xs text-neutral-500">{t('okfImportMoreIssues', { count: preview.issues.length - 20 })}</p>
              )}
            </div>
          )}

          <p className="flex items-start gap-2 text-xs text-neutral-500">
            <Link2 size={13} className="mt-0.5 shrink-0" />
            {t('okfImportDryRunNote')}
          </p>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex items-center justify-center gap-3 py-8 text-neutral-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('okfImportRunning')}</span>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-3 border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-2 text-green-300">
            <CheckCircle size={15} />
            <p className="text-sm font-semibold">{t('okfImportSuccess')}</p>
          </div>
          <p className="text-xs text-neutral-300">
            {t('okfImportResult', { concepts: result.imported.concepts, links: result.imported.links })}
          </p>
        </div>
      )}

      {step === 'error' && error && (
        <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 p-4">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {(step === 'idle' || step === 'error') && (
          <button
            type="button"
            onClick={analyze}
            disabled={!file}
            className="bg-neutral-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {t('okfImportAnalyze')}
          </button>
        )}
        {step === 'preview' && preview && (
          <button
            type="button"
            onClick={startImport}
            disabled={!isSafeOkfImportPayload(preview)}
            className="bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            {t('okfImportStart')}
          </button>
        )}
        {(step === 'preview' || step === 'done') && (
          <button type="button" onClick={() => reset()} className="text-xs text-neutral-500 transition-colors hover:text-neutral-300 cursor-pointer">
            {t('importReset')}
          </button>
        )}
      </div>
    </div>
  );
}
