import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CaseRecord } from '../contracts/case-record';
import {
  auditPassed,
  type AccuracyAuditResult,
  type AccuracyFinding,
} from './accuracy-finding';
import { PartyEntityValidatorService } from './party-entity-validator.service';
import { KnownFactPlaceholderValidatorService } from './known-fact-placeholder-validator.service';
import { FactFidelityAuditorService } from './fact-fidelity-auditor.service';
import { StatuteSectionValidatorService } from './statute-section-validator.service';
import { JurisdictionValidatorService } from './jurisdiction-validator.service';
import { PleadingCompletenessValidatorService } from './pleading-completeness-validator.service';
import { LimitationCauseOfActionValidatorService } from './limitation-cause-of-action-validator.service';
import { AdverseMaterialValidatorService } from './adverse-material-validator.service';
import { ReliefTestValidatorService } from './relief-test-validator.service';
import { CourtLanguageValidatorService } from './court-language-validator.service';
import { ValuationCourtFeeValidatorService } from './valuation-court-fee-validator.service';
import { AnnexureEvidenceValidatorService } from './annexure-evidence-validator.service';
import { CitationPropositionValidatorService } from './citation-proposition-validator.service';
import { LiabilityConsentExpertValidatorsService } from './liability-consent-expert-validators.service';
import { ResearchMemoQualityValidatorService } from './research-memo-quality.validator';
import { evaluateCommercialRecoveryDraft } from './commercial-recovery-validator';
import { DraftAccuracyRepairService } from './draft-accuracy-repair.service';
import { DraftRepairSourceResolverService } from './draft-repair-source-resolver.service';
import { DraftRepairConfirmationService } from './draft-repair-confirmation.service';
import type {
  DraftAutoRepairContext,
  DraftAutoRepairResult,
  DraftRepairConfirmationAnswer,
  FinalDraftResolutionStatus,
  DraftRepairStatus,
} from './draft-repair.types';

export type DraftingAccuracyMode = 'fast' | 'balanced' | 'strict';

export type DraftDocumentFamily =
  | 'research_memo'
  | 'consumer'
  | 'civil'
  | 'criminal'
  | 'bail'
  | 'writ'
  | 'arbitration'
  | 'family'
  | 'employment'
  | 'notice'
  | 'contract'
  | 'affidavit'
  | 'appeal_revision'
  | 'unknown';

export interface DraftAccuracyOrchestratorInput {
  caseRecord: CaseRecord;
  draftText: string;
  documentKind?: string;
  /** Optional normalized family supplied by the playbook resolver. Inferred when absent. */
  documentFamily?: DraftDocumentFamily;
  caseDetails?: string;
  mode?: DraftingAccuracyMode;
  requiredSections?: string[];
  /** When true (or inferred), run consumer jurisdiction / liability checks even for research memos. */
  consumerMatterSignals?: boolean;
}

export interface DraftAccuracyOrchestratorResult extends AccuracyAuditResult {
  byValidator: Record<string, AccuracyAuditResult>;
  mode: DraftingAccuracyMode;
}

/**
 * Runs deterministic accuracy validators (always) and optional extended
 * court-readiness checks in balanced/strict modes.
 * Deterministic validators run first; extended checks may run in parallel.
 */
@Injectable()
export class DraftAccuracyOrchestratorService {
  private readonly logger = new Logger(DraftAccuracyOrchestratorService.name);
  private readonly cache = new Map<string, DraftAccuracyOrchestratorResult>();

  constructor(
    private readonly partyEntity: PartyEntityValidatorService,
    private readonly knownBlank: KnownFactPlaceholderValidatorService,
    private readonly factFidelity: FactFidelityAuditorService,
    private readonly statuteSection: StatuteSectionValidatorService,
    private readonly jurisdiction: JurisdictionValidatorService,
    private readonly pleadingCompleteness: PleadingCompletenessValidatorService,
    private readonly limitation: LimitationCauseOfActionValidatorService,
    private readonly adverseMaterial: AdverseMaterialValidatorService,
    private readonly reliefTest: ReliefTestValidatorService,
    private readonly courtLanguage: CourtLanguageValidatorService,
    private readonly valuationCourtFee: ValuationCourtFeeValidatorService,
    private readonly annexureEvidence: AnnexureEvidenceValidatorService,
    private readonly citationProposition: CitationPropositionValidatorService,
    private readonly liabilityConsentExpert: LiabilityConsentExpertValidatorsService,
    private readonly researchMemoQuality: ResearchMemoQualityValidatorService,
    @Optional() private readonly repairService?: DraftAccuracyRepairService,
    @Optional() private readonly sourceResolver?: DraftRepairSourceResolverService,
    @Optional() private readonly confirmationService?: DraftRepairConfirmationService,
  ) {}

