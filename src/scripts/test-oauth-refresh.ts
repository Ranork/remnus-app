/**
 * Regression check for the OAuth refresh grant (src/app/api/oauth/token/route.ts), through the
 * real route handler against a real database.
 *
 * The point of the derived rotation: a rotated refresh token presented again inside the grace
 * window must get the SAME new pair on ANY server instance. The old grace was an in-memory
 * cache, so a replay that landed on another serverless instance failed plainly — the "session
 * died mid-way" symptom. There is no cache any more, so every replay here is what "another
 * instance" would see.
 *
 *  - one rotation, then replays inside the window return an identical pair;
 *  - the pair works against the MCP endpoint's token check and the old access token does not;
 *  - three simultaneous refreshes of one token create ONE successor and agree on the tokens;
 *  - a replay AFTER the window is theft: refused and the active chain revoked;
 *  - a successor that is not the derived one (rows rotated before this existed) is refused
 *    plainly inside the window and nothing is revoked;
 *  - without a server secret rotation still works, only the replay grace is gone.
 *
 * **Local only.** It writes rows and deletes them again; it refuses a non-`file:` URL.
 *
 *   DATABASE_URL="file:local.db" npm run test:oauth-refresh
 */
import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import Module from 'module';
import { db } from '@/db';
import { oauthAccessTokens, users, workspaceMembers, workspaces } from '@/db/schema';
import { deleteWorkspaceData } from '@/lib/services/workspaceDeletion';

const url = process.env.DATABASE_URL ?? 'file:local.db';
if (!url.startsWith('file:')) {
  console.error(`Refusing to run against a remote database (${url.split('@').pop()}). Set DATABASE_URL="file:local.db".`);
  process.exit(1);
}

// `server-only` only resolves inside Next; outside it, point it at Next's own empty stub.
const moduleWithResolver = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = moduleWithResolver._resolveFilename;
moduleWithResolver._resolveFilename = (request, ...rest) =>
  resolveFilename(request === 'server-only' ? 'next/dist/compiled/server-only/empty.js' : request, ...rest);

let passed = 0;
const failures: string[] = [];
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const SUFFIX = `test-oauthr-${Date.now()}`;
const userId = `${SUFFIX}-user`;
const W = `${SUFFIX}-w`;
const CLIENT = `${SUFFIX}-client`;
const ownSecret = process.env.AUTH_SECRET;

type Seeded = { id: string; access: string; refresh: string };

async function seedToken(tag: string, over: Partial<typeof oauthAccessTokens.$inferInsert> = {}): Promise<Seeded> {
  const aPrefix = randomBytes(4).toString('hex');
  const aSecret = randomBytes(32).toString('hex');
  const rPrefix = randomBytes(4).toString('hex');
  const rSecret = randomBytes(32).toString('hex');
  const id = `${SUFFIX}-${tag}`;
  await db.insert(oauthAccessTokens).values({
    id,
    tokenPrefix: aPrefix, tokenHash: await bcrypt.hash(aSecret, 4),
    refreshTokenPrefix: rPrefix, refreshTokenHash: await bcrypt.hash(rSecret, 4),
    clientId: CLIENT, userId, workspaceId: W, scope: 'write',
    expiresAt: new Date(Date.now() + 3_600_000), createdAt: new Date(),
    ...over,
  });
  return { id, access: `oa_${aPrefix}_${aSecret}`, refresh: `or_${rPrefix}_${rSecret}` };
}

