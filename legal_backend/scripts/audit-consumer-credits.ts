/**
 * Read-only audit of consumer credit balances and signup_bonus ledger coverage.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/audit-consumer-credits.ts
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';
import {
  resolveConsumerSignupCredits,
  resolveDailyFreeConsumerCredits,
} from '../src/config/pricing.config';

const prisma = new PrismaClient();

async function main() {
  const signupCredits = resolveConsumerSignupCredits();
  const dailyCredits = resolveDailyFreeConsumerCredits();

  console.log(`Expected signup credits : ${signupCredits}`);
  console.log(`Daily free grant amount : ${dailyCredits}`);
  console.log('');

  const profiles = await prisma.consumerProfile.findMany({
    select: {
      userId: true,
      aiCreditsRemaining: true,
      subscriptionStatus: true,
      countryCode: true,
      createdAt: true,
      user: { select: { email: true, userType: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const consumers = profiles.filter((p) => p.user.userType === 'CONSUMER');
  console.log(`Total ConsumerProfile rows (userType=CONSUMER): ${consumers.length}`);

  const activeSubUserIds = new Set(
    (
      await prisma.subscription.findMany({
        where: {
          userId: { in: consumers.map((c) => c.userId) },
          userType: 'CONSUMER',
          status: 'ACTIVE',
        },
        select: { userId: true },
      })
    )
      .map((s) => s.userId)
      .filter((id): id is string => !!id),
  );

  const freeTier = consumers.filter(
    (c) => c.subscriptionStatus === 'FREE' && !activeSubUserIds.has(c.userId),
  );
  const paidTiers = consumers.filter(
    (c) => c.subscriptionStatus !== 'FREE' || activeSubUserIds.has(c.userId),
  );

  console.log(`Free-tier (no active sub) : ${freeTier.length}`);
  console.log(`Paid / active sub         : ${paidTiers.length}`);
  console.log('');

  const byBalance = new Map<number, number>();
  for (const c of freeTier) {
    byBalance.set(c.aiCreditsRemaining, (byBalance.get(c.aiCreditsRemaining) ?? 0) + 1);
  }

  console.log('── Free-tier balance distribution ──');
  const sortedBalances = [...byBalance.entries()].sort((a, b) => a[0] - b[0]);
  for (const [balance, count] of sortedBalances) {
    let note = '';
    if (balance === 3) note = ' (legacy seed signup)';
    else if (balance === signupCredits) note = ' (exact signup amount)';
    else if (
      balance > signupCredits &&
      dailyCredits > 0 &&
      (balance - signupCredits) % dailyCredits === 0
    ) {
      const days = (balance - signupCredits) / dailyCredits;
      note = ` (signup + ${days}× daily grant)`;
    }
    console.log(`  ${String(balance).padStart(6)} credits → ${count} user(s)${note}`);
  }
  console.log('');

  const signupBonusUserIds = new Set(
    (
      await prisma.aICreditLedger.findMany({
        where: {
          userId: { in: freeTier.map((c) => c.userId) },
          eventType: 'CREDIT',
          taskType: 'signup_bonus',
        },
        select: { userId: true },
      })
    )
      .map((e) => e.userId)
      .filter((id): id is string => !!id),
  );

  const missingSignupBonus = freeTier.filter((c) => !signupBonusUserIds.has(c.userId));
  const legacyThree = freeTier.filter((c) => c.aiCreditsRemaining === 3);
  const notExactHundred = freeTier.filter((c) => c.aiCreditsRemaining !== signupCredits);

  console.log('── Flags ──');
  console.log(`Missing signup_bonus ledger : ${missingSignupBonus.length}`);
  console.log(`Legacy 3-credit balance     : ${legacyThree.length}`);
  console.log(`Balance ≠ ${signupCredits}               : ${notExactHundred.length}`);
  console.log('');

  if (notExactHundred.length > 0) {
    console.log('── Free-tier users with balance ≠ signup amount (sample up to 40) ──');
    for (const c of notExactHundred.slice(0, 40)) {
      console.log(
        `  ${c.user.email.padEnd(40)} balance=${c.aiCreditsRemaining} ` +
          `status=${c.subscriptionStatus} country=${c.countryCode} ` +
          `signup_bonus=${signupBonusUserIds.has(c.userId) ? 'yes' : 'NO'} ` +
          `created=${c.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    if (notExactHundred.length > 40) {
      console.log(`  … and ${notExactHundred.length - 40} more`);
    }
  }

  if (paidTiers.length > 0) {
    console.log('');
    console.log('── Paid / active-sub balances (not reset by free-tier backfill) ──');
    for (const c of paidTiers.slice(0, 20)) {
      console.log(
        `  ${c.user.email.padEnd(40)} balance=${c.aiCreditsRemaining} ` +
          `status=${c.subscriptionStatus} country=${c.countryCode}`,
      );
    }
    if (paidTiers.length > 20) {
      console.log(`  … and ${paidTiers.length - 20} more`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
