/**
 * Enable Kenya Law fetch policy before bulk ingest.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/enable-kenya-law-ingest.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { KenyaIngestOpsService } from '../src/legal-sources/kenya-ingest-ops.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ops = app.get(KenyaIngestOpsService);
    const result = await ops.enableKenyaLawIngest(true);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
