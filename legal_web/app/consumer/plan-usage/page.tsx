"use client"
import { useTranslations } from "next-intl"

import { Suspense } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlanUsagePanel } from "@/components/credits/PlanUsagePanel"
import { getPlanUsage } from "@/lib/api/credits"
import { PageSkeleton } from "@/components/ui/page-skeleton"

function ConsumerPlanUsageContent() {
  const t = useTranslations("consumer")
  const { data, isLoading } = useQuery({
    queryKey: ["plan-usage", "consumer"],
    queryFn: () => getPlanUsage(),
  })

  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <PageSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4" data-tour="consumer-plan-usage">
        <Link href="/consumer/subscription">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Plan & Usage
          </h1>
          <p className="text-muted-foreground">{t("ai_credits_model_mode_and_top-up_settings")}</p>
        </div>
      </div>

      <PlanUsagePanel
        wallet={data.wallet}
        packs={data.packs}
        countryCode={data.wallet.countryCode}
        planLabel={data.wallet.userSegment === "CONSUMER_PLUS" ? t("plusPlan") : t("freePlan")}
      />
    </div>
  )
}

export default function ConsumerPlanUsagePage() {
  const t = useTranslations("consumer")
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">{t("loading_plan_usage")}</div>}>
      <ConsumerPlanUsageContent />
    </Suspense>
  )
}
