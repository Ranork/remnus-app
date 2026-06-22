export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { db } from '@/db';

// Public, unauthenticated health probe for MCP registry submissions and uptime
// monitoring (UptimeRobot, BetterStack, registry health pings, etc.). Reports
// process liveness, database connectivity (with latency), and MCP transport
// readiness. Whitelisted in auth.config.ts so monitors reach it without a session.
//
// Status semantics:
//   200 + status:'ok'        — everything healthy
//   503 + status:'degraded'  — the database is unreachable (DB-backed features down)
// The response is never cached.

const startedAt = Date.now();

async function checkDatabase(): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    await db.run(sql`SELECT 1`);
    return { status: 'up', latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

export async function GET() {
  const database = await checkDatabase();

  // The MCP endpoint is served by this same Next.js process over Streamable
  // HTTP (+ stateful SSE). If this handler responds, the MCP transport is being
  // served; we surface the negotiated protocol version for registry tooling.
  const mcp = {
    status: 'up' as const,
    endpoint: '/api/mcp',
    transport: 'streamable-http+sse',
    protocolVersion: LATEST_PROTOCOL_VERSION,
  };

  const healthy = database.status === 'up';

  const body = {
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    checks: { database, mcp },
  };

  return NextResponse.json(body, {
    status: healthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
