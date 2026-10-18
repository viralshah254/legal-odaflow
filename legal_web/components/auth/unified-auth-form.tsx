"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useTranslations } from "next-intl"
import { Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/contexts/auth-context"
import {
  getFirebaseAuthErrorMessage,
  isFirebaseAuthUnavailable,
  isFirebaseCredentialMismatch,
} from "@/lib/firebase-errors"
import {
  fetchEmailSignInMethods,
  getFirebaseIdToken,
  shouldUseFirebaseAuth,
  signInWithEmail,
} from "@/lib/firebase"
import { AuthShell } from "@/components/auth/auth-shell"
import {
  SocialAuthButtons,
  type SocialAuthProvider,
} from "@/components/auth/social-auth-buttons"
import { OAuthProfileCompletionForm } from "@/components/auth/oauth-profile-completion-form"
import {
  completeOAuthRedirectLogin,
  isOAuthRedirectPending,
  isOAuthRedirectTimeout,
  OAUTH_REDIRECT_COMPLETION_TIMEOUT_MS,
  resetOAuthRedirectLoginCache,
  runOAuthSignInFlow,
  type OAuthProfileCompletionState,
} from "@/lib/auth/oauth-flow"
import { readOAuthRedirectPending, clearOAuthRedirectPending } from "@/lib/auth/oauth-redirect-pending"
import { persistReferralCode, resolveReferralCode } from "@/lib/auth/referral-storage"
import { redirectAfterAuth } from "@/lib/auth/redirect-after-auth"
import { getDeviceId } from "@/lib/device/device-id"
import { lookupAuthEmail } from "@/lib/api/auth"
import { resolveEmailAuthPath } from "@/lib/auth/resolve-email-auth-path"

type EmailPhase = "enterEmail" | "enterPassword" | "socialOnly"

const emailOnlySchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("invalidEmail")),
  })

const passwordSchema = (t: (key: string) => string) =>
  z.object({
    password: z.string().min(1, t("passwordRequired")),
  })

