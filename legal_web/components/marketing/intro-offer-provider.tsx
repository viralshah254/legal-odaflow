"use client"

import { IntroOfferDialog } from "@/components/marketing/intro-offer-dialog"
import { useIntroOfferPopup } from "@/lib/hooks/use-intro-offer"

export function IntroOfferProvider() {
  const { open, onOpenChange, introOffer } = useIntroOfferPopup()

  return (
    <IntroOfferDialog
      open={open}
      onOpenChange={onOpenChange}
      introOffer={introOffer}
    />
  )
}