  /**
   * Audit → classify → retrieve sources → repair → full re-audit.
   * Stops when clean, unchanged, confirmation needed, or maxAttempts reached.
   */
  async reviewAndRepair(
    input: DraftAutoRepairContext,
    options?: {
      mode?: DraftingAccuracyMode;
      maxAttempts?: number;
      confirmationAnswers?: DraftRepairConfirmationAnswer[];
    },
  ): Promise<DraftAutoRepairResult> {
    const mode = options?.mode ?? 'balanced';
    const maxAttempts = Math.min(
      5,
      Math.max(
        1,
        options?.maxAttempts ??
          (mode === 'fast' ? 1 : mode === 'strict' ? 5 : 3),
      ),
    );

    let caseRecord = input.caseRecord;
    if (options?.confirmationAnswers?.length && this.confirmationService) {
      const applied = this.confirmationService.applyAnswers(
        caseRecord,
        options.confirmationAnswers,
      );
      caseRecord = applied.caseRecord;
    }

    let draftText = input.draftText;
    let attempts = 0;
    let repairStatus: DraftRepairStatus = 'reviewing';
    const repairDraftHashes: string[] = [];
    let initialFindings: AccuracyFinding[] = [];
    let finalFindings: AccuracyFinding[] = [];
    const resolvedFindingCodes = new Set<string>();
    let confirmationQuestions = this.confirmationService
      ? this.confirmationService.buildQuestionsFromConflicts([])
      : [];
    let requiresUserConfirmation = false;
    let requiresAdvocateReview = false;

    const allowSemanticRepair = mode !== 'fast';

    while (attempts < maxAttempts) {
      attempts += 1;
      repairStatus = 'reviewing';

      const audit = this.evaluate({
        caseRecord,
        draftText,
        documentKind: input.documentKind,
        documentFamily: input.documentFamily,
        caseDetails: input.caseDetails,
        mode,
        requiredSections: input.requiredSections,
        consumerMatterSignals: input.consumerMatterSignals,
      });

      if (attempts === 1) initialFindings = audit.findings;
      finalFindings = audit.findings;

      const blockers = audit.findings.filter((f) => f.severity === 'blocker');
      if (blockers.length === 0) {
        repairStatus = attempts === 1 ? 'not_started' : 'repaired';
        break;
      }

      if (!this.repairService || !this.sourceResolver) {
        repairStatus = 'unresolved';
        requiresAdvocateReview = true;
        break;
      }

      repairStatus = 'retrieving_sources';
      const sources = this.sourceResolver.resolve({
        caseRecord,
        draftText,
        findings: blockers,
        caseDetails: input.caseDetails,
        forumHint: caseRecord.jurisdiction?.courtName,
        verifiedAuthorities: input.verifiedAuthorities,
      });

      repairStatus = 'repairing';
      const repairResult = await this.repairService.repair(
        {
          draftText,
          caseRecord,
          documentKind: input.documentKind,
          documentFamily: input.documentFamily,
          caseDetails: input.caseDetails,
          requiredSections: input.requiredSections,
          playbookSummary: input.playbookSummary,
          courtProfile: sources.courtProfile,
          verifiedStatutes: sources.statutes,
          verifiedAuthorities: sources.authorities,
          findings: blockers,
          allowSemanticRepair,
        },
        sources,
      );

      for (const code of repairResult.appliedFindingCodes) {
        resolvedFindingCodes.add(code);
      }
      if (repairResult.requiresAdvocateReview) requiresAdvocateReview = true;

      if (repairResult.requiresUserConfirmation) {
        requiresUserConfirmation = true;
        confirmationQuestions = this.confirmationService
          ? this.confirmationService.buildQuestionsFromConflicts(
              repairResult.confirmationQuestions,
            )
          : repairResult.confirmationQuestions;
        // Apply deterministic/semantic changes, then continue re-audit.
        // Confirmation is reported at the end if blockers remain.
        if (!repairResult.changed) {
          repairStatus = 'needs_user_confirmation';
          break;
        }
      }

      if (!repairResult.changed) {
        repairStatus = requiresAdvocateReview
          ? 'needs_advocate_review'
          : requiresUserConfirmation
            ? 'needs_user_confirmation'
            : 'unresolved';
        break;
      }

      const nextHash = this.hashDraft(repairResult.draftText);
      if (repairDraftHashes.includes(nextHash)) {
        repairStatus = 'unresolved';
        break;
      }

      draftText = repairResult.draftText;
      repairDraftHashes.push(nextHash);
      this.invalidateCache();

      repairStatus = 'revalidating';
      const reaudit = this.evaluate({
        caseRecord,
        draftText,
        documentKind: input.documentKind,
        documentFamily: input.documentFamily,
        caseDetails: input.caseDetails,
        mode,
        requiredSections: input.requiredSections,
        consumerMatterSignals: input.consumerMatterSignals,
      });
      finalFindings = reaudit.findings;

      const remainingBlockers = reaudit.findings.filter((f) => f.severity === 'blocker');
      // Mark codes that disappeared as resolved
      const remainingCodes = new Set(remainingBlockers.map((f) => f.code));
      for (const f of blockers) {
        if (!remainingCodes.has(f.code)) resolvedFindingCodes.add(f.code);
      }

      if (remainingBlockers.length === 0) {
        repairStatus = 'repaired';
        break;
      }
    }

    const finalBlockers = finalFindings.filter((f) => f.severity === 'blocker');
    const unresolvedFindingCodes = [
      ...new Set(finalBlockers.map((f) => f.code)),
    ];
    // Remove false "resolved" that still appear
    for (const code of unresolvedFindingCodes) {
      resolvedFindingCodes.delete(code);
    }

    const finalStatus = this.toFinalStatus({
      blockers: finalBlockers,
      attempts,
      repairStatus,
      requiresUserConfirmation,
      requiresAdvocateReview,
      hadRepairs: repairDraftHashes.length > 0 || resolvedFindingCodes.size > 0,
    });

    if (finalStatus === 'needs_user_confirmation') {
      repairStatus = 'needs_user_confirmation';
    } else if (finalStatus === 'needs_advocate_review') {
      repairStatus = 'needs_advocate_review';
    } else if (finalStatus === 'blocked') {
      repairStatus = 'unresolved';
    } else if (finalStatus === 'repaired') {
      repairStatus = 'repaired';
    }

    this.logger.debug(
      `reviewAndRepair attempts=${attempts} status=${finalStatus} unresolved=${unresolvedFindingCodes.join(',')}`,
    );

    return {
      draftText,
      caseRecord,
      attempts,
      initialFindings,
      finalFindings,
      resolvedFindingCodes: [...resolvedFindingCodes],
      unresolvedFindingCodes,
      repairDraftHashes,
      requiresUserConfirmation:
        requiresUserConfirmation || finalStatus === 'needs_user_confirmation',
      confirmationQuestions,
      requiresAdvocateReview:
        requiresAdvocateReview || finalStatus === 'needs_advocate_review',
      finalStatus,
      repairStatus,
      mode,
    };
  }

