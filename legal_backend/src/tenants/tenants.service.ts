import { BadRequestException, Injectable, ConflictException, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { getCountryConfig } from '@/config/countries';
import { USER_TYPES } from '@/auth/constants';
import { PasswordPolicyService } from '@/auth/password/password-policy.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { AICreditBudgetService } from '@/ai-credits/ai-credit-budget.service';
import { getCreditPack, listCreditPacks } from '@/ai-credits/credit-packs';
import { computeCreditsFromPayment, DEFAULT_CREDIT_USD_VALUE } from '@/ai-credits/credit-pricing.util';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { PaymentsService } from '@/payments/payments.service';
import { StripeService } from '@/payments/stripe.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { CreditTopupCheckoutDto } from '@/consumers/dto/credit-topup.dto';
import { UpdateAiPreferencesDto } from '@/credits/dto/update-ai-preferences.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';
import { UpdateUserSeatPlanDto } from './dto/update-user-seat-plan.dto';
import { resolveAppUrl } from '@/common/app-url';

const INVITATION_EXPIRY_HOURS = 48;

const CURRENCY_MULTIPLIERS: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  INR: 83,
  KES: 129,
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly creditBudget: AICreditBudgetService,
    private readonly creditWallet: CreditWalletService,
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly aiPreferences: AiPreferencesService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async findForUser(userId: string) {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        tenant: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) => ({
      tenantId: membership.tenantId,
      role: membership.role,
      tenant: membership.tenant,
    }));
  }

  async createUser(tenantId: string, actorUserId: string, dto: CreateTenantUserDto) {
    await this.ensureAdmin(tenantId, actorUserId);

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      const existingMembership = await this.prisma.tenantUser.findUnique({
        where: { tenantId_userId: { tenantId, userId: existing.id } },
      });
      if (existingMembership) {
        throw new ConflictException('This user is already a member of your firm');
      }
      throw new ConflictException(
        'An account with this email already exists. Ask them to sign in, then add them from their profile.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const country = getCountryConfig(tenant.primaryCountry);

    // Decide: invitation flow (no password) or temp-password flow
    const useInvitation = !dto.password;
    let passwordHash: string | undefined;
    let invitationToken: string | undefined;
    let invitationExpiresAt: Date | undefined;

    if (useInvitation) {
      invitationToken = crypto.randomBytes(32).toString('hex');
      invitationExpiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
    } else {
      await this.passwordPolicy.assertValidIncludingBreachCheck(dto.password!, {
        email: dto.email,
        name: dto.name,
        firmName: tenant.name,
      });
      passwordHash = await bcrypt.hash(dto.password!, 12);
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          userType: USER_TYPES.LAWYER,
          countryCode: country.code,
          mustChangePassword: dto.mustChangePassword ?? (useInvitation ? false : true),
          ...(useInvitation
            ? {
                invitationToken,
                invitationStatus: 'PENDING',
                invitedAt: new Date(),
                invitationExpiresAt,
              }
            : {}),
        },
      });

      const extDto = dto as CreateTenantUserDto & {
        seatPlan?: string;
        practiceAreas?: string[];
        displayTitle?: string;
      };

      const createdMembership = await tx.tenantUser.create({
        data: {
          tenantId,
          userId: user.id,
          role: dto.role,
          status: useInvitation ? 'INVITED' : 'ACTIVE',
          seatPlan: extDto.seatPlan ?? 'STARTER',
          practiceAreas: extDto.practiceAreas ?? undefined,
          displayTitle: extDto.displayTitle ?? undefined,
          monthlyCreditLimit: dto.monthlyCreditLimit ?? null,
          isBillableSeat: dto.isBillableSeat ?? true,
        } as any,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              countryCode: true,
              isActive: true,
              mustChangePassword: true,
              invitationStatus: true,
            },
          },
        },
      });

      await tx.lawyerProfile.create({
        data: {
          userId: user.id,
          tenantId,
          countryCode: country.code,
          practiceAreas: ['General Practice'],
          jurisdictions: country.supportedJurisdictions.slice(0, 3),
          languages: [country.defaultLocale.split('-')[0]],
          currency: country.currency,
          acceptsLeads: true,
        },
      });

      return createdMembership;
    });

    const result = this.formatTenantUser(membership);

    // Return the invitation URL if using invitation flow
    if (useInvitation && invitationToken) {
      const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
      return {
        ...result,
        invitationUrl: `${appUrl}/accept-invitation?token=${invitationToken}`,
        invitationExpiresAt: invitationExpiresAt?.toISOString(),
      };
    }

    return result;
  }

  /** Accept a team invitation — public flow (no auth required). */
  async acceptInvitation(token: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { invitationToken: token },
    });

    if (!user) throw new UnauthorizedException('Invalid invitation link');
    if ((user as any).invitationStatus !== 'PENDING') {
      throw new UnauthorizedException('This invitation has already been used or revoked');
    }
    if ((user as any).invitationExpiresAt && new Date() > (user as any).invitationExpiresAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { invitationStatus: 'EXPIRED' } as any,
      });
      throw new UnauthorizedException('This invitation link has expired. Ask your admin to send a new one.');
    }

    // Validate password strength
    const membership = await this.prisma.tenantUser.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });

    await this.passwordPolicy.assertValidIncludingBreachCheck(password, {
      email: user.email,
      name: user.name ?? undefined,
      firmName: membership?.tenant?.name,
    });

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          invitationStatus: 'ACCEPTED',
          invitationAcceptedAt: new Date(),
          invitationToken: null,
          firstLoginAt: new Date(),
        } as any,
      });

      // Activate the TenantUser membership
      await tx.tenantUser.updateMany({
        where: { userId: user.id, status: 'INVITED' },
        data: { status: 'ACTIVE' },
      });
    });

    return { message: 'Invitation accepted. You can now sign in.' };
  }

  async findById(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
      include: { tenant: true },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenantId: membership.tenantId,
      role: membership.role,
      tenant: membership.tenant,
    };
  }

  async updateTenant(
    tenantId: string,
    userId: string,
    data: {
      name?: string;
      billingPlan?: string;
      dataRegion?: string;
      ssoConfig?: Record<string, unknown>;
    },
  ) {
    await this.ensureAdmin(tenantId, userId);

    if (data.ssoConfig?.enabled) {
      this.assertSamlConfigComplete(data.ssoConfig);
    }

    if (data.ssoConfig?.scimEnabled) {
      this.assertScimConfigComplete(data.ssoConfig);
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        billingPlan: data.billingPlan,
        dataRegion: data.dataRegion,
        ssoConfig: data.ssoConfig as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listUsers(tenantId: string, userId: string) {
    await this.ensureAdmin(tenantId, userId);

    const memberships = await this.prisma.tenantUser.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            countryCode: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => this.formatTenantUser({
      ...m,
      practiceAreas: m.practiceAreas,
      specialtyLevel: m.specialtyLevel,
      displayTitle: m.displayTitle,
    }));
  }

  async updateUser(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateTenantUserDto,
  ) {
    await this.ensureAdmin(tenantId, actorUserId);

    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Tenant user not found');
    }

    if (dto.name !== undefined || dto.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { name: dto.name, phone: dto.phone },
      });
    }

    const extDto = dto as UpdateTenantUserDto & {
      practiceAreas?: string[];
      specialtyLevel?: Record<string, string>;
      displayTitle?: string;
    };

    // Build TenantUser update data
    const tenantUserData: Record<string, unknown> = {
      role: dto.role,
      status: dto.status,
      ...(extDto.practiceAreas !== undefined ? { practiceAreas: extDto.practiceAreas } : {}),
      ...(extDto.specialtyLevel !== undefined ? { specialtyLevel: extDto.specialtyLevel as Prisma.InputJsonValue } : {}),
      ...(extDto.displayTitle !== undefined ? { displayTitle: extDto.displayTitle } : {}),
    };

    // Per-user credit limit (null removes the cap)
    if ('monthlyCreditLimit' in dto) {
      tenantUserData['monthlyCreditLimit'] = dto.monthlyCreditLimit ?? null;
    }

    // Seat billing fields
    if (dto.isBillableSeat !== undefined) {
      tenantUserData['isBillableSeat'] = dto.isBillableSeat;
    }
    if (dto.billingStatus !== undefined) {
      tenantUserData['billingStatus'] = dto.billingStatus;
    }

    // Cycle reset — set override timestamp to now (does not alter ledger history)
    if (dto.resetCreditCycle) {
      tenantUserData['creditCycleOverrideAt'] = new Date();
    }

    const updated = await this.prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: tenantUserData as any,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            countryCode: true,
            isActive: true,
          },
        },
      },
    });

    return this.formatTenantUser({
      ...updated,
      practiceAreas: updated.practiceAreas,
      specialtyLevel: updated.specialtyLevel,
      displayTitle: updated.displayTitle,
    });
  }

  async getCredits(tenantId: string, userId: string) {
    await this.findById(tenantId, userId);

    const wallet = await this.creditWallet.getTenantWallet(tenantId);
    if (!wallet) {
      throw new NotFoundException('Tenant not found');
    }

    const balance = await this.creditLedger.getBalance({ tenantId });
    const recentLedger = await this.prisma.aICreditLedger.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { primaryCountry: true, aiCreditsRemaining: true },
    });

    return {
      ...wallet,
      balance,
      profileBalance: tenant?.aiCreditsRemaining ?? 0,
      countryCode: tenant?.primaryCountry ?? wallet.wallet.countryCode,
      ledger: recentLedger.map((entry) => ({
        id: entry.id,
        eventType: entry.eventType,
        taskType: entry.taskType,
        credits: entry.credits,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async updateAiPreferences(
    tenantId: string,
    userId: string,
    dto: UpdateAiPreferencesDto,
  ) {
    await this.ensureAdmin(tenantId, userId);
    return this.aiPreferences.updateForTenant(tenantId, dto);
  }

  async createCreditTopupCheckout(
    tenantId: string,
    userId: string,
    dto: CreditTopupCheckoutDto,
  ) {
    await this.ensureAdmin(tenantId, userId);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const appUrl = resolveAppUrl(this.configService.get<string>('APP_URL'));
    const resolvedCountry = dto.countryCode ?? tenant.primaryCountry;
    const countryConfig = getCountryConfig(resolvedCountry);
    const currency = countryConfig.currency;
    const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 1;

    let amount: number;
    let packId: string;
    let credits: number;

    if (dto.customAmountUsd && dto.customAmountUsd >= 5) {
      // Custom amount: convert USD to local currency and compute credits
      amount = Number((dto.customAmountUsd * multiplier).toFixed(2));
      packId = 'custom';
      const creditUsdValue = Number(process.env.AI_CREDIT_USD_VALUE ?? DEFAULT_CREDIT_USD_VALUE);
      credits = computeCreditsFromPayment(dto.customAmountUsd, creditUsdValue, 40);
    } else if (dto.packId) {
      const pack = getCreditPack(resolvedCountry, dto.packId, tenant.billingPlan);
      amount = pack.amount;
      packId = pack.packId;
      credits = pack.credits;
    } else {
      throw new Error('Either packId or customAmountUsd (min $5) must be provided');
    }

    const { payment, intent } = await this.paymentsService.createPayment(userId, tenantId, {
      amount,
      currency,
      countryCode: resolvedCountry,
      purpose: 'AI_CREDIT_TOPUP',
      metadata: {
        packId,
        credits: String(credits),
        tenantId,
        userId,
      },
    });

    let checkoutUrl = intent.checkoutUrl ?? null;

    if (intent.provider === 'stripe' && !intent.checkoutUrl) {
      const productName =
        packId === 'custom'
          ? `${credits} AI Credits (custom top-up)`
          : `${credits} AI Credits`;
      const returnBase = dto.returnPath
        ? `${appUrl}${dto.returnPath}`
        : `${appUrl}/app/settings/plan-usage`;

      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

      try {
        const session = await this.stripeService.createDynamicCheckoutSession({
          amountMinorUnits: Math.round(amount * 100),
          currency,
          productName,
          productDescription: `${credits} AI credits added to your Umbrella account`,
          mode: 'payment',
          successUrl: `${returnBase}${dto.returnPath?.includes('?') ? '&' : '?'}topup=${payment.id}&status=success`,
          cancelUrl: returnBase,
          email: user?.email ?? undefined,
          customerId: tenant.stripeCustomerId ?? undefined,
          metadata: {
            paymentId: payment.id,
            packId,
            credits: String(credits),
            tenantId,
            userId,
            purpose: 'AI_CREDIT_TOPUP',
          },
        });
        if (session.url) {
          checkoutUrl = session.url;
        } else {
          throw new ServiceUnavailableException('Stripe returned no checkout URL. Check Stripe Dashboard configuration.');
        }
      } catch (err) {
        if (err instanceof ServiceUnavailableException || err instanceof BadRequestException) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new ServiceUnavailableException(`Payment session could not be started: ${msg}`);
      }
    }

    if (!checkoutUrl) {
      throw new ServiceUnavailableException('Payment provider returned no checkout URL. Please try again or contact support.');
    }

    return {
      paymentId: payment.id,
      packId,
      credits,
      amount,
      currency,
      checkoutUrl,
      clientSecret: intent.clientSecret,
      provider: intent.provider,
      status: intent.status,
      packs: listCreditPacks(tenant.primaryCountry, tenant.billingPlan),
    };
  }

  async updateUserSeatPlan(
    tenantId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateUserSeatPlanDto,
  ) {
    await this.ensureAdmin(tenantId, actorUserId);

    const membership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
    });

    if (!membership) {
      throw new NotFoundException('Tenant user not found');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const resolvedCountry = dto.countryCode ?? tenant.primaryCountry;
    const currency = CURRENCY_MULTIPLIERS[resolvedCountry] ? resolvedCountry : 'USD';

    // Calculate pro-rata amount for display (Stripe handles actual proration on subscription item update)
    const PLAN_MONTHLY_USD: Record<string, number> = {
      STARTER: 25,
      PROFESSIONAL: 100,
      PRO_PLUS: 500,
    };

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const monthlyUsd = PLAN_MONTHLY_USD[dto.planId] ?? 25;
    const proRataUsd = parseFloat(((monthlyUsd / daysInMonth) * daysRemaining).toFixed(2));
    const multiplier = CURRENCY_MULTIPLIERS[currency] ?? 1;
    const proRataAmount = parseFloat((proRataUsd * multiplier).toFixed(2));

    // If the tenant has an active Stripe subscription, update the seat plan item
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE', paymentProvider: 'stripe' },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (activeSubscription?.providerSubscriptionId?.startsWith('sub_') && tenant.stripeCustomerId) {
      try {
        const priceIdMap: Record<string, string> = {
          STARTER: this.configService.get('STRIPE_PRICE_FIRM_STARTER', ''),
          PROFESSIONAL: this.configService.get('STRIPE_PRICE_FIRM_PROFESSIONAL', ''),
          PRO_PLUS: this.configService.get('STRIPE_PRICE_FIRM_PRO_PLUS', ''),
        };
        const priceId = priceIdMap[dto.planId];
        if (priceId) {
          await this.stripeService.updateSubscriptionItemForUser(
            activeSubscription.providerSubscriptionId,
            targetUserId,
            priceId,
          );
        }
      } catch {
        // Stripe update is best-effort; DB update proceeds regardless
      }
    }

    const updated = await this.prisma.tenantUser.update({
      where: { tenantId_userId: { tenantId, userId: targetUserId } },
      data: {
        seatPlan: dto.planId,
        seatPlanUpdatedAt: now,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, phone: true, countryCode: true, isActive: true },
        },
      },
    });

    return {
      ...this.formatTenantUser(updated),
      proRataAmount,
      currency: 'USD',
    };
  }

  private formatTenantUser(membership: {
    id: string;
    tenantId: string;
    userId: string;
    role: string;
    status: string;
    seatPlan?: string | null;
    seatPlanUpdatedAt?: Date | null;
    createdAt: Date;
    practiceAreas?: unknown;
    specialtyLevel?: unknown;
    displayTitle?: string | null;
    user: {
      id: string;
      email: string;
      name: string | null;
      phone: string | null;
      countryCode: string | null;
      isActive: boolean;
    };
  }) {
    return {
      tenantUserId: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
      seatPlan: membership.seatPlan ?? 'STARTER',
      seatPlanUpdatedAt: membership.seatPlanUpdatedAt ?? null,
      practiceAreas: membership.practiceAreas ?? null,
      specialtyLevel: membership.specialtyLevel ?? null,
      displayTitle: membership.displayTitle ?? null,
      createdAt: membership.createdAt,
      user: membership.user,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Credit usage — delegates to AICreditBudgetService
  // ─────────────────────────────────────────────────────────────────────────

  async getUserCreditUsage(tenantId: string, actorUserId: string, targetUserId: string) {
    // Admins can view any user; members can view only themselves
    const actorMembership = await this.prisma.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId: actorUserId } },
    });
    if (!actorMembership) throw new NotFoundException('Tenant not found');

    const isAdmin = actorMembership.role === 'FIRM_ADMIN' || actorMembership.role === 'PARTNER';
    if (!isAdmin && actorUserId !== targetUserId) {
      throw new NotFoundException('Not found');
    }

    return this.creditBudget.getUserUsage(tenantId, targetUserId);
  }

  async getTeamCreditUsage(tenantId: string, actorUserId: string) {
    await this.ensureAdmin(tenantId, actorUserId);
    return this.creditBudget.getTenantUsageSummary(tenantId);
  }

  private assertScimConfigComplete(ssoConfig: Record<string, unknown>) {
    const token = ssoConfig.scimBearerToken;
    if (typeof token !== 'string' || token.trim().length < 32) {
      throw new BadRequestException(
        'SCIM requires scimBearerToken (minimum 32 characters) before it can be enabled',
      );
    }
  }

  private assertSamlConfigComplete(ssoConfig: Record<string, unknown>) {
    const requiredFields = ['idpEntityId', 'ssoUrl', 'idpCert'] as const;
    for (const field of requiredFields) {
      const value = ssoConfig[field];
      if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestException(
          `SAML SSO requires ${field} before it can be enabled`,
        );
      }
    }
  }

  private async ensureAdmin(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new NotFoundException('Tenant not found');
    }

    if (membership.role !== 'FIRM_ADMIN' && membership.role !== 'PARTNER') {
      throw new NotFoundException('Insufficient permissions to update tenant');
    }
  }
}
