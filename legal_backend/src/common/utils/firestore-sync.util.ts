/**
 * Firestore sync utility — writes credit balance/metadata to Firestore after
 * payments or AI debits so the web UI can receive real-time balance updates.
 *
 * All errors are swallowed: Firestore is a convenience layer on top of Postgres
 * and must never break the primary payment flow.
 */
import { getFirebaseAdminApp } from './firebase-admin.util';

interface CreditBalanceDoc {
  balance: number;
  userSegment: string;
  countryCode: string;
  currency: string;
  updatedAt: FirebaseFirestore.FieldValue;
}

let _db: FirebaseFirestore.Firestore | null = null;

function resolveFirestoreDatabaseId(): string {
  const configured = process.env.FIRESTORE_DATABASE_ID?.trim();
  return configured && configured.length > 0 ? configured : '(default)';
}

async function getFirestore(): Promise<FirebaseFirestore.Firestore | null> {
  if (_db) return _db;
  try {
    const app = await getFirebaseAdminApp();
    if (!app) return null;
    const { getFirestore: adminGetFirestore } = await import('firebase-admin/firestore');
    _db = adminGetFirestore(app, resolveFirestoreDatabaseId());
    return _db;
  } catch (err) {
    console.warn(
      '[Firestore] init failed:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Write the user's credit balance to Firestore at `users/{uid}/credits/wallet`.
 * The web client subscribes to this path with `onSnapshot` for real-time updates.
 */
export async function syncUserCreditBalance(params: {
  firebaseUid: string;
  balance: number;
  userSegment?: string;
  countryCode?: string;
  currency?: string;
}): Promise<void> {
  const db = await getFirestore();
  if (!db) return;

  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const ref = db
      .collection('users')
      .doc(params.firebaseUid)
      .collection('credits')
      .doc('wallet');

    const data: CreditBalanceDoc = {
      balance: params.balance,
      userSegment: params.userSegment ?? 'CONSUMER',
      countryCode: params.countryCode ?? 'US',
      currency: params.currency ?? 'USD',
      updatedAt: FieldValue.serverTimestamp(),
    };

    await ref.set(data, { merge: true });
  } catch (err) {
    // Non-fatal: log and continue
    console.warn('[Firestore] syncUserCreditBalance failed:', (err as Error).message);
  }
}

/**
 * Seed the Firestore `credit_packs` collection with the provided packs.
 * Call this from an admin script or after loading packs from the database so
 * the web client can fetch them without a backend round-trip.
 */
export async function seedFirestoreCreditPacks(
  packs: Array<{
    packId: string;
    label: string;
    description: string;
    credits: number;
    usdPrice: number;
    popular?: boolean;
    bestValue?: boolean;
    order?: number;
  }>,
): Promise<void> {
  const db = await getFirestore();
  if (!db || packs.length === 0) return;

  try {
    const { FieldValue } = await import('firebase-admin/firestore');
    const batch = db.batch();
    for (const pack of packs) {
      const ref = db.collection('credit_packs').doc(pack.packId);
      batch.set(ref, { ...pack, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('[Firestore] seedFirestoreCreditPacks failed:', (err as Error).message);
  }
}
