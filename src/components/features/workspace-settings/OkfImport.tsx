'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle, BookOpen, CheckCircle, Link2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsPage, SettingsSection } from '@/components/ui/settings';
import { DropZone, ImportError, ImportHeader, Working } from './importParts';
import { isSafeOkfImportPayload, parseOkfBundle } from '@/lib/import/okf-parser';
import type { OkfImportPreview } from '@/lib/okf/types';

type Step = 'idle' | 'analyzing' | 'preview' | 'importing' | 'done' | 'error';

interface ImportResult {
  workspaceId: string;
  name: string;
  imported: { concepts: number; links: number };
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
    <SettingsPage>
      <ImportHeader
        icon={<BookOpen size={18} className="text-fg-2" />}
        title={t('okfImportTitle')}
        hint={t('okfImportHint')}
        backLabel={t('okfImportBack')}
        onBack={onBack}
      />

      {(step === 'idle' || step === 'error') && (
        <DropZone
          file={file}
          onPick={() => inputRef.current?.click()}
          onDrop={event => {
            event.preventDefault();
            chooseFile(event.dataTransfer.files[0] ?? null);
          }}
          label={t('okfImportDropZone')}
          hint={t('okfImportDropHint')}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          />
        </DropZone>
      )}

      {step === 'analyzing' && <Working label={t('okfImportAnalyzing')} />}

      {step === 'preview' && preview && (
        <SettingsSection>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-surface bg-line shadow-[0_0_0_1px_var(--color-line)] sm:grid-cols-4">
            {[
              [t('okfImportConcepts'), preview.stats.concepts],
              [t('okfImportLinks'), preview.stats.brokenLinks],
              [t('okfImportAssets'), preview.stats.assets],
              [t('okfImportVersion'), preview.version ?? t('okfImportUnknown')],
            ].map(([label, value]) => (
              <div key={label} className="bg-float px-3 py-2.5">
                <dt className="text-xs text-fg-3">{label}</dt>
                <dd className="mt-1 text-ui font-semibold text-fg">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-2">
            <Badge variant={warningCount ? 'neutral' : 'outline'}>
              <AlertCircle className={warningCount ? 'text-amber-400' : undefined} />
              {t('okfImportWarnings')}: {warningCount}
            </Badge>
            <Badge variant={errorCount ? 'danger' : 'success'}>
              <ShieldCheck />
              {t('okfImportErrors')}: {errorCount}
            </Badge>
          </div>

          {preview.stats.executableConcepts > 0 && (
            <p className="flex items-start gap-2 rounded-control bg-amber-500/10 p-3 text-xs leading-relaxed text-fg-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-400" />
              {t('okfImportInertComputations', { count: preview.stats.executableConcepts })}
            </p>
          )}

          {preview.issues.length > 0 && (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto border-y border-line py-2">
              {preview.issues.slice(0, 20).map((issue, index) => (
                <li key={`${issue.code}-${issue.path}-${index}`} className="flex items-start gap-2 px-1 text-xs">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${issue.severity === 'error' ? 'bg-red-400' : 'bg-amber-400'}`}
                  />
                  <span className="min-w-0 text-fg-2">
                    <span className="font-mono text-fg-3">{issue.path}</span>: {t('okfImportIssueLabel', { code: issue.code })}
                  </span>
                </li>
              ))}
              {preview.issues.length > 20 && (
                <li className="px-1 text-xs text-fg-3">{t('okfImportMoreIssues', { count: preview.issues.length - 20 })}</li>
              )}
            </ul>
          )}

          <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-3">
            <Link2 size={14} className="mt-0.5 shrink-0" />
            {t('okfImportDryRunNote')}
          </p>
        </SettingsSection>
      )}

      {step === 'importing' && <Working label={t('okfImportRunning')} />}

      {step === 'done' && result && (
        <SettingsSection>
          <p className="flex items-center gap-2 text-sm font-semibold text-fg">
            <CheckCircle size={16} className="text-green-400" />
            {t('okfImportSuccess')}
          </p>
          <p className="text-xs text-fg-2">
            {t('okfImportResult', { concepts: result.imported.concepts, links: result.imported.links })}
          </p>
        </SettingsSection>
      )}

      {step === 'error' && error && <ImportError message={error} />}

      <div className="flex items-center gap-2">
        {(step === 'idle' || step === 'error') && (
          <Button variant="primary" onClick={analyze} disabled={!file}>
            {t('okfImportAnalyze')}
          </Button>
        )}
        {step === 'preview' && preview && (
          <Button variant="primary" onClick={startImport} disabled={!isSafeOkfImportPayload(preview)}>
            {t('okfImportStart')}
          </Button>
        )}
        {(step === 'preview' || step === 'done') && (
          <Button variant="ghost" onClick={() => reset()}>
            {t('importReset')}
          </Button>
        )}
      </div>
    </SettingsPage>
  );
}
