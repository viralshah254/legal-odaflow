#!/usr/bin/env node
/**
 * Reseed jurisdiction forms from catalog.data.json
 * Deletes all isSystem rows and batch-inserts fresh catalog.
 *
 * Usage: node legal_backend/scripts/reseed-legal-forms.js
 * Requires: DATABASE_URL, prisma generate
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const catalogPath = path.join(__dirname, '../src/legal-forms/catalog.data.json');
  const metaPath = path.join(__dirname, '../src/legal-forms/catalog.generated.ts');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const versionMatch = fs.readFileSync(metaPath, 'utf8').match(
    /JURISDICTION_FORMS_CATALOG_VERSION = '([^']+)'/,
  );
  const version = versionMatch?.[1] ?? 'unknown';

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    console.log(`Reseeding legal forms catalog v${version} (${catalog.length} entries)...`);

    const deleted = await prisma.jurisdictionForm.deleteMany({ where: { isSystem: true } });
    console.log(`Deleted ${deleted.count} existing system forms.`);

    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < catalog.length; i += BATCH) {
      const batch = catalog.slice(i, i + BATCH);
      const result = await prisma.jurisdictionForm.createMany({
        data: batch.map((row) => ({ ...row })),
        skipDuplicates: true,
      });
      inserted += result.count;
      process.stdout.write(`\rInserted ${inserted}/${catalog.length}...`);
    }
    console.log('\nDone.');

    const total = await prisma.jurisdictionForm.count({ where: { isSystem: true } });
    console.log(JSON.stringify({ inserted, totalInDb: total, catalogVersion: version }, null, 2));

    if (process.env.LEGAL_FORMS_SKIP_EMBED !== 'true') {
      console.log('Running legal-forms:embed...');
      const { spawnSync } = require('child_process');
      const embed = spawnSync(
        'npx',
        ['ts-node', '-r', 'tsconfig-paths/register', 'scripts/embed-legal-forms-catalog.ts'],
        { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: process.env },
      );
      if (embed.status !== 0) {
        process.exit(embed.status ?? 1);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
