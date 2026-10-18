"use client"
import { useTranslations } from "next-intl"

import Link from "next/link"
import { Sparkles, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CopilotUpgradeBanner() {
  const t = useTranslations("copilot")
  return (
    <div className="mx-4 mt-3 mb-2 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span>{t("copilot_requires_professional_or_solo_plan")}</span>
      </div>
      <Button size="sm" variant="outline" asChild>
        <Link href="/app/settings/billing?upgrade=professional">
          {t("upgrade")}
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
    </div>
  )
}
