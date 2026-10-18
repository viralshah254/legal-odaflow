/// <reference types="node" />
/**
 * Admin script: add credits to a consumer (or tenant) account.
 * Usage: npx ts-node -r tsconfig-paths/register scripts/grant-consumer-credits.ts --email=user@example.com --credits=150
 */
import './cli-bootstrap';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const email = args.find((a) => a.startsWith('--email='))?.split('=')[1];
  const creditsRaw = args.find((a) => a.startsWith('--credits='))?.split('=')[1];
  const credits = Number(creditsRaw);

  if (!email || !Number.isFinite(credits) || credits <= 0) {
    console.error('Usage: --email=user@example.com --credits=150');
    process.exit(1);
  }

  return { email, credits };
}

async function main() {
  const { email, credits: creditsToAdd } = parseArgs();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const profile = await prisma.consumerProfile.findUnique({ where: { userId: user.id } });
  const tenantUsers = await prisma.tenantUser.findMany({
    where: { userId: user.id },
    include: { tenant: true },
  });

  console.log(`User              : ${email} (${user.id})`);
  console.log(`User type         : ${user.userType}`);
  console.log(`Consumer profile  : ${profile ? 'yes' : 'no'}`);
  console.log(`Current balance   : ${profile?.aiCreditsRemaining ?? 'n/a'}`);
  console.log(`Tenant memberships: ${tenantUsers.length}`);
  console.log(`\nGranting ${creditsToAdd} credits...`);

  const metadata = {
    reason: 'manual_admin_grant',
    email,
    grantedBy: 'admin-script',
    grantedAt: new Date().toISOString(),
  };

  if (profile) {
    await prisma.aICreditLedger.create({
      data: {
        userId: user.id,
        eventType: 'CREDIT',
        taskType: 'admin_credit_grant',
        credits: creditsToAdd,
        metadata,
      },
    });

    const updated = await prisma.consumerProfile.update({
      where: { userId: user.id },
      data: { aiCreditsRemaining: { increment: creditsToAdd } },
    });

    console.log(`New balance: ${updated.aiCreditsRemaining} credits`);
    console.log(`\nDone — ${email} received +${creditsToAdd} credits.\n`);
    return;
  }

  if (tenantUsers.length > 0) {
    const tenantId = tenantUsers[0].tenantId;
    const tenant = tenantUsers[0].tenant;

    await prisma.aICreditLedger.create({
      data: {
        tenantId,
        eventType: 'CREDIT',
        taskType: 'admin_credit_grant',
        credits: creditsToAdd,
        metadata,
      },
    });

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { aiCreditsRemaining: { increment: creditsToAdd } },
    });

    console.log(`Tenant            : ${tenant?.name ?? tenantId}`);
    console.log(`New balance       : ${updated.aiCreditsRemaining} credits`);
    console.log(`\nDone — tenant for ${email} received +${creditsToAdd} credits.\n`);
    return;
  }

  console.error(`No consumer profile or tenant membership for ${email}`);
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
