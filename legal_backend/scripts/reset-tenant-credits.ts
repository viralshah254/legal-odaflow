/**
 * Admin script: wipe a tenant's AI credit ledger and reset to a specified
 * number of credits, starting a fresh billing cycle from today.
 *
 * Usage:
 *   npx ts-node --transpile-only -r tsconfig-paths/register \
 *     scripts/reset-tenant-credits.ts --email=user@example.com [--credits=800]
 */
import { PrismaClient } from '@prisma/client';
import { getUnpaidTenantCreditAllowance } from '../src/config/billing-plans';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith('--email='));
  const creditsArg = args.find((a) => a.startsWith('--credits='));
  const email = emailArg?.split('=')[1];
  const credits = creditsArg ? Number(creditsArg.split('=')[1]) : undefined;
  if (!email) {
    console.error('Usage: --email=user@example.com [--credits=800]');
    process.exit(1);
  }
  return { email, creditsOverride: credits };
}

/** Monthly credit allowance per billing plan (single source of truth). */
const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  SOLO: 400,
  STARTER: 400,
  PROFESSIONAL: 800,
  PRO_PLUS: 2000,
  ENTERPRISE: 2500,
  TRIAL_PENDING_PAYMENT: 50,
};

async function main() {
  const { email, creditsOverride } = parseArgs();

  // ── 1. Resolve tenant ────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenantUsers: {
        where: { status: 'ACTIVE' },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const membership = user.tenantUsers[0];
  if (!membership?.tenant) {
    console.error(`No active tenant for ${email}`);
    process.exit(1);
  }

  const { tenantId } = membership;
  const tenant = membership.tenant;

  // ── 2. Determine credit amount ───────────────────────────────────────────
  // Prefer: (a) explicit --credits arg, (b) CountryPricing DB, (c) in-memory map
  let monthlyCredits = creditsOverride;

  if (!monthlyCredits) {
    // Try CountryPricing DB first (most accurate, country-localized)
    const sub = await prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (sub) {
      const row = await prisma.countryPricing.findFirst({
        where: { planId: sub.planId, countryCode: sub.countryCode, isActive: true },
      });
      if (row?.aiCredits) {
        monthlyCredits = row.aiCredits;
        console.log(`  Credits from CountryPricing DB (${sub.planId}/${sub.countryCode}): ${monthlyCredits}`);
      }
    }
  }

  if (!monthlyCredits) {
    const activeSub = await prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSub) {
      const plan = tenant.billingPlan ?? 'STARTER';
      monthlyCredits = PLAN_MONTHLY_CREDITS[plan.toUpperCase()] ?? 800;
      console.log(`  Credits from billing plan fallback (${plan}): ${monthlyCredits}`);
    } else {
      monthlyCredits = getUnpaidTenantCreditAllowance();
      console.log(`  Credits from unpaid trial allowance: ${monthlyCredits}`);
    }
  }

  // ── 3. Print current state ───────────────────────────────────────────────
  const ledgerAggregate = await prisma.aICreditLedger.aggregate({
    where: { tenantId },
    _count: true,
  });
  const ledgerCount = ledgerAggregate._count;

  const cycleStart = new Date();
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 30);

  console.log(`\nUser              : ${email} (${user.id})`);
  console.log(`Tenant            : ${tenant.name} (${tenantId})`);
  console.log(`Billing plan      : ${tenant.billingPlan}`);
  console.log(`Current balance   : ${tenant.aiCreditsRemaining} credits`);
  console.log(`Ledger entries    : ${ledgerCount}`);
  console.log(`Reset to          : ${monthlyCredits} credits`);
  console.log(`New cycle         : ${cycleStart.toISOString().split('T')[0]} → ${cycleEnd.toISOString().split('T')[0]}`);
  console.log('\nResetting...');

  // ── 4. Wipe ledger & reset balance ──────────────────────────────────────
  await prisma.aICreditLedger.deleteMany({ where: { tenantId } });
  console.log(`  • Deleted ${ledgerCount} ledger entries`);

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { aiCreditsRemaining: 0 },
  });

  // ── 5. Write fresh credit entry ──────────────────────────────────────────
  await prisma.aICreditLedger.create({
    data: {
      tenantId,
      eventType: 'CREDIT',
      taskType: 'admin_credit_reset',
      credits: monthlyCredits,
      metadata: {
        reason: 'manual_monthly_refresh',
        billingPlan: tenant.billingPlan,
        resetBy: 'admin-script',
        resetAt: cycleStart.toISOString(),
        cycleStart: cycleStart.toISOString(),
        cycleEnd: cycleEnd.toISOString(),
      },
    },
  });

  // ── 6. Update tenant balance and activate subscription period ───────────
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { aiCreditsRemaining: monthlyCredits },
  });

  // Activate the pending subscription and set cycle dates so the UI
  // derives the correct billing period from subscription.currentPeriodStart/End.
  const pendingSub = await prisma.subscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  if (pendingSub) {
    await prisma.subscription.update({
      where: { id: pendingSub.id },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: cycleStart,
        currentPeriodEnd: cycleEnd,
      },
    });
    console.log(`  • Subscription ${pendingSub.id} activated (${pendingSub.planId})`);
    console.log(`    Cycle: ${cycleStart.toISOString().split('T')[0]} → ${cycleEnd.toISOString().split('T')[0]}`);
  } else {
    console.log('  • No subscription record found — balance reset only');
  }

  console.log(`  • Ledger reset with ${monthlyCredits} credits (admin_credit_reset)`);
  console.log(`  • tenant.aiCreditsRemaining = ${monthlyCredits}`);
  console.log(`\nTenant "${tenant.name}" now has ${monthlyCredits} credits with a fresh cycle.\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
