import JSZip from 'jszip';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pageLinks, workspaceMembers } from '@/db/schema';
import { auth } from '@/auth';
import { buildOkfBundle } from '@/lib/okf/exporter';
import { analyzeKnowledgeHealth } from '@/lib/okf/health';
import { getOkfWorkspaceSnapshot } from '@/lib/okf/workspaceSnapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_CONCEPTS = 5_000;
const MAX_TEXT_BYTES = 25 * 1024 * 1024;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim();
    if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });

    if (user.role !== 'admin') {
      const [membership] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
        .limit(1);
      if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const snapshot = await getOkfWorkspaceSnapshot(workspaceId);
    const conceptCount = snapshot.items.length + snapshot.databases.reduce((total, database) => total + database.rows.length, 0);
    if (conceptCount > MAX_CONCEPTS) {
      return NextResponse.json({ error: `Workspace exceeds the ${MAX_CONCEPTS} concept export limit.` }, { status: 413 });
    }
    const textBytes = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    if (textBytes > MAX_TEXT_BYTES) {
      return NextResponse.json({ error: 'Workspace content exceeds the 25 MB export limit.' }, { status: 413 });
    }

    const bundle = await buildOkfBundle(snapshot);
    if (request.nextUrl.searchParams.get('mode') === 'report') {
      const links = await db
        .select({ fromId: pageLinks.fromId, toId: pageLinks.toId })
        .from(pageLinks)
        .where(eq(pageLinks.workspaceId, workspaceId));
      return NextResponse.json({
        okfVersion: bundle.report.version,
        conformance: bundle.report,
        health: analyzeKnowledgeHealth(snapshot, links),
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (!bundle.report.valid) {
      return NextResponse.json({ error: 'The generated OKF bundle failed validation.', report: bundle.report }, { status: 422 });
    }

    const zip = new JSZip();
    for (const file of bundle.files) zip.file(`${bundle.rootName}/${file.path}`, file.content);
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const responseBody = Uint8Array.from(bytes).buffer;
    const filename = `${bundle.rootName}.zip`;

    return new Response(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Remnus-OKF-Version': bundle.report.version,
        'X-Remnus-OKF-Concepts': String(bundle.report.conceptCount),
        'X-Remnus-OKF-Warnings': String(bundle.report.issues.filter(issue => issue.severity === 'warning').length),
      },
    });
  } catch (error) {
    console.error('[export/okf]', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed' }, { status: 500 });
  }
}
