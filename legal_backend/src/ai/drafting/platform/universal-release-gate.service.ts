import { Injectable, Logger } from '@nestjs/common';
import type { CaseRecord } from '../contracts/case-record';
import type { DraftPlaybook } from '../contracts/draft-playbook';
import type { DraftTypeAdapter } from '../contracts/draft-type-adapter';
import type {
  CheckResult,
  GateFinding,
  ReleaseGateResult,
} from '../contracts/release-gate';
import { userLabelForStatus } from '../contracts/release-gate';
import type { StructuredDraft } from '../contracts/structured-draft';
import { flattenDraftText } from '../contracts/structured-draft';
import { TimelineDeterministicRuleEngine } from './validators/timeline-deterministic-rule-engine';
import { TimelineSemanticContradictionAuditor } from './validators/timeline-semantic-contradiction-auditor';
import { PartyRoleConsistencyValidator } from './validators/party-role-consistency.validator';
import { AtomicEntailmentAuditor } from './validators/atomic-entailment-auditor';
import { DraftLeakSanitizer } from './validators/draft-leak-sanitizer.service';
import { StatuteExistenceVerifier } from './validators/statute-existence-verifier';
import { AuthorityVerificationGateValidator } from './validators/authority-verification-gate.validator';
import { SourceConflictResolver } from './source-conflict-resolver.service';
import { DraftPlaybookRegistryService } from './draft-playbook-registry.service';
import { DraftAccuracyMetricsService } from './draft-accuracy-metrics.service';
import type { VerifiedAuthorityRecord } from '../contracts/authority-verification';
import { DraftAccuracyOrchestratorService } from '../accuracy/draft-accuracy-orchestrator.service';
import type { DraftingAccuracyMode } from '../accuracy/draft-accuracy-orchestrator.service';
import type { CourtReadyStatus } from '../contracts/release-gate';
import { DraftProvenanceService } from '../accuracy/draft-provenance.service';

export interface ReleaseGateEvaluateInput {
  caseRecord: CaseRecord;
  structuredDraft: StructuredDraft;
  playbook: DraftPlaybook;
  adapter: DraftTypeAdapter;
  confirmedCaseRecordVersion?: number;
  registryLeakTokens?: string[];
  /** Optional Table of Authorities / enrich verification records. */
  authorityRecords?: VerifiedAuthorityRecord[];
  /** Raw intake narrative for fidelity checks. */
  caseDetails?: string;
  accuracyMode?: DraftingAccuracyMode;
  /** Provenance from a prior reviewAndRepair cycle. */
  repairProvenance?: {
    repairAttemptCount?: number;
    initialFindingCodes?: string[];
    resolvedFindingCodes?: string[];
    unresolvedFindingCodes?: string[];
    repairDraftHashes?: string[];
    finalResolutionStatus?:
      | 'clean'
      | 'repaired'
      | 'needs_user_confirmation'
      | 'needs_advocate_review'
      | 'blocked';
    confirmationQuestions?: Array<{
      findingCode: string;
      field: string;
      question: string;
      options?: Array<{ label: string; value: unknown; sourceIds: string[] }>;
    }>;
  };
}

/**
 * Universal release gate — universal checks + playbook.releaseChecks via adapter.
 * No bail-specific logic embedded here.
 */
@Injectable()
export class UniversalReleaseGateService {
  private readonly logger = new Logger(UniversalReleaseGateService.name);

  constructor(
    private readonly chronologyDeterministic: TimelineDeterministicRuleEngine,
    private readonly chronologySemantic: TimelineSemanticContradictionAuditor,
    private readonly partyConsistency: PartyRoleConsistencyValidator,
    private readonly factEntailment: AtomicEntailmentAuditor,
    private readonly leakSanitizer: DraftLeakSanitizer,
    private readonly statuteExistence: StatuteExistenceVerifier,
    private readonly authorityVerification: AuthorityVerificationGateValidator,
    private readonly sourceConflicts: SourceConflictResolver,
    private readonly playbookRegistry: DraftPlaybookRegistryService,
    private readonly metrics: DraftAccuracyMetricsService,
    private readonly accuracyOrchestrator: DraftAccuracyOrchestratorService,
    private readonly provenance: DraftProvenanceService,
  ) {}