export function UnifiedAuthForm() {
  const t = useTranslations("auth")
  const tc = useTranslations("common")
  const tErrors = useTranslations("errors")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect")
  const refCode = searchParams.get("ref")
  const { user, isLoading, isAuthenticated, login, loginWithFirebase } = useAuth()
  const firebaseReady = shouldUseFirebaseAuth()

  const [error, setError] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<SocialAuthProvider | null>(null)
  const [oauthCompleting, setOauthCompleting] = useState(false)
  const [profileCompletion, setProfileCompletion] =
    useState<OAuthProfileCompletionState | null>(null)
  const [emailPhase, setEmailPhase] = useState<EmailPhase>("enterEmail")
  const [resolvedEmail, setResolvedEmail] = useState("")
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailLookupWarning, setEmailLookupWarning] = useState<string | null>(null)
  const deepLinkHandled = useRef(false)

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(emailOnlySchema(t)),
  })

  const passwordForm = useForm<{ password: string }>({
    resolver: zodResolver(passwordSchema(t)),
  })

  useEffect(() => {
    persistReferralCode(refCode)
  }, [refCode])

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || profileCompletion) return
    redirectAfterAuth(user, router, redirectTo)
  }, [isLoading, isAuthenticated, user, profileCompletion, router, redirectTo])

  const oauthExtras = {
    referralCode: resolveReferralCode(refCode) ?? undefined,
    deviceFingerprint: getDeviceId() ?? undefined,
  }

  const resetOAuthLoadingState = (message?: string) => {
    clearOAuthRedirectPending()
    resetOAuthRedirectLoginCache()
    setOauthCompleting(false)
    setSocialLoading(null)
    if (message) setError(message)
  }

  useEffect(() => {
    if (searchParams.get("oauth_error") === "1") {
      resetOAuthLoadingState(t("oauthRedirectFailed"))
      const params = new URLSearchParams(searchParams.toString())
      params.delete("oauth_error")
      const query = params.toString()
      router.replace(query ? `/auth/?${query}` : "/auth/", { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!oauthCompleting && !socialLoading) return
    const timer = setTimeout(() => {
      resetOAuthLoadingState(t("oauthCompletingTooLong"))
    }, OAUTH_REDIRECT_COMPLETION_TIMEOUT_MS + 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthCompleting, socialLoading])

  const handleOAuthOutcome = (
    outcome:
      | { status: "authenticated"; response: Awaited<ReturnType<typeof loginWithFirebase>> }
      | { status: "profile_completion"; profile: OAuthProfileCompletionState }
      | { status: "redirect_pending" },
  ) => {
    if (outcome.status === "redirect_pending") {
      setOauthCompleting(true)
      return
    }
    if (outcome.status === "profile_completion") {
      setOauthCompleting(false)
      setSocialLoading(null)
      setProfileCompletion(outcome.profile)
      return
    }
    redirectAfterAuth(outcome.response.user, router, redirectTo)
  }

  useEffect(() => {
    if (!firebaseReady) return
    let cancelled = false
    const pendingProvider = readOAuthRedirectPending()
    if (pendingProvider) {
      setSocialLoading(pendingProvider)
      setOauthCompleting(true)
    }

    completeOAuthRedirectLogin(loginWithFirebase, oauthExtras)
      .then((outcome) => {
        if (cancelled) return
        if (outcome.status === "none") {
          setOauthCompleting(false)
          setSocialLoading(null)
          if (pendingProvider) {
            resetOAuthRedirectLoginCache()
            clearOAuthRedirectPending()
            setError(t("oauthRedirectFailed"))
          }
          return
        }
        if (outcome.status === "profile_completion") {
          setOauthCompleting(false)
          setSocialLoading(null)
          setProfileCompletion(outcome.profile)
          return
        }
        redirectAfterAuth(outcome.response.user, router, redirectTo)
      })
      .catch((err) => {
        if (cancelled) return
        if (isOAuthRedirectPending(err)) return
        resetOAuthRedirectLoginCache()
        setOauthCompleting(false)
        setSocialLoading(null)
        if (isOAuthRedirectTimeout(err)) {
          setError(t("oauthCompletingTooLong"))
          return
        }
        setError(getFirebaseAuthErrorMessage(err, tErrors))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseReady])

  const onSocialSignIn = async (provider: SocialAuthProvider) => {
    try {
      setError(null)
      setSocialLoading(provider)
      const outcome = await runOAuthSignInFlow(provider, loginWithFirebase, oauthExtras)
      handleOAuthOutcome(outcome)
      // Keep the form locked while redirecting to the IdP or into the app.
      if (
        outcome.status === "redirect_pending" ||
        outcome.status === "authenticated"
      ) {
        return
      }
      setSocialLoading(null)
      setOauthCompleting(false)
    } catch (err) {
      if (isOAuthRedirectPending(err)) {
        setOauthCompleting(true)
        return
      }
      setSocialLoading(null)
      setOauthCompleting(false)
      setError(getFirebaseAuthErrorMessage(err, tErrors))
    }
  }

  const navigateToSignUp = (email: string) => {
    const params = new URLSearchParams()
    if (email) params.set("email", email)
    if (redirectTo) params.set("redirect", redirectTo)
    // Referral code stays in localStorage (persistReferralCode above); do not
    // append ?ref= here — middleware redirects /auth/sign-up?ref= to landing.
    const query = params.toString()
    router.push(query ? `/auth/sign-up/?${query}` : "/auth/sign-up/")
  }

  const applyEmailAuthPath = (path: ReturnType<typeof resolveEmailAuthPath>, email: string) => {
    setResolvedEmail(email)
    if (path === "sign_up") {
      navigateToSignUp(email)
      return
    }
    if (path === "social_only") {
      setEmailPhase("socialOnly")
      return
    }
    setEmailPhase("enterPassword")
  }

  const routeEmailAddress = async (email: string) => {
    setError(null)
    setEmailLookupWarning(null)
    setCheckingEmail(true)

    try {
      let lookupFailed = false
      let lookup: { exists: boolean; hasPassword: boolean; hasFirebaseAccount: boolean } | null = null

      try {
        lookup = await lookupAuthEmail(email)
      } catch {
        lookupFailed = true
      }

      const methods = firebaseReady ? await fetchEmailSignInMethods(email) : []

      const path = resolveEmailAuthPath({
        signInMethods: methods,
        lookup,
        lookupFailed,
      })

      if (lookupFailed && path === "sign_up") {
        setEmailLookupWarning(t("emailLookupUnavailable"))
      }

      applyEmailAuthPath(path, email)
    } finally {
      setCheckingEmail(false)
    }
  }

  const onContinueEmail = async (data: { email: string }) => {
    await routeEmailAddress(data.email.trim())
  }

  useEffect(() => {
    const email = searchParams.get("email")?.trim()
    if (!email || deepLinkHandled.current || profileCompletion || oauthCompleting) return
    deepLinkHandled.current = true
    emailForm.setValue("email", email)
    void routeEmailAddress(email)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onPasswordSubmit = async (data: { password: string }) => {
    try {
      setError(null)
      const email = resolvedEmail

      if (firebaseReady) {
        let firebaseClientAuthed = false
        try {
          await signInWithEmail(email, data.password)
          firebaseClientAuthed = true
          const idToken = await getFirebaseIdToken()
          const response = await loginWithFirebase({ idToken })
          redirectAfterAuth(response.user, router, redirectTo)
          return
        } catch (firebaseError) {
          const fallbackToBackend =
            firebaseClientAuthed ||
            isFirebaseAuthUnavailable(firebaseError) ||
            isFirebaseCredentialMismatch(firebaseError)
          if (!fallbackToBackend) {
            throw firebaseError
          }
        }
      }

      const response = await login({ email, password: data.password })
      redirectAfterAuth(response.user, router, redirectTo)
    } catch (err) {
      setError(getFirebaseAuthErrorMessage(err, tErrors))
    }
  }

  const resetEmailPhase = () => {
    setEmailPhase("enterEmail")
    setResolvedEmail("")
    setEmailLookupWarning(null)
    passwordForm.reset()
    setError(null)
  }

  return (
    <AuthShell>
      <CardHeader className="space-y-1 text-center pb-2">
        <CardTitle className="text-2xl">
          {profileCompletion
            ? t("finishProfile")
            : oauthCompleting || socialLoading
              ? t("completingSignIn")
              : t("continueToUmbrella")}
        </CardTitle>
        <CardDescription>
          {profileCompletion
            ? t("finishProfileDescription")
            : oauthCompleting || socialLoading
              ? t("signInSecurityNote")
              : t("unifiedAuthDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {profileCompletion ? (
          <OAuthProfileCompletionForm
            email={profileCompletion.email}
            initialName={profileCompletion.name}
            referralCode={resolveReferralCode(refCode)}
            onError={setError}
            onComplete={(response) => {
              redirectAfterAuth(response.user, router, redirectTo)
            }}
          />
        ) : oauthCompleting || socialLoading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            {firebaseReady && (
              <div className="mb-4">
                <SocialAuthButtons
                  onProviderClick={onSocialSignIn}
                  loadingProvider={socialLoading}
                  disabled
                  showDivider={false}
                />
              </div>
            )}
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">{t("completingSignIn")}</p>
              <p className="text-xs text-muted-foreground">{t("unifiedAuthDescription")}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => resetOAuthLoadingState()}
              >
                {t("tryAgain")}
              </Button>
            </div>
            <p className="pt-2 text-xs text-center text-muted-foreground">
              {t("termsAgreement")}
            </p>
          </div>
        ) : (
          <>
            {firebaseReady && (
              <div className="mb-4">
                <SocialAuthButtons
                  onProviderClick={onSocialSignIn}
                  loadingProvider={socialLoading}
                  showDivider={emailPhase === "enterEmail"}
                />
              </div>
            )}

            {emailPhase === "enterEmail" && (
              <form
                onSubmit={emailForm.handleSubmit(onContinueEmail)}
                className="space-y-4"
              >
                {emailLookupWarning && (
                  <div className="p-3 text-sm text-muted-foreground bg-muted/50 rounded-md border border-border">
                    {emailLookupWarning}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t("youexamplecom")}
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-sm text-destructive">
                      {emailForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={checkingEmail || emailForm.formState.isSubmitting}
                >
                  {checkingEmail ? tc("loading") : tc("continue")}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      const email = emailForm.getValues("email")?.trim() ?? ""
                      navigateToSignUp(email)
                    }}
                  >
                    {t("dontHaveAccountSignUp")}
                  </button>
                </p>
              </form>
            )}

            {emailPhase === "enterPassword" && (
              <form
                onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{resolvedEmail}</p>
                  <Button type="button" variant="link" size="sm" onClick={resetEmailPhase}>
                    {t("useDifferentEmail")}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    {...passwordForm.register("password")}
                  />
                  {passwordForm.formState.errors.password && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="text-sm text-primary hover:underline block"
                >
                  {t("forgotPassword")}
                </Link>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={passwordForm.formState.isSubmitting}
                >
                  {passwordForm.formState.isSubmitting ? tc("loading") : t("signIn")}
                </Button>
              </form>
            )}

            {emailPhase === "socialOnly" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{resolvedEmail}</p>
                  <Button type="button" variant="link" size="sm" onClick={resetEmailPhase}>
                    {t("useDifferentEmail")}
                  </Button>
                </div>
                <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm">
                  <Info className="h-5 w-5 shrink-0 text-primary" />
                  <p className="text-muted-foreground">{t("accountUsesSocial")}</p>
                </div>
              </div>
            )}

            <p className="pt-4 text-xs text-center text-muted-foreground">
              {t("termsAgreement")}
            </p>
          </>
        )}
      </CardContent>
    </AuthShell>
  )
}
