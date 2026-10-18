/**
 * One-time Stripe setup: creates recurring Prices for two market tiers + portal config.
 *
 * Market tiers:
 *   Developing  (IN, KE, …): Lawyer Solo / Firm Starter $25, Professional $100, Pro Plus $500
 *   Developed   (US, GB, …): Lawyer Solo / Firm Starter $50, Professional $200, Pro Plus $1000
 *
 * Usage (from legal_backend/):
 *   npx ts-node -r tsconfig-paths/register scripts/setup-stripe-billing.ts
 *
 * Requires STRIPE_SECRET_KEY in legal_backend/.env
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(__dirname, '../.env');

/** Electronically supplied services (India OIDAR / digital SaaS). */
const STRIPE_TAX_CODE_DIGITAL = 'txcd_10000000';

interface PlanDef {
  planId: string;
  name: string;
  amountCents: number;
  currency: 'usd' | 'inr';
  tier: 'developing' | 'developed' | 'india';
  userType: 'LAW_FIRM' | 'CONSUMER';
  envKey: string;
}

const FIRM_PLANS: PlanDef[] = [
  // ── Developing market ($25 / $100 / $500) ──────────────────────────────
  {
    planId: 'lawyer_solo',
    name: 'Legal by OdaFlow — Lawyer Solo (Developing)',
    amountCents: 2500,
    currency: 'usd',
    tier: 'developing',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_LAWYER_SOLO_DEVELOPING',
  },
  {
    planId: 'firm_starter',
    name: 'Legal by OdaFlow — Firm Starter (Developing)',
    amountCents: 2500,
    currency: 'usd',
    tier: 'developing',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_STARTER_DEVELOPING',
  },
  {
    planId: 'firm_professional',
    name: 'Legal by OdaFlow — Firm Professional (Developing)',
    amountCents: 10000,
    currency: 'usd',
    tier: 'developing',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPING',
  },
  {
    planId: 'firm_pro_plus',
    name: 'Legal by OdaFlow — Firm Pro Plus (Developing)',
    amountCents: 50000,
    currency: 'usd',
    tier: 'developing',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPING',
  },
  // ── Developed market ($50 / $200 / $1000) ──────────────────────────────
  {
    planId: 'lawyer_solo',
    name: 'Legal by OdaFlow — Lawyer Solo (Developed)',
    amountCents: 5000,
    currency: 'usd',
    tier: 'developed',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_LAWYER_SOLO_DEVELOPED',
  },
  {
    planId: 'firm_starter',
    name: 'Legal by OdaFlow — Firm Starter (Developed)',
    amountCents: 5000,
    currency: 'usd',
    tier: 'developed',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_STARTER_DEVELOPED',
  },
  {
    planId: 'firm_professional',
    name: 'Legal by OdaFlow — Firm Professional (Developed)',
    amountCents: 20000,
    currency: 'usd',
    tier: 'developed',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PROFESSIONAL_DEVELOPED',
  },
  {
    planId: 'firm_pro_plus',
    name: 'Legal by OdaFlow — Firm Pro Plus (Developed)',
    amountCents: 100000,
    currency: 'usd',
    tier: 'developed',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PRO_PLUS_DEVELOPED',
  },
  // ── India native INR ───────────────────────────────────────────────────
  {
    planId: 'lawyer_solo',
    name: 'Legal by OdaFlow — Lawyer Solo (India)',
    amountCents: 140000,
    currency: 'inr',
    tier: 'india',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_LAWYER_SOLO_INR',
  },
  {
    planId: 'firm_starter',
    name: 'Legal by OdaFlow — Firm Starter (India)',
    amountCents: 140000,
    currency: 'inr',
    tier: 'india',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_STARTER_INR',
  },
  {
    planId: 'firm_professional',
    name: 'Legal by OdaFlow — Firm Professional (India)',
    amountCents: 600000,
    currency: 'inr',
    tier: 'india',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PROFESSIONAL_INR',
  },
  {
    planId: 'firm_pro_plus',
    name: 'Legal by OdaFlow — Firm Pro Plus (India)',
    amountCents: 3000000,
    currency: 'inr',
    tier: 'india',
    userType: 'LAW_FIRM',
    envKey: 'STRIPE_PRICE_FIRM_PRO_PLUS_INR',
  },
  {
    planId: 'consumer_plus',
    name: 'Legal by OdaFlow — Consumer Plus (India)',
    amountCents: 100000,
    currency: 'inr',
    tier: 'india',
    userType: 'CONSUMER',
    envKey: 'STRIPE_PRICE_CONSUMER_PLUS_INR',
  },
];

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

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const anchor = content.includes('STRIPE_PUBLISHABLE_KEY=')
    ? /^(STRIPE_PUBLISHABLE_KEY=.*)$/m
    : /^(STRIPE_SECRET_KEY=.*)$/m;
  if (anchor.test(content)) {
    return content.replace(anchor, `$1\n${line}`);
  }
  return `${content.trimEnd()}\n${line}\n`;
}

