import { db } from '../db';
import { databases } from '../db/schema';

async function main() {
  // List all databases to find Work Plan
  const all = await db
    .select({ dbId: databases.id, name: databases.name, itemId: databases.itemId })
    .from(databases);
  console.log(JSON.stringify(all));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
