import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

const TOOLS = [
  { scope: 'read',  tool: 'search_workspace',        descKey: 'bridgeToolsDescSearch' },
  { scope: 'read',  tool: 'list_workspace',          descKey: 'bridgeToolsDescListWorkspace' },
  { scope: 'read',  tool: 'get_page',                descKey: 'bridgeToolsDescGetPage' },
  { scope: 'read',  tool: 'get_database_schema',     descKey: 'bridgeToolsDescGetDatabaseSchema' },
  { scope: 'read',  tool: 'query_database',          descKey: 'bridgeToolsDescQueryDatabase' },
  { scope: 'read',  tool: 'list_members',            descKey: 'bridgeToolsDescListMembers' },
  { scope: 'read',  tool: 'query_audit_log',         descKey: 'bridgeToolsDescQueryAuditLog' },
  { scope: 'read',  tool: 'get_changes_since',       descKey: 'bridgeToolsDescGetChangesSince' },
  { scope: 'read',  tool: 'get_related_pages',       descKey: 'bridgeToolsDescGetRelatedPages' },
  { scope: 'write', tool: 'create_page',             descKey: 'bridgeToolsDescCreatePage' },
  { scope: 'write', tool: 'update_page',             descKey: 'bridgeToolsDescUpdatePage' },
  { scope: 'write', tool: 'bulk_update_pages',       descKey: 'bridgeToolsDescBulkUpdate' },
  { scope: 'write', tool: 'delete_page',             descKey: 'bridgeToolsDescDeletePage' },
  { scope: 'write', tool: 'move_item',               descKey: 'bridgeToolsDescMoveItem' },
  { scope: 'write', tool: 'create_database',         descKey: 'bridgeToolsDescCreateDatabase' },
  { scope: 'write', tool: 'update_database_schema',  descKey: 'bridgeToolsDescUpdateDatabaseSchema' },
  { scope: 'write', tool: 'create_database_view',    descKey: 'bridgeToolsDescCreateDatabaseView' },
  { scope: 'write', tool: 'update_database_view',    descKey: 'bridgeToolsDescUpdateDatabaseView' },
  { scope: 'write', tool: 'delete_database_view',    descKey: 'bridgeToolsDescDeleteDatabaseView' },
] as const;

const RESOURCES = [
  { uri: 'remnus://workspace/{id}/schema', mimeType: 'application/json', descKey: 'bridgeResourcesDescWorkspace' },
  { uri: 'remnus://workspace/{id}/digest', mimeType: 'text/markdown',    descKey: 'bridgeResourcesDescDigest' },
  { uri: 'remnus://page/{id}',             mimeType: 'text/markdown',     descKey: 'bridgeResourcesDescPage' },
  { uri: 'remnus://database/{id}/schema',  mimeType: 'application/json', descKey: 'bridgeResourcesDescDatabase' },
  { uri: 'remnus://audit-log/recent',      mimeType: 'application/json', descKey: 'bridgeResourcesDescAuditLog' },
] as const;

const PROMPTS = [
  { name: 'summarize-page',       args: 'page_id, style?',       descKey: 'bridgePromptsDescSummarizePage' },
  { name: 'weekly-status-report', args: 'database_id, period?',  descKey: 'bridgePromptsDescWeeklyReport'  },
  { name: 'kanban-triage',        args: 'database_id',           descKey: 'bridgePromptsDescKanbanTriage'  },
  { name: 'extract-tasks',        args: 'page_id',               descKey: 'bridgePromptsDescExtractTasks'  },
  { name: 'search-and-create',    args: 'title, query',          descKey: 'bridgePromptsDescSearchCreate'  },
  { name: 'save-memory',          args: 'content, memory_type?', descKey: 'bridgePromptsDescSaveMemory'    },
  { name: 'recall-context',       args: 'topic, limit?',         descKey: 'bridgePromptsDescRecallContext' },
] as const;

const SCOPE_COLORS: Record<string, string> = {
  read:  'var(--color-opt-teal)',
  write: 'var(--color-amber-500)',
};

