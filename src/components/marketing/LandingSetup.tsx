import { ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import SetupGuideModal from './SetupGuideModal';

// A compact callout, not a full numbered section — the "3 steps to connect"
// pitch already lives in LandingIntegrations (intro copy + per-client Setup
// guide modal), so repeating it here as a whole section was redundant. This
// leads with the one claim that's actually differentiated: no API keys to
// manage. The full step-by-step is still one click away via SetupGuideModal.
export default async function LandingSetup() {
  const t = await getTranslations('Landing');

  return (
    <section className="px-4 sm:px-8 lg:px-14 pt-0 lg:pt-1 pb-8 lg:pb-10">
      <div className="max-w-[1280px] mx-auto">
        <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(480px circle at 6% 30%, color-mix(in oklab, var(--color-opt-teal) 12%, transparent), transparent 70%)',
            }}
          />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-7 p-6 sm:p-7">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <span
                className="shrink-0 w-12 h-12 rounded-full inline-flex items-center justify-center"
                style={{ background: 'color-mix(in oklab, var(--color-opt-teal) 16%, transparent)' }}
              >
                <ShieldCheck size={21} style={{ color: 'var(--color-opt-teal)' }} />
              </span>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="m-0 text-[16px] sm:text-[17px] font-semibold text-neutral-100 tracking-[-0.015em]">
                    {t('bridgeSetupStripTitle')}
                  </p>
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.08em] font-medium px-1.75 py-0.5 rounded-xs"
                    style={{ color: 'var(--color-opt-teal)', background: 'color-mix(in oklab, var(--color-opt-teal) 16%, transparent)' }}
                  >
                    OAuth 2.1
                  </span>
                </div>
                <p className="m-0 mt-1.5 text-[13.5px] text-dim leading-[1.55] max-w-xl">
                  {t('bridgeSetupStripBody')}
                </p>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch bg-neutral-800" />

            <div className="shrink-0">
              <SetupGuideModal
                variant="button"
                linkLabel={t('bridgeIntSetupLink')}
                title={t('bridgeSetupModalTitle')}
                subtitle={t('bridgeSetupModalSubtitle')}
                s1Label={t('bridgeSetupModalS1Label')}
                s1Title={t('bridgeSetupModalS1Title')}
                s1Body={t('bridgeSetupModalS1Body')}
                s2Label={t('bridgeSetupModalS2Label')}
                s2Title={t('bridgeSetupModalS2Title')}
                s2Body={t('bridgeSetupModalS2Body')}
                s3Label={t('bridgeSetupModalS3Label')}
                s3Title={t('bridgeSetupModalS3Title')}
                s3Body={t('bridgeSetupModalS3Body')}
                endpointLabel={t('bridgeSetupModalEndpointLabel')}
                headerLabel={t('bridgeSetupModalHeaderLabel')}
                docsNote={t('bridgeSetupModalDocsNote')}
                closeLabel={t('bridgeSetupModalClose')}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
