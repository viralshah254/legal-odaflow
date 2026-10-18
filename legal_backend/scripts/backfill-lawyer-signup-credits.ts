/**
 * Grant signup bonus credits to unpaid lawyer tenants that never received them.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/backfill-lawyer-signup-credits.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { resolveLawyerSignupCredits } from '../src/config/pricing.config';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const signupCredits = resolveLawyerSignupCredits();

  const tenants = await prisma.tenant.findMany({
    where: { type: 'LAW_FIRM' },
    select: {
      id: true,
      name: true,
      aiCreditsRemaining: true,
      billingPlan: true,
      createdAt: true,
    },
  });

  let updated = 0;

  for (const tenant of tenants) {
    const activeSub = await prisma.subscription.findFirst({
      where: { tenantId: tenant.id, userType: 'LAW_FIRM', status: 'ACTIVE' },
    });
    if (activeSub) {
      continue;
    }

    const balance = tenant.aiCreditsRemaining;
    if (balance >= signupCredits) {
      continue;
    }

    const existingBonus = await prisma.aICreditLedger.findFirst({
      where: {
        tenantId: tenant.id,
        eventType: 'CREDIT',
        taskType: 'signup_bonus',
      },
    });
    if (existingBonus) {
      continue;
    }

    const toGrant = signupCredits - balance;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${tenant.name} (${tenant.id}): grant ${toGrant} credits (balance ${balance} → ${signupCredits})`,
    );

    if (dryRun) {
      updated++;
      continue;
    }

    await prisma.aICreditLedger.create({
      data: {
        tenantId: tenant.id,
        eventType: 'CREDIT',
        taskType: 'signup_bonus',
        credits: toGrant,
        metadata: { source: 'backfill_lawyer_signup' },
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { aiCreditsRemaining: { increment: toGrant } },
    });

    updated++;
  }

  console.log(
    `\n${dryRun ? 'Would update' : 'Updated'} ${updated} unpaid tenant(s) to ${signupCredits} signup credits.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
