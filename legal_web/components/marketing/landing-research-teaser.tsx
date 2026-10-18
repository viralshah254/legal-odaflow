"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import type { LegalResearchTeaserResponse } from "@/lib/api/types"
import { CheckCircle, Sparkles } from "lucide-react"

function plainTeaserBullet(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ").trim()
}

interface LandingResearchTeaserProps {
  teaser: LegalResearchTeaserResponse
  query: string
  onSignUp: () => void
  onSignIn: () => void
  onBack: () => void
}

export function LandingResearchTeaser({
  teaser,
  query,
  onSignUp,
  onSignIn,
  onBack,
}: LandingResearchTeaserProps) {
  const t = useTranslations("issueChecker")
  const tHome = useTranslations("marketing.home.landingIssueBoard")
  const tCommon = useTranslations("common")

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Sparkles className="h-3 w-3" />
          {t("previewExcerpt")}
        </Badge>
        <span className="text-xs text-muted-foreground truncate max-w-full">
          {query}
        </span>
      </div>

      {teaser.keyBullets.length > 0 && (
        <ul className="space-y-2">
          {teaser.keyBullets.slice(0, 4).map((bullet, index) => (
            <li
              key={index}
              className="flex items-start gap-3 rounded-lg border bg-card/50 px-3 py-2.5 text-sm"
            >
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span className="leading-relaxed text-foreground">{plainTeaserBullet(bullet)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative rounded-xl border overflow-hidden bg-muted/20">
        <div className="p-4 max-h-48 overflow-hidden">
          <LegalMarkdown content={teaser.teaserMarkdown} />
        </div>
        <div className="absolute inset-x-0 bottom-0 pt-10 bg-gradient-to-t from-background via-background/90 to-transparent">
          <div className="px-4 pb-4">
            <div className="text-center rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-semibold">{t("unlock_full_analysis")}</p>
              <p className="text-xs text-muted-foreground">
                {tHome("subtitleResearch")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <LegalDisclaimer variant="compact">{teaser.disclaimer}</LegalDisclaimer>

      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <Button onClick={onSignUp} size="lg" className="w-full sm:w-auto shadow-md shadow-primary/20">
          {t("createAccountUnlockPreview")}
        </Button>
        <Button variant="outline" onClick={onSignIn} size="lg" className="w-full sm:w-auto">
          {t("signIn")}
        </Button>
        <Button variant="ghost" onClick={onBack} size="lg" className="w-full sm:w-auto sm:ml-auto">
          {tCommon("back")}
        </Button>
      </div>
    </div>
  )
}