async function main() {
  await db.run(sql`PRAGMA foreign_keys = ON`);
  process.env.AUTH_SECRET = ownSecret || 'test-oauth-refresh-secret';

  const { POST } = await import('@/app/api/oauth/token/route');
  const { verifyBearerToken } = await import('@/app/api/mcp/handler');

  const refresh = async (refreshToken: string, clientId = CLIENT) => {
    const res = await POST(new Request('http://localhost/api/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }).toString(),
    }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  const row = async (id: string) => (await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.id, id)).limit(1))[0];
  const rowsOfClient = async () => db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, CLIENT));
  const bearer = async (token: string) => verifyBearerToken(`Bearer ${token}`);

  const now = new Date();
  await db.insert(users).values({ id: userId, name: 'OAuth Tester', email: `${userId}@example.invalid`, role: 'user' });
  await db.insert(workspaces).values({ id: W, name: 'OAuth refresh', billingOwnerId: userId, createdAt: now, updatedAt: now });
  await db.insert(workspaceMembers).values({ workspaceId: W, userId, role: 'owner', createdAt: now });

  try {
    console.log('one rotation, then a replay:');
    const t = await seedToken('t');
    const r1 = await refresh(t.refresh);
    check('the refresh succeeds with a fresh pair', r1.status === 200 && /^oa_[0-9a-f]{8}_[0-9a-f]{64}$/.test(r1.body.access_token) && /^or_[0-9a-f]{8}_[0-9a-f]{64}$/.test(r1.body.refresh_token) && r1.body.expires_in === 3600, JSON.stringify(r1.body));
    const old = await row(t.id);
    check('the old row is revoked and points at its successor', !!old.revokedAt && !!old.replacedByTokenId && !!old.replacedAt);
    const successor = await row(old.replacedByTokenId!);
    check('the successor is live and keeps scope and client', !!successor && !successor.revokedAt && successor.scope === 'write' && successor.clientId === CLIENT);
    check('the successor id is UUID-shaped', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(successor.id), successor.id);

    const r2 = await refresh(t.refresh);
    check('a replay inside the window returns the identical pair', r2.status === 200 && r2.body.access_token === r1.body.access_token && r2.body.refresh_token === r1.body.refresh_token, JSON.stringify(r2.body));
    check('…with the time left, not a fresh hour', r2.body.expires_in > 3500 && r2.body.expires_in <= 3600);
    check('…and creates no second successor', (await rowsOfClient()).length === 2);
    const r2b = await refresh(t.refresh);
    check('and again', r2b.body.access_token === r1.body.access_token);

    console.log('\nthe tokens in use:');
    const ctx = await bearer(r1.body.access_token);
    check('the handed-out access token passes the MCP token check', typeof ctx === 'object' && ctx.workspaceId === W && ctx.scope === 'write', JSON.stringify(ctx));
    check('the access token it replaced no longer does', (await bearer(t.access)) === 'invalid_token');

    const r3 = await refresh(r1.body.refresh_token);
    check('the new refresh token rotates again, to something new', r3.status === 200 && r3.body.access_token !== r1.body.access_token && r3.body.refresh_token !== r1.body.refresh_token);
    const r3replay = await refresh(r1.body.refresh_token);
    check('and that one replays too', r3replay.body.access_token === r3.body.access_token);
    const stale = await refresh(t.refresh);
    check('replaying the older generation is refused (its successor has moved on)…', stale.status === 400 && stale.body.error === 'invalid_grant');
    check('…without killing the live chain', typeof (await bearer(r3.body.access_token)) === 'object');

    console.log('\nthree refreshes at once:');
    const u = await seedToken('u');
    const before = (await rowsOfClient()).length;
    const burst = await Promise.all([refresh(u.refresh), refresh(u.refresh), refresh(u.refresh)]);
    check('all three succeed', burst.every((b) => b.status === 200), JSON.stringify(burst.map((b) => b.status)));
    check('and agree on the tokens', new Set(burst.map((b) => b.body.access_token)).size === 1 && new Set(burst.map((b) => b.body.refresh_token)).size === 1);
    check('one successor was created', (await rowsOfClient()).length === before + 2 - 1, `${before} -> ${(await rowsOfClient()).length}`);
    const uOld = await row(u.id);
    check('the old row points at it', !!uOld.revokedAt && uOld.replacedByTokenId === (await bearer(burst[0].body.access_token) as { tokenId: string }).tokenId);

    console.log('\nreplay after the window is theft:');
    const v = await seedToken('v');
    const rv = await refresh(v.refresh);
    await db.update(oauthAccessTokens).set({ replacedAt: new Date(Date.now() - 60_000) }).where(eq(oauthAccessTokens.id, v.id));
    const theft = await refresh(v.refresh);
    check('is refused', theft.status === 400 && theft.body.error === 'invalid_grant');
    check('and revokes the active chain', (await bearer(rv.body.access_token)) === 'invalid_token');
    check('so the new refresh token is dead too', (await refresh(rv.body.refresh_token)).status === 400);

    console.log('\nrows rotated before derivation existed:');
    const w = await seedToken('w');
    const legacy = await seedToken('w-successor');
    await db.update(oauthAccessTokens).set({ revokedAt: new Date(), replacedByTokenId: legacy.id, replacedAt: new Date() }).where(eq(oauthAccessTokens.id, w.id));
    const legacyReplay = await refresh(w.refresh);
    check('a replay inside the window is refused plainly', legacyReplay.status === 400 && legacyReplay.body.error === 'invalid_grant');
    check('and revokes nothing', !(await row(legacy.id)).revokedAt && typeof (await bearer(legacy.access)) === 'object');

    console.log('\nthe other refusals:');
    const y = await seedToken('y');
    check('another client id', (await refresh(y.refresh, 'someone-else')).status === 400);
    check('a malformed token', (await refresh('garbage')).status === 400);
    check('an unknown token', (await refresh('or_00000000_deadbeef')).status === 400);
    check('…none of which touched the row', !(await row(y.id)).revokedAt);
    const old31 = await seedToken('old31', { createdAt: new Date(Date.now() - 31 * 86_400_000) });
    const expired = await refresh(old31.refresh);
    check('a refresh token older than 30 days', expired.status === 400 && /expired/i.test(expired.body.error_description));
    const revoked = await seedToken('revoked', { revokedAt: new Date() });
    check('a revoked connection', (await refresh(revoked.refresh)).status === 400);

    console.log('\nno server secret:');
    delete process.env.AUTH_SECRET;
    const z = await seedToken('z');
    const rz = await refresh(z.refresh);
    check('rotation still works (random pair)', rz.status === 200);
    check('only the replay grace is gone', (await refresh(z.refresh)).status === 400);
    process.env.AUTH_SECRET = ownSecret || 'test-oauth-refresh-secret';
  } finally {
    await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, CLIENT));
    await deleteWorkspaceData(W).catch((e) => console.error('cleanup', W, e));
    await db.delete(users).where(inArray(users.id, [userId]));
    if (ownSecret === undefined) delete process.env.AUTH_SECRET;
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
