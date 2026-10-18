"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  completeOAuthRedirectLogin,
  isOAuthRedirectTimeout,
  resetOAuthRedirectLoginCache,
} from "@/lib/auth/oauth-flow"
import {
  clearOAuthRedirectPending,
  readOAuthRedirectPending,
} from "@/lib/auth/oauth-redirect-pending"
import { resolveReferralCode } from "@/lib/auth/referral-storage"
import { redirectAfterAuth } from "@/lib/auth/redirect-after-auth"
import { shouldUseFirebaseAuth } from "@/lib/firebase"
import { getDeviceId } from "@/lib/device/device-id"

/**
 * Finishes Apple/Google redirect sign-in on any route (not only /auth).
 * Needed when Firebase returns to localhost before the auth form mounts.
 */
export function OAuthRedirectBootstrap() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loginWithFirebase } = useAuth()
  const started = useRef(false)

  useEffect(() => {
    if (!shouldUseFirebaseAuth()) return
    if (started.current) return
    if (!readOAuthRedirectPending()) return

    started.current = true
    const redirectTo = searchParams.get("redirect")
    const refCode = searchParams.get("ref")
    const oauthExtras = {
      referralCode: resolveReferralCode(refCode) ?? undefined,
      deviceFingerprint: getDeviceId() ?? undefined,
    }

    completeOAuthRedirectLogin(loginWithFirebase, oauthExtras)
      .then((outcome) => {
        if (outcome.status === "authenticated") {
          redirectAfterAuth(outcome.response.user, router, redirectTo)
          return
        }
        if (outcome.status === "profile_completion") {
          const params = new URLSearchParams()
          if (redirectTo) params.set("redirect", redirectTo)
          if (refCode) params.set("ref", refCode)
          const suffix = params.toString() ? `?${params.toString()}` : ""
          router.replace(`/auth${suffix}`)
          return
        }
        if (outcome.status === "none") {
          clearOAuthRedirectPending()
          resetOAuthRedirectLoginCache()
          router.replace("/auth?oauth_error=1")
        }
      })
      .catch((error) => {
        started.current = false
        clearOAuthRedirectPending()
        resetOAuthRedirectLoginCache()
        if (isOAuthRedirectTimeout(error)) {
          router.replace("/auth?oauth_error=1")
        }
      })
  }, [loginWithFirebase, router, searchParams])

  return null
}
