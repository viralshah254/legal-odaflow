import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  COUNTRY_COMPLIANCE_POLICY_SEEDS,
  CountryCompliancePolicySeed,
} from './country-compliance.seed';

@Injectable()
export class CountryComplianceService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPolicies();
  }

  async getPolicy(countryCode: string) {
    const normalized = countryCode.toUpperCase();
    let policy = await this.prisma.countryCompliancePolicy.findUnique({
      where: { countryCode: normalized },
    });

    if (!policy) {
      const seed = this.findSeed(normalized);
      if (seed) {
        policy = await this.prisma.countryCompliancePolicy.upsert({
          where: { countryCode: normalized },
          create: this.toCreateData(seed),
          update: this.toUpdateData(seed),
        });
      }
    }

    if (!policy) {
      throw new NotFoundException(`Compliance policy not found for ${normalized}`);
    }

    return policy;
  }

  async listPolicies() {
    return this.prisma.countryCompliancePolicy.findMany({
      orderBy: { countryCode: 'asc' },
    });
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

  private toCreateData(seed: CountryCompliancePolicySeed): Prisma.CountryCompliancePolicyCreateInput {
    return {
      countryCode: seed.countryCode,
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
