/**
 * Stage 10 — Per-Section Verification
 *
 * Wraps `UnifiedVerificationService` to run verification on a single section's
 * content rather than the whole document. Returns a `SectionResult` with
 * verification status, warnings, and confidence.
 */

import { Injectable } from '@nestjs/common';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { stripUnverifiedCitations } from '@/ai/drafting/draft-citation-sanitizer';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  SectionPlan,
  SectionResult,
  SectionVerificationStatus,
  SectionExplainability,
  ConfidenceScore,
  EvidenceChain,
} from './drafting-v2.types';

@Injectable()
export class SectionVerifierService {
  constructor(
    private readonly unifiedVerification: UnifiedVerificationService,
  ) {}

  async verify(
    section: SectionPlan,
    content: string,
    caseDetails: string,
    countryCode: string,
    authorities: RetrievedAuthority[],
    confidence: ConfidenceScore,
    evidenceChains: EvidenceChain[],
    modelUsed: string,
    tokensUsed: { input: number; output: number },
  ): Promise<SectionResult> {
    // Boilerplate and simple sections skip the full verification stack
    if (section.boilerplateContent || ['heading', 'parties', 'verification', 'annexures'].includes(section.type)) {
      return this.buildBoilerplateResult(section, content, confidence, evidenceChains, modelUsed, tokensUsed);
    }

    const unifiedResult = await this.unifiedVerification.runChecks({
      query: `${caseDetails} ${section.type}`,
      outputMarkdown: content,
      authorities,
      countryCode,
    });

    // Sanitize unverified citations in the section
    const citationAuthorities = authorities.map((a) => ({
      id: a.id,
      title: a.title ?? a.id,
      citation: a.citation ?? null,
      summary: a.summary ?? null,
    }));
    const sanitizeResult = stripUnverifiedCitations(
      content,
      citationAuthorities,
      unifiedResult.verifiedCitationTexts,
      'strip',
    );
    const sanitizedContent = sanitizeResult.text;

    const citationWarnings: string[] = [];
    if (!unifiedResult.classifierPassed) {
      citationWarnings.push(...unifiedResult.classifierReasons);
    }
    if (!unifiedResult.substancePassed) {
      citationWarnings.push(...unifiedResult.substanceWarnings);
    }
    if (!unifiedResult.indiaNiActBnssPassed) {
      citationWarnings.push('BNSS/NI Act cross-check failed — verify statute references');
    }

    if (sanitizeResult.stripped.length > 0) {
      citationWarnings.push(`${sanitizeResult.stripped.length} unverified citation(s) stripped from section`);
    }

    // Filing-grade grounds/arguments must carry verified citations
    const isGroundsSection = /grounds|arguments|legal_grounds/i.test(section.type);
    if (isGroundsSection) {
      if (/\[AUTHORITY TO BE ADDED\]/i.test(sanitizedContent)) {
        citationWarnings.push('Grounds contain [AUTHORITY TO BE ADDED] — forbidden for lawyer_ready');
      }
      const hasCitation =
        /\(\d{4}\)\s+\d+\s+SCC\s+\d+|AIR\s+\d{4}|BNSS\s*§?\s*\d+|BNS\s*§?\s*\d+|SOURCE_\d+/i.test(
          sanitizedContent,
        );
      if (!hasCitation && sanitizedContent.length > 80) {
        citationWarnings.push('Grounds section lacks a verified statute or case citation');
      }
    }

    const verificationWarnings: string[] = [
      ...unifiedResult.citation.unverifiableCitations,
    ];

    const status = this.computeStatus(unifiedResult, citationWarnings, confidence);
    const needsReview =
      isGroundsSection &&
      citationWarnings.some((w) => /AUTHORITY TO BE ADDED|lacks a verified/i.test(w));

    return {
      sectionId: section.id,
      type: section.type,
      title: section.title,
      content: sanitizedContent,
      confidence,
      evidenceChains,
      verificationStatus: needsReview ? 'needs_review' : status,
      repairAttempts: 0,
      verificationWarnings,
      citationWarnings,
      modelUsed,
      tokensUsed,
      explainability: this.buildExplainability(section, authorities),
      isInjectedBoilerplate: false,
    };
  }

