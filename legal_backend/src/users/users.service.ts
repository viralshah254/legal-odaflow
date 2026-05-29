import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getCountryConfig, resolveCountryConfig } from '@/config/countries';
import { PrismaService } from '@/prisma/prisma.service';
import { TENANT_ROLES, USER_TYPES } from '@/auth/constants';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  userType: true,
  countryCode: true,
  jurisdiction: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  preferences: true,
  consumerProfile: {
    select: {
      countryCode: true,
      stateOrCounty: true,
    },
  },
  tenantUsers: {
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' as const },
    take: 1,
    select: {
      role: true,
      tenant: {
        select: {
          id: true,
          name: true,
          primaryCountry: true,
          defaultCurrency: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.formatProfile(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userType: true,
        consumerProfile: { select: { id: true } },
        tenantUsers: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { role: true, tenantId: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { preferences, countryCode, jurisdiction, ...profile } = dto;
    const membership = user.tenantUsers[0];
    const isFirmAdmin =
      membership?.role === TENANT_ROLES.FIRM_ADMIN ||
      membership?.role === TENANT_ROLES.PARTNER;

    if (countryCode && user.userType === USER_TYPES.LAWYER && !isFirmAdmin) {
      throw new ForbiddenException(
        'Only firm admins can change the firm country and currency',
      );
    }

    const normalizedJurisdiction =
      jurisdiction !== undefined ? jurisdiction.trim() || null : undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          name: profile.name,
          phone: profile.phone,
          ...(countryCode ? { countryCode } : {}),
          ...(normalizedJurisdiction !== undefined
            ? { jurisdiction: normalizedJurisdiction }
            : {}),
        },
      });

      if (user.userType === USER_TYPES.CONSUMER && user.consumerProfile) {
        await tx.consumerProfile.update({
          where: { userId },
          data: {
            ...(countryCode ? { countryCode } : {}),
            ...(normalizedJurisdiction !== undefined
              ? { stateOrCounty: normalizedJurisdiction }
              : {}),
          },
        });
      }

      if (
        countryCode &&
        user.userType === USER_TYPES.LAWYER &&
        membership &&
        isFirmAdmin
      ) {
        const country = getCountryConfig(countryCode);
        await tx.tenant.update({
          where: { id: membership.tenantId },
          data: {
            primaryCountry: country.code,
            defaultCurrency: country.currency,
          },
        });

        const lawyerProfile = await tx.lawyerProfile.findUnique({
          where: { userId },
        });
        if (lawyerProfile) {
          await tx.lawyerProfile.update({
            where: { userId },
            data: {
              countryCode: country.code,
              currency: country.currency,
            },
          });
        }
      }
    });

    if (preferences) {
      await this.upsertPreferences(userId, preferences);
    }

    return this.getMe(userId);
  }

  async getPreferences(userId: string) {
    await this.ensureUser(userId);
    return this.ensurePreferences(userId);
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    await this.ensureUser(userId);
    return this.upsertPreferences(userId, dto);
  }

  private formatProfile(user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    userType: string;
    countryCode: string | null;
    jurisdiction: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    preferences: {
      emailNotifications: boolean;
      pushNotifications: boolean;
      taskReminders: boolean;
      billingAlerts: boolean;
      trustApprovalAlerts: boolean;
    } | null;
    consumerProfile: {
      countryCode: string;
      stateOrCounty: string | null;
    } | null;
    tenantUsers: Array<{
      role: string;
      tenant: {
        id: string;
        name: string;
        primaryCountry: string;
        defaultCurrency: string;
      };
    }>;
  }) {
    const membership = user.tenantUsers[0];
    const tenant = membership?.tenant;
    const isFirmAdmin =
      membership?.role === TENANT_ROLES.FIRM_ADMIN ||
      membership?.role === TENANT_ROLES.PARTNER;

    const effectiveCountryCode =
      user.userType === USER_TYPES.LAWYER && tenant
        ? tenant.primaryCountry
        : user.consumerProfile?.countryCode ?? user.countryCode;

    const country = resolveCountryConfig(effectiveCountryCode);
    const jurisdiction =
      user.jurisdiction ?? user.consumerProfile?.stateOrCounty ?? null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      countryCode: effectiveCountryCode,
      jurisdiction,
      countryName: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      preferences: user.preferences,
      billing: {
        primaryCountry: effectiveCountryCode,
        primaryCurrency: tenant?.defaultCurrency ?? country.currency,
        currencySymbol: country.currencySymbol,
        tenantId: tenant?.id,
        tenantName: tenant?.name,
        canManageBilling:
          user.userType === USER_TYPES.CONSUMER ||
          (user.userType === USER_TYPES.LAWYER && isFirmAdmin),
      },
    };
  }

  private async ensureUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensurePreferences(userId: string) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  private async upsertPreferences(userId: string, dto: UpdateUserPreferencesDto) {
    return this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        emailNotifications: dto.emailNotifications ?? true,
        pushNotifications: dto.pushNotifications ?? true,
        taskReminders: dto.taskReminders ?? true,
        billingAlerts: dto.billingAlerts ?? true,
        trustApprovalAlerts: dto.trustApprovalAlerts ?? true,
      },
      update: {
        emailNotifications: dto.emailNotifications,
        pushNotifications: dto.pushNotifications,
        taskReminders: dto.taskReminders,
        billingAlerts: dto.billingAlerts,
        trustApprovalAlerts: dto.trustApprovalAlerts,
      },
    });
  }
}
