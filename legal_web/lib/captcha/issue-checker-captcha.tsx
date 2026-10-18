"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { CheckCircle, Loader2, Shield } from "lucide-react"
import { getDeviceId } from "@/lib/device/device-id"
import { cn } from "@/lib/utils"

export const CAPTCHA_REQUIRED_MESSAGE =
  "Please complete the verification check before continuing."

export const CAPTCHA_TIMEOUT_MESSAGE =
  "Verification is taking too long. Please try again."

export type IssueCheckerAbuseFields = {
  captchaToken?: string
  deviceFingerprint?: string
}

type IssueCheckerCaptchaContextValue = {
  captchaRequired: boolean
  captchaReady: boolean
  captchaFailed: boolean
  siteKey: string
  getAbuseFields: () => IssueCheckerAbuseFields
  /** Wait until a fresh Turnstile token is available (after reset / first load). */
  awaitAbuseFields: (timeoutMs?: number) => Promise<IssueCheckerAbuseFields>
  markAbuseFieldsUsed: () => void
  /** Consume token → run request → reset widget. Safe for sequential protected calls. */
  withAbuseFields: <T>(
    request: (fields: IssueCheckerAbuseFields) => Promise<T>,
  ) => Promise<T>
  retryCaptcha: () => void
  registerTurnstile: (instance: TurnstileInstance | null) => void
  onCaptchaSuccess: (token: string) => void
  onCaptchaExpire: () => void
  onCaptchaError: () => void
}

const IssueCheckerCaptchaContext = createContext<IssueCheckerCaptchaContextValue | null>(
  null,
)

function deviceFingerprintField(): IssueCheckerAbuseFields {
  return { deviceFingerprint: getDeviceId() ?? undefined }
}

function isLocalhostDev(): boolean {
  if (typeof window === "undefined") return false
  const h = window.location.hostname
  return h === "localhost" || h === "127.0.0.1" || h.endsWith(".localhost")
}

/**
 * Always-mounted Turnstile host.
 * Must stay in the document flow (not opacity-0 / 1px) — Cloudflare rejects
 * challenges from effectively-hidden widgets, especially on mobile Safari/Chrome.
 */
function IssueCheckerTurnstileHost() {
  const context = useContext(IssueCheckerCaptchaContext)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!context?.captchaRequired || !mounted) {
    return null
  }

  return (
    <div className="flex w-full justify-center [&:empty]:hidden [&_iframe]:max-w-full">
      <Turnstile
        ref={context.registerTurnstile}
        siteKey={context.siteKey}
        onSuccess={context.onCaptchaSuccess}
        onExpire={context.onCaptchaExpire}
        onError={context.onCaptchaError}
        options={{
          theme: "auto",
          size: "flexible",
          // Show the interactive challenge only when Cloudflare needs it;
          // otherwise stays quiet after a managed pass.
          appearance: "interaction-only",
          retry: "auto",
          refreshExpired: "auto",
        }}
      />
    </div>
  )
}

export function IssueCheckerCaptchaProvider({ children }: { children: ReactNode }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? ""
  // Turnstile site keys are domain-restricted. On localhost the token would
  // always fail backend verification, so skip captcha entirely in local dev.
  const captchaRequired = siteKey.length > 0 && !isLocalhostDev()
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaFailed, setCaptchaFailed] = useState(false)
  // Ref mirrors state so getAbuseFields / awaitAbuseFields see clears immediately
  // (React setState is async — sequential API calls were reusing spent tokens).
  const captchaTokenRef = useRef<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const waitersRef = useRef<Array<(token: string) => void>>([])

  const registerTurnstile = useCallback((instance: TurnstileInstance | null) => {
    turnstileRef.current = instance
  }, [])

  const resolveWaiters = useCallback((token: string) => {
    const waiters = waitersRef.current
    waitersRef.current = []
    for (const resolve of waiters) resolve(token)
  }, [])

  const markAbuseFieldsUsed = useCallback(() => {
    if (!captchaRequired) return
    captchaTokenRef.current = null
    setCaptchaToken(null)
    setCaptchaFailed(false)
    // Reset after paint so Cloudflare can mint a fresh token for the next call.
    queueMicrotask(() => {
      turnstileRef.current?.reset()
    })
  }, [captchaRequired])

  const retryCaptcha = useCallback(() => {
    captchaTokenRef.current = null
    setCaptchaToken(null)
    setCaptchaFailed(false)
    turnstileRef.current?.reset()
  }, [])

  const getAbuseFields = useCallback((): IssueCheckerAbuseFields => {
    const fingerprint = deviceFingerprintField()
    if (!captchaRequired) {
      return fingerprint
    }
    const token = captchaTokenRef.current
    if (!token) {
      throw new Error(CAPTCHA_REQUIRED_MESSAGE)
    }
    return {
      ...fingerprint,
      captchaToken: token,
    }
  }, [captchaRequired])

  const awaitAbuseFields = useCallback(
    (timeoutMs = 20_000): Promise<IssueCheckerAbuseFields> => {
      const fingerprint = deviceFingerprintField()
      if (!captchaRequired) {
        return Promise.resolve(fingerprint)
      }

      const existing = captchaTokenRef.current
      if (existing) {
        return Promise.resolve({ ...fingerprint, captchaToken: existing })
      }

      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          waitersRef.current = waitersRef.current.filter((w) => w !== onToken)
          setCaptchaFailed(true)
          reject(new Error(CAPTCHA_TIMEOUT_MESSAGE))
        }, timeoutMs)

        const onToken = (token: string) => {
          window.clearTimeout(timer)
          resolve({ ...fingerprint, captchaToken: token })
        }

        waitersRef.current.push(onToken)
        // Nudge the widget if it stalled after a previous reset.
        turnstileRef.current?.reset()
      })
    },
    [captchaRequired],
  )

  const withAbuseFields = useCallback(
    async <T,>(request: (fields: IssueCheckerAbuseFields) => Promise<T>): Promise<T> => {
      const fields = await awaitAbuseFields()
      try {
        return await request(fields)
      } finally {
        markAbuseFieldsUsed()
      }
    },
    [awaitAbuseFields, markAbuseFieldsUsed],
  )

  const onCaptchaSuccess = useCallback(
    (token: string) => {
      captchaTokenRef.current = token
      setCaptchaToken(token)
      setCaptchaFailed(false)
      resolveWaiters(token)
    },
    [resolveWaiters],
  )

  const onCaptchaExpire = useCallback(() => {
    captchaTokenRef.current = null
    setCaptchaToken(null)
  }, [])

  const onCaptchaError = useCallback(() => {
    captchaTokenRef.current = null
    setCaptchaToken(null)
    setCaptchaFailed(true)
  }, [])

  const captchaReady = !captchaRequired || Boolean(captchaToken)

  const value = useMemo(
    (): IssueCheckerCaptchaContextValue => ({
      captchaRequired,
      captchaReady,
      captchaFailed,
      siteKey,
      getAbuseFields,
      awaitAbuseFields,
      markAbuseFieldsUsed,
      withAbuseFields,
      retryCaptcha,
      registerTurnstile,
      onCaptchaSuccess,
      onCaptchaExpire,
      onCaptchaError,
    }),
    [
      awaitAbuseFields,
      captchaFailed,
      captchaReady,
      captchaRequired,
      getAbuseFields,
      markAbuseFieldsUsed,
      onCaptchaError,
      onCaptchaExpire,
      onCaptchaSuccess,
      registerTurnstile,
      retryCaptcha,
      siteKey,
      withAbuseFields,
    ],
  )

  return (
    <IssueCheckerCaptchaContext.Provider value={value}>
      {children}
    </IssueCheckerCaptchaContext.Provider>
  )
}

