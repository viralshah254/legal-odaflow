"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { IssueIntakeMicroFlow, type IntakeMicroFlowResult } from "@/components/issue-checker/issue-intake-micro-flow"
import {
  IssueCheckerCaptchaProvider,
  IssueCheckerTurnstileWidget,
  useIssueCheckerCaptcha,
} from "@/lib/captcha/issue-checker-captcha"
import {
  saveIssueCheckerSession,
  loadIssueCheckerSession,
  createEmptyWizardData,
} from "@/components/issue-checker/constants"
import { LandingDraftingPanel, LandingDocumentReviewPanel, LandingResearchPanel } from "@/components/marketing/landing-locked-panels"
import { useDetectedCountry } from "@/lib/contexts/country-context"
import { classifyIssueChecker, getPlanQuestions, teaserIssueChecker, type PlanQuestion } from "@/lib/api/consumers"
import { ApiClientError } from "@/lib/api/client"
import { InlineSocialSignUp } from "@/components/issue-checker/inline-google-sign-up"
import type { IssueCheckerTeaserResponse } from "@/lib/api/types"
import { TeaserPreview } from "@/components/issue-checker/teaser-preview"
import { IntakeAnalysisProgress } from "@/components/issue-checker/intake-analysis-progress"
import { getDeviceId } from "@/lib/device/device-id"
import { FileSearch, Loader2, Lock, Scale, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { appendReferralToHref } from "@/lib/auth/referral-storage"

/** Fingerprint only — used for non-CAPTCHA-gated best-effort calls. */
function getAbuseFieldsSafe(): string | undefined {
  return getDeviceId() ?? undefined
}

type LandingTask = "issue-check" | "research" | "drafting" | "document-review"

interface LandingIssueBoardProps {
  heroFocus?: boolean
}

const TASK_CONFIG: Array<{
  id: LandingTask
  icon: typeof Sparkles
  locked?: boolean
}> = [
  { id: "issue-check", icon: Sparkles },
  { id: "research", icon: Search, locked: true },
  { id: "drafting", icon: Scale, locked: true },
  { id: "document-review", icon: FileSearch, locked: true },
]

function draftingRedirectPath(detected: string): string {
  return detected === "US" ? "/app/us-drafting" : "/app/india-drafting"
}

function taskLabelKey(id: LandingTask) {
  switch (id) {
    case "issue-check":
      return "taskIssueCheck" as const
    case "research":
      return "taskResearch" as const
    case "drafting":
      return "taskDrafting" as const
    case "document-review":
      return "taskDocumentReview" as const
  }
}

export function LandingIssueBoard({ heroFocus = false }: LandingIssueBoardProps) {
  return (
    <IssueCheckerCaptchaProvider>
      <LandingIssueBoardInner heroFocus={heroFocus} />
    </IssueCheckerCaptchaProvider>
  )
}

function LandingIssueBoardInner({ heroFocus = false }: LandingIssueBoardProps) {
  const tMarketing = useTranslations("marketing")
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tCommon = useTranslations("common")
  const { countryCode, isLoading: countryLoading } = useDetectedCountry()
  const router = useRouter()
  const { withAbuseFields } = useIssueCheckerCaptcha()

  const [task, setTask] = useState<LandingTask>("issue-check")
  const [hydrated, setHydrated] = useState(false)

  // Inline teaser state — no redirect for SELF mode
  const [teaserLoading, setTeaserLoading] = useState(false)
  const [teaserResult, setTeaserResult] = useState<IssueCheckerTeaserResponse | null>(null)
  const [teaserError, setTeaserError] = useState<string | null>(null)
  const [rateLimitHit, setRateLimitHit] = useState(false)
  const [anonSessionId, setAnonSessionId] = useState<string | undefined>()
  // Refinement questions — loaded in background after teaser is shown
  const [refinementQuestions, setRefinementQuestions] = useState<PlanQuestion[]>([])
  const [refinementQuestionsLoading, setRefinementQuestionsLoading] = useState(false)
  const [isRefining, setIsRefining] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  const taskTitleKey = useMemo(() => {
    const map: Record<LandingTask, string> = {
      "issue-check": "titleIssueCheck",
      research: "titleResearch",
      drafting: "titleDrafting",
      "document-review": "titleDocumentReview",
    }
    return map[task] as "titleIssueCheck" | "titleResearch" | "titleDrafting" | "titleDocumentReview"
  }, [task])

  const taskSubtitleKey = useMemo(() => {
    const map: Record<LandingTask, string> = {
      "issue-check": "subtitleIssueCheck",
      research: "subtitleResearch",
      drafting: "subtitleDrafting",
      "document-review": "subtitleDocumentReview",
    }
    return map[task] as
      | "subtitleIssueCheck"
      | "subtitleResearch"
      | "subtitleDrafting"
      | "subtitleDocumentReview"
  }, [task])

  const handleComplete = useCallback(async (result: IntakeMicroFlowResult) => {
    // Firm intake always routes to the lawyer workspace
    if (result.mode === "FIRM_INTAKE") {
      const data = {
        ...createEmptyWizardData(result.countryCode),
        facts: result.facts,
        countryCode: result.countryCode,
        jurisdiction: result.jurisdiction,
      }
      saveIssueCheckerSession({ step: 0, mode: result.mode, data, landingHandoff: true })
      router.push("/app/intake?from=landing")
      return
    }

    // SELF mode: classify → teaser → show inline (no page navigation)
    setTeaserLoading(true)
    setTeaserError(null)
    // Hoisted so the catch block can read it when building the partial session
    let classified: Awaited<ReturnType<typeof classifyIssueChecker>> | undefined
    try {
      // Step 1: Classify without CAPTCHA.
      // Turnstile tokens are single-use; burning one here caused teaser to fail with
      // "CAPTCHA verification failed" (stale token reuse). Match the wizard path:
      // classify is best-effort; only the teaser call spends the token.
      try {
        classified = await classifyIssueChecker({
          countryCode: result.countryCode,
          facts: result.facts,
          mode: "SELF",
          deviceFingerprint: getAbuseFieldsSafe(),
        })
      } catch {
        // Non-fatal: proceed without classification
      }

      const combinedFacts = [
        result.facts,
        classified?.parties ? `Parties involved: ${classified.parties}` : "",
        classified?.urgencyLevel ? `Urgency: ${classified.urgencyLevel}` : "",
      ].filter(Boolean).join("\n\n")

      // Step 2: Generate teaser (waits for a fresh token if needed)
      const teaserRes = await withAbuseFields((abuse) =>
        teaserIssueChecker({
          countryCode: result.countryCode,
          jurisdiction: result.jurisdiction || undefined,
          issueType: classified?.issueType ?? "",
          title: classified?.suggestedTitle ?? "",
          facts: combinedFacts,
          parties: classified?.parties || undefined,
          urgencyLevel: classified?.urgencyLevel ?? "MEDIUM",
          mode: "SELF",
          ...abuse,
        }),
      )
      setAnonSessionId(teaserRes.anonymousSessionId)
      setTeaserResult(teaserRes)

      // Save session so /legal-issue-checker can upgrade after sign-in
      const sessionData = {
        ...createEmptyWizardData(result.countryCode),
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
      }
      saveIssueCheckerSession({
        step: 0,
        mode: "SELF",
        data: sessionData,
        anonymousSessionId: teaserRes.anonymousSessionId,
        teaserGenerated: true,
      })
    } catch (err) {
      const is429 =
        (err instanceof ApiClientError && err.statusCode === 429) ||
        (err instanceof Error && /limit reached|too many/i.test(err.message))

      if (is429) {
        // Save facts + classification so the wizard can run a full preview after sign-in
        const partialSession = {
          ...createEmptyWizardData(result.countryCode),
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
        }
        saveIssueCheckerSession({ step: 0, mode: "SELF", data: partialSession })
        setRateLimitHit(true)
      } else {
        setTeaserError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      }
      return
    } finally {
      setTeaserLoading(false)
    }

    // Step 3: Refinement questions in background — do not spend another CAPTCHA token.
    // Rate limiting still applies via device fingerprint / IP.
    setRefinementQuestionsLoading(true)
    try {
      const questionsRes = await getPlanQuestions({
        countryCode: result.countryCode,
        facts: result.facts,
        mode: "SELF",
        deviceFingerprint: getAbuseFieldsSafe(),
      })
      setRefinementQuestions(questionsRes.questions)
    } catch {
      setRefinementQuestions([])
    } finally {
      setRefinementQuestionsLoading(false)
    }
  }, [router, withAbuseFields])

  /** User signed in from the inline CTA → redirect to the wizard upgrade path immediately.
   *  The anonymousSessionId is already in sessionStorage; the wizard's upgrade effect
   *  will pick it up and call runFullPreview automatically.
   *  We always add mode=personal so lawyers are not redirected to the firm intake wizard. */
  const handleSignInSuccess = useCallback(() => {
    router.push("/legal-issue-checker?upgrade=1&mode=personal")
  }, [router])

  /** @deprecated kept so nothing breaks if called elsewhere; prefer handleSignInSuccess */
  const handleLandingRefine = useCallback((planningAnswers: Record<string, string | string[]>) => {
    setIsRefining(true)
    const stored = loadIssueCheckerSession()
    if (stored) {
      saveIssueCheckerSession({
        ...stored,
        data: { ...stored.data, planningAnswers },
      })
    }
    router.push("/legal-issue-checker?upgrade=1&mode=personal")
  }, [router])


  const buildAuthRedirect = useCallback(
    (path: string) => {
      const params = new URLSearchParams()
      params.set("redirect", path)
      router.push(appendReferralToHref(`/auth?${params.toString()}`))
    },
    [router],
  )

  const lockedPath = useMemo(() => {
    if (task === "drafting") return draftingRedirectPath(countryCode)
    if (task === "research") return "/app/research"
    return "/app/document-review"
  }, [task, countryCode])

  const handleLockedContinue = () => {
    buildAuthRedirect(lockedPath)
  }

  const lockedSignInHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set("redirect", lockedPath)
    return appendReferralToHref(`/auth?${params.toString()}`)
  }, [lockedPath])

  const footerPoints = useMemo(() => {
    if (task === "issue-check") {
      return [
        tHome("footerIssueCheck1"),
        tHome("footerIssueCheck2"),
        tHome("footerIssueCheck3"),
      ]
    }
    if (task === "research") {
      return [
        tHome("footerResearch1"),
        tHome("footerResearch2"),
        tHome("footerResearch3"),
      ]
    }
    return [tHome("freePreview"), tHome("signUpToUnlock"), tHome("resultsIn2Min")]
  }, [task, tHome])

  const header = heroFocus ? null : (
    <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b border-border/50 px-5 py-3.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{tMarketing("ai_legal_analysis")}</p>
      </div>
    </div>
  )

  const footer = (
    <div className="border-t border-border/40 bg-muted/20 px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {footerPoints.map((point, i) => (
          <span key={point} className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                i === 0 ? "bg-emerald-500" : i === 1 ? "bg-primary" : "bg-blue-500",
              )}
            />
            {point}
          </span>
        ))}
        {task === "issue-check" && (
          <span className="ml-auto text-muted-foreground/60 hidden md:block">{tMarketing("to_continue")}</span>
        )}
      </div>
    </div>
  )

  const cardTitle = tHome(taskTitleKey)
  const cardSubtitle = tHome(taskSubtitleKey)

  const geoReady = hydrated && !countryLoading

  const taskPicker = (
    <div className="mb-5 overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain touch-pan-x">
      <div className="flex items-center gap-2 min-w-max py-0.5">
        {TASK_CONFIG.map(({ id, icon: Icon, locked }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTask(id)
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 min-h-9 text-xs font-semibold uppercase tracking-wide whitespace-nowrap transition-colors duration-200",
              task === id
                ? "border-primary bg-primary/10 text-foreground shadow-sm shadow-primary/10"
                : "border-border/70 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {tHome(taskLabelKey(id))}
            {locked && <Lock className="h-3 w-3 opacity-60" />}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="w-full">
      <div
        className={cn(
          "bg-card/95 backdrop-blur overflow-hidden",
          heroFocus
            ? "border border-primary/25 rounded-2xl shadow-2xl shadow-primary/20 ring-1 ring-primary/10"
            : "border-2 border-border/70 rounded-2xl shadow-2xl shadow-primary/15",
        )}
      >
        {header}

        <div
          className={cn(
            heroFocus ? "px-4 py-4 sm:px-7 sm:py-6" : "px-5 py-5 sm:px-7 sm:py-6",
          )}
        >
          {taskPicker}

          <div
            className={cn(
              "mb-5",
              heroFocus && "mb-6 text-left",
            )}
          >
            <h2
              className={cn(
                "font-bold tracking-tight text-foreground mb-1.5",
                heroFocus
                  ? "text-xl sm:text-2xl leading-tight"
                  : "text-lg sm:text-xl",
              )}
            >
              {cardTitle}
            </h2>
            <p className={cn("text-muted-foreground font-normal leading-relaxed", heroFocus ? "text-sm" : "text-xs sm:text-[13px]")}>
              {cardSubtitle}
            </p>
          </div>

          {/* Keep Turnstile mounted across loading/error so tokens can refresh.
              Do not use sr-only / opacity-0 — Cloudflare rejects hidden widgets. */}
          {task === "issue-check" && !teaserResult && !rateLimitHit && (
            <IssueCheckerTurnstileWidget hideWhenReady className={cn(teaserLoading && "mb-3")} />
          )}

          {/* Inline teaser result after analysis */}
          {teaserResult ? (
            <div className="animate-fade-in">
              <TeaserPreview
                teaser={teaserResult}
                refinementQuestions={refinementQuestions}
                refinementQuestionsLoading={refinementQuestionsLoading}
                isRefining={isRefining}
                onRefine={handleLandingRefine}
                onSignInSuccess={handleSignInSuccess}
                emailHref={`/auth?${new URLSearchParams({ redirect: "/legal-issue-checker?upgrade=1&mode=personal" }).toString()}`}
              />
            </div>
          ) : teaserLoading ? (
            <IntakeAnalysisProgress active hasDocuments={false} variant="preview" className="w-full py-4" />
          ) : rateLimitHit ? (
            <div className="space-y-3">
              <InlineSocialSignUp
                onSuccess={handleSignInSuccess}
                title="You've used today's free previews"
                description="Sign in free to get your full legal analysis with cited law, recommended steps, and a detailed report."
                emailHref={`/auth?${new URLSearchParams({ redirect: "/legal-issue-checker?upgrade=1&mode=personal" }).toString()}`}
              />
              <button
                type="button"
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setRateLimitHit(false)}
              >
                ← Start over
              </button>
            </div>
          ) : teaserError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive space-y-3">
              <p>{teaserError}</p>
              <button
                type="button"
                className="text-xs underline underline-offset-2 text-muted-foreground"
                onClick={() => setTeaserError(null)}
              >
                Try again
              </button>
            </div>
          ) : !geoReady ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-sm">{tCommon("loading")}</span>
            </div>
          ) : task === "research" ? (
            <div key="research" className="animate-landing-task-enter">
              <LandingResearchPanel
                onSignUp={handleLockedContinue}
                signInHref={lockedSignInHref}
                heroFocus={heroFocus}
              />
            </div>
          ) : task === "drafting" ? (
            <div key="drafting" className="animate-landing-task-enter">
              <LandingDraftingPanel
                onSignUp={handleLockedContinue}
                signInHref={lockedSignInHref}
                heroFocus={heroFocus}
              />
            </div>
          ) : task === "document-review" ? (
            <div key="document-review" className="animate-landing-task-enter">
              <LandingDocumentReviewPanel
                onSignUp={handleLockedContinue}
                signInHref={lockedSignInHref}
                heroFocus={heroFocus}
              />
            </div>
          ) : heroFocus ? (
            <div key="issue-check" className="animate-landing-task-enter">
              <IssueIntakeMicroFlow onComplete={(r) => void handleComplete(r)} showFirmIntake layoutWide heroFocus />
            </div>
          ) : (
            <div key="issue-check" className="animate-landing-task-enter">
              <div className="sm:hidden">
                <IssueIntakeMicroFlow onComplete={(r) => void handleComplete(r)} showFirmIntake layoutWide />
              </div>
              <div className="hidden sm:block">
                <IssueIntakeMicroFlow onComplete={(r) => void handleComplete(r)} showFirmIntake />
              </div>
            </div>
          )}
        </div>

        <div>{footer}</div>
      </div>
    </div>
  )
}
