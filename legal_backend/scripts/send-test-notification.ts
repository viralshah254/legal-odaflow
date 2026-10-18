/**
 * Creates an in-app notification for tenant users and sends FCM push where tokens exist.
 *
 * Usage (from legal_backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/send-test-notification.ts
 *
 * Optional env overrides:
 *   NOTIF_TITLE="Good morning to the User"
 *   NOTIF_BODY="This week our plan is to fight 100 cases"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getFirebaseAdminApp } from '../src/common/utils/firebase-admin.util';

const TITLE = process.env.NOTIF_TITLE?.trim() || 'Good morning to the User';
const BODY =
  process.env.NOTIF_BODY?.trim() || 'This week our plan is to fight 100 cases';
const TYPE = 'INFO';
const BATCH_SIZE = 500;

async function main() {
  const prisma = new PrismaClient();
  const app = await getFirebaseAdminApp();
  const messaging = app?.messaging() ?? null;

  const tenantUsers = await prisma.tenantUser.findMany({
    where: { user: { isActive: true } },
    select: { tenantId: true, userId: true },
    distinct: ['tenantId', 'userId'],
  });

  if (tenantUsers.length === 0) {
    console.log('No active tenant users found — nothing to notify.');
    await prisma.$disconnect();
    return;
  }

  const created = await prisma.notification.createMany({
    data: tenantUsers.map(({ tenantId, userId }) => ({
      tenantId,
      userId,
      title: TITLE,
      body: BODY,
      type: TYPE,
    })),
  });

  console.log(`Created ${created.count} in-app notification(s).`);

  if (!messaging) {
    console.log('Firebase Admin not configured — in-app only (no push).');
    await prisma.$disconnect();
    return;
  }

  const tokenRows = await prisma.deviceToken.findMany({
    select: { token: true },
    distinct: ['token'],
  });

  if (tokenRows.length === 0) {
    console.log('No device tokens registered — in-app only.');
    await prisma.$disconnect();
    return;
  }

  const tokens = tokenRows.map((row) => row.token);
  let totalSent = 0;
  let totalFailed = 0;
  const staleTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: TITLE, body: BODY },
      data: { type: TYPE },
      android: { notification: { channelId: 'umbrella_notifications' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });

    totalSent += response.successCount;
    totalFailed += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        resp.error?.code === 'messaging/registration-token-not-registered'
      ) {
        staleTokens.push(batch[idx]);
      }
    });
  }

  if (staleTokens.length > 0) {
    await prisma.deviceToken.deleteMany({
      where: { token: { in: staleTokens } },
    });
    console.log(`Removed ${staleTokens.length} stale device token(s).`);
  }

  console.log(
    `Push complete — ${totalSent} delivered, ${totalFailed} failed (${tokens.length} token(s)).`,
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
