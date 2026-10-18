import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DraftCaseBriefService } from '@/ai/drafting/draft-case-brief.service';
import type { DraftCaseBrief } from '@/ai/drafting/draft-case-brief.types';
import { DraftProceduralTimelineValidator } from '@/ai/drafting/draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from '@/ai/drafting/draft-case-fact-coverage.service';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import {
  DraftPleadingReviewService,
  type PleadingReviewResult,
} from '@/ai/drafting/draft-pleading-review.service';
import { DraftAmendmentApplierService } from '@/ai/drafting/draft-amendment-applier.service';
import { DraftAccuracyGateService } from '@/ai/drafting/draft-accuracy-gate.service';
import type { DraftVerificationAudit } from '@/ai/drafting/draft-verification.types';
import type { VerificationFinding } from '@/ai/verification/verification-finding.types';
import { DraftCorrectionService } from '@/ai/feedback/draft-correction.service';
import { hasOfficialCaseSources } from '@/ai/legal-research/official-case-sources';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';
import {
  buildIssueFingerprint,
  type DraftIssue,
} from '../contracts/draft-issue';

export interface LawyerReadyPassResult {
  draft: string;
  brief: DraftCaseBrief;
  findings: VerificationFinding[];
  review?: PleadingReviewResult;
  appliedFixes: Array<{ originalText: string; suggestedText: string; reason: string }>;
  certificationLabel: string;
  lawyerReady: boolean;
  verifiedCaseAuthorityCount: number;
  factCoverageRate: number;
  liveCaseLawAvailable: boolean;
}

@Injectable()
export class LawyerReadyPipelineService {
  private readonly logger = new Logger(LawyerReadyPipelineService.name);

  constructor(
    private readonly caseBrief: DraftCaseBriefService,
    private readonly timeline: DraftProceduralTimelineValidator,
    private readonly factCoverage: DraftCaseFactCoverageService,
    private readonly playbooks: DraftKindPlaybookService,
    private readonly pleadingReview: DraftPleadingReviewService,
    private readonly amendmentApplier: DraftAmendmentApplierService,
    private readonly accuracyGate: DraftAccuracyGateService,
    @Optional() private readonly config: ConfigService | null,
    @Optional() private readonly draftCorrections: DraftCorrectionService | null,
  ) {}

  extractBrief(caseDetails: string, kind: string): DraftCaseBrief {
    return this.caseBrief.extract(caseDetails, kind);
  }

  buildBriefPromptBlock(brief: DraftCaseBrief): string {
    return this.caseBrief.buildPromptBlock(brief);
  }

  buildRetrievalQueries(brief: DraftCaseBrief, kind: string): string[] {
    return this.caseBrief.buildRetrievalQueries(brief, kind);
  }

  /**
   * Whether any live case-law provider can serve this jurisdiction. India has a
   * dedicated connector; everywhere else we rely on grounded web retrieval over
   * official court domains, which needs Tavily.
   */
  isCaseLawProviderConfigured(countryCode = 'IN'): boolean {
    const code = countryCode.toUpperCase();
    const configured = (name: string) => (this.config?.get<string>(name) ?? '').trim().length > 0;
    if (code === 'IN' && configured('INDIA_KANOON_API_KEY')) return true;
    return hasOfficialCaseSources(code) && configured('TAVILY_API_KEY');
  }

  countCaseAuthorities(registry: VerifiedSourceRegistry): number {
    return registry.sources.filter(
      (s) =>
        s.type === 'case' &&
        s.verificationStatus !== 'rejected' &&
        !/overruled/i.test(s.proposition ?? ''),
    ).length;
  }

  toDraftIssues(findings: VerificationFinding[], sectionId = 'document'): DraftIssue[] {
    return findings
      .filter((f) => f.state !== 'PASS')
      .map((f) => {
        const category: DraftIssue['category'] = f.checkId.startsWith('fact_coverage')
          ? 'fact'
          : f.checkId.startsWith('procedural_timeline')
            ? 'procedure'
            : f.dimension === 'citation' || f.checkId.startsWith('caselaw_retrieval')
              ? 'citation'
              : 'fact';
        return {
          id: '',
          category,
          severity:
            f.severity === 'BLOCKER' || f.severity === 'HIGH'
              ? ('critical' as const)
              : f.severity === 'MEDIUM'
                ? ('high' as const)
                : ('medium' as const),
          sectionId,
          message: f.explanation,
          suggestedCorrection: f.repairAction,
          repairableAutomatically: f.repairAction === 'RECITE' || f.repairAction === 'REMOVE',
          validator: 'LawyerReadyPipeline',
          fingerprint: buildIssueFingerprint(
            category,
            sectionId,
            f.explanation.slice(0, 80),
            undefined,
          ),
        };
      });
  }

