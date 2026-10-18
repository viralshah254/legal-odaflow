import { PRICING_PLANS, resolveLawyerSignupCredits } from './pricing.config';

/** Canonical tenant billing plan values stored on Tenant.billingPlan */
export const TENANT_BILLING_PLANS = {
  SOLO: 'SOLO',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  PRO_PLUS: 'PRO_PLUS',
  ENTERPRISE: 'ENTERPRISE',
  TRIAL: 'TRIAL_PENDING_PAYMENT',
} as const;

export type TenantBillingPlan =
  (typeof TENANT_BILLING_PLANS)[keyof typeof TENANT_BILLING_PLANS];

/** Target net margin on AI usage by plan (after provider costs).
 *  Higher-tier plans get a lower margin, meaning more credits per dollar spent.
 *  This creates a natural upgrade incentive without changing list prices.
 *  Minimum 50% net usage margin across all plans. */
export const PLAN_NET_MARGIN_PERCENT: Record<string, number> = {
  [TENANT_BILLING_PLANS.ENTERPRISE]: 50,
  [TENANT_BILLING_PLANS.PRO_PLUS]: 55,
  [TENANT_BILLING_PLANS.PROFESSIONAL]: 60,
  [TENANT_BILLING_PLANS.STARTER]: 65,
  [TENANT_BILLING_PLANS.SOLO]: 65,
  [TENANT_BILLING_PLANS.TRIAL]: 65,
  consumer_plus: 65,
  consumer_free: 70,
  DEFAULT: 50,
};

const PLAN_ID_TO_BILLING: Record<string, TenantBillingPlan> = {
  [PRICING_PLANS.FIRM_SOLO_ENTRY]: TENANT_BILLING_PLANS.SOLO,
  [PRICING_PLANS.LAWYER_SOLO]: TENANT_BILLING_PLANS.SOLO,
  [PRICING_PLANS.FIRM_STARTER]: TENANT_BILLING_PLANS.STARTER,
  [PRICING_PLANS.FIRM_PROFESSIONAL]: TENANT_BILLING_PLANS.PROFESSIONAL,
  [PRICING_PLANS.FIRM_PRO_PLUS]: TENANT_BILLING_PLANS.PRO_PLUS,
  [PRICING_PLANS.FIRM_ENTERPRISE]: TENANT_BILLING_PLANS.ENTERPRISE,
  consumer_free: TENANT_BILLING_PLANS.STARTER,
  consumer_plus: TENANT_BILLING_PLANS.PROFESSIONAL,
  LAWYER_SOLO: TENANT_BILLING_PLANS.SOLO,
};

/**
 * Canonical monthly AI credit allowances per plan — single source of truth.
 * Derived from plan price × (1 − 40% margin) / $0.06 per credit.
 * SOLO $40 → 400, STARTER $40 → 400, PROFESSIONAL $80 → 800,
 * PRO_PLUS $200 → 2000. Used as display fallback when no active subscription.
 */
export const PLAN_CREDIT_ALLOWANCES: Record<string, number> = {
  [TENANT_BILLING_PLANS.SOLO]: 400,
  [TENANT_BILLING_PLANS.STARTER]: 400,
  [TENANT_BILLING_PLANS.PROFESSIONAL]: 800,
  [TENANT_BILLING_PLANS.PRO_PLUS]: 2000,
  [TENANT_BILLING_PLANS.ENTERPRISE]: 2500,
  [TENANT_BILLING_PLANS.TRIAL]: 50,
};

/** Monthly allowance shown/enforced for tenants without an active paid subscription. */
export function getUnpaidTenantCreditAllowance(): number {
  return resolveLawyerSignupCredits();
}

