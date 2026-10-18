/**
 * Ingest state manifest acts (pilot: MH, DL, KA, TN, GJ).
 *
 * Run:
 *   npm run ingest:state-manifest -- --state=MH
 *   npm run ingest:state-manifest -- --all
 *   npm run ingest:state-manifest -- --state=MH --dry-run
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  STATE_LAW_PILOTS,
  StateLawConnectorRegistry,
} from '../src/legal-sources/connectors/state-law.connector';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';

function parseArgs(argv: string[]) {
  const state = argv.find((arg) => arg.startsWith('--state='))?.split('=')[1]?.toUpperCase();
  const all = argv.includes('--all');
  const dryRun = argv.includes('--dry-run');
  const forceReindex = argv.includes('--force-reindex');
  return { state, all, dryRun, forceReindex };
}

async function main() {
  const { state, all, dryRun, forceReindex } = parseArgs(process.argv.slice(2));
  const stateCodes = all ? Object.keys(STATE_LAW_PILOTS) : state ? [state] : [];

  if (stateCodes.length === 0) {
    console.error('Provide --state=MH or --all');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const registry = app.get(StateLawConnectorRegistry);
    const ingest = app.get(StatuteIngestService);
    const results = [];

    for (const stateCode of stateCodes) {
      const manifest = registry.loadStateManifest(stateCode);
      console.log(
        `[ingest:state-manifest] ${stateCode} (${manifest.stateName}) — ${manifest.acts.length} acts`,
      );

      for (const act of manifest.acts) {
        const storageActId = `state-${stateCode.toLowerCase()}-${act.actId}`;

        if (dryRun) {
          results.push({ stateCode, actId: act.actId, storageActId, dryRun: true });
          continue;
        }

        const sections = await registry.fetchActSections(stateCode, act.actId);
        if (sections.length === 0) {
          results.push({
            stateCode,
            actId: act.actId,
            storageActId,
            sectionsUpserted: 0,
            errors: [`No sections fetched for ${stateCode}/${act.actId}`],
          });
          continue;
        }

        const batch = await ingest.batchUpsertActSections(storageActId, 'IN', sections, {
          sourceUrl: act.primaryPdfUrl,
          manifestActId: act.actId,
          forceReindex,
        });

        results.push({
          stateCode,
          actId: act.actId,
          storageActId,
          sectionsFetched: sections.length,
          ...batch,
          errors: [],
        });
      }
    }

    console.log(JSON.stringify({ stateCodes, results }, null, 2));
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
