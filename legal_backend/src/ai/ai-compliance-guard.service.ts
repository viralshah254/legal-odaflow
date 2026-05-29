import { ForbiddenException, Injectable } from '@nestjs/common';
import { CountryCompliancePolicy } from '@prisma/client';
import { CountryComplianceService } from '@/country-compliance/country-compliance.service';
import {
  DisclaimerService,
  RestrictedPhraseMatch,
} from '@/legal-compliance/disclaimer.service';
import { CONSUMER_DISCLAIMER } from './constants';

export type AiComplianceContext = 'consumer' | 'lawyer' | 'document_generation';

export interface SanitizedAiOutput {
  outputMarkdown: string;
  disclaimer: string;
  restrictedPhraseMatches: RestrictedPhraseMatch[];
  requiresLawyerReview: boolean;
}

@Injectable()
export class AiComplianceGuardService {
  constructor(
    private readonly countryCompliance: CountryComplianceService,
    private readonly disclaimerService: DisclaimerService,
  ) {}

  async assertConsumerGuidanceAllowed(countryCode: string): Promise<CountryCompliancePolicy> {
    const policy = await this.countryCompliance.getPolicy(countryCode);
    if (!policy.allowConsumerGuidance) {
      throw new ForbiddenException(
        `Consumer AI guidance is not permitted in ${policy.countryName ?? countryCode}`,
      );
    }
    return policy;
  }

  async assertDocumentGenerationAllowed(countryCode: string): Promise<CountryCompliancePolicy> {
    const policy = await this.countryCompliance.getPolicy(countryCode);
    if (!policy.allowDocumentGeneration) {
      throw new ForbiddenException(
        `AI document generation is not permitted in ${policy.countryName ?? countryCode}`,
      );
    }
    return policy;
  }

  async getPolicyForCountry(countryCode: string): Promise<CountryCompliancePolicy> {
    return this.countryCompliance.getPolicy(countryCode);
  }

  sanitizeOutput(
    outputMarkdown: string,
    policy: CountryCompliancePolicy,
    context: AiComplianceContext,
    existingDisclaimer?: string,
  ): SanitizedAiOutput {
    const extraPhrases = Array.isArray(policy.restrictedPhrases)
      ? (policy.restrictedPhrases as string[])
      : [];

    const restrictedPhraseMatches = this.disclaimerService.checkRestrictedPhrases(
      outputMarkdown,
      extraPhrases,
    );

    let sanitized = outputMarkdown;
    if (restrictedPhraseMatches.length > 0) {
      sanitized = this.redactRestrictedPhrases(sanitized, restrictedPhraseMatches);
    }

    const highRiskMatches = this.disclaimerService.getHighRiskTriggers(sanitized);
    const hasHighRiskContent = Array.isArray(highRiskMatches) && highRiskMatches.length > 0;

    const disclaimer =
      policy.requireDisclaimerOnEveryOutput || context === 'consumer'
        ? existingDisclaimer || this.disclaimerService.getDisclaimer() || CONSUMER_DISCLAIMER
        : existingDisclaimer ?? '';

    const requiresLawyerReview =
      Boolean(policy.requireLawyerReviewForAdvice) ||
      restrictedPhraseMatches.length > 0 ||
      hasHighRiskContent;

    if (disclaimer && !sanitized.includes(disclaimer.slice(0, 40))) {
      sanitized = `${sanitized.trim()}\n\n---\n\n${disclaimer}`;
    }

    return {
      outputMarkdown: sanitized,
      disclaimer,
      restrictedPhraseMatches,
      requiresLawyerReview,
    };
  }

  private redactRestrictedPhrases(
    text: string,
    matches: RestrictedPhraseMatch[],
  ): string {
    let result = text;
    const sorted = [...matches].sort((a, b) => b.index - a.index);
    for (const match of sorted) {
      const replacement = '[redacted — consult a licensed attorney]';
      result =
        result.slice(0, match.index) +
        replacement +
        result.slice(match.index + match.phrase.length);
    }
    return result;
  }
}