  private toFinalStatus(input: {
    blockers: AccuracyFinding[];
    attempts: number;
    repairStatus: DraftRepairStatus;
    requiresUserConfirmation: boolean;
    requiresAdvocateReview: boolean;
    hadRepairs: boolean;
  }): FinalDraftResolutionStatus {
    if (input.blockers.length === 0) {
      return input.hadRepairs ? 'repaired' : 'clean';
    }
    if (input.requiresUserConfirmation || input.repairStatus === 'needs_user_confirmation') {
      return 'needs_user_confirmation';
    }
    if (input.requiresAdvocateReview || input.repairStatus === 'needs_advocate_review') {
      return 'needs_advocate_review';
    }
    return 'blocked';
  }

  private hashDraft(draftText: string): string {
    return createHash('sha256').update(draftText).digest('hex').slice(0, 16);
  }

  /** Drop cached audits when draft text changes during repair. */
  invalidateCache(): void {
    this.cache.clear();
  }

  evaluate(input: DraftAccuracyOrchestratorInput): DraftAccuracyOrchestratorResult {
    const mode = input.mode ?? 'balanced';
    const cacheKey = this.cacheKey(input, mode);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const normalizedDocumentKind = (input.documentKind ?? '').trim().toLowerCase();
    const documentFamily = input.documentFamily ?? this.inferDocumentFamily(normalizedDocumentKind);
    const isResearchMemo = documentFamily === 'research_memo';
    const isFilingGrade = documentFamily !== 'research_memo' && documentFamily !== 'unknown';
    const consumerMatterSignals =
      input.consumerMatterSignals ??
      (documentFamily === 'consumer' ||
        /consumer|opposite party|district consumer|state consumer|national consumer|deficiency in service/i.test(
          `${input.documentKind ?? ''}\n${input.caseDetails ?? ''}\n${input.draftText.slice(0, 4_000)}`,
        ));

    const byValidator: Record<string, AccuracyAuditResult> = {};

    const run = (
      key: string,
      evaluator: () => AccuracyAuditResult,
    ): AccuracyFinding[] => {
      try {
        const result = evaluator();
        byValidator[key] = result;
        return result.findings;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Accuracy validator ${key} failed: ${message}`);
        const failure: AccuracyAuditResult = {
          passed: false,
          findings: [
            {
              code: 'VALIDATOR_EXECUTION_FAILED',
              severity: 'blocker',
              message: `Accuracy validator ${key} failed and the draft cannot be safely released.`,
              repairHint: 'Fix the validator failure and rerun the complete accuracy audit.',
              metadata: { validator: key, error: message },
            },
          ],
        };
        byValidator[key] = failure;
        return failure.findings;
      }
    };

    // Phase A — deterministic red-blocker checks (always, including fast mode)
    const findings: AccuracyFinding[] = [
      ...run(
        'party_entity',
        () =>
          this.partyEntity.evaluate({
            caseRecord: input.caseRecord,
            draftText: input.draftText,
            documentKind: input.documentKind,
            caseDetails: input.caseDetails,
            consumerMatterSignals,
          }),
      ),
      ...run(
        'known_fact_blank',
        () =>
          this.knownBlank.evaluate({
            caseRecord: input.caseRecord,
            draftText: input.draftText,
          }),
      ),
      ...run(
        'fact_fidelity',
        () =>
          this.factFidelity.evaluate({
            caseRecord: input.caseRecord,
            draftText: input.draftText,
            caseDetails: input.caseDetails,
          }),
      ),
      ...run(
        'statute_section',
        () =>
          this.statuteSection.evaluate({
            draftText: input.draftText,
            documentKind: input.documentKind,
          }),
      ),
      ...run(
        'jurisdiction',
        () =>
          this.jurisdiction.evaluate({
            caseRecord: input.caseRecord,
            draftText: input.draftText,
            documentKind: input.documentKind,
            caseDetails: input.caseDetails,
            consumerMatterSignals,
          }),
      ),
      ...run(
        'liability_consent_expert',
        () =>
          this.liabilityConsentExpert.evaluate({
            caseRecord: input.caseRecord,
            draftText: input.draftText,
            caseDetails: input.caseDetails,
            documentKind: input.documentKind,
            consumerMatterSignals,
          }),
      ),
    ];

    if (normalizedDocumentKind === 'india_suit_recovery_cpc_37') {
      findings.push(
        ...run('commercial_recovery', () =>
          evaluateCommercialRecoveryDraft({
            caseRecord: input.caseRecord,
            caseDetails: input.caseDetails,
            draftText: input.draftText,
            documentKind: input.documentKind,
          }),
        ),
      );
    }

    // Document-kind fidelity checks
    if (
      isResearchMemo &&
      /(^|\n)\s*(cause title|prayer|verification|memo of parties)\b/i.test(input.draftText)
    ) {
      findings.push({
        code: 'WRONG_DOCUMENT_KIND',
        severity: 'blocker',
        message: 'A research memorandum was requested, but the generated output contains pleading-only sections.',
        repairHint: 'Regenerate using the research memorandum playbook and remove cause title, prayer, and verification sections.',
      });
    }

    if (
      isFilingGrade &&
      /\b(legal research memorandum|questions presented|short answer|research memo)\b/i.test(
        input.draftText.slice(0, 2_000),
      )
    ) {
      findings.push({
        code: 'WRONG_DOCUMENT_KIND',
        severity: 'blocker',
        message: 'A filing-grade document was requested, but the generated output appears to be a research memorandum.',
        repairHint: 'Regenerate using the selected filing playbook and required court structure.',
      });
    }

    if (documentFamily === 'unknown') {
      findings.push({
        code: 'DOCUMENT_KIND_UNRESOLVED',
        severity: 'blocker',
        message: 'The drafting system could not resolve the requested document family.',
        repairHint: 'Resolve the document kind through the playbook registry before generation and rerun the audit.',
      });
    }

    if (isFilingGrade && (!input.requiredSections || input.requiredSections.length === 0)) {
      findings.push({
        code: 'DOCUMENT_PLAYBOOK_REQUIRED',
        severity: 'blocker',
        message: `No required-section playbook was supplied for the ${documentFamily} document family.`,
        repairHint: 'Load a versioned document playbook with mandatory sections, prohibited assertions, relief tests, and companion-document rules.',
        metadata: { documentFamily, documentKind: input.documentKind ?? null },
      });
    }

    const containsLegalReferences =
      /\b(section|sections|article|articles|rule|rules|regulation|regulations|act,?\s+\d{4}|SCC|AIR|INSC|HC|v\.|vs\.)\b/i.test(
        input.draftText,
      );

    const mustRunCourtReadiness = isFilingGrade || mode === 'balanced' || mode === 'strict';

    if (mustRunCourtReadiness) {
      const extended: Array<[string, () => AccuracyAuditResult]> = [
        [
          'pleading_completeness',
          () =>
            this.pleadingCompleteness.evaluate({
              draftText: input.draftText,
              requiredSections: input.requiredSections,
              documentKind: input.documentKind,
            }),
        ],
        [
          'limitation',
          () =>
            this.limitation.evaluate({
              caseRecord: input.caseRecord,
              draftText: input.draftText,
              documentKind: input.documentKind,
            }),
        ],
        [
          'adverse_material',
          () =>
            this.adverseMaterial.evaluate({
              caseRecord: input.caseRecord,
              draftText: input.draftText,
              caseDetails: input.caseDetails,
            }),
        ],
        ...(isResearchMemo
          ? [
              [
                'research_memo_quality',
                () =>
                  this.researchMemoQuality.evaluate({
                    draftText: input.draftText,
                    documentKind: input.documentKind,
                    caseRecord: input.caseRecord,
                    caseDetails: input.caseDetails,
                    requiredSections: input.requiredSections,
                    consumerMatterSignals,
                  }),
              ] as [string, () => AccuracyAuditResult],
            ]
          : []),
        [
          'relief_test',
          () =>
            this.reliefTest.evaluate({
              draftText: input.draftText,
              documentKind: input.documentKind,
            }),
        ],
        [
          'court_language',
          () => this.courtLanguage.evaluate({ draftText: input.draftText }),
        ],
        [
          'valuation_court_fee',
          () =>
            this.valuationCourtFee.evaluate({
              caseRecord: input.caseRecord,
              draftText: input.draftText,
              documentKind: input.documentKind,
            }),
        ],
        [
          'annexure_evidence',
          () =>
            this.annexureEvidence.evaluate({
              caseRecord: input.caseRecord,
              draftText: input.draftText,
              documentKind: input.documentKind,
            }),
        ],
        [
          'citation_proposition',
          () =>
            this.citationProposition.evaluate({
              draftText: input.draftText,
              documentKind: input.documentKind,
            }),
        ],
      ];

      for (const [key, evaluator] of extended) {
        const researchMemoSkip = [
          'valuation_court_fee',
          'annexure_evidence',
          'relief_test',
          'limitation',
          'court_language',
          'citation_proposition',
        ];
        if (isResearchMemo && researchMemoSkip.includes(key)) {
          continue;
        }
        findings.push(...run(key, evaluator));
      }
    }

    if (containsLegalReferences && !byValidator.citation_proposition && !isResearchMemo) {
      findings.push(
        ...run('citation_proposition', () =>
          this.citationProposition.evaluate({
            draftText: input.draftText,
            documentKind: input.documentKind,
          }),
        ),
      );
    }

    if (mode === 'strict') {
      // Strict: escalate jurisdiction uncertainty without territorial/pecuniary language
      if (
        /\bjurisdiction\b/i.test(input.draftText) &&
        !/\b(territorial|pecuniary|section\s*34|§\s*34)\b/i.test(input.draftText)
      ) {
        findings.push({
          code: 'STATE_RULE_CONFIRMATION_REQUIRED',
          severity: 'blocker',
          message: 'Strict mode: jurisdiction analysis incomplete — confirmation required.',
          repairHint: 'Plead territorial and pecuniary bases with current statutory cites.',
        });
      }
    }

    const deduplicatedFindings = Array.from(
      new Map(
        findings.map((finding) => [
          [finding.code, finding.severity, finding.message].join('|'),
          finding,
        ]),
      ).values(),
    );

    const passed = auditPassed(deduplicatedFindings);
    if (!passed) {
      this.logger.debug(
        `Accuracy orchestrator blockers: ${deduplicatedFindings
          .filter((f) => f.severity === 'blocker')
          .map((f) => f.code)
          .join(', ')}`,
      );
    }

    const result: DraftAccuracyOrchestratorResult = {
      findings: deduplicatedFindings,
      passed,
      byValidator,
      mode,
    };
    if (this.cache.size > 200) this.cache.clear();
    this.cache.set(cacheKey, result);
    return result;
  }

  private cacheKey(input: DraftAccuracyOrchestratorInput, mode: DraftingAccuracyMode): string {
    const cr = input.caseRecord.metadata;
    const payload = JSON.stringify({
      mode,
      documentKind: input.documentKind ?? '',
      documentFamily: input.documentFamily ?? null,
      caseRecordId: cr.caseRecordId,
      caseRecordVersion: cr.version,
      sourceHash: cr.sourceHash,
      consumerMatterSignals: input.consumerMatterSignals ?? null,
      requiredSections: input.requiredSections ?? [],
      caseDetails: input.caseDetails ?? '',
      draftText: input.draftText,
    });

    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Merge six-dimension authority verification failures into the accuracy audit
   * so repair loop can address PASSAGE_NOT_VERIFIED / CITATION_WITHOUT_PROPOSITION.
   */
  appendAuthorityVerificationFindings(
    findings: AccuracyFinding[],
    authorityFindings: Array<{
      code: string;
      severity: 'blocker' | 'high' | 'medium' | 'low';
      message: string;
      repairHint?: string;
    }>,
  ): AccuracyFinding[] {
    if (authorityFindings.length === 0) return findings;
    const existing = new Set(findings.map((f) => f.code));
    const merged = [...findings];
    for (const f of authorityFindings) {
      if (existing.has(f.code)) continue;
      const severity: AccuracyFinding['severity'] =
        f.severity === 'blocker' ? 'blocker' : f.severity === 'low' ? 'info' : 'warning';
      merged.push({
        code: f.code,
        severity,
        message: f.message,
        repairHint: f.repairHint,
        metadata: { validator: 'DraftAuthorityVerificationService' },
      });
    }
    return merged;
  }

  private inferDocumentFamily(documentKind: string): DraftDocumentFamily {
    const value = documentKind.trim().toLowerCase();
    if (!value) return 'unknown';
    if (/research|memorandum|memo|opinion/.test(value)) return 'research_memo';
    if (/consumer/.test(value)) return 'consumer';
    if (/anticipatory[_\s-]*bail|regular[_\s-]*bail|bail/.test(value)) return 'bail';
    if (/criminal|complaint|quashing|fir|charge|protest petition/.test(value)) return 'criminal';
    if (/writ|article[_\s-]*(226|32)|public interest/.test(value)) return 'writ';
    if (/arbitration|section[_\s-]*(9|11|34|37)|award challenge/.test(value)) return 'arbitration';
    if (/family|maintenance|divorce|custody|guardianship|domestic violence/.test(value)) return 'family';
    if (/employment|labour|labor|termination|industrial dispute|wage/.test(value)) return 'employment';
    if (/legal[_\s-]*notice|demand[_\s-]*notice|notice/.test(value)) return 'notice';
    if (/agreement|contract|nda|lease deed|employment agreement/.test(value)) return 'contract';
    if (/affidavit|verification|undertaking/.test(value)) return 'affidavit';
    if (/appeal|revision|review petition/.test(value)) return 'appeal_revision';
    if (/civil|plaint|written statement|specific performance|injunction|recovery|property|tenancy/.test(value)) {
      return 'civil';
    }
    return 'unknown';
  }
}
