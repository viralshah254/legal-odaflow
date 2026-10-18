"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { ArrowRight, FileSearch, FileText, Lock, Scale, Search, ShieldAlert, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DRAFT_EXAMPLE_KEYS = [
  "regularBail",
  "chequeBounce",
  "divorcePetition",
  "writPetition",
  "federalComplaint",
  "motionToDismiss",
] as const

interface LandingLockedPanelProps {
  onSignUp: () => void
  signInHref?: string
  heroFocus?: boolean
}

export function LandingDraftingPanel({ onSignUp, signInHref = "/auth", heroFocus }: LandingLockedPanelProps) {
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tAuth = useTranslations("auth")

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-sm text-muted-foreground">{tHome("draftExamplesHint")}</p>

      <div className={cn("grid gap-2", heroFocus ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        {DRAFT_EXAMPLE_KEYS.map((key) => (
          <div
            key={key}
            className="relative rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left"
          >
            <div className="absolute top-3 right-3 text-muted-foreground/50">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-start gap-3 pr-6">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{tHome(`draftExamples.${key}.label`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tHome(`draftExamples.${key}.subtitle`)}</p>
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wide font-medium text-muted-foreground/80">
                  {tHome(`draftExamples.${key}.tag`)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button onClick={onSignUp} size="lg" className="w-full sm:w-auto shadow-md shadow-primary/20">
          {tHome("tryFreeSignUp")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
          <Link href={signInHref}>{tAuth("signIn")}</Link>
        </Button>
      </div>
    </div>
  )
}

const DOC_REVIEW_FEATURES = [
  { icon: ShieldAlert, key: "docReviewRisk" as const },
  { icon: FileText, key: "docReviewClauses" as const },
  { icon: Sparkles, key: "docReviewAi" as const },
  { icon: FileSearch, key: "docReviewCompare" as const },
]

const RESEARCH_EXAMPLE_KEYS = [
  "bnss101",
  "section138",
  "frcp12",
  "ukEmployment",
  "keLabour",
  "contactDrafting",
] as const

export function LandingResearchPanel({ onSignUp, signInHref = "/auth", heroFocus }: LandingLockedPanelProps) {
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tAuth = useTranslations("auth")

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-sm text-muted-foreground">{tHome("researchLockedHint")}</p>

      <div className={cn("grid gap-2", heroFocus ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        {RESEARCH_EXAMPLE_KEYS.map((key) => (
          <div
            key={key}
            className="relative rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-left"
          >
            <div className="absolute top-3 right-3 text-muted-foreground/50">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div className="flex items-start gap-3 pr-6">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{tHome(`researchExamples.${key}.label`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tHome(`researchExamples.${key}.subtitle`)}</p>
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wide font-medium text-muted-foreground/80">
                  {tHome(`researchExamples.${key}.tag`)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button onClick={onSignUp} size="lg" className="w-full sm:w-auto shadow-md shadow-primary/20">
          {tHome("tryFreeSignUp")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
          <Link href={signInHref}>{tAuth("signIn")}</Link>
        </Button>
      </div>
    </div>
  )
}

export function LandingDocumentReviewPanel({ onSignUp, signInHref = "/auth", heroFocus: _heroFocus }: LandingLockedPanelProps) {
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tAuth = useTranslations("auth")

  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-sm text-muted-foreground">{tHome("docReviewHint")}</p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {DOC_REVIEW_FEATURES.map(({ icon: Icon, key }) => (
          <li
            key={key}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">{tHome(key)}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button onClick={onSignUp} size="lg" className="w-full sm:w-auto shadow-md shadow-primary/20">
          {tHome("tryFreeSignUp")}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
          <Link href={signInHref}>{tAuth("signIn")}</Link>
        </Button>
      </div>
    </div>
  )
}
