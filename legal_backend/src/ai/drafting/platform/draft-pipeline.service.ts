import { Injectable, Logger } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import type { IssuePlan } from '../contracts/issue-plan';
import type { ReleaseGateResult, ValidationResult } from '../contracts/release-gate';
import type { StructuredDraft, DraftGenerationLineage } from '../contracts/structured-draft';
import type { DraftPlaybook } from '../contracts/draft-playbook';
import { CaseRecordExtractionService, type ExtractCaseRecordInput } from './case-record-extraction.service';
import { SourceConflictResolver } from './source-conflict-resolver.service';
import { DocumentKindResolver } from './document-kind-resolver.service';
import { DraftPlaybookRegistryService } from './draft-playbook-registry.service';
import { IssuePlanService } from './issue-plan.service';
import { StructuredDraftGenerator } from './structured-draft-generator.service';
import { UniversalReleaseGateService } from './universal-release-gate.service';
import { HumanReviewService } from './human-review.service';
import { DraftAccuracyMetricsService } from './draft-accuracy-metrics.service';
import { DraftAccuracyOrchestratorService } from '../accuracy/draft-accuracy-orchestrator.service';

export interface DraftPipelineRunInput extends ExtractCaseRecordInput {
  tenantId?: string;
  userId?: string;
  /** Pre-confirmed Case Record (skips extract). */
  caseRecord?: CaseRecord;
  confirmUserId?: string;
  conflictResolutions?: Array<{
    contradictionId: string;
    chosenFactId: string;
    note?: string;
  }>;
  sectionMarkdown?: Record<string, string>;
  /** Existing full draft text to annotate + gate. */
  existingDraftMarkdown?: string;
  lineage?: Partial<DraftGenerationLineage>;
  skipConfirmRequirement?: boolean;
  /** Skip automated review-and-repair (evaluate-only gate). */
  skipAutoRepair?: boolean;
  accuracyMode?: 'fast' | 'balanced' | 'strict';
  contentRevision?: number;
  verificationAudit?: { evidencePackId?: string; outputHash?: string };
}

export interface DraftPipelineResult {
  caseRecord: CaseRecord;
  playbook: DraftPlaybook;
  intakeValidation: ValidationResult;
  conflictSuggestions: Array<{
    contradictionId: string;
    preferredFactId: string;
    reason: string;
  }>;
  issuePlan: IssuePlan | null;
  structuredDraft: StructuredDraft | null;
  releaseGate: ReleaseGateResult | null;
  blocked: boolean;
  blockReasons: string[];
  canExport: boolean;
}

/**
 * Universal accuracy pipeline:
 * Extract → SourceConflictResolver → DocumentKindResolver → Playbook →
 * Adapter.validateIntake → IssuePlan → StructuredDraft → Adapter.validate → UniversalReleaseGate
 */
@Injectable()
export class DraftPipelineService {
  private readonly logger = new Logger(DraftPipelineService.name);

  constructor(
    private readonly extraction: CaseRecordExtractionService,
    private readonly conflicts: SourceConflictResolver,
    private readonly kindResolver: DocumentKindResolver,
    private readonly playbooks: DraftPlaybookRegistryService,
    private readonly issuePlans: IssuePlanService,
    private readonly generator: StructuredDraftGenerator,
    private readonly releaseGate: UniversalReleaseGateService,
    private readonly humanReview: HumanReviewService,
    private readonly metrics: DraftAccuracyMetricsService,
    private readonly accuracyOrchestrator: DraftAccuracyOrchestratorService,
  ) {}

