'use client';

import { useEffect, useState } from 'react';
import { Archive, CheckCircle, Download, FileText, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { getWorkspaceContextPolicy, updateWorkspaceContextPolicy } from '@/lib/actions/knowledge';
import type { ContextPolicy } from '@/lib/services/knowledge';
import { SimpleSelect } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Field, SettingsPage, SettingsSection } from '@/components/ui/settings';

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
  const locale = useLocale();
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

  const healthCells: [string, React.ReactNode][] = health
    ? [
        [t('portabilityHealthReviewed'), `${health.humanReviewedConcepts}/${health.governedConcepts}`],
        [t('portabilityHealthStale'), health.staleConcepts],
        [t('portabilityHealthOrphans'), health.orphanConcepts],
        [t('portabilityHealthUnverified'), health.unverifiedConcepts],
        [t('portabilityHealthBroken'), health.brokenReferences],
        [t('portabilityHealthDeprecated'), health.deprecatedConcepts],
        [t('portabilityHealthTotal'), health.totalContentConcepts],
      ]
    : [];

  return (
    <SettingsPage>
      <SettingsSection title={t('portabilityTitle')} description={t('portabilityHint')}>
        <div className="flex items-start gap-2.5">
          <Archive size={16} className="mt-0.5 shrink-0 text-fg-3" />
          <div className="min-w-0">
            <p className="text-ui font-medium text-fg">{t('portabilityFormatTitle')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{t('portabilityFormatDesc')}</p>
          </div>
        </div>
        <ul className="grid gap-1.5 pl-6.5 sm:grid-cols-2">
          <li className="flex items-center gap-2 text-xs text-fg-2">
            <FileText size={14} className="shrink-0 text-fg-4" />
            {t('portabilityIncludesContent')}
          </li>
          <li className="flex items-center gap-2 text-xs text-fg-2">
            <ShieldCheck size={14} className="shrink-0 text-fg-4" />
            {t('portabilityIncludesValidation')}
          </li>
        </ul>
        <p className="pl-6.5 text-xs leading-relaxed text-fg-3">{t('portabilityPrivacy')}</p>
        <div className="flex flex-wrap items-center gap-3 pl-6.5">
          <Button variant="primary" onClick={handleExport} loading={isExporting}>
            <Download />
            {t('portabilityExport')}
          </Button>
          {result && (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs text-fg-2">
              <CheckCircle size={14} className="text-green-400" />
              {t('portabilityExportSuccess', { concepts: result.concepts, warnings: result.warnings })}
            </span>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('portabilityHealthTitle')}
        description={t('portabilityHealthDesc')}
        action={
          <Button size="sm" onClick={scanHealth} loading={isScanning}>
            <RefreshCw />
            {t('portabilityHealthScan')}
          </Button>
        }
      >
        {health && (
          <>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-surface bg-line shadow-[0_0_0_1px_var(--color-line)] sm:grid-cols-4">
              <div className="bg-float p-3">
                <dt className="text-xs text-fg-3">{t('portabilityHealthScore')}</dt>
                <dd className="mt-1 text-xl font-semibold text-fg">
                  {health.score}<span className="text-xs font-normal text-fg-3">/100</span>
                </dd>
              </div>
              {healthCells.map(([label, value]) => (
                <div key={label} className="bg-float p-3">
                  <dt className="text-xs text-fg-3">{label}</dt>
                  <dd className="mt-1 text-ui text-fg">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-fg-3">{t('portabilityHealthMethod')}</p>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={t('contextPolicyTitle')} description={t('contextPolicyDesc')}>
        {policyBusy === 'load' ? (
          <Loader2 size={16} className="animate-spin text-fg-3" />
        ) : (
          <>
            <RadioGroup
              value={contextPolicy.mode}
              onValueChange={(mode) => {
                setPolicySaved(false);
                setContextPolicy(current => ({ ...current, mode: mode as ContextPolicy['mode'] }));
              }}
              aria-label={t('contextPolicyTitle')}
              className="grid gap-2 sm:grid-cols-3"
            >
              {(['manual', 'smart', 'strict'] as const).map(mode => (
                <Radio.Root
                  key={mode}
                  value={mode}
                  className="group flex cursor-pointer flex-col gap-1 rounded-control p-3 text-left shadow-[inset_0_0_0_1px_var(--color-line)] transition-shadow select-none hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] data-checked:shadow-[inset_0_0_0_1.5px_var(--color-signal)]"
                >
                  <span className="flex items-center gap-2 text-ui font-medium text-fg-2 group-data-checked:text-fg">
                    <span
                      aria-hidden
                      className="flex size-3.5 shrink-0 items-center justify-center rounded-full shadow-[inset_0_0_0_1px_var(--color-line-strong)] group-data-checked:bg-signal group-data-checked:shadow-none"
                    >
                      <span className="size-1.5 rounded-full bg-signal-fg opacity-0 group-data-checked:opacity-100" />
                    </span>
                    {t(`contextPolicyMode.${mode}.title`)}
                  </span>
                  <span className="text-xs leading-relaxed text-fg-3">{t(`contextPolicyMode.${mode}.desc`)}</span>
                </Radio.Root>
              ))}
            </RadioGroup>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('contextPolicyBudget')}>
                <SimpleSelect
                  value={String(contextPolicy.autoMaxTokens)}
                  onValueChange={value => { setPolicySaved(false); setContextPolicy(current => ({ ...current, autoMaxTokens: Number(value) })); }}
                  options={[1000, 2000, 4000, 6000].map(n => ({ value: String(n), label: n.toLocaleString(locale) }))}
                  aria-label={t('contextPolicyBudget')}
                  className="w-full"
                />
              </Field>
              <Field label={t('contextPolicyTrust')}>
                <SimpleSelect
                  value={contextPolicy.trustPolicy}
                  onValueChange={value => { setPolicySaved(false); setContextPolicy(current => ({ ...current, trustPolicy: value as ContextPolicy['trustPolicy'] })); }}
                  options={[
                    { value: 'any', label: t('contextPolicyTrustAny') },
                    { value: 'prefer-human-reviewed', label: t('contextPolicyTrustPrefer') },
                    { value: 'human-reviewed-only', label: t('contextPolicyTrustOnly') },
                  ]}
                  aria-label={t('contextPolicyTrust')}
                  className="w-full"
                />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={saveContextPolicy} loading={policyBusy === 'save'}>
                {t('contextPolicySave')}
              </Button>
              {policySaved && (
                <span role="status" className="inline-flex items-center gap-1.5 text-xs text-fg-2">
                  <CheckCircle size={14} className="text-green-400" />
                  {t('contextPolicySaved')}
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-fg-3">{t('contextPolicySecurity')}</p>
          </>
        )}
      </SettingsSection>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    </SettingsPage>
  );
}
