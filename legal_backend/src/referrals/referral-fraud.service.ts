import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';

export interface FraudCheckInput {
  referrerUserId: string;
  refereeUserId: string;
  refereeDeviceFingerprint?: string;
}

export interface FraudCheckResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class ReferralFraudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  hashFingerprint(rawFingerprint: string): string {
    const salt = this.configService.get<string>(
      'DEVICE_FINGERPRINT_SALT',
      'umbrella-referral-salt',
    );
    return createHash('sha256').update(salt + rawFingerprint).digest('hex');
  }

  async upsertDeviceFingerprint(
    userId: string,
    rawFingerprint: string,
    source: string,
  ): Promise<string> {
    const hash = this.hashFingerprint(rawFingerprint);
    await this.prisma.userDeviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash: hash } },
      create: { userId, fingerprintHash: hash, source },
      update: { lastSeenAt: new Date(), source },
    });
    return hash;
  }

  async checkFraud(input: FraudCheckInput): Promise<FraudCheckResult> {
    const { referrerUserId, refereeUserId, refereeDeviceFingerprint } = input;

    // Self-referral is always rejected
    if (referrerUserId === refereeUserId) {
      return { allowed: false, reason: 'Self-referral is not permitted' };
    }

    if (!refereeDeviceFingerprint) {
      return { allowed: true };
    }

    const refereeHash = this.hashFingerprint(refereeDeviceFingerprint);

    // Check if this device fingerprint belongs to the referrer
    const referrerFingerprint = await this.prisma.userDeviceFingerprint.findFirst({
      where: { userId: referrerUserId, fingerprintHash: refereeHash },
    });
    if (referrerFingerprint) {
      return {
        allowed: false,
        reason: 'Device already associated with the referrer account',
      };
    }

    // Check if this device already received a referral discount
    const existingRedeemedReferral = await this.prisma.referral.findFirst({
      where: {
        refereeDeviceFingerprintHash: refereeHash,
        status: { in: ['SUBSCRIBED', 'REWARDED'] },
        refereeDiscountApplied: true,
      },
    });
    if (existingRedeemedReferral) {
      return {
        allowed: false,
        reason: 'This device has already redeemed a referral discount',
      };
    }

    // Check referrer has not exceeded per-fingerprint reward cap
    const maxRewards = Number(
      this.configService.get<string>('REFERRAL_MAX_REWARDS_PER_FINGERPRINT', '10'),
    );
    const referrerRewardCount = await this.prisma.referral.count({
      where: { referrerUserId, status: 'REWARDED' },
    });
    if (referrerRewardCount >= maxRewards) {
      return {
        allowed: false,
        reason: `Referrer has reached the maximum reward limit (${maxRewards})`,
      };
    }

    return { allowed: true };
  }
}