async function stripeRequest<T>(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const query = method === 'GET' && params ? `?${params.toString()}` : '';
  const url = `https://api.stripe.com/v1${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: method === 'POST' && params ? params.toString() : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Stripe ${path} failed (${response.status}): ${text}`);
  }
  return JSON.parse(text) as T;
}

async function listActivePrices(secretKey: string) {
  const params = new URLSearchParams();
  params.append('limit', '100');
  params.append('active', 'true');
  params.append('expand[0]', 'data.product');
  return stripeRequest<{
    data: Array<{ id: string; metadata?: Record<string, string>; unit_amount: number }>;
  }>(secretKey, 'GET', '/prices', params);
}

async function ensureProductTaxCode(
  secretKey: string,
  productId: string,
  taxCode: string,
): Promise<void> {
  if (!productId) return;
  const params = new URLSearchParams();
  params.append('tax_code', taxCode);
  await stripeRequest(secretKey, 'POST', `/products/${productId}`, params);
}

async function findOrCreatePrice(
  secretKey: string,
  plan: PlanDef,
  existingByKey: Map<string, string>,
  taxCode: string,
): Promise<{ priceId: string; productId: string }> {
  const existing = existingByKey.get(plan.envKey);
  if (existing) {
    console.log(`  ✓ ${plan.envKey}: reuse ${existing}`);
    const price = await stripeRequest<{ product: string | { id: string } }>(
      secretKey,
      'GET',
      `/prices/${existing}`,
    );
    const productId =
      typeof price.product === 'string' ? price.product : (price.product?.id ?? '');
    await ensureProductTaxCode(secretKey, productId, taxCode);
    return { priceId: existing, productId };
  }

  const productParams = new URLSearchParams();
  productParams.append('name', plan.name);
  productParams.append('tax_code', taxCode);
  productParams.append('metadata[planId]', plan.planId);
  productParams.append('metadata[marketTier]', plan.tier);
  productParams.append('metadata[userType]', plan.userType);
  const product = await stripeRequest<{ id: string }>(
    secretKey,
    'POST',
    '/products',
    productParams,
  );

  const priceParams = new URLSearchParams();
  priceParams.append('product', product.id);
  priceParams.append('unit_amount', String(plan.amountCents));
  priceParams.append('currency', plan.currency);
  priceParams.append('recurring[interval]', 'month');
  priceParams.append('metadata[planId]', plan.planId);
  priceParams.append('metadata[marketTier]', plan.tier);
  priceParams.append('metadata[userType]', plan.userType);
  const price = await stripeRequest<{ id: string }>(secretKey, 'POST', '/prices', priceParams);

  const displayAmount =
    plan.currency === 'inr'
      ? `₹${plan.amountCents / 100}/mo`
      : `$${plan.amountCents / 100}/mo`;
  console.log(`  + ${plan.envKey}: created ${price.id} (${displayAmount})`);
  return { priceId: price.id, productId: product.id };
}

