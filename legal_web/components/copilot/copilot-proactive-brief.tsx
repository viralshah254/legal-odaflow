"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { getProactiveBrief } from "@/lib/api/copilot"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Sun, Clock } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

function safeFormatDistance(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return formatDistanceToNow(date, { addSuffix: true })
}

export function CopilotProactiveBrief() {
  const t = useTranslations("copilot")
  const tDaily = useTranslations("dashboard.dailyBrief")
  const { activeTenantId } = useTenant()

  const { data: brief, isLoading, error } = useApiData(
    ["proactive-brief", activeTenantId],
    {
      apiFn: () => getProactiveBrief(activeTenantId!),
      enabled: !!activeTenantId,
    },
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !brief) {
    return (
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sun className="h-4 w-4" />
            {t("morningBrief")}
          </CardTitle>
          <CardDescription className="text-xs">{t("morningBriefEmpty")}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const deadlines = brief.matterDeadlines ?? []
  const pendingApprovals = brief.pendingApprovals ?? 0
  const leadCount = brief.leadCount ?? 0
  const hasContent = deadlines.length > 0 || pendingApprovals > 0 || leadCount > 0

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              {tDaily("title")}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {format(new Date(brief.generatedAt), "EEEE, MMM d · h:mm a")}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {t("briefBadge")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="py-0 pb-3 space-y-3">
        {!hasContent && (
          <p className="text-sm text-muted-foreground">{t("morningBriefEmpty")}</p>
        )}

        {deadlines.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{tDaily("deadlinesThisWeek")}</p>
            <ul className="space-y-1.5">
              {deadlines.map((deadline) => (
                <li key={deadline.taskId}>
                  <Link
                    href={`/app/tasks?id=${deadline.taskId}`}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors text-sm"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    <span className="flex-1 min-w-0">
                      <span className="block line-clamp-1">{deadline.title}</span>
                      {deadline.matterTitle && (
                        <span className="block text-xs text-muted-foreground line-clamp-1">
                          {deadline.matterTitle}
                        </span>
                      )}
                      {deadline.dueDate && (
                        <span className="block text-xs text-muted-foreground">
                          {safeFormatDistance(deadline.dueDate)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {pendingApprovals > 0 && (
            <Badge variant="secondary" className="text-xs">
              {t("pendingApprovals", { count: pendingApprovals })}
            </Badge>
          )}
          {leadCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {tDaily("openLeads")}: {leadCount}
            </Badge>
          )}
        </div>

        <div className="space-y-2 pt-1">
          {pendingApprovals > 0 && (
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2" asChild>
              <Link href="/app/ai-review">
                {tDaily("reviewAiDrafts", { count: pendingApprovals })}
              </Link>
            </Button>
          )}
          {leadCount > 0 && (
            <Button variant="outline" size="sm" className="w-full justify-start h-auto py-2" asChild>
              <Link href="/app/clients/new">
                {tDaily("triageLeads", { count: leadCount })}
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
