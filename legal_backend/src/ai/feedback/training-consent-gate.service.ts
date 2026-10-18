import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

export type TrainingPurpose = 'promptImprove' | 'evaluation' | 'fineTuning';

const PURPOSE_FIELD: Record<TrainingPurpose, string> = {
  promptImprove: 'canUseForPromptImprove',
  evaluation: 'canUseForEvaluation',
  fineTuning: 'canUseForFineTuning',
};

const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  tenantIds: string[];
  expiresAt: number;
}

/**
 * Resolves which tenants a learning loop is allowed to learn from.
 *
 * Consent is per tenant, per purpose, and can be withdrawn; a country policy can
 * also forbid training outright regardless of what a tenant ticked. Every loop
 * that reads customer text must go through here, and must fail closed: if we
 * cannot establish consent, the tenant is excluded.
 */
@Injectable()
export class TrainingConsentGateService {
  private readonly logger = new Logger(TrainingConsentGateService.name);
  private readonly cache = new Map<TrainingPurpose, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /** Tenant IDs cleared for this purpose. Empty means learn from nobody. */
  async consentedTenantIds(purpose: TrainingPurpose): Promise<string[]> {
    const cached = this.cache.get(purpose);
    if (cached && cached.expiresAt > Date.now()) return cached.tenantIds;

    let tenantIds: string[] = [];
    try {
      const blockedCountries = await this.blockedCountryCodes();
      const rows = await this.prisma.trainingConsent.findMany({
        where: {
          consentStatus: 'GRANTED',
          withdrawnAt: null,
          tenantId: { not: null },
          [PURPOSE_FIELD[purpose]]: true,
          ...(blockedCountries.length > 0
            ? { jurisdictionCountryCode: { notIn: blockedCountries } }
            : {}),
        },
        select: { tenantId: true },
      });
      tenantIds = [...new Set(rows.map((r) => r.tenantId).filter((id): id is string => !!id))];
    } catch (err) {
      // Fail closed: an unavailable consent table must not be read as consent.
      this.logger.warn(
        `Training consent lookup failed for ${purpose}; excluding all tenants: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return [];
    }

    this.cache.set(purpose, { tenantIds, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenantIds;
  }

  async isTenantConsented(tenantId: string, purpose: TrainingPurpose): Promise<boolean> {
    const allowed = await this.consentedTenantIds(purpose);
    return allowed.includes(tenantId);
  }

  invalidate(): void {
    this.cache.clear();
  }

  private async blockedCountryCodes(): Promise<string[]> {
    const policies = await this.prisma.countryCompliancePolicy
      .findMany({
        where: { allowTrainingOptIn: false },
        select: { countryCode: true },
      })
      .catch(() => []);
    return policies.map((p) => p.countryCode.toUpperCase());
  }
}
