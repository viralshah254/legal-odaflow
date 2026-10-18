/**
 * Sync Supreme Court judgments from e-SCR (AWS Open Data metadata).
 *
 * Run:
 *   npm run sync:in-escr-case-law
 *   npm run sync:in-escr-case-law -- --force-reindex
 *   npm run sync:in-escr-case-law -- --years=2024,2023 --max-per-year=100
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LegalSourceService } from '../src/legal-sources/legal-source.service';

function parseArgs(argv: string[]) {
  const forceReindex = argv.includes('--force-reindex');
  const yearsRaw = argv.find((arg) => arg.startsWith('--years='))?.split('=')[1];
  const maxPerYearRaw = argv.find((arg) => arg.startsWith('--max-per-year='))?.split('=')[1];
  const years = yearsRaw
    ? yearsRaw.split(',').map((y) => parseInt(y.trim(), 10)).filter((y) => !isNaN(y))
    : undefined;
  const maxPerYear = maxPerYearRaw ? parseInt(maxPerYearRaw, 10) : undefined;
  return { forceReindex, years, maxPerYear };
}

async function main() {
  const { forceReindex, years, maxPerYear } = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const legalSources = app.get(LegalSourceService);
    console.log(
      `[sync:in-escr-case-law] Syncing e-SCR judgments` +
        (years ? ` years=${years.join(',')}` : '') +
        (maxPerYear ? ` maxPerYear=${maxPerYear}` : '') +
        (forceReindex ? ' — force reindex' : ''),
    );

    const result = await legalSources.syncIndiaEscrCaseLaw({
      years,
      maxPerYear,
      forceReindex,
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
