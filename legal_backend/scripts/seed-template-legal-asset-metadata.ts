/**
 * Seed SystemDocumentTemplate + DocumentTemplate metadata from template-legal-asset-metadata.ts (P5-02).
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/seed-template-legal-asset-metadata.ts --dry-run
 *   npx ts-node --transpile-only scripts/seed-template-legal-asset-metadata.ts
 */
import { PrismaClient } from '@prisma/client';
import { TEMPLATE_LEGAL_ASSET_METADATA } from '../src/config/templates/template-legal-asset-metadata';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  let updated = 0;
  for (const [documentKind, metadata] of Object.entries(TEMPLATE_LEGAL_ASSET_METADATA)) {
    if (dryRun) {
      const system = await prisma.systemDocumentTemplate.count({ where: { documentKind } });
      const firm = await prisma.documentTemplate.count({ where: { documentKind } });
      if (system + firm > 0) {
        updated += system + firm;
        console.log(`[dry-run] ${documentKind}: system=${system} firm=${firm}`);
      }
      continue;
    }
    const systemCount = await prisma.systemDocumentTemplate.updateMany({
      where: { documentKind },
      data: { practiceArea: metadata.practiceArea },
    });
    const firmCount = await prisma.documentTemplate.updateMany({
      where: { documentKind },
      data: { practiceArea: metadata.practiceArea },
    });
    if (systemCount.count + firmCount.count > 0) {
      updated += systemCount.count + firmCount.count;
      console.log(`${documentKind}: system=${systemCount.count} firm=${firmCount.count}`);
    }
  }
  console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} templates`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
