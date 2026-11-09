import { initializeApp, getApps, type FirebaseApp, FirebaseError } from "@firebase/app"
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  onAuthStateChanged,
  type Auth,
  type ConfirmationResult,
  type UserCredential,
} from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"
import {
  persistOAuthDisplayName,
  readOAuthDisplayName,
} from "@/lib/auth/oauth-profile-cache"
import { saveOAuthRedirectPending } from "@/lib/auth/oauth-redirect-pending"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId,
  )
}

/** When false, use backend /auth/register and /auth/login even if Firebase env vars are set. */
export function shouldUseFirebaseAuth(): boolean {
  if (!isFirebaseConfigured()) {
    return false
  }
  const flag = process.env.NEXT_PUBLIC_USE_FIREBASE_AUTH
  return flag !== "false" && flag !== "0"
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.")
  }
  if (!app) {
    // HMR can leave a stale app from a prior env — only reuse when projectId matches.
    const matching = getApps().find(
      (candidate) => candidate.options.projectId === firebaseConfig.projectId,
    )
    if (matching) {
      app = matching
    } else if (getApps().length === 0) {
      app = initializeApp(firebaseConfig)
    } else {
      app = initializeApp(firebaseConfig, `legal-web-${firebaseConfig.projectId}`)
    }
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
  }
  return auth
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp())
  }
  return db
}

export function createRecaptchaVerifier(
  containerId: string,
  size: "invisible" | "normal" = "invisible",
): RecaptchaVerifier {
  const firebaseAuth = getFirebaseAuth()
  return new RecaptchaVerifier(firebaseAuth, containerId, { size })
}

export async function sendPhoneOtp(
  phoneNumber: string,
  recaptcha: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, recaptcha)
}

export async function signInWithEmail(
  email: string,
  password: string,
) {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (!credential.user.emailVerified) await sendEmailVerification(credential.user)
  return credential
}

export async function signUpWithEmail(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  await sendEmailVerification(credential.user)
  return credential
}

/** @deprecated Prefer try-sign-in flow; retained for unified auth email branching. */
export async function fetchEmailSignInMethods(email: string): Promise<string[]> {
  try {
    return await fetchSignInMethodsForEmail(getFirebaseAuth(), email.trim())
  } catch {
    return []
  }
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = getFirebaseAuth().currentUser
  if (!user) throw new Error("No Firebase user signed in")
  return user.getIdToken()
}

export function getFirebaseUserProfile(): {
  email: string
  name: string | null
} | null {
  const user = getFirebaseAuth().currentUser
  if (!user?.email) return null
  return {
    email: user.email,
    name: user.displayName ?? readOAuthDisplayName(),
  }
}

export function extractOAuthDisplayName(credential: UserCredential): string | null {
  if (credential.user.displayName?.trim()) {
    return credential.user.displayName.trim()
  }

  const profile = getAdditionalUserInfo(credential)?.profile as
    | Record<string, unknown>
    | undefined

  const appleName = profile?.name as
    | { firstName?: string; lastName?: string }
    | undefined
  if (appleName) {
    const parts = [appleName.firstName, appleName.lastName].filter(Boolean)
    if (parts.length > 0) {
      return parts.join(" ")
    }
  }

  const givenName = profile?.given_name
  const familyName = profile?.family_name
  if (typeof givenName === "string" || typeof familyName === "string") {
    return [givenName, familyName].filter(Boolean).join(" ")
  }

  return null
}

export function rememberOAuthProfile(credential: UserCredential): void {
  const name = extractOAuthDisplayName(credential)
  persistOAuthDisplayName(name)
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

function isPopupBlockedOrUnsupported(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return (
      error.code === "auth/popup-blocked" ||
      error.code === "auth/popup-closed-by-user" ||
      error.code === "auth/cancelled-popup-request" ||
      error.code === "auth/operation-not-supported-in-this-environment"
    )
  }
  return false
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1"
}

async function signInWithOAuthPopup(
  provider: GoogleAuthProvider | OAuthProvider,
  pendingProvider: "google" | "apple",
): Promise<UserCredential> {
  const firebaseAuth = getFirebaseAuth()
  try {
    return await signInWithPopup(firebaseAuth, provider)
  } catch (error) {
    // Local http dev cannot complete signInWithRedirect (Firebase uses https://localhost).
    if (isLocalDevHost()) {
      throw error
    }
    // Brave/Safari often close or block the popup immediately — fall back to redirect.
    if (isPopupBlockedOrUnsupported(error)) {
      saveOAuthRedirectPending(pendingProvider)
      await signInWithRedirect(firebaseAuth, provider)
      throw new Error("OAUTH_REDIRECT_PENDING")
    }
    throw error
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  provider.addScope("email")
  provider.addScope("profile")
  const credential = await signInWithOAuthPopup(provider, "google")
  rememberOAuthProfile(credential)
  return credential
}

export async function signInWithApple(): Promise<UserCredential> {
  const provider = new OAuthProvider("apple.com")
  provider.addScope("email")
  provider.addScope("name")

  // Redirect sign-in cannot complete on http://localhost (Firebase expects https://localhost).
  if (isLocalDevHost()) {
    const credential = await signInWithOAuthPopup(provider, "apple")
    rememberOAuthProfile(credential)
    return credential
  }

  const firebaseAuth = getFirebaseAuth()

  // Apple web Sign-In is unreliable in popups (Brave/Chrome/Safari). Always use
  // full-page redirect so authDomain proxy + Return URLs can complete the flow.
  await signInWithRedirect(firebaseAuth, provider)
  throw new Error("OAUTH_REDIRECT_PENDING")
}

/** Wait for Firebase to restore currentUser after an OAuth redirect (Brave / authDomain mismatch). */
export async function waitForFirebaseAuthUser(timeoutMs = 8000): Promise<boolean> {
  const firebaseAuth = getFirebaseAuth()
  if (firebaseAuth.currentUser) return true

  return new Promise((resolve) => {
    let settled = false
    const finish = (value: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      resolve(value)
    }

    const timer = setTimeout(() => finish(!!firebaseAuth.currentUser), timeoutMs)
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) finish(true)
    })
  })
}

/** Complete an OAuth redirect flow started by signInWithRedirect. Returns null if no redirect pending. */
let redirectResultOnce: Promise<UserCredential | null> | null = null

export function resetOAuthRedirectResultCache(): void {
  redirectResultOnce = null
}

export async function completeOAuthRedirectIfNeeded(): Promise<UserCredential | null> {
  if (!redirectResultOnce) {
    redirectResultOnce = (async () => {
      const result = await getRedirectResult(getFirebaseAuth())
      if (result) {
        rememberOAuthProfile(result)
      }
      return result
    })()
  }
  return redirectResultOnce
}
