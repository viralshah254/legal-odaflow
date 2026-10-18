import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { ReferralFraudService } from './referral-fraud.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  referralCode: { findUnique: jest.fn(), create: jest.fn() },
  referral: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  subscription: { count: jest.fn() },
  auditLog: { create: jest.fn() },
  $transaction: jest.fn(),
};

const mockFraud = {
  checkFraud: jest.fn(),
  hashFingerprint: jest.fn((v: string) => `hash:${v}`),
  upsertDeviceFingerprint: jest.fn(),
};

const mockLedger = { credit: jest.fn() };

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'REFERRAL_REWARD_USD') return '10';
    if (key === 'REFERRAL_ATTRIBUTION_DAYS') return '90';
    if (key === 'AI_CREDIT_USD_VALUE') return '0.06';
    if (key === 'APP_URL') return 'http://localhost:3000';
    return fallback ?? '';
  }),
};

describe('ReferralsService', () => {
  let service: ReferralsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReferralsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReferralFraudService, useValue: mockFraud },
        { provide: AICreditLedgerService, useValue: mockLedger },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ReferralsService);
    jest.clearAllMocks();
  });

  // ── applyReferralCode ───────────────────────────────────────────────────

  describe('applyReferralCode', () => {
    it('throws ConflictException when referee already has attribution', async () => {
      mockPrisma.referral.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.applyReferralCode({ refereeUserId: 'u2', code: 'ABCD1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown code', async () => {
      mockPrisma.referral.findUnique.mockResolvedValue(null);
      mockPrisma.referralCode.findUnique.mockResolvedValue(null);
      await expect(
        service.applyReferralCode({ refereeUserId: 'u2', code: 'BADCODE1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a Referral record on success', async () => {
      mockPrisma.referral.findUnique.mockResolvedValue(null);
      mockPrisma.referralCode.findUnique.mockResolvedValue({
        userId: 'referrer-1',
        code: 'ABCD1234',
        user: { id: 'referrer-1', userType: 'CONSUMER' },
      });
      mockFraud.checkFraud.mockResolvedValue({ allowed: true });
      mockPrisma.referral.create.mockResolvedValue({ id: 'new-referral' });

      const result = await service.applyReferralCode({
        refereeUserId: 'u2',
        code: 'ABCD1234',
      });

      expect(result.attributed).toBe(true);
      expect(mockPrisma.referral.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referrerUserId: 'referrer-1',
            refereeUserId: 'u2',
            referralCode: 'ABCD1234',
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  // ── validateReferralForCheckout ────────────────────────────────────────

  describe('validateReferralForCheckout', () => {
    it('returns ineligible when no pending referral exists', async () => {
      mockPrisma.referral.findFirst.mockResolvedValue(null);
      const result = await service.validateReferralForCheckout({ refereeUserId: 'u1' });
      expect(result.eligible).toBe(false);
    });

    it('returns eligible for a valid PENDING referral', async () => {
      const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      mockPrisma.referral.findFirst.mockResolvedValue({
        id: 'ref-1',
        referrerUserId: 'r1',
        refereeUserId: 'u1',
        status: 'PENDING',
        createdAt: cutoff,
      });
      mockFraud.checkFraud.mockResolvedValue({ allowed: true });

      const result = await service.validateReferralForCheckout({ refereeUserId: 'u1' });
      expect(result.eligible).toBe(true);
      expect(result.referralId).toBe('ref-1');
    });

    it('returns eligible for a SUBSCRIBED referral (checkout retry scenario)', async () => {
      const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      mockPrisma.referral.findFirst.mockResolvedValue({
        id: 'ref-2',
        referrerUserId: 'r1',
        refereeUserId: 'u2',
        status: 'SUBSCRIBED',
        createdAt: cutoff,
      });
      mockFraud.checkFraud.mockResolvedValue({ allowed: true });

      const result = await service.validateReferralForCheckout({ refereeUserId: 'u2' });
      expect(result.eligible).toBe(true);
    });

    it('rejects and marks referral REJECTED when fraud detected', async () => {
      const cutoff = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockPrisma.referral.findFirst.mockResolvedValue({
        id: 'ref-3',
        referrerUserId: 'r1',
        refereeUserId: 'u3',
        status: 'PENDING',
        createdAt: cutoff,
      });
      mockFraud.checkFraud.mockResolvedValue({ allowed: false, reason: 'Self-referral detected' });
      mockPrisma.referral.update.mockResolvedValue({});

      const result = await service.validateReferralForCheckout({ refereeUserId: 'u3' });
      expect(result.eligible).toBe(false);
      expect(mockPrisma.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
    });
  });

  // ── getRefereeStatus ────────────────────────────────────────────────────

  describe('getRefereeStatus', () => {
    it('returns hasReferral=false when no pending referral', async () => {
      mockPrisma.referral.findFirst.mockResolvedValue(null);
      const status = await service.getRefereeStatus('u1');
      expect(status.hasReferral).toBe(false);
      expect(status.eligibleForDiscount).toBe(false);
    });

    it('returns 40% discount info when referral found', async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      mockPrisma.referral.findFirst.mockResolvedValue({
        id: 'ref-1',
        referrerUserId: 'r1',
        refereeUserId: 'u1',
        status: 'PENDING',
        createdAt: cutoff,
      });
      mockPrisma.user.findUnique.mockResolvedValue({ name: 'Alice Smith' });

      const status = await service.getRefereeStatus('u1');
      expect(status.hasReferral).toBe(true);
      expect(status.eligibleForDiscount).toBe(true);
      expect(status.discountPercent).toBe(40);
      expect(status.referrerDisplayName).toBe('Alice Smith');
    });
  });

  // ── getMyStats signedUp aggregation ────────────────────────────────────

  describe('getMyStats', () => {
    it('includes signedUp = pending + subscribed + rewarded', async () => {
      mockPrisma.referralCode.findUnique.mockResolvedValue({ code: 'TESTCODE' });
      mockPrisma.referral.count
        .mockResolvedValueOnce(2) // pending
        .mockResolvedValueOnce(1) // subscribed
        .mockResolvedValueOnce(0); // rewarded
      mockPrisma.referral.findMany.mockResolvedValue([]);

      const stats = await service.getMyStats('u1');
      expect(stats.stats.signedUp).toBe(3);
      expect(stats.stats.pending).toBe(2);
      expect(stats.stats.subscribed).toBe(1);
    });
  });

  // ── onConsumerSubscriptionActivated idempotency ─────────────────────────

  describe('onConsumerSubscriptionActivated', () => {
    it('does nothing when userId is null', async () => {
      await service.onConsumerSubscriptionActivated({ subscriptionId: 'sub-1', userId: null });
      expect(mockPrisma.referral.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing when referral status is already REWARDED (idempotency)', async () => {
      mockPrisma.referral.findUnique.mockResolvedValue({ id: 'ref-1', status: 'REWARDED' });
      await service.onConsumerSubscriptionActivated({ subscriptionId: 'sub-1', userId: 'u1' });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when not first subscription', async () => {
      mockPrisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        status: 'PENDING',
        referrerUserId: 'r1',
        createdAt: new Date(),
      });
      mockPrisma.subscription.count.mockResolvedValue(2); // prior active subs exist

      await service.onConsumerSubscriptionActivated({ subscriptionId: 'sub-1', userId: 'u1' });

      expect(mockPrisma.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        }),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('grants credits and marks REWARDED on happy path', async () => {
      const createdAt = new Date();
      mockPrisma.referral.findUnique.mockResolvedValue({
        id: 'ref-1',
        status: 'PENDING',
        referrerUserId: 'r1',
        refereeUserId: 'u1',
        createdAt,
      });
      mockPrisma.subscription.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({
        userType: 'CONSUMER',
        tenantUsers: [],
      });

      const txMock = jest.fn(async (fn: Function) => fn(mockPrisma));
      mockPrisma.$transaction.mockImplementation(txMock);
      mockPrisma.referral.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      mockLedger.credit.mockResolvedValue({});

      await service.onConsumerSubscriptionActivated({ subscriptionId: 'sub-1', userId: 'u1' });

      expect(mockLedger.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          taskType: 'referral_reward',
          credits: Math.floor(10 / 0.06),
        }),
      );
      expect(mockPrisma.referral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REWARDED' }),
        }),
      );
    });
  });
});
