"use client"

import Link from "next/link"
import { format, isToday, isPast } from "date-fns"
import { useTranslations } from "next-intl"
import { Sparkles, CalendarClock, CheckCircle2, Inbox, ArrowRight, Wand2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getProactiveBrief } from "@/lib/api/ai"
import { useTenant } from "@/lib/contexts/tenant-context"
import { useApiData } from "@/lib/hooks/use-api-data"
import { useUIStore } from "@/lib/store"
import { cn } from "@/lib/utils"

export function NextBestActions() {
  const t = useTranslations("dashboard.dailyBrief")
  const { activeTenantId } = useTenant()
  const openCopilotWithPrompt = useUIStore((s) => s.openCopilotWithPrompt)

  const { data: brief, isLoading } = useApiData(
    ["proactive-brief", activeTenantId],
    {
      apiFn: () => getProactiveBrief(activeTenantId ?? undefined),
      enabled: !!activeTenantId,
      staleTime: 60_000,
    },
  )

  if (isLoading || !brief) return null

  const deadlines = brief.matterDeadlines.slice(0, 4)
  const hasAnything =
    deadlines.length > 0 || brief.pendingApprovals > 0 || brief.leadCount > 0

  if (!hasAnything) return null

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t("title")}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {format(new Date(brief.generatedAt), "EEE, MMM d")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <BriefStat
            icon={<CalendarClock className="h-4 w-4" />}
            label={t("deadlinesThisWeek")}
            value={brief.matterDeadlines.length}
            href="/app/tasks"
            tone={deadlines.some((d) => isPast(new Date(d.dueDate))) ? "danger" : "default"}
          />
          <BriefStat
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={t("approvalsWaiting")}
            value={brief.pendingApprovals}
            href="/app/ai-review"
          />
          <BriefStat
            icon={<Inbox className="h-4 w-4" />}
            label={t("openLeads")}
            value={brief.leadCount}
            href="/app/leads"
          />
        </div>

        {deadlines.length > 0 && (
          <div className="space-y-1.5">
            {deadlines.map((d) => {
              const due = new Date(d.dueDate)
              const overdue = isPast(due) && !isToday(due)
              return (
                <div
                  key={d.taskId}
                  className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.matterTitle ? `${d.matterTitle} · ` : ""}
                      <span className={cn(overdue && "text-destructive font-medium")}>
                        {overdue ? t("overdue") : t("due")}{" "}
                        {format(due, "MMM d")}
                      </span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() =>
                      openCopilotWithPrompt(
                        `Draft the next filing/step for the task "${d.title}"${
                          d.matterTitle ? ` on matter "${d.matterTitle}"` : ""
                        } and suggest what I need to prepare before ${format(due, "MMM d")}.`,
                      )
                    }
                  >
                    <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("draftWithAi")}
                  </Button>
                  {d.matterId && (
                    <Button asChild size="sm" variant="ghost" className="shrink-0">
                      <Link href={`/app/matters/${d.matterId}`}>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {brief.pendingApprovals > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openCopilotWithPrompt(
                  "Summarize the AI drafts awaiting my review and recommend which to approve, edit, or reject.",
                )
              }
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              {t("reviewAiDrafts", { count: brief.pendingApprovals })}
            </Button>
          )}
          {brief.leadCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                openCopilotWithPrompt(
                  "Triage my open intake leads: rank by urgency and suggest the next best action for each.",
                )
              }
            >
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              {t("triageLeads", { count: brief.leadCount })}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openCopilotWithPrompt("Give me my morning brief and what needs my attention today.")}
          >
            {t("askMorningBrief")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function BriefStat({
  icon,
  label,
  value,
  href,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: number
  href: string
  tone?: "default" | "danger"
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent",
        tone === "danger" ? "border-destructive/30" : "border-border/50",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-bold leading-none">{value}</span>
          {tone === "danger" && value > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">
              !
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </Link>
  )
}
