/**
 * Delete all users except an explicit keep-list (Postgres + Firebase Auth).
 *
 * Dry-run:
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/purge-users-except.ts --dry-run
 *
 * Execute:
 *   npx ts-node --transpile-only -r tsconfig-paths/register scripts/purge-users-except.ts --confirm
 */
import './cli-bootstrap';
import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { resolveFirebaseServiceAccount } from '../src/common/utils/firebase-admin.util';

const KEEP_EMAILS = new Set(['ayiendaglen@gmail.com']);

const prisma = new PrismaClient();

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.argv.includes('--confirm');
  if (!dryRun && !confirm) {
    console.error(
      'Refusing to run without --dry-run or --confirm.\n' +
        '  --dry-run   show which accounts would be deleted\n' +
        '  --confirm   delete all other accounts',
    );
    process.exit(1);
  }
  return { dryRun, confirm };
}

async function initFirebase(): Promise<admin.app.App | null> {
  const config = resolveFirebaseServiceAccount();
  if (!config) return null;
  try {
    return admin.initializeApp({ credential: admin.credential.cert(config) });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return admin.app();
    }
    throw error;
  }
}

async function deleteUserCascade(userId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.referral.deleteMany({
        where: { OR: [{ referrerUserId: userId }, { refereeUserId: userId }] },
      });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.aICreditLedger.deleteMany({ where: { userId } });
      await tx.aIUsageLog.deleteMany({ where: { userId } });
      await tx.aIOutput.deleteMany({ where: { userId } });
      await tx.aICitation.deleteMany({ where: { userId } });
      await tx.payment.deleteMany({ where: { userId } });
      await tx.lawyerLead.deleteMany({ where: { userId } });
      await tx.trainingConsent.deleteMany({ where: { userId } });
      await tx.documentTrainingPermission.deleteMany({ where: { userId } });
      await tx.creditReservation.deleteMany({ where: { userId } });
      await tx.taskPatternUsage.deleteMany({ where: { userId } });
      await tx.legalTaskPattern.deleteMany({ where: { userId } });
      await tx.personalLegalVault.deleteMany({ where: { userId } });
      await tx.document.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: null },
      });
      await tx.user.delete({ where: { id: userId } });
    },
    { maxWait: 60_000, timeout: 120_000 },
  );
}

async function deleteOrphanTenants(): Promise<number> {
  const emptyTenants = await prisma.tenant.findMany({
    where: { tenantUsers: { none: {} } },
    select: { id: true, name: true },
  });
  if (emptyTenants.length === 0) return 0;

  await prisma.$transaction(
    async (tx) => {
      for (const tenant of emptyTenants) {
        await tx.tenant.delete({ where: { id: tenant.id } });
        console.log(`  ✓ Deleted orphan tenant: ${tenant.name}`);
      }
    },
    { maxWait: 60_000, timeout: 120_000 },
  );

  return emptyTenants.length;
}

async function main() {
  const { dryRun } = parseArgs();

  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').hostname;
    } catch {
      return 'unknown';
    }
  })();

  const users = await prisma.user.findMany({
    select: { id: true, email: true, userType: true, firebaseUid: true },
    orderBy: { createdAt: 'asc' },
  });

  const keep = users.filter((u) => KEEP_EMAILS.has(u.email.toLowerCase()));
  const toDelete = users.filter((u) => !KEEP_EMAILS.has(u.email.toLowerCase()));

  console.log(`Database host : ${dbHost}`);
  console.log(`Total users   : ${users.length}`);
  console.log(`Keeping       : ${keep.length}`);
  keep.forEach((u) => console.log(`  ✓ ${u.email} [${u.userType}]`));
  console.log(`Deleting      : ${toDelete.length}`);
  toDelete.forEach((u) => console.log(`  ✗ ${u.email} [${u.userType}]`));

  if (dryRun) {
    console.log('\nDry run complete — no changes made.');
    return;
  }

  const firebaseApp = await initFirebase();

  for (const user of toDelete) {
    console.log(`\nDeleting ${user.email}...`);
    try {
      await deleteUserCascade(user.id);
      console.log(`  ✓ Postgres user deleted`);

      if (firebaseApp && user.firebaseUid) {
        try {
          await admin.auth(firebaseApp).deleteUser(user.firebaseUid);
          console.log(`  ✓ Firebase user deleted`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  ⚠ Firebase delete failed: ${msg}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed: ${msg}`);
    }
  }

  console.log('\nRemoving orphan tenants…');
  const tenantsRemoved = await deleteOrphanTenants();
  console.log(`  Removed ${tenantsRemoved} orphan tenant(s)`);

  if (firebaseApp) {
    console.log('\nRemoving orphan Firebase Auth users…');
    let pageToken: string | undefined;
    let orphanDeleted = 0;
    do {
      const page = await admin.auth(firebaseApp).listUsers(1000, pageToken);
      for (const fbUser of page.users) {
        const email = fbUser.email?.toLowerCase() ?? '';
        if (KEEP_EMAILS.has(email)) continue;
        try {
          await admin.auth(firebaseApp).deleteUser(fbUser.uid);
          orphanDeleted += 1;
          console.log(`  ✓ Firebase orphan deleted: ${email || fbUser.uid}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  ⚠ Firebase orphan delete failed (${email || fbUser.uid}): ${msg}`);
        }
      }
      pageToken = page.pageToken;
    } while (pageToken);
    console.log(`  Removed ${orphanDeleted} orphan Firebase user(s)`);
  }

  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
