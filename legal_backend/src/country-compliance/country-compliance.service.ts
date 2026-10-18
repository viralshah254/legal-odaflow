import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { retryDb } from '@/common/utils/retry-db';
import { PrismaService } from '@/prisma/prisma.service';
import {
  COUNTRY_COMPLIANCE_POLICY_SEEDS,
  CountryCompliancePolicySeed,
  EU_MEMBER_COUNTRY_CODES,
} from './country-compliance.seed';
import { getCountryPrivacyRequirements } from './privacy-controls';

@Injectable()
export class CountryComplianceService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await retryDb(() => this.seedPolicies());
  }

  async getPolicy(countryCode: string) {
    const normalized = countryCode.toUpperCase();
    let policy = await this.prisma.countryCompliancePolicy.findUnique({
      where: { countryCode: normalized },
    });

    if (!policy) {
      const seed = this.findSeed(normalized) ?? this.findEuFallbackSeed(normalized);
      if (seed) {
        policy = await this.prisma.countryCompliancePolicy.upsert({
          where: { countryCode: normalized },
          create: this.toCreateData(seed, normalized),
          update: this.toUpdateData(seed),
        });
      }
    }

    if (!policy) {
      throw new NotFoundException(`Compliance policy not found for ${normalized}`);
    }

    return this.withPrivacyRequirements(policy);
  }

  async listPolicies() {
    const policies = await this.prisma.countryCompliancePolicy.findMany({
      orderBy: { countryCode: 'asc' },
    });
    return policies.map((policy) => this.withPrivacyRequirements(policy));
  }

  async seedPolicies() {
    const results = [];

    for (const seed of COUNTRY_COMPLIANCE_POLICY_SEEDS) {
      const policy = await this.prisma.countryCompliancePolicy.upsert({
        where: { countryCode: seed.countryCode },
        create: this.toCreateData(seed),
        update: this.toUpdateData(seed),
      });
      results.push(policy);
    }

    return results;
  }

  private findSeed(countryCode: string): CountryCompliancePolicySeed | undefined {
    return COUNTRY_COMPLIANCE_POLICY_SEEDS.find(
      (seed) => seed.countryCode.toUpperCase() === countryCode,
    );
  }

  private withPrivacyRequirements<T extends { countryCode: string }>(policy: T) {
    const seed = this.findSeed(policy.countryCode) ?? this.findEuFallbackSeed(policy.countryCode);
    return {
      ...policy,
      privacyRequirements:
        seed?.privacyRequirements ?? getCountryPrivacyRequirements(policy.countryCode),
    };
  }

  /** Unseeded EU/EEA members inherit the EU policy template. */
  private findEuFallbackSeed(countryCode: string): CountryCompliancePolicySeed | undefined {
    if (!EU_MEMBER_COUNTRY_CODES.has(countryCode) || countryCode === 'EU') {
      return undefined;
    }
    return this.findSeed('EU');
  }

  private toCreateData(
    seed: CountryCompliancePolicySeed,
    countryCodeOverride?: string,
  ): Prisma.CountryCompliancePolicyCreateInput {
    return {
      countryCode: countryCodeOverride ?? seed.countryCode,
      countryName: countryCodeOverride && countryCodeOverride !== seed.countryCode
        ? `${countryCodeOverride} (EU policy)`
        : seed.countryName,
      allowConsumerGuidance: seed.allowConsumerGuidance ?? true,
      allowDocumentGeneration: seed.allowDocumentGeneration ?? true,
      allowLawyerMarketplace: seed.allowLawyerMarketplace ?? true,
      requireLawyerReviewForAdvice: seed.requireLawyerReviewForAdvice ?? true,
      requireDisclaimerOnEveryOutput: seed.requireDisclaimerOnEveryOutput ?? true,
      allowTrainingOptIn: seed.allowTrainingOptIn ?? true,
      requireExplicitTrainingConsent: seed.requireExplicitTrainingConsent ?? true,
      allowAutomatedDecisioning: seed.allowAutomatedDecisioning ?? false,
      restrictedPhrases: seed.restrictedPhrases,
      approvedProductLabels: seed.approvedProductLabels,
      dataResidencyRequired: seed.dataResidencyRequired ?? false,
      defaultDataRegion: seed.defaultDataRegion,
      notes: seed.notes,
    };
  }

  private toUpdateData(seed: CountryCompliancePolicySeed): Prisma.CountryCompliancePolicyUpdateInput {
    return {
      countryName: seed.countryName,
      allowConsumerGuidance: seed.allowConsumerGuidance ?? true,
      allowDocumentGeneration: seed.allowDocumentGeneration ?? true,
      allowLawyerMarketplace: seed.allowLawyerMarketplace ?? true,
      requireLawyerReviewForAdvice: seed.requireLawyerReviewForAdvice ?? true,
      requireDisclaimerOnEveryOutput: seed.requireDisclaimerOnEveryOutput ?? true,
      allowTrainingOptIn: seed.allowTrainingOptIn ?? true,
      requireExplicitTrainingConsent: seed.requireExplicitTrainingConsent ?? true,
      allowAutomatedDecisioning: seed.allowAutomatedDecisioning ?? false,
      restrictedPhrases: seed.restrictedPhrases,
      approvedProductLabels: seed.approvedProductLabels,
      dataResidencyRequired: seed.dataResidencyRequired ?? false,
      defaultDataRegion: seed.defaultDataRegion,
      notes: seed.notes,
    };
  }
}
