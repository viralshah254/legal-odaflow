import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditPack } from '@/ai-credits/credit-packs';
import { getCountryConfig } from '@/config/countries';
import { PrismaService } from '@/prisma/prisma.service';
import { StripeService } from '@/payments/stripe.service';

const AUTO_TOPUP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AutoTopUpService {
  private readonly logger = new Logger(AutoTopUpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly creditLedger: AICreditLedgerService,
  ) {}

  async createSetupIntent(params: { userId: string; tenantId?: string; email?: string }) {
    const wallet = await this.resolveWalletRecord(params);
    let customerId = wallet.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripeService.createCustomer({
        email: params.email,
        metadata: {
          userId: params.userId,
          tenantId: params.tenantId ?? '',
        },
      });
      customerId = customer.id;
      await this.saveStripeCustomer(params, customerId);
    }

    return this.stripeService.createSetupIntent(customerId);
  }

  async confirmPaymentMethod(params: {
    userId: string;
    tenantId?: string;
    paymentMethodId: string;
  }) {
    const wallet = await this.resolveWalletRecord(params);
    let customerId = wallet.stripeCustomerId;

    if (!customerId) {
      throw new BadRequestException('Complete setup intent before confirming payment method');
    }

    await this.stripeService.attachPaymentMethod(customerId, params.paymentMethodId);
    await this.savePaymentMethod(params, params.paymentMethodId);
    return { success: true, hasPaymentMethod: true };
  }

  async maybeTriggerAutoTopUp(params: {
    userId: string;
    tenantId?: string;
    balance: number;
    countryCode: string;
  }) {
    const wallet = await this.resolveWalletRecord(params);
    if (!wallet.autoTopUpEnabled || !wallet.stripePaymentMethodId || !wallet.stripeCustomerId) {
      return { triggered: false };
    }

    if (params.balance > wallet.autoTopUpThresholdCredits) {
      return { triggered: false };
    }

    if (
      wallet.autoTopUpLastTriggeredAt &&
      Date.now() - wallet.autoTopUpLastTriggeredAt.getTime() < AUTO_TOPUP_COOLDOWN_MS
    ) {
      return { triggered: false, reason: 'cooldown' };
    }

    const country = getCountryConfig(params.countryCode);
    if (country.defaultPaymentProvider !== 'stripe') {
      return { triggered: false, reason: 'unsupported_provider' };
    }

    const pack = getCreditPack(params.countryCode, wallet.autoTopUpPackId);
    const idempotencyKey = `auto_topup_${params.tenantId ?? params.userId}_${new Date().toISOString().slice(0, 10)}`;

    try {
      const intent = await this.stripeService.chargeOffSession({
        amount: pack.amount,
        currency: pack.currency,
        customerId: wallet.stripeCustomerId,
        paymentMethodId: wallet.stripePaymentMethodId,
        purpose: 'AI_CREDIT_TOPUP',
        idempotencyKey,
        metadata: {
          packId: pack.packId,
          credits: String(pack.credits),
          userId: params.userId,
          tenantId: params.tenantId ?? '',
          autoTopUp: 'true',
        },
      });

      if (intent.status === 'succeeded') {
        await this.recordAutoTopUpSuccess({
          userId: params.userId,
          tenantId: params.tenantId,
          credits: pack.credits,
          paymentProviderId: intent.providerPaymentId,
          packId: pack.packId,
          amount: pack.amount,
          currency: pack.currency,
          countryCode: params.countryCode,
        });
        await this.markTriggered(params);
        return { triggered: true, credits: pack.credits };
      }
    } catch (error) {
      this.logger.warn(
        `Auto top-up failed for ${params.tenantId ?? params.userId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await this.disableAutoTopUp(params);
    }

    return { triggered: false, reason: 'payment_failed' };
  }

  private async resolveWalletRecord(params: { userId: string; tenantId?: string }) {
    if (params.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
      });
      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }
      return {
        autoTopUpEnabled: tenant.autoTopUpEnabled,
        autoTopUpThresholdCredits: tenant.autoTopUpThresholdCredits,
        autoTopUpPackId: tenant.autoTopUpPackId,
        stripeCustomerId: tenant.stripeCustomerId,
        stripePaymentMethodId: tenant.stripePaymentMethodId,
        autoTopUpLastTriggeredAt: tenant.autoTopUpLastTriggeredAt,
      };
    }

    const profile = await this.prisma.consumerProfile.findUnique({
      where: { userId: params.userId },
    });
    if (!profile) {
      throw new BadRequestException('Consumer profile not found');
    }
    return {
      autoTopUpEnabled: profile.autoTopUpEnabled,
      autoTopUpThresholdCredits: profile.autoTopUpThresholdCredits,
      autoTopUpPackId: profile.autoTopUpPackId,
      stripeCustomerId: profile.stripeCustomerId,
      stripePaymentMethodId: profile.stripePaymentMethodId,
      autoTopUpLastTriggeredAt: profile.autoTopUpLastTriggeredAt,
    };
  }

  private async saveStripeCustomer(
    params: { userId: string; tenantId?: string },
    customerId: string,
  ) {
    if (params.tenantId) {
      await this.prisma.tenant.update({
        where: { id: params.tenantId },
        data: { stripeCustomerId: customerId },
      });
      return;
    }
    await this.prisma.consumerProfile.update({
      where: { userId: params.userId },
      data: { stripeCustomerId: customerId },
    });
  }

  private async savePaymentMethod(
    params: { userId: string; tenantId?: string },
    paymentMethodId: string,
  ) {
    if (params.tenantId) {
      await this.prisma.tenant.update({
        where: { id: params.tenantId },
        data: { stripePaymentMethodId: paymentMethodId },
      });
      return;
    }
    await this.prisma.consumerProfile.update({
      where: { userId: params.userId },
      data: { stripePaymentMethodId: paymentMethodId },
    });
  }

  private async markTriggered(params: { userId: string; tenantId?: string }) {
    const now = new Date();
    if (params.tenantId) {
      await this.prisma.tenant.update({
        where: { id: params.tenantId },
        data: { autoTopUpLastTriggeredAt: now },
      });
      return;
    }
    await this.prisma.consumerProfile.update({
      where: { userId: params.userId },
      data: { autoTopUpLastTriggeredAt: now },
    });
  }

  private async disableAutoTopUp(params: { userId: string; tenantId?: string }) {
    if (params.tenantId) {
      await this.prisma.tenant.update({
        where: { id: params.tenantId },
        data: { autoTopUpEnabled: false },
      });
      return;
    }
    await this.prisma.consumerProfile.update({
      where: { userId: params.userId },
      data: { autoTopUpEnabled: false },
    });
  }

  private async recordAutoTopUpSuccess(input: {
    userId: string;
    tenantId?: string;
    credits: number;
    paymentProviderId: string;
    packId: string;
    amount: number;
    currency: string;
    countryCode: string;
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        countryCode: input.countryCode,
        currency: input.currency.toUpperCase(),
        amount: new Prisma.Decimal(input.amount),
        paymentProvider: 'stripe',
        providerPaymentId: input.paymentProviderId,
        status: 'PAID',
        purpose: 'AI_CREDIT_TOPUP',
        metadata: {
          packId: input.packId,
          credits: String(input.credits),
          userId: input.userId,
          tenantId: input.tenantId ?? '',
          autoTopUp: 'true',
        } as Prisma.InputJsonValue,
      },
    });

    await this.creditLedger.credit({
      userId: input.tenantId ? undefined : input.userId,
      tenantId: input.tenantId,
      taskType: 'credit_topup',
      credits: input.credits,
      metadata: {
        paymentId: payment.id,
        packId: input.packId,
        autoTopUp: 'true',
      },
    });

    if (!input.tenantId) {
      await this.prisma.consumerProfile.updateMany({
        where: { userId: input.userId },
        data: { aiCreditsRemaining: { increment: input.credits } },
      });
    }
  }
}
