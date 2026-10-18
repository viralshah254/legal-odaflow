const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
  path.join(__dirname, 'firebase-service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Missing Firebase service account at ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const messaging = admin.messaging(app);
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.deviceToken.findMany({ select: { token: true, platform: true }, distinct: ['token'] });
  await prisma.$disconnect();

  const tokens = rows.map(r => r.token);
  console.log(`Found ${tokens.length} device token(s): ${rows.map(r => r.platform).join(', ')}`);

  if (tokens.length === 0) {
    console.log('No tokens — nothing to send.');
    return;
  }

  const TITLE = 'Garima & Viral';
  const BODY  = '1 Week to Launch. No sleep V ;)';
  const BATCH = 500;
  let totalSent = 0;

  for (let i = 0; i < tokens.length; i += BATCH) {
    const batch = tokens.slice(i, i + BATCH);
    const resp = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title: TITLE, body: BODY },
      android: { notification: { channelId: 'umbrella_notifications' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    totalSent += resp.successCount;
    resp.responses.forEach((r, idx) => {
      if (!r.success) console.log(`  Token ${i + idx} failed: ${r.error?.code} — ${r.error?.message}`);
      else console.log(`  Token ${i + idx} sent OK`);
    });
    console.log(`Batch ${i}–${i + batch.length}: ${resp.successCount}/${batch.length} sent`);
  }

  console.log(`\nDone. ${totalSent}/${tokens.length} tokens reached.`);
}

main().catch(e => { console.error(e); process.exit(1); });
