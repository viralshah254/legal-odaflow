"use client"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import {
  Sparkles,
  Zap,
  Crown,
  CreditCard,
  Loader2,
  ExternalLink,
  AlertTriangle,
  BadgeCheck,
  ArrowUpRight,
  User,
  Building2,
  Briefcase,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  type CreditPack,
  type CreditWallet,
  updateAiPreferences,
} from "@/lib/api/credits"
import { openBillingPortal } from "@/lib/api/billing"
import { BuyCreditsModal } from "./BuyCreditsModal"
import { BoostPlanModal } from "./BoostPlanModal"
import { ChangePlanModal } from "./ChangePlanModal"
import { IntroOfferBanner } from "@/components/marketing/intro-offer-banner"
import type { IntroOfferStatus } from "@/lib/api/intro-offer"

// ─── helpers ────────────────────────────────────────────────────────────────

function tierLabel(tier: string | undefined): string {
  switch (tier) {
    case "fast": return "Fast"
    case "standard": return "Standard"
    case "heavy": return "Heavy"
    case "ultra": return "Ultra"
    default: return ""
  }
}

function tierBadgeClass(tier: string | undefined): string {
  switch (tier) {
    case "fast": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
    case "standard": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
    case "heavy": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
    case "ultra": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    default: return "bg-muted text-muted-foreground"
  }
}

function cardBrandIcon(brand?: string): string {
  switch (brand?.toLowerCase()) {
    case "visa": return "💳 Visa"
    case "mastercard": return "💳 Mastercard"
    case "amex": return "💳 Amex"
    default: return "💳 Card"
  }
}

function estimateCreditsPerMessage(model?: NonNullable<CreditWallet["availablePremiumModels"]>[0]): number | null {
  if (!model) return null
  if (model.estimatedCreditsTypical) return model.estimatedCreditsTypical
  if (model.inputPer1M && model.outputPer1M) {
    const costUsd = (2500 / 1_000_000) * model.inputPer1M + (800 / 1_000_000) * model.outputPer1M
    return Math.max(1, Math.ceil(costUsd / 0.01))
  }
  return null
}

type UserType = "CONSUMER" | "SOLO" | "FIRM"

function deriveUserType(segment: string | undefined): UserType {
  if (!segment) return "FIRM"
  if (segment.startsWith("CONSUMER")) return "CONSUMER"
  if (segment === "LAWYER_SOLO") return "SOLO"
  return "FIRM"
}

function isFreeLawyerWallet(wallet: CreditWallet, userType: UserType): boolean {
  if (userType !== "SOLO" && userType !== "FIRM") return false
  if (wallet.hasActiveSubscription === true) return false
  if (wallet.hasActiveSubscription === false) return true
  return (wallet.planMonthlyPrice ?? 0) === 0
}

function userTypeIcon(type: UserType) {
  switch (type) {
    case "CONSUMER": return User
    case "SOLO": return Briefcase
    case "FIRM": return Building2
  }
}

// Approximate USD-to-local rate derived from existing pack pricing
function inferUsdToLocalRate(packs: CreditPack[]): number {
  const ref = packs.find((p) => p.packId === "pack_10")
  if (!ref || ref.currency === "USD") return 1
  // Use the actual USD price from the backend (pack_10 = $4.99, not $10)
  const refUsd = ref.usdPrice ?? 10
  return ref.amount / refUsd
}

// ─── props ───────────────────────────────────────────────────────────────────

interface PlanUsagePanelProps {
  wallet: CreditWallet
  packs: CreditPack[]
  tenantId?: string
  countryCode: string
  planLabel?: string
  introOffer?: IntroOfferStatus | null
}

// ─── component ───────────────────────────────────────────────────────────────

