export const runtime = 'nodejs';

import { db } from '@/db';
import { oauthAuthCodes, oauthAccessTokens, users } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, createHmac, hkdfSync, randomUUID } from 'crypto';
import { checkCanAddAgent } from '@/lib/services/billing';
import { captureServer, isCaptureAllowedForUser, captureForUser, captureAnonymous } from '@/lib/analytics/server';
import { maybeSendAgentConnectedEmail } from '@/lib/email/lifecycle';

const ACCESS_TOKEN_TTL_MS  = 60 * 60 * 1000;          // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Refresh tokens rotate on every use (OAuth 2.1 §4.13.2) — the old row is deliberately
// left unusable. A client with several concurrent instances (or a retry racing a prior
// success) can legitimately present that same now-rotated token again a moment later;
// without a grace, the loser of that race gets a hard failure and, per the incident this
// was built for, falls back to its now-revoked access token too — the "session died
// mid-way" symptom. REFRESH_REPLAY_GRACE_MS bounds how long a reused refresh token is
// treated as a benign race instead of theft.
//
// The replay is answered with the SAME new pair, and that pair is not stored anywhere (a
// stored plaintext token would be a credential at rest): it is DERIVED. The rotated pair —
// the new row's id, both prefixes and both secrets — is an HMAC, keyed with a purpose-specific
// subkey of the server secret (HKDF, so the session-signing secret itself never keys it), of
// the old row's id and the old refresh secret the client presents — a secret the server has
// just verified against the old row's hash, so a caller cannot make it derive anything for a
// token it does not hold. So any
// instance can recompute it, which an in-memory cache could not offer on a serverless
// platform where the replay may land anywhere. It also makes rotation idempotent: two
// instances rotating one token at the same moment insert the same row (the second insert is
// a no-op) and hand out identical tokens. Rows rotated before this existed carry random
// successors; a replay of those inside the window is refused plainly, never revoked.
const REFRESH_REPLAY_GRACE_MS = 45_000;

function oauthError(code: string, description: string, status = 400) {
  return Response.json(
    { error: code, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } },
  );
}

function tokenResponse(body: Record<string, unknown>) {
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

type TokenSecrets = {
  /** Set for a derived pair: the successor row's primary key (see the note above). */
  id?: string;
  accessPrefix: string; accessSecret: string;
  refreshPrefix: string; refreshSecret: string;
};

function randomSecrets(): TokenSecrets {
  return {
    accessPrefix: randomBytes(4).toString('hex'),
    accessSecret: randomBytes(32).toString('hex'),
    refreshPrefix: randomBytes(4).toString('hex'),
    refreshSecret: randomBytes(32).toString('hex'),
  };
}

/**
 * The pair a refresh of row `oldRowId`, presenting `oldRefreshSecret`, rotates to. Same shape
 * as `randomSecrets` (8-hex prefixes, 64-hex secrets), so nothing downstream can tell the
 * difference. `null` without a server secret to key it with — the caller then rotates to a
 * random pair and a replay simply has no grace.
 */
let warnedNoSecret = false;
let subkeyCache: { secret: string; key: Buffer } | null = null;
/** The HMAC key for rotation: derived from the server secret for this one purpose. */
function rotationSubkey(secret: string): Buffer {
  if (subkeyCache?.secret !== secret) {
    subkeyCache = { secret, key: Buffer.from(hkdfSync('sha256', secret, 'remnus-oauth', 'refresh-rotation/v1', 32)) };
  }
  return subkeyCache.key;
}

function deriveRotatedSecrets(oldRowId: string, oldRefreshSecret: string): TokenSecrets | null {
  const key = process.env.AUTH_SECRET;
  if (!key) {
    // Said once per instance: without the key a replayed refresh token has no grace, which is
    // exactly the "session died mid-way" symptom, and nothing else would point at the cause.
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.error('[oauth/token] AUTH_SECRET is not set: refresh tokens rotate to random pairs and a replayed one gets no grace');
    }
    return null;
  }
  const subkey = rotationSubkey(key);
  const derive = (label: string) =>
    createHmac('sha256', subkey).update(`${label}\n${oldRowId}\n${oldRefreshSecret}`).digest('hex');
  const h = derive('id');
  return {
    // UUID-shaped (version 4, RFC 4122 variant) like every other row id.
    id: `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) & 3]}${h.slice(17, 20)}-${h.slice(20, 32)}`,
    accessPrefix: derive('access-prefix').slice(0, 8),
    accessSecret: derive('access-secret'),
    refreshPrefix: derive('refresh-prefix').slice(0, 8),
    refreshSecret: derive('refresh-secret'),
  };
}

