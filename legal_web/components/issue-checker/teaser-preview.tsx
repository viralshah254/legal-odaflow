"use client"
import { useState } from "react"
import { AlertTriangle, CheckCircle, SlidersHorizontal, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import { WinProbabilityBar } from "./win-probability-bar"
import { MatterIntelligencePanel } from "@/components/matter-intelligence/matter-intelligence-panel"
import { InlineGoogleSignUp } from "./inline-google-sign-up"
import { RefinementSidePanel } from "./refinement-side-panel"
import type { IssueCheckerTeaserResponse } from "@/lib/api/types"
import type { PlanQuestion } from "@/lib/api/consumers"

interface TeaserPreviewProps {
  teaser: IssueCheckerTeaserResponse
  refinementQuestions: PlanQuestion[]
  refinementQuestionsLoading: boolean
  isRefining: boolean
  onRefine: (answers: Record<string, string | string[]>) => void
  /**
   * When provided, sign-in calls this instead of opening the refinement sheet.
   * Use on the landing page to immediately redirect to the upgrade path.
   * When omitted (e.g. inside the wizard), the refinement panel opens as usual.
   */
  onSignInSuccess?: () => void
  /** Override href for the "Or continue with email" link inside the sign-up card. */
  emailHref?: string
}

const RISK_BADGE_CLASS: Record<string, string> = {
  LOW: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  MEDIUM: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  HIGH: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICAL: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
}

function truncateToTopic(text: string, maxLen = 28): string {
  const clean = text.replace(/\?+$/, "").trim()
  return (clean.length > maxLen ? clean.slice(0, maxLen - 1) + "…" : clean) + "?"
}

export function TeaserPreview({
  teaser,
  refinementQuestions,
  refinementQuestionsLoading,
  isRefining,
  onRefine,
  onSignInSuccess,
  emailHref,
}: TeaserPreviewProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSignIn = () => {
    if (onSignInSuccess) {
      onSignInSuccess()
    } else {
      setSheetOpen(true)
    }
  }

  const inferredRiskLevel = teaser.requiresLawyer
    ? "HIGH"
    : (teaser.keyBullets?.length ?? 0) > 3
      ? "MEDIUM"
      : "LOW"
  const riskClass = RISK_BADGE_CLASS[inferredRiskLevel] ?? RISK_BADGE_CLASS.MEDIUM
  const riskLabelKey = `risk${inferredRiskLevel.charAt(0)}${inferredRiskLevel.slice(1).toLowerCase()}` as
    | "riskLow"
    | "riskMedium"
    | "riskHigh"
    | "riskCritical"

  const riskLabels: Record<string, string> = {
    riskLow: "Low risk",
    riskMedium: "Medium risk",
    riskHigh: "High risk",
    riskCritical: "Critical",
  }

  return (
    <>
      <Card className="border-2 shadow-lg shadow-primary/5">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Analysis preview
            </Badge>
            <Badge variant="outline" className={riskClass}>
              <AlertTriangle className="mr-1 h-3 w-3" />
              {riskLabels[riskLabelKey] ?? riskLabelKey}
            </Badge>
          </div>
          <CardTitle className="text-xl leading-tight">{teaser.suggestedTitle}</CardTitle>
          <CardDescription className="text-sm">
            {teaser.detectedIssueType} · Sign up free to unlock the full report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {teaser.matterProfile && (
            <MatterIntelligencePanel
              matterProfile={teaser.matterProfile}
              taskGraph={teaser.taskGraph}
              recommendedActions={teaser.recommendedActions}
              issues={teaser.issues}
              nextBestAction={teaser.nextBestAction}
            />
          )}

          {teaser.winProbability && (
            <div className="p-4 rounded-xl border bg-muted/30">
              <WinProbabilityBar winProbability={teaser.winProbability} />
            </div>
          )}

          {teaser.keyBullets.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key findings</p>
              <ul className="space-y-2">
                {teaser.keyBullets.slice(0, 4).map((bullet, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 rounded-lg border bg-card/50 px-3 py-2.5 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="leading-relaxed text-foreground">
                      {bullet.replace(/\*\*/g, "").replace(/\*/g, "").trim()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Blurred preview with gradient fade */}
          <div className="relative rounded-xl border overflow-hidden bg-muted/20">
            <div className="p-4 max-h-36 overflow-hidden">
              <LegalMarkdown content={teaser.teaserMarkdown} />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
          </div>

          {/* Sign-in CTA — directly below the blurred content so it is always
              visible without scrolling, and never clipped by overflow-hidden. */}
          <InlineGoogleSignUp
            onSuccess={handleSignIn}
            title="Unlock full analysis"
            description="Cited law, recommended steps, and a full report — free."
            compact
            emailHref={emailHref}
          />

          {teaser.requiresLawyer && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-400">
                This situation may benefit from legal representation. A lawyer can advise you on your options.
              </span>
            </div>
          )}

          <LegalDisclaimer variant="compact">{teaser.disclaimer}</LegalDisclaimer>

          {/* Refinement questions teaser — shows what extra precision the user will get */}
          {(refinementQuestionsLoading || refinementQuestions.length > 0) && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <p className="font-semibold text-sm">Make this analysis more precise</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {refinementQuestionsLoading ? (
                  <>
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-28 rounded-full" />
                    <Skeleton className="h-7 w-16 rounded-full" />
                  </>
                ) : (
                  refinementQuestions.slice(0, 5).map((q) => (
                    <span
                      key={q.id}
                      className="inline-flex items-center px-3 py-1.5 rounded-full border border-primary/25 bg-primary/8 text-xs font-medium text-primary"
                    >
                      {truncateToTopic(q.text)}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refinement panel — only used when onSignInSuccess is not provided (wizard flow) */}
      {!onSignInSuccess && (
        <RefinementSidePanel
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          questions={refinementQuestions}
          onSubmit={(answers) => {
            setSheetOpen(false)
            onRefine(answers)
          }}
          isSubmitting={isRefining}
        />
      )}
    </>
  )
}