  evaluate(input: ReleaseGateEvaluateInput): ReleaseGateResult {
    const { caseRecord, structuredDraft, playbook, adapter } = input;
    const checks: Record<string, CheckResult> = {};
    const verifierVersions: Record<string, string> = {};

    const push = (key: string, findings: GateFinding[], version?: string) => {
      checks[key] = {
        passed: findings.every((f) => f.severity !== 'blocker'),
        findings,
        verifierVersion: version,
      };
      if (version) verifierVersions[key] = version;
    };

    push(
      'chronology',
      [
        ...this.chronologyDeterministic.evaluate(caseRecord, structuredDraft),
        ...this.chronologySemantic.evaluate(caseRecord, structuredDraft),
      ],
      this.chronologyDeterministic.version,
    );
    verifierVersions.chronology_semantic = this.chronologySemantic.version;

    push(
      'party_consistency',
      this.partyConsistency.evaluate(caseRecord, structuredDraft),
      this.partyConsistency.version,
    );

    push(
      'fact_entailment',
      this.factEntailment.evaluate(structuredDraft, caseRecord),
      this.factEntailment.version,
    );

    const leak = this.leakSanitizer.sanitize(
      structuredDraft,
      input.registryLeakTokens ?? [],
    );
    push('leak_scan', leak.findings, this.leakSanitizer.version);
    if (leak.cleanedText && leak.hadLeaks) {
      structuredDraft.fullMarkdown = leak.cleanedText;
    }

    push(
      'section_existence',
      this.statuteExistence.evaluate(caseRecord, structuredDraft),
      this.statuteExistence.version,
    );

    push(
      'authority_verification',
      this.authorityVerification.evaluate(input.authorityRecords, {
        minVerifiedCases: playbook.minVerifiedCaseAuthorities ?? 0,
        requiredTopics: playbook.issueTaxonomy
          .filter((issue) => issue.required && (playbook.minVerifiedCaseAuthorities ?? 0) > 0)
          .flatMap((issue) => issue.authorities?.length ? issue.authorities : [issue.id]),
      }),
      this.authorityVerification.version,
    );

    const conflicts = this.sourceConflicts.evaluate(caseRecord);
    push('source_conflicts', conflicts.findings);

    const missing = caseRecord.missingFields
      .filter((m) => m.blocking)
      .map(
        (m): GateFinding => ({
          id: `missing:${m.field}`,
          checkId: 'missing_fields',
          severity: 'blocker',
          message: m.description,
          repairHint: `Complete the required field "${m.field}" and rerun readiness.`,
        }),
      );
    push('missing_fields', missing);

    // Version checks
    const versionFindings: GateFinding[] = [];
    const expectedVersion =
      input.confirmedCaseRecordVersion ?? caseRecord.metadata.version;
    if (structuredDraft.caseRecordVersion !== expectedVersion) {
      versionFindings.push({
        id: 'version:case_record_mismatch',
        checkId: 'case_record_version',
        severity: 'blocker',
        message: `Draft Case Record version ${structuredDraft.caseRecordVersion} != confirmed ${expectedVersion}`,
      });
    }
    if (structuredDraft.playbookVersion !== playbook.version) {
      versionFindings.push({
        id: 'version:playbook_mismatch',
        checkId: 'playbook_version',
        severity: 'blocker',
        message: `Draft playbook version ${structuredDraft.playbookVersion} != active ${playbook.version}`,
      });
    }
    if (
      this.playbookRegistry.isVerificationStale(
        structuredDraft.playbookVersion,
        playbook.documentKind,
      )
    ) {
      versionFindings.push({
        id: 'version:playbook_stale',
        checkId: 'playbook_version',
        severity: 'blocker',
        message: 'Verification stale — playbook version changed',
      });
    }
    if (caseRecord.metadata.status !== 'confirmed' && playbook.filingGrade) {
      versionFindings.push({
        id: 'version:case_record_unconfirmed',
        checkId: 'case_record_version',
        severity: 'warning',
        message: 'Case Record not confirmed by user',
      });
    }
    push('case_record_version', versionFindings.filter((f) => f.checkId === 'case_record_version'));
    push('playbook_version', versionFindings.filter((f) => f.checkId === 'playbook_version'));

    // Adapter / playbook-specific checks
    const adapterFindings: GateFinding[] = [
      ...adapter.validateDraft(structuredDraft, caseRecord, playbook),
      ...adapter.validatePrayer(structuredDraft, caseRecord),
      ...adapter.validateVerification(structuredDraft),
    ];
    for (const rc of playbook.releaseChecks) {
      const matched = adapterFindings.filter(
        (f) => f.checkId === rc.checkKey || f.id.includes(rc.id),
      );
      push(`playbook:${rc.id}`, matched.length ? matched : []);
    }
    push('adapter_validate', adapterFindings);

    // Universal accuracy orchestrator (party / blank / fidelity / statute / jurisdiction + more)
    const draftText = flattenDraftText(structuredDraft);
    const accuracyMode = input.accuracyMode ?? (playbook.filingGrade ? 'balanced' : 'fast');
    const accuracy = this.accuracyOrchestrator.evaluate({
      caseRecord,
      draftText,
      documentKind: playbook.documentKind,
      caseDetails: input.caseDetails,
      mode: accuracyMode,
      requiredSections: playbook.requiredSections?.map((s) => s.title),
    });
    const accuracyFindings: GateFinding[] = accuracy.findings.map((f) => ({
      id: `accuracy:${f.code}`,
      checkId: f.code,
      severity: f.severity === 'blocker' ? 'blocker' : f.severity === 'warning' ? 'warning' : 'info',
      message: f.message,
      repairHint: f.repairHint,
    }));
    push('universal_accuracy', accuracyFindings, 'accuracy-orchestrator-v1');

    const allFindings = Object.values(checks).flatMap((c) => c.findings);
    const blockers = allFindings.filter((f) => f.severity === 'blocker');
    const warnings = allFindings.filter((f) => f.severity === 'warning');

    let status: ReleaseGateResult['status'];
    if (blockers.length > 0) status = 'draft_blocked';
    else if (warnings.length > 0 || playbook.filingGrade) status = 'lawyer_review_recommended';
    else status = 'automated_checks_passed';

    // Filing-grade always recommends lawyer review even when clean
    if (status === 'automated_checks_passed' && playbook.filingGrade) {
      status = 'lawyer_review_recommended';
    }

    const canExport = blockers.length === 0;

    let courtReadyStatus: CourtReadyStatus = 'not_ready';
    if (canExport && playbook.filingGrade) courtReadyStatus = 'advocate_review_required';
    else if (canExport) courtReadyStatus = 'system_validated';

    const blockerWeight = Math.min(1, blockers.length * 0.15);
    const warningWeight = Math.min(0.4, warnings.length * 0.05);
    const base = Math.max(0, 1 - blockerWeight - warningWeight);
    const scores = {
      qualityScore: base,
      factFidelityScore: accuracy.byValidator.fact_fidelity?.passed ? base : base * 0.5,
      legalAccuracyScore: accuracy.byValidator.statute_section?.passed ? base : base * 0.5,
      proceduralAccuracyScore: accuracy.byValidator.pleading_completeness?.passed
        ? base
        : base * 0.6,
      completenessScore: accuracy.byValidator.known_fact_blank?.passed ? base : base * 0.4,
      citationQualityScore: checks.authority_verification?.passed ? base : base * 0.5,
    };

    this.provenance.record({
      caseRecordId: caseRecord.metadata.caseRecordId,
      caseRecordVersion: caseRecord.metadata.version,
      playbookId: playbook.documentKind,
      playbookVersion: playbook.version,
      documentKind: playbook.documentKind,
      releaseStatus: status,
      courtReadyStatus,
      blockerCodes: blockers.map((b) => b.checkId),
      accuracyMode,
      repairAttemptCount: input.repairProvenance?.repairAttemptCount,
      initialFindingCodes: input.repairProvenance?.initialFindingCodes,
      resolvedFindingCodes: input.repairProvenance?.resolvedFindingCodes,
      unresolvedFindingCodes: input.repairProvenance?.unresolvedFindingCodes,
      repairDraftHashes: input.repairProvenance?.repairDraftHashes,
    });

    const result: ReleaseGateResult = {
      status,
      canExport,
      canExportReviewCopy: Boolean(structuredDraft.fullMarkdown.trim()),
      canExportForFiling: false,
      blockers,
      warnings,
      checks,
      caseRecordVersion: caseRecord.metadata.version,
      playbookVersion: playbook.version,
      verifierVersions,
      userLabel: userLabelForStatus(status),
      requiresHumanReview: playbook.filingGrade || status === 'lawyer_review_recommended',
      courtReadyStatus,
      scores,
      finalResolutionStatus: input.repairProvenance?.finalResolutionStatus,
      repairAttemptCount: input.repairProvenance?.repairAttemptCount,
      resolvedFindingCodes: input.repairProvenance?.resolvedFindingCodes,
      unresolvedFindingCodes: input.repairProvenance?.unresolvedFindingCodes,
      confirmationQuestions: input.repairProvenance?.confirmationQuestions,
    };

    this.metrics.recordReleaseGate({
      documentKind: playbook.documentKind,
      status: result.status,
      blockerCount: blockers.length,
      warningCount: warnings.length,
      blockerTypes: blockers.map((b) => b.checkId),
    });

    this.logger.log(
      `ReleaseGate ${playbook.documentKind}: ${result.status} blockers=${blockers.length} canExport=${canExport} courtReady=${courtReadyStatus}`,
    );

    return result;
  }
}