type IssueCheckerTurnstileWidgetProps = {
  className?: string
  /** Compact banner for steps after intake. */
  compact?: boolean
  /** When true, suppress the status banner once the check passes (widget stays mounted). */
  hideWhenReady?: boolean
}

export function IssueCheckerTurnstileWidget({
  className,
  compact = false,
  hideWhenReady = false,
}: IssueCheckerTurnstileWidgetProps) {
  const context = useContext(IssueCheckerCaptchaContext)

  if (!context?.captchaRequired) {
    return null
  }

  const showBanner = !(hideWhenReady && context.captchaReady && !context.captchaFailed)

  return (
    <div className={cn("space-y-2", className)}>
      {showBanner && (
        <div
          className={cn(
            "rounded-lg border bg-muted/30",
            compact ? "px-3 py-2" : "p-3",
            context.captchaFailed && "border-destructive/30 bg-destructive/5",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-2">
            {context.captchaFailed ? (
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            ) : context.captchaReady ? (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p
                className={cn(
                  "font-medium",
                  compact ? "text-xs" : "text-sm",
                  context.captchaFailed ? "text-destructive" : "text-foreground",
                )}
              >
                {context.captchaFailed
                  ? "Verification needs a quick retry"
                  : context.captchaReady
                    ? "Verification complete"
                    : "Verifying you are human"}
              </p>
              <p className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
                {context.captchaFailed
                  ? "Tap retry, then continue — this check protects our AI from abuse."
                  : context.captchaReady
                    ? "You can continue — this check protects our AI from abuse."
                    : "Please wait a moment while we run a quick security check."}
              </p>
              {context.captchaFailed && (
                <button
                  type="button"
                  className="pt-1 text-xs font-medium text-primary underline underline-offset-2"
                  onClick={context.retryCaptcha}
                >
                  Retry verification
                </button>
              )}
            </div>
            {!compact && !context.captchaFailed && (
              <Shield className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60" />
            )}
          </div>
        </div>
      )}
      {/* Keep Turnstile mounted for the provider lifetime so tokens can refresh. */}
      <IssueCheckerTurnstileHost />
    </div>
  )
}

export function useIssueCheckerCaptcha(): Pick<
  IssueCheckerCaptchaContextValue,
  | "captchaRequired"
  | "captchaReady"
  | "captchaFailed"
  | "getAbuseFields"
  | "awaitAbuseFields"
  | "markAbuseFieldsUsed"
  | "withAbuseFields"
  | "retryCaptcha"
> {
  const context = useContext(IssueCheckerCaptchaContext)
  if (context) {
    return context
  }

  return {
    captchaRequired: false,
    captchaReady: true,
    captchaFailed: false,
    getAbuseFields: deviceFingerprintField,
    awaitAbuseFields: async () => deviceFingerprintField(),
    markAbuseFieldsUsed: () => undefined,
    withAbuseFields: async (request) => request(deviceFingerprintField()),
    retryCaptcha: () => undefined,
  }
}
