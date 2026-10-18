/// <reference types="node" />
/**
 * Admin script: wipe a consumer's credit ledger and reset to their plan allowance.
 * Free users get CONSUMER_SIGNUP_CREDITS (default 100).
 * Plus subscribers get country plan aiCredits from pricing seeds.
 *
 * Usage: npx ts-node -r tsconfig-paths/register scripts/reset-consumer-credits.ts --email=user@example.com
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';
import {
  getPricingForCountry,
  PRICING_PLANS,
  resolveConsumerSignupCredits,
} from '../src/config/pricing.config';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const email = emailArg?.split('=')[1];
  if (!email) {
    console.error('Usage: --email=user@example.com');
    process.exit(1);
  }
  return { email };
}

function resolveMonthlyCredits(params: {
  countryCode: string;
  hasActiveSubscription: boolean;
  planId?: string | null;
}): number {
  if (!params.hasActiveSubscription) {
    return resolveConsumerSignupCredits();
  }

  const planId = params.planId ?? PRICING_PLANS.CONSUMER_PLUS;
  const seed = getPricingForCountry(params.countryCode, 'CONSUMER', planId);
  if (seed?.aiCredits && seed.aiCredits > 0) {
    return seed.aiCredits;
  }

  // Fallback: US consumer_plus seed, then signup credits
  const usPlus = getPricingForCountry('US', 'CONSUMER', PRICING_PLANS.CONSUMER_PLUS);
  return usPlus?.aiCredits ?? resolveConsumerSignupCredits();
}

async function main() {
  const { email } = parseArgs();

  const user = await prisma.user.findUnique({
    where: { email },
    include: { consumerProfile: true },
  });

  if (!user) {
    console.error(`❌  User not found: ${email}`);
    process.exit(1);
  }

  const profile = user.consumerProfile;
  if (!profile) {
    console.error(`❌  No consumer profile for ${email} (user id: ${user.id})`);
    process.exit(1);
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id, userType: 'CONSUMER', status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });

  const monthlyCredits = resolveMonthlyCredits({
    countryCode: profile.countryCode,
    hasActiveSubscription: !!subscription,
    planId: subscription?.planId,
  });

  console.log(`\nUser              : ${email} (${user.id})`);
  console.log(`Subscription      : ${subscription?.planId ?? 'none'} / status=${profile.subscriptionStatus}`);
  console.log(`Current balance   : ${profile.aiCreditsRemaining} credits`);
  console.log(`Reset allowance   : ${monthlyCredits} credits`);
  console.log(`\nResetting...`);

  const { count: deleted } = await prisma.aICreditLedger.deleteMany({
    where: { userId: user.id },
  });
  console.log(`  • Deleted ${deleted} ledger entries`);

  await prisma.consumerProfile.update({
    where: { userId: user.id },
    data: { aiCreditsRemaining: 0 },
  });

  await prisma.aICreditLedger.create({
    data: {
      userId: user.id,
      eventType: 'CREDIT',
      taskType: subscription ? 'admin_credit_reset' : 'signup_bonus',
      credits: monthlyCredits,
      metadata: {
        reason: 'manual_monthly_refresh',
        planId: subscription?.planId ?? profile.subscriptionStatus,
        resetBy: 'admin-script',
        resetAt: new Date().toISOString(),
      },
    },
  });

  await prisma.consumerProfile.update({
    where: { userId: user.id },
    data: { aiCreditsRemaining: monthlyCredits },
  });

  console.log(`  • Ledger reset with ${monthlyCredits} credits`);
  console.log(`  • consumerProfile.aiCreditsRemaining = ${monthlyCredits}`);
  console.log(`\n✅  Done — ${email} now has ${monthlyCredits} credits.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
