/**
 * Flush cached legal search + AI research results (e.g. after corpus hotfix).
 *
 * Run:
 *   npm run flush:research-cache
 *   npm run flush:research-cache -- --pattern 'legal:search:*'
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CacheService } from '../src/cache/cache.service';

async function main() {
  const patternArg = process.argv.find((arg) => arg.startsWith('--pattern='));
  const pattern = patternArg?.split('=')[1] ?? 'legal:search:*';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const cache = app.get(CacheService);
    const patterns =
      pattern === 'all'
        ? ['legal:search:*', 'ai:research:*']
        : [pattern];

    let total = 0;
    for (const p of patterns) {
      const deleted = await cache.delByPattern(p);
      total += deleted;
      console.log(`Deleted ${deleted} keys matching ${p}`);
    }
    console.log(JSON.stringify({ patterns, totalDeleted: total }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
