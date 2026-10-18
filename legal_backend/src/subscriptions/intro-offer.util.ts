import { ConfigService } from '@nestjs/config';

export type IntroOfferReason = 'not_started' | 'expired' | 'subscribed';

export type IntroOfferStatusDto = {
  eligible: boolean;
  discountPercent: number;
  firstLoginAt: string | null;
  expiresAt: string | null;
  daysRemaining: number;
  hoursRemaining: number;
  reason?: IntroOfferReason;
  userType: 'CONSUMER' | 'LAW_FIRM';
};

export const PAID_SUBSCRIPTION_STATUSES = [
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'TRIALING',
] as const;

export function getIntroOfferDiscountPercent(config: ConfigService): number {
  return Number(config.get<string>('INTRO_OFFER_DISCOUNT_PERCENT', '40'));
}

export function getIntroOfferDays(config: ConfigService): number {
  return Number(config.get<string>('INTRO_OFFER_DAYS', '7'));
}

export function resolveIntroOfferCouponId(config: ConfigService): string {
  return (
    config.get<string>('STRIPE_INTRO_OFFER_COUPON_ID', '') ||
    config.get<string>('STRIPE_FIRST_PURCHASE_COUPON_ID', '') ||
    config.get<string>('STRIPE_REFERRAL_COUPON_ID', '')
  ).trim();
}

export function applyIntroOfferDiscount(
  amount: number,
  discountPercent: number,
): number {
  return amount * (1 - discountPercent / 100);
}

export function computeIntroOfferExpiry(
  firstLoginAt: Date,
  offerDays: number,
): Date {
  const expiresAt = new Date(firstLoginAt);
  expiresAt.setDate(expiresAt.getDate() + offerDays);
  return expiresAt;
}

export function computeIntroOfferTimeRemaining(
  expiresAt: Date,
  now = new Date(),
): { daysRemaining: number; hoursRemaining: number } {
  const msRemaining = Math.max(0, expiresAt.getTime() - now.getTime());
  const totalHours = Math.ceil(msRemaining / (1000 * 60 * 60));
  const daysRemaining = Math.floor(totalHours / 24);
  const hoursRemaining = totalHours % 24;
  return { daysRemaining, hoursRemaining };
}
