import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { RbiRegulationIngestService } from '../src/legal-sources/connectors/rbi-regulation-ingest.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingest = app.get(RbiRegulationIngestService);
    const result = await ingest.ingest({
      forceReindex: process.argv.includes('--force-reindex'),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.gaps.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
