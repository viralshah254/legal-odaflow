/**
 * Force-ingest all curated KE statute-registry acts under their registry actIds.
 *
 * Run:
 *   npm run sync:ke-registry
 *   npm run sync:ke-registry -- --force-reindex --delay-ms=1500 --defer-embeddings
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { getStatutesForCountry } from '../src/legal-search/statute-registry';
import { configureKenyaLawRateLimit } from '../src/legal-sources/connectors/kenya-law-rate-limit';

function parseArgs(argv: string[]) {
  const delayRaw = argv.find((arg) => arg.startsWith('--delay-ms='))?.split('=')[1];
  const delayMs = delayRaw ? parseInt(delayRaw, 10) : 1500;
  return {
    forceReindex: argv.includes('--force-reindex') || !argv.includes('--skip-existing'),
    deferEmbeddings: argv.includes('--defer-embeddings'),
    delayMs: Number.isFinite(delayMs) ? delayMs : 1500,
  };
}

async function main() {
  const { forceReindex, deferEmbeddings, delayMs } = parseArgs(process.argv.slice(2));
  configureKenyaLawRateLimit(delayMs);

  const statutes = getStatutesForCountry('KE');
  console.log(
    `[sync:ke-registry] Ingesting ${statutes.length} registry acts` +
      (forceReindex ? ' (--force-reindex)' : '') +
      (deferEmbeddings ? ' (--defer-embeddings)' : '') +
      ` — ${delayMs}ms pacing`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const results = [];

    for (const [index, statute] of statutes.entries()) {
      const startedAt = Date.now();
      console.log(
        `[sync:ke-registry] Starting "${statute.id}" (${index + 1}/${statutes.length})…`,
      );
      const result = await ingest.ingestAct('KE', statute.id, {
        forceReindex,
        bulkMode: true,
        deferEmbeddings,
      });
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[sync:ke-registry] Finished "${statute.id}" in ${elapsedSec}s — ` +
          `sections=${result.sectionsUpserted}, hits=${result.connectorHits}, errors=${result.errors.length}`,
      );
      results.push(result);
    }

    const ok = results.filter((r) => r.errors.length === 0 && r.connectorHits > 0).length;
    const failed = results.filter((r) => r.errors.length > 0 || r.connectorHits === 0);
    console.log(
      JSON.stringify(
        {
          total: results.length,
          ok,
          failed: failed.map((r) => ({
            actId: r.actId,
            connectorHits: r.connectorHits,
            errors: r.errors,
          })),
        },
        null,
        2,
      ),
    );
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
