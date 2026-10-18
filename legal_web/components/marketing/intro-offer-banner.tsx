"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Clock, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { IntroOfferStatus } from "@/lib/api/intro-offer"
import { useIntroOfferCountdown } from "@/lib/hooks/use-intro-offer-countdown"

interface IntroOfferBannerProps {
  introOffer: IntroOfferStatus | null | undefined
  plansHref?: string
  className?: string
  compact?: boolean
}

export function IntroOfferBanner({
  introOffer,
  plansHref = "/pricing",
  className = "",
  compact = false,
}: IntroOfferBannerProps) {
  const t = useTranslations("common")
  const countdown = useIntroOfferCountdown(introOffer?.expiresAt)

  if (!introOffer?.eligible) return null

  const discountPercent = introOffer.discountPercent ?? 40

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm ${className}`}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-medium">
          {t("intro_offer_title", { percent: discountPercent })}
        </span>
        {introOffer.expiresAt && (
          <span className="inline-flex items-center gap-1 text-xs text-primary">
            <Clock className="h-3 w-3" />
            {t("intro_offer_countdown", {
              days: countdown.days,
              hours: countdown.hours,
              minutes: countdown.minutes,
            })}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-background px-4 py-3 sm:px-5 sm:py-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-sm sm:text-base">
                {t("intro_offer_title", { percent: discountPercent })}
              </p>
              <Badge variant="secondary" className="text-xs font-semibold">
                {t("intro_offer_badge", { percent: discountPercent })}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("intro_offer_subtitle", { percent: discountPercent })}
            </p>
            {introOffer.expiresAt && (
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {t("intro_offer_countdown", {
                  days: countdown.days,
                  hours: countdown.hours,
                  minutes: countdown.minutes,
                })}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" asChild>
          <Link href={plansHref}>{t("intro_offer_view_all_plans")}</Link>
        </Button>
      </div>
    </div>
  )
}
