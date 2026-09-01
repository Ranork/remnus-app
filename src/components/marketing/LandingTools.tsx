import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Columns3,
  Database,
  FilePlus2,
  Gauge,
  History,
  Layers,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { getTranslations } from 'next-intl/server';

// Canonical list of the current MCP surface — kept in sync with the actual
// server tool/resource/prompt set so the landing counts below stay accurate.
const TOOLS = [
  { scope: 'read',  tool: 'prepare_context' },
  { scope: 'read',  tool: 'search_workspace' },
  { scope: 'read',  tool: 'list_workspace' },
  { scope: 'read',  tool: 'get_page' },
  { scope: 'read',  tool: 'get_pages' },
  { scope: 'read',  tool: 'get_database_schema' },
  { scope: 'read',  tool: 'query_database' },
  { scope: 'read',  tool: 'list_members' },
  { scope: 'read',  tool: 'query_audit_log' },
  { scope: 'read',  tool: 'get_changes_since' },
  { scope: 'read',  tool: 'get_related_pages' },
  { scope: 'write', tool: 'create_page' },
  { scope: 'write', tool: 'update_page' },
  { scope: 'write', tool: 'bulk_update_pages' },
  { scope: 'write', tool: 'delete_page' },
  { scope: 'write', tool: 'bulk_delete_pages' },
  { scope: 'write', tool: 'move_item' },
  { scope: 'write', tool: 'bulk_move_items' },
  { scope: 'write', tool: 'create_database' },
  { scope: 'write', tool: 'update_database_schema' },
  { scope: 'write', tool: 'create_database_view' },
  { scope: 'write', tool: 'update_database_view' },
  { scope: 'write', tool: 'delete_database_view' },
  { scope: 'write', tool: 'add_comment' },
] as const;

const RESOURCES = [
  { uri: 'remnus://workspace/{id}/knowledge-health' },
  { uri: 'remnus://workspace/{id}/schema' },
  { uri: 'remnus://workspace/{id}/digest' },
  { uri: 'remnus://page/{id}' },
  { uri: 'remnus://database/{id}/schema' },
  { uri: 'remnus://audit-log/recent' },
] as const;

const PROMPTS = [
  { name: 'summarize-page' },
  { name: 'weekly-status-report' },
  { name: 'kanban-triage' },
  { name: 'extract-tasks' },
  { name: 'search-and-create' },
  { name: 'save-memory' },
  { name: 'recall-context' },
] as const;

// Curated highlights shown as cards on the landing page — the full 24-tool
// reference table lives at /wiki/read-tools. Picked to span discovery, query,
// live sync, creation, bulk ops, and schema control (3 read + 3 write).
const FLAGSHIP_TOOLS = [
  { tool: 'prepare_context',        scope: 'read',  icon: Sparkles,   descKey: 'bridgeToolsFlagshipContext' },
  { tool: 'query_database',         scope: 'read',  icon: Database,   descKey: 'bridgeToolsFlagshipQuery' },
  { tool: 'get_changes_since',      scope: 'read',  icon: History,    descKey: 'bridgeToolsFlagshipChanges' },
  { tool: 'create_page',            scope: 'write', icon: FilePlus2,  descKey: 'bridgeToolsFlagshipCreate' },
  { tool: 'bulk_update_pages',      scope: 'write', icon: Layers,     descKey: 'bridgeToolsFlagshipBulk' },
  { tool: 'update_database_schema', scope: 'write', icon: Columns3,   descKey: 'bridgeToolsFlagshipSchema' },
] as const;

const SCOPE_COLORS: Record<string, string> = {
  read:  'var(--color-opt-teal)',
  write: 'var(--color-amber-500)',
};