  private computeStatus(
    unifiedResult: Awaited<ReturnType<UnifiedVerificationService['runChecks']>>,
    citationWarnings: string[],
    confidence: ConfidenceScore,
  ): SectionVerificationStatus {
    if (citationWarnings.some((w) => /Legal safety|hallucin/i.test(w))) {
      return 'repair_needed';
    }
    if (!unifiedResult.substancePassed && !unifiedResult.classifierPassed) {
      return 'repair_needed';
    }
    if (confidence.score < 35) {
      return 'repair_needed';
    }
    if (
      citationWarnings.length > 2 ||
      confidence.grade === 'low' ||
      unifiedResult.sentenceAudit.coverageRate < 0.2
    ) {
      return 'needs_review';
    }
    if (
      unifiedResult.sentenceAudit.coverageRate < 0.5 ||
      unifiedResult.citation.citations.length === 0
    ) {
      return 'limited_sources';
    }
    return 'verified';
  }

  private buildExplainability(
    section: SectionPlan,
    authorities: RetrievedAuthority[],
  ): SectionExplainability {
    const applicableLaw = section.ruleOutputs ?? [];
    const applicableCases = authorities
      .filter((a) => a.authorityType === 'case' || a.sourceTier === 'case_law')
      .slice(0, 5)
      .map((a) => `${a.title}${a.citation ? ` [${a.citation}]` : ''}`);
    const applicableStatutes = authorities
      .filter((a) => a.authorityType === 'statute' || a.sourceTier === 'primary')
      .slice(0, 5)
      .map((a) => a.title);

    return {
      whyIncluded: this.whyIncluded(section.type),
      applicableLaw: [...applicableLaw, ...applicableStatutes],
      applicableEvidence: section.requiredEvidence,
      applicableCases,
      applicableRules: section.requiredIngredients,
    };
  }

  private whyIncluded(type: SectionPlan['type']): string {
    const map: Partial<Record<SectionPlan['type'], string>> = {
      heading: 'Required cause title block identifying court, parties, and case number',
      parties: 'Identifies all parties to the proceeding with their correct legal designations',
      maintainability: 'Establishes that this court has territorial and pecuniary jurisdiction to hear this matter',
      facts: 'States the material facts on which all grounds and prayers are founded',
      law: 'Identifies the statutory framework governing the legal issues in dispute',
      grounds: 'States each legal ground for the relief sought with supporting authority',
      arguments: 'Develops each ground with detailed legal argument and factual application',
      prayer: 'Specifies the specific relief the court is asked to grant',
      verification: 'Required oath verifying truth of the contents under Indian law',
      annexures: 'Lists documents filed in support of the petition',
    };
    return map[type] ?? 'Required section of the legal document';
  }

  private buildBoilerplateResult(
    section: SectionPlan,
    content: string,
    confidence: ConfidenceScore,
    evidenceChains: EvidenceChain[],
    modelUsed: string,
    tokensUsed: { input: number; output: number },
  ): SectionResult {
    return {
      sectionId: section.id,
      type: section.type,
      title: section.title,
      content,
      confidence,
      evidenceChains,
      verificationStatus: 'verified',
      repairAttempts: 0,
      verificationWarnings: [],
      citationWarnings: [],
      modelUsed,
      tokensUsed,
      explainability: this.buildExplainability(section, []),
      isInjectedBoilerplate: section.isInjectedBoilerplate ?? false,
    };
  }
}

// Augment SectionPlan type to include isInjectedBoilerplate in runtime
declare module './drafting-v2.types' {
  interface SectionPlan {
    isInjectedBoilerplate?: boolean;
  }
}
