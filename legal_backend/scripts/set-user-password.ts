/**
 * Set or reset a user's password in Postgres and Firebase Auth.
 *
 * Usage:
 *   SET_PASSWORD_EMAIL=user@example.com SET_PASSWORD_VALUE='...' \
 *     npx ts-node --transpile-only -r tsconfig-paths/register scripts/set-user-password.ts
 *
 * Optional:
 *   SET_PASSWORD_SKIP_FIREBASE=1   — Postgres only
 */
import './cli-bootstrap';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { resolveFirebaseServiceAccount } from '../src/common/utils/firebase-admin.util';
import { validatePasswordPolicy } from '../src/auth/password/password-policy.util';

const prisma = new PrismaClient();

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

async function main() {
  const email = process.env.SET_PASSWORD_EMAIL?.trim().toLowerCase();
  const password = process.env.SET_PASSWORD_VALUE;
  const skipFirebase = process.env.SET_PASSWORD_SKIP_FIREBASE === '1';

  if (!email || !password) {
    console.error(
      'Required env vars: SET_PASSWORD_EMAIL, SET_PASSWORD_VALUE',
    );
    process.exit(1);
  }

  const policy = validatePasswordPolicy(password, { email });
  if (!policy.valid) {
    console.error('Password policy failed:', policy.feedback.join(' '));
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      firebaseUid: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  if (!user.isActive) {
    console.error(`User ${email} is inactive`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });
  console.log(`Postgres passwordHash updated for ${email}`);

  if (skipFirebase) {
    console.log('Skipped Firebase (SET_PASSWORD_SKIP_FIREBASE=1)');
    return;
  }

  const firebaseApp = await initFirebase();
  if (!firebaseApp) {
    console.warn(
      'Firebase Admin not configured — Postgres password set only. ' +
        'Email/password login via Firebase client will fail until Firebase is updated.',
    );
    return;
  }

  const auth = admin.auth(firebaseApp);
  let uid = user.firebaseUid;

  if (!uid) {
    try {
      const fbUser = await auth.getUserByEmail(email);
      uid = fbUser.uid;
      await prisma.user.update({
        where: { id: user.id },
        data: { firebaseUid: uid },
      });
      console.log(`Linked firebaseUid ${uid} from Firebase lookup`);
    } catch {
      console.warn(
        'No Firebase user linked — Postgres password set; user can use backend login fallback.',
      );
      return;
    }
  }

  await auth.updateUser(uid, { password });
  console.log(`Firebase password updated for ${email} (uid=${uid})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
