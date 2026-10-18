import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { USER_TYPES } from '@/auth/constants';
import {
  formatLegalLocation,
  resolveJurisdiction,
} from '@/config/jurisdiction-engine';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  EffectiveLegalLocation,
  LegalLocationSource,
  ResolveLegalLocationInput,
  UserProfileLocationSnapshot,
} from './legal-location.types';

function normalizeCountryCode(code?: string | null): string | null {
  const upper = code?.trim().toUpperCase();
  if (!upper || upper.length !== 2 || upper === 'XX') return null;
  return upper;
}

function normalizeJurisdiction(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

@Injectable()
export class LegalLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getPlatformFallbackCountry(): string {
    return (
      normalizeCountryCode(this.configService.get<string>('DEFAULT_COUNTRY')) ??
      'IN'
    );
  }

  resolveFromSnapshot(
    snapshot: UserProfileLocationSnapshot,
    overrides?: Pick<
      ResolveLegalLocationInput,
      'requestCountryCode' | 'requestJurisdiction' | 'geoHintCountryCode' | 'geoHintJurisdiction'
    > & { isGuest?: boolean },
  ): EffectiveLegalLocation {
    const requestCountry = normalizeCountryCode(overrides?.requestCountryCode);
    if (requestCountry) {
      return this.buildLocation(
        requestCountry,
        normalizeJurisdiction(overrides?.requestJurisdiction),
        'request',
        false,
      );
    }

    const profile = this.profileLocationFromSnapshot(snapshot);
    if (profile.countryCode) {
      return this.buildLocation(
        profile.countryCode,
        profile.jurisdiction,
        profile.source,
        false,
      );
    }

    if (overrides?.isGuest) {
      const geoCountry = normalizeCountryCode(overrides.geoHintCountryCode);
      if (geoCountry) {
        return this.buildLocation(
          geoCountry,
          normalizeJurisdiction(overrides.geoHintJurisdiction),
          'geo',
          true,
        );
      }
    }

    return this.buildLocation(
      this.getPlatformFallbackCountry(),
      undefined,
      'default',
      true,
    );
  }

  async resolve(input: ResolveLegalLocationInput): Promise<EffectiveLegalLocation> {
    const requestCountry = normalizeCountryCode(input.requestCountryCode);
    if (requestCountry) {
      return this.buildLocation(
        requestCountry,
        normalizeJurisdiction(input.requestJurisdiction),
        'request',
        false,
      );
    }

    if (input.matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: {
          id: input.matterId,
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        },
        select: {
          countryCode: true,
          jurisdiction: true,
        },
      });
      const matterCountry = normalizeCountryCode(matter?.countryCode);
      if (matterCountry) {
        return this.buildLocation(
          matterCountry,
          normalizeJurisdiction(matter?.jurisdiction),
          'matter',
          false,
        );
      }
    }

    if (input.userId) {
      const snapshot = await this.loadUserSnapshot(input.userId, input.tenantId);
      if (snapshot) {
        const profile = this.profileLocationFromSnapshot(snapshot);
        if (profile.countryCode) {
          return this.buildLocation(
            profile.countryCode,
            profile.jurisdiction,
            profile.source,
            false,
          );
        }
      }
    }

    const geoCountry = normalizeCountryCode(input.geoHintCountryCode);
    if (geoCountry && !input.userId) {
      return this.buildLocation(
        geoCountry,
        normalizeJurisdiction(input.geoHintJurisdiction),
        'geo',
        true,
      );
    }

    return this.buildLocation(
      this.getPlatformFallbackCountry(),
      undefined,
      'default',
      true,
    );
  }

  private profileLocationFromSnapshot(snapshot: UserProfileLocationSnapshot): {
    countryCode: string | null;
    jurisdiction?: string;
    source: LegalLocationSource;
  } {
    const jurisdiction =
      normalizeJurisdiction(snapshot.jurisdiction) ??
      normalizeJurisdiction(snapshot.consumerProfile?.stateOrCounty);

    if (snapshot.userType === USER_TYPES.LAWYER && snapshot.tenant?.primaryCountry) {
      return {
        countryCode: normalizeCountryCode(snapshot.tenant.primaryCountry),
        jurisdiction,
        source: 'tenant',
      };
    }

    const consumerCountry =
      normalizeCountryCode(snapshot.consumerProfile?.countryCode) ??
      normalizeCountryCode(snapshot.countryCode);

    return {
      countryCode: consumerCountry,
      jurisdiction,
      source: 'profile',
    };
  }

  private async loadUserSnapshot(
    userId: string,
    tenantId?: string,
  ): Promise<UserProfileLocationSnapshot | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userType: true,
        countryCode: true,
        jurisdiction: true,
        consumerProfile: {
          select: {
            countryCode: true,
            stateOrCounty: true,
          },
        },
        tenantUsers: {
          where: {
            status: 'ACTIVE',
            ...(tenantId ? { tenantId } : {}),
          },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            tenant: {
              select: {
                primaryCountry: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    return {
      userType: user.userType,
      countryCode: user.countryCode,
      jurisdiction: user.jurisdiction,
      consumerProfile: user.consumerProfile,
      tenant: user.tenantUsers[0]?.tenant ?? null,
    };
  }

  private buildLocation(
    countryCode: string,
    jurisdiction: string | undefined,
    source: LegalLocationSource,
    assumed: boolean,
  ): EffectiveLegalLocation {
    const profile = resolveJurisdiction(countryCode, jurisdiction);
    return {
      countryCode: profile.code,
      jurisdiction: profile.jurisdiction,
      legalLocation: profile.legalLocation ?? formatLegalLocation(countryCode, jurisdiction),
      source,
      assumed,
      tier: profile.tier,
    };
  }
}