async function sealTokenPair(secrets: TokenSecrets): Promise<{
  accessToken: string; accessPrefix: string; accessHash: string;
  refreshToken: string; refreshPrefix: string; refreshHash: string;
}> {
  const [accessHash, refreshHash] = await Promise.all([
    bcrypt.hash(secrets.accessSecret, 10),
    bcrypt.hash(secrets.refreshSecret, 10),
  ]);
  return {
    accessToken: `oa_${secrets.accessPrefix}_${secrets.accessSecret}`,
    accessPrefix: secrets.accessPrefix,
    accessHash,
    refreshToken: `or_${secrets.refreshPrefix}_${secrets.refreshSecret}`,
    refreshPrefix: secrets.refreshPrefix,
    refreshHash,
  };
}

async function generateTokenPair() {
  return sealTokenPair(randomSecrets());
}

function verifyS256(codeVerifier: string, codeChallenge: string): boolean {
  const digest = createHash('sha256').update(codeVerifier).digest();
  const computed = digest.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return computed === codeChallenge;
}

async function handleAuthorizationCode(params: URLSearchParams): Promise<Response> {
  const code        = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId    = params.get('client_id');
  const verifier    = params.get('code_verifier');

  console.log('[oauth/token] code_exchange start', { hasCode: !!code, hasRedirectUri: !!redirectUri, hasClientId: !!clientId, hasVerifier: !!verifier });

  if (!code || !redirectUri || !clientId || !verifier) {
    console.error('[oauth/token] missing_params', { code: !!code, redirectUri: !!redirectUri, clientId: !!clientId, verifier: !!verifier });
    // No user context yet — capture the drop-off anonymously so the funnel still counts it.
    void captureAnonymous('oauth_token_exchange_failed', { reason: 'missing_params', clientId: clientId ?? null });
    return oauthError('invalid_request', 'Missing required parameters');
  }

  const [row] = await db
    .select()
    .from(oauthAuthCodes)
    .where(eq(oauthAuthCodes.code, code))
    .limit(1);

  if (!row) {
    console.error('[oauth/token] code_not_found', { codePrefix: code.slice(0, 8) });
    void captureAnonymous('oauth_token_exchange_failed', { reason: 'code_not_found', clientId });
    return oauthError('invalid_grant', 'Authorization code not found or already used');
  }

  // From here the auth code resolves to a user — attribute failures to them so we
  // can see *which* users couldn't complete an agent connection and why.
  const fail = (reason: string, res: Response): Response => {
    void captureForUser('oauth_token_exchange_failed', row.userId, {
      reason, clientId: row.clientId, workspaceId: row.workspaceId, scope: row.scope,
    });
    return res;
  };

  if (row.usedAt) {
    console.error('[oauth/token] code_already_used', { codePrefix: code.slice(0, 8) });
    return fail('code_already_used', oauthError('invalid_grant', 'Authorization code already used'));
  }
  if (row.expiresAt.getTime() < Date.now()) {
    console.error('[oauth/token] code_expired', { expiresAt: row.expiresAt });
    return fail('code_expired', oauthError('invalid_grant', 'Authorization code expired'));
  }
  if (row.clientId !== clientId) {
    console.error('[oauth/token] client_id_mismatch', { stored: row.clientId, received: clientId });
    return fail('client_id_mismatch', oauthError('invalid_grant', 'client_id mismatch'));
  }
  if (row.redirectUri !== redirectUri) {
    console.error('[oauth/token] redirect_uri_mismatch', { stored: row.redirectUri, received: redirectUri });
    return fail('redirect_uri_mismatch', oauthError('invalid_grant', 'redirect_uri mismatch'));
  }
  if (!verifyS256(verifier, row.codeChallenge)) {
    console.error('[oauth/token] pkce_invalid', { challengePrefix: row.codeChallenge.slice(0, 8) });
    return fail('pkce_invalid', oauthError('invalid_grant', 'code_verifier invalid'));
  }

  // Agent limit — a new OAuth connection counts against the workspace billing owner's plan.
  // (Don't consume the auth code on a policy rejection — check before marking it used.)
  // Platform admins bypass the cap, mirroring PAT minting (mintAgentToken).
  const [grantee] = await db.select({ role: users.role }).from(users).where(eq(users.id, row.userId)).limit(1);
  if (grantee?.role !== 'admin') {
    const limitCode = await checkCanAddAgent(row.workspaceId);
    if (limitCode) {
      console.error('[oauth/token] agent_limit_reached', { workspaceId: row.workspaceId });
      // The single biggest "why can't they add an agent" reason — surface the exact limit code.
      return fail('agent_limit_reached', oauthError('access_denied', 'Connected-agent limit reached for this workspace plan', 403));
    }
  }

  // Mark code as used
  await db.update(oauthAuthCodes).set({ usedAt: new Date() }).where(eq(oauthAuthCodes.code, code));

  const tokens = await generateTokenPair();
  const now = new Date();

  await db.insert(oauthAccessTokens).values({
    id:                 randomUUID(),
    tokenPrefix:        tokens.accessPrefix,
    tokenHash:          tokens.accessHash,
    refreshTokenPrefix: tokens.refreshPrefix,
    refreshTokenHash:   tokens.refreshHash,
    clientId:           row.clientId,
    userId:             row.userId,
    workspaceId:        row.workspaceId,
    scope:              row.scope,
    // Carry the agent brand + friendly label chosen on the consent screen.
    agentName:          row.agentName ?? null,
    displayName:        row.displayName ?? null,
    expiresAt:          new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    createdAt:          now,
  });

  console.log('[oauth/token] success', { tokenPrefix: tokens.accessPrefix, scope: row.scope });

  // Funnel: 'mcp_token_created' (OAuth connection — a genuinely new agent link).
  // Only on the authorization_code grant; refresh_token is rotation, not a new
  // agent. No cookie context here, so resolve consent from the user's record.
  try {
    const { allowed, role } = await isCaptureAllowedForUser(row.userId);
    await captureServer({
      event: 'mcp_token_created',
      userId: row.userId,
      allowed,
      role,
      properties: { type: 'oauth', scope: row.scope, clientId: row.clientId, workspaceId: row.workspaceId },
    });
  } catch {
    // best-effort
  }

  // First-agent celebration email (once per user, ever). No-throw.
  await maybeSendAgentConnectedEmail(row.userId);

  return tokenResponse({
    access_token:  tokens.accessToken,
    token_type:    'Bearer',
    expires_in:    ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: tokens.refreshToken,
    scope:         row.scope,
  });
}

