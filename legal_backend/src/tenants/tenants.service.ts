import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { getCountryConfig } from '@/config/countries';
import { USER_TYPES } from '@/auth/constants';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditPack, listCreditPacks } from '@/ai-credits/credit-packs';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { PaymentsService } from '@/payments/payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { CreditTopupCheckoutDto } from '@/consumers/dto/credit-topup.dto';
import { UpdateAiPreferencesDto } from '@/credits/dto/update-ai-preferences.dto';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly creditWallet: CreditWalletService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly aiPreferences: AiPreferencesService,
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
        where: {
          tenantId_userId: {
            tenantId,
            userId: existing.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('This user is already a member of your firm');
      }

      throw new ConflictException(
        'An account with this email already exists. Ask them to sign in, then add them from their profile.',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const country = getCountryConfig(tenant.primaryCountry);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const membership = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          userType: USER_TYPES.LAWYER,
          countryCode: country.code,
        },
      });

      const createdMembership = await tx.tenantUser.create({
        data: {
          tenantId,
          userId: user.id,
          role: dto.role,
          status: 'ACTIVE',
        },
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

    return this.formatTenantUser(membership);
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

    return memberships.map((membership) => this.formatTenantUser(membership));
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
        data: {
          name: dto.name,
          phone: dto.phone,
        },
      });
    }

    const updated = await this.prisma.tenantUser.update({
      where: {
        tenantId_userId: {
          tenantId,
          userId: targetUserId,
        },
      },
      data: {
        role: dto.role,
        status: dto.status,
      },
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

    return this.formatTenantUser(updated);
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

    const pack = getCreditPack(dto.countryCode ?? tenant.primaryCountry, dto.packId);
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');

    const { payment, intent } = await this.paymentsService.createPayment(userId, tenantId, {
      amount: pack.amount,
      currency: pack.currency,
      countryCode: pack.countryCode,
      purpose: 'AI_CREDIT_TOPUP',
      metadata: {
        packId: pack.packId,
        credits: String(pack.credits),
        tenantId,
        userId,
      },
    });

    const checkoutUrl =
      intent.checkoutUrl ??
      `${appUrl}/firm/billing?topup=${payment.id}&status=pending`;

    return {
      paymentId: payment.id,
      packId: pack.packId,
      credits: pack.credits,
      amount: pack.amount,
      currency: pack.currency,
      checkoutUrl,
      clientSecret: intent.clientSecret,
      provider: intent.provider,
      status: intent.status,
      packs: listCreditPacks(tenant.primaryCountry),
    };
  }

  private formatTenantUser(membership: {
    id: string;
    tenantId: string;
    userId: string;
    role: string;
    status: string;
    createdAt: Date;
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
      createdAt: membership.createdAt,
      user: membership.user,
    };
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
