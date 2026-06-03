/**
 * Repair: remove the emir.oguz03 Google account row that was wrongly auto-linked
 * to the Ranork user. After this, emir.oguz03 signing in with Google creates a
 * fresh, separate user.  One-shot, targeted by exact primary key.
 *   npx tsx --env-file=.env scripts/repair-emir-account.ts
 */
import { db } from '../src/db';
import { accounts } from '../src/db/schema';
import { and, eq } from 'drizzle-orm';

const PROVIDER = 'google';
const PROVIDER_ACCOUNT_ID = '101470341751382915973'; // emir.oguz03@gmail.com (verified via id_token)

async function main() {
  const before = await db
    .select({ userId: accounts.userId, provider: accounts.provider, providerAccountId: accounts.providerAccountId })
    .from(accounts)
    .where(and(eq(accounts.provider, PROVIDER), eq(accounts.providerAccountId, PROVIDER_ACCOUNT_ID)));

  console.log('Row to delete:', before);
  if (before.length === 0) {
    console.log('Nothing to delete — already clean.');
    process.exit(0);
  }

  await db
    .delete(accounts)
    .where(and(eq(accounts.provider, PROVIDER), eq(accounts.providerAccountId, PROVIDER_ACCOUNT_ID)));

  const after = await db
    .select({ providerAccountId: accounts.providerAccountId })
    .from(accounts)
    .where(and(eq(accounts.provider, PROVIDER), eq(accounts.providerAccountId, PROVIDER_ACCOUNT_ID)));

  console.log(after.length === 0 ? '✅ Deleted. emir.oguz03 Google link removed.' : '⚠ Still present!');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
