/**
 * Reset free-tier consumers who have never spent credits to CONSUMER_SIGNUP_CREDITS (100).
 * Skips consumers with any DEBIT ledger entries or an active paid subscription.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/reset-unused-consumer-credits.ts [--dry-run]
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';
import { resolveConsumerSignupCredits } from '../src/config/pricing.config';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const signupCredits = resolveConsumerSignupCredits();

  const profiles = await prisma.consumerProfile.findMany({
    where: { subscriptionStatus: 'FREE', user: { userType: 'CONSUMER' } },
    select: {
      userId: true,
      aiCreditsRemaining: true,
      user: { select: { email: true } },
    },
  });

  const activeSubUserIds = new Set(
    (
      await prisma.subscription.findMany({
        where: {
          userId: { in: profiles.map((p) => p.userId) },
          userType: 'CONSUMER',
          status: 'ACTIVE',
        },
        select: { userId: true },
      })
    )
      .map((s) => s.userId)
      .filter((id): id is string => !!id),
  );

  const freeConsumers = profiles.filter((p) => !activeSubUserIds.has(p.userId));
  const userIds = freeConsumers.map((p) => p.userId);

  const debitedUserIds = new Set(
    (
      await prisma.aICreditLedger.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, eventType: 'DEBIT' },
      })
    )
      .map((row) => row.userId)
      .filter((id): id is string => !!id),
  );

  const unused = freeConsumers.filter((p) => !debitedUserIds.has(p.userId));
  const toReset = unused.filter((p) => p.aiCreditsRemaining !== signupCredits);

  console.log(`Signup credits target : ${signupCredits}`);
  console.log(`Free-tier consumers   : ${freeConsumers.length}`);
  console.log(`Never spent (unused)  : ${unused.length}`);
  console.log(`Already at ${signupCredits}         : ${unused.length - toReset.length}`);
  console.log(`Will reset            : ${toReset.length}`);
  console.log(`Skipped (has debits)  : ${debitedUserIds.size}`);
  console.log(`Skipped (active sub)  : ${activeSubUserIds.size}`);
  console.log(`Mode                  : ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log('');

  let updated = 0;

  for (const consumer of toReset) {
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${consumer.user.email}: ` +
        `${consumer.aiCreditsRemaining} → ${signupCredits}`,
    );

    if (dryRun) {
      updated++;
      continue;
    }

    await prisma.aICreditLedger.deleteMany({ where: { userId: consumer.userId } });

    await prisma.consumerProfile.update({
      where: { userId: consumer.userId },
      data: { aiCreditsRemaining: 0 },
    });

    await prisma.aICreditLedger.create({
      data: {
        userId: consumer.userId,
        eventType: 'CREDIT',
        taskType: 'signup_bonus',
        credits: signupCredits,
        metadata: {
          source: 'reset_unused_consumer_credits',
          resetAt: new Date().toISOString(),
          previousBalance: consumer.aiCreditsRemaining,
        },
      },
    });

    await prisma.consumerProfile.update({
      where: { userId: consumer.userId },
      data: { aiCreditsRemaining: signupCredits },
    });

    updated++;
  }

  console.log(
    `\n${dryRun ? 'Would reset' : 'Reset'} ${updated} unused free consumer(s) to ${signupCredits} credits.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