export function PlanUsagePanel({
  wallet,
  packs,
  tenantId,
  countryCode,
  planLabel: planLabelProp,
  introOffer,
}: PlanUsagePanelProps) {
  const t = useTranslations("common")
  const tSettings = useTranslations("settings")
  const tCopilot = useTranslations("copilot")
  const queryClient = useQueryClient()

  const [buyOpen, setBuyOpen] = useState(false)
  const [boostOpen, setBoostOpen] = useState(false)
  const [changePlanOpen, setChangePlanOpen] = useState(false)
  const [modelMode, setModelMode] = useState<"AUTO" | "PREMIUM">(wallet.aiModelMode ?? "AUTO")
  const [premiumModelId, setPremiumModelId] = useState(wallet.premiumModelId ?? "gpt-5.6-sol")
  const [deepAnalysisPremiumModelId, setDeepAnalysisPremiumModelId] = useState(
    wallet.deepAnalysisPremiumModelId ?? wallet.premiumModelId ?? "gpt-5.6-sol",
  )
  const [autoTopUpEnabled, setAutoTopUpEnabled] = useState(wallet.autoTopUp?.enabled ?? false)
  const [autoTopUpThreshold, setAutoTopUpThreshold] = useState(
    String(wallet.autoTopUp?.threshold ?? 10),
  )
  const [autoTopUpPackId, setAutoTopUpPackId] = useState(wallet.autoTopUp?.packId ?? "pack_25")
  const [portalLoading, setPortalLoading] = useState(false)
  const [paymentMethodLoading, setPaymentMethodLoading] = useState(false)

  const userType = deriveUserType(wallet.userSegment)
  const TypeIcon = userTypeIcon(userType)
  const isFreeLawyerTier = isFreeLawyerWallet(wallet, userType)
  const isPaidTier =
    userType === "CONSUMER"
      ? wallet.userSegment === "CONSUMER_PLUS" || wallet.hasActiveSubscription === true
      : !isFreeLawyerTier
  const activePlanCardClass = cn(
    isPaidTier && "border-primary/30 bg-primary/[0.02] shadow-sm ring-1 ring-primary/10",
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["credit-wallet"] })
    queryClient.invalidateQueries({ queryKey: ["plan-usage"] })
    queryClient.invalidateQueries({ queryKey: ["credit-wallet-meter"] })
  }

  const savePrefs = useMutation({
    mutationFn: () =>
      updateAiPreferences(
        {
          aiModelMode: modelMode,
          premiumModelId,
          deepAnalysisPremiumModelId,
          autoTopUpEnabled,
          autoTopUpThresholdCredits: Number(autoTopUpThreshold) || 10,
          autoTopUpPackId,
        },
        tenantId,
      ),
    onSuccess: invalidate,
  })

  const handleManageBilling = async () => {
    if (!tenantId) return
    setPortalLoading(true)
    try {
      const result = await openBillingPortal(tenantId)
      if (result.url) window.open(result.url, "_blank")
    } catch {
      window.open("/pricing", "_blank")
    } finally {
      setPortalLoading(false)
    }
  }

  // Opens Stripe Customer Portal to add/change payment method for auto top-up.
  const handleManagePaymentMethod = async () => {
    setPaymentMethodLoading(true)
    try {
      const result = await openBillingPortal(tenantId ?? "")
      if (result.url) window.open(result.url, "_blank")
    } catch {
      // Fallback: open pricing page if portal unavailable
      window.open("/pricing", "_blank")
    } finally {
      setPaymentMethodLoading(false)
    }
  }

  const cycleReset = wallet.cycleEndAt
    ? format(new Date(wallet.cycleEndAt), "MMM d, yyyy")
    : null

  const planLabel = isFreeLawyerTier
    ? tSettings("planUsageFreePlan")
    : (planLabelProp ?? wallet.planLabel ?? wallet.userSegment)
  const creditsUsed = wallet.creditsUsedThisCycle ?? wallet.usedCreditsThisCycle ?? 0
  const isExhausted = wallet.percentUsed >= 100
  const packageCreditsRemaining =
    wallet.packageCreditsRemaining ??
    Math.max(0, Math.min(wallet.creditsRemaining, wallet.planCreditsMonthly - creditsUsed))
  const onDemandCreditsRemaining =
    wallet.onDemandCreditsRemaining ?? wallet.onDemandCredits ?? 0
  const hasOnDemand = onDemandCreditsRemaining > 0
  const usdToLocalRate = inferUsdToLocalRate(packs)

  const activePremiumModel = wallet.availablePremiumModels?.find((m) => m.modelId === premiumModelId)
  const creditsPerMsgPremium = estimateCreditsPerMessage(activePremiumModel)
  const creditsPerMsgAuto = (() => {
    const autoModel = wallet.availablePremiumModels?.find((m) => m.modelId === wallet.autoModelName)
    return estimateCreditsPerMessage(autoModel) ?? 2
  })()
  const messagesLeftAuto = creditsPerMsgAuto > 0 ? Math.floor(wallet.creditsRemaining / creditsPerMsgAuto) : null
  const messagesLeftPremium = creditsPerMsgPremium && creditsPerMsgPremium > 0
    ? Math.floor(wallet.creditsRemaining / creditsPerMsgPremium)
    : null

  // ── shared sub-sections ──────────────────────────────────────────────────

  const creditUsageCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>{planLabel}</span>
          {cycleReset && (
            <span className="text-sm font-normal text-muted-foreground">
              {tSettings("planUsageResetsOn", { date: cycleReset })}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {isFreeLawyerTier
            ? tSettings("planUsageFreeCreditsRemaining", {
                remaining: wallet.creditsRemaining.toLocaleString(),
              })
            : tSettings("planUsageCreditsRemaining", {
                remaining: packageCreditsRemaining.toLocaleString(),
              })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("included_usage")}</span>
            <span className="font-medium">{wallet.percentUsed}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                wallet.percentUsed >= 90 ? "bg-destructive" : wallet.percentUsed >= 70 ? "bg-amber-500" : "bg-primary",
              )}
              style={{ width: `${Math.min(100, wallet.percentUsed)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isFreeLawyerTier
              ? tSettings("planUsageFreeCreditsDescription", {
                  count: wallet.planCreditsMonthly.toLocaleString(),
                })
              : `${creditsUsed.toLocaleString()} of ${wallet.planCreditsMonthly.toLocaleString()} credits used this cycle`}
          </p>
        </div>
      </CardContent>
    </Card>
  )

  const topUpCard = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{t("on-demand_credits")}</CardTitle>
            <CardDescription>{t("top_up_anytime_credits_never_expire")}</CardDescription>
          </div>
          <Button onClick={() => setBuyOpen(true)}>{t("top_up")}</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{onDemandCreditsRemaining.toLocaleString()}</p>
        <p className="text-sm text-muted-foreground mt-1">on-demand credits · never expire</p>
        {packageCreditsRemaining > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Plus {packageCreditsRemaining.toLocaleString()} package credits this cycle
          </p>
        )}
      </CardContent>
    </Card>
  )

  const autoTopUpCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Auto top-up via Stripe
        </CardTitle>
        <CardDescription>
          Automatically purchase credits when your balance drops below a threshold. Secured by Stripe — your card is never stored on our servers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={autoTopUpEnabled}
            onChange={(e) => setAutoTopUpEnabled(e.target.checked)}
            className="rounded border-input"
          />
          Enable auto top-up
        </label>

        {autoTopUpEnabled && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold">{t("threshold_credits")}</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  value={autoTopUpThreshold}
                  onChange={(e) => setAutoTopUpThreshold(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pack">{t("top-up_pack")}</Label>
                <select
                  id="pack"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={autoTopUpPackId}
                  onChange={(e) => setAutoTopUpPackId(e.target.value)}
                >
                  {packs.map((p) => (
                    <option key={p.packId} value={p.packId}>
                      {p.label} — {p.credits} credits ({p.currency} {p.amount})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {wallet.autoTopUp?.hasPaymentMethod ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-700 border-green-300 dark:text-green-400 dark:border-green-700">
                    <BadgeCheck className="h-3 w-3 mr-1" />
                    {wallet.autoTopUp.cardBrand && wallet.autoTopUp.cardLast4
                      ? `${cardBrandIcon(wallet.autoTopUp.cardBrand)} ···· ${wallet.autoTopUp.cardLast4}`
                      : "Payment method saved"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={handleManagePaymentMethod}
                    disabled={paymentMethodLoading}
                  >
                    {paymentMethodLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Change
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManagePaymentMethod}
                  disabled={paymentMethodLoading}
                >
                  {paymentMethodLoading
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <CreditCard className="h-4 w-4 mr-2" />}
                  Add card via Stripe
                </Button>
              )}
              <Button
                variant="link"
                size="sm"
                className="h-7 text-xs px-0"
                onClick={handleManagePaymentMethod}
                disabled={paymentMethodLoading}
              >
                Manage payment methods
              </Button>
            </div>
          </>
        )}

        {autoTopUpEnabled && !wallet.autoTopUp?.hasPaymentMethod && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Add a payment method to activate auto top-up.
          </div>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={() => savePrefs.mutate()}
          disabled={savePrefs.isPending}
        >
          {savePrefs.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
          Save auto top-up settings
        </Button>
      </CardContent>
    </Card>
  )

  const aiModelCard = (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {tSettings("planUsageAiModelTitle")}
        </CardTitle>
        <CardDescription>
          Choose your model. Credits are charged by actual tokens used — heavier models cost more per response.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          {(["AUTO", "PREMIUM"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={modelMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => setModelMode(mode)}
              className="gap-1.5"
            >
              {mode === "AUTO" ? <Zap className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
              {mode === "AUTO" ? tCopilot("modelAuto") : tCopilot("modelPremium")}
            </Button>
          ))}
        </div>

        {modelMode === "AUTO" && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Model: <span className="font-medium">{wallet.autoModelName ?? "gpt-5.4-mini"}</span></p>
            {messagesLeftAuto != null && (
              <p>~{creditsPerMsgAuto} credits / message · <span className="font-medium">{messagesLeftAuto.toLocaleString()} messages left</span></p>
            )}
          </div>
        )}

        {modelMode === "PREMIUM" && (
          <div className="space-y-2">
            <Label htmlFor="premium-model">{t("copilot_research_model")}</Label>
            <select
              id="premium-model"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={premiumModelId}
              onChange={(e) => setPremiumModelId(e.target.value)}
            >
              {(wallet.availablePremiumModels ?? [{ modelId: "gpt-5.6-sol", label: "GPT-5.6 Sol" }]).map(
                (m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.label}
                    {"costTier" in m && m.costTier ? ` · ${tierLabel(m.costTier as string)}` : ""}
                  </option>
                ),
              )}
            </select>
            {(() => {
              const active = wallet.availablePremiumModels?.find((m) => m.modelId === premiumModelId)
              const tier = active && "costTier" in active ? active.costTier as string : undefined
              const credPerMsg = estimateCreditsPerMessage(active)
              const msgsLeft = credPerMsg != null && credPerMsg > 0
                ? Math.floor(wallet.creditsRemaining / credPerMsg)
                : null
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {tier && (
                    <span className={cn("text-xs font-semibold rounded px-1.5 py-0.5", tierBadgeClass(tier))}>
                      {tierLabel(tier)}
                    </span>
                  )}
                  {credPerMsg != null && (
                    <span className="text-xs text-muted-foreground">~{credPerMsg} credits / message</span>
                  )}
                  {msgsLeft != null && (
                    <span className="text-xs font-medium">· {msgsLeft.toLocaleString()} messages left</span>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        <div className="space-y-2 pt-2 border-t">
          <Label htmlFor="deep-analysis-model" className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
            Deep analysis model
            <span className="text-xs font-normal text-muted-foreground">
              (Similar Cases, Opponent, Strategy Memo)
            </span>
          </Label>
          <select
            id="deep-analysis-model"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={deepAnalysisPremiumModelId}
            onChange={(e) => setDeepAnalysisPremiumModelId(e.target.value)}
          >
            {(wallet.availablePremiumModels ?? [{ modelId: "gpt-5.6-sol", label: "GPT-5.6 Sol" }]).map(
              (m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.label}
                  {"costTier" in m && m.costTier ? ` · ${tierLabel(m.costTier as string)}` : ""}
                </option>
              ),
            )}
          </select>
          <p className="text-xs text-muted-foreground">
            Deep analysis always uses Premium mode regardless of your Copilot setting.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => savePrefs.mutate()}
          disabled={savePrefs.isPending}
        >
          {savePrefs.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save model settings
        </Button>
      </CardContent>
    </Card>
  )

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6 max-w-5xl">

        {isFreeLawyerTier && introOffer?.eligible && (
          <IntroOfferBanner introOffer={introOffer} plansHref="/pricing" />
        )}

        {/* ── Exhaustion alert ─────────────────────────────────────────── */}
        {isExhausted && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Your included credits are used up
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {hasOnDemand
                  ? `On-demand credits are now active — you have ${onDemandCreditsRemaining.toLocaleString()} credits remaining.`
                  : !autoTopUpEnabled
                  ? "Enable auto top-up below so you never hit a wall, or top up now."
                  : !wallet.autoTopUp?.hasPaymentMethod
                  ? "Add a payment method to activate auto top-up."
                  : "Auto top-up is active and will refill your balance automatically."}
              </p>
            </div>
            {!hasOnDemand && !autoTopUpEnabled && (
              <Button size="sm" variant="outline" onClick={() => setBuyOpen(true)} className="shrink-0 text-amber-800 border-amber-400 hover:bg-amber-100">
                Top up
              </Button>
            )}
          </div>
        )}

        {/* ── CONSUMER layout ───────────────────────────────────────────── */}
        {userType === "CONSUMER" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              {/* Plan card */}
              <Card className={activePlanCardClass}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{planLabel}</CardTitle>
                        {isFreeLawyerTier ? (
                          <Badge variant="secondary" className="text-[11px] py-0">
                            {tSettings("planUsageFreeBadge")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-green-700 border-green-300 dark:text-green-400 dark:border-green-700 py-0">
                            <BadgeCheck className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {isFreeLawyerTier
                          ? tSettings("planUsageFreeCreditsDescription", {
                              count: wallet.planCreditsMonthly.toLocaleString(),
                            })
                          : tSettings("planUsageActivePlanDescription", {
                              credits: wallet.planCreditsMonthly.toLocaleString(),
                            })}
                        {!isFreeLawyerTier && cycleReset ? ` · ${tSettings("planUsageResetsOn", { date: cycleReset })}` : ""}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {wallet.userSegment === "CONSUMER_FREE" && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => window.open("/consumer/subscription", "_self")}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Upgrade to Consumer Plus
                    </Button>
                  )}
                </CardContent>
              </Card>

              {creditUsageCard}
            </div>

            <div className="space-y-6">
              {topUpCard}
              {autoTopUpCard}
            </div>
          </div>
        )}

        {/* ── SOLO layout ───────────────────────────────────────────────── */}
        {userType === "SOLO" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              {/* Plan card */}
              <Card className={activePlanCardClass}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{planLabel}</CardTitle>
                        {isFreeLawyerTier ? (
                          <Badge variant="secondary" className="text-[11px] py-0">
                            {tSettings("planUsageFreeBadge")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-green-700 border-green-300 dark:text-green-400 dark:border-green-700 py-0">
                            <BadgeCheck className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {isFreeLawyerTier
                          ? tSettings("planUsageFreeCreditsDescription", {
                              count: wallet.planCreditsMonthly.toLocaleString(),
                            })
                          : tSettings("planUsageActivePlanDescription", {
                              credits: wallet.planCreditsMonthly.toLocaleString(),
                            })}
                        {!isFreeLawyerTier && cycleReset ? ` · ${tSettings("planUsageResetsOn", { date: cycleReset })}` : ""}
                      </CardDescription>
                      {wallet.planMonthlyPrice != null && wallet.planMonthlyPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {wallet.planCurrency ?? ""} {wallet.planMonthlyPrice.toLocaleString()} / month · solo bundle
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setChangePlanOpen(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isFreeLawyerTier ? t("subscribe_now") : "Change plan"}
                    </Button>
                    {!isFreeLawyerTier && tenantId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                      >
                        {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                        Manage billing
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {creditUsageCard}
              {aiModelCard}
            </div>

            <div className="space-y-6">
              {topUpCard}
              {autoTopUpCard}
            </div>
          </div>
        )}

        {/* ── FIRM layout ───────────────────────────────────────────────── */}
        {userType === "FIRM" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">
              {/* Plan card */}
              <Card className={activePlanCardClass}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{planLabel}</CardTitle>
                        {isFreeLawyerTier ? (
                          <Badge variant="secondary" className="text-[11px] py-0">
                            {tSettings("planUsageFreeBadge")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-green-700 border-green-300 dark:text-green-400 dark:border-green-700 py-0">
                            <BadgeCheck className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {isFreeLawyerTier
                          ? tSettings("planUsageFreeCreditsDescription", {
                              count: wallet.planCreditsMonthly.toLocaleString(),
                            })
                          : tSettings("planUsageActivePlanDescription", {
                              credits: wallet.planCreditsMonthly.toLocaleString(),
                            })}
                        {!isFreeLawyerTier && cycleReset ? ` · ${tSettings("planUsageResetsOn", { date: cycleReset })}` : ""}
                      </CardDescription>
                      {wallet.planMonthlyPrice != null && wallet.planMonthlyPrice > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {wallet.planCurrency ?? ""} {wallet.planMonthlyPrice.toLocaleString()} / month
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setChangePlanOpen(true)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isFreeLawyerTier ? t("subscribe_now") : "Change plan"}
                    </Button>
                    {!isFreeLawyerTier && tenantId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                      >
                        {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                        Manage billing
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {creditUsageCard}
              {aiModelCard}
            </div>

            <div className="space-y-6">
              {topUpCard}

              {/* Boost plan — firm only */}
              {wallet.boostAvailable && (
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-4 w-4 text-primary" />
                      Double your credits
                    </CardTitle>
                    <CardDescription>
                      Get +{wallet.planCreditsMonthly.toLocaleString()} credits now, charged at a pro-rated price for the rest of the cycle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => setBoostOpen(true)}>
                      <Zap className="h-4 w-4 mr-2" />
                      Boost this cycle
                    </Button>
                  </CardContent>
                </Card>
              )}

              {autoTopUpCard}
            </div>
          </div>
        )}
      </div>

      <BuyCreditsModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        packs={packs}
        countryCode={countryCode}
        tenantId={tenantId}
        localCurrency={wallet.currency}
        usdToLocalRate={usdToLocalRate}
      />

      <BoostPlanModal
        open={boostOpen}
        onOpenChange={setBoostOpen}
        planLabel={planLabel}
        planCredits={wallet.planCreditsMonthly}
        planMonthlyPrice={wallet.planMonthlyPrice ?? 0}
        planCurrency={wallet.planCurrency ?? wallet.currency ?? "USD"}
        cycleStartAt={wallet.cycleStartAt}
        cycleEndAt={wallet.cycleEndAt}
        tenantId={tenantId}
        onSuccess={invalidate}
      />

      <ChangePlanModal
        open={changePlanOpen}
        onOpenChange={setChangePlanOpen}
        countryCode={countryCode}
        tenantId={tenantId}
        hasActiveSubscription={wallet.hasActiveSubscription}
        userSegment={wallet.billingPlan ?? wallet.userSegment}
        returnPath={typeof window !== "undefined" ? window.location.pathname : undefined}
        introOffer={introOffer}
      />
    </>
  )
}
