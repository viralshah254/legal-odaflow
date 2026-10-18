"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { LegalDisclaimer } from "@/components/legal/LegalDisclaimer"
import { TabPanelMotion } from "@/components/ui/motion"
import { getConsumerDocuments } from "@/lib/api/documents"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatDate } from "@/lib/utils"
import { FileText, Loader2 } from "lucide-react"

function ocrBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED" || status === "COMPLETE") return "default"
  if (status === "FAILED" || status === "ERROR") return "destructive"
  if (status === "PROCESSING") return "secondary"
  return "outline"
}

export default function ConsumerCaseDocumentsPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const tCommon = useTranslations("common")
  const { isAuthenticated } = useAuth()

  const { data: documents = [], isLoading, error, refetch } = useApiData(
    ["consumer-documents", params.caseId],
    {
      apiFn: () => getConsumerDocuments(params.caseId),
      enabled: isAuthenticated,
      refetchInterval: (query) => {
        const docs = query.state.data
        if (!docs?.some((d) => d.ocrStatus === "PENDING" || d.ocrStatus === "PROCESSING")) {
          return false
        }
        return 5000
      },
    },
  )

  if (isLoading) return <PageSkeleton rows={3} />
  if (error) {
    return (
      <ErrorState message="Failed to load documents." onRetry={() => void refetch()} />
    )
  }

  return (
    <TabPanelMotion value="documents" activeValue="documents">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{t("uploaded_documents")}</CardTitle>
              <CardDescription>{t("ocr_status_and_ai_summaries_for_case_documents")}</CardDescription>
            </div>
            <Link href="/upload-document">
              <Button size="sm" variant="outline">{t("upload")}</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <EmptyState
              title={t("no_documents_yet")}
              description={t("empty_documents_description")}
              actionLabel="Upload document"
              actionHref="/upload-document"
            />
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-lg border shadow-token-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Uploaded {formatDate(doc.createdAt)}
                          {doc.mimeType ? ` · ${doc.mimeType}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant={ocrBadgeVariant(doc.ocrStatus ?? "PENDING")}>
                      {doc.ocrStatus ?? "PENDING"}
                    </Badge>
                  </div>
                  {doc.aiSummary && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{tCommon("ai_summary")}</p>
                      <p className="text-sm whitespace-pre-wrap">{doc.aiSummary}</p>
                      <LegalDisclaimer variant="compact" className="mt-3" />
                    </div>
                  )}
                  {(doc.ocrStatus === "PENDING" || doc.ocrStatus === "PROCESSING") && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      OCR in progress — this page refreshes automatically
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabPanelMotion>
  )
}
