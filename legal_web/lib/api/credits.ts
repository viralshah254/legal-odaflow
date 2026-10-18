import { apiFetch, ApiClientError } from "./client"
import {
  getConsumerCredits,
  startCreditTopupCheckout as startConsumerCreditTopup,
  type ConsumerCreditsResponse,
  type CreditTopupCheckoutRequest,
  type CreditTopupCheckoutResponse,
} from "./consumers"

export interface CreditWallet {
  balance: number
  planCreditsMonthly: number
  /** User-facing unified usage (auto + premium combined). */
  creditsUsedThisCycle: number
  /** @deprecated use creditsUsedThisCycle */
  usedCreditsThisCycle?: number
  cycleStartAt: string | null
  cycleEndAt: string | null
  userSegment: string
  countryCode: string
  currency: string
  percentUsed: number
  creditsRemaining: number
  /** Human-readable plan name, e.g. "Professional" */
  planLabel?: string
  /** Normalized billing plan enum, e.g. "PROFESSIONAL", "PRO_PLUS". Use this for plan-card comparison in the UI. */
  billingPlan?: string
  planMonthlyPrice?: number
  planCurrency?: string
  annualPlanAvailable?: boolean
  /** True when the tenant/user has an active paid subscription. */
  hasActiveSubscription?: boolean
  boostAvailable?: boolean
  /** Included plan credits remaining this cycle. */
  packageCreditsRemaining?: number
  /** Purchased top-up balance (separate from plan allowance). */
  onDemandCreditsRemaining?: number
  /** @deprecated use onDemandCreditsRemaining */
  onDemandCredits?: number
  aiModelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
  deepAnalysisPremiumModelId?: string
  autoTopUp?: {
    enabled: boolean
    threshold: number
    packId: string
    hasPaymentMethod: boolean
    cardLast4?: string
    cardBrand?: string
  }
  availablePremiumModels?: Array<{
    modelId: string
    label: string
    creditMultiplier?: number
    estimatedCreditsTypical?: number
    inputPer1M?: number
    outputPer1M?: number
  }>
  autoModelName?: string
  estimatedCreditsByTask?: {
    similarCases?: number
    opponentAngles?: number
    strategyMemo?: number
    legalResearch?: number
    copilot?: number
  }
  /** Internal analytics breakdown — available for PARTNER_ADMIN use only, not rendered in user UI. */
  _internal?: {
    autoCreditsUsedThisCycle: number
    premiumCreditsUsedThisCycle: number
    premiumAllowanceCredits: number
    premiumAllowanceRemaining: number
    autoPercentUsed: number
    premiumPercentUsed: number
  }
}

export interface AiPreferencesInput {
  aiModelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
  deepAnalysisPremiumModelId?: string
  autoTopUpEnabled?: boolean
  autoTopUpThresholdCredits?: number
  autoTopUpPackId?: string
}

export interface CreditPack {
  packId: string
  credits: number
  label: string
  description: string
  countryCode: string
  currency: string
  amount: number
  /** USD base price used to compute local amount — used for accurate FX rate inference. */
  usdPrice?: number
}

export interface CreditLedgerEntry {
  id: string
  eventType: string
  taskType: string
  credits: number
  createdAt: string
  costUsd?: number | null
}

export interface CreditWalletResponse {
  wallet: CreditWallet
  packs: CreditPack[]
}

export interface CreditEstimateRequest {
  taskType: string
  userSegment?: string
  modelMode?: "AUTO" | "PREMIUM"
  premiumModelId?: string
}

export interface CreditEstimateResponse {
  taskType: string
  estimatedCredits: number
  estimatedProviderCostUsd?: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  netMarginPercent?: number
  modelTier: string
  modelName: string
  modelMode?: "AUTO" | "PREMIUM"
  premiumFallback?: boolean
  requiresConfirmation: boolean
  balance: number
  balanceAfter: number
  sufficient: boolean
  premiumAllowanceRemaining?: number
  topUpBalance?: number
  blockedReason?: string
}

const COUNTRY_CURRENCY: Record<string, string> = {
  IN: "INR",
  US: "USD",
  KE: "KES",
  GB: "GBP",
}

function normalizeConsumerCredits(data: ConsumerCreditsResponse): CreditWalletResponse {
  const debits = data.ledger.filter((e) => e.eventType === "DEBIT")
  const usedCreditsThisCycle = debits.reduce((sum, e) => sum + e.credits, 0)
  const planCreditsMonthly = Math.max(data.balance + usedCreditsThisCycle, data.balance)
  const percentUsed =
    planCreditsMonthly > 0
      ? Math.min(100, Math.round((usedCreditsThisCycle / planCreditsMonthly) * 100))
      : 0

  return {
    wallet: {
      balance: data.balance,
      planCreditsMonthly,
      creditsUsedThisCycle: usedCreditsThisCycle,
      usedCreditsThisCycle,
      cycleStartAt: null,
      cycleEndAt: null,
      userSegment: "CONSUMER",
      countryCode: data.countryCode,
      currency: COUNTRY_CURRENCY[data.countryCode] ?? "USD",
      percentUsed,
      creditsRemaining: data.balance,
    },
    packs: data.packs,
  }
}