  /**
   * Run timeline + fact coverage + optional pleading review/apply loop (max 2 passes).
   */
  async certifyAssembledDraft(input: {
    draft: string;
    caseDetails: string;
    kind: string;
    sourceRegistry: VerifiedSourceRegistry;
    runReviewLoop?: boolean;
    countryCode?: string;
  }): Promise<LawyerReadyPassResult> {
    const countryCode = (input.countryCode || 'IN').toUpperCase();
    const playbook = this.playbooks.resolve(input.kind);
    const brief = this.caseBrief.extract(input.caseDetails, input.kind);
    let draft = input.draft;
    const appliedFixes: LawyerReadyPassResult['appliedFixes'] = [];
    let review: PleadingReviewResult | undefined;
    const maxPasses = input.runReviewLoop === false ? 0 : playbook.filingGrade ? 2 : 0;

    const verifiedCaseAuthorityCount = this.countCaseAuthorities(input.sourceRegistry);
    const liveCaseLawAvailable = this.isCaseLawProviderConfigured(countryCode);
    const authoritiesBlock = input.sourceRegistry.sources
      .filter((s) => s.verificationStatus !== 'rejected')
      .slice(0, 20)
      .map((s) => `${s.id}: ${s.title} ${s.citation ?? ''} — ${(s.proposition ?? s.text ?? '').slice(0, 200)}`)
      .join('\n');

    let findings: VerificationFinding[] = [];
    let coverageRate = 0;

    for (let pass = 0; pass <= maxPasses; pass++) {
      const timelineFindings = this.timeline.evaluate({
        draft,
        caseDetails: input.caseDetails,
        kind: input.kind,
        brief,
      });
      const coverage = this.factCoverage.evaluate({
        draft,
        brief,
        kind: input.kind,
        filingGrade: playbook.filingGrade,
      });
      coverageRate = coverage.coverageRate;

      const retrievalFindings: VerificationFinding[] = [];
      if (playbook.filingGrade && verifiedCaseAuthorityCount < playbook.minVerifiedCaseAuthorities) {
        retrievalFindings.push({
          checkId: 'caselaw_retrieval:insufficient',
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'citation',
          evidenceIds: [],
          explanation: `Only ${verifiedCaseAuthorityCount} verified case authorities (need ≥${playbook.minVerifiedCaseAuthorities}).${
            liveCaseLawAvailable
              ? ''
              : ` No live case-law provider is configured for ${countryCode} — case law search unavailable.`
          }`,
          repairAction: 'RETRIEVE',
          verifierVersion: 'lawyer-ready-pipeline-v1',
        });
      }
      if (playbook.filingGrade && /\[AUTHORITY TO BE ADDED\]/i.test(draft)) {
        retrievalFindings.push({
          checkId: 'caselaw_retrieval:blank_authority',
          state: 'FAIL',
          severity: 'BLOCKER',
          dimension: 'citation',
          evidenceIds: [],
          explanation: 'Draft contains [AUTHORITY TO BE ADDED] — forbidden for lawyer_ready.',
          repairAction: 'RECITE',
          verifierVersion: 'lawyer-ready-pipeline-v1',
        });
      }

      findings = [...timelineFindings, ...coverage.findings, ...retrievalFindings];

      const auditStub: DraftVerificationAudit = {
        corrections: [],
        similarCases: [],
        sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
        citationWarnings: findings.map((f) => f.explanation),
        strippedCitations: [],
        proceduralWarnings: [],
        completenessGaps: coverage.missing,
        requiresLawyerReview: findings.some((f) => f.severity === 'BLOCKER'),
        verificationStatus: findings.some((f) => f.severity === 'BLOCKER') ? 'needs_review' : 'verified',
        findings,
        factCoverageRate: coverage.coverageRate,
        missingDefenceFacts: coverage.missing,
      };

      const gate = this.accuracyGate.evaluate({
        audit: auditStub,
        filingGrade: playbook.filingGrade,
        authorityCount: input.sourceRegistry.sources.length,
        recommendedKind: input.kind,
        draftText: draft,
        authoritiesOnPoint: verifiedCaseAuthorityCount > 0,
        factCoverage: coverage,
        verifiedCaseAuthorityCount,
        minVerifiedCaseAuthorities: playbook.minVerifiedCaseAuthorities,
        pleadingReviewCompleted: pass > 0 || maxPasses === 0,
        unresolvedHighIssues: findings.filter((f) => f.severity === 'BLOCKER' || f.severity === 'HIGH')
          .length,
      });

      if (gate.lawyerReady || pass === maxPasses) {
        return {
          draft,
          brief,
          findings,
          review,
          appliedFixes,
          certificationLabel: gate.certificationLabel,
          lawyerReady: gate.lawyerReady,
          verifiedCaseAuthorityCount,
          factCoverageRate: coverageRate,
          liveCaseLawAvailable,
        };
      }

      review = await this.pleadingReview.review({
        draft,
        brief,
        findings,
        verifiedAuthoritiesBlock: authoritiesBlock,
        filingGrade: playbook.filingGrade,
        usePremiumReviewer: true,
      });
      const applied = this.amendmentApplier.apply(draft, review.amendments);
      draft = applied.draft;
      for (const a of applied.applied) {
        appliedFixes.push({
          originalText: a.originalText,
          suggestedText: a.suggestedText,
          reason: a.reason,
        });
        // Feed auto-applied language/label fixes into draft-correction learning loop
        if (
          this.draftCorrections &&
          a.originalText &&
          a.suggestedText &&
          (a.category === 'language' || a.category === 'label' || a.category === 'timeline')
        ) {
          void this.draftCorrections
            .storePending({
              documentKind: input.kind,
              wrongCitation: a.originalText.slice(0, 200),
              correctCitation: a.suggestedText.slice(0, 200),
              confidence: 0.7,
              countryCode,
            })
            .catch(() => undefined);
        }
      }
      this.logger.log(
        `Lawyer-ready review pass ${pass + 1}: applied ${applied.applied.length} fixes`,
      );
    }

    return {
      draft,
      brief,
      findings,
      review,
      appliedFixes,
      certificationLabel: 'needs_review',
      lawyerReady: false,
      verifiedCaseAuthorityCount,
      factCoverageRate: coverageRate,
      liveCaseLawAvailable,
    };
  }
}
