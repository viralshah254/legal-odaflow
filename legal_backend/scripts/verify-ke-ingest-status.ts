/**
 * Verify Kenya legislation ingest progress (same data as GET /legal-sources/ingest-status?countryCode=KE).
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';
import { loadKeSourcesManifest } from '../src/legal-sources/ke-manifest.loader';

const PRIMARY_NATURES = new Set(['act', 'constitution']);

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const status = await ingest.getIngestStatus('KE');
    const manifest = loadKeSourcesManifest();
    const natureByAct = new Map(
      manifest.acts.map((entry) => [entry.actId, entry.nature ?? 'act'] as const),
    );

    const withSections = status.acts.filter((a) => a.sectionCount > 0).length;
    const subsidiary = status.acts.filter(
      (a) => a.actId.startsWith('ke-ln-') || a.actId.startsWith('ke-gn-'),
    );
    const subsidiaryIndexed = subsidiary.filter((a) => a.sectionCount > 0).length;

    const primaryActs = status.acts.filter((a) =>
      PRIMARY_NATURES.has(natureByAct.get(a.actId) ?? 'act'),
    );
    const primaryWithSections = primaryActs.filter((a) => a.sectionCount > 0).length;
    const primaryMissing = primaryActs.length - primaryWithSections;
    const primaryMissingIds = primaryActs
      .filter((a) => a.sectionCount === 0)
      .map((a) => a.actId)
      .slice(0, 40);

    const report = {
      manifestEntries: status.acts.length,
      actsWithSections: withSections,
      actsMissing: status.acts.length - withSections,
      primaryTotal: primaryActs.length,
      primaryWithSections,
      primaryMissing,
      primaryMissingSample: primaryMissingIds,
      subsidiaryInManifest: subsidiary.length,
      subsidiaryIndexed,
      meetsTier1Threshold: status.acts.filter((a) => a.meetsTier1Threshold).length,
      summary: status.summary,
    };

    console.log(JSON.stringify(report, null, 2));

    if (status.acts.length < 490) {
      console.error('[verify:ke-ingest] Manifest should have ~496 entries');
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
