/**
 * One-shot broadcast script — sends Garima's welcome push to every registered device.
 * Run from legal_backend/:
 *   npx ts-node -r tsconfig-paths/register scripts/broadcast-welcome.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getFirebaseAdminApp } from '../src/common/utils/firebase-admin.util';

const TITLE = "Welcome to Garima's Innovation 🎉";
const BODY =
  "Your AI-powered legal workspace is ready. Manage matters, clients, and calendars — all in one place.";
const DATA: Record<string, string> = { route: '/lawyer/dashboard', type: 'welcome' };
const CHANNEL_ID = 'umbrella_notifications';
const BATCH_SIZE = 500;

async function main() {
  const app = await getFirebaseAdminApp();
  if (!app) {
    console.error('❌  Firebase Admin credentials missing — set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_* env vars.');
    process.exit(1);
  }
  const messaging = app.messaging();

  // ── Prisma: fetch all distinct device tokens ─────────────────────────────
  const prisma = new PrismaClient();
  const rows = await prisma.deviceToken.findMany({
    select: { token: true, userId: true },
    distinct: ['token'],
  });
  await prisma.$disconnect();

  if (rows.length === 0) {
    console.log('ℹ️  No device tokens registered — nothing to send.');
    return;
  }

  console.log(`📲  Sending to ${rows.length} token(s) across ${new Set(rows.map(r => r.userId)).size} user(s)…`);

  const tokens = rows.map(r => r.token);
  let totalSent = 0;
  let totalFailed = 0;
  const staleTokens: string[] = [];

  // ── Send in FCM multicast batches ─────────────────────────────────────────
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: TITLE, body: BODY },
      data: DATA,
      android: { notification: { channelId: CHANNEL_ID } },
    });

    totalSent += response.successCount;
    totalFailed += response.failureCount;

    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code ?? 'unknown';
        console.warn(`  ⚠️  Token [${batch[idx].slice(0, 10)}…] failed: ${code}`);
        if (code === 'messaging/registration-token-not-registered') {
          staleTokens.push(batch[idx]);
        }
      }
    });

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${response.successCount} sent, ${response.failureCount} failed`);
  }

  // ── Clean up stale tokens ─────────────────────────────────────────────────
  if (staleTokens.length > 0) {
    const cleanPrisma = new PrismaClient();
    const del = await cleanPrisma.deviceToken.deleteMany({
      where: { token: { in: staleTokens } },
    });
    await cleanPrisma.$disconnect();
    console.log(`🧹  Removed ${del.count} stale token(s) from the database.`);
  }

  console.log(`\n✅  Broadcast complete — ${totalSent} delivered, ${totalFailed} failed.`);
}

main().catch(err => {
  console.error('❌  Script failed:', err);
  process.exit(1);
});
