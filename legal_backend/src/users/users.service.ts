import { getCountryConfig, resolveCountryConfig } from '@/config/countries';
import { isLocaleValidForCountry, normalizeLocale } from '@/config/locales';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LegalLocationService } from '@/legal-location/legal-location.service';
import { PrismaService } from '@/prisma/prisma.service';
import { TENANT_ROLES, USER_TYPES } from '@/auth/constants';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserPreferencesDto } from './dto/update-user-preferences.dto';
import { ensureFirstLoginRecorded } from './first-login.util';

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  userType: true,
  countryCode: true,
  jurisdiction: true,
  isActive: true,
  mustChangePassword: true,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly legalLocation: LegalLocationService,
  ) {}

  async getMe(userId: string) {
    await ensureFirstLoginRecorded(this.prisma, userId);

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

  async getPreferredLocale(userId: string): Promise<string | undefined> {
    const prefs = await this.prisma.userPreferences.findUnique({
      where: { userId },
      select: { preferredLocale: true },
    });
    return prefs?.preferredLocale;
  }

  async updatePreferences(userId: string, dto: UpdateUserPreferencesDto) {
    await this.ensureUser(userId);

    if (dto.preferredLocale) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          countryCode: true,
          consumerProfile: { select: { countryCode: true } },
          tenantUsers: { select: { tenant: { select: { primaryCountry: true } } } },
        },
      });
      const countryCode =
        user?.tenantUsers[0]?.tenant.primaryCountry ??
        user?.consumerProfile?.countryCode ??
        user?.countryCode ??
        'US';
      const locale = normalizeLocale(dto.preferredLocale);
      if (!isLocaleValidForCountry(locale, countryCode)) {
        throw new BadRequestException(
          `Locale ${locale} is not supported for country ${countryCode}`,
        );
      }
      dto = { ...dto, preferredLocale: locale };

      await this.prisma.consumerProfile.updateMany({
        where: { userId },
        data: { preferredLanguage: locale },
      });
    }

    if (dto.tutorialProgress !== undefined) {
      const existing = await this.prisma.userPreferences.findUnique({
        where: { userId },
        select: { tutorialProgress: true },
      });
      const prev =
        existing?.tutorialProgress &&
        typeof existing.tutorialProgress === 'object' &&
        !Array.isArray(existing.tutorialProgress)
          ? (existing.tutorialProgress as Record<string, unknown>)
          : {};
      dto = {
        ...dto,
        tutorialProgress: { ...prev, ...dto.tutorialProgress },
      };
    }

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
    mustChangePassword: boolean;
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

    const resolvedLocation = this.legalLocation.resolveFromSnapshot({
      userType: user.userType,
      countryCode: user.countryCode,
      jurisdiction: user.jurisdiction,
      consumerProfile: user.consumerProfile,
      tenant: tenant ?? null,
    });

    const effectiveCountryCode = resolvedLocation.countryCode;
    const country = resolveCountryConfig(effectiveCountryCode);
    const jurisdiction = resolvedLocation.jurisdiction ?? null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      userType: user.userType,
      countryCode: effectiveCountryCode,
      jurisdiction,
      legalLocation: {
        countryCode: resolvedLocation.countryCode,
        jurisdiction: resolvedLocation.jurisdiction ?? null,
        displayName: resolvedLocation.legalLocation,
        source: resolvedLocation.source,
        assumed: resolvedLocation.assumed,
        tier: resolvedLocation.tier,
      },
      countryName: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
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
        primaryPracticeArea: dto.primaryPracticeArea,
        preferredLocale: dto.preferredLocale ?? 'en',
        ...(dto.tutorialProgress !== undefined
          ? { tutorialProgress: dto.tutorialProgress as Prisma.InputJsonValue }
          : {}),
      },
      update: {
        emailNotifications: dto.emailNotifications,
        pushNotifications: dto.pushNotifications,
        taskReminders: dto.taskReminders,
        billingAlerts: dto.billingAlerts,
        trustApprovalAlerts: dto.trustApprovalAlerts,
        primaryPracticeArea: dto.primaryPracticeArea,
        preferredLocale: dto.preferredLocale,
        ...(dto.tutorialProgress !== undefined
          ? { tutorialProgress: dto.tutorialProgress as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
