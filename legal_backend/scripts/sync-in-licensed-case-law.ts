/**
 * Sync licensed case law (SCC Online / Manupatra / Taxmann) when API keys are configured.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LegalSourceService } from '../src/legal-sources/legal-source.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const legalSources = app.get(LegalSourceService);
    const practiceAreas = process.argv
      .slice(2)
      .filter((a) => a.startsWith('--area='))
      .map((a) => a.split('=')[1])
      .filter(Boolean);

    const result = await legalSources.syncLicensedCaseLaw({
      practiceAreas: practiceAreas.length > 0 ? practiceAreas : ['Criminal', 'Corporate'],
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
