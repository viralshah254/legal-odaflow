/**
 * Reset all free-tier consumers to exactly CONSUMER_SIGNUP_CREDITS (default 100).
 * Wipes ledger entries, then writes a fresh signup_bonus grant.
 *
 * Excludes consumers with an active CONSUMER subscription.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/backfill-consumer-signup-credits.ts [--dry-run]
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';
import { resolveConsumerSignupCredits } from '../src/config/pricing.config';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const signupCredits = resolveConsumerSignupCredits();

  const profiles = await prisma.consumerProfile.findMany({
    where: { subscriptionStatus: 'FREE' },
    select: {
      userId: true,
      aiCreditsRemaining: true,
      subscriptionStatus: true,
      user: { select: { email: true, userType: true } },
    },
  });

  const freeConsumers = profiles.filter((p) => p.user.userType === 'CONSUMER');

  const activeSubUserIds = new Set(
    (
      await prisma.subscription.findMany({
        where: {
          userId: { in: freeConsumers.map((c) => c.userId) },
          userType: 'CONSUMER',
          status: 'ACTIVE',
        },
        select: { userId: true },
      })
    )
      .map((s) => s.userId)
      .filter((id): id is string => !!id),
  );

  const targets = freeConsumers.filter((c) => !activeSubUserIds.has(c.userId));
  const alreadyCorrect = targets.filter((c) => c.aiCreditsRemaining === signupCredits);
  const toReset = targets.filter((c) => c.aiCreditsRemaining !== signupCredits);

  console.log(`Signup credits target : ${signupCredits}`);
  console.log(`Free-tier eligible    : ${targets.length}`);
  console.log(`Already at target     : ${alreadyCorrect.length}`);
  console.log(`Will reset            : ${toReset.length}`);
  console.log(`Skipped (active sub)  : ${activeSubUserIds.size}`);
  console.log(`Mode                  : ${dryRun ? 'DRY-RUN' : 'APPLY'}`);
  console.log('');

  let updated = 0;

  for (const consumer of toReset) {
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${consumer.user.email} (${consumer.userId}): ` +
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
          source: 'backfill_consumer_signup',
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

  // Ensure users already at target have a signup_bonus ledger entry
  let ledgerBackfilled = 0;
  for (const consumer of alreadyCorrect) {
    const existing = await prisma.aICreditLedger.findFirst({
      where: {
        userId: consumer.userId,
        eventType: 'CREDIT',
        taskType: 'signup_bonus',
      },
    });
    if (existing) continue;

    console.log(
      `${dryRun ? '[dry-run] ' : ''}${consumer.user.email}: add missing signup_bonus ledger ` +
        `(balance already ${signupCredits})`,
    );

    if (!dryRun) {
      // Align ledger with profile without changing balance: wipe + rewrite signup grant
      await prisma.aICreditLedger.deleteMany({ where: { userId: consumer.userId } });
      await prisma.aICreditLedger.create({
        data: {
          userId: consumer.userId,
          eventType: 'CREDIT',
          taskType: 'signup_bonus',
          credits: signupCredits,
          metadata: {
            source: 'backfill_consumer_signup_ledger_only',
            resetAt: new Date().toISOString(),
          },
        },
      });
      await prisma.consumerProfile.update({
        where: { userId: consumer.userId },
        data: { aiCreditsRemaining: signupCredits },
      });
    }
    ledgerBackfilled++;
  }

  console.log(
    `\n${dryRun ? 'Would reset' : 'Reset'} ${updated} free consumer(s) to ${signupCredits} credits.`,
  );
  console.log(
    `${dryRun ? 'Would add' : 'Added'} signup_bonus ledger for ${ledgerBackfilled} already-correct user(s).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
