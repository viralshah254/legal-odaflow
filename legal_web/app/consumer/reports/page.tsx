"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { listCases } from "@/lib/api/consumers"
import { useAuth } from "@/lib/contexts/auth-context"
import { formatDate } from "@/lib/utils"
import { FileText } from "lucide-react"

export default function ConsumerReportsPage() {
  const t = useTranslations("consumer")
  const tAuth = useTranslations("auth")
  const { isAuthenticated } = useAuth()
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["consumer-cases"],
    queryFn: listCases,
    enabled: isAuthenticated,
  })

  const reports = cases.flatMap((c) =>
    (c.reports ?? []).map((r) => ({ ...r, caseTitle: c.title, caseId: c.id })),
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{t("nav.reports")}</h1>
        <p className="text-muted-foreground mb-8">{t("your_ai-generated_legal_previews_and_reports")}</p>

        <Card data-tour="consumer-reports-list">
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>{reports.length} total</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{tAuth("loading")}</p>
            ) : reports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No reports yet.{" "}
                  <Link href="/legal-issue-checker" className="text-primary hover:underline">
                    Run an issue check
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/consumer/cases/${report.caseId}`}
                    className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={report.isPreview ? "secondary" : "default"}>
                        {report.isPreview ? "Preview" : "Full"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>
                    <p className="font-medium">{report.title}</p>
                    <p className="text-sm text-muted-foreground">Case: {report.caseTitle}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
