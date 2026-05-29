import { PRICING_PLANS } from './pricing.config';

/** Canonical tenant billing plan values stored on Tenant.billingPlan */
export const TENANT_BILLING_PLANS = {
  SOLO: 'SOLO',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
  TRIAL: 'TRIAL_PENDING_PAYMENT',
} as const;

export type TenantBillingPlan =
  (typeof TENANT_BILLING_PLANS)[keyof typeof TENANT_BILLING_PLANS];

const PLAN_ID_TO_BILLING: Record<string, TenantBillingPlan> = {
  [PRICING_PLANS.LAWYER_SOLO]: TENANT_BILLING_PLANS.SOLO,
  [PRICING_PLANS.FIRM_STARTER]: TENANT_BILLING_PLANS.STARTER,
  [PRICING_PLANS.FIRM_PROFESSIONAL]: TENANT_BILLING_PLANS.PROFESSIONAL,
  [PRICING_PLANS.FIRM_ENTERPRISE]: TENANT_BILLING_PLANS.ENTERPRISE,
  consumer_free: TENANT_BILLING_PLANS.STARTER,
  consumer_plus: TENANT_BILLING_PLANS.PROFESSIONAL,
  LAWYER_SOLO: TENANT_BILLING_PLANS.SOLO,
};

/** Fallback monthly AI credits when no ledger balance (used only for display defaults) */
export const TENANT_PLAN_CREDIT_ALLOWANCE: Record<string, number> = {
  [TENANT_BILLING_PLANS.SOLO]: 75,
  [TENANT_BILLING_PLANS.STARTER]: 50,
  [TENANT_BILLING_PLANS.PROFESSIONAL]: 200,
  [TENANT_BILLING_PLANS.ENTERPRISE]: 500,
  FIRM_STARTER: 50,
  FIRM_PROFESSIONAL: 200,
  FIRM_ENTERPRISE: 500,
  PRO: 200,
};

export function mapPlanIdToBillingPlan(planId: string): TenantBillingPlan {
  const normalized = planId.toLowerCase();
  if (normalized.includes('enterprise')) {
    return TENANT_BILLING_PLANS.ENTERPRISE;
  }
  if (normalized.includes('solo')) {
    return TENANT_BILLING_PLANS.SOLO;
  }
  if (normalized.includes('professional') || normalized.includes('pro')) {
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
  return TENANT_PLAN_CREDIT_ALLOWANCE[normalized] ?? 50;
}

/** Monthly deep case-analysis runs included in firm plans (Professional+). */
export const TENANT_ANALYSIS_QUOTAS = {
  similarCases: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 5,
    [TENANT_BILLING_PLANS.ENTERPRISE]: 20,
    [TENANT_BILLING_PLANS.TRIAL]: 0,
  },
  opponentAngles: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 5,
    [TENANT_BILLING_PLANS.ENTERPRISE]: 20,
    [TENANT_BILLING_PLANS.TRIAL]: 0,
  },
  strategyMemo: {
    [TENANT_BILLING_PLANS.SOLO]: 0,
    [TENANT_BILLING_PLANS.STARTER]: 0,
    [TENANT_BILLING_PLANS.PROFESSIONAL]: 3,
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
  return getAnalysisQuota(billingPlan, 'similarCases') > 0;
}
