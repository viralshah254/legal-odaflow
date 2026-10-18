"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { IssueCheckerMode } from "./constants"
import { ArrowRight, FileText, Scale, Sparkles } from "lucide-react"

interface JoinPlatformCtaProps {
  variant: "teaser" | "full"
  onSignUp?: () => void
  onSignIn?: () => void
  caseId?: string
  leadId?: string
  mode?: IssueCheckerMode
}

export function JoinPlatformCta({
  variant,
  onSignUp,
  onSignIn,
  caseId,
  leadId,
  mode,
}: JoinPlatformCtaProps) {
  const t = useTranslations("issueChecker")
  const firmWorkspaceHref = leadId ? `/app/leads/${leadId}` : "/app/leads"
  const title = variant === "teaser" ? t("ctaTeaserTitle") : t("ctaFullTitle")
  const description = variant === "teaser" ? t("ctaTeaserDescription") : t("ctaFullDescription")

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background overflow-hidden">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <p className="font-semibold text-lg">{title}</p>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>

        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4 shrink-0" />
            {t("ctaSaveUploadDocs")}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Scale className="h-4 w-4 shrink-0" />
            {t("ctaFullAiReports")}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRight className="h-4 w-4 shrink-0" />
            {t("ctaLawyerMarketplace")}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {variant === "teaser" ? (
            <>
              <Button onClick={onSignUp} className="w-full sm:w-auto">
                {t("ctaJoinUnlockPreview")}
              </Button>
              <Button variant="outline" onClick={onSignIn} className="w-full sm:w-auto">
                {t("signIn")}
              </Button>
            </>
          ) : mode === "FIRM_INTAKE" ? (
            <Link href={firmWorkspaceHref}>
              <Button className="w-full sm:w-auto">{t("open_case_workspace")}</Button>
            </Link>
          ) : (
            <>
              <Link href={caseId ? `/consumer/cases/${caseId}` : "/consumer/dashboard"}>
                <Button className="w-full sm:w-auto">{t("go_to_my_case")}</Button>
              </Link>
              <Link href="/consumer/subscription">
                <Button variant="outline" className="w-full sm:w-auto">
                  {t("topUpCredits")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
