/**
 * Run legal-forms:embed in fresh-process chunks to avoid Postgres idle timeouts.
 * Usage: node scripts/embed-legal-forms-chunked.js [--chunk=400] [--from=0]
 */
const { execSync } = require('child_process');

const chunk = parseInt(
  process.argv.find((a) => a.startsWith('--chunk='))?.split('=')[1] ?? '400',
  10,
);
const from = parseInt(
  process.argv.find((a) => a.startsWith('--from='))?.split('=')[1] ?? '0',
  10,
);
const total = parseInt(
  process.argv.find((a) => a.startsWith('--total='))?.split('=')[1] ?? '10819',
  10,
);

for (let offset = from; offset < total; offset += chunk) {
  const limit = Math.min(chunk, total - offset);
  console.log(`\n=== Chunk offset=${offset} limit=${limit} ===\n`);
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      execSync(
        `npx ts-node --transpile-only -r tsconfig-paths/register scripts/embed-legal-forms-catalog.ts --offset=${offset} --limit=${limit}`,
        { stdio: 'inherit', cwd: __dirname + '/..' },
      );
      break;
    } catch (err) {
      if (attempts >= maxAttempts) throw err;
      const waitSec = attempts * 10;
      console.warn(`Chunk failed (attempt ${attempts}/${maxAttempts}), retrying in ${waitSec}s…`);
      execSync(`sleep ${waitSec}`);
    }
  }
}

console.log('\nAll chunks complete.');
