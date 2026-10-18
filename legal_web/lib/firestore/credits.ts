/**
 * Firestore real-time integration for AI credits.
 *
 * Data model:
 *   users/{uid}/credits  — live credit balance + metadata
 *   credit_packs/{packId} — pack catalogue (managed from Firebase console or backend)
 *
 * The backend webhook writes to these paths after each payment or AI debit,
 * giving the UI a real-time balance without polling.
 */
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore"
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase"
import type { CreditPack } from "@/lib/api/credits"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FirestoreCreditBalance {
  balance: number
  userSegment: string
  countryCode: string
  currency: string
  updatedAt: unknown // serverTimestamp
}

export interface FirestoreCreditPack {
  packId: string
  label: string
  description: string
  credits: number
  usdPrice: number
  popular?: boolean
  bestValue?: boolean
  order?: number
}

// ─── Balance listener ────────────────────────────────────────────────────────

/**
 * Subscribe to real-time credit balance for the authenticated Firebase user.
 * Returns an unsubscribe function. Falls back gracefully if Firebase is not
 * configured or the user is not signed in.
 */
export function subscribeToCredits(
  uid: string,
  onBalance: (balance: number) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    return () => {}
  }

  const db = getFirestoreDb()
  const ref = doc(db, "users", uid, "credits", "wallet")

  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FirestoreCreditBalance
        onBalance(data.balance ?? 0)
      }
    },
    (err) => {
      console.warn("[Firestore] credits listener error:", err.message)
      onError?.(err)
    },
  )
}

// ─── Credit packs catalogue ──────────────────────────────────────────────────

/**
 * Fetch credit packs from Firestore `credit_packs` collection.
 * Returns null if Firebase is not configured or collection is empty
 * (caller should fall back to the REST API).
 */
export async function getFirestoreCreditPacks(): Promise<CreditPack[] | null> {
  if (!isFirebaseConfigured()) return null

  try {
    const db = getFirestoreDb()
    const snap = await getDocs(collection(db, "credit_packs"))
    if (snap.empty) return null

    return snap.docs
      .map((d) => {
        const data = d.data() as FirestoreCreditPack
        return {
          packId: data.packId ?? d.id,
          label: data.label ?? d.id,
          description: data.description ?? "",
          credits: data.credits ?? 0,
          countryCode: "US",
          currency: "USD",
          amount: data.usdPrice ?? 0,
        } satisfies CreditPack
      })
      .sort((a, b) => {
        const aO = (snap.docs.find((d) => d.id === a.packId)?.data() as FirestoreCreditPack)?.order ?? 99
        const bO = (snap.docs.find((d) => d.id === b.packId)?.data() as FirestoreCreditPack)?.order ?? 99
        return aO - bO
      })
  } catch (err) {
    console.warn("[Firestore] failed to load credit_packs:", err)
    return null
  }
}

