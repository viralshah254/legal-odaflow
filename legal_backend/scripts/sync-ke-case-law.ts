/**
 * Sync Kenya case law from Kenya Law (kenyalaw.org/judgments).
 *
 * Sources:
 * - Recent judgments Atom feed (new.kenyalaw.org/feeds/judgments.xml)
 * - Topical search via public documents API
 * - Curated landmark seeds from corpus/ke/judgment-seeds.json
 *
 * Run:
 *   npm run sync:ke-case-law
 *   npm run sync:ke-case-law -- --force-reindex
 *   npm run sync:ke-case-law -- --feed-limit=50
 *   npm run sync:ke-case-law -- --queries="Giella Cassman Brown,employment unfair dismissal"
 *   npm run sync:ke-case-law -- --seeds-only
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { LegalSourceService } from '../src/legal-sources/legal-source.service';

function loadSeedQueries(): string[] {
  const seedPath = resolve(__dirname, '../corpus/ke/judgment-seeds.json');
  if (!existsSync(seedPath)) return [];
  try {
    const payload = JSON.parse(readFileSync(seedPath, 'utf8')) as {
      queries?: string[];
    };
    return (payload.queries ?? []).map((q) => q.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function parseArgs(argv: string[]) {
  const forceReindex = argv.includes('--force-reindex');
  const seedsOnly = argv.includes('--seeds-only');
  const feedLimitRaw = argv.find((arg) => arg.startsWith('--feed-limit='))?.split('=')[1];
  const feedLimit = feedLimitRaw ? parseInt(feedLimitRaw, 10) : 100;
  const queriesRaw = argv.find((arg) => arg.startsWith('--queries='))?.split('=')[1];
  const cliQueries = queriesRaw
    ? queriesRaw.split(',').map((q) => q.trim()).filter(Boolean)
    : undefined;
  return { forceReindex, feedLimit, cliQueries, seedsOnly };
}

async function main() {
  const { forceReindex, feedLimit, cliQueries, seedsOnly } = parseArgs(process.argv.slice(2));
  const seedQueries = loadSeedQueries();
  const queries = cliQueries?.length
    ? cliQueries
    : seedsOnly
      ? seedQueries
      : [...new Set([...seedQueries, ...[
          'employment unfair dismissal',
          'constitutional petition',
          'contract breach damages',
          'land dispute title',
          'judicial review',
          'criminal appeal',
          'matrimonial property',
          'banking recovery',
        ]])];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const legalSources = app.get(LegalSourceService);
    console.log(
      `[sync:ke-case-law] Syncing Kenya judgments (feed limit ${feedLimit}, queries ${queries.length})` +
        (forceReindex ? ' — force reindex' : '') +
        (seedsOnly ? ' — seeds only' : ''),
    );

    const result = await legalSources.syncKenyaCaseLaw({
      feedLimit: seedsOnly ? 0 : feedLimit,
      forceReindex,
      queries,
    });

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