/** Fallback monthly AI credits when no ledger balance (used only for display defaults) */
export const TENANT_PLAN_CREDIT_ALLOWANCE: Record<string, number> = {
  [TENANT_BILLING_PLANS.SOLO]: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.SOLO],
  [TENANT_BILLING_PLANS.STARTER]: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.STARTER],
  [TENANT_BILLING_PLANS.PROFESSIONAL]: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.PROFESSIONAL],
  [TENANT_BILLING_PLANS.PRO_PLUS]: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.PRO_PLUS],
  [TENANT_BILLING_PLANS.ENTERPRISE]: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.ENTERPRISE],
  FIRM_STARTER: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.STARTER],
  FIRM_PROFESSIONAL: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.PROFESSIONAL],
  FIRM_PRO_PLUS: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.PRO_PLUS],
  FIRM_ENTERPRISE: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.ENTERPRISE],
  PRO: PLAN_CREDIT_ALLOWANCES[TENANT_BILLING_PLANS.PROFESSIONAL],
};

export function getPlanNetMarginPercent(billingPlan?: string | null): number {
  const normalized = normalizeBillingPlan(billingPlan);
  return PLAN_NET_MARGIN_PERCENT[normalized] ?? PLAN_NET_MARGIN_PERCENT.DEFAULT;
}

const BILLING_TO_PLAN_ID: Record<TenantBillingPlan, string> = {
  [TENANT_BILLING_PLANS.SOLO]: PRICING_PLANS.LAWYER_SOLO,
  [TENANT_BILLING_PLANS.STARTER]: PRICING_PLANS.FIRM_STARTER,
  [TENANT_BILLING_PLANS.PROFESSIONAL]: PRICING_PLANS.FIRM_PROFESSIONAL,
  [TENANT_BILLING_PLANS.PRO_PLUS]: PRICING_PLANS.FIRM_PRO_PLUS,
  [TENANT_BILLING_PLANS.ENTERPRISE]: PRICING_PLANS.FIRM_ENTERPRISE,
  [TENANT_BILLING_PLANS.TRIAL]: PRICING_PLANS.FIRM_STARTER,
};

const TIER_RANK: Record<TenantBillingPlan, number> = {
  [TENANT_BILLING_PLANS.STARTER]: 1,
  [TENANT_BILLING_PLANS.SOLO]: 2,
  [TENANT_BILLING_PLANS.PROFESSIONAL]: 3,
  [TENANT_BILLING_PLANS.PRO_PLUS]: 4,
  [TENANT_BILLING_PLANS.ENTERPRISE]: 5,
  [TENANT_BILLING_PLANS.TRIAL]: 0,
};

export function getTierRank(billingPlan?: string | null): number {
  return TIER_RANK[normalizeBillingPlan(billingPlan)] ?? 0;
}

export function comparePlanChange(
  currentBillingPlan: string | null | undefined,
  targetPlanId: string,
): 'new' | 'upgrade' | 'downgrade' | 'same' {
  if (!currentBillingPlan) return 'new';
  const currentTier = normalizeBillingPlan(currentBillingPlan);
  const targetTier = mapPlanIdToBillingPlan(targetPlanId);
  const currentRank = TIER_RANK[currentTier] ?? 0;
  const targetRank = TIER_RANK[targetTier] ?? 0;
  if (currentRank === targetRank) {
    return 'same';
  }
  if (currentRank === 0) {
    return 'new';
  }
  return targetRank > currentRank ? 'upgrade' : 'downgrade';
}

export function mapBillingPlanToPlanId(
  billingPlan: string | null | undefined,
  userType: 'LAW_FIRM' | 'CONSUMER' = 'LAW_FIRM',
): string {
  if (userType === 'CONSUMER') {
    const status = billingPlan?.toUpperCase();
    if (status === 'ACTIVE' || status === 'PLUS') {
      return PRICING_PLANS.CONSUMER_PLUS;
    }
    return PRICING_PLANS.CONSUMER_FREE;
  }
  const tier = normalizeBillingPlan(billingPlan);
  return BILLING_TO_PLAN_ID[tier] ?? PRICING_PLANS.FIRM_STARTER;
}