  extractOnly(input: ExtractCaseRecordInput): {
    caseRecord: CaseRecord;
    playbook: DraftPlaybook;
    intakeValidation: ValidationResult;
    conflictSuggestions: DraftPipelineResult['conflictSuggestions'];
  } {
    const playbook = this.playbooks.getPlaybook(
      input.jurisdiction ?? 'IN',
      input.documentKind,
    );
    let caseRecord = this.extraction.extract({
      ...input,
      playbookId: playbook.id,
      playbookVersion: playbook.version,
    });
    // Stamp jurisdiction court
    if (input.courtName) {
      caseRecord = {
        ...caseRecord,
        jurisdiction: { ...caseRecord.jurisdiction, courtName: input.courtName },
      };
    }
    const adapter = this.kindResolver.getAdapter(input.documentKind);
    const intakeValidation = adapter.validateIntake(caseRecord, playbook);
    const conflictResult = this.conflicts.evaluate(caseRecord);
    return {
      caseRecord,
      playbook,
      intakeValidation,
      conflictSuggestions: conflictResult.suggestions,
    };
  }

  confirmCaseRecord(
    caseRecord: CaseRecord,
    userId: string,
    resolutions?: DraftPipelineRunInput['conflictResolutions'],
  ): CaseRecord {
    return this.extraction.confirm(caseRecord, userId, resolutions);
  }

