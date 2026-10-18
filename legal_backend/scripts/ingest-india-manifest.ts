/**
 * Bulk ingest India tier-1 acts from corpus/in/sources.manifest.json.
 *
 * Run:
 *   npm run ingest:india-manifest
 *   npm run ingest:india-manifest -- --act=constitution
 *   npm run ingest:india-manifest -- --dry-run
 *   npm run ingest:india-manifest -- --force-reindex              # re-embed all acts
 *   npm run ingest:india-manifest -- --act=negotiable-instruments --force-reindex
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { loadIndiaSourcesManifest } from '../src/legal-sources/india-manifest.loader';
import { resolveIngestActId } from '../src/legal-search/statute-registry';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';

function parseArgs(argv: string[]) {
  const act = argv.find((arg) => arg.startsWith('--act='))?.split('=')[1];
  const onlyRaw = argv.find((arg) => arg.startsWith('--only='))?.split('=')[1];
  const only = onlyRaw
    ? onlyRaw.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;
  const dryRun = argv.includes('--dry-run');
  const forceReindex = argv.includes('--force-reindex');
  return { act, only, dryRun, forceReindex };
}

async function main() {
  const { act, only, dryRun, forceReindex } = parseArgs(process.argv.slice(2));
  const manifest = loadIndiaSourcesManifest();
  let actIds = act ? [act] : manifest.acts.map((entry) => entry.actId);
  if (only?.length) {
    actIds = actIds.filter((id) => only.includes(id));
  }

  console.log(
    `[ingest:india-manifest] Loaded ${actIds.length} acts from manifest` +
      (forceReindex ? ' (--force-reindex: hash check bypassed)' : ''),
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const results = [];

    for (const manifestActId of actIds) {
      if (dryRun) {
        results.push({ manifestActId, dryRun: true });
        continue;
      }
      const registryActId = resolveIngestActId(manifestActId, 'IN');
      if (!registryActId) {
        console.warn(
          `[ingest:india-manifest] Skipping "${manifestActId}" — no registry entry found`,
        );
        results.push({
          countryCode: 'IN',
          actId: manifestActId,
          sectionsUpserted: 0,
          chunksStored: 0,
          connectorHits: 0,
          errors: [`Unknown act ${manifestActId} for country IN`],
        });
        continue;
      }
      const startedAt = Date.now();
      console.log(
        `[ingest:india-manifest] Starting "${manifestActId}" → registry "${registryActId}" ` +
          `(${actIds.indexOf(manifestActId) + 1}/${actIds.length})…`,
      );
      const result = await ingest.ingestAct('IN', manifestActId, { forceReindex });
      const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `[ingest:india-manifest] Finished "${manifestActId}" (${registryActId}) in ${elapsedSec}s — ` +
          `sections=${result.sectionsUpserted}, skipped=${result.skippedUnchanged ?? 0}, ` +
          `chunks=${result.chunksStored}, hits=${result.connectorHits}, errors=${result.errors.length}`,
      );
      results.push(result);
    }

    console.log(JSON.stringify({ actIds, results }, null, 2));
    const failed = results.some(
      (result) => 'errors' in result && Array.isArray(result.errors) && result.errors.length > 0,
    );
    if (failed) {
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
