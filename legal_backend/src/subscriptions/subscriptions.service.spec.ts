import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { StripeService } from '@/payments/stripe.service';
import { ReferralsService } from '@/referrals/referrals.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import { CurrencyFxService } from '@/config/currency-fx.service';

const mockPrisma = {
  user: { findUnique: jest.fn() },
  subscription: { findFirst: jest.fn(), count: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'INTRO_OFFER_DISCOUNT_PERCENT') return '40';
    if (key === 'INTRO_OFFER_DAYS') return '7';
    return fallback ?? '';
  }),
};

describe('SubscriptionsService intro offer', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: StripeService, useValue: {} },
        { provide: ReferralsService, useValue: {} },
        { provide: AICreditLedgerService, useValue: {} },
        { provide: AIBudgetPolicyService, useValue: {} },
        { provide: CurrencyFxService, useValue: {} },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    jest.clearAllMocks();
  });

  it('returns not_started when first login is missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      firstLoginAt: null,
      userType: 'CONSUMER',
    });

    const status = await service.getIntroOfferStatus('user-1');
    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('not_started');
    expect(status.discountPercent).toBe(40);
  });

  it('returns eligible within seven days of first login with no paid history', async () => {
    const firstLoginAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstLoginAt,
      userType: 'CONSUMER',
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.count.mockResolvedValue(0);

    const status = await service.getIntroOfferStatus('user-1');
    expect(status.eligible).toBe(true);
    expect(status.discountPercent).toBe(40);
    expect(status.daysRemaining).toBeGreaterThanOrEqual(4);
  });

  it('returns expired after the offer window', async () => {
    const firstLoginAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstLoginAt,
      userType: 'CONSUMER',
    });

    const status = await service.getIntroOfferStatus('user-1');
    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('expired');
  });

  it('returns subscribed when user already has paid subscription history', async () => {
    const firstLoginAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstLoginAt,
      userType: 'CONSUMER',
    });
    mockPrisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      providerSubscriptionId: 'sub_stripe123',
    });
    mockPrisma.subscription.count.mockResolvedValue(0);

    const status = await service.getIntroOfferStatus('user-1');
    expect(status.eligible).toBe(false);
    expect(status.reason).toBe('subscribed');
  });

  it('stays eligible when only a checkout session exists without a Stripe subscription', async () => {
    const firstLoginAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      firstLoginAt,
      userType: 'CONSUMER',
    });
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.subscription.count.mockResolvedValue(0);

    const status = await service.getIntroOfferStatus('user-1');
    expect(status.eligible).toBe(true);
  });

  it('throws when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getIntroOfferStatus('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
