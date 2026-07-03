export const runtime = 'nodejs';

import { db } from '@/db';
import { oauthAuthCodes, oauthAccessTokens, oauthClients, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { checkCanAddAgent } from '@/lib/services/billing';
import { captureServer, isCaptureAllowedForUser, captureForUser, captureAnonymous } from '@/lib/analytics/server';
import { maybeSendAgentConnectedEmail } from '@/lib/email/lifecycle';

const ACCESS_TOKEN_TTL_MS  = 60 * 60 * 1000;          // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

async function generateTokenPair(): Promise<{
  accessToken: string; accessPrefix: string; accessHash: string;
  refreshToken: string; refreshPrefix: string; refreshHash: string;
}> {
  const aPrefix = randomBytes(4).toString('hex');
  const aSecret = randomBytes(32).toString('hex');
  const accessToken = `oa_${aPrefix}_${aSecret}`;
  const accessHash = await bcrypt.hash(aSecret, 10);

  const rPrefix = randomBytes(4).toString('hex');
  const rSecret = randomBytes(32).toString('hex');
  const refreshToken = `or_${rPrefix}_${rSecret}`;
  const refreshHash = await bcrypt.hash(rSecret, 10);

  return { accessToken, accessPrefix: aPrefix, accessHash, refreshToken, refreshPrefix: rPrefix, refreshHash };
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

  const [row] = await db
    .select()
    .from(oauthAccessTokens)
    .where(and(eq(oauthAccessTokens.refreshTokenPrefix, rPrefix), isNull(oauthAccessTokens.revokedAt)))
    .limit(1);

  if (!row || !row.refreshTokenHash) return oauthError('invalid_grant', 'Refresh token not found');
  if (!await bcrypt.compare(rSecret, row.refreshTokenHash)) return oauthError('invalid_grant', 'Invalid refresh token');
  if (row.clientId !== clientId) return oauthError('invalid_grant', 'client_id mismatch');

  // Check refresh token hasn't expired (implicit: if created_at + 30d < now)
  const refreshExpiry = new Date(row.createdAt.getTime() + REFRESH_TOKEN_TTL_MS);
  if (refreshExpiry.getTime() < Date.now()) return oauthError('invalid_grant', 'Refresh token expired');

  // Rotate: revoke old, issue new pair
  await db.update(oauthAccessTokens).set({ revokedAt: new Date() }).where(eq(oauthAccessTokens.id, row.id));

  const tokens = await generateTokenPair();
  const now = new Date();

  await db.insert(oauthAccessTokens).values({
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
  });

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
