"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  BadgeCheck,
  Calendar,
  CheckCircle2,
  Coins,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type ConfirmCheckoutResult } from "@/lib/api/subscriptions"
import { buildAuthHeaders } from "@/lib/api/client"
import { usesCookieSession } from "@/lib/auth/session-config"
import { getCurrentBilling } from "@/lib/api/billing"
import { refresh, fetchSession } from "@/lib/api/auth"
import { useAuth } from "@/lib/contexts/auth-context"
import { useTenantOptional } from "@/lib/contexts/tenant-context"
import { usePlanPricingI18n } from "@/lib/pricing/plan-i18n"
import { billingPlanToTier } from "@/lib/utils/plan-from-tenant"

type ConfirmState =
  | { status: "idle" | "loading" | "polling" | "restoring_session" }
  | { status: "success"; result: ConfirmCheckoutResult; viaPoll?: boolean }
  | { status: "pending"; message: string }
  | { status: "error"; message: string }
  | { status: "needs_sign_in" }

const POLL_ATTEMPTS = 12
const POLL_INTERVAL_MS = 2500
const CONFIRM_TIMEOUT_MS = 45000

interface SubscriptionSuccessClientProps {
  sessionId: string
  redirectPath: string
  serverConfirm?: ConfirmCheckoutResult | null
  serverError?: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isUpstreamRouteMissing(message: string): boolean {
  return /cannot (GET|POST|PUT|PATCH|DELETE)\s+\/api/i.test(message)
}

function formatMoney(amount: number, currency: string): string {
  if (!amount || !currency) return ""
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" || currency === "KRW" ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

async function pollForActiveBilling(tenantId?: string) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS)
    try {
      const billing = await getCurrentBilling(tenantId)
      const active =
        billing.subscriptionStatus === "ACTIVE" ||
        billing.hasStripeSubscription ||
        (billing.billingPlan != null &&
          billing.billingPlan !== "FREE" &&
          billing.billingPlan !== "TRIAL_PENDING_PAYMENT")
      if (active) return billing
    } catch {
      // keep polling
    }
  }
  return null
}