export async function getCreditWallet(tenantId?: string): Promise<CreditWalletResponse> {
  if (tenantId) {
    try {
      return await apiFetch<CreditWalletResponse>("/credits/plan-usage", { tenantId })
    } catch {
      try {
        return await apiFetch<CreditWalletResponse>("/credits/wallet", { tenantId })
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 404) {
          const tenantCredits = await apiFetch<CreditWalletResponse>("/tenants/me/credits", {
            tenantId,
          })
          return tenantCredits
        }
        throw err
      }
    }
  }

  try {
    return await apiFetch<CreditWalletResponse>("/credits/plan-usage")
  } catch {
    try {
      return await apiFetch<CreditWalletResponse>("/credits/wallet")
    } catch {
      const consumer = await getConsumerCredits()
      return normalizeConsumerCredits(consumer)
    }
  }
}

export async function getPlanUsage(tenantId?: string): Promise<CreditWalletResponse> {
  return getCreditWallet(tenantId)
}

export async function updateAiPreferences(
  data: AiPreferencesInput,
  tenantId?: string,
): Promise<AiPreferencesInput & { hasPaymentMethod?: boolean; availablePremiumModels?: CreditWallet["availablePremiumModels"] }> {
  return apiFetch("/credits/ai-preferences", {
    method: "PATCH",
    tenantId,
    body: data,
  })
}

export async function setupAutoTopUp(tenantId?: string): Promise<{ clientSecret: string; setupIntentId: string }> {
  return apiFetch("/credits/auto-topup/setup-intent", {
    method: "POST",
    tenantId,
  })
}

export async function confirmAutoTopUp(
  paymentMethodId: string,
  tenantId?: string,
): Promise<{ success: boolean; hasPaymentMethod: boolean }> {
  return apiFetch("/credits/auto-topup/confirm", {
    method: "POST",
    tenantId,
    body: { paymentMethodId },
  })
}

export async function removePaymentMethod(
  tenantId?: string,
): Promise<{ success: boolean; hasPaymentMethod: boolean }> {
  return apiFetch("/credits/auto-topup/payment-method", {
    method: "DELETE",
    tenantId,
  })
}

export async function getCreditLedger(
  params: { tenantId?: string; limit?: number } = {},
): Promise<CreditLedgerEntry[]> {
  const limit = params.limit ?? 50
  try {
    return await apiFetch<CreditLedgerEntry[]>(
      `/credits/ledger?limit=${limit}`,
      { tenantId: params.tenantId },
    )
  } catch {
    if (params.tenantId) {
      const wallet = await getCreditWallet(params.tenantId)
      void wallet
    }
    const consumer = await getConsumerCredits()
    return consumer.ledger
  }
}

export async function estimateCreditTask(
  data: CreditEstimateRequest,
  tenantId?: string,
): Promise<CreditEstimateResponse> {
  try {
    return await apiFetch<CreditEstimateResponse>("/credits/estimate-task", {
      method: "POST",
      tenantId,
      body: data,
    })
  } catch {
    return apiFetch<CreditEstimateResponse>("/ai/estimate", {
      method: "POST",
      tenantId,
      body: data,
    })
  }
}

export async function startCreditTopupCheckout(
  data: CreditTopupCheckoutRequest,
  tenantId?: string,
): Promise<CreditTopupCheckoutResponse> {
  if (tenantId) {
    return apiFetch<CreditTopupCheckoutResponse>("/tenants/credits/topup/checkout", {
      method: "POST",
      tenantId,
      body: data,
    })
  }
  return startConsumerCreditTopup(data)
}

export interface PlanBoostResult {
  checkoutUrl?: string
  proRatedPrice: number
  currency: string
  planCredits: number
  daysRemaining: number
}

export async function boostPlan(tenantId?: string): Promise<PlanBoostResult> {
  return apiFetch<PlanBoostResult>("/credits/boost-plan", {
    method: "POST",
    tenantId,
  })
}

// Admin APIs (Phase 6)

export interface AiProfitabilityRow {
  taskType: string
  countryCode: string
  userSegment: string
  totalCreditsCharged: number
  totalCreditValueUsd: number
  totalActualCostUsd: number
  platformMarginUsd: number
  grossMarginPercent: number
  requestCount: number
}

export interface AiCreditRateRow {
  id: string
  taskType: string
  countryCode?: string | null
  userSegment: string
  baseCredits: number
  minCredits: number
  maxCredits: number
  modelTier: string
  markupMultiplier: number
  enabled: boolean
}

export interface AiModelCostRow {
  id: string
  provider: string
  modelName: string
  modelTier: string
  inputCostPer1M: number
  outputCostPer1M: number
  cachedInputCostPer1M?: number | null
  currency: string
  isActive: boolean
}

export async function getAdminAiProfitability(): Promise<AiProfitabilityRow[]> {
  return apiFetch<AiProfitabilityRow[]>("/admin/ai/profitability")
}

export async function listAdminCreditRates(): Promise<AiCreditRateRow[]> {
  return apiFetch<AiCreditRateRow[]>("/admin/credit-rates")
}

export async function listAdminModelCosts(): Promise<AiModelCostRow[]> {
  return apiFetch<AiModelCostRow[]>("/admin/ai-model-costs")
}

export async function updateAdminCreditRate(
  id: string,
  data: Partial<Pick<AiCreditRateRow, "baseCredits" | "enabled" | "markupMultiplier">>,
): Promise<AiCreditRateRow> {
  return apiFetch<AiCreditRateRow>(`/admin/credit-rates/${id}`, {
    method: "PATCH",
    body: data,
  })
}

export async function updateAdminModelCost(
  id: string,
  data: Partial<Pick<AiModelCostRow, "inputCostPer1M" | "outputCostPer1M" | "isActive">>,
): Promise<AiModelCostRow> {
  return apiFetch<AiModelCostRow>(`/admin/ai-model-costs/${id}`, {
    method: "PATCH",
    body: data,
  })
}