async function configureCustomerPortal(
  secretKey: string,
  catalog: Array<{ priceId: string; productId: string }>,
) {
  const params = new URLSearchParams();
  params.append('features[subscription_update][enabled]', 'true');
  params.append('features[subscription_update][default_allowed_updates][0]', 'price');
  params.append('features[subscription_update][proration_behavior]', 'create_prorations');
  params.append('features[subscription_cancel][enabled]', 'true');
  params.append('features[subscription_cancel][mode]', 'at_period_end');
  params.append('features[payment_method_update][enabled]', 'true');
  params.append('features[invoice_history][enabled]', 'true');

  // Deduplicate by productId for portal (Stripe max: 10 products)
  const PORTAL_MAX_PRODUCTS = 10;
  const seen = new Set<string>();
  let idx = 0;
  for (const entry of catalog) {
    if (!entry.productId || seen.has(entry.productId)) continue;
    if (idx >= PORTAL_MAX_PRODUCTS) {
      console.warn(`  ⚠ Skipping extra portal products (Stripe limit: ${PORTAL_MAX_PRODUCTS})`);
      break;
    }
    seen.add(entry.productId);
    params.append(`features[subscription_update][products][${idx}][product]`, entry.productId);
    params.append(`features[subscription_update][products][${idx}][prices][0]`, entry.priceId);
    idx++;
  }

  try {
    const created = await stripeRequest<{ id: string }>(
      secretKey,
      'POST',
      '/billing_portal/configurations',
      params,
    );
    console.log(`  ✓ Customer portal configuration: ${created.id}`);
    console.log('    Enable in Dashboard if needed: Settings → Billing → Customer portal');
  } catch (error) {
    console.warn(
      `  ⚠ Customer portal configuration skipped: ${
        error instanceof Error ? error.message : error
      }`,
    );
    console.warn('    Price IDs were still created — configure portal manually in Stripe Dashboard if needed.');
  }
}