async function confirmWithTimeout(
  sessionId: string,
  tenantId?: string,
): Promise<ConfirmCheckoutResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CONFIRM_TIMEOUT_MS)
  try {
    const headers = await buildAuthHeaders(true, tenantId)
    headers.set("Content-Type", "application/json")
    const response = await fetch("/api/subscriptions/confirm-checkout/", {
      method: "POST",
      headers,
      credentials: usesCookieSession() ? "include" : undefined,
      signal: controller.signal,
      body: JSON.stringify({ sessionId }),
    })
    const text = await response.text()
    let data: ConfirmCheckoutResult | { message?: string } = {}
    if (text) {
      try {
        data = JSON.parse(text) as ConfirmCheckoutResult | { message?: string }
      } catch {
        data = { message: text.slice(0, 240) }
      }
    }
    if (!response.ok) {
      const message =
        (data as { message?: string }).message ??
        response.statusText ??
        "Could not confirm subscription"
      throw new Error(message)
    }
    return data as ConfirmCheckoutResult
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Confirmation timed out. Please try again.")
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function SubscriptionSuccessClient({
  sessionId,
  redirectPath,
  serverConfirm,
  serverError,
}: SubscriptionSuccessClientProps) {
  const t = useTranslations("marketing")
  const { getTierDisplayLabel } = usePlanPricingI18n()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: authLoading, setUser } = useAuth()
  const { activeTenantId, refreshTenants } = useTenantOptional()

  const resolvedTenantId =
    activeTenantId ?? (user?.userType === "LAWYER" ? user.tenantId ?? undefined : undefined)

  const destinationPath = useMemo(() => {
    if (redirectPath.startsWith("/")) return redirectPath
    if (user?.userType === "LAWYER") return "/app/dashboard"
    if (user?.userType === "CONSUMER") return "/consumer/dashboard"
    return "/app/dashboard"
  }, [redirectPath, user?.userType])

  const [state, setState] = useState<ConfirmState>(() => {
    if (serverConfirm) return { status: "success", result: serverConfirm }
    if (serverError) return { status: "error", message: serverError }
    return { status: "idle" }
  })
  const [authRestoreAttempted, setAuthRestoreAttempted] = useState(false)
  const confirmStartedRef = useRef(false)
  const redirectScheduledRef = useRef(false)

  const invalidateCaches = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["plan-usage"] }),
      queryClient.invalidateQueries({ queryKey: ["credit-wallet"] }),
      queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter"] }),
      queryClient.invalidateQueries({ queryKey: ["billing-current"] }),
      queryClient.invalidateQueries({ queryKey: ["intro-offer"] }),
      refreshTenants(),
    ])
  }, [queryClient, refreshTenants])

  const scheduleRedirect = useCallback(() => {
    if (redirectScheduledRef.current) return
    redirectScheduledRef.current = true
    setTimeout(() => router.replace(destinationPath), 1500)
  }, [destinationPath, router])

  const runConfirm = useCallback(
    (cancelSignal: { cancelled: boolean }) => {
      ;(async () => {
        setState({ status: "loading" })

        try {
          const result = await confirmWithTimeout(sessionId, resolvedTenantId)
          if (cancelSignal.cancelled) return
          await invalidateCaches()
          setState({ status: "success", result })
          scheduleRedirect()
          return
        } catch (err) {
          if (cancelSignal.cancelled) return

          const rawMessage =
            err instanceof Error ? err.message : "Could not confirm subscription"
          const routeMissing = isUpstreamRouteMissing(rawMessage)

          setState({ status: "polling" })
          const billing = await pollForActiveBilling(resolvedTenantId)
          if (cancelSignal.cancelled) return

          if (billing) {
            await invalidateCaches()
            const tier =
              billing.planTier && billing.planTier !== "FREE"
                ? billing.planTier
                : billingPlanToTier(billing.billingPlan)
            setState({
              status: "success",
              viaPoll: true,
              result: {
                activated: true,
                alreadyActive: false,
                planId: billing.planId,
                planLabel: getTierDisplayLabel(tier),
                aiCredits: 0,
                creditsGranted: 0,
                amount: 0,
                currency: billing.currency ?? "",
                currentPeriodEnd: billing.currentPeriodEnd ?? null,
                billing,
              },
            })
            scheduleRedirect()
            return
          }

          if (routeMissing || /404|not found/i.test(rawMessage)) {
            setState({
              status: "pending",
              message: t("subscriptionSuccessPendingDeploy"),
            })
          } else {
            setState({
              status: "error",
              message: rawMessage || t("subscriptionSuccessConfirmFailed"),
            })
          }
        }
      })()
    },
    [
      sessionId,
      resolvedTenantId,
      invalidateCaches,
      t,
      getTierDisplayLabel,
      scheduleRedirect,
    ],
  )

  // Server-side confirm succeeded — invalidate caches and redirect.
  useEffect(() => {
    if (!serverConfirm) return
    void invalidateCaches().then(() => scheduleRedirect())
  }, [serverConfirm, invalidateCaches, scheduleRedirect])

  // Restore session after Stripe redirect when server-side confirm could not run.
  useEffect(() => {
    if (serverConfirm || serverError) return
    if (authLoading || authRestoreAttempted || !sessionId) return
    if (isAuthenticated) return

    setAuthRestoreAttempted(true)
    setState({ status: "restoring_session" })

    ;(async () => {
      try {
        await refresh("")
        const sessionUser = await fetchSession()
        if (sessionUser) {
          setUser(sessionUser)
          return
        }
      } catch {
        // fall through
      }
      setState({ status: "needs_sign_in" })
    })()
  }, [
    authLoading,
    authRestoreAttempted,
    isAuthenticated,
    sessionId,
    serverConfirm,
    serverError,
    setUser,
  ])

  // Client-side confirm fallback (once per page load).
  useEffect(() => {
    if (serverConfirm || serverError) return
    if (authLoading || !sessionId || !isAuthenticated) return
    if (confirmStartedRef.current) return
    confirmStartedRef.current = true

    const cancelSignal = { cancelled: false }
    runConfirm(cancelSignal)
    return () => {
      cancelSignal.cancelled = true
    }
  }, [sessionId, isAuthenticated, authLoading, serverConfirm, serverError, runConfirm])

  const planUsageHref = useMemo(
    () =>
      resolvedTenantId
        ? "/app/settings/plan-usage?subscribed=1"
        : "/consumer/settings?subscribed=1",
    [resolvedTenantId],
  )

  const successResult = state.status === "success" ? state.result : null
  const isBusy =
    state.status === "loading" ||
    state.status === "polling" ||
    state.status === "restoring_session"
  const isPending = state.status === "pending"
  const isError = state.status === "error"
  const needsSignIn = state.status === "needs_sign_in"

  const signInHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set(
      "redirect",
      `/subscription/success?session_id=${encodeURIComponent(sessionId)}${
        redirectPath ? `&redirect=${encodeURIComponent(redirectPath)}` : ""
      }`,
    )
    return `/auth?${params.toString()}`
  }, [sessionId, redirectPath])

  const priceLabel =
    successResult && successResult.amount > 0 && successResult.currency
      ? formatMoney(successResult.amount, successResult.currency)
      : null

  return (
    <Card className="overflow-hidden border-primary/20 shadow-lg">
      <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary to-primary/60" />
      <CardHeader className="text-center space-y-4 pb-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
          {isBusy ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : isPending || isError ? (
            <Sparkles className="h-7 w-7 text-primary" />
          ) : (
            <CheckCircle2 className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl">
            {isBusy
              ? state.status === "polling"
                ? t("subscriptionSuccessSyncing")
                : t("subscriptionSuccessActivating")
              : needsSignIn
                ? t("subscriptionSuccessActivating")
                : isPending || isError
                  ? t("subscriptionSuccessActivating")
                  : t("subscriptionSuccessWelcome", { plan: successResult?.planLabel ?? "" })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isBusy
              ? state.status === "polling"
                ? t("subscriptionSuccessSyncingHint")
                : t("subscriptionSuccessActivatingHint")
              : needsSignIn
                ? "Sign in to activate your subscription and update your credits."
                : isPending
                  ? state.message
                  : isError
                    ? state.message
                    : t("subscriptionSuccessBody")}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pb-8">
        {successResult && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t("subscriptionSuccessPlan")}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{successResult.planLabel}</span>
                <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
                  <BadgeCheck className="h-3 w-3 mr-1" />
                  {t("subscriptionSuccessActiveBadge")}
                </Badge>
              </div>
            </div>
            {successResult.aiCredits > 0 && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5" />
                  {t("subscriptionSuccessCredits")}
                </span>
                <span className="font-medium tabular-nums">
                  {successResult.aiCredits.toLocaleString()} / {t("subscriptionSuccessPerMonth")}
                </span>
              </div>
            )}
            {successResult.creditsGranted > 0 && (
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {t("subscriptionSuccessCreditsAdded", {
                  count: successResult.creditsGranted.toLocaleString(),
                })}
              </p>
            )}
            {priceLabel && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{t("subscriptionSuccessPrice")}</span>
                <span className="font-medium tabular-nums">
                  {priceLabel}
                  <span className="text-muted-foreground font-normal"> / {t("subscriptionSuccessPerMonth")}</span>
                </span>
              </div>
            )}
            {successResult.currentPeriodEnd && (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("subscriptionSuccessRenews")}
                </span>
                <span className="font-medium">
                  {format(new Date(successResult.currentPeriodEnd), "MMM d, yyyy")}
                </span>
              </div>
            )}
            {state.status === "success" && state.viaPoll && (
              <p className="text-xs text-muted-foreground">{t("subscriptionSuccessWebhookHint")}</p>
            )}
          </div>
        )}

        {isPending && (
          <p className="text-center text-sm text-amber-700 dark:text-amber-400">
            {t("subscriptionSuccessPendingHint")}
          </p>
        )}

        {isError && (
          <div className="space-y-3">
            <p className="text-center text-sm text-destructive break-words">
              {state.message}
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                confirmStartedRef.current = false
                const cancelSignal = { cancelled: false }
                runConfirm(cancelSignal)
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        )}

        {needsSignIn && (
          <Button asChild className="w-full" size="lg">
            <Link href={signInHref}>Sign in to finish setup</Link>
          </Button>
        )}

        <Button asChild className="w-full" size="lg" disabled={isBusy || needsSignIn}>
          <Link href={destinationPath}>
            {redirectPath ? "Continue where you left off" : t("subscriptionGoToDashboard")}
          </Link>
        </Button>

        <Button asChild variant="secondary" className="w-full" disabled={isBusy}>
          <Link href={planUsageHref}>{t("subscriptionPlanUsage")}</Link>
        </Button>

        <Button asChild variant="outline" className="w-full">
          <Link href="/pricing">{t("subscriptionBackToPricing")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
