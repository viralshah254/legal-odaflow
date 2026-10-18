"use client"

import { AlertCircle, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface CreditErrorBannerProps {
  message: string
  onGetCredits: () => void
  className?: string
}

export function CreditErrorBanner({ message, onGetCredits, className }: CreditErrorBannerProps) {
  const t = useTranslations("credits.gate")

  return (
    <div
      className={
        className ??
        "rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-violet-500/10 px-4 py-3"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 min-w-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{message}</p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm"
          onClick={onGetCredits}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {t("topUpCta")}
        </Button>
      </div>
    </div>
  )
}
