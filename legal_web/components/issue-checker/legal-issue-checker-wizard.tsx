"use client"
import { useTranslations } from "next-intl"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { CinematicNavbar } from "@/components/marketing/cinematic-navbar"
import { CinematicFooter } from "@/components/marketing/cinematic-footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { WizardProgress } from "@/components/issue-checker/wizard-progress"
import { IntakeAppShell } from "@/components/issue-checker/intake-app-shell"
import { IssueIntakeMicroFlow } from "@/components/issue-checker/issue-intake-micro-flow"
import type { IntakeMicroFlowResult } from "@/components/issue-checker/issue-intake-micro-flow"
import { DetailsStep, isSelfReferentialClientName } from "@/components/issue-checker/details-step"
import { DocumentsStep } from "@/components/issue-checker/documents-step"
import { TeaserPreview } from "@/components/issue-checker/teaser-preview"
import { FullPreview } from "@/components/issue-checker/full-preview"
import {
  ISSUE_CHECKER_STEP_COUNT,
  clearIssueCheckerSession,
  createEmptyWizardData,
  loadIssueCheckerSession,
  saveIssueCheckerSession,
  type IssueCheckerMode,
} from "@/components/issue-checker/constants"
import { CreditBalanceWidget } from "@/components/consumer/credit-balance-widget"
import {
  classifyIssueChecker,
  createCase,
  getPlanQuestions,
  previewIssueChecker,
  teaserIssueChecker,
  type PlanQuestion,
} from "@/lib/api/consumers"
import { uploadConsumerFile } from "@/lib/api/documents"
import { useAuth } from "@/lib/contexts/auth-context"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { ApiClientError } from "@/lib/api/client"
import {
  isCloudflareChallengeError,
  isRetryableIntakeSaveError,
} from "@/lib/api/cloudflare-challenge"
import {
  clearPendingFirmIntake,
  findExistingFirmIntakeLead,
  loadPendingFirmIntake,
  savePendingFirmIntake,
  withIntakeSaveRetry,
} from "@/lib/issue-checker/firm-intake-save"
import type {
  CountryCode,
  IssueCheckerPreviewResponse,
  IssueCheckerTeaserResponse,
} from "@/lib/api/types"
import { inferCountryFromText } from "@/lib/geo/detect-country"
import { getStateOptions, matchRegionToStateOption } from "@/lib/geo/country-states"
import { trackIssueCheckerSubmit } from "@/lib/analytics/posthog"
import { IntakeAnalysisProgress } from "@/components/issue-checker/intake-analysis-progress"
import { useIssueCheckerLabels } from "@/lib/i18n/use-issue-checker-labels"
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Plus, Shield } from "lucide-react"
import { AiModelPicker } from "@/components/credits/AiModelPicker"
import { useInsufficientCreditsGate } from "@/lib/credits/use-insufficient-credits-gate"
import { isInsufficientCreditsError } from "@/lib/utils/credit-errors"
import { FEATURE_CREDIT_COSTS } from "@/lib/credits/feature-credit-costs"
import { useTenantOptional as useTenant } from "@/lib/contexts/tenant-context"
import {
  IssueCheckerCaptchaProvider,
  IssueCheckerTurnstileWidget,
  useIssueCheckerCaptcha,
} from "@/lib/captcha/issue-checker-captcha"
import { getDeviceId } from "@/lib/device/device-id"

function formatPreviewError(
  err: unknown,
  t: (key: string) => string,
  options?: { firmIntake?: boolean },
): string {
  if (err instanceof ApiClientError) {
    if (err.statusCode === 504 || err.statusCode === 502) {
      return options?.firmIntake
        ? t("errorPreviewTimedOutFirmIntake")
        : t("errorPreviewTimedOut")
    }
    if (
      err.statusCode === 500 &&
      (err.message === "Internal Server Error" || err.message === "Internal server error")
    ) {
      return options?.firmIntake
        ? t("errorBackendInterruptedFirmIntake")
        : t("errorBackendInterrupted")
    }
    if (isCloudflareChallengeError(err) || (err.statusCode === 403 && isRetryableIntakeSaveError(err))) {
      return options?.firmIntake
        ? t("errorChallengeDroppedFirmIntake")
        : t("errorCouldNotReachServer")
    }
    // "Request failed" is the HTTP/2 fallback (empty statusText) for gateway
    // timeouts, Cloudflare errors, or backend crashes with no JSON body.
    if (err.message === "Request failed") {
      return options?.firmIntake ? t("errorChallengeDroppedFirmIntake") : t("errorPreviewFailed")
    }
    return err.message
  }
  if (err instanceof Error) {
    if (
      isCloudflareChallengeError(err) ||
      /failed to fetch|network|CORS|hang up|ECONNRESET|ECONNREFUSED/i.test(err.message)
    ) {
      return options?.firmIntake
        ? isCloudflareChallengeError(err)
          ? t("errorChallengeDroppedFirmIntake")
          : t("errorCouldNotReachServerFirmIntake")
        : t("errorCouldNotReachServer")
    }
    return err.message
  }
  return t("errorPreviewFailed")
}