  async run(input: DraftPipelineRunInput): Promise<DraftPipelineResult> {
    const blockReasons: string[] = [];
    const playbook = this.playbooks.getPlaybook(
      input.jurisdiction ?? 'IN',
      input.documentKind,
    );
    const adapter = this.kindResolver.getAdapter(input.documentKind);

    let caseRecord =
      input.caseRecord ??
      this.extraction.extract({
        ...input,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
      });

    if (input.courtName) {
      caseRecord = {
        ...caseRecord,
        jurisdiction: { ...caseRecord.jurisdiction, courtName: input.courtName },
      };
    }

    if (input.confirmUserId) {
      caseRecord = this.extraction.confirm(
        caseRecord,
        input.confirmUserId,
        input.conflictResolutions,
      );
    }

    const intakeValidation = adapter.validateIntake(caseRecord, playbook);
    const conflictResult = this.conflicts.evaluate(caseRecord);

    if (conflictResult.unresolvedBlockers.length > 0) {
      blockReasons.push(
        ...conflictResult.unresolvedBlockers.map((c) => c.description),
      );
    }

    if (
      playbook.filingGrade &&
      caseRecord.metadata.status !== 'confirmed' &&
      !input.skipConfirmRequirement
    ) {
      blockReasons.push('Case Record must be confirmed before filing-grade generation');
    }

    // When auditing an existing draft, always continue to release gate.
    const auditExisting = Boolean(input.existingDraftMarkdown);
    if (blockReasons.length > 0 && !auditExisting) {
      return {
        caseRecord,
        playbook,
        intakeValidation,
        conflictSuggestions: conflictResult.suggestions,
        issuePlan: null,
        structuredDraft: null,
        releaseGate: null,
        blocked: true,
        blockReasons,
        canExport: false,
      };
    }

    const issuePlan = this.issuePlans.buildIssuePlan(caseRecord, playbook, adapter);
    if (issuePlan.blocked && !auditExisting) {
      return {
        caseRecord,
        playbook,
        intakeValidation,
        conflictSuggestions: conflictResult.suggestions,
        issuePlan,
        structuredDraft: null,
        releaseGate: null,
        blocked: true,
        blockReasons: issuePlan.blockReasons,
        canExport: false,
      };
    }

    let structuredDraft: StructuredDraft;
    if (input.existingDraftMarkdown) {
      structuredDraft = this.generator.annotateExistingMarkdown(
        caseRecord,
        playbook,
        issuePlan,
        input.existingDraftMarkdown,
        input.lineage,
      );
    } else {
      structuredDraft = this.generator.generate({
        caseRecord,
        playbook,
        issuePlan,
        sectionMarkdown: input.sectionMarkdown,
        lineage: input.lineage,
      });
    }

    if (structuredDraft.lineage) {
      this.metrics.recordLineage(
        structuredDraft.id,
        playbook.documentKind,
        structuredDraft.lineage,
      );
    }

    const accuracyMode = input.accuracyMode ?? (playbook.filingGrade ? 'balanced' : 'fast');
    let repairProvenance: Parameters<UniversalReleaseGateService['evaluate']>[0]['repairProvenance'];

    if (!input.skipAutoRepair) {
      try {
        const repaired = await this.accuracyOrchestrator.reviewAndRepair(
          {
            draftText: structuredDraft.fullMarkdown,
            caseRecord,
            documentKind: playbook.documentKind,
            caseDetails: input.caseDetails,
            requiredSections: playbook.requiredSections?.map((s) => s.title),
            playbookSummary: `${playbook.documentKind}@${(playbook as { version?: string }).version ?? '1'}`,
          },
          { mode: accuracyMode },
        );
        if (repaired.draftText !== structuredDraft.fullMarkdown) {
          structuredDraft = {
            ...structuredDraft,
            fullMarkdown: repaired.draftText,
          };
        }
        repairProvenance = {
          repairAttemptCount: repaired.attempts,
          initialFindingCodes: repaired.initialFindings.map((f) => f.code),
          resolvedFindingCodes: repaired.resolvedFindingCodes,
          unresolvedFindingCodes: repaired.unresolvedFindingCodes,
          repairDraftHashes: repaired.repairDraftHashes,
          finalResolutionStatus: repaired.finalStatus,
          confirmationQuestions: repaired.confirmationQuestions,
        };
      } catch (err) {
        this.logger.warn(
          `Auto repair skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const releaseGate = this.releaseGate.evaluate({
      caseRecord,
      structuredDraft,
      playbook,
      adapter,
      confirmedCaseRecordVersion: caseRecord.metadata.version,
      caseDetails: input.caseDetails,
      accuracyMode,
      repairProvenance,
    });

    const draftHash = HumanReviewService.draftHash(structuredDraft.fullMarkdown);
    const evidenceRevision = input.verificationAudit?.evidencePackId ?? input.verificationAudit?.outputHash ?? 'pending';
    const courtProfileId = `${playbook.jurisdiction}:${playbook.documentKind}`;
    const approval = input.tenantId
      ? await this.humanReview.isApprovalValid({
          tenantId: input.tenantId,
          draftId: structuredDraft.id,
          caseRecordId: caseRecord.metadata.caseRecordId,
          caseRecordVersion: caseRecord.metadata.version,
          playbookVersion: playbook.version,
          draftHash,
          evidenceRevision,
          courtProfileId,
          contentRevision: input.contentRevision ?? 0,
          releaseDigest: draftHash,
        })
      : { valid: false, reason: 'Tenant context unavailable' };

    const canExport = this.humanReview.canExportWithHumanReview(
      releaseGate,
      playbook.filingGrade,
      approval,
    );

    // For non-filing stubs, allow export when gate passes even without human review
    const finalCanExport = playbook.filingGrade
      ? canExport
      : releaseGate.canExport;
    releaseGate.canExportReviewCopy = Boolean(structuredDraft.fullMarkdown.trim());
    releaseGate.canExportForFiling = finalCanExport;
    if (finalCanExport && playbook.filingGrade) {
      releaseGate.courtReadyStatus = 'advocate_approved';
      releaseGate.userLabel = 'Advocate approved — ready for filing export';
    } else if (releaseGate.canExport && playbook.filingGrade) {
      releaseGate.courtReadyStatus = 'advocate_review_required';
      releaseGate.userLabel = 'System checks passed — advocate approval required';
    }

    this.logger.log(
      `DraftPipeline ${playbook.documentKind}: blocked=${!finalCanExport && releaseGate.status === 'draft_blocked'} status=${releaseGate.status}`,
    );

    return {
      caseRecord,
      playbook,
      intakeValidation,
      conflictSuggestions: conflictResult.suggestions,
      issuePlan,
      structuredDraft,
      releaseGate,
      blocked: releaseGate.status === 'draft_blocked',
      blockReasons: releaseGate.blockers.map((b) => b.message),
      canExport: finalCanExport,
    };
  }
}