async function main() {
  const env = loadEnvFile();
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey || !secretKey.startsWith('sk_')) {
    console.error('STRIPE_SECRET_KEY missing or invalid in legal_backend/.env');
    process.exit(1);
  }

  // Build lookup map: envKey → existing priceId from .env
  const existingByKey = new Map<string, string>();
  for (const plan of FIRM_PLANS) {
    const existing = env[plan.envKey]?.trim();
    if (existing) existingByKey.set(plan.envKey, existing);
  }

  // Verify any prices in .env are still active in Stripe
  console.log('Listing existing Stripe prices (test mode)...');
  const listed = await listActivePrices(secretKey);
  const activeIds = new Set(listed.data.map((p) => p.id));
  for (const [key, id] of existingByKey) {
    if (!activeIds.has(id)) {
      console.warn(`  ⚠ ${key}=${id} not found in active Stripe prices — will recreate.`);
      existingByKey.delete(key);
    }
  }

  console.log('\nEnsuring firm plan prices (developing, developed, and India INR)...');
  const catalog: Array<{ priceId: string; productId: string; tier: PlanDef['tier'] }> = [];
  const priceIds: Record<string, string> = {};

  for (const plan of FIRM_PLANS) {
    const result = await findOrCreatePrice(secretKey, plan, existingByKey, STRIPE_TAX_CODE_DIGITAL);
    catalog.push({ ...result, tier: plan.tier });
    priceIds[plan.envKey] = result.priceId;
  }

  const portalCatalog = [...catalog]
    .sort((a, b) => {
      const rank: Record<PlanDef['tier'], number> = { india: 0, developed: 1, developing: 2 };
      return rank[a.tier] - rank[b.tier];
    })
    .map(({ priceId, productId }) => ({ priceId, productId }));

  console.log('\nConfiguring Customer Portal (plan switching)...');
  await configureCustomerPortal(secretKey, portalCatalog);

  // ── Introductory offer coupon ─────────────────────────────────────────
  console.log('\nEnsuring intro offer coupon (40% off, once)...');
  const existingIntroCouponId =
    env.STRIPE_INTRO_OFFER_COUPON_ID?.trim() ||
    env.STRIPE_FIRST_PURCHASE_COUPON_ID?.trim() ||
    env.STRIPE_REFERRAL_COUPON_ID?.trim();
  let introCouponId = existingIntroCouponId;

    if (!existingIntroCouponId) {
    const couponParams = new URLSearchParams();
    couponParams.append('percent_off', '40');
    couponParams.append('duration', 'once');
    couponParams.append('name', '40% off first month — intro offer');
    couponParams.append('metadata[source]', 'odaflow_intro_offer');
    const coupon = await stripeRequest<{ id: string }>(secretKey, 'POST', '/coupons', couponParams);
    introCouponId = coupon.id;
    console.log(`  + Created coupon: ${introCouponId}`);
    console.log('  ⚠  Remove the "Maximum redemptions" cap in Stripe dashboard before going live.');
  } else {
    // Verify the existing coupon has duration=once so it applies to first month only.
    // If the coupon no longer exists (stale env var), create a new one.
    type StripeCoupon = {
      id: string;
      valid?: boolean;
      deleted?: boolean;
      duration?: string;
      percent_off?: number;
    };

    let existingCoupon: StripeCoupon | null = null;

    try {
      existingCoupon = await stripeRequest<StripeCoupon>(
        secretKey,
        'GET',
        `/coupons/${encodeURIComponent(existingIntroCouponId)}`,
      );
    } catch {
      console.warn(
        `  ⚠  Coupon "${existingIntroCouponId}" not found in Stripe (stale env var) — creating a new one.`,
      );
    }

    const needsNew =
      !existingCoupon ||
      existingCoupon.deleted ||
      existingCoupon.duration !== 'once' ||
      existingCoupon.percent_off !== 40;

    if (needsNew) {
      if (existingCoupon) {
        console.warn(
          `  ⚠  Existing coupon ${existingIntroCouponId} has duration="${existingCoupon.duration}", percent_off=${existingCoupon.percent_off}.` +
            ` Expected duration=once, percent_off=40.`,
        );
        console.warn('  Creating a new corrected coupon and updating env...');
      }
      const couponParams = new URLSearchParams();
      couponParams.append('percent_off', '40');
      couponParams.append('duration', 'once');
      couponParams.append('name', '40% off first month — intro offer');
      couponParams.append('metadata[source]', 'odaflow_intro_offer');
      const newCoupon = await stripeRequest<{ id: string }>(secretKey, 'POST', '/coupons', couponParams);
      introCouponId = newCoupon.id;
      console.log(`  + Created coupon: ${introCouponId}`);
      console.log('  ⚠  Remove the "Maximum redemptions" cap in Stripe dashboard before going live.');
    } else {
      console.log(`  ✓ Existing coupon: ${existingIntroCouponId} (duration=once, 40% off — OK)`);
    }
  }

  // ── Write all IDs back to .env ─────────────────────────────────────────
  let envContent = readFileSync(ENV_PATH, 'utf8');
  for (const [envKey, priceId] of Object.entries(priceIds)) {
    envContent = upsertEnvVar(envContent, envKey, priceId);
  }
  if (introCouponId) {
    envContent = upsertEnvVar(envContent, 'STRIPE_INTRO_OFFER_COUPON_ID', introCouponId);
    envContent = upsertEnvVar(envContent, 'STRIPE_REFERRAL_COUPON_ID', introCouponId);
    envContent = upsertEnvVar(envContent, 'STRIPE_FIRST_PURCHASE_COUPON_ID', introCouponId);
  }
  writeFileSync(ENV_PATH, envContent, 'utf8');
  console.log('\n✅  Updated legal_backend/.env with all STRIPE_PRICE_* IDs and coupon IDs.');

  const publishable = env.STRIPE_PUBLISHABLE_KEY?.trim();
  if (publishable) {
    const webEnvPath = join(__dirname, '../../legal_web/.env.local');
    try {
      let webEnv = readFileSync(webEnvPath, 'utf8');
      webEnv = upsertEnvVar(webEnv, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', publishable);
      writeFileSync(webEnvPath, webEnv, 'utf8');
      console.log('Updated legal_web/.env.local with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
    } catch {
      writeFileSync(
        webEnvPath,
        `# Stripe (from legal_backend/.env)\nNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${publishable}\n`,
      );
      console.log('Created legal_web/.env.local with NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
    }
  }

  console.log('\nNext: run Stripe CLI for local webhooks:');
  console.log('  stripe listen --forward-to localhost:4000/api/v1/subscriptions/webhooks/stripe');
  console.log('Then paste whsec_... into STRIPE_WEBHOOK_SECRET and restart the backend.');
  console.log('\nStripe Tax (India IGST on B2C digital subscriptions):');
  console.log('  1. Dashboard → Tax → set business location and register for India (remote seller).');
  console.log('  2. Set STRIPE_TAX_ENABLED=true in legal_backend/.env and restart the backend.');
  console.log(`  3. Products use tax_code ${STRIPE_TAX_CODE_DIGITAL} (electronically supplied services).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
