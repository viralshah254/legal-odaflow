/**
 * Seed priority bare-act sections (BNSS/BNS/BSA etc.) into LegalAuthority + embeddings.
 *
 * Run:
 *   npm run seed:statute-sections -- IN
 *   npm run seed:statute-sections        # all countries in seed file
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { StatuteIngestService } from '../src/legal-sources/statute-ingest.service';

async function main() {
  const countryCode = process.argv[2]?.trim().toUpperCase();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(StatuteIngestService);
    const result = await ingest.seedPrioritySections(countryCode);
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
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
