"use client"

import { useTranslations } from "next-intl"
import { formatPlanPrice } from "@/lib/pricing/country-pricing"
import { applyIntroDiscount } from "@/lib/pricing/intro-offer"
import type { IntroOfferStatus } from "@/lib/api/intro-offer"

interface IntroOfferPriceProps {
  amount: number
  currency: string
  introOffer?: IntroOfferStatus | null
  periodLabel?: string
  size?: "sm" | "lg"
  showBadge?: boolean
}

export function IntroOfferPrice({
  amount,
  currency,
  introOffer,
  periodLabel,
  size = "lg",
  showBadge = true,
}: IntroOfferPriceProps) {
  const tCommon = useTranslations("common")
  const introEligible = introOffer?.eligible === true && amount > 0
  const discountedAmount = applyIntroDiscount(amount, introEligible)
  const priceClass = size === "lg" ? "text-3xl font-extrabold tracking-tight" : "text-xl font-bold"
  const strikeClass = size === "lg" ? "text-lg" : "text-sm"

  if (!introEligible) {
    return (
      <div>
        <p className={priceClass}>{formatPlanPrice(amount, currency)}</p>
        {periodLabel && (
          <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={`${strikeClass} text-muted-foreground line-through`}>
          {formatPlanPrice(amount, currency)}
        </span>
        <span className={`${priceClass} text-primary`}>
          {formatPlanPrice(discountedAmount, currency)}
        </span>
      </div>
      {periodLabel && (
        <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
      )}
      {showBadge && (
        <p className="mt-1 text-xs font-medium text-primary/90">
          {tCommon("intro_offer_first_month_badge", {
            percent: introOffer?.discountPercent ?? 40,
          })}
        </p>
      )}
    </div>
  )
}
