import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { auth } from '@/auth';
import { createImportedWorkspaceForUser, ImportWorkspaceLimitError } from '@/lib/import/workspace-import';
import { rewriteImportedConceptLinks } from '@/lib/okf/importLinks';
import { normalizeArchivePath } from '@/lib/okf/paths';
import type { ParsedOkfConcept } from '@/lib/okf/types';
import { createDatabaseInWorkspace, createPageInWorkspace, updatePageById } from '@/lib/services/workspace';
import { recordImportedKnowledge } from '@/lib/services/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CONCEPTS = 1_000;
const MAX_PAYLOAD_BYTES = 25 * 1024 * 1024;
const MAX_FIELD_BYTES = 2 * 1024 * 1024;

interface OkfImportPayload {
  bundleName?: string;
  version?: string | null;
  concepts?: ParsedOkfConcept[];
}

function safeText(value: unknown, maxBytes: number): value is string {
  return typeof value === 'string' && Buffer.byteLength(value, 'utf8') <= maxBytes;
}

function validateConcept(value: unknown): value is ParsedOkfConcept {
  if (!value || typeof value !== 'object') return false;
  const concept = value as Partial<ParsedOkfConcept>;
  if (!safeText(concept.path, 2_048) || normalizeArchivePath(concept.path) !== concept.path) return false;
  if (!concept.path.toLowerCase().endsWith('.md')) return false;
  if (!safeText(concept.title, 512) || !concept.title.trim()) return false;
  if (!safeText(concept.type, 256) || !concept.type.trim()) return false;
  if (!safeText(concept.content, MAX_FIELD_BYTES) || !safeText(concept.frontmatterRaw, MAX_FIELD_BYTES)) return false;
  if (!Array.isArray(concept.tags) || concept.tags.length > 500 || concept.tags.some(tag => !safeText(tag, 256))) return false;
  if (concept.description !== undefined && !safeText(concept.description, 4_096)) return false;
  if (concept.resource !== undefined && !safeText(concept.resource, 4_096)) return false;
  if (concept.status !== undefined && !safeText(concept.status, 256)) return false;
  if (concept.staleAfter !== undefined && !safeText(concept.staleAfter, 256)) return false;
  if (!['unverified', 'machine-confirmed', 'external-human-asserted'].includes(String(concept.trustTier))) return false;
  if (/<script\b|<iframe\b|javascript\s*:|\bon\w+\s*=/i.test(concept.content)) return false;
  return true;
}

export async function POST(request: NextRequest) {
  const t = await getTranslations('WorkspaceSettings');
  let createdWorkspaceId: string | null = null;
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const declaredBytes = Number(request.headers.get('content-length') ?? 0);
    if (declaredBytes > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'payloadTooLarge' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'payloadTooLarge' }, { status: 413 });
    }
    const payload = JSON.parse(rawBody) as OkfImportPayload;
    if (!safeText(payload.bundleName, 256) || !Array.isArray(payload.concepts) || payload.concepts.length === 0 || payload.concepts.length > MAX_CONCEPTS) {
      return NextResponse.json({ error: 'invalidPayload' }, { status: 400 });
    }
    if (!payload.concepts.every(validateConcept)) {
      return NextResponse.json({ error: 'invalidConcept' }, { status: 400 });
    }
    const casePaths = new Set<string>();
    for (const concept of payload.concepts) {
      const key = concept.path.toLowerCase();
      if (casePaths.has(key)) return NextResponse.json({ error: 'duplicatePath' }, { status: 400 });
      casePaths.add(key);
    }

    const workspaceId = await createImportedWorkspaceForUser(user.id, payload.bundleName);
    createdWorkspaceId = workspaceId;
    const { databaseId } = await createDatabaseInWorkspace(workspaceId, {
      name: t('okfConceptsDatabase'),
      schema: [
        { name: t('okfColumnType'), type: 'text' },
        { name: t('okfColumnStatus'), type: 'status', options: [
          { value: 'draft', group: 'todo' },
          { value: 'stable', group: 'complete' },
          { value: 'deprecated', group: 'complete' },
        ] },
        { name: t('okfColumnTags'), type: 'multi_select', options: [...new Set(payload.concepts.flatMap(concept => concept.tags))].slice(0, 500) },
        { name: t('okfColumnResource'), type: 'url' },
        { name: t('okfColumnStaleAfter'), type: 'date' },
        { name: t('okfColumnTrust'), type: 'select', options: ['unverified', 'machine-confirmed', 'external-human-asserted'] },
        { name: t('okfColumnPath'), type: 'text' },
        { name: t('okfColumnFrontmatter'), type: 'text' },
      ],
      iconColor: 'blue',
    });

    const targetsByPath = new Map<string, { id: string; title: string }>();
    for (const concept of payload.concepts) {
      const result = await createPageInWorkspace(workspaceId, {
        databaseId,
        title: concept.title,
        content: concept.content,
        properties: {
          [t('okfColumnType')]: concept.type,
          ...(concept.status && ['draft', 'stable', 'deprecated'].includes(concept.status.toLowerCase())
            ? { [t('okfColumnStatus')]: concept.status.toLowerCase() }
            : {}),
          ...(concept.tags.length ? { [t('okfColumnTags')]: concept.tags } : {}),
          ...(concept.resource ? { [t('okfColumnResource')]: concept.resource } : {}),
          ...(concept.staleAfter ? { [t('okfColumnStaleAfter')]: concept.staleAfter } : {}),
          [t('okfColumnTrust')]: concept.trustTier,
          [t('okfColumnPath')]: concept.path,
          [t('okfColumnFrontmatter')]: concept.frontmatterRaw,
        },
      });
      targetsByPath.set(concept.path.toLowerCase(), { id: result.id, title: concept.title });
      await recordImportedKnowledge(workspaceId, result.id, {
        conceptType: concept.type,
        description: concept.description,
        tags: concept.tags,
        sources: concept.resource ? [{ resource: concept.resource }] : [],
        status: concept.status && ['draft', 'stable', 'deprecated'].includes(concept.status.toLowerCase())
          ? concept.status.toLowerCase() as 'draft' | 'stable' | 'deprecated'
          : undefined,
        staleAfter: concept.staleAfter,
        trustTier: concept.trustTier,
        frontmatterRaw: concept.frontmatterRaw,
      });
    }

    let rewrittenLinks = 0;
    for (const concept of payload.concepts) {
      const target = targetsByPath.get(concept.path.toLowerCase())!;
      const rewritten = rewriteImportedConceptLinks(concept.content, concept.path, databaseId, targetsByPath);
      rewrittenLinks += rewritten.rewritten;
      if (rewritten.rewritten > 0) await updatePageById(workspaceId, target.id, { content: rewritten.content });
    }

    const response = NextResponse.json({
      ok: true,
      workspaceId,
      name: payload.bundleName,
      imported: { concepts: payload.concepts.length, links: rewrittenLinks },
    });
    createdWorkspaceId = null;
    return response;
  } catch (error) {
    if (createdWorkspaceId) {
      try {
        await db.delete(workspaces).where(eq(workspaces.id, createdWorkspaceId));
      } catch (cleanupError) {
        console.error('[import/okf] rollback failed', cleanupError);
      }
    }
    if (error instanceof ImportWorkspaceLimitError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    console.error('[import/okf]', error);
    return NextResponse.json({ error: 'importFailed' }, { status: 500 });
  }
}