export default async function LandingTools() {
  const t = await getTranslations('Landing');

  return (
    <section id="tools" className="px-4 sm:px-8 lg:px-14 py-16 lg:py-27.5 bg-neutral-950">
      <div className="max-w-7xl mx-auto space-y-14">

        {/* ── Ortak MCP Başlık Bölümü ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-8 lg:mb-10">
            <span className="font-mono text-[11px] text-dim uppercase tracking-[0.18em]">
              {t('bridgeToolsSnum')}
            </span>
            <span className="flex-1 h-px bg-neutral-800" />
          </div>

          <div className="mb-8 lg:mb-9">
            <h2
              className="m-0 mb-1.5 font-sans font-semibold text-neutral-100 leading-[0.98] text-[26px] sm:text-[32px] lg:text-[40px]"
              style={{ letterSpacing: '-0.035em' }}
            >
              {t('bridgeToolsH2Part1')}{' '}
              <span className="font-serif italic text-accent-strong text-[30px] sm:text-[36px] lg:text-[44px]">
                {t('bridgeToolsH2Accent')}
              </span>{' '}
              {t('bridgeToolsH2Part2')}
            </h2>
            <p className="m-0 text-[14px] lg:text-[15px] text-dim">{t('bridgeToolsSubhead')}</p>
          </div>
        </div>

        {/* prepare_context: compact task-to-context-pack walkthrough */}
        <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
          <div className="border-b border-neutral-800 px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
                {t('bridgeContextDemoEyebrow')}
              </span>
              <span className="hidden h-3 w-px bg-neutral-800 sm:block" />
              <span className="font-mono text-[11px] text-dim">prepare_context</span>
            </div>
            <h3 className="mt-2 mb-0 font-sans text-[19px] font-semibold leading-tight text-neutral-100 sm:text-[22px]">
              {t('bridgeContextDemoTitle')}
            </h3>
          </div>

          <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_52px_minmax(0,1fr)]">
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-widest text-dim">
                  {t('bridgeContextDemoTaskLabel')}
                </span>
                <p className="m-0 text-[14px] leading-relaxed text-neutral-100">
                  “{t('bridgeContextDemoTask')}”
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-800 bg-neutral-850 px-2.5 py-1.5 font-mono text-[11px] text-dim">
                  <Gauge size={13} className="text-accent-strong" />
                  {t('bridgeContextDemoBudget')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-neutral-800 bg-neutral-850 px-2.5 py-1.5 font-mono text-[11px] text-dim">
                  <ShieldCheck size={13} className="text-green-400" />
                  {t('bridgeContextDemoPolicy')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center border-y border-neutral-800 py-3 lg:border-x lg:border-y-0 lg:py-0">
              <ArrowRight size={18} className="rotate-90 text-accent-strong lg:rotate-0" />
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-400/10">
                  <CheckCircle2 size={15} className="text-green-400" />
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-100">
                  {t('bridgeContextDemoReady')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="border-l-2 border-accent-strong pl-3">
                  <span className="block font-mono text-[18px] font-semibold text-neutral-100">6</span>
                  <span className="text-[11px] leading-tight text-dim">{t('bridgeContextDemoConcepts')}</span>
                </div>
                <div className="border-l-2 border-blue-500 pl-3">
                  <span className="block font-mono text-[18px] font-semibold text-neutral-100">~1,840</span>
                  <span className="text-[11px] leading-tight text-dim">{t('bridgeContextDemoTokens')}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-dim">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-green-400" />
                  {t('bridgeContextDemoReviewed')}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <TriangleAlert size={13} className="text-amber-500" />
                  {t('bridgeContextDemoWarning')}
                </span>
              </div>
            </div>
          </div>

          <p className="m-0 border-t border-neutral-800 bg-neutral-850/50 px-5 py-3 text-[12.5px] leading-relaxed text-dim sm:px-6">
            {t('bridgeContextDemoFooter')}
          </p>
        </div>

        {/* ── Flagship tools grid ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              {t('bridgeToolsSectionTools')} <span className="text-dim font-normal">({TOOLS.length})</span>
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FLAGSHIP_TOOLS.map((tool) => {
              const sc = SCOPE_COLORS[tool.scope];
              const Icon = tool.icon;
              return (
                <div
                  key={tool.tool}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3"
                >
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md"
                    style={{ background: `color-mix(in oklab, ${sc} 16%, transparent)` }}
                  >
                    <Icon size={17} style={{ color: sc }} />
                  </span>
                  <div className="space-y-1">
                    <span className="font-mono text-[13px] text-neutral-100 font-medium block">{tool.tool}</span>
                    <p className="m-0 text-[13px] text-dim leading-snug">{t(tool.descKey)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 px-1 pt-1 text-[12.5px]">
            <span className="text-dim">{t('bridgeToolsFooterText')}</span>
            <span className="flex-1" />
            <Link href="/wiki/read-tools" className="font-mono text-accent-strong shrink-0 hover:underline">
              {t('bridgeToolsReferenceLink')} ↗
            </Link>
          </div>
        </div>

        {/* ── Resources + Prompts: compact summary cards ──────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-blue-500 shrink-0" />
              <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
                {t('bridgeToolsSectionResources')} <span className="text-dim font-normal">({RESOURCES.length})</span>
              </h3>
            </div>
            <p className="m-0 text-[13px] text-dim leading-snug">{t('bridgeResourcesSubhead')}</p>
            <div className="flex flex-wrap gap-1.5">
              {RESOURCES.map((r) => (
                <span
                  key={r.uri}
                  className="font-mono text-[11px] text-dim bg-neutral-850 border border-neutral-800 rounded-xs px-1.75 py-0.5"
                >
                  {r.uri.replace('remnus://', '')}
                </span>
              ))}
            </div>
            <Link href="/wiki/resources" className="inline-block font-mono text-[12.5px] text-accent-strong hover:underline">
              {t('bridgeToolsReferenceLink')} ↗
            </Link>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500 shrink-0" />
              <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
                {t('bridgeToolsSectionPrompts')} <span className="text-dim font-normal">({PROMPTS.length})</span>
              </h3>
            </div>
            <p className="m-0 text-[13px] text-dim leading-snug">{t('bridgeToolsPromptsTagline')}</p>
            <div className="flex flex-wrap gap-1.5">
              {PROMPTS.map((p) => (
                <span
                  key={p.name}
                  className="font-mono text-[11px] text-dim bg-neutral-850 border border-neutral-800 rounded-xs px-1.75 py-0.5"
                >
                  {p.name}
                </span>
              ))}
            </div>
            <Link href="/wiki/prompts" className="inline-block font-mono text-[12.5px] text-accent-strong hover:underline">
              {t('bridgeToolsReferenceLink')} ↗
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
