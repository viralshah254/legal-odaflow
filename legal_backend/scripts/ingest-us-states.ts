/**
 * Bulk ingest US state manifest acts from corpus/us/states/*.manifest.json.
 *
 * Run:
 *   npm run ingest:us-states
 *   npm run ingest:us-states -- --force-reindex
 *   npm run ingest:us-states -- --section-depth=full --states=CA,NY,TX
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';

function parseArg(prefix: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return arg?.slice(prefix.length + 1);
}

async function main() {
  const forceReindex = process.argv.includes('--force-reindex');
  const sectionDepthArg = parseArg('--section-depth');
  const sectionDepth =
    sectionDepthArg === 'full' ? ('full' as const) : ('index' as const);
  const statesArg = parseArg('--states');
  const stateFilter = statesArg
    ? statesArg.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : undefined;
  const fullTextStates =
    sectionDepth === 'full'
      ? stateFilter ?? ['CA', 'NY', 'TX']
      : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const results = await ingest.ingestAllUsStateManifestActs({
      forceReindex,
      sectionDepth,
      fullTextStates,
      stateFilter,
    });

    const summary = {
      sectionDepth,
      stateFilter: stateFilter ?? 'all',
      actsProcessed: results.length,
      sectionsUpserted: results.reduce((sum, r) => sum + r.sectionsUpserted, 0),
      chunksStored: results.reduce((sum, r) => sum + r.chunksStored, 0),
      skipped: results.filter((r) => (r.skippedUnchanged ?? 0) > 0).length,
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
