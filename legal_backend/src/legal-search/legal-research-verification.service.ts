import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { SubstanceVerificationService, normalizeBnssText } from '@/ai/citations/substance-verification.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { SentenceAuditResult } from './sentence-audit.service';
import type { ProvenanceMetadata, RetrievedAuthority, VerificationStatus } from './legal-retrieval.types';
import { summarizeSourceTiers } from './source-tier.util';
import {
  createEmptyDimensions,
  dedupeFindings,
  resolvePublicationState,
  summarizeFindings,
  type VerificationDimensions,
  type VerificationFinding,
  type VerifiedPropositionSummary,
  type PublicationState,
} from '@/ai/verification/verification-finding.types';
import {
  LegalEvidencePackService,
  type LegalEvidencePack,
} from '@/ai/legal-research/legal-evidence-pack.service';
import {
  ClaimLevelVerificationService,
  type ClaimVerificationOverrides,
  type ClaimVerificationResult,
  type UnsupportedKeyClaim,
} from '@/ai/legal-research/claim-level-verification.service';
import type {
  LegalResearchDraft,
  PassageSupport,
} from '@/ai/legal-research/legal-research-draft.types';
import { PropositionExtractionService } from '@/ai/verification/proposition-extraction.service';
import { ClaimRepairService } from '@/ai/verification/claim-repair.service';
import {
  UnifiedVerificationService,
  type UnifiedVerificationResult,
} from '@/ai/verification/unified-verification.service';
import { LegalResearchLlmVerifierService } from '@/ai/legal-research/legal-research-llm-verifier.service';
import { checkDomainCompleteness } from '@/ai/legal-research/domain-completeness-checker';
import { ResearchRetrievalGapService } from '@/legal-sources/research-retrieval-gap.service';

/**
 * Dimensions where an unresolved failure means the memo may mislead a lawyer, so
 * the independent verifier is worth a second model call.
 */
const MATERIAL_VERIFIER_DIMENSIONS = new Set([
  'identity',
  'passage',
  'quotation',
  'citation',
  'currentLaw',
  'treatment',
  'hierarchy',
  'jurisdiction',
]);

export interface VerificationPipelineInput {
  query: string;
  outputMarkdown: string;
  authorities: RetrievedAuthority[];
  isBareActQuery: boolean;
  modelName?: string;
  /** Independent LLM verifier model (e.g. gpt-5.6-sol). Separate from synthesis. */
  verifierModel?: string;
  /** When true, run independent adversarial LLM audit after deterministic checks. */
  runLlmAdversarialVerify?: boolean;
  strictConsumer?: boolean;
  /** ISO-3166-1 alpha-2 country code (e.g. 'IN'). Used for jurisdiction-specific accuracy checks. */
  countryCode?: string;
  legalDomain?: string;
  legalIssues?: string[];
  regenerate?: (correctionPrompt: string) => Promise<string>;
  /** Populated when the query requested a specific statute section. */
  requestedSection?: { actId: string; section: string; statuteShortName?: string };
  /** True when the exact section was found in corpus and pinned. */
  exactSectionFound?: boolean;
  /** When true, skip live IK and hybrid-search lookups inside citation verification. */
  fastMode?: boolean;
  /** Pre-verified structured draft from DEEP synthesis — skip markdown re-extraction. */
  structuredDraft?: import('@/ai/legal-research/legal-research-draft.types').LegalResearchDraft;
  /** Findings already produced during structured synthesis (merged, not replaced). */
  structuredFindings?: VerificationFinding[];
  /** Deterministic claim checks already run against the same structured draft/evidence pack. */
  preverifiedClaims?: ClaimVerificationResult;
  /** Retrieval-stage signals persisted with final verification gaps. */
  retrievalSignals?: {
    domainFitLow?: boolean;
    caseLawRequested?: boolean;
    caseLawSearchStatus?:
      | 'not_configured'
      | 'searched'
      | 'no_hits'
      | 'timeout'
      | 'rate_limited'
      | 'unauthorized'
      | 'circuit_open'
      | 'error';
    rejectedCandidates?: Array<{
      authorityId: string;
      reason: string;
      gate: 'heading_only_statute' | 'citation_metadata' | 'case_relevance';
    }>;
  };
  /** Disable when an orchestrator performs a later bounded repair and records only the final pass. */
  persistRetrievalGaps?: boolean;
  aiOutputId?: string;
  /**
   * When structured synthesis salvage ran (no proposition plan), skip markdown
   * proposition extraction and query-split matter facts — avoid Review noise.
   */
  skipClaimExtraction?: boolean;
}

export interface VerificationPipelineResult {
  outputMarkdown: string;
  citations: Prisma.InputJsonValue;
  provenance: ProvenanceMetadata;
  sentenceAudit: SentenceAuditResult;
  regenerated: boolean;
  refusedSubstantiveClaims: boolean;
  findings: VerificationFinding[];
  propositions: VerifiedPropositionSummary[];
  dimensions: VerificationDimensions;
  publicationState: PublicationState;
  outputHash: string;
  verificationAdvisories?: Array<{ code: string; message: string; claimIds: string[] }>;
  /**
   * Bounded repair handoff. The gateway/retrieval orchestrator may issue one
   * targeted query for these claims, rebuild the evidence pack, and rerun verification.
   */
  unsupportedKeyClaims?: UnsupportedKeyClaim[];
  rejectedCitations?: Prisma.InputJsonValue;
  verificationGaps?: Prisma.InputJsonValue;
  safeForReliance?: boolean;
  /** What the independent self-verification pass did, for telemetry and admin logs. */
  selfVerification?: SelfVerificationTelemetry;
}

