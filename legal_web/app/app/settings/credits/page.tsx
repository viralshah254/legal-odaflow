"use client"
import { useTranslations } from "next-intl"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"
import { RoleGate } from "@/components/dashboard/role-gate"
import { CreditUsageMeter } from "@/components/credits/CreditUsageMeter"
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal"
import { useTenant } from "@/lib/contexts/tenant-context"
import { getCreditWallet, getCreditLedger } from "@/lib/api/credits"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { getCreditPackValueHint } from "@/lib/pricing/credit-pack-hints"
import { formatWalletSegmentLabel } from "@/lib/pricing/plan-display"

function CreditsSettingsContent() {
  const t = useTranslations("settings")
  const tCommon = useTranslations("common")
  const { activeTenantId, activeTenant } = useTenant()
  const [buyOpen, setBuyOpen] = useState(false)

  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ["credit-wallet", activeTenantId],
    queryFn: () => getCreditWallet(activeTenantId!),
    enabled: !!activeTenantId,
  })

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["credit-ledger", activeTenantId],
    queryFn: () => getCreditLedger({ tenantId: activeTenantId!, limit: 50 }),
    enabled: !!activeTenantId,
  })

  if (!activeTenantId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t("select_an_active_firm_to_manage_credits")}</p>
      </div>
    )
  }

  if (walletLoading) {
    return (
      <div className="p-6">
        <PageSkeleton rows={6} />
      </div>
    )
  }

  const countryCode = walletData?.wallet.countryCode ?? activeTenant?.tenant.primaryCountry ?? "US"

  return (
    <RoleGate allowedRoles={["PARTNER_ADMIN", "FINANCE"]}>
      <div className="p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-4">
          <Link href="/app/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              AI Credits
            </h1>
            <p className="text-muted-foreground">{t("balance_usage_history_and_top-up_packs")}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("current_balance")}</CardTitle>
            <CardDescription>
              {formatWalletSegmentLabel(walletData?.wallet.userSegment)} · {countryCode}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreditUsageMeter tenantId={activeTenantId} />
          </CardContent>
        </Card>

        {walletData?.packs && walletData.packs.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>{t("credit_packs")}</CardTitle>
                  <CardDescription>{t("one-time_top-ups_for_your_firm_wallet")}</CardDescription>
                </div>
                <Button onClick={() => setBuyOpen(true)}>{tCommon("buy_credits")}</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                {walletData.packs.map((pack) => {
                  const valueHint = getCreditPackValueHint(pack.credits)
                  return (
                  <div key={pack.packId} className="rounded-lg border p-4 space-y-2">
                    <p className="font-medium">{pack.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {pack.credits} credits
                      {valueHint && <> · {valueHint}</>}
                    </p>
                    <p className="text-lg font-bold">
                      {pack.currency} {pack.amount}
                    </p>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setBuyOpen(true)}>
                      Buy
                    </Button>
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("usage_ledger")}</CardTitle>
            <CardDescription>{t("recent_credit_debits_and_top-ups")}</CardDescription>
          </CardHeader>
          <CardContent>
            {ledgerLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_ledger_entries_yet")}</p>
            ) : (
              <ul className="space-y-3">
                {ledger.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-4 border-b pb-3 text-sm">
                    <div>
                      <p className="font-medium">{entry.taskType.replace(/_/g, " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={entry.eventType === "CREDIT" ? "default" : "secondary"}>
                        {entry.eventType === "CREDIT" ? "+" : "−"}
                        {entry.credits}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <BuyCreditsModal
          open={buyOpen}
          onOpenChange={setBuyOpen}
          packs={walletData?.packs ?? []}
          countryCode={countryCode}
          tenantId={activeTenantId}
        />
      </div>
    </RoleGate>
  )
}

export default function CreditsSettingsPage() {
  const t = useTranslations("settings")
  return (
    <Suspense fallback={<div className="p-6 animate-pulse">{t("loading_credits")}</div>}>
      <CreditsSettingsContent />
    </Suspense>
  )
}