const MIME_COLORS: Record<string, string> = {
  'application/json': 'var(--color-opt-teal)',
  'text/markdown': 'var(--color-blue-500)',
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

        {/* ── Tablo 1: MCP Tools ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              {t('bridgeToolsSectionTools')} <span className="text-dim font-normal">({TOOLS.length})</span>
            </h3>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              {/* header row */}
              <div
                className="grid px-4 lg:px-4.5 py-3 bg-neutral-850 font-mono text-[11px] text-dim uppercase tracking-[0.08em] min-w-145"
                style={{ gridTemplateColumns: '80px 1.4fr 1.5fr 0.6fr' }}
              >
                <span>{t('bridgeToolsColScope')}</span>
                <span>{t('bridgeToolsColTool')}</span>
                <span>{t('bridgeToolsColDesc')}</span>
                <span className="text-right">{t('bridgeToolsColReturns')}</span>
              </div>

              {TOOLS.map((row, i) => {
                const sc = SCOPE_COLORS[row.scope];
                const displayDesc = t(row.descKey);
                return (
                  <div
                    key={i}
                    className="grid items-center px-4 lg:px-4.5 py-3 text-[13px] lg:text-[13.5px] min-w-145"
                    style={{
                      gridTemplateColumns: '80px 1.4fr 1.5fr 0.6fr',
                      borderTop: '1px solid var(--color-neutral-800)',
                    }}
                  >
                    <span>
                      <span
                        className="font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium px-1.75 py-0.5 rounded-xs"
                        style={{ color: sc, background: `color-mix(in oklab, ${sc} 16%, transparent)` }}
                      >
                        {row.scope}
                      </span>
                    </span>
                    <span className="font-mono text-neutral-100 font-medium">{row.tool}</span>
                    <span className="text-dim">{displayDesc}</span>
                    <span className="font-mono text-accent-strong text-[12.5px] text-right">
                      {row.tool.includes('create') || row.tool.includes('schema') || row.tool.includes('move') || row.tool.includes('view') ? t('bridgeToolsReturnResult') : t('bridgeToolsReturnPage')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* footer */}
            <div
              className="flex items-center gap-2 px-4 lg:px-4.5 py-3.5 bg-neutral-850 text-[12.5px]"
              style={{ borderTop: '1px solid var(--color-neutral-800)' }}
            >
              <span className="text-dim">{t('bridgeToolsFooterText')}</span>
              <span className="flex-1" />
              <Link href="/wiki/read-tools" className="font-mono text-accent-strong text-[12.5px] hover:underline">
                {t('bridgeToolsReferenceLink')} ↗
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tablo 2: MCP Resources ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              {t('bridgeToolsSectionResources')} <span className="text-dim font-normal">({RESOURCES.length})</span>
            </h3>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <div
                className="grid px-4 lg:px-4.5 py-3 bg-neutral-850 font-mono text-[11px] text-dim uppercase tracking-[0.08em] min-w-145"
                style={{ gridTemplateColumns: '1.2fr 1fr 1.8fr' }}
              >
                <span>{t('bridgeResourcesColUri')}</span>
                <span>{t('bridgeResourcesColMimeType')}</span>
                <span>{t('bridgeResourcesColDesc')}</span>
              </div>

              {RESOURCES.map((row, i) => {
                const mc = MIME_COLORS[row.mimeType];
                return (
                  <div
                    key={i}
                    className="grid items-center px-4 lg:px-4.5 py-3 text-[13px] lg:text-[13.5px] min-w-145"
                    style={{
                      gridTemplateColumns: '1.2fr 1fr 1.8fr',
                      borderTop: '1px solid var(--color-neutral-800)',
                    }}
                  >
                    <span className="font-mono text-neutral-100 font-medium break-all">{row.uri}</span>
                    <span>
                      <span
                        className="font-mono text-[10.5px] uppercase tracking-[0.08em] font-medium px-1.75 py-0.5 rounded-xs"
                        style={{ color: mc, background: `color-mix(in oklab, ${mc} 16%, transparent)` }}
                      >
                        {row.mimeType}
                      </span>
                    </span>
                    <span className="text-dim">{t(row.descKey)}</span>
                  </div>
                );
              })}
            </div>
            <div
              className="flex items-center justify-end px-4 lg:px-4.5 py-3.5 bg-neutral-850"
              style={{ borderTop: '1px solid var(--color-neutral-800)' }}
            >
              <Link href="/wiki/resources" className="font-mono text-accent-strong text-[12.5px] hover:underline">
                {t('bridgeToolsReferenceLink')} ↗
              </Link>
            </div>
          </div>
        </div>

        {/* ── Tablo 3: MCP Prompts ───────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-strong" />
            <h3 className="m-0 font-mono text-[11px] text-neutral-100 uppercase tracking-widest font-semibold">
              {t('bridgeToolsSectionPrompts')} <span className="text-dim font-normal">({PROMPTS.length})</span>
            </h3>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <div
                className="grid px-4 lg:px-4.5 py-3 bg-neutral-850 font-mono text-[11px] text-dim uppercase tracking-[0.08em] min-w-145"
                style={{ gridTemplateColumns: '1.3fr 1fr 1.8fr' }}
              >
                <span>{t('bridgePromptsColName')}</span>
                <span>{t('bridgePromptsColArgs')}</span>
                <span>{t('bridgePromptsColDesc')}</span>
              </div>

              {PROMPTS.map((row, i) => (
                <div
                  key={i}
                  className="grid items-center px-4 lg:px-4.5 py-3 text-[13px] lg:text-[13.5px] min-w-145"
                  style={{
                    gridTemplateColumns: '1.3fr 1fr 1.8fr',
                    borderTop: '1px solid var(--color-neutral-800)',
                  }}
                >
                  <span className="font-mono text-neutral-100 font-medium">{row.name}</span>
                  <span className="font-mono text-[12px] text-dim">{row.args}</span>
                  <span className="text-dim">{t(row.descKey)}</span>
                </div>
              ))}
            </div>
            <div
              className="flex items-center justify-end px-4 lg:px-4.5 py-3.5 bg-neutral-850"
              style={{ borderTop: '1px solid var(--color-neutral-800)' }}
            >
              <Link href="/wiki/prompts" className="font-mono text-accent-strong text-[12.5px] hover:underline">
                {t('bridgeToolsReferenceLink')} ↗
              </Link>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
