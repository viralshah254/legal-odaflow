/**
 * One-shot script: ingests all entries from CURATED_CASE_LAW_CORPUS into
 * LegalAuthority (for embedding + hybrid search) and LegalAuthorityRecord
 * (for citation verification registry).
 *
 * Run:
 *   npm run ingest:curated-caselaws
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LegalSourceService } from '../src/legal-sources/legal-source.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const service = app.get(LegalSourceService);
    console.log('Starting curated case-law ingest...');
    const reconcile = process.argv.includes('--reconcile');
    const result = await service.ingestCuratedCaseLaw({ reconcile });
    console.log(
      `Ingest complete — ingested: ${result.ingested}, skipped: ${result.skipped}, errors: ${result.errors}`,
    );
    if (result.errors > 0) {
      console.error('Some entries failed to ingest. Check logs above.');
      process.exit(1);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
