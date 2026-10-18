/**
 * Dev/admin script: upgrade a user's plan by email (law firm or consumer).
 * Sets billing plan / subscription status, resets credits via ledger, and upserts
 * an ACTIVE subscription so Plan & Usage and /admin/subscriptions reflect premium.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/upgrade-tenant-plan.ts --email=user@example.com --plan=PROFESSIONAL
 *
 * Consumer accounts are upgraded to consumer_plus (premium consumer tier).
 */
import { PrismaClient } from '@prisma/client';
import {
  getTenantPlanCreditAllowance,
  mapBillingPlanToPlanId,
  normalizeBillingPlan,
} from '../src/config/billing-plans';
import { PRICING_PLANS } from '../src/config/pricing.config';

const prisma = new PrismaClient();

const CONSUMER_PLUS_CREDITS = 200;

function parseArgs() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const planArg = args.find((a) => a.startsWith('--plan='));
  const email = emailArg?.split('=')[1];
  const plan = planArg?.split('=')[1] ?? 'PROFESSIONAL';
  if (!email) {
    console.error('Usage: --email=user@example.com [--plan=PROFESSIONAL|PRO_PLUS|STARTER|SOLO]');
    process.exit(1);
  }
  return { email, plan };
}

async function findUserByEmail(email: string) {
  const exact = await prisma.user.findUnique({
    where: { email },
    include: {
      consumerProfile: true,
      tenantUsers: {
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (exact) return exact;

  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: {
      consumerProfile: true,
      tenantUsers: {
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

async function upgradeConsumer(user: {
  id: string;
  email: string;
  consumerProfile: { countryCode: string } | null;
}) {
  if (!user.consumerProfile) {
    console.error(`No consumer profile for ${user.email}`);
    process.exit(1);
  }

  const countryCode = user.consumerProfile.countryCode ?? 'IN';
  const currency = countryCode === 'IN' ? 'INR' : 'USD';
  const credits = CONSUMER_PLUS_CREDITS;
  const planId = PRICING_PLANS.CONSUMER_PLUS;

  const cycleStart = new Date();
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 30);

  console.log(`\nUser              : ${user.email} (${user.id})`);
  console.log(`Account type      : CONSUMER → consumer_plus`);
  console.log(`Credits           : ${credits}`);
  console.log(`Cycle             : ${cycleStart.toISOString().split('T')[0]} → ${cycleEnd.toISOString().split('T')[0]}`);
  console.log('\nUpgrading...');

  const ledgerAggregate = await prisma.aICreditLedger.aggregate({
    where: { userId: user.id },
    _count: true,
  });

  await prisma.aICreditLedger.deleteMany({ where: { userId: user.id } });
  console.log(`  • Deleted ${ledgerAggregate._count} ledger entries`);

  await prisma.consumerProfile.update({
    where: { userId: user.id },
    data: { subscriptionStatus: 'ACTIVE', aiCreditsRemaining: 0 },
  });

  await prisma.aICreditLedger.create({
    data: {
      userId: user.id,
      eventType: 'CREDIT',
      taskType: 'admin_credit_reset',
      credits,
      metadata: {
        reason: 'manual_plan_upgrade',
        planId,
        resetBy: 'upgrade-tenant-plan-script',
        resetAt: cycleStart.toISOString(),
        cycleStart: cycleStart.toISOString(),
        cycleEnd: cycleEnd.toISOString(),
      },
    },
  });

  await prisma.consumerProfile.update({
    where: { userId: user.id },
    data: { aiCreditsRemaining: credits },
  });
  console.log(`  • Ledger reset with ${credits} credits`);

  const existingSub = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: 'ACTIVE',
        planId,
        userType: 'CONSUMER',
        countryCode,
        currency,
        currentPeriodStart: cycleStart,
        currentPeriodEnd: cycleEnd,
        cancelAtPeriodEnd: false,
      },
    });
    console.log(`  • Subscription ${existingSub.id} updated → ACTIVE (${planId})`);
  } else {
    const created = await prisma.subscription.create({
      data: {
        userId: user.id,
        userType: 'CONSUMER',
        countryCode,
        currency,
        planId,
        status: 'ACTIVE',
        paymentProvider: 'manual',
        currentPeriodStart: cycleStart,
        currentPeriodEnd: cycleEnd,
        cancelAtPeriodEnd: false,
      },
    });
    console.log(`  • Subscription ${created.id} created → ACTIVE (${planId}, manual comp)`);
  }

  console.log(`\nUpgraded consumer ${user.email} to Plus with ${credits} AI credits\n`);
}

async function upgradeLawFirm(
  user: { id: string; email: string },
  membership: {
    tenantId: string;
    tenant: {
      name: string;
      primaryCountry: string | null;
      defaultCurrency: string | null;
    };
  },
  normalized: ReturnType<typeof normalizeBillingPlan>,
  credits: number,
  planId: string,
) {
  const tenantId = membership.tenantId;
  const tenant = membership.tenant;
  const countryCode = tenant.primaryCountry ?? 'IN';
  const currency = tenant.defaultCurrency ?? (countryCode === 'IN' ? 'INR' : 'USD');

  const cycleStart = new Date();
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 30);

  console.log(`\nUser              : ${user.email} (${user.id})`);
  console.log(`Tenant            : ${tenant.name} (${tenantId})`);
  console.log(`Target plan       : ${normalized} (${planId})`);
  console.log(`Credits           : ${credits}`);
  console.log(`Cycle             : ${cycleStart.toISOString().split('T')[0]} → ${cycleEnd.toISOString().split('T')[0]}`);
  console.log('\nUpgrading...');

  const ledgerAggregate = await prisma.aICreditLedger.aggregate({
    where: { tenantId },
    _count: true,
  });

  await prisma.aICreditLedger.deleteMany({ where: { tenantId } });
  console.log(`  • Deleted ${ledgerAggregate._count} ledger entries`);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { billingPlan: normalized, aiCreditsRemaining: 0 },
  });

  await prisma.aICreditLedger.create({
    data: {
      tenantId,
      eventType: 'CREDIT',
      taskType: 'admin_credit_reset',
      credits,
      metadata: {
        reason: 'manual_plan_upgrade',
        billingPlan: normalized,
        resetBy: 'upgrade-tenant-plan-script',
        resetAt: cycleStart.toISOString(),
        cycleStart: cycleStart.toISOString(),
        cycleEnd: cycleEnd.toISOString(),
      },
    },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { aiCreditsRemaining: credits },
  });
  console.log(`  • Ledger reset with ${credits} credits`);

  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        status: 'ACTIVE',
        planId,
        userType: 'LAW_FIRM',
        countryCode,
        currency,
        currentPeriodStart: cycleStart,
        currentPeriodEnd: cycleEnd,
        cancelAtPeriodEnd: false,
      },
    });
    console.log(`  • Subscription ${existingSub.id} updated → ACTIVE (${planId})`);
  } else {
    const created = await prisma.subscription.create({
      data: {
        tenantId,
        userType: 'LAW_FIRM',
        countryCode,
        currency,
        planId,
        status: 'ACTIVE',
        paymentProvider: 'manual',
        currentPeriodStart: cycleStart,
        currentPeriodEnd: cycleEnd,
        cancelAtPeriodEnd: false,
      },
    });
    console.log(`  • Subscription ${created.id} created → ACTIVE (${planId}, manual comp)`);
  }

  console.log(
    `\nUpgraded tenant "${tenant.name}" (${tenantId}) to ${normalized} with ${credits} AI credits for user ${user.email}\n`,
  );
}

async function main() {
  const { email, plan } = parseArgs();
  const normalized = normalizeBillingPlan(plan);
  const credits = getTenantPlanCreditAllowance(normalized);
  const planId = mapBillingPlanToPlanId(normalized, 'LAW_FIRM');

  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const membership = user.tenantUsers[0];
  if (membership?.tenant) {
    await upgradeLawFirm(user, membership, normalized, credits, planId);
    return;
  }

  if (user.userType === 'CONSUMER' || user.consumerProfile) {
    await upgradeConsumer(user);
    return;
  }

  console.error(`No active tenant or consumer profile for ${email}`);
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
