"use client"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LegalMarkdown } from "@/components/legal/legal-markdown"
import type { FirmIntakeStructuredOutput } from "@/lib/api/marketplace"

interface CaseWorkspacePanelsProps {
  structured?: FirmIntakeStructuredOutput | null
  fallbackMarkdown?: string | null
}

function BulletList({ items }: { items?: string[] }) {
  const t = useTranslations("lawyer")
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">{t("not_yet_analyzed")}</p>
  }
  return (
    <ul className="text-sm space-y-1 list-disc pl-5">
      {items.map((item, index) => (
        <li key={`${item.slice(0, 24)}-${index}`}>{item}</li>
      ))}
    </ul>
  )
}

export function CaseWorkspacePanels({
  structured,
  fallbackMarkdown,
}: CaseWorkspacePanelsProps) {
  const t = useTranslations("lawyer")
  if (!structured && fallbackMarkdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("intake_analysis")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LegalMarkdown content={fallbackMarkdown} />
        </CardContent>
      </Card>
    )
  }

  if (!structured) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {t("run_intake_preview_workspace")}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("situation")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{structured.situation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("legal_issues")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={structured.legalIssues} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("strengths_for_our_client")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={structured.strengths} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("risks_gaps")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={structured.risksAndGaps} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("recommended_next_steps")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={structured.recommendedNextSteps} />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-bold">{t("sources_cited")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={structured.sourcesCited} />
        </CardContent>
      </Card>
    </div>
  )
}
