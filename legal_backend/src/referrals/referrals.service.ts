import { randomBytes } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { ReferralFraudService } from './referral-fraud.service';
import { buildReferralShareUrl, resolveAppUrl } from '@/common/app-url';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly fraudService: ReferralFraudService,
    private readonly configService: ConfigService,
  ) {}

  // ── Code management ────────────────────────────────────────────────────────

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  async ensureReferralCode(userId: string): Promise<string> {
    const existing = await this.prisma.referralCode.findUnique({
      where: { userId },
    });
    if (existing) return existing.code;

    // Collision-safe creation with up to 5 retries
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      try {
        await this.prisma.referralCode.create({ data: { userId, code } });
        return code;
      } catch {
        // Unique constraint violation — retry
      }
    }
    throw new Error('Failed to generate unique referral code after 5 attempts');
  }

  // ── User stats ─────────────────────────────────────────────────────────────

  async getMyStats(userId: string) {
    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
    const code = await this.ensureReferralCode(userId);

    const [pending, subscribed, rewarded] = await Promise.all([
      this.prisma.referral.count({ where: { referrerUserId: userId, status: 'PENDING' } }),
      this.prisma.referral.count({ where: { referrerUserId: userId, status: 'SUBSCRIBED' } }),
      this.prisma.referral.count({ where: { referrerUserId: userId, status: 'REWARDED' } }),
    ]);

    const rewardedReferrals = await this.prisma.referral.findMany({
      where: { referrerUserId: userId, status: 'REWARDED' },
      select: { referrerRewardCredits: true },
    });
    const totalCreditsEarned = rewardedReferrals.reduce(
      (sum, r) => sum + (r.referrerRewardCredits ?? 0),
      0,
    );

    return {
      code,
      shareUrl: buildReferralShareUrl(appUrl, code),
      stats: {
        signedUp: pending + subscribed + rewarded,
        pending,
        subscribed,
        rewarded,
        totalCreditsEarned,
      },
    };
  }

  // ── Preview a referral code (public, unauthenticated) ─────────────────────

  async previewReferral(code: string): Promise<
    | { valid: true; referrerDisplayName: string; userType: string }
    | { valid: false }
  > {
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            name: true,
            userType: true,
            tenantUsers: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { tenant: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!referralCode) return { valid: false };

    const { user } = referralCode;
    const isLawyer = user.userType === 'LAWYER';
    const referrerDisplayName =
      user.name?.trim() ||
      (isLawyer ? user.tenantUsers[0]?.tenant?.name?.trim() : undefined) ||
      'An Umbrella member';

    return { valid: true, referrerDisplayName, userType: user.userType };
  }

  // ── Apply a referral code (post-signup or at signup) ──────────────────────

  async applyReferralCode(input: {
    refereeUserId: string;
    code: string;
    deviceFingerprint?: string;
    ipAddress?: string;
  }) {
    const { refereeUserId, code, deviceFingerprint, ipAddress } = input;

    // Referee must not already have a referral attribution
    const existing = await this.prisma.referral.findUnique({
      where: { refereeUserId },
    });
    if (existing) {
      throw new ConflictException('A referral is already attributed to this account');
    }

    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      include: { user: { select: { id: true, userType: true } } },
    });
    if (!referralCode) {
      throw new NotFoundException('Invalid referral code');
    }

    const referrerUserId = referralCode.userId;

    // Fraud check
    const fraud = await this.fraudService.checkFraud({
      referrerUserId,
      refereeUserId,
      refereeDeviceFingerprint: deviceFingerprint,
    });
    if (!fraud.allowed) {
      throw new BadRequestException(`Referral rejected: ${fraud.reason}`);
    }

    const fingerprintHash = deviceFingerprint
      ? this.fraudService.hashFingerprint(deviceFingerprint)
      : undefined;

    // Record device fingerprint sighting for referee
    if (deviceFingerprint) {
      await this.fraudService.upsertDeviceFingerprint(refereeUserId, deviceFingerprint, 'signup');
    }

    await this.prisma.referral.create({
      data: {
        referrerUserId,
        refereeUserId,
        referralCode: code,
        status: 'PENDING',
        refereeDeviceFingerprintHash: fingerprintHash,
        refereeSignupIp: ipAddress,
      },
    });

    return { attributed: true, referrerUserId };
  }

  // ── Register device fingerprint ────────────────────────────────────────────

  async registerDeviceFingerprint(
    userId: string,
    rawFingerprint: string,
    source: string,
  ): Promise<void> {
    await this.fraudService.upsertDeviceFingerprint(userId, rawFingerprint, source);
  }

  // ── Get pending referral for a user (for checkout discount) ───────────────

  async getPendingReferralForUser(userId: string) {
    const attributionDays = Number(
      this.configService.get<string>('REFERRAL_ATTRIBUTION_DAYS', '90'),
    );
    const cutoff = new Date(Date.now() - attributionDays * 24 * 60 * 60 * 1000);

    // Include SUBSCRIBED so abandoned-checkout retries still get the discount
    return this.prisma.referral.findFirst({
      where: {
        refereeUserId: userId,
        status: { in: ['PENDING', 'SUBSCRIBED'] },
        createdAt: { gte: cutoff },
      },
    });
  }

  // ── Validate referral for checkout (must pass fraud before discount) ───────

  async validateReferralForCheckout(input: {
    refereeUserId: string;
    deviceFingerprint?: string;
  }): Promise<{ eligible: boolean; referralId?: string; reason?: string }> {
    const referral = await this.getPendingReferralForUser(input.refereeUserId);
    if (!referral) {
      return { eligible: false, reason: 'No pending referral attribution found' };
    }

    const fraud = await this.fraudService.checkFraud({
      referrerUserId: referral.referrerUserId,
      refereeUserId: input.refereeUserId,
      refereeDeviceFingerprint: input.deviceFingerprint,
    });

    if (!fraud.allowed) {
      // Mark the referral as rejected so admin can see it
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'REJECTED', rejectionReason: fraud.reason },
      });
      return { eligible: false, reason: fraud.reason };
    }

    return { eligible: true, referralId: referral.id };
  }

  // ── Referee status (for UI discount display) ──────────────────────────────

  async getRefereeStatus(userId: string): Promise<{
    hasReferral: boolean;
    eligibleForDiscount: boolean;
    discountPercent: number;
    referrerDisplayName?: string;
    attributedAt?: Date;
  }> {
    const referral = await this.getPendingReferralForUser(userId);
    if (!referral) {
      return { hasReferral: false, eligibleForDiscount: false, discountPercent: 0 };
    }

    const referrer = await this.prisma.user.findUnique({
      where: { id: referral.referrerUserId },
      select: { name: true },
    });

    return {
      hasReferral: true,
      eligibleForDiscount: true,
      discountPercent: 40,
      referrerDisplayName: referrer?.name?.trim() || undefined,
      attributedAt: referral.createdAt,
    };
  }

  // ── Mark referral as SUBSCRIBED when checkout session is created ──────────

  async markReferralSubscribed(referralId: string): Promise<void> {
    await this.prisma.referral
      .update({
        where: { id: referralId, status: 'PENDING' },
        data: { status: 'SUBSCRIBED', subscribedAt: new Date() },
      })
      .catch(() => undefined); // idempotent — silently skip if already advanced
  }

  // ── Fulfillment hook — called after subscription becomes ACTIVE ──────────

  /**
   * Runs referral reward fulfillment for any user type.
   * For consumers pass only `userId`; for law-firm subscriptions also pass `tenantId`
   * so the first-subscription guard checks the tenant's history rather than the
   * individual user's consumer subscription history.
   */
  async onConsumerSubscriptionActivated(input: {
    subscriptionId: string;
    userId: string | null | undefined;
    /** When set, first-subscription guard checks this tenant's prior subs. */
    tenantId?: string | null;
  }) {
    if (!input.userId) return;

    const referral = await this.prisma.referral.findUnique({
      where: { refereeUserId: input.userId },
    });

    // Only process PENDING or SUBSCRIBED referrals — idempotency guard
    if (!referral || !['PENDING', 'SUBSCRIBED'].includes(referral.status)) return;

    // Ensure this is truly the first paid subscription for this account
    const priorActiveSubs = await this.prisma.subscription.count({
      where: {
        // For law-firm subscriptions, check tenant history; for consumers, check user history
        ...(input.tenantId ? { tenantId: input.tenantId } : { userId: input.userId }),
        status: { in: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING'] },
        id: { not: input.subscriptionId },
      },
    });
    if (priorActiveSubs > 0) {
      const subject = input.tenantId ? `tenant ${input.tenantId}` : `user ${input.userId}`;
      this.logger.warn(`Skipping referral reward for ${subject}: not first subscription`);
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'REJECTED', rejectionReason: 'Not the first subscription' },
      });
      return;
    }

    // Attribution window check
    const attributionDays = Number(
      this.configService.get<string>('REFERRAL_ATTRIBUTION_DAYS', '90'),
    );
    const cutoff = new Date(Date.now() - attributionDays * 24 * 60 * 60 * 1000);
    if (referral.createdAt < cutoff) {
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: { status: 'REJECTED', rejectionReason: 'Attribution window expired' },
      });
      return;
    }

    // Compute credit reward
    const rewardUsd = Number(
      this.configService.get<string>('REFERRAL_REWARD_USD', '10'),
    );
    const creditUsdValue = Number(
      this.configService.get<string>('AI_CREDIT_USD_VALUE', '0.06'),
    );
    const rewardCredits = Math.floor(rewardUsd / creditUsdValue);

    // Determine whether referrer is a consumer or lawyer (for credit target)
    const referrer = await this.prisma.user.findUnique({
      where: { id: referral.referrerUserId },
      select: {
        userType: true,
        tenantUsers: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { tenantId: true },
        },
      },
    });

    if (!referrer) return;

    const isLawyer = referrer.userType === 'LAWYER';
    const tenantId = isLawyer ? referrer.tenantUsers[0]?.tenantId : undefined;

    await this.prisma.$transaction(async (tx) => {
      // Mark referral as REWARDED
      await tx.referral.update({
        where: { id: referral.id },
        data: {
          status: 'REWARDED',
          subscriptionId: input.subscriptionId,
          subscribedAt: new Date(),
          rewardedAt: new Date(),
          referrerRewardCredits: rewardCredits,
          refereeDiscountApplied: true,
        },
      });

      // Credit the referrer
      await this.creditLedger.credit({
        userId: isLawyer ? undefined : referral.referrerUserId,
        tenantId,
        taskType: 'referral_reward',
        credits: rewardCredits,
        metadata: {
          referralId: referral.id,
          refereeUserId: input.userId!,
          subscriptionId: input.subscriptionId,
          rewardUsd: String(rewardUsd),
          isLawyerReferrer: String(isLawyer),
          tenantId: tenantId ?? '',
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: referral.referrerUserId,
          action: 'REFERRAL_REWARDED',
          entityType: 'Referral',
          entityId: referral.id,
          metadata: {
            refereeUserId: input.userId!,
            rewardCredits,
            subscriptionId: input.subscriptionId,
          } as any,
        },
      });
    });

    this.logger.log(
      `Referral rewarded: referrer=${referral.referrerUserId} credits=${rewardCredits} referral=${referral.id}`,
    );
  }
}