// Walks replacedByTokenId forward from a revoked row to the current active head of its
// rotation chain, then revokes that head too (no-op if already revoked, or if the row
// predates this migration and carries no successor pointer — legacy rows fall back to
// today's plain invalid_grant with nothing further touched).
async function revokeRotationChain(startRow: typeof oauthAccessTokens.$inferSelect): Promise<void> {
  let current = startRow;
  while (current.replacedByTokenId) {
    const [next] = await db
      .select()
      .from(oauthAccessTokens)
      .where(eq(oauthAccessTokens.id, current.replacedByTokenId))
      .limit(1);
    if (!next) break;
    current = next;
  }
  if (!current.revokedAt) {
    await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, current.id));
  }
}

/**
 * A rotated refresh token presented again inside the grace window: hand out the pair it
 * rotated to — recomputed, not looked up (see the note at the top). `null` when there is
 * nothing safe to hand out: the successor is not the derived one (rotated before derivation
 * existed, or the server secret changed), is gone, or has already been used or revoked in
 * turn, which means the client has long since moved on.
 */
async function replayRotation(old: typeof oauthAccessTokens.$inferSelect, oldRefreshSecret: string): Promise<Record<string, unknown> | null> {
  const derived = deriveRotatedSecrets(old.id, oldRefreshSecret);
  if (!derived || !old.replacedByTokenId || old.replacedByTokenId !== derived.id) return null;

  const [successor] = await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.id, derived.id)).limit(1);
  if (!successor || successor.revokedAt) return null;

  return {
    access_token:  `oa_${derived.accessPrefix}_${derived.accessSecret}`,
    token_type:    'Bearer',
    expires_in:    Math.max(1, Math.floor((successor.expiresAt.getTime() - Date.now()) / 1000)),
    refresh_token: `or_${derived.refreshPrefix}_${derived.refreshSecret}`,
    scope:         successor.scope,
  };
}