export function mapPlanIdToBillingPlan(planId: string): TenantBillingPlan {
  const normalized = planId.toLowerCase();
  if (normalized.includes('enterprise')) {
    return TENANT_BILLING_PLANS.ENTERPRISE;
  }
  if (normalized.includes('pro_plus') || normalized.includes('proplus')) {
    return TENANT_BILLING_PLANS.PRO_PLUS;
  }
  if (normalized.includes('solo')) {
    return TENANT_BILLING_PLANS.SOLO;
  }
  if (normalized.includes('professional') || normalized === 'pro') {
    return TENANT_BILLING_PLANS.PROFESSIONAL;
  }
  return PLAN_ID_TO_BILLING[planId] ?? TENANT_BILLING_PLANS.STARTER;
}

export function normalizeBillingPlan(value?: string | null): TenantBillingPlan {
  if (!value) {
    return TENANT_BILLING_PLANS.STARTER;
  }
  const upper = value.toUpperCase();
  if (upper === TENANT_BILLING_PLANS.SOLO || upper === 'LAWYER_SOLO' || upper === 'FIRM_SOLO') {
    return TENANT_BILLING_PLANS.SOLO;
  }
  if (
    upper === TENANT_BILLING_PLANS.PRO_PLUS ||
    upper === 'FIRM_PRO_PLUS' ||
    upper === 'PROPLUS'
  ) {
    return TENANT_BILLING_PLANS.PRO_PLUS;
  }
  if (upper === TENANT_BILLING_PLANS.PROFESSIONAL || upper === 'PRO' || upper === 'FIRM_PROFESSIONAL') {
    return TENANT_BILLING_PLANS.PROFESSIONAL;
  }
  if (upper === TENANT_BILLING_PLANS.ENTERPRISE || upper === 'FIRM_ENTERPRISE') {
    return TENANT_BILLING_PLANS.ENTERPRISE;
  }
  if (upper === TENANT_BILLING_PLANS.TRIAL || upper === 'TRIAL_PENDING_PAYMENT') {
    return TENANT_BILLING_PLANS.TRIAL;
  }
  if (upper === TENANT_BILLING_PLANS.STARTER || upper === 'FIRM_STARTER') {
    return TENANT_BILLING_PLANS.STARTER;
  }
  return TENANT_BILLING_PLANS.STARTER;
}

export function getTenantPlanCreditAllowance(billingPlan?: string | null): number {
  const normalized = normalizeBillingPlan(billingPlan);
  return TENANT_PLAN_CREDIT_ALLOWANCE[normalized] ?? getUnpaidTenantCreditAllowance();
}

/** Monthly deep case-analysis runs included in firm plans (Professional+). */
export const TENANT_ANALYSIS_QUOTAS = {
  similarCases: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 5,
    [TENANT_BILLING_PLANS.PRO_PLUS]: 15,
    [TENANT_BILLING_PLANS.ENTERPRISE]: 20,
    [TENANT_BILLING_PLANS.TRIAL]: 0,
  },
  opponentAngles: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 5,
    [TENANT_BILLING_PLANS.PRO_PLUS]: 15,
    [TENANT_BILLING_PLANS.ENTERPRISE]: 20,
    [TENANT_BILLING_PLANS.TRIAL]: 0,
  },
  strategyMemo: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 3,
    [TENANT_BILLING_PLANS.PRO_PLUS]: 10,
    [TENANT_BILLING_PLANS.ENTERPRISE]: 10,
    [TENANT_BILLING_PLANS.TRIAL]: 0,
  },
} as const;

export type AnalysisQuotaKind = keyof typeof TENANT_ANALYSIS_QUOTAS;

export function getAnalysisQuota(
  billingPlan: string | null | undefined,
  kind: AnalysisQuotaKind,
): number {
  const normalized = normalizeBillingPlan(billingPlan);
  return TENANT_ANALYSIS_QUOTAS[kind][normalized] ?? 0;
}

export function planIncludesDeepAnalysis(billingPlan: string | null | undefined): boolean {
  const normalized = normalizeBillingPlan(billingPlan);
  const tier = TIER_RANK[normalized] ?? 0;
  // Professional (rank 3) and above have access to deep analysis
  return tier >= 3;
}
