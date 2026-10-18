import type { UserCredential } from "firebase/auth"
import {
  completeOAuthRedirectIfNeeded,
  getFirebaseAuth,
  getFirebaseIdToken,
  getFirebaseUserProfile,
  resetOAuthRedirectResultCache,
  signInWithApple,
  signInWithGoogle,
  waitForFirebaseAuthUser,
} from "@/lib/firebase"
import { parseProfileCompletionError } from "@/lib/auth/firebase-profile-completion"
import type { ProfileCompletionPayload } from "@/lib/auth/firebase-profile-completion"
import {
  clearOAuthRedirectPending,
  readOAuthRedirectPending,
  saveOAuthRedirectPending,
} from "@/lib/auth/oauth-redirect-pending"
import type { SocialAuthProvider } from "@/components/auth/social-auth-buttons"
import type { FirebaseLoginRequest } from "@/lib/api/firebase-auth"
import type { AuthResponse } from "@/lib/api/types"

export const OAUTH_REDIRECT_COMPLETION_TIMEOUT_MS = 15_000

export interface OAuthProfileCompletionState extends ProfileCompletionPayload {
  provider: SocialAuthProvider
}

export type OAuthRedirectLoginOutcome =
  | { status: "none" }
  | { status: "authenticated"; response: AuthResponse }
  | { status: "profile_completion"; profile: OAuthProfileCompletionState }

function mergeProfile(
  fromError: ProfileCompletionPayload | null,
  provider: SocialAuthProvider,
): OAuthProfileCompletionState | null {
  const fromFirebase = getFirebaseUserProfile()
  const email = fromError?.email ?? fromFirebase?.email
  if (!email) return null

  return {
    email,
    name: fromError?.name ?? fromFirebase?.name ?? null,
    provider,
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("OAUTH_REDIRECT_TIMEOUT"))
    }, timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

export function resetOAuthRedirectLoginCache(): void {
  oauthRedirectLoginOnce = null
  resetOAuthRedirectResultCache()
}

export async function signInWithOAuthProvider(
  provider: SocialAuthProvider,
): Promise<UserCredential> {
  if (provider === "google") {
    return signInWithGoogle()
  }
  return signInWithApple()
}

export async function attemptFirebaseLogin(
  loginWithFirebase: (data: FirebaseLoginRequest) => Promise<AuthResponse>,
  provider: SocialAuthProvider,
  extras: Omit<FirebaseLoginRequest, "idToken"> = {},
): Promise<
  | { status: "authenticated"; response: AuthResponse }
  | { status: "profile_completion"; profile: OAuthProfileCompletionState }
> {
  const idToken = await getFirebaseIdToken()
  try {
    const response = await loginWithFirebase({ idToken, ...extras })
    return { status: "authenticated", response }
  } catch (error) {
    const profilePayload = parseProfileCompletionError(error)
    if (profilePayload) {
      const profile = mergeProfile(profilePayload, provider)
      if (profile) {
        return { status: "profile_completion", profile }
      }
    }
    throw error
  }
}

async function resolveOAuthRedirectProvider(): Promise<SocialAuthProvider | null> {
  const pending = readOAuthRedirectPending()
  const result = await completeOAuthRedirectIfNeeded()
  if (result) {
    return result.providerId?.includes("apple") ? "apple" : "google"
  }
  if (!pending) return null

  const hasUser = await waitForFirebaseAuthUser()
  if (!hasUser) return null

  const user = getFirebaseAuth().currentUser
  if (!user) return null

  const linked = user.providerData.some((entry) =>
    pending === "apple"
      ? entry.providerId === "apple.com"
      : entry.providerId === "google.com",
  )
  return linked ? pending : null
}

let oauthRedirectLoginOnce: Promise<OAuthRedirectLoginOutcome> | null = null

export async function completeOAuthRedirectLogin(
  loginWithFirebase: (data: FirebaseLoginRequest) => Promise<AuthResponse>,
  extras: Omit<FirebaseLoginRequest, "idToken"> = {},
): Promise<OAuthRedirectLoginOutcome> {
  const pending = readOAuthRedirectPending()
  if (!pending && !oauthRedirectLoginOnce) {
    return { status: "none" }
  }

  if (!oauthRedirectLoginOnce) {
    oauthRedirectLoginOnce = withTimeout(
      completeOAuthRedirectLoginInner(loginWithFirebase, extras),
      OAUTH_REDIRECT_COMPLETION_TIMEOUT_MS,
    ).catch((error) => {
      oauthRedirectLoginOnce = null
      resetOAuthRedirectResultCache()
      throw error
    })
  }
  return oauthRedirectLoginOnce
}

async function completeOAuthRedirectLoginInner(
  loginWithFirebase: (data: FirebaseLoginRequest) => Promise<AuthResponse>,
  extras: Omit<FirebaseLoginRequest, "idToken"> = {},
): Promise<OAuthRedirectLoginOutcome> {
  const provider = await resolveOAuthRedirectProvider()
  if (!provider) {
    oauthRedirectLoginOnce = null
    return { status: "none" }
  }

  try {
    const outcome = await attemptFirebaseLogin(loginWithFirebase, provider, extras)
    clearOAuthRedirectPending()
    oauthRedirectLoginOnce = null
    return outcome
  } catch (error) {
    clearOAuthRedirectPending()
    oauthRedirectLoginOnce = null
    resetOAuthRedirectResultCache()
    throw error
  }
}

export async function runOAuthSignInFlow(
  provider: SocialAuthProvider,
  loginWithFirebase: (data: FirebaseLoginRequest) => Promise<AuthResponse>,
  extras: Omit<FirebaseLoginRequest, "idToken"> = {},
): Promise<
  | { status: "redirect_pending" }
  | { status: "authenticated"; response: AuthResponse }
  | { status: "profile_completion"; profile: OAuthProfileCompletionState }
> {
  // Apple (and redirect fallbacks) navigate away before the thrown
  // OAUTH_REDIRECT_PENDING can be caught — persist first.
  if (provider === "apple") {
    saveOAuthRedirectPending(provider)
  }

  try {
    await signInWithOAuthProvider(provider)
  } catch (error) {
    if (isOAuthRedirectPending(error)) {
      saveOAuthRedirectPending(provider)
      return { status: "redirect_pending" }
    }
    clearOAuthRedirectPending()
    throw error
  }

  clearOAuthRedirectPending()
  return attemptFirebaseLogin(loginWithFirebase, provider, extras)
}

export function isOAuthRedirectPending(error: unknown): boolean {
  return error instanceof Error && error.message === "OAUTH_REDIRECT_PENDING"
}

export function isOAuthRedirectTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === "OAUTH_REDIRECT_TIMEOUT"
}