type WizardLayout = "marketing" | "app"

interface LegalIssueCheckerWizardProps {
  layout?: WizardLayout
  defaultMode?: IssueCheckerMode
  /** When set, hides mode toggle and locks the wizard to this mode. */
  lockedMode?: IssueCheckerMode
}

export function LegalIssueCheckerWizard(props: LegalIssueCheckerWizardProps) {
  return (
    <IssueCheckerCaptchaProvider>
      <LegalIssueCheckerWizardInner {...props} />
    </IssueCheckerCaptchaProvider>
  )
}

function LegalIssueCheckerWizardInner({
  layout = "marketing",
  defaultMode,
  lockedMode,
}: LegalIssueCheckerWizardProps) {
  const t = useTranslations("issueChecker")
  const tAuth = useTranslations("auth")
  const tDashboard = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const { stepCount, getIssueTypeLabel, getUrgencyShort } = useIssueCheckerLabels()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, user, isLoading: authLoading } = useAuth()
  const { countryCode: contextCountry, detectedRegion, isLoading: countryLoading, setCountryCode: persistCountry } = useDetectedCountry()
  const { captchaRequired, captchaReady, withAbuseFields } =
    useIssueCheckerCaptcha()

  const basePath = layout === "app" ? "/app/intake" : "/legal-issue-checker"

  const initialMode: IssueCheckerMode = lockedMode ?? (() => {
    if (defaultMode) return defaultMode
    if (searchParams.get("mode") === "firm-intake") return "FIRM_INTAKE"
    if (searchParams.get("mode") === "personal") return "SELF"
    return "SELF"
  })()

  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<IssueCheckerMode>(initialMode)
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classificationParties, setClassificationParties] = useState<string | undefined>()
  const [suggestedClientName, setSuggestedClientName] = useState<string | undefined>()
  const [suggestedOutcomes, setSuggestedOutcomes] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isCreditError, setIsCreditError] = useState(false)
  const [preview, setPreview] = useState<IssueCheckerPreviewResponse | null>(null)
  const [teaser, setTeaser] = useState<IssueCheckerTeaserResponse | null>(null)
  const [anonymousSessionId, setAnonymousSessionId] = useState<string | undefined>()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [data, setData] = useState(() => createEmptyWizardData("" as CountryCode))
  const [submittedLead, setSubmittedLead] = useState<{ leadId?: string; title: string } | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [refinementQuestions, setRefinementQuestions] = useState<PlanQuestion[]>([])
  const [refinementQuestionsLoading, setRefinementQuestionsLoading] = useState(false)
  const upgradeAttempted = useRef(false)
  const previewInFlight = useRef(false)
  const countryInitialized = useRef(false)
  const jurisdictionInferred = useRef(false)

  const isLawyer = user?.userType === "LAWYER"
  const effectiveMode = lockedMode ?? mode
  const { activeTenantId } = useTenant()

  const subscribeHref =
    layout === "app" || isLawyer ? "/app/settings/plan-usage" : "/consumer/subscription"

  const { gate: creditsGate, handleApiError } = useInsufficientCreditsGate({
    feature: "intake",
    tenantId: activeTenantId ?? undefined,
    countryCode: data.countryCode ?? "IN",
    subscribeHref,
    requiredCredits: FEATURE_CREDIT_COSTS.INTAKE_PREVIEW,
  })

  const resolveWizardError = useCallback(
    (
      err: unknown,
      fallbackKey: string,
      options?: { firmIntake?: boolean },
    ): string | null => {
      if (isInsufficientCreditsError(err)) {
        setIsCreditError(true)
        handleApiError(err)
        return null
      }
      setIsCreditError(false)
      if (options?.firmIntake !== undefined) {
        return formatPreviewError(err, t, { firmIntake: options.firmIntake })
      }
      return err instanceof ApiClientError ? err.message : t(fallbackKey)
    },
    [handleApiError, t],
  )

  useEffect(() => {
    if (layout === "marketing" && !authLoading && isAuthenticated && isLawyer && searchParams.get("mode") !== "personal") {
      const query = new URLSearchParams()
      if (searchParams.get("upgrade") === "1") query.set("upgrade", "1")
      if (searchParams.get("attach") === "1") query.set("attach", "1")
      const suffix = query.toString() ? `?${query.toString()}` : ""
      router.replace(`/app/intake${suffix}`)
    }
  }, [layout, authLoading, isAuthenticated, isLawyer, searchParams, router])

  useEffect(() => {
    const stored = loadIssueCheckerSession()
    if (stored) {
      setStep(stored.step)
      setMode(lockedMode ?? stored.mode)
      setData(stored.data)
      setAnonymousSessionId(stored.anonymousSessionId)
      if (stored.pendingAttach && isAuthenticated) {
        setStep(2)
      }
    } else if (lockedMode) {
      setMode(lockedMode)
    } else if (searchParams.get("mode") === "firm-intake") {
      setMode("FIRM_INTAKE")
    } else if (isAuthenticated && isLawyer && searchParams.get("mode") !== "personal") {
      setMode("FIRM_INTAKE")
    }
    setHydrated(true)
  }, [isAuthenticated, isLawyer, lockedMode, searchParams])

  // Landing handoff: session written by LandingIssueBoard — apply data and skip redundant classify when possible.
  useEffect(() => {
    if (!hydrated) return
    const stored = loadIssueCheckerSession()
    if (!stored?.landingHandoff) return

    saveIssueCheckerSession({ ...stored, landingHandoff: false })

    setMode(stored.mode)
    setData(stored.data)
    if (stored.data.parties) {
      setClassificationParties(stored.data.parties)
    }

    if (stored.data.issueType) {
      setStep(stored.step >= 1 ? stored.step : 1)
      return
    }

    void (async () => {
      setClassifying(true)
      setError(null)
      try {
        // Classify is rate-limited only — do not spend the Turnstile token here.
        const result = await classifyIssueChecker({
          countryCode: stored.data.countryCode,
          facts: stored.data.facts,
          mode: stored.mode,
          deviceFingerprint: getDeviceId() ?? undefined,
        })
        setData((prev) => ({
          ...prev,
          issueType: result.issueType,
          title: result.suggestedTitle,
          urgencyLevel: result.urgencyLevel,
        }))
        if (result.parties) {
          setClassificationParties(result.parties)
        }
        if (result.suggestedClientName) {
          setSuggestedClientName(result.suggestedClientName)
        }
        if (result.suggestedOutcomes?.length) {
          setSuggestedOutcomes(result.suggestedOutcomes)
        }
        setStep(1)
      } catch (err) {
        setError(resolveWizardError(err, "errorClassificationFailed"))
      } finally {
        setClassifying(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    if (!hydrated || countryInitialized.current) return
    if (countryLoading) return
    if (!contextCountry) return

    countryInitialized.current = true

    const stored = loadIssueCheckerSession()
    if (stored?.data.jurisdiction) {
      jurisdictionInferred.current = true
    }

    setData((prev) => {
      let jurisdiction = prev.jurisdiction
      if (!jurisdiction && detectedRegion) {
        const match = matchRegionToStateOption(contextCountry, detectedRegion)
        if (match) {
          jurisdiction = match
          jurisdictionInferred.current = true
        }
      }

      return {
        ...prev,
        countryCode: contextCountry,
        jurisdiction,
      }
    })
  }, [hydrated, countryLoading, contextCountry, detectedRegion])

  useEffect(() => {
    if (!data.facts.trim() || jurisdictionInferred.current) return
    const inferred = inferCountryFromText(data.facts)
    if (!inferred) return

    jurisdictionInferred.current = true
    setData((prev) => ({
      ...prev,
      countryCode: inferred,
      jurisdiction: prev.jurisdiction || "",
    }))
  }, [data.facts])

  useEffect(() => {
    if (!hydrated) return
    saveIssueCheckerSession({
      step,
      mode: effectiveMode,
      data,
      anonymousSessionId,
      pendingAttach: searchParams.get("attach") === "1",
      teaserGenerated: !!teaser,
    })
  }, [step, effectiveMode, data, anonymousSessionId, hydrated, teaser, searchParams])

  const update = useCallback((partial: Partial<typeof data>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleCountryChange = useCallback(
    (code: CountryCode) => {
      jurisdictionInferred.current = true
      update({
        countryCode: code,
        jurisdiction: code === "US" ? data.jurisdiction : "",
      })
      persistCountry(code)
    },
    [data.jurisdiction, persistCountry, update],
  )

  const buildPayload = useCallback(() => {
    const combinedFacts = [
      data.facts,
      data.parties ? `Parties involved: ${data.parties}` : "",
      `Urgency: ${data.urgencyLevel}`,
    ]
      .filter(Boolean)
      .join("\n\n")

    return {
      countryCode: data.countryCode,
      jurisdiction: data.jurisdiction || undefined,
      issueType: data.issueType,
      title: data.title,
      facts: combinedFacts,
      desiredOutcome: data.desiredOutcome || undefined,
      parties: data.parties || undefined,
      urgencyLevel: data.urgencyLevel,
      mode: effectiveMode,
      clientName: effectiveMode === "FIRM_INTAKE" ? data.clientName : undefined,
      clientReference: effectiveMode === "FIRM_INTAKE" ? data.clientReference : undefined,
      internalNotes: effectiveMode === "FIRM_INTAKE" ? data.internalNotes : undefined,
      planningAnswers: data.planningAnswers ?? undefined,
      suggestedOutcomes: suggestedOutcomes.length ? suggestedOutcomes : undefined,
    }
  }, [data, effectiveMode, suggestedOutcomes])

  const runClassification = async () => {
    setClassifying(true)
    setError(null)
    try {
      const result = await classifyIssueChecker({
        countryCode: data.countryCode,
        facts: data.facts,
        mode: effectiveMode,
        deviceFingerprint: getDeviceId() ?? undefined,
      })
      update({
        issueType: result.issueType,
        title: result.suggestedTitle,
        urgencyLevel: result.urgencyLevel,
      })
      if (result.parties) {
        setClassificationParties(result.parties)
      }
      if (result.suggestedClientName) {
        setSuggestedClientName(result.suggestedClientName)
      }
      if (result.suggestedOutcomes?.length) {
        setSuggestedOutcomes(result.suggestedOutcomes)
      }
    } catch (err) {
      setError(resolveWizardError(err, "errorClassificationContinue"))
    } finally {
      setClassifying(false)
    }
  }

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return data.facts.length >= 20
      case 1:
        return (
          !!data.urgencyLevel &&
          (effectiveMode !== "FIRM_INTAKE" ||
            (data.clientName.trim().length >= 2 && !isSelfReferentialClientName(data.clientName)))
        )
      case 2:
        return true
      case 3:
        return !!data.issueType && !!data.title
      default:
        return false
    }
  }

  const goNext = async () => {
    if (step === 0) {
      await runClassification()
    }
    if (canProceed()) {
      setStep((s) => Math.min(s + 1, stepCount - 1))
    }
  }

  const handleStartOver = useCallback(() => {
    clearIssueCheckerSession()
    clearPendingFirmIntake()
    setPreview(null)
    setTeaser(null)
    setSubmittedLead(null)
    setAnonymousSessionId(undefined)
    setSelectedFiles([])
    setStep(0)
    setError(null)
    countryInitialized.current = false
    jurisdictionInferred.current = false

    if (contextCountry) {
      let jurisdiction = ""
      if (detectedRegion) {
        const match = matchRegionToStateOption(contextCountry, detectedRegion)
        if (match) {
          jurisdiction = match
          jurisdictionInferred.current = true
        }
      }
      setData({
        ...createEmptyWizardData(contextCountry),
        jurisdiction,
      })
      countryInitialized.current = true
    } else {
      setData(createEmptyWizardData("" as CountryCode))
    }
  }, [contextCountry, detectedRegion])

  const runFullPreview = useCallback(async (sessionId?: string, extraPlanningAnswers?: Record<string, string | string[]>) => {
    if (previewInFlight.current) return
    previewInFlight.current = true
    setLoading(true)
    setError(null)
    let consumerCaseId: string | undefined
    try {
      const payload = {
        ...buildPayload(),
        ...(extraPlanningAnswers !== undefined ? { planningAnswers: extraPlanningAnswers } : {}),
      }

      const pendingIntake = loadPendingFirmIntake()
      if (effectiveMode === "FIRM_INTAKE") {
        if (pendingIntake?.leadId) {
          const existingLeadId = await findExistingFirmIntakeLead({
            leadId: pendingIntake.leadId,
          })
          if (existingLeadId) {
            clearIssueCheckerSession()
            clearPendingFirmIntake()
            router.push(`/app/leads/${existingLeadId}`)
            return
          }
        }
        consumerCaseId = pendingIntake?.consumerCaseId
      }

      if (selectedFiles.length > 0 && !consumerCaseId) {
        const draftCase = await createCase({
          countryCode: payload.countryCode,
          jurisdiction: payload.jurisdiction,
          issueType: payload.issueType,
          title: payload.title,
          facts: payload.facts,
          desiredOutcome: payload.desiredOutcome,
          urgencyLevel: payload.urgencyLevel,
        })
        consumerCaseId = draftCase.id
        if (effectiveMode === "FIRM_INTAKE") {
          savePendingFirmIntake({ consumerCaseId, title: data.title })
        }
        for (const file of selectedFiles) {
          await uploadConsumerFile(
            consumerCaseId,
            file,
            effectiveMode === "FIRM_INTAKE" ? "FIRM_INTAKE" : "CONSUMER_UPLOAD",
          )
        }
      }

      const previewFn = () =>
        previewIssueChecker({
          ...payload,
          consumerCaseId,
          anonymousSessionId: sessionId ?? anonymousSessionId,
        })
      const result =
        effectiveMode === "FIRM_INTAKE"
          ? await withIntakeSaveRetry(previewFn, {
              recover: async () => {
                const existingLeadId = await findExistingFirmIntakeLead({ title: data.title })
                if (!existingLeadId) return undefined
                return { leadId: existingLeadId } as Awaited<ReturnType<typeof previewIssueChecker>>
              },
            })
          : await previewFn()

      trackIssueCheckerSubmit({
        mode: effectiveMode,
        countryCode: data.countryCode,
        issueType: data.issueType,
        authenticated: true,
        isFullPreview: true,
      })

      if (effectiveMode === "FIRM_INTAKE") {
        const capturedLeadId = result.leadId
        // Clear the wizard session so returning to intake starts fresh.
        clearIssueCheckerSession()
        if (capturedLeadId) {
          clearPendingFirmIntake()
          // Go straight to the created lead instead of an interstitial screen.
          router.push(`/app/leads/${capturedLeadId}`)
          return
        }
        // Fallback when no lead id is returned: keep the confirmation screen.
        handleStartOver()
        setSubmittedLead({ leadId: undefined, title: data.title })
        return
      }

      setPreview(result)
      setTeaser(null)
    } catch (err) {
      if (effectiveMode === "FIRM_INTAKE") {
        const recoveredLeadId = await findExistingFirmIntakeLead({
          leadId: loadPendingFirmIntake()?.leadId,
          title: data.title,
        })
        if (recoveredLeadId) {
          clearIssueCheckerSession()
          clearPendingFirmIntake()
          router.push(`/app/leads/${recoveredLeadId}`)
          return
        }
        if (consumerCaseId) {
          savePendingFirmIntake({ consumerCaseId, title: data.title })
        }
      }
      setError(resolveWizardError(err, "errorPreviewFailed", { firmIntake: effectiveMode === "FIRM_INTAKE" }))
    } finally {
      previewInFlight.current = false
      setLoading(false)
    }
  }, [anonymousSessionId, buildPayload, data.countryCode, data.issueType, data.title, effectiveMode, handleStartOver, router, selectedFiles])

  /** Generate teaser directly from micro-flow result for unauthenticated users — bypasses steps 1-3.
   *  Flow: classify → teaser (shown immediately) → plan questions (background, non-blocking). */
  const generateDirectFromResult = useCallback(async (result: IntakeMicroFlowResult) => {
    if (loading || previewInFlight.current) return
    setLoading(true)
    setError(null)
    const newMode = lockedMode ?? result.mode

    try {
      // Step 1: Classify silently.
      // Do NOT use withAbuseFields here — it would consume the single Turnstile
      // token and reset it, leaving the teaser call (step 2) with no token.
      // Classify is non-fatal; if it fails (e.g. CAPTCHA required in production),
      // we fall through with no classification data.
      let classified: Awaited<ReturnType<typeof classifyIssueChecker>> | undefined
      try {
        classified = await classifyIssueChecker({
          countryCode: result.countryCode,
          facts: result.facts,
          mode: newMode,
          deviceFingerprint: getDeviceId() ?? undefined,
        })
      } catch {
        // Non-fatal: fall through with no classification data
      }

      const combinedFacts = [
        result.facts,
        classified?.parties ? `Parties involved: ${classified.parties}` : "",
        classified?.urgencyLevel ? `Urgency: ${classified.urgencyLevel}` : "",
      ].filter(Boolean).join("\n\n")

      const payload = {
        countryCode: result.countryCode,
        jurisdiction: result.jurisdiction || undefined,
        issueType: classified?.issueType ?? "",
        title: classified?.suggestedTitle ?? "",
        facts: combinedFacts,
        desiredOutcome: undefined as string | undefined,
        parties: classified?.parties || undefined,
        urgencyLevel: classified?.urgencyLevel ?? ("MEDIUM" as const),
        mode: newMode,
      }

      // Step 2: Generate teaser
      const teaserResult = await withAbuseFields((abuse) =>
        teaserIssueChecker({ ...payload, ...abuse }),
      )
      setTeaser(teaserResult)
      setAnonymousSessionId(teaserResult.anonymousSessionId)
      setPreview(null)

      // Persist classified data for the refine flow
      update({
        facts: result.facts,
        countryCode: result.countryCode,
        jurisdiction: result.jurisdiction,
        ...(classified
          ? {
              issueType: classified.issueType,
              title: classified.suggestedTitle,
              urgencyLevel: classified.urgencyLevel,
              parties: classified.parties ?? "",
            }
          : {}),
      })
      if (classified?.parties) setClassificationParties(classified.parties)
      if (classified?.suggestedOutcomes?.length) setSuggestedOutcomes(classified.suggestedOutcomes)
      if (classified?.suggestedClientName) setSuggestedClientName(classified.suggestedClientName)

      trackIssueCheckerSubmit({
        mode: newMode,
        countryCode: result.countryCode,
        issueType: classified?.issueType ?? "",
        authenticated: false,
        isFullPreview: false,
      })
    } catch (err) {
      setError(resolveWizardError(err, "errorPreviewFailed", { firmIntake: newMode === "FIRM_INTAKE" }))
      return
    } finally {
      setLoading(false)
    }

    // Step 3: Fetch refinement questions in background — teaser is already visible.
    // The teaser call consumed and reset the Turnstile token, so we must NOT use
    // withAbuseFields here (it would throw "CAPTCHA required" before re-solving).
    // Use device fingerprint only; rate limiting still applies.
    setRefinementQuestionsLoading(true)
    try {
      const questionsResult = await getPlanQuestions({
        countryCode: result.countryCode,
        facts: result.facts,
        mode: newMode,
        deviceFingerprint: getDeviceId() ?? undefined,
      })
      setRefinementQuestions(questionsResult.questions)
    } catch {
      setRefinementQuestions([])
    } finally {
      setRefinementQuestionsLoading(false)
    }
  }, [loading, lockedMode, resolveWizardError, update, withAbuseFields])

  /** Merge planning answers and run the full preview (refine flow). */
  const handleRefine = useCallback(async (planningAnswers: Record<string, string | string[]>) => {
    await runFullPreview(anonymousSessionId, planningAnswers)
  }, [anonymousSessionId, runFullPreview])

  useEffect(() => {
    if (!hydrated || !isAuthenticated || upgradeAttempted.current) return
    // Allow upgrade from normal anonymous sessions (anonymousSessionId present) OR
    // from rate-limited sessions where we saved facts but never got a session ID.
    const hasContext = !!anonymousSessionId || !!data.facts
    const shouldUpgrade =
      searchParams.get("upgrade") === "1" &&
      hasContext &&
      !preview &&
      !loading
    if (shouldUpgrade) {
      upgradeAttempted.current = true
      void runFullPreview(anonymousSessionId)
    }
  }, [
    hydrated,
    isAuthenticated,
    anonymousSessionId,
    data.facts,
    preview,
    loading,
    searchParams,
    runFullPreview,
  ])

  const handleGenerate = async () => {
    if (loading || previewInFlight.current) return
    setError(null)
    try {
      if (isAuthenticated) {
        await runFullPreview()
        return
      }

      setLoading(true)
      const result = await withAbuseFields((abuse) =>
        teaserIssueChecker({ ...buildPayload(), ...abuse }),
      )
      setTeaser(result)
      setAnonymousSessionId(result.anonymousSessionId)
      setPreview(null)
      trackIssueCheckerSubmit({
        mode: effectiveMode,
        countryCode: data.countryCode,
        issueType: data.issueType,
        authenticated: false,
        isFullPreview: false,
      })
    } catch (err) {
      setError(resolveWizardError(err, "errorPreviewFailed", { firmIntake: effectiveMode === "FIRM_INTAKE" }))
    } finally {
      setLoading(false)
    }
  }

  const authRedirect = (path: "sign-in" | "sign-up", extra?: string) => {
    const params = new URLSearchParams()
    params.set("redirect", `${basePath}?upgrade=1${extra ?? ""}`)
    router.push(`/auth/${path}?${params.toString()}`)
  }

  const handleRequireSignUp = () => {
    saveIssueCheckerSession({
      step: 2,
      mode: effectiveMode,
      data,
      anonymousSessionId,
      pendingAttach: true,
    })
    authRedirect("sign-up", "&attach=1")
  }

  const handleMicroFlowComplete = (result: IntakeMicroFlowResult) => {
    jurisdictionInferred.current = true
    setMode(result.mode)
    update({
      facts: result.facts,
      countryCode: result.countryCode,
      jurisdiction: result.jurisdiction,
      planningAnswers: result.planningAnswers,
      ...(result.issueType
        ? {
            issueType: result.issueType,
            title: result.title ?? "",
            urgencyLevel: result.urgencyLevel ?? "MEDIUM",
            parties: result.parties ?? "",
          }
        : {}),
    })

    if (result.parties) setClassificationParties(result.parties)
    if (result.suggestedClientName) setSuggestedClientName(result.suggestedClientName)

    // Unauthenticated users skip steps 1-3 and go straight to teaser generation
    if (!isAuthenticated) {
      void generateDirectFromResult(result)
      return
    }

    // Authenticated users: proceed to details step
    if (result.issueType) {
      setStep(1)
      return
    }

    void (async () => {
      setClassifying(true)
      setError(null)
      try {
        const classified = await classifyIssueChecker({
          countryCode: result.countryCode,
          facts: result.facts,
          mode: result.mode,
          deviceFingerprint: getDeviceId() ?? undefined,
        })
        update({
          issueType: classified.issueType,
          title: classified.suggestedTitle,
          urgencyLevel: classified.urgencyLevel,
        })
        if (classified.parties) setClassificationParties(classified.parties)
        if (classified.suggestedClientName) setSuggestedClientName(classified.suggestedClientName)
        if (classified.suggestedOutcomes?.length) setSuggestedOutcomes(classified.suggestedOutcomes)
        setStep(1)
      } catch (err) {
        setError(resolveWizardError(err, "errorClassificationContinue"))
      } finally {
        setClassifying(false)
      }
    })()
  }


  const headerBadge = useMemo(() => {
    if (isLawyer && effectiveMode === "FIRM_INTAKE") {
      return <Badge variant="outline">{t("firm_intake")}</Badge>
    }
    if (isAuthenticated && !isLawyer) {
      return <CreditBalanceWidget compact />
    }
    return null
  }, [isAuthenticated, isLawyer, effectiveMode])

  const renderContent = (children: React.ReactNode, maxWidth: "2xl" | "3xl" = "2xl") => {
    if (layout === "app") {
      return <div className="w-full">{children}</div>
    }

    const inner = (
      <div
        className={
          maxWidth === "3xl"
            ? "mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-3xl w-full"
            : "mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 max-w-2xl w-full"
        }
      >
        {children}
      </div>
    )

    return (
      <div className="min-h-screen bg-white text-slate-950">
        <CinematicNavbar />
        {inner}
        <CinematicFooter />
      </div>
    )
  }

  const isAppLayout = layout === "app"

  const checklistItems = useMemo(
    () => [
      { label: t("checklistIssueClassified"), done: Boolean(data.issueType) },
      { label: t("checklistUrgencyReviewed"), done: Boolean(data.urgencyLevel) },
      { label: t("checklistPeopleCaptured"), done: Boolean(data.parties) },
      {
        label: effectiveMode === "FIRM_INTAKE" ? t("checklistClientLinked") : t("checklistOutcomeCaptured"),
        done: effectiveMode === "FIRM_INTAKE" ? Boolean(data.clientId || data.clientName) : Boolean(data.desiredOutcome),
      },
    ],
    [data, effectiveMode, t],
  )

  const renderChecklist = (className?: string) => (
    <div className={cn("grid gap-2", className)}>
      {checklistItems.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-colors",
            item.done ? "bg-green-500/5 border-green-500/20" : "bg-card",
          )}
        >
          <CheckCircle className={cn("h-4 w-4 shrink-0", item.done ? "text-green-600 dark:text-green-400" : "text-muted-foreground")} />
          <span className={item.done ? "text-foreground font-medium" : "text-muted-foreground"}>{item.label}</span>
        </div>
      ))}
    </div>
  )

  const generateNeedsCaptcha = captchaRequired && !captchaReady && !isAuthenticated

  const renderStepNav = () => (
    <div className="flex justify-between gap-3 w-full">
      <Button
        variant="outline"
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={loading || step === 0}
        className="shrink-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {tCommon("back")}
      </Button>
      <div className="flex items-center gap-2">
        {step < stepCount - 1 ? (
          <Button onClick={() => void goNext()} disabled={!canProceed() || classifying}>
            {classifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("analyzingSituation")}
              </>
            ) : (
              <>
                {tCommon("continue")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => void handleGenerate()}
            disabled={loading || !canProceed() || generateNeedsCaptcha}
            className="min-w-[10rem]"
          >
            {loading ? (
              <span className="text-sm">{t("working")}</span>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("getMyPreview")}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )

  if (layout === "marketing" && authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{tAuth("loading")}</p>
      </div>
    )
  }

  if (submittedLead) {
    const successContent = (
      <div className="flex flex-col items-center gap-6 py-8 text-center max-w-md mx-auto">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t("intake_created")}</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            <span className="font-medium text-foreground">{submittedLead.title || t("theIntake")}</span>{" "}
            {t("intakeSavedToPipeline")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          {submittedLead.leadId && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/app/leads/${submittedLead.leadId}`)}
            >
              {t("viewLead")}
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => setSubmittedLead(null)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("newIntake")}
          </Button>
        </div>
        <Button
          variant="link"
          size="sm"
          className="text-muted-foreground"
          onClick={() => router.push("/app/leads")}
        >
          {t("goToLeadsPipeline")}
        </Button>
      </div>
    )
    return renderContent(
      isAppLayout ? (
        <IntakeAppShell>{successContent}</IntakeAppShell>
      ) : (
        successContent
      ),
    )
  }

  if (preview) {
    return renderContent(
      <FullPreview
        preview={preview}
        mode={effectiveMode}
        onStartOver={handleStartOver}
      />,
      "3xl",
    )
  }

  if (teaser) {
    return renderContent(
      <TeaserPreview
        teaser={teaser}
        refinementQuestions={refinementQuestions}
        refinementQuestionsLoading={refinementQuestionsLoading}
        isRefining={loading}
        onRefine={(answers) => void handleRefine(answers)}
      />,
      "3xl",
    )
  }

  const creditNotice = !isAuthenticated ? (
    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
      {t("previewFreeExcerpt")}
    </p>
  ) : null

  const miniSummary =
    data.title || data.issueType ? (
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs shadow-sm">
        {data.title && <p className="font-semibold text-sm leading-snug line-clamp-2">{data.title}</p>}
        <div className="flex flex-wrap gap-1.5">
          {data.issueType && (
            <Badge variant="outline" className="text-[10px] px-2 py-0">
              {getIssueTypeLabel(data.issueType)}
            </Badge>
          )}
          {data.countryCode && (
            <Badge variant="outline" className="text-[10px] px-2 py-0">
              {data.countryCode}
            </Badge>
          )}
        </div>
        {effectiveMode === "FIRM_INTAKE" && data.clientName && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{t("client")}</span> {data.clientName}
          </p>
        )}
      </div>
    ) : null

  const wizardCard = (
    <Card className={cn(isAppLayout ? "border shadow-sm" : "border-2")}>
      <CardContent className="pt-6 space-y-6">
        {captchaRequired && (
          <IssueCheckerTurnstileWidget compact={step > 0} />
        )}

        {step === 0 && (
          <div className="space-y-4 animate-fade-in">
            {classifying || (loading && !isAuthenticated) ? (
              <IntakeAnalysisProgress active={true} hasDocuments={false} variant="preview" className="w-full" />
            ) : (
              <IssueIntakeMicroFlow
                initialData={data}
                initialMode={effectiveMode}
                onComplete={handleMicroFlowComplete}
                showFirmIntake={!lockedMode && (isLawyer || !isAuthenticated)}
                compact
                layoutWide={isAppLayout}
              />
            )}
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-in">
            <DetailsStep
              mode={effectiveMode}
              data={data}
              onChange={update}
              classificationParties={classificationParties}
              suggestedClientName={suggestedClientName}
              suggestedOutcomes={suggestedOutcomes}
              layoutWide={isAppLayout}
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <DocumentsStep
              isAuthenticated={isAuthenticated}
              selectedFiles={selectedFiles}
              onFilesSelected={setSelectedFiles}
              onRequireSignUp={handleRequireSignUp}
              layoutWide={isAppLayout}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">{t("review_amp_generate")}</span>
            </div>

            <div className="rounded-xl border bg-gradient-to-br from-muted/40 to-muted/10 p-4 lg:p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.issueType && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                    {getIssueTypeLabel(data.issueType)}
                  </span>
                )}
                {data.urgencyLevel && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border",
                      data.urgencyLevel === "URGENT" && "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
                      data.urgencyLevel === "HIGH" && "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400",
                      data.urgencyLevel === "MEDIUM" && "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400",
                      data.urgencyLevel === "LOW" && "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400",
                    )}
                  >
                    {getUrgencyShort(data.urgencyLevel)} {t("urgencySuffix")}
                  </span>
                )}
                {data.countryCode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground border">
                    {data.countryCode}
                  </span>
                )}
              </div>

              {data.title && (
                <p className="text-sm lg:text-base font-semibold leading-snug">{data.title}</p>
              )}

              <div className="text-xs lg:text-sm text-muted-foreground space-y-1">
                {effectiveMode === "FIRM_INTAKE" && data.clientName && (
                  <p>
                    <span className="font-medium text-foreground">{t("client")}</span> {data.clientName}
                  </p>
                )}
                {effectiveMode === "FIRM_INTAKE" && data.clientReference && (
                  <p>
                    <span className="font-medium text-foreground">{t("file_reference")}</span> {data.clientReference}
                  </p>
                )}
                {data.parties && (
                  <p>
                    <span className="font-medium text-foreground">{t("parties")}</span>{" "}
                    <span className="lg:hidden">
                      {data.parties.length > 80 ? `${data.parties.slice(0, 80)}…` : data.parties}
                    </span>
                    <span className="hidden lg:inline">{data.parties}</span>
                  </p>
                )}
                {data.desiredOutcome && (
                  <p>
                    <span className="font-medium text-foreground">{t("desired_outcome")}</span>{" "}
                    <span className="lg:hidden">
                      {data.desiredOutcome.length > 120 ? `${data.desiredOutcome.slice(0, 120)}…` : data.desiredOutcome}
                    </span>
                    <span className="hidden lg:inline">{data.desiredOutcome}</span>
                  </p>
                )}
                {selectedFiles.length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">{t("documents_2")}</span>{" "}
                    {t("filesAttached", { count: selectedFiles.length })}
                  </p>
                )}
              </div>
            </div>

            {!isAppLayout && renderChecklist("sm:grid-cols-2")}
            {isAppLayout && <div className="lg:hidden">{renderChecklist()}</div>}
            {!isAppLayout && creditNotice}
            {isAppLayout && <div className="lg:hidden">{creditNotice}</div>}

            {loading && isAuthenticated && (
              <IntakeAnalysisProgress
                active={loading}
                hasDocuments={selectedFiles.length > 0}
                variant="preview"
                className="w-full"
              />
            )}
          </div>
        )}

        {error && !isCreditError && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md space-y-2">
            <p>{error}</p>
            {step === 3 && isAuthenticated && (
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={() => void handleGenerate()}
              >
                {tCommon("retry")}
              </Button>
            )}
            {error.toLowerCase().includes("account") && !isAuthenticated && (
              <Button size="sm" variant="outline" onClick={() => authRedirect("sign-up")}>
                {t("create_account_to_save_report")}
              </Button>
            )}
          </div>
        )}

        {step > 0 && (
          <div className={cn("pt-4 border-t", isAppLayout && "hidden lg:block")}>
            {renderStepNav()}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const wizardBody = (
    <>
      {wizardCard}
      <LegalDisclaimer variant="compact" className="mt-6" />
      {creditsGate}
    </>
  )

  if (isAppLayout) {
    return renderContent(
      <IntakeAppShell
        header={
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
                  {tDashboard("clientIntakeSubtitle")}
                </h1>
                <p className="text-muted-foreground mt-1 text-sm lg:text-base">{t("firmIntakeSubtitle")}</p>
              </div>
              <div className="lg:hidden">{headerBadge}</div>
            </div>
          </div>
        }
        mobileProgress={<WizardProgress step={step} variant="mobile" />}
        aside={
          <>
            <div data-tour="intake-steps">
              <WizardProgress step={step} variant="compact" />
            </div>
            {headerBadge && <div className="flex justify-start" data-tour="intake-firm-badge">{headerBadge}</div>}
            {miniSummary}
            {step === 3 && (
              <>
                {renderChecklist()}
                {creditNotice}
              </>
            )}
            <div className="rounded-lg border p-3 space-y-2" data-tour="intake-ai-model">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Model</p>
              <AiModelPicker compact />
            </div>
          </>
        }
        footer={step > 0 ? renderStepNav() : undefined}
      >
        {wizardBody}
      </IntakeAppShell>,
    )
  }

  return renderContent(
    <>
      {/* Show progress bar only for authenticated users — anon users go straight to generate */}
      {isAuthenticated && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <WizardProgress step={step} />
          {headerBadge}
        </div>
      )}
      {wizardBody}
    </>,
  )
}
