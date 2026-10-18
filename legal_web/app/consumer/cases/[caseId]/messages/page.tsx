"use client"
import { useTranslations } from "next-intl"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { TabPanelMotion } from "@/components/ui/motion"
import { listConsumerCaseMessages } from "@/lib/api/consumer-case-workspace"
import { useAuth } from "@/lib/contexts/auth-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { formatDate } from "@/lib/utils"
import { MessageSquare } from "lucide-react"

export default function ConsumerCaseMessagesPage({
  params,
}: {
  params: { caseId: string }
}) {
  const t = useTranslations("consumer")
  const { isAuthenticated } = useAuth()

  const { data: messages = [], isLoading, error, refetch } = useApiData(
    ["consumer-case-messages", params.caseId],
    {
      apiFn: () => listConsumerCaseMessages(params.caseId),
      enabled: isAuthenticated,
    },
  )

  if (isLoading) return <PageSkeleton rows={3} />
  if (error) {
    return <ErrorState message="Failed to load messages." onRetry={() => void refetch()} />
  }

  return (
    <TabPanelMotion value="messages" activeValue="messages">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("messages")}</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={t("no_messages_yet")}
              description={t("empty_messages_description")}
            />
          ) : (
            <ul className="space-y-3">
              {messages.map((msg) => (
                <li key={msg.id} className="rounded-lg border p-4 shadow-token-sm">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline">{msg.direction}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(msg.createdAt)}</span>
                  </div>
                  {msg.subject && <p className="font-medium text-sm">{msg.subject}</p>}
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{msg.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </TabPanelMotion>
  )
}