export interface SelfVerificationTelemetry {
  /** Independent LLM verifier actually ran. */
  ran: boolean;
  /** Why it was escalated (or why it was skipped). */
  escalationReason?: string;
  /** Claims the evidence pack could not support. */
  unsupportedClaimCount: number;
  /** Non-passing BLOCKER/HIGH findings across all verifiers. */
  materialFindingCount: number;
}

@Injectable()
export class LegalResearchVerificationService {
  private readonly logger = new Logger(LegalResearchVerificationService.name);

  constructor(
    private readonly substanceVerification: SubstanceVerificationService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly evidencePackService: LegalEvidencePackService,
    private readonly claimVerifier: ClaimLevelVerificationService,
    private readonly propositionExtraction: PropositionExtractionService,
    private readonly claimRepair: ClaimRepairService,
    private readonly unifiedVerification: UnifiedVerificationService,
    private readonly llmAdversarialVerifier: LegalResearchLlmVerifierService,
    private readonly retrievalGapService: ResearchRetrievalGapService,
  ) {}

  async verifyAndPublish(input: VerificationPipelineInput): Promise<VerificationPipelineResult> {
    // Stage 1: Deterministic text normalisation (mutation applied once before any checks).
    let outputMarkdown = normalizeBnssText(input.outputMarkdown);
    let regenerated = false;

    // Stage 2: Shared detection checks via UnifiedVerificationService.
    let verification = await this.runChecks({
      ...input,
      outputMarkdown,
    });

    // Stage 3: Optional regeneration only when there are real problems.
    if (
      input.regenerate &&
      (!verification.substancePassed ||
        !verification.classifierPassed ||
        verification.citation.unverifiableCitations.length > 2 ||
        (verification.citation.rejectedCitations?.length ?? 0) > 0 ||
        !verification.sectionAlignment.passed) &&
      input.modelName
    ) {
      const correctionPrompt = this.buildCorrectionPrompt(input, verification);
      try {
        const regeneratedText = await input.regenerate(correctionPrompt);
        outputMarkdown = normalizeBnssText(regeneratedText);
        regenerated = true;
        verification = await this.runChecks({ ...input, outputMarkdown });
      } catch {
        // keep first pass on regenerate failure
      }
    }

    const strictFail =
      input.strictConsumer &&
      input.isBareActQuery &&
      (!verification.substancePassed ||
        !verification.classifierPassed ||
        !verification.sectionAlignment.passed ||
        input.authorities.filter((a) => a.sourceTier === 'primary' || a.sourceTier === 'seed')
          .length === 0);

    const refusedSubstantiveClaims = strictFail && !verification.substancePassed;

    if (refusedSubstantiveClaims) {
      outputMarkdown = this.buildRefusalOutput(input.query, verification.substanceWarnings);
    } else {
      outputMarkdown = this.appendWarnings(outputMarkdown, verification);
    }

    // Stage 5: Claim-level verify + repair, then FINAL immutable audit on published bytes.
    const skipClaims = input.skipClaimExtraction === true && !input.structuredDraft;
    const evidencePack = this.evidencePackService.buildFromAuthorities({
      jurisdiction: input.countryCode ?? 'unknown',
      authorities: input.authorities,
      matterFacts: skipClaims ? [] : this.extractMatterFacts(input.query),
    });
    let extractedDraft = input.structuredDraft
      ? input.structuredDraft
      : skipClaims
        ? {
            questionPresented: input.query.slice(0, 500),
            directAnswer: {
              text: 'Structured synthesis failed — claim extraction skipped.',
              confidence: 0,
            },
            issues: [],
            practicalSteps: [],
            limitations: ['Structured proposition plan unavailable'],
            unansweredQuestions: [],
            authoritiesReliedOn: [],
          }
        : this.propositionExtraction.fromMarkdown(outputMarkdown, evidencePack);
    // Re-run against the current request context. A preverified result may have
    // been produced before query/domain context was attached and must not bypass
    // relevance verification for this publication attempt.
    let claimVerification = skipClaims
      ? {
          claimAudits: [],
          verificationStatus: 'INDETERMINATE' as const,
          limitations: [
            {
              issueId: 'system',
              message:
                'Structured proposition plan unavailable — claim extraction skipped.',
            },
          ],
          repairedClaims: [] as string[],
          removedClaims: [] as string[],
          findings: [
            {
              checkId: 'system:structured_plan_failed',
              state: 'INDETERMINATE' as const,
              severity: 'BLOCKER' as const,
              dimension: 'system' as const,
              evidenceIds: [],
              explanation:
                'Structured proposition plan unavailable — claim-level verification skipped to avoid Review noise on salvage text.',
              repairAction: 'ABSTAIN' as const,
              verifierVersion: 'research-verification-v3',
            },
          ],
          propositions: [],
          dimensions: createEmptyDimensions(),
          publicationState: 'VERIFICATION_UNAVAILABLE' as const,
          advisories: [],
          unsupportedKeyClaims: [],
        }
      : this.claimVerifier.verify({
          draft: extractedDraft,
          evidencePack,
          jurisdiction: input.countryCode ?? 'unknown',
          query: input.query,
          legalIssues: input.legalIssues,
          legalDomain: input.legalDomain,
        });
    const semanticOverrides = skipClaims
      ? null
      : await this.runSemanticVerificationBatch({
          modelName: input.verifierModel ?? input.modelName,
          draft: extractedDraft,
          evidencePack,
          initial: claimVerification,
        });
    if (semanticOverrides) {
      claimVerification = this.claimVerifier.verify({
        draft: extractedDraft,
        evidencePack,
        jurisdiction: input.countryCode ?? 'unknown',
        query: input.query,
        legalIssues: input.legalIssues,
        legalDomain: input.legalDomain,
        semanticOverrides,
      });
    }
    if (
      !skipClaims &&
      (claimVerification.removedClaims.length > 0 || claimVerification.repairedClaims.length > 0)
    ) {
      outputMarkdown = this.claimRepair.repairMarkdown(
        outputMarkdown,
        claimVerification.claimAudits,
        extractedDraft,
      );
      if (!input.structuredDraft) {
        extractedDraft = this.propositionExtraction.fromMarkdown(outputMarkdown, evidencePack);
        claimVerification = this.claimVerifier.verify({
          draft: extractedDraft,
          evidencePack,
          jurisdiction: input.countryCode ?? 'unknown',
          query: input.query,
          legalIssues: input.legalIssues,
          legalDomain: input.legalDomain,
        });
      }
    }

    // Always audit the exact bytes that will be published. Context-aware claim
    // verification can change the effective claim set even when no markdown
    // mutation was required, so the initial pre-claim audit is not reusable.
    const finalChecks = await this.runChecks({ ...input, outputMarkdown });
    const finalSentenceAudit = finalChecks.sentenceAudit;
    const outputHash = createHash('sha256').update(outputMarkdown).digest('hex');
    const retainedStructuredFindings = (input.structuredFindings ?? []).filter(
      (finding) =>
        !(
          finding.propositionId &&
          ((finding.dimension === 'passage' &&
            semanticOverrides?.passageByClaimId?.[finding.propositionId]) ||
            (finding.dimension === 'identity' &&
              semanticOverrides?.identityByClaimId?.[finding.propositionId]))
        ),
    );

    const checklistGaps = checkDomainCompleteness({
      query: input.query,
      outputMarkdown,
      countryCode: input.countryCode,
      legalDomain: input.legalDomain,
    });
    const rawFindings: VerificationFinding[] = [
      ...this.buildFindings(input, finalChecks),
      ...retainedStructuredFindings,
      ...claimVerification.findings,
      ...checklistGaps.map((gap) => gap.finding),
    ];
    const hasCaseLaw = input.authorities.some(
      (authority) =>
        authority.sourceTier === 'case_law' || /CASE/i.test(authority.authorityType ?? ''),
    );
    if (input.retrievalSignals?.caseLawRequested && !hasCaseLaw) {
      const status = input.retrievalSignals.caseLawSearchStatus;
      rawFindings.push({
        checkId: `coverage:case_law:${status ?? 'no_admissible_authority'}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'coverage',
        evidenceIds: [],
        explanation:
          status === 'not_configured'
            ? `Case law was required, but no live case-law provider is configured for ${
                input.countryCode ?? 'this jurisdiction'
              } and no admissible indexed judgment was retrieved.`
            : status === 'error'
              ? 'Case law was required, but live retrieval failed and no admissible indexed judgment was retrieved.'
              : 'Case law was required, but no admissible governing judgment was retrieved.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'research-verification-v3',
      });
    }

    // Independent adversarial LLM pass — never the same completion as synthesis.
    // Deterministic checks run first; the LLM verifier is escalated to when the
    // caller asked for it or when those checks left material/borderline risk.
    const escalation = this.resolveLlmVerifierEscalation({
      input,
      finalChecks,
      claimVerification,
      findings: rawFindings,
    });
    let llmVerifierRan = false;
    if (escalation.run && input.verifierModel) {
      const adversarial = await this.llmAdversarialVerifier.verify({
        query: input.query,
        outputMarkdown,
        authorities: input.authorities,
        verifierModel: input.verifierModel,
        countryCode: input.countryCode,
      });
      llmVerifierRan = true;
      rawFindings.push(...adversarial.findings);
      if (escalation.reason) {
        this.logger.debug(
          `LLM verifier escalated (${escalation.reason}) for ${input.countryCode ?? 'unknown'}`,
        );
      }
    }

    if (finalChecks.verificationUnavailable) {
      rawFindings.push({
        checkId: 'system:verification_unavailable',
        state: 'INDETERMINATE',
        severity: 'BLOCKER',
        dimension: 'system',
        evidenceIds: [],
        explanation:
          'One or more critical verifiers failed to complete — result is not verified.',
        repairAction: 'ABSTAIN',
        verifierVersion: 'research-verification-v2',
      });
    }

    const findings = dedupeFindings(rawFindings);

    const finalVerificationStatus = this.resolveStatus(
      finalChecks.substancePassed && !finalChecks.verificationUnavailable,
      finalChecks.classifierPassed,
      finalChecks.citation.unverifiableCitations.length +
        (finalChecks.citation.rejectedCitations?.length ?? 0),
      finalSentenceAudit,
      finalChecks.sectionAlignment.passed,
    );
    const requiresLawyerReview =
      !finalChecks.substancePassed ||
      !finalChecks.classifierPassed ||
      !finalChecks.sectionAlignment.passed ||
      finalChecks.citation.unverifiableCitations.length > 0 ||
      (finalChecks.citation.rejectedCitations?.length ?? 0) > 0 ||
      finalSentenceAudit.ungroundedCount > 0 ||
      finalChecks.verificationUnavailable === true ||
      // A self-verification failure is a substantive signal, not an advisory:
      // HIGH as well as BLOCKER must reach the lawyer.
      findings.some(
        (f) => (f.severity === 'BLOCKER' || f.severity === 'HIGH') && f.state !== 'PASS',
      ) ||
      claimVerification.unsupportedKeyClaims.length > 0 ||
      strictFail;

    // Verifier crashes must never look "not verified" from synthetic FAIL defaults —
    // they are unavailable (INDETERMINATE), not a substantive FAIL.
    const publicationState = finalChecks.verificationUnavailable
      ? 'VERIFICATION_UNAVAILABLE'
      : resolvePublicationState(findings);
    const dimensions = summarizeFindings(findings);
    const provenance: ProvenanceMetadata = {
      verificationStatus: finalVerificationStatus,
      sourceTierSummary: summarizeSourceTiers(input.authorities.map((a) => a.sourceTier)),
      corpusEdition: this.inferCorpusEdition(input.authorities),
      groundedQuoteRate: Number(finalSentenceAudit.coverageRate.toFixed(3)),
      requiresLawyerReview: !!requiresLawyerReview,
      findings: findings as unknown as Prisma.InputJsonValue,
      dimensions: dimensions as unknown as Prisma.InputJsonValue,
      publicationState,
      outputHash,
    };

    const verificationGaps = [
      ...(finalChecks.citation.verificationGaps ?? []),
      ...checklistGaps.map((gap) => ({
        type: 'checklist_unmet',
        checklistId: gap.id,
        label: gap.label,
        retrievalTarget: gap.retrievalTarget,
      })),
    ];

    if (input.persistRetrievalGaps !== false) {
      await this.retrievalGapService.recordPipelineGaps({
        query: input.query,
        countryCode: input.countryCode ?? 'unknown',
        legalDomain: input.legalDomain,
        aiOutputId: input.aiOutputId,
        authorities: input.authorities,
        requestedSection: input.requestedSection,
        exactSectionFound: input.exactSectionFound,
        domainFitLow: input.retrievalSignals?.domainFitLow,
        caseLawRequested: input.retrievalSignals?.caseLawRequested,
        rejectedCandidates: input.retrievalSignals?.rejectedCandidates,
        verificationGaps,
        rejectedCitations: finalChecks.citation.rejectedCitations ?? [],
      });
    }

    return {
      outputMarkdown,
      citations: finalChecks.citation.citations.map((c) => {
        const authority = input.authorities.find((a) => a.id === c.authorityId);
        return {
          ...c,
          sourceUrl: authority?.sourceUrl ?? null,
          sourceName: c.sourceName ?? authority?.sourceName,
          sourceTier: authority?.sourceTier,
          title: authority?.title,
          citation: c.citation ?? authority?.citation,
          summary: authority?.summary ?? undefined,
          quotedText: authority?.sourcePassages?.[0]?.text,
          exactPassage: authority?.sourcePassages?.[0]?.text,
          paragraphRef:
            authority?.sourcePassages?.find((passage) => passage.sourcePinpoint)?.paragraph ??
            authority?.paragraph ??
            undefined,
          pinpoint:
            authority?.sourcePassages?.find((passage) => passage.sourcePinpoint)?.paragraph ??
            authority?.paragraph ??
            (typeof authority?.page === 'number' ? `page ${authority.page}` : undefined),
          court: authority?.court ?? undefined,
          decisionDate:
            authority?.decisionDate instanceof Date
              ? authority.decisionDate.toISOString()
              : authority?.decisionDate ?? undefined,
          retrievedAt: new Date().toISOString(),
          sourceHash: createHash('sha256')
            .update(authority?.fullText ?? authority?.summary ?? '')
            .digest('hex'),
          verified: c.verified === true,
        };
      }) as unknown as Prisma.InputJsonValue,
      provenance,
      sentenceAudit: finalSentenceAudit,
      regenerated,
      refusedSubstantiveClaims: !!refusedSubstantiveClaims,
      findings,
      propositions: skipClaims
        ? []
        : claimVerification.propositions.length > 0
          ? claimVerification.propositions
          : this.propositionsFromSentenceAudit(finalSentenceAudit),
      dimensions,
      publicationState,
      outputHash,
      verificationAdvisories: claimVerification.advisories,
      unsupportedKeyClaims: claimVerification.unsupportedKeyClaims,
      rejectedCitations: (finalChecks.citation.rejectedCitations ?? []) as unknown as Prisma.InputJsonValue,
      verificationGaps: verificationGaps as unknown as Prisma.InputJsonValue,
      selfVerification: {
        ran: llmVerifierRan,
        escalationReason: escalation.reason,
        unsupportedClaimCount: claimVerification.unsupportedKeyClaims.length,
        materialFindingCount: findings.filter(
          (f) => f.state !== 'PASS' && (f.severity === 'BLOCKER' || f.severity === 'HIGH'),
        ).length,
      },
      safeForReliance:
        finalChecks.citation.safeForReliance === true &&
        checklistGaps.length === 0 &&
        publicationState === 'READY_FOR_LAWYER_REVIEW' &&
        !findings.some(
          (finding) =>
            finding.propositionId &&
            finding.state !== 'PASS' &&
            [
              'identity',
              'relevance',
              'passage',
              'pinpoint',
              'jurisdiction',
              'hierarchy',
              'currentLaw',
              'treatment',
            ].includes(finding.dimension),
        ),
    };
  }

  /**
   * When to spend a second model call on independent self-verification.
   *
   * Policy: deterministic checks first, then escalate for material or borderline
   * claims. Applies identically in every jurisdiction - no country may silently
   * receive a weaker verification path.
   */
  private resolveLlmVerifierEscalation(args: {
    input: VerificationPipelineInput;
    finalChecks: Awaited<ReturnType<UnifiedVerificationService['runChecks']>>;
    claimVerification: ClaimVerificationResult;
    findings: VerificationFinding[];
  }): { run: boolean; reason?: string } {
    const { input, finalChecks, claimVerification, findings } = args;
    if (!input.verifierModel) return { run: false };
    if (input.runLlmAdversarialVerify) return { run: true, reason: 'caller-requested' };

    if (claimVerification.unsupportedKeyClaims.length > 0) {
      return { run: true, reason: 'unsupported-key-claims' };
    }
    if (claimVerification.verificationStatus === 'FAILED') {
      return { run: true, reason: 'claim-verification-failed' };
    }
    if (
      finalChecks.citation.unverifiableCitations.length > 0 ||
      (finalChecks.citation.rejectedCitations?.length ?? 0) > 0
    ) {
      return { run: true, reason: 'unverifiable-citations' };
    }
    if (!finalChecks.substancePassed || !finalChecks.sectionAlignment.passed) {
      return { run: true, reason: 'substance-or-section-drift' };
    }
    const materialFinding = findings.find(
      (finding) =>
        finding.state !== 'PASS' &&
        (finding.severity === 'BLOCKER' || finding.severity === 'HIGH') &&
        MATERIAL_VERIFIER_DIMENSIONS.has(finding.dimension),
    );
    if (materialFinding) {
      return { run: true, reason: `material-finding:${materialFinding.dimension}` };
    }
    return { run: false };
  }

  private async runSemanticVerificationBatch(input: {
    modelName?: string;
    draft: LegalResearchDraft;
    evidencePack: LegalEvidencePack;
    initial: ClaimVerificationResult;
  }): Promise<ClaimVerificationOverrides | undefined> {
    if (!input.modelName) return undefined;

    const claims = new Map(
      input.draft.issues.flatMap((issue) =>
        issue.propositions.map((claim) => [claim.claimId, claim] as const),
      ),
    );
    const evidenceText = this.buildLockedEvidenceTextIndex(input.evidencePack);
    const passageTasks: SemanticPassageTask[] = [];
    let passageBudget = 24_000;

    for (const audit of input.initial.claimAudits) {
      if (passageTasks.length >= 10) break;
      const claim = claims.get(audit.claimId);
      if (
        !claim ||
        (claim.type !== 'RULE' && claim.type !== 'HOLDING') ||
        claim.materiality === 'SUPPORTING' ||
        (audit.passageSupport !== 'PARTIAL' && audit.passageSupport !== 'UNSUPPORTED')
      ) {
        continue;
      }
      const passages = claim.evidenceIds
        .map((evidenceId) => ({
          evidenceId,
          text: (evidenceText.get(evidenceId) ?? '').trim().slice(0, 1_200),
        }))
        .filter((passage) => passage.text.length > 0)
        .slice(0, 2);
      const taskSize = claim.text.length + passages.reduce((sum, passage) => sum + passage.text.length, 0);
      if (passages.length === 0 || taskSize > passageBudget) continue;
      passageBudget -= taskSize;
      passageTasks.push({
        claimId: claim.claimId,
        claimText: claim.text.slice(0, 700),
        deterministicState: audit.passageSupport,
        passages,
      });
    }

    const authorityCandidates = this.buildAuthorityCandidates(input.evidencePack).slice(0, 25);
    const identityTasks: SemanticIdentityTask[] = input.initial.findings
      .filter(
        (finding) =>
          finding.dimension === 'identity' &&
          (finding.state === 'FAIL' || finding.state === 'INDETERMINATE') &&
          !!finding.propositionId &&
          !!finding.authorityId,
      )
      .slice(0, 8)
      .map((finding) => ({
        claimId: finding.propositionId!,
        authorityId: finding.authorityId!,
        evidenceIds: claims.get(finding.propositionId!)?.evidenceIds ?? [],
        candidates: authorityCandidates,
      }));

    if (passageTasks.length === 0 && identityTasks.length === 0) return undefined;

    const payload = JSON.stringify({ passageTasks, identityTasks });
    try {
      const completion = await this.llmCompletion.complete({
        modelName: input.modelName,
        temperature: 0,
        maxTokens: 2_500,
        reasoningEffort: 'low',
        messages: [
          {
            role: 'system',
            content: [
              'You are a conservative legal evidence verifier.',
              'Use only the supplied locked passages and authority candidates.',
              'Return JSON only with exactly: {"claims":[],"identities":[]}.',
              'claims items: {"claimId":string,"supportState":"SUPPORTED"|"PARTIAL"|"UNSUPPORTED"|"CONTRADICTED","evidenceIds":string[],"confidence":number}.',
              'identities items: {"claimId":string,"authorityId":string,"state":"PASS"|"INDETERMINATE"|"FAIL","confidence":number}.',
              'SUPPORTED requires the exact passage to entail the whole claim, not merely discuss the topic.',
              'PARTIAL means only a material subset is entailed. CONTRADICTED requires an actual conflict.',
              'Never supply an evidenceId or authorityId absent from the task. Never infer authority identity from general knowledge.',
            ].join(' '),
          },
          {
            role: 'user',
            content: payload,
          },
        ],
      });
      return this.parseSemanticOverrides(completion.content, passageTasks, identityTasks);
    } catch (error) {
      this.logger.warn(
        `Semantic verification batch failed closed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private parseSemanticOverrides(
    content: string,
    passageTasks: SemanticPassageTask[],
    identityTasks: SemanticIdentityTask[],
  ): ClaimVerificationOverrides | undefined {
    const normalized = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch {
      return undefined;
    }
    if (!this.isRecord(parsed) || !Array.isArray(parsed.claims) || !Array.isArray(parsed.identities)) {
      return undefined;
    }

    const supportStates = new Set<PassageSupport>([
      'SUPPORTED',
      'PARTIAL',
      'UNSUPPORTED',
      'CONTRADICTED',
    ]);
    if (
      parsed.claims.some(
        (item) =>
          !this.isRecord(item) ||
          typeof item.claimId !== 'string' ||
          typeof item.supportState !== 'string' ||
          !supportStates.has(item.supportState as PassageSupport) ||
          !Array.isArray(item.evidenceIds) ||
          !item.evidenceIds.every((id) => typeof id === 'string') ||
          typeof item.confidence !== 'number' ||
          !Number.isFinite(item.confidence),
      ) ||
      parsed.identities.some(
        (item) =>
          !this.isRecord(item) ||
          typeof item.claimId !== 'string' ||
          typeof item.authorityId !== 'string' ||
          !['PASS', 'INDETERMINATE', 'FAIL'].includes(String(item.state)) ||
          typeof item.confidence !== 'number' ||
          !Number.isFinite(item.confidence),
      )
    ) {
      return undefined;
    }

    const passageByClaimId: NonNullable<ClaimVerificationOverrides['passageByClaimId']> = {};
    for (const raw of parsed.claims) {
      const item = raw as {
        claimId: string;
        supportState: PassageSupport;
        evidenceIds: string[];
        confidence: number;
      };
      const task = passageTasks.find((candidate) => candidate.claimId === item.claimId);
      const allowedEvidence = new Set(task?.passages.map((passage) => passage.evidenceId) ?? []);
      const minimumConfidence = item.supportState === 'PARTIAL' ? 0.72 : 0.82;
      if (
        !task ||
        item.supportState === 'UNSUPPORTED' ||
        item.confidence < minimumConfidence ||
        item.evidenceIds.length === 0 ||
        !item.evidenceIds.every((evidenceId) => allowedEvidence.has(evidenceId))
      ) {
        continue;
      }
      passageByClaimId[item.claimId] = {
        supportState: item.supportState,
        evidenceIds: item.evidenceIds,
        confidence: Math.min(1, Math.max(0, item.confidence)),
      };
    }

    const identityByClaimId: NonNullable<ClaimVerificationOverrides['identityByClaimId']> = {};
    for (const raw of parsed.identities) {
      const item = raw as {
        claimId: string;
        authorityId: string;
        state: string;
        confidence: number;
      };
      const task = identityTasks.find((candidate) => candidate.claimId === item.claimId);
      const candidate = task?.candidates.find(
        (authority) => authority.authorityId === item.authorityId,
      );
      if (!task || !candidate || item.state !== 'PASS' || item.confidence < 0.9) continue;
      const linkedEvidenceIds = candidate.evidenceIds.filter((id) => task.evidenceIds.includes(id));
      if (linkedEvidenceIds.length === 0) continue;
      identityByClaimId[item.claimId] = {
        authorityId: candidate.authorityId,
        evidenceIds: linkedEvidenceIds,
        confidence: Math.min(1, Math.max(0, item.confidence)),
      };
    }

    if (
      Object.keys(passageByClaimId).length === 0 &&
      Object.keys(identityByClaimId).length === 0
    ) {
      return undefined;
    }
    return { passageByClaimId, identityByClaimId };
  }

  private buildLockedEvidenceTextIndex(pack: LegalEvidencePack): Map<string, string> {
    const index = new Map<string, string>();
    for (const statute of pack.statutes) index.set(statute.evidenceId, statute.text);
    for (const authority of pack.authorities) {
      index.set(
        authority.evidenceId,
        authority.passages.map((passage) => passage.text).join('\n\n'),
      );
      for (const passage of authority.passages) index.set(passage.evidenceId, passage.text);
    }
    for (const material of pack.officialMaterials) index.set(material.evidenceId, material.text);
    return index;
  }

  private buildAuthorityCandidates(pack: LegalEvidencePack): SemanticAuthorityCandidate[] {
    return [
      ...pack.authorities.map((authority) => ({
        authorityId: authority.authorityId,
        title: authority.title.slice(0, 220),
        citation: authority.citation.slice(0, 100),
        evidenceIds: [authority.evidenceId, ...authority.passages.map((passage) => passage.evidenceId)],
      })),
      ...pack.statutes.map((statute) => ({
        authorityId: statute.actId,
        title: `${statute.actId} section ${statute.section}`.slice(0, 220),
        citation: `${statute.actId} s.${statute.section}`.slice(0, 100),
        evidenceIds: [statute.evidenceId],
      })),
    ];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private async runChecks(
    input: Omit<VerificationPipelineInput, 'regenerate' | 'modelName'>,
  ): Promise<UnifiedVerificationResult> {
    return this.unifiedVerification.runChecks({
      query: input.query,
      outputMarkdown: input.outputMarkdown,
      authorities: input.authorities,
      countryCode: input.countryCode ?? 'IN',
      isBareActQuery: input.isBareActQuery,
      requestedSection: input.requestedSection,
      exactSectionFound: input.exactSectionFound,
      fastMode: input.fastMode,
    });
  }

  private buildCorrectionPrompt(
    input: VerificationPipelineInput,
    verification: UnifiedVerificationResult,
  ): string {
    // Per-failed-claim style bundle: prefer authorities with full text / summaries
    // that can support repair, not an arbitrary global top-5.
    const ranked = [...input.authorities].sort((a, b) => {
      const score = (x: RetrievedAuthority) =>
        (x.fullText ? 3 : 0) + (x.summary ? 1 : 0) + (x.sourceTier === 'primary' || x.sourceTier === 'seed' ? 2 : 0);
      return score(b) - score(a);
    });
    const authorityBlock = ranked
      .slice(0, 12)
      .map((a) => {
        const body = (a.fullText ?? a.summary ?? '').slice(0, 800);
        return `${a.title}${a.citation ? ` (${a.citation})` : ''}: ${body}`;
      })
      .join('\n\n');

    return [
      'Your prior answer failed verification. Regenerate with a substantive legal answer.',
      `Query: ${input.query}`,
      `Substance warnings: ${verification.substanceWarnings.join('; ') || 'none'}`,
      `Section alignment warnings: ${verification.sectionAlignment.warnings.join('; ') || 'none'}`,
      `Unverified citations: ${verification.citation.unverifiableCitations.join('; ') || 'none'}`,
      `Ungrounded sentences: ${verification.sentenceAudit.ungroundedCount}`,
      '',
      'AUTHORITIES (cite ONLY from this evidence bundle):',
      authorityBlock,
      '',
      'Rules: state only legal rules supported by the listed authorities. If the requested section or rule is missing from the authorities, state the limitation and the retrieval needed; do not use unstated sources as legal authority; do not invent URLs or case names.',
    ].join('\n');
  }

  private appendWarnings(output: string, verification: UnifiedVerificationResult): string {
    let result = output;
    if (verification.citation.unverifiableCitations.length > 0) {
      result += `\n\n> ⚠️ **Unverified citations:** ${verification.citation.unverifiableCitations.join('; ')}. Confirm against primary sources.`;
    }
    return result;
  }

  private buildRefusalOutput(query: string, warnings: string[]): string {
    return [
      `## Preliminary guidance (${query})`,
      '',
      'We cannot provide specific statutory procedure for this question without verified tier-1 authority in our corpus.',
      '',
      warnings.length > 0 ? `**Issues detected:** ${warnings.join(' ')}` : '',
      '',
      '**Recommended next step:** Consult a qualified lawyer who can verify the applicable provision against official India Code / PRS sources.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private resolveStatus(
    substancePassed: boolean,
    classifierPassed: boolean,
    unverifiedCount: number,
    audit: SentenceAuditResult,
    sectionAlignmentPassed = true,
  ): VerificationStatus {
    if (!substancePassed || !classifierPassed || !sectionAlignmentPassed) return 'failed';
    if (unverifiedCount > 0 || audit.ungroundedCount > 0) return 'warning';
    if (audit.coverageRate < 0.5) return 'insufficient';
    return 'passed';
  }

  private inferCorpusEdition(authorities: RetrievedAuthority[]): string | undefined {
    const primary = authorities.find((a) => a.sourceTier === 'primary' || a.sourceTier === 'seed');
    if (!primary) return undefined;
    if (/coi_2024|2024/i.test(primary.sourceName + primary.title)) return 'COI_2024';
    if (/negotiable.instruments|ni.act\b|nia\b/i.test(primary.title + (primary.citation ?? '')))
      return 'NI_ACT_1881';
    if (/bnss|bns|bsa/i.test(primary.title + (primary.citation ?? ''))) return 'IN_2023_CODES';
    return primary.sourceName;
  }

  private buildFindings(
    input: VerificationPipelineInput,
    verification: UnifiedVerificationResult,
  ): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    for (const citation of verification.citation.citations) {
      findings.push({
        checkId: `citation:${citation.citation ?? citation.authorityId ?? citation.sourceName ?? 'unknown'}`,
        state: citation.verified === true ? 'PASS' : 'FAIL',
        severity: citation.verified === true ? 'LOW' : 'BLOCKER',
        dimension: 'identity',
        authorityId: citation.authorityId,
        evidenceIds: citation.authorityId ? [citation.authorityId] : [],
        explanation:
          citation.verified === true
            ? 'Authority identity confirmed by citation verifier.'
            : 'Authority identity could not be confirmed by citation verifier.',
        repairAction: citation.verified === true ? undefined : 'RETRIEVE',
        verifierVersion: 'research-verification-v2',
      });
    }
    for (const unverified of verification.citation.unverifiableCitations) {
      findings.push({
        checkId: `citation:unverifiable:${unverified}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'citation',
        evidenceIds: [],
        explanation: `Unverifiable citation detected: ${unverified}`,
        repairAction: 'REMOVE',
        verifierVersion: 'research-verification-v2',
      });
    }
    if (!verification.substancePassed) {
      findings.push({
        checkId: 'substance:bare-act',
        state: 'FAIL',
        severity: input.isBareActQuery ? 'BLOCKER' : 'HIGH',
        dimension: 'passage',
        evidenceIds: [],
        explanation: verification.substanceWarnings.join('; ') || 'Substance verification failed.',
        repairAction: 'QUALIFY',
        verifierVersion: 'research-verification-v2',
      });
    }
    if (!verification.classifierPassed) {
      findings.push({
        checkId: 'classifier:legal-answer',
        state: 'FAIL',
        severity: 'HIGH',
        dimension: 'system',
        evidenceIds: [],
        explanation:
          verification.classifierReasons.join('; ') ||
          'Answer did not satisfy verification classifier.',
        repairAction: 'QUALIFY',
        verifierVersion: 'research-verification-v2',
      });
    }
    if (!verification.sectionAlignment.passed) {
      findings.push({
        checkId: 'section:alignment',
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'currentLaw',
        evidenceIds: [],
        explanation:
          verification.sectionAlignment.warnings.join('; ') ||
          'Requested section did not align with output.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'research-verification-v2',
      });
    }
    if (verification.sentenceAudit.ungroundedCount > 0) {
      findings.push({
        checkId: 'sentence:grounding',
        state: 'INDETERMINATE',
        severity: verification.sentenceAudit.ungroundedCount > 3 ? 'BLOCKER' : 'MEDIUM',
        dimension: 'passage',
        evidenceIds: [],
        explanation: `${verification.sentenceAudit.ungroundedCount} sentence(s) were not grounded in retrieved authority text.`,
        repairAction: 'QUALIFY',
        verifierVersion: 'research-verification-v2',
      });
    }
    return findings;
  }

  private propositionsFromSentenceAudit(audit: SentenceAuditResult): VerifiedPropositionSummary[] {
    return audit.entries.slice(0, 80).map((entry, index) => ({
      id: `sentence_${index + 1}`,
      text: entry.sentence,
      type: 'PROSE',
      materiality: entry.status === 'grounded' ? 'SUPPORTING' : 'MATERIAL',
      evidenceIds: entry.authorityTitle ? [entry.authorityTitle] : [],
      supportState: entry.status === 'grounded' ? 'SUPPORTED' : 'INDETERMINATE',
    }));
  }

  private extractMatterFacts(query: string): Array<{ factId: string; description: string }> {
    return query
      .split(/(?<=[.!?])\s+|\n+/)
      .map((fact) => fact.trim())
      .filter((fact) => fact.length > 12)
      .slice(0, 12)
      .map((description, index) => ({ factId: `research_fact_${index + 1}`, description }));
  }
}

interface SemanticPassageTask {
  claimId: string;
  claimText: string;
  deterministicState: 'PARTIAL' | 'UNSUPPORTED';
  passages: Array<{ evidenceId: string; text: string }>;
}

interface SemanticAuthorityCandidate {
  authorityId: string;
  title: string;
  citation: string;
  evidenceIds: string[];
}

interface SemanticIdentityTask {
  claimId: string;
  authorityId: string;
  evidenceIds: string[];
  candidates: SemanticAuthorityCandidate[];
}
