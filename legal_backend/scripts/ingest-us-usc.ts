/**
 * Bulk ingest U.S. Code titles via OLRC USLM XML.
 *
 * Run:
 *   npm run ingest:us-usc
 *   npm run ingest:us-usc -- --title=42
 *   npm run ingest:us-usc -- --force-reindex
 */
import './cli-bootstrap';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { USC_TITLE_NUMBERS } from '../src/legal-search/statute-registry/us.statutes.federal-bulk';

async function main() {
  const forceReindex = process.argv.includes('--force-reindex');
  const titleArg = process.argv.find((a) => a.startsWith('--title='));
  const titleFilter = titleArg ? parseInt(titleArg.split('=')[1], 10) : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const titles =
      titleFilter && !Number.isNaN(titleFilter)
        ? [titleFilter]
        : USC_TITLE_NUMBERS;

    const results: Awaited<ReturnType<StatuteIngestService['ingestAct']>>[] = [];
    for (const titleNum of titles) {
      const actId = `usc-title-${titleNum}`;
      console.log(`[ingest:us-usc] Starting title ${titleNum} (${actId})…`);
      const result = await ingest.ingestAct('US', actId, {
        forceReindex,
        bulkMode: true,
      });
      results.push(result);
      console.log(
        `[ingest:us-usc] Finished title ${titleNum} — sections=${result.sectionsUpserted}, hits=${result.connectorHits}, errors=${result.errors.length}`,
      );
    }

    const summary = {
      titlesProcessed: results.length,
      sectionsUpserted: results.reduce((sum, r) => sum + r.sectionsUpserted, 0),
      chunksStored: results.reduce((sum, r) => sum + r.chunksStored, 0),
      errors: results.flatMap((r) => r.errors),
    };
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
