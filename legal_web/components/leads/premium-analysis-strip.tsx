"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AnalysisQuotaStatus } from "@/lib/api/marketplace"
import { Lock, Search, Shield, Sparkles } from "lucide-react"

interface PremiumAnalysisStripProps {
  jurisdiction?: string | null
  quotaStatus: AnalysisQuotaStatus | null
  loading?: string | null
  onSimilarCases: () => void
  onOpponentAngles: () => void
  onStrategyMemo: () => void
}

function QuotaHint({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const tCommon = useTranslations("common")
  if (limit <= 0) return null
  return (
    <p className="text-xs text-muted-foreground mt-1">
      {label}: {used}/{limit} this month
    </p>
  )
}

export function PremiumAnalysisStrip({
  jurisdiction,
  quotaStatus,
  loading,
  onSimilarCases,
  onOpponentAngles,
  onStrategyMemo,
}: PremiumAnalysisStripProps) {
  const tCommon = useTranslations("lawyer")
  const locked = !quotaStatus?.includesDeepAnalysis

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Professional+ deep analysis
        </CardTitle>
        <CardDescription>
          Jurisdiction-aware research and strategy tools included in Professional and Enterprise plans.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <AnalysisCard
          icon={Search}
          title={`Similar cases${jurisdiction ? ` in ${jurisdiction}` : ""}`}
          description={tCommon("binding_vs_persuasive_precedents_description")}
          locked={locked}
          loading={loading === "similar"}
          onRun={onSimilarCases}
          quota={
            quotaStatus ? (
              <QuotaHint
                label="Runs"
                used={quotaStatus.used?.similarCases ?? 0}
                limit={quotaStatus.quotas?.similarCases ?? 0}
              />
            ) : null
          }
        />
        <AnalysisCard
          icon={Shield}
          title={tCommon("map_opponent_arguments")}
          description={tCommon("likely_claims_evidence_weaknesses_description")}
          locked={locked}
          loading={loading === "opponent"}
          onRun={onOpponentAngles}
          quota={
            quotaStatus ? (
              <QuotaHint
                label="Runs"
                used={quotaStatus.used?.opponentAngles ?? 0}
                limit={quotaStatus.quotas?.opponentAngles ?? 0}
              />
            ) : null
          }
        />
        <AnalysisCard
          icon={Sparkles}
          title={tCommon("generate_strategy_options")}
          description={tCommon("strategy_options_abc_description")}
          locked={locked}
          loading={loading === "strategy"}
          onRun={onStrategyMemo}
          quota={
            quotaStatus ? (
              <QuotaHint
                label="Runs"
                used={quotaStatus.used?.strategyMemo ?? 0}
                limit={quotaStatus.quotas?.strategyMemo ?? 0}
              />
            ) : null
          }
        />
      </CardContent>
    </Card>
  )
}

function AnalysisCard({
  icon: Icon,
  title,
  description,
  locked,
  loading,
  onRun,
  quota,
}: {
  icon: typeof Search
  title: string
  description: string
  locked: boolean
  loading?: boolean
  onRun: () => void
  quota?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start gap-2">
        {locked ? (
          <Lock className="h-4 w-4 mt-0.5 text-muted-foreground" />
        ) : (
          <Icon className="h-4 w-4 mt-0.5 text-primary" />
        )}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          {quota}
        </div>
      </div>
      {locked ? (
        <Link href="/app/settings/billing">
          <Button variant="outline" size="sm" className="w-full">
            Upgrade to Professional+
          </Button>
        </Link>
      ) : (
        <Button size="sm" className="w-full" disabled={loading} onClick={onRun}>
          {loading ? "Running…" : "Run analysis"}
        </Button>
      )}
    </div>
  )
}
