"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { getCase } from "@/lib/api/consumers"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"

export default function ConsumerCaseOverviewPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const tAdmin = useTranslations("admin")
  const { isAuthenticated } = useAuth()

  const { data: caseData } = useApiData(
    ["consumer-case", params.caseId],
    {
      apiFn: () => getCase(params.caseId),
      enabled: isAuthenticated,
    },
  )

  if (!caseData) return null

  return (
    <div className="space-y-6">
      {caseData.facts && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("facts")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{caseData.facts}</p>
          </CardContent>
        </Card>
      )}

      {caseData.desiredOutcome && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("desired_outcome")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{caseData.desiredOutcome}</p>
          </CardContent>
        </Card>
      )}

      {caseData.reports && caseData.reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("nav.reports")}</CardTitle>
            <CardDescription>{caseData.reports.length} report(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.reports.map((report) => (
              <div key={report.id} className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={report.isPreview ? "secondary" : "default"}>
                    {report.isPreview ? "Preview" : "Full Report"}
                  </Badge>
                  {report.riskLevel && (
                    <Badge variant="outline">Risk: {report.riskLevel}</Badge>
                  )}
                </div>
                <h3 className="font-medium mb-2">{report.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {report.contentMarkdown}
                </p>
                <LegalDisclaimer variant="compact" className="border-t pt-3" />
                <div className="flex flex-wrap gap-2">
                  <Link href={`/consumer/cases/${params.caseId}/report`}>
                    <Button size="sm" variant="outline">{t("view_full_report")}</Button>
                  </Link>
                  <Link href={`/consumer/cases/${params.caseId}/lawyer-review`}>
                    <Button size="sm">{tAdmin("lawyer_review")}</Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("quick_links")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href={`/consumer/cases/${params.caseId}/documents`}>
            <Button variant="outline" size="sm">{t("nav.documents")}</Button>
          </Link>
          <Link href="/upload-document">
            <Button variant="outline" size="sm">{t("upload_document_2")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
