/**
 * Bulk ingest all India manifest acts into LegalAuthority.
 *
 * Run:
 *   npx ts-node -r tsconfig-paths/register scripts/ingest-all-india-acts.ts
 *   npx ts-node -r tsconfig-paths/register scripts/ingest-all-india-acts.ts --force
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';

async function main() {
  const forceReindex = process.argv.includes('--force');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const results = await ingest.ingestAllManifestActs('IN', { forceReindex });

    const summary = {
      actsProcessed: results.length,
      sectionsUpserted: results.reduce((sum, r) => sum + r.sectionsUpserted, 0),
      chunksStored: results.reduce((sum, r) => sum + r.chunksStored, 0),
      skipped: results.filter((r) => (r.skippedUnchanged ?? 0) > 0).length,
      errors: results.flatMap((r) => r.errors),
    };

    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
