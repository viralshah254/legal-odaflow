/**
 * Build corpus/ke/sources.manifest.json from Kenya legislation sources.
 *
 * Preferred: Laws.Africa Content API when LAWS_AFRICA_API_TOKEN is set.
 * Fallback: public Kenya Law catalog at new.kenyalaw.org/legislation/all (no token).
 *
 * Run:
 *   npm run build:ke-manifest
 *   npm run build:ke-manifest -- --place=ke
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LawsAfricaConnector } from '../src/legal-sources/connectors/laws-africa.connector';
import { KenyaLawCatalogConnector } from '../src/legal-sources/connectors/kenya-law-catalog.connector';
import type { KeSourcesManifest } from '../src/legal-sources/ke-manifest.types';
import { keManifestPath } from '../src/legal-sources/ke-manifest.loader';
import { configureKenyaLawRateLimit } from '../src/legal-sources/connectors/kenya-law-rate-limit';

function parseArgs(argv: string[]) {
  const place =
    argv.find((arg) => arg.startsWith('--place='))?.split('=')[1]?.trim().toLowerCase() ?? 'ke';
  const includeSubsidiary = argv.includes('--include-subsidiary');
  const delayRaw = argv.find((arg) => arg.startsWith('--delay-ms='))?.split('=')[1];
  const delayMs = delayRaw ? parseInt(delayRaw, 10) : 800;
  return { place, includeSubsidiary, delayMs };
}

async function main() {
  const { place, includeSubsidiary, delayMs } = parseArgs(process.argv.slice(2));
  configureKenyaLawRateLimit(delayMs);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const lawsAfrica = app.get(LawsAfricaConnector);
    const kenyaCatalog = app.get(KenyaLawCatalogConnector);

    let acts;
    let source: KeSourcesManifest['source'];

    if (lawsAfrica.isEnabled()) {
      console.log(`[build:ke-manifest] Fetching latest English act expressions for ${place}…`);
      acts = await lawsAfrica.buildManifestEntries(place);
      source = 'laws.africa';
    } else {
      console.log(
        '[build:ke-manifest] LAWS_AFRICA_API_TOKEN not set — scraping public Kenya Law catalog…',
      );
      acts = await kenyaCatalog.buildManifestEntries({ includeSubsidiary, delayMs });
      source = 'kenyalaw.org';
    }

    const primaryActs = acts.filter(
      (a) => a.nature === 'act' || a.nature === 'constitution',
    ).length;
    const subsidiary = acts.length - primaryActs;

    const manifest: KeSourcesManifest = {
      countryCode: 'KE',
      source,
      builtAt: new Date().toISOString(),
      placeCode: place,
      acts,
    };

    const outPath = keManifestPath();
    mkdirSync(resolve(outPath, '..'), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    console.log(
      `[build:ke-manifest] Wrote ${acts.length} entries to ${outPath} (source: ${source})\n` +
        `  primary: ${primaryActs}, subsidiary: ${subsidiary}\n` +
        `Next: npm run ingest:ke-manifest -- --delay-ms=1200`,
    );

    if (includeSubsidiary && acts.length < 490) {
      console.warn(
        `[build:ke-manifest] WARNING: expected ~496 entries with --include-subsidiary, got ${acts.length}`,
      );
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
