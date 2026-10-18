import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { FinanceService } from '@/finance/finance.service';
import { getCountryConfig } from '@/config/countries';
import { MarketplaceService } from '@/marketplace/marketplace.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SubscriptionsService } from '@/subscriptions/subscriptions.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { MpesaProvider, mpesaCallbackSignatureValid } from './mpesa.provider';
import { PaymentGateway } from './payment-gateway.interface';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { syncUserCreditBalance } from '@/common/utils/firestore-sync.util';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly mpesaProvider: MpesaProvider,
    private readonly creditLedger: AICreditLedgerService,
    private readonly financeService: FinanceService,
    @Inject(forwardRef(() => MarketplaceService))
    private readonly marketplaceService: MarketplaceService,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createPayment(
    userId: string | undefined,
    tenantId: string | undefined,
    dto: CreatePaymentDto,
  ) {
    const country = getCountryConfig(dto.countryCode);
    const gateway = this.resolveGateway(country.defaultPaymentProvider, dto.countryCode);

    const intent = await gateway.createPaymentIntent({
      amount: dto.amount,
      currency: dto.currency.toUpperCase(),
      countryCode: country.code,
      purpose: dto.purpose,
      metadata: dto.metadata,
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        tenantId,
        countryCode: country.code,
        currency: dto.currency.toUpperCase(),
        amount: new Prisma.Decimal(dto.amount),
        paymentProvider: intent.provider,
        providerPaymentId: intent.providerPaymentId,
        status: intent.status,
        purpose: dto.purpose,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
    });

    return {
      payment,
      intent,
    };
  }

  async listPayments(userId?: string, tenantId?: string) {
    return this.prisma.payment.findMany({
      where: {
        userId: userId || undefined,
        tenantId: tenantId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getReceipt(paymentId: string, tenantId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: tenantId || undefined,
      },
    });
    if (!payment) {
      throw new BadRequestException('Receipt not found for payment');
    }

    return {
      paymentId: payment.id,
      tenantId: payment.tenantId,
      invoiceId: null,
      receiptNumber: `RCPT-${payment.createdAt.getUTCFullYear()}-${payment.id.slice(-8).toUpperCase()}`,
      amount: payment.amount,
      currency: payment.currency,
      issuedAt: payment.createdAt,
    };
  }

  async handleStripeWebhook(rawBody: string, signature?: string) {
    if (!signature || !this.stripeService.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }

    const event = this.parseJsonWebhook(rawBody) as StripeWebhookEvent;
    if (!event.type) {
      throw new BadRequestException('Missing Stripe webhook event type');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data?.object;
      if (intent?.id) {
        await this.markPaymentSuccess({
          provider: 'stripe',
          providerPaymentId: intent.id,
          providerStatus: intent.status ?? event.type,
          invoiceId: intent.metadata?.invoiceId,
          providerEventId: event.id,
          providerReferenceId: intent.id,
        });
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;
      const paymentIntentId = session?.payment_intent;
      if (paymentIntentId) {
        await this.markPaymentSuccess({
          provider: 'stripe',
          providerPaymentId: paymentIntentId,
          providerStatus: session.payment_status ?? event.type,
          invoiceId: session.metadata?.invoiceId,
          providerEventId: event.id,
          providerReferenceId: session.id,
        });
      }
    }

    return {
      received: true,
      provider: 'stripe',
      verified: true,
      eventType: event.type,
      processedAt: new Date().toISOString(),
    };
  }

  async handleMpesaWebhook(rawBody: string, signature?: string) {
    const mpesaEnabled = !!this.configService.get<string>('MPESA_CONSUMER_KEY', '');
    const webhookSecret = this.configService.get<string>('MPESA_WEBHOOK_SECRET', '');

    if (mpesaEnabled) {
      if (
        !webhookSecret ||
        !signature ||
        !mpesaCallbackSignatureValid(rawBody, webhookSecret, signature)
      ) {
        throw new UnauthorizedException('Invalid M-Pesa webhook signature');
      }
    }

    const body = this.mpesaProvider.parseCallbackPayload(rawBody);
    if (!this.mpesaProvider.isSuccessfulCallback(body)) {
      return {
        received: true,
        provider: 'mpesa',
        verified: true,
        status: 'ignored',
        processedAt: new Date().toISOString(),
      };
    }

    const checkoutRequestId = this.mpesaProvider.getCallbackCheckoutRequestId(body);
    if (checkoutRequestId) {
      await this.markPaymentSuccess({
        provider: 'mpesa',
        providerPaymentId: checkoutRequestId,
        providerStatus: 'completed',
        providerEventId: 'stk_callback',
        providerReferenceId: checkoutRequestId,
      });
    }

    return {
      received: true,
      provider: 'mpesa',
      verified: true,
      eventType: 'stk_callback',
      processedAt: new Date().toISOString(),
    };
  }

  private parseJsonWebhook(payload: string): Record<string, unknown> {
    try {
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Webhook payload is not valid JSON');
    }
  }

  private async markPaymentSuccess(input: {
    provider: 'stripe' | 'mpesa';
    providerPaymentId: string;
    providerStatus: string;
    invoiceId?: string;
    providerEventId?: string;
    providerReferenceId?: string;
  }) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        paymentProvider: input.provider,
        providerPaymentId: input.providerPaymentId,
      },
    });

    if (!payment) {
      return;
    }

    const metadata = this.toMetadataObject(payment.metadata);
    if (input.providerEventId) {
      metadata.providerEventId = input.providerEventId;
    }
    if (input.providerReferenceId) {
      metadata.providerReferenceId = input.providerReferenceId;
    }
    metadata.providerStatus = input.providerStatus;
    metadata.processedAt = new Date().toISOString();

    const invoiceId = input.invoiceId ?? metadata.invoiceId;
    if (typeof invoiceId === 'string' && invoiceId) {
      metadata.invoiceId = invoiceId;
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    await this.ensureReceipt(updatedPayment.id, updatedPayment.tenantId ?? undefined, input.invoiceId);

    if (typeof invoiceId === 'string' && invoiceId) {
      await this.prisma.invoice.updateMany({
        where: { id: invoiceId, status: { not: 'PAID' } },
        data: { status: 'PAID' },
      });

      await this.financeService.reconcilePaymentFromWebhook(
        updatedPayment.id,
        updatedPayment.tenantId ?? undefined,
      );
    }

    if (
      updatedPayment.purpose === 'lawyer_review' &&
      typeof metadata.reviewRequestId === 'string'
    ) {
      await this.marketplaceService.onReviewPaymentSucceeded(
        metadata.reviewRequestId,
        updatedPayment.id,
      );
    }

    if (
      updatedPayment.purpose === 'subscription' &&
      typeof metadata.subscriptionId === 'string'
    ) {
      await this.subscriptionsService.activateSubscription(metadata.subscriptionId);
    }

    if (updatedPayment.purpose === 'AI_CREDIT_TOPUP') {
      const credits = Number(metadata.credits ?? 0);
      const tenantId =
        metadata.tenantId ?? updatedPayment.tenantId ?? undefined;
      const userId = tenantId ? undefined : updatedPayment.userId ?? undefined;

      if (credits > 0 && (userId || tenantId)) {
        await this.creditLedger.credit({
          userId,
          tenantId,
          taskType: 'credit_topup',
          credits,
          metadata: {
            paymentId: updatedPayment.id,
            packId: metadata.packId ?? '',
            autoTopUp: metadata.autoTopUp ?? 'false',
          },
        });

        if (userId) {
          // Sync updated balance to Firestore for real-time UI updates
          void this.syncCreditBalanceToFirestore(userId, credits);
        }
      }
    }

    // Platform revenue ledger — idempotent write for every successful payment
    void this.upsertPlatformRevenue(updatedPayment);
  }

  private async upsertPlatformRevenue(payment: {
    id: string;
    purpose?: string | null;
    amount: Prisma.Decimal;
    currency: string;
    countryCode?: string | null;
    tenantId?: string | null;
    userId?: string | null;
    paymentProvider?: string | null;
    createdAt: Date;
  }) {
    try {
      const gross = Number(payment.amount);
      const source = mapPurposeToRevenueSource(payment.purpose ?? '');
      await this.prisma.platformRevenueEntry.upsert({
        where: { providerRef: `payment:${payment.id}` },
        create: {
          source,
          grossAmount: new Prisma.Decimal(gross),
          taxAmount: new Prisma.Decimal(0),
          feeAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(gross),
          currency: payment.currency,
          countryCode: payment.countryCode,
          tenantId: payment.tenantId,
          userId: payment.userId,
          paymentProvider: payment.paymentProvider ?? 'unknown',
          providerRef: `payment:${payment.id}`,
          occurredAt: payment.createdAt,
          metadata: { paymentId: payment.id } as Prisma.InputJsonValue,
        },
        update: {},
      });
    } catch (err) {
      // Non-fatal — revenue ledger write should never break the payment flow
      console.warn('[PlatformAccounting] revenue upsert failed:', (err as Error).message);
    }
  }

  async handleAutoTopUpSuccess(input: {
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
  }

  private async syncCreditBalanceToFirestore(userId: string, creditsAdded: number): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firebaseUid: true, countryCode: true },
      });
      if (!user?.firebaseUid) return;

      const profile = await this.prisma.consumerProfile.findFirst({
        where: { userId },
        select: { aiCreditsRemaining: true },
      });
      const balance = profile?.aiCreditsRemaining ?? creditsAdded;

      await syncUserCreditBalance({
        firebaseUid: user.firebaseUid,
        balance: Number(balance),
        userSegment: 'CONSUMER',
        countryCode: user.countryCode ?? 'US',
      });
    } catch (err) {
      console.warn('[Firestore] syncCreditBalanceToFirestore error:', (err as Error).message);
    }
  }

  private toMetadataObject(metadata: Prisma.JsonValue | null): Record<string, string> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }

    return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else if (value != null) {
        acc[key] = String(value);
      }
      return acc;
    }, {});
  }

  private resolveGateway(provider: string, countryCode?: string): PaymentGateway {
    if (provider === 'mpesa') {
      return this.mpesaProvider;
    }
    if (countryCode?.toUpperCase() === 'KE') {
      const mpesaKey = this.configService.get<string>('MPESA_CONSUMER_KEY', '');
      if (mpesaKey) {
        return this.mpesaProvider;
      }
    }

    return this.stripeService;
  }

  private async ensureReceipt(paymentId: string, tenantId?: string, invoiceId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      return null;
    }

    const receiptNumber = `RCPT-${payment.createdAt.getUTCFullYear()}-${paymentId.slice(-8).toUpperCase()}`;

    return this.prisma.receipt.upsert({
      where: { paymentId },
      create: {
        paymentId,
        tenantId: tenantId ?? payment.tenantId ?? undefined,
        invoiceId,
        receiptNumber,
        amount: payment.amount,
        currency: payment.currency,
        issuedAt: payment.createdAt,
      },
      update: {
        tenantId: tenantId ?? payment.tenantId ?? undefined,
        invoiceId,
        amount: payment.amount,
        currency: payment.currency,
      },
    });
  }
}

type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      payment_status?: string;
      payment_intent?: string;
      metadata?: Record<string, string>;
    };
  };
};

function mapPurposeToRevenueSource(purpose: string): string {
  if (purpose === 'subscription') return 'subscription';
  if (purpose === 'AI_CREDIT_TOPUP') return 'credit_topup';
  if (purpose === 'lawyer_review') return 'lawyer_review';
  if (purpose === 'marketplace') return 'marketplace';
  return 'other';
}

