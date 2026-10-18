import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ReferralFraudService } from './referral-fraud.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrisma = {
  userDeviceFingerprint: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  referral: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'DEVICE_FINGERPRINT_SALT') return 'test-salt';
    if (key === 'REFERRAL_MAX_REWARDS_PER_FINGERPRINT') return '10';
    return fallback ?? '';
  }),
};

describe('ReferralFraudService', () => {
  let service: ReferralFraudService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReferralFraudService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ReferralFraudService);

    jest.clearAllMocks();
    mockPrisma.userDeviceFingerprint.findFirst.mockResolvedValue(null);
    mockPrisma.referral.findFirst.mockResolvedValue(null);
    mockPrisma.referral.count.mockResolvedValue(0);
    mockPrisma.userDeviceFingerprint.upsert.mockResolvedValue({});
  });

  it('rejects self-referral', async () => {
    const result = await service.checkFraud({
      referrerUserId: 'user-1',
      refereeUserId: 'user-1',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/self-referral/i);
  });

  it('allows valid referral when no device fingerprint is provided', async () => {
    const result = await service.checkFraud({
      referrerUserId: 'user-a',
      refereeUserId: 'user-b',
    });
    expect(result.allowed).toBe(true);
  });

  it('rejects when referee device hash belongs to referrer', async () => {
    mockPrisma.userDeviceFingerprint.findFirst.mockResolvedValue({ id: 'fp-1' });

    const result = await service.checkFraud({
      referrerUserId: 'user-a',
      refereeUserId: 'user-b',
      refereeDeviceFingerprint: 'shared-device',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/referrer account/i);
  });

  it('rejects when device has already redeemed a discount', async () => {
    // First call (referrer fingerprint check) returns null
    // Second call (redeemed referral check) returns a record
    mockPrisma.userDeviceFingerprint.findFirst.mockResolvedValueOnce(null);
    mockPrisma.referral.findFirst.mockResolvedValue({ id: 'ref-1' });

    const result = await service.checkFraud({
      referrerUserId: 'user-a',
      refereeUserId: 'user-b',
      refereeDeviceFingerprint: 'already-used-device',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already redeemed/i);
  });

  it('rejects when referrer has hit reward cap', async () => {
    mockPrisma.userDeviceFingerprint.findFirst.mockResolvedValue(null);
    mockPrisma.referral.findFirst.mockResolvedValue(null);
    mockPrisma.referral.count.mockResolvedValue(10); // at cap

    const result = await service.checkFraud({
      referrerUserId: 'user-a',
      refereeUserId: 'user-b',
      refereeDeviceFingerprint: 'fresh-device',
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/maximum reward limit/i);
  });

  it('produces consistent hash for same fingerprint + salt', () => {
    const h1 = service.hashFingerprint('abc123');
    const h2 = service.hashFingerprint('abc123');
    expect(h1).toBe(h2);
  });

  it('produces different hashes for different fingerprints', () => {
    const h1 = service.hashFingerprint('device-a');
    const h2 = service.hashFingerprint('device-b');
    expect(h1).not.toBe(h2);
  });
});
