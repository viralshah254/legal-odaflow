/**
 * Must be imported first in CLI ingest/sync scripts (before AppModule).
 * - Disables Nest schedulers (no background DB jobs during bulk ingest)
 * - Prefers DIRECT_DATABASE_URL for long-running Neon transactions
 * - Tightens Prisma pool settings for single-process CLI workloads
 */
import { config } from 'dotenv';
import { resolve } from 'path';

const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env.local') });
config({ path: resolve(root, '.env') });

process.env.UMBRELLA_CLI_MODE = '1';
process.env.DISABLE_SCHEDULERS = '1';

function tunePoolUrl(raw: string): string {
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '3');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '60');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const direct = process.env.DIRECT_DATABASE_URL?.trim();
if (direct) {
  process.env.DATABASE_URL = tunePoolUrl(direct);
} else if (process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = tunePoolUrl(process.env.DATABASE_URL.trim());
}
