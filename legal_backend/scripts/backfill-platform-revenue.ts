/**
 * One-time backfill script.
 * Migrates existing Payment rows (status=PAID) into PlatformRevenueEntry.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-platform-revenue.ts
 *   # dry run (no writes):
 *   DRY_RUN=true npx ts-node -r tsconfig-paths/register scripts/backfill-platform-revenue.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === 'true';

function mapPurposeToSource(purpose: string): string {
  if (purpose === 'subscription') return 'subscription';
  if (purpose === 'AI_CREDIT_TOPUP') return 'credit_topup';
  if (purpose === 'lawyer_review') return 'lawyer_review';
  if (purpose === 'marketplace') return 'marketplace';
  return 'other';
}

async function main() {
  console.log(`Starting backfill${DRY_RUN ? ' (DRY RUN)' : ''}...`);

  const payments = await prisma.payment.findMany({
    where: { status: 'PAID' },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${payments.length} PAID payments`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const p of payments) {
    const providerRef = `payment:${p.id}`;

    const existing = await prisma.platformRevenueEntry.findUnique({ where: { providerRef } });
    if (existing) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      try {
        const gross = Number(p.amount);
        await prisma.platformRevenueEntry.create({
          data: {
            source: mapPurposeToSource(p.purpose ?? ''),
            grossAmount: new Prisma.Decimal(gross),
            taxAmount: new Prisma.Decimal(0),
            feeAmount: new Prisma.Decimal(0),
            netAmount: new Prisma.Decimal(gross),
            currency: p.currency,
            countryCode: p.countryCode,
            tenantId: p.tenantId,
            userId: p.userId,
            paymentProvider: p.paymentProvider ?? 'unknown',
            providerRef,
            description: `Backfilled from Payment ${p.id}`,
            occurredAt: p.createdAt,
            metadata: { backfilled: true, paymentId: p.id } as Prisma.InputJsonValue,
          },
        });
        created++;
      } catch (err) {
        errors++;
        console.error(`  Error for payment ${p.id}: ${(err as Error).message}`);
      }
    } else {
      console.log(`  [DRY] would create entry for payment ${p.id} (${p.purpose})`);
      created++;
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped} errors=${errors}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
