"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { ArrowRight, Clock3 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TimelineEvent } from "@/lib/types/timeline"

interface MatterRecentActivityProps {
  events: TimelineEvent[]
  matterId: string
  loading?: boolean
}

export function MatterRecentActivity({
  events,
  matterId,
  loading = false,
}: MatterRecentActivityProps) {
  const t = useTranslations("matters")
  const locale = useLocale()
  const preview = events.slice(0, 3)
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{t("recent_activity")}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/matters/${matterId}/work`}>
            {t("workspace.work")}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label={t("recent_activity")}>
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : preview.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{t("no_activity_yet")}</p>
        ) : (
          <ol className="divide-y">
            {preview.map((event) => (
              <li key={event.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.description && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {event.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.userName} · {dateFormatter.format(event.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
