/**
 * Reconcile tenant subscription planId / billingPlan with live Stripe subscription.
 *
 * Handles DB rows that incorrectly store checkout session IDs (cs_...) instead of
 * subscription IDs (sub_...) by looking up active subscriptions on stripeCustomerId.
 *
 * Usage (from legal_backend/):
 *   npm run stripe:reconcile -- --email=user@example.com
 *   npm run stripe:reconcile -- --tenantId=<uuid>
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  getTierRank,
  mapPlanIdToBillingPlan,
  normalizeBillingPlan,
} from '../src/config/billing-plans';
import { PRICING_PLANS } from '../src/config/pricing.config';

const ENV_PATH = join(__dirname, '../.env');

function loadEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(ENV_PATH, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function buildPriceIdToPlanId(env: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  const entries: Array<[string, string]> = [
    [PRICING_PLANS.LAWYER_SOLO, 'STRIPE_PRICE_LAWYER_SOLO'],
    [PRICING_PLANS.FIRM_STARTER, 'STRIPE_PRICE_FIRM_STARTER'],
    [PRICING_PLANS.FIRM_PROFESSIONAL, 'STRIPE_PRICE_FIRM_PROFESSIONAL'],
    [PRICING_PLANS.FIRM_PRO_PLUS, 'STRIPE_PRICE_FIRM_PRO_PLUS'],
    [PRICING_PLANS.LAWYER_SOLO, 'STRIPE_PRICE_LAWYER_SOLO_DEVELOPING'],
    [PRICING_PLANS.FIRM_STARTER, 'STRIPE_PRICE_FIRM_STARTER_DEVELOPING'],
    [PRICING_PLANS.FIRM_PROFESSIONAL, 'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPING'],
    [PRICING_PLANS.FIRM_PRO_PLUS, 'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPING'],
    [PRICING_PLANS.LAWYER_SOLO, 'STRIPE_PRICE_LAWYER_SOLO_DEVELOPED'],
    [PRICING_PLANS.FIRM_STARTER, 'STRIPE_PRICE_FIRM_STARTER_DEVELOPED'],
    [PRICING_PLANS.FIRM_PROFESSIONAL, 'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPED'],
    [PRICING_PLANS.FIRM_PRO_PLUS, 'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPED'],
    [PRICING_PLANS.LAWYER_SOLO, 'STRIPE_PRICE_LAWYER_SOLO_INR'],
    [PRICING_PLANS.FIRM_STARTER, 'STRIPE_PRICE_FIRM_STARTER_INR'],
    [PRICING_PLANS.FIRM_PROFESSIONAL, 'STRIPE_PRICE_FIRM_PROFESSIONAL_INR'],
    [PRICING_PLANS.FIRM_PRO_PLUS, 'STRIPE_PRICE_FIRM_PRO_PLUS_INR'],
    [PRICING_PLANS.CONSUMER_PLUS, 'STRIPE_PRICE_CONSUMER_PLUS_INR'],
  ];
  for (const [planId, envKey] of entries) {
    const priceId = env[envKey]?.trim();
    if (priceId) map.set(priceId, planId);
  }
  return map;
}

async function stripeRequest<T>(
  secretKey: string,
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const query = params ? `?${params.toString()}` : '';
  const response = await fetch(`https://api.stripe.com/v1${path}${query}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Stripe ${path} failed (${response.status}): ${text}`);
  }
  return JSON.parse(text) as T;
}

type StripeSubscription = {
  id: string;
  status: string;
  metadata?: Record<string, string>;
  items?: {
    data?: Array<{ price?: { id?: string; metadata?: Record<string, string> } }>;
  };
};

function extractPlanId(
  stripeSub: StripeSubscription,
  priceIdToPlanId: Map<string, string>,
): string | null {
  const fromMeta = stripeSub.metadata?.planId;
  if (fromMeta) return fromMeta;

  const price = stripeSub.items?.data?.[0]?.price;
  if (!price?.id) return price?.metadata?.planId ?? null;

  return price.metadata?.planId ?? priceIdToPlanId.get(price.id) ?? null;
}

function pickBestSubscription(
  subs: StripeSubscription[],
  priceIdToPlanId: Map<string, string>,
): { sub: StripeSubscription; planId: string } | null {
  const active = subs.filter((s) => s.status === 'active' || s.status === 'trialing');
  let best: { sub: StripeSubscription; planId: string; rank: number } | null = null;

  for (const sub of active) {
    const planId = extractPlanId(sub, priceIdToPlanId);
    if (!planId) continue;
    const billingPlan = mapPlanIdToBillingPlan(planId);
    const rank = getTierRank(billingPlan);
    if (!best || rank > best.rank) {
      best = { sub, planId, rank };
    }
  }

  return best ? { sub: best.sub, planId: best.planId } : null;
}

async function listCustomerSubscriptions(
  secretKey: string,
  customerId: string,
): Promise<StripeSubscription[]> {
  const params = new URLSearchParams();
  params.append('customer', customerId);
  params.append('status', 'all');
  params.append('limit', '20');
  const result = await stripeRequest<{ data: StripeSubscription[] }>(
    secretKey,
    '/subscriptions',
    params,
  );
  return result.data ?? [];
}

async function main() {
  const tenantIdArg = parseArg('tenantId');
  const email = parseArg('email');
  if (!tenantIdArg && !email) {
    console.error('Usage: --tenantId=<uuid> OR --email=user@example.com');
    process.exit(1);
  }

  const env = loadEnvFile();
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey?.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY missing or invalid in legal_backend/.env');
  }

  const priceIdToPlanId = buildPriceIdToPlanId(env);
  const prisma = new PrismaClient();

  try {
    let tenant = tenantIdArg
      ? await prisma.tenant.findUnique({ where: { id: tenantIdArg } })
      : null;

    if (!tenant && email) {
      const user = await prisma.user.findFirst({ where: { email } });
      if (!user) throw new Error(`No user found for email ${email}`);
      const membership = await prisma.tenantUser.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      if (!membership) throw new Error(`User ${email} has no tenant membership`);
      tenant = await prisma.tenant.findUnique({ where: { id: membership.tenantId } });
    }

    if (!tenant) throw new Error('Tenant not found');

    console.log('Tenant:', tenant.id, tenant.name);
    console.log('DB billingPlan:', tenant.billingPlan);
    console.log('Stripe customer:', tenant.stripeCustomerId ?? '(none)');

    let internal = await prisma.subscription.findFirst({
      where: { tenantId: tenant.id, paymentProvider: 'stripe', status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });

    let stripeSub: StripeSubscription | null = null;
    let stripePlanId: string | null = null;

    if (internal?.providerSubscriptionId?.startsWith('sub_')) {
      stripeSub = await stripeRequest<StripeSubscription>(
        secretKey,
        `/subscriptions/${internal.providerSubscriptionId}`,
      );
      stripePlanId = extractPlanId(stripeSub, priceIdToPlanId);
    }

    if (!stripeSub && tenant.stripeCustomerId) {
      console.log('No sub_ on file — listing Stripe subscriptions for customer...');
      const subs = await listCustomerSubscriptions(secretKey, tenant.stripeCustomerId);
      console.log(`  Found ${subs.length} subscription(s) in Stripe`);
      for (const s of subs) {
        const pid = extractPlanId(s, priceIdToPlanId);
        console.log(`  - ${s.id} status=${s.status} planId=${pid ?? '?'}`);
      }
      const best = pickBestSubscription(subs, priceIdToPlanId);
      if (best) {
        stripeSub = best.sub;
        stripePlanId = best.planId;
      }
    }

    if (!stripeSub || !stripePlanId) {
      throw new Error(
        'Could not resolve an active Stripe subscription. Complete checkout or add stripeCustomerId.',
      );
    }

    console.log('\nUsing Stripe subscription:', stripeSub.id, 'status:', stripeSub.status);
    console.log('Resolved planId:', stripePlanId);

    const billingPlan = mapPlanIdToBillingPlan(stripePlanId);
    const countryCode = tenant.primaryCountry ?? 'IN';

    if (!internal) {
      internal = await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          userType: 'LAW_FIRM',
          planId: stripePlanId,
          countryCode,
          currency: tenant.defaultCurrency ?? 'INR',
          status: 'ACTIVE',
          paymentProvider: 'stripe',
          providerSubscriptionId: stripeSub.id,
          providerCustomerId: tenant.stripeCustomerId,
        },
      });
      console.log('Created subscription row:', internal.id);
    } else {
      const badProviderId = !internal.providerSubscriptionId?.startsWith('sub_');
      if (
        internal.planId !== stripePlanId ||
        badProviderId ||
        internal.providerSubscriptionId !== stripeSub.id
      ) {
        await prisma.subscription.update({
          where: { id: internal.id },
          data: {
            planId: stripePlanId,
            providerSubscriptionId: stripeSub.id,
            providerCustomerId: tenant.stripeCustomerId ?? internal.providerCustomerId,
            countryCode,
          },
        });
        console.log('Updated subscription row:', internal.id);
        if (badProviderId) {
          console.log(`  Fixed providerSubscriptionId (was ${internal.providerSubscriptionId?.slice(0, 20)}...)`);
        }
      }
    }

    if (normalizeBillingPlan(tenant.billingPlan) !== normalizeBillingPlan(billingPlan)) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { billingPlan },
      });
      console.log(`Updated tenant.billingPlan → ${billingPlan}`);
    } else {
      console.log('tenant.billingPlan already correct:', tenant.billingPlan);
    }

    console.log('\nReconciliation complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
