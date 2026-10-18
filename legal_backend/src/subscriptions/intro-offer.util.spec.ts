import { ConfigService } from '@nestjs/config';
import {
  applyIntroOfferDiscount,
  computeIntroOfferExpiry,
  computeIntroOfferTimeRemaining,
  getIntroOfferDays,
  getIntroOfferDiscountPercent,
  resolveIntroOfferCouponId,
} from './intro-offer.util';

describe('intro-offer.util', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'INTRO_OFFER_DISCOUNT_PERCENT') return '40';
      if (key === 'INTRO_OFFER_DAYS') return '7';
      if (key === 'STRIPE_INTRO_OFFER_COUPON_ID') return 'intro_coupon';
      return fallback ?? '';
    }),
  } as unknown as ConfigService;

  it('reads discount percent and offer days from config', () => {
    expect(getIntroOfferDiscountPercent(config)).toBe(40);
    expect(getIntroOfferDays(config)).toBe(7);
  });

  it('resolves intro offer coupon id with legacy fallbacks', () => {
    expect(resolveIntroOfferCouponId(config)).toBe('intro_coupon');
  });

  it('applies 40% discount to plan amount', () => {
    expect(applyIntroOfferDiscount(100, 40)).toBe(60);
    expect(applyIntroOfferDiscount(25, 40)).toBe(15);
  });

  it('computes expiry seven days after first login', () => {
    const firstLoginAt = new Date('2026-06-01T12:00:00.000Z');
    const expiresAt = computeIntroOfferExpiry(firstLoginAt, 7);
    expect(expiresAt.toISOString()).toBe('2026-06-08T12:00:00.000Z');
  });

  it('computes remaining days and hours before expiry', () => {
    const expiresAt = new Date('2026-06-08T12:00:00.000Z');
    const now = new Date('2026-06-07T10:00:00.000Z');
    expect(computeIntroOfferTimeRemaining(expiresAt, now)).toEqual({
      daysRemaining: 1,
      hoursRemaining: 2,
    });
  });
});
