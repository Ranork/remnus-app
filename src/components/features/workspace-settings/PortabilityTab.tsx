'use client';

import { useEffect, useState } from 'react';
import { Activity, Archive, BrainCircuit, CheckCircle, Download, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getWorkspaceContextPolicy, updateWorkspaceContextPolicy } from '@/lib/actions/knowledge';
import type { ContextPolicy } from '@/lib/services/knowledge';

interface PortabilityTabProps {
  workspaceId: string;
  workspaceName: string;
}

interface ExportResult {
  concepts: number;
  warnings: number;
}

interface HealthReport {
  score: number;
  totalContentConcepts: number;
  governedConcepts: number;
  humanReviewedConcepts: number;
  unverifiedConcepts: number;
  staleConcepts: number;
  deprecatedConcepts: number;
  orphanConcepts: number;
  brokenReferences: number;
}

function safeDownloadName(workspaceName: string): string {
  const base = workspaceName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'remnus-workspace';
  return `${base}-okf.zip`;
}

export default function PortabilityTab({ workspaceId, workspaceName }: PortabilityTabProps) {
  const t = useTranslations('WorkspaceSettings');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [contextPolicy, setContextPolicy] = useState<ContextPolicy>({ mode: 'smart', autoMaxTokens: 2000, trustPolicy: 'prefer-human-reviewed' });
  const [policyBusy, setPolicyBusy] = useState<'load' | 'save' | null>('load');
  const [policySaved, setPolicySaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getWorkspaceContextPolicy(workspaceId)
      .then(policy => { if (!cancelled) setContextPolicy(policy); })
      .catch(() => { if (!cancelled) setError(t('contextPolicyLoadFailed')); })
      .finally(() => { if (!cancelled) setPolicyBusy(null); });
    return () => { cancelled = true; };
  }, [workspaceId, t]);

  async function saveContextPolicy() {
    setPolicyBusy('save');
    setPolicySaved(false);
    setError('');
    try {
      setContextPolicy(await updateWorkspaceContextPolicy(workspaceId, contextPolicy));
      setPolicySaved(true);
    } catch {
      setError(t('contextPolicySaveFailed'));
    } finally {
      setPolicyBusy(null);
    }
  }

  async function scanHealth() {
    setIsScanning(true);
    setError('');
    try {
      const response = await fetch(`/api/export/okf?workspaceId=${encodeURIComponent(workspaceId)}&mode=report`);
      if (!response.ok) throw new Error(t('portabilityHealthFailed'));
      const data = await response.json() as { health: HealthReport };
      setHealth(data.health);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t('portabilityHealthFailed'));
    } finally {
      setIsScanning(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/export/okf?workspaceId=${encodeURIComponent(workspaceId)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || t('portabilityExportFailed'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = safeDownloadName(workspaceName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setResult({
        concepts: Number(response.headers.get('X-Remnus-OKF-Concepts') ?? 0),
        warnings: Number(response.headers.get('X-Remnus-OKF-Warnings') ?? 0),
      });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : t('portabilityExportFailed'));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-neutral-100">{t('portabilityTitle')}</h3>
        <p className="text-xs text-neutral-400 mt-1">{t('portabilityHint')}</p>
      </div>

      <div className="border-y border-neutral-800 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <Archive size={17} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-neutral-200">{t('portabilityFormatTitle')}</p>
            <p className="text-xs text-neutral-500 mt-1">{t('portabilityFormatDesc')}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <FileText size={13} className="text-neutral-500 shrink-0" />
            <span>{t('portabilityIncludesContent')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <ShieldCheck size={13} className="text-neutral-500 shrink-0" />
            <span>{t('portabilityIncludesValidation')}</span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-600">{t('portabilityPrivacy')}</p>
      </div>

      <div className="space-y-3 border-b border-neutral-800 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Activity size={17} className="mt-0.5 shrink-0 text-green-400" />
            <div>
              <p className="text-sm font-semibold text-neutral-200">{t('portabilityHealthTitle')}</p>
              <p className="mt-1 text-xs text-neutral-500">{t('portabilityHealthDesc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={scanHealth}
            disabled={isScanning}
            className="inline-flex shrink-0 items-center gap-1.5 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
            {isScanning ? t('portabilityHealthScanning') : t('portabilityHealthScan')}
          </button>
        </div>
        {health && (
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-neutral-800 bg-neutral-800 sm:grid-cols-4">
            <div className="bg-neutral-900 p-3">
              <p className="text-[10px] uppercase tracking-wide text-neutral-500">{t('portabilityHealthScore')}</p>
              <p className="mt-1 text-xl font-semibold text-green-300">{health.score}<span className="text-xs text-neutral-600">/100</span></p>
            </div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthReviewed')}</p><p className="mt-1 text-sm text-neutral-200">{health.humanReviewedConcepts}/{health.governedConcepts}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthStale')}</p><p className="mt-1 text-sm text-neutral-200">{health.staleConcepts}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthOrphans')}</p><p className="mt-1 text-sm text-neutral-200">{health.orphanConcepts}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthUnverified')}</p><p className="mt-1 text-sm text-neutral-200">{health.unverifiedConcepts}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthBroken')}</p><p className="mt-1 text-sm text-neutral-200">{health.brokenReferences}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthDeprecated')}</p><p className="mt-1 text-sm text-neutral-200">{health.deprecatedConcepts}</p></div>
            <div className="bg-neutral-900 p-3"><p className="text-[10px] text-neutral-500">{t('portabilityHealthTotal')}</p><p className="mt-1 text-sm text-neutral-200">{health.totalContentConcepts}</p></div>
          </div>
        )}
        {health && <p className="text-[10px] text-neutral-600">{t('portabilityHealthMethod')}</p>}
      </div>

      <div className="space-y-4 border-b border-neutral-800 pb-5">
        <div className="flex items-start gap-3">
          <BrainCircuit size={17} className="mt-0.5 shrink-0 text-blue-400" />
          <div>
            <p className="text-sm font-semibold text-neutral-200">{t('contextPolicyTitle')}</p>
            <p className="mt-1 text-xs text-neutral-500">{t('contextPolicyDesc')}</p>
          </div>
        </div>
        {policyBusy === 'load' ? <Loader2 size={14} className="animate-spin text-neutral-500" /> : (
          <>
            <div className="grid gap-px border border-neutral-800 bg-neutral-800 sm:grid-cols-3">
              {(['manual', 'smart', 'strict'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => { setPolicySaved(false); setContextPolicy(current => ({ ...current, mode })); }} className={`bg-neutral-900 p-3 text-left transition-colors hover:bg-neutral-850 cursor-pointer ${contextPolicy.mode === mode ? 'text-blue-300 ring-1 ring-inset ring-blue-500' : 'text-neutral-400'}`}>
                  <span className="block text-xs font-semibold">{t(`contextPolicyMode.${mode}.title`)}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-neutral-500">{t(`contextPolicyMode.${mode}.desc`)}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] text-neutral-500">
                <span>{t('contextPolicyBudget')}</span>
                <select value={contextPolicy.autoMaxTokens} onChange={event => setContextPolicy(current => ({ ...current, autoMaxTokens: Number(event.target.value) }))} className="w-full border-b border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs text-neutral-200 outline-none">
                  <option value={1000}>1,000</option><option value={2000}>2,000</option><option value={4000}>4,000</option><option value={6000}>6,000</option>
                </select>
              </label>
              <label className="space-y-1 text-[11px] text-neutral-500">
                <span>{t('contextPolicyTrust')}</span>
                <select value={contextPolicy.trustPolicy} onChange={event => setContextPolicy(current => ({ ...current, trustPolicy: event.target.value as ContextPolicy['trustPolicy'] }))} className="w-full border-b border-neutral-700 bg-neutral-900 px-1 py-1.5 text-xs text-neutral-200 outline-none">
                  <option value="any">{t('contextPolicyTrustAny')}</option>
                  <option value="prefer-human-reviewed">{t('contextPolicyTrustPrefer')}</option>
                  <option value="human-reviewed-only">{t('contextPolicyTrustOnly')}</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={saveContextPolicy} disabled={!!policyBusy} className="inline-flex items-center gap-1.5 bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer">
                {policyBusy === 'save' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}{t('contextPolicySave')}
              </button>
              {policySaved && <span className="text-[10px] text-green-300">{t('contextPolicySaved')}</span>}
            </div>
            <p className="text-[10px] leading-relaxed text-neutral-600">{t('contextPolicySecurity')}</p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {isExporting ? t('portabilityExporting') : t('portabilityExport')}
        </button>

        {result && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-300">
            <CheckCircle size={13} />
            {t('portabilityExportSuccess', { concepts: result.concepts, warnings: result.warnings })}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-300 border-l-2 border-red-400 pl-3">{error}</p>}
    </div>
  );
}
