"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal"
import { SubscribePlanModal } from "@/components/credits/SubscribePlanModal"
import {
  InsufficientCreditsDialog,
  type CreditGateFeature,
} from "@/components/credits/InsufficientCreditsDialog"
import { getCreditWallet, type CreditPack } from "@/lib/api/credits"
import {
  getCreditErrorMessage,
  isInsufficientCreditsError,
} from "@/lib/utils/credit-errors"

interface UseInsufficientCreditsGateOptions {
  feature: CreditGateFeature
  tenantId?: string
  countryCode?: string
  subscribeHref?: string
  /** How many credits this action costs — shown in the gate dialog as context. */
  requiredCredits?: number
}

export function useInsufficientCreditsGate({
  feature,
  tenantId,
  countryCode = "IN",
  subscribeHref,
  requiredCredits,
}: UseInsufficientCreditsGateOptions) {
  const t = useTranslations("credits.gate")
  const [gateOpen, setGateOpen] = useState(false)
  const [buyOpen, setBuyOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [walletCountry, setWalletCountry] = useState(countryCode)
  const [balance, setBalance] = useState<number | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [returnPath, setReturnPath] = useState("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReturnPath(window.location.pathname + window.location.search)
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  const prefetchWallet = useCallback(async () => {
    setLoadingBalance(true)
    try {
      const wallet = await getCreditWallet(tenantId)
      setPacks(wallet.packs)
      setWalletCountry(wallet.wallet.countryCode ?? countryCode)
      setBalance(wallet.wallet.creditsRemaining ?? wallet.wallet.balance ?? 0)
    } catch {
      setWalletCountry(countryCode)
      setBalance(null)
    } finally {
      setLoadingBalance(false)
    }
  }, [tenantId, countryCode])

  const openGate = useCallback(() => {
    setGateOpen(true)
    void prefetchWallet()
  }, [prefetchWallet])

  const openTopUp = useCallback(() => {
    setBuyOpen(true)
    if (packs.length === 0) {
      void prefetchWallet()
    }
  }, [packs.length, prefetchWallet])

  const openSubscribe = useCallback(() => {
    setSubscribeOpen(true)
  }, [])

  const handleApiError = useCallback(
    (error: unknown, fallbackMessage?: string): string => {
      if (!isInsufficientCreditsError(error)) {
        return fallbackMessage ?? getCreditErrorMessage(error)
      }
      openGate()
      return t("inlineMessage")
    },
    [openGate, t],
  )

  const gate = mounted ? (
    <>
      <InsufficientCreditsDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        feature={feature}
        balance={balance}
        loadingBalance={loadingBalance}
        onTopUp={() => {
          setGateOpen(false)
          openTopUp()
        }}
        onSubscribe={() => {
          setGateOpen(false)
          openSubscribe()
        }}
        subscribeHref={subscribeHref}
        requiredCredits={requiredCredits}
        packs={packs}
      />
      {buyOpen && (
        <BuyCreditsModal
          open={buyOpen}
          onOpenChange={setBuyOpen}
          packs={packs}
          countryCode={walletCountry}
          tenantId={tenantId}
          returnPath={returnPath}
          onSwitchToSubscription={() => {
            setBuyOpen(false)
            openSubscribe()
          }}
        />
      )}
      {subscribeOpen && (
        <SubscribePlanModal
          open={subscribeOpen}
          onOpenChange={setSubscribeOpen}
          countryCode={walletCountry}
          tenantId={tenantId}
          returnPath={returnPath}
          onSwitchToBuyCredits={() => {
            setSubscribeOpen(false)
            openTopUp()
          }}
        />
      )}
    </>
  ) : null

  return {
    gate,
    openGate,
    openTopUp,
    openSubscribe,
    handleApiError,
    isCreditError: isInsufficientCreditsError,
  }
}
