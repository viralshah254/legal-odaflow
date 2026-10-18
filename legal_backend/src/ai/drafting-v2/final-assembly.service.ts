/**
 * Stage 12 — Final Assembly
 *
 * Merges all verified `SectionResult` nodes into a single document.
 * Produces:
 *   - The merged document text (markdown)
 *   - Verification report
 *   - Confidence report
 *   - Citation appendix
 *   - Explainability annotations
 */

import { Injectable } from '@nestjs/common';
import type {
  SectionResult,
  DocumentOutline,
  LegalPlan,
  ConfidenceReport,
  VerificationReport,
  CitationAppendixEntry,
  DraftV2Result,
  EvidenceValidationReport,
  RuleEngineResult,
} from './drafting-v2.types';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { CitationAppendixBuilderService } from '@/ai/citations/citation-appendix-builder.service';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import { DraftProceduralTimelineValidator } from '@/ai/drafting/draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from '@/ai/drafting/draft-case-fact-coverage.service';

@Injectable()
export class FinalAssemblyService {
  constructor(
    private readonly appendixBuilder: CitationAppendixBuilderService,
    private readonly caseBrief: DraftCaseBriefService,
    private readonly timeline: DraftProceduralTimelineValidator,
    private readonly factCoverage: DraftCaseFactCoverageService,
  ) {}
  /**
   * Merge verified sections and generate all reports.
   */
  assemble(
    sections: SectionResult[],
    outline: DocumentOutline,
    plan: LegalPlan,
    evidenceReport: EvidenceValidationReport,
    ruleResult: RuleEngineResult,
    creditsUsed: number,
    authorities: RetrievedAuthority[] = [],
    caseDetails = '',
  ): Omit<DraftV2Result, 'draftId' | 'counselChecklist' | 'proceduralDetermination' | 'researchPhase'> {
    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => {
      const aOrder = outline.sections.findIndex((s) => s.id === a.sectionId);
      const bOrder = outline.sections.findIndex((s) => s.id === b.sectionId);
      return aOrder - bOrder;
    });

    const draft = this.mergeSections(sortedSections, outline);
    const confidenceReport = this.buildConfidenceReport(sortedSections);
    const verificationReport = this.buildVerificationReport(
      sortedSections,
      draft,
      plan.documentKind,
      caseDetails,
      plan.filingGrade,
    );
    const citationAppendix = this.appendixBuilder.buildFromSections(
      sortedSections.map((s) => ({
        sectionId: s.sectionId,
        sectionTitle: s.title,
        content: s.content,
      })),
      authorities,
    );

    const primaryModel = this.determinePrimaryModel(sortedSections);

    return {
      draft,
      sections: sortedSections,
      outline,
      legalPlan: plan,
      confidenceReport,
      verificationReport,
      citationAppendix,
      evidenceValidationReport: evidenceReport,
      ruleEngineResult: ruleResult,
      creditsUsed,
      modelUsed: primaryModel,
    };
  }

  private mergeSections(sections: SectionResult[], _outline: DocumentOutline): string {
    const parts: string[] = [];

    for (const section of sections) {
      if (!section.content?.trim()) continue;

      // Add section heading if content doesn't already start with it
      const contentStartsWithTitle = section.content
        .trimStart()
        .toUpperCase()
        .startsWith(section.title.toUpperCase());

      if (!contentStartsWithTitle && !['heading', 'parties'].includes(section.type)) {
        parts.push(`\n${section.title}\n`);
      }

      parts.push(section.content.trim());

      // Add spacing between sections
      parts.push('');
    }

    return parts.join('\n').trim();
  }

  private buildConfidenceReport(sections: SectionResult[]): ConfidenceReport {
    const scores = sections.map((s) => ({
      sectionId: s.sectionId,
      type: s.type,
      score: s.confidence.score,
      grade: s.confidence.grade,
    }));

    const overallScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
        : 0;

    const repairTriggered = sections.some((s) => s.repairAttempts > 0);
    const totalRepairs = sections.reduce((sum, s) => sum + s.repairAttempts, 0);

    return {
      overallScore,
      overallGrade: this.gradeFromScore(overallScore),
      sectionScores: scores,
      totalSections: sections.length,
      verifiedSections: sections.filter((s) => s.verificationStatus === 'verified').length,
      needsReviewSections: sections.filter((s) => ['needs_review', 'limited_sources'].includes(s.verificationStatus)).length,
      repairTriggered,
      totalRepairs,
      belowThresholdSections: sections
        .filter((s) => s.confidence.grade === 'low' || s.confidence.grade === 'unverified')
        .map((s) => `${s.type}: ${s.title}`),
    };
  }

  private buildVerificationReport(
    sections: SectionResult[],
    draft: string,
    documentKind: string,
    caseDetails: string,
    filingGrade: boolean,
  ): VerificationReport {
    const sectionStatuses = sections.map((s) => ({
      sectionId: s.sectionId,
      type: s.type,
      status: s.verificationStatus,
      warnings: [...s.verificationWarnings, ...s.citationWarnings],
    }));

    const overallWarnings = sections.flatMap((s) => [
      ...s.citationWarnings,
      ...s.verificationWarnings,
    ]);

    if (caseDetails) {
      const brief = this.caseBrief.extract(caseDetails, documentKind);
      const timelineFindings = this.timeline.evaluate({
        draft,
        caseDetails,
        kind: documentKind,
        brief,
      });
      const coverage = this.factCoverage.evaluate({
        draft,
        brief,
        kind: documentKind,
        filingGrade,
      });
      for (const f of [...timelineFindings, ...coverage.findings]) {
        if (f.state !== 'PASS' && (f.severity === 'BLOCKER' || f.severity === 'HIGH')) {
          overallWarnings.push(`${f.checkId}: ${f.explanation}`);
        }
      }
    }

    const hasFailures = sections.some(
      (s) => s.verificationStatus === 'repair_failed' || s.verificationStatus === 'repair_needed',
    );
    const hasMixedReview = sections.some((s) =>
      ['needs_review', 'limited_sources'].includes(s.verificationStatus),
    );
    const hasFactBlockers = overallWarnings.some((w) =>
      /fact_coverage:|procedural_timeline:|fact_fidelity:/i.test(w),
    );
    const requiresLawyerReview =
      hasFailures ||
      hasFactBlockers ||
      overallWarnings.some((w) => /Legal safety|hallucin/i.test(w));

    const overallStatus = hasFailures || hasFactBlockers
      ? 'needs_review'
      : hasMixedReview
        ? 'limited_sources'
        : 'verified';

    const canCertify = !hasFailures && !requiresLawyerReview && !hasFactBlockers;

    return {
      status: overallStatus,
      canCertify,
      certificationLabel: canCertify
        ? 'verified_for_filing'
        : hasFailures || hasFactBlockers
          ? 'needs_review'
          : 'complete_missing_facts',
      sectionStatuses,
      overallWarnings: [...new Set(overallWarnings)],
      requiresLawyerReview,
    };
  }


  private gradeFromScore(score: number): ConfidenceReport['overallGrade'] {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 35) return 'low';
    return 'unverified';
  }

  private determinePrimaryModel(sections: SectionResult[]): string {
    const groundsSection = sections.find((s) => s.type === 'grounds');
    return groundsSection?.modelUsed ?? sections[0]?.modelUsed ?? 'unknown';
  }
}
