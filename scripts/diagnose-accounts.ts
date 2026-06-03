/**
 * Diagnostic: inspect user + account rows for the two confused accounts.
 *
 * Run against PRODUCTION by exporting the prod DB creds first, e.g. (PowerShell):
 *   $env:DATABASE_URL="libsql://<your-db>.turso.io"
 *   $env:DATABASE_AUTH_TOKEN="<token>"
 *   npx tsx scripts/diagnose-accounts.ts
 */
import { db } from '../src/db';
import { users, accounts, workspaceMembers } from '../src/db/schema';
import { inArray, eq } from 'drizzle-orm';

const EMAILS = ['ranorkk@gmail.com', 'emir.oguz03@gmail.com'];

async function main() {
  console.log('DB:', process.env.DATABASE_URL ?? 'file:local.db');
  console.log('─'.repeat(70));

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(inArray(users.email, EMAILS));

  console.log('\n=== USER rows (by email) ===');
  console.table(userRows);

  const ids = userRows.map((u) => u.id);

  // All accounts whose userId is one of these users
  const accByUser = ids.length
    ? await db
        .select({
          userId: accounts.userId,
          provider: accounts.provider,
          providerAccountId: accounts.providerAccountId,
          type: accounts.type,
        })
        .from(accounts)
        .where(inArray(accounts.userId, ids))
    : [];

  console.log('\n=== ACCOUNT rows linked to those users ===');
  // annotate which email each userId belongs to
  const idToEmail = Object.fromEntries(userRows.map((u) => [u.id, u.email]));
  console.table(
    accByUser.map((a) => ({ ...a, ownerEmail: idToEmail[a.userId] ?? '??? (different user!)' })),
  );

  // Memberships for these users
  const members = ids.length
    ? await db
        .select({
          userId: workspaceMembers.userId,
          workspaceId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(inArray(workspaceMembers.userId, ids))
    : [];

  console.log('\n=== WORKSPACE_MEMBERS for those users ===');
  console.table(members.map((m) => ({ ...m, ownerEmail: idToEmail[m.userId] })));

  console.log('\n─'.repeat(70));
  console.log(
    'WHAT TO LOOK FOR: every Google/GitHub account row should belong to the\n' +
      'SAME email it actually logs in with. If emir.oguz03 has NO google account\n' +
      "row, or if emir's providerAccountId is listed under ranorkk's userId, that's\n" +
      'the corruption causing the identity swap.',
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
