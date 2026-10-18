"use client"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConsumerDraftCard } from "@/components/consumer/consumer-draft-card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { TabPanelMotion } from "@/components/ui/motion"
import { listConsumerCaseDrafts } from "@/lib/api/consumer-case-workspace"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { FileEdit } from "lucide-react"

export default function ConsumerCaseDraftsPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()

  const { data: drafts = [], isLoading, error, refetch } = useApiData(
    ["consumer-case-drafts", params.caseId],
    {
      apiFn: () => listConsumerCaseDrafts(params.caseId),
      enabled: isAuthenticated,
    },
  )

  if (isLoading) return <PageSkeleton rows={3} />
  if (error) {
    return (
      <ErrorState message="Failed to load drafts." onRetry={() => void refetch()} />
    )
  }

  return (
    <TabPanelMotion value="drafts" activeValue="drafts">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("drafts")}</CardTitle>
          <CardDescription>
            AI report previews and versions for this case. Open the structured report for the
            full 15-section view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <EmptyState
              icon={FileEdit}
              title={t("no_drafts_yet")}
              description={t("empty_drafts_description")}
            />
          ) : (
            <ul className="space-y-4">
              {drafts.map((draft) => (
                <ConsumerDraftCard
                  key={draft.id}
                  draft={draft}
                  caseId={params.caseId}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </TabPanelMotion>
  )
}