async function handleRefreshToken(params: URLSearchParams): Promise<Response> {
  const refreshToken = params.get('refresh_token');
  const clientId     = params.get('client_id');

  if (!refreshToken || !clientId) {
    return oauthError('invalid_request', 'Missing refresh_token or client_id');
  }

  const parts = refreshToken.split('_');
  if (parts.length < 3 || parts[0] !== 'or') {
    return oauthError('invalid_grant', 'Invalid refresh token format');
  }
  const [, rPrefix, ...secretParts] = parts;
  const rSecret = secretParts.join('_');

  // Not filtered by revokedAt here (unlike before) — an already-rotated row must still be
  // found so its reuse can be told apart as a grace-window replay vs. stale theft below.
  const [row] = await db
    .select()
    .from(oauthAccessTokens)
    .where(eq(oauthAccessTokens.refreshTokenPrefix, rPrefix))
    .limit(1);

  if (!row || !row.refreshTokenHash) return oauthError('invalid_grant', 'Refresh token not found');
  if (!await bcrypt.compare(rSecret, row.refreshTokenHash)) return oauthError('invalid_grant', 'Invalid refresh token');
  if (row.clientId !== clientId) return oauthError('invalid_grant', 'client_id mismatch');

  // Check refresh token hasn't expired (implicit: if created_at + 30d < now)
  const refreshExpiry = new Date(row.createdAt.getTime() + REFRESH_TOKEN_TTL_MS);
  if (refreshExpiry.getTime() < Date.now()) return oauthError('invalid_grant', 'Refresh token expired');

  if (row.revokedAt) {
    const withinGrace = !!row.replacedAt && Date.now() - row.replacedAt.getTime() <= REFRESH_REPLAY_GRACE_MS;
    if (withinGrace) {
      const replayed = await replayRotation(row, rSecret);
      if (replayed) return tokenResponse(replayed);
      // Nothing safe to hand out (see replayRotation) — fail plainly without touching the
      // active chain. Only a reuse OUTSIDE the grace window (below) is treated as theft.
      return oauthError('invalid_grant', 'Refresh token already used');
    }
    await revokeRotationChain(row);
    return oauthError('invalid_grant', 'Refresh token already used');
  }

  // Rotate. The successor's id is derived too, so a racing request rotating this same token
  // inserts the very same row: the insert below is then a no-op and both get identical tokens.
  const derived = deriveRotatedSecrets(row.id, rSecret);
  const tokens = await sealTokenPair(derived ?? randomSecrets());
  const now = new Date();
  const newId = derived?.id ?? randomUUID();

  await db.insert(oauthAccessTokens).values({
    id:                 newId,
    tokenPrefix:        tokens.accessPrefix,
    tokenHash:          tokens.accessHash,
    refreshTokenPrefix: tokens.refreshPrefix,
    refreshTokenHash:   tokens.refreshHash,
    clientId:           row.clientId,
    userId:             row.userId,
    workspaceId:        row.workspaceId,
    scope:              row.scope,
    // Preserve the agent brand + friendly label across rotation.
    agentName:          row.agentName ?? null,
    displayName:        row.displayName ?? null,
    expiresAt:          new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    createdAt:          now,
  }).onConflictDoNothing();

  // Only the first writer marks the old row: a racing twin must not push `replacedAt` forward.
  await db.update(oauthAccessTokens)
    .set({ revokedAt: now, replacedByTokenId: newId, replacedAt: now })
    .where(and(eq(oauthAccessTokens.id, row.id), isNull(oauthAccessTokens.revokedAt)));

  return tokenResponse({
    access_token:  tokens.accessToken,
    token_type:    'Bearer',
    expires_in:    ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: tokens.refreshToken,
    scope:         row.scope,
  });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const contentType = req.headers.get('content-type') ?? '';

    let params: URLSearchParams;
    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawBody) as Record<string, string>;
        params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
      } catch {
        return oauthError('invalid_request', 'Invalid JSON body');
      }
    } else {
      // Default: treat as form-encoded (standard OAuth, also handles missing content-type)
      params = new URLSearchParams(rawBody);
      // If grant_type missing, try JSON fallback
      if (!params.get('grant_type')) {
        try {
          const body = JSON.parse(rawBody) as Record<string, string>;
          params = new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)]));
        } catch {
          // Not JSON either — stick with empty URLSearchParams
        }
      }
    }

    console.log('[oauth/token] request', { contentType, grantType: params.get('grant_type') });

    const grantType = params.get('grant_type');
    if (grantType === 'authorization_code') return handleAuthorizationCode(params);
    if (grantType === 'refresh_token') return handleRefreshToken(params);
    console.error('[oauth/token] unsupported_grant_type', { grantType });
    return oauthError('unsupported_grant_type', `grant_type '${grantType}' is not supported`);
  } catch (err) {
    console.error('[oauth/token] unhandled_error', err);
    return oauthError('server_error', 'Internal server error', 500);
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
