/**
 * Decode the stored id_token of each Google account linked to the Ranork user
 * so we can see which Google sub belongs to which email. Read-only.
 *   npx tsx --env-file=.env scripts/identify-google-accounts.ts
 */
import { db } from '../src/db';
import { accounts } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const USER_ID = '62958098-78d9-4451-95f9-b9ae8f8126f4';

function decodeJwt(jwt?: string | null) {
  if (!jwt) return null;
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function main() {
  const rows = await db
    .select({
      provider: accounts.provider,
      providerAccountId: accounts.providerAccountId,
      idToken: accounts.id_token,
      scope: accounts.scope,
    })
    .from(accounts)
    .where(eq(accounts.userId, USER_ID));

  for (const r of rows) {
    const claims = decodeJwt(r.idToken);
    console.log('─'.repeat(60));
    console.log('provider          :', r.provider);
    console.log('providerAccountId :', r.providerAccountId);
    if (claims) {
      console.log('id_token.email    :', claims.email);
      console.log('id_token.name     :', claims.name);
      console.log('id_token.sub      :', claims.sub);
    } else {
      console.log('id_token          : (none — provider does not issue one, e.g. GitHub)');
    }
  }
  console.log('─'.repeat(60));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
