/** Rehearse the pending release migration against minimal synthetic old-schema
 * records. Requires a dedicated loopback umbrella_execution_*_migration DB.
 * Never drops tables or accepts a hosted database. */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/umbrella_execution_\w+_migration$/.test(url.pathname)) throw Error('Dedicated local migration database required');
  const db = new PrismaClient();
  try {
    const existing = await db.$queryRawUnsafe<Array<{ count: number }>>('SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema=\'public\'');
    assert.equal(existing[0].count, 0, 'Rehearsal requires a new empty database');
    await db.$executeRawUnsafe('CREATE TABLE "CourtDraftRecord" ("id" TEXT PRIMARY KEY, "content" TEXT NOT NULL)');
    await db.$executeRawUnsafe('CREATE TABLE "DraftHumanReview" ("id" TEXT PRIMARY KEY)');
    await db.$executeRawUnsafe('CREATE TABLE "DraftJob" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "idempotencyKey" TEXT)');
    await db.$executeRawUnsafe('CREATE UNIQUE INDEX "DraftJob_idempotencyKey_key" ON "DraftJob"("idempotencyKey")');
    await db.$executeRawUnsafe('INSERT INTO "CourtDraftRecord" VALUES (\'draft\', \'synthetic preserved content\')');
    await db.$executeRawUnsafe('INSERT INTO "DraftJob" VALUES (\'job-a\', \'tenant-a\', \'user-a\', \'shared-key\')');
    const sql = readFileSync(resolve('prisma/migrations/20261018_umbrella_u01_u10/migration.sql'), 'utf8');
    for (let replay = 0; replay < 2; replay++) {
      await db.$transaction(async tx => {
        for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      });
    }
    const drafts = await db.$queryRawUnsafe<Array<{ content: string; contentRevision: number }>>('SELECT "content", "contentRevision" FROM "CourtDraftRecord" WHERE "id"=\'draft\'');
    assert.deepEqual(drafts, [{ content: 'synthetic preserved content', contentRevision: 0 }]);
    await db.$executeRawUnsafe('INSERT INTO "DraftJob" ("id","tenantId","userId","idempotencyKey") VALUES (\'job-b\',\'tenant-b\',\'user-b\',\'shared-key\')');
    await assert.rejects(db.$executeRawUnsafe('INSERT INTO "DraftJob" ("id","tenantId","userId","idempotencyKey") VALUES (\'job-duplicate\',\'tenant-a\',\'user-a\',\'shared-key\')'));
    console.log('PASS migration applies and replays; existing content preserved; idempotency scoped and enforced');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error?.message ?? 'Migration rehearsal failed'); process.exitCode = 1; });
