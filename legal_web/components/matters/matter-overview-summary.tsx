"use client"

import { useTranslations } from "next-intl"
import { Clock, Target } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ApiMatter } from "@/lib/api/types"

interface MatterOverviewSummaryProps {
  matter: ApiMatter
  limitation?: {
    dueDate: string
    rule?: string | null
  } | null
}

export function MatterOverviewSummary({ matter, limitation }: MatterOverviewSummaryProps) {
  const t = useTranslations("matters")
  const summary = matter.factsSummary?.trim()
  const desiredOutcome = matter.desiredOutcome?.trim()
  const limitationLabel = limitation?.dueDate
    ? new Date(limitation.dueDate).toLocaleDateString()
    : null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("summary")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-foreground">
          {summary || matter.title}
        </p>
        {desiredOutcome && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{t("desired_outcome")}</p>
              <p className="mt-1 text-sm">{desiredOutcome}</p>
            </div>
          </div>
        )}
        {limitationLabel && (
          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Limitation</p>
              <p className="mt-1 text-sm">{limitationLabel}</p>
              {limitation?.rule && (
                <p className="mt-1 text-xs text-muted-foreground">{limitation.rule}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
