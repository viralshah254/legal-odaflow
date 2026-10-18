import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ClaimAudit, ClaimBlock, LegalResearchDraft, PassageSupport } from './legal-research-draft.types';
import type { EvidenceCase, EvidencePassage, EvidenceStatute, LegalEvidencePack, OfficialMaterialEvidence } from './legal-evidence-pack.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { CourtHierarchyService } from '@/ai/verification/court-hierarchy.service';
import { TreatmentGraphService } from '@/ai/verification/treatment-graph.service';
import { RelevanceVerificationService } from '@/ai/verification/relevance-verification.service';
import {
  resolvePublicationState,
  summarizeFindings,
  type FindingSeverity,
  type VerificationFinding,
  type VerifiedPropositionSummary,
} from '@/ai/verification/verification-finding.types';

export interface ClaimVerificationInput {
  draft: LegalResearchDraft;
  evidencePack: LegalEvidencePack;
  jurisdiction: string;
  query?: string;
  legalIssues?: string[];
  legalDomain?: string;
  semanticOverrides?: ClaimVerificationOverrides;
}

export interface ClaimVerificationOverrides {
  passageByClaimId?: Record<
    string,
    { supportState: PassageSupport; evidenceIds: string[]; confidence: number }
  >;
  identityByClaimId?: Record<
    string,
    { authorityId: string; evidenceIds: string[]; confidence: number }
  >;
}

export interface ClaimVerificationResult {
  claimAudits: ClaimAudit[];
  verificationStatus: 'VERIFIED' | 'VERIFIED_WITH_LIMITATIONS' | 'FAILED' | 'INDETERMINATE';
  limitations: Array<{ issueId: string; message: string }>;
  repairedClaims: string[];
  removedClaims: string[];
  findings: VerificationFinding[];
  propositions: VerifiedPropositionSummary[];
  dimensions: ReturnType<typeof summarizeFindings>;
  publicationState: ReturnType<typeof resolvePublicationState>;
  /** Deduplicated result-level notices; render once outside proposition bodies. */
  advisories: Array<{ code: string; message: string; claimIds: string[] }>;
  /** Machine-readable retrieval targets for a bounded downstream repair pass. */
  unsupportedKeyClaims: UnsupportedKeyClaim[];
}

export interface UnsupportedKeyClaim {
  issueId: string;
  claimId: string;
  claimText: string;
  evidenceIds: string[];
  supportState: PassageSupport;
  reason: string;
}

/**
 * Wave 3 claim-level verification service.
 *
 * Verifies that each proposition is:
 * 1. Supported by a passage in the evidence pack (not just existence of the citation)
 * 2. From a valid jurisdiction
 * 3. Consistent with court hierarchy
 * 4. Not overruled or adversely treated
 *
 * Also enforces the abstention policy: when primary law or binding authority
 * is required but missing, the limitation is stated rather than the gap being filled.
 *
 * Deterministic Phase 1 verifier. This does not treat a registered evidenceId
 * as support; it checks identity, passage text, quotes, jurisdiction metadata,
 * current-law flags, and explicitly marks Phase 2 checks as not applicable.
 */
@Injectable()
export class ClaimLevelVerificationService {
  private readonly logger = new Logger(ClaimLevelVerificationService.name);

  constructor(
    private readonly authorityIdentity: AuthorityIdentityService,
    private readonly quotationVerification: QuotationVerificationService,
    @Optional() private readonly entailment?: PropositionEntailmentService,
    @Optional() private readonly courtHierarchy?: CourtHierarchyService,
    @Optional() private readonly treatmentGraph?: TreatmentGraphService,
    @Optional() private readonly relevance?: RelevanceVerificationService,
  ) {}

  verify(input: ClaimVerificationInput): ClaimVerificationResult {
    const allClaims = input.draft.issues.flatMap((i) => i.propositions);
    const evidenceIndex = this.buildEvidenceIndex(input.evidencePack);
    const claimAudits: ClaimAudit[] = [];
    const limitations: Array<{ issueId: string; message: string }> = [];
    const findings: VerificationFinding[] = [];
    const verificationQuery = [input.query, ...(input.legalIssues ?? [])]
      .filter(Boolean)
      .join('\n');

    for (const claim of allClaims) {
      const audit = this.auditClaim(
        claim,
        evidenceIndex,
        input.evidencePack,
        input.jurisdiction,
        verificationQuery || input.query,
        input.legalDomain,
        input.semanticOverrides,
      );
      claimAudits.push(audit);
      findings.push(...(audit.findings ?? []));
    }

    // Abstention policy — one issue-level limitation replaces repeated claim-body noise.
    for (const issue of input.draft.issues) {
      const issueClaims = issue.propositions.filter((p) => p.type === 'RULE' || p.type === 'HOLDING');
      const unsupported = issueClaims.filter((p) => {
        const audit = claimAudits.find((candidate) => candidate.claimId === p.claimId);
        return !audit || !['SUPPORTED', 'PARTIAL'].includes(audit.passageSupport);
      });

      if (unsupported.length > 0) {
        limitations.push({
          issueId: issue.issueId,
          message: `${unsupported.length} material proposition(s) lacked sufficiently reliable passage support (${unsupported
            .map((claim) => claim.claimId)
            .join(', ')}).`,
        });
      }
    }

    const failedMaterial = claimAudits.filter(
      (a) =>
        a.action === 'REMOVE' &&
        allClaims.find((c) => c.claimId === a.claimId)?.type !== 'APPLICATION',
    );
    const indeterminateBlockers = findings.filter((f) => f.severity === 'BLOCKER' && f.state === 'INDETERMINATE');

    const verificationStatus =
      failedMaterial.length > 0
        ? 'FAILED'
        : indeterminateBlockers.length > 0
          ? 'INDETERMINATE'
          : limitations.length > 0 || findings.some((f) => f.state === 'FAIL' || f.state === 'INDETERMINATE')
          ? 'VERIFIED_WITH_LIMITATIONS'
          : 'VERIFIED';
    const unsupportedKeyClaims = this.buildUnsupportedKeyClaims(input.draft, claimAudits);
    const currentLawUnknownClaimIds = claimAudits
      .filter((audit) =>
        audit.findings?.some(
          (finding) => finding.dimension === 'currentLaw' && finding.state === 'INDETERMINATE',
        ),
      )
      .map((audit) => audit.claimId);
    const advisories =
      currentLawUnknownClaimIds.length > 0
        ? [
            {
              code: 'CURRENT_LAW_METADATA_UNAVAILABLE',
              message: `Current-law version metadata was unavailable for ${currentLawUnknownClaimIds.length} proposition(s); confirm currency against an official source before reliance.`,
              claimIds: currentLawUnknownClaimIds,
            },
          ]
        : [];

    return {
      claimAudits,
      verificationStatus,
      limitations,
      repairedClaims: claimAudits.filter((a) => a.action === 'REPAIR').map((a) => a.claimId),
      removedClaims: claimAudits.filter((a) => a.action === 'REMOVE').map((a) => a.claimId),
      findings,
      propositions: allClaims.map((claim) => ({
        id: claim.claimId,
        text: claim.text,
        type: claim.type,
        materiality: this.claimMateriality(claim),
        evidenceIds: claim.evidenceIds,
        supportState:
          claimAudits.find((audit) => audit.claimId === claim.claimId)?.passageSupport ?? 'INDETERMINATE',
      })),
      dimensions: summarizeFindings(findings),
      publicationState: resolvePublicationState(findings),
      advisories,
      unsupportedKeyClaims,
    };
  }

  private buildUnsupportedKeyClaims(
    draft: LegalResearchDraft,
    audits: ClaimAudit[],
  ): UnsupportedKeyClaim[] {
    const auditByClaim = new Map(audits.map((audit) => [audit.claimId, audit]));
    return draft.issues.flatMap((issue) =>
      issue.propositions
        .filter((claim) => this.claimMateriality(claim) === 'MATERIAL')
        .flatMap((claim) => {
          const audit = auditByClaim.get(claim.claimId);
          if (!audit || ['SUPPORTED', 'PARTIAL'].includes(audit.passageSupport)) return [];
          const passageFinding = audit.findings?.find(
            (finding) => finding.dimension === 'passage' && finding.state !== 'PASS',
          );
          return [
            {
              issueId: issue.issueId,
              claimId: claim.claimId,
              claimText: claim.text,
              evidenceIds: claim.evidenceIds,
              supportState: audit.passageSupport,
              reason: passageFinding?.explanation ?? audit.notes ?? 'Passage support was not established.',
            },
          ];
        }),
    );
  }

  private claimMateriality(claim: ClaimBlock): 'MATERIAL' | 'SUPPORTING' {
    if (claim.materiality) return claim.materiality;
    if (
      claim.type === 'LIMITATION' ||
      claim.type === 'PROCEDURE' ||
      claim.type === 'GENERAL_PRINCIPLE'
    ) {
      return 'SUPPORTING';
    }
    return 'MATERIAL';
  }

  /** SUPPORTING claims never escalate to BLOCKER — only MATERIAL claims gate publication. */
  private failureSeverity(claim: ClaimBlock): FindingSeverity {
    return this.claimMateriality(claim) === 'MATERIAL' ? 'BLOCKER' : 'HIGH';
  }

  private auditClaim(
    claim: ClaimBlock,
    evidenceIndex: Map<string, EvidenceIndexEntry>,
    pack: LegalEvidencePack,
    jurisdiction: string,
    query?: string,
    legalDomain?: string,
    overrides?: ClaimVerificationOverrides,
  ): ClaimAudit {
    const findings: VerificationFinding[] = [];
    const failSeverity = this.failureSeverity(claim);

    if (claim.type === 'GENERAL_PRINCIPLE') {
      findings.push({
        checkId: `general-principle:${claim.claimId}`,
        state: 'INDETERMINATE',
        severity: 'LOW',
        dimension: 'passage',
        propositionId: claim.claimId,
        evidenceIds: [],
        explanation:
          'General framework statement was retained without retrieved authority and must remain visibly labeled as unverified.',
        repairAction: 'QUALIFY',
        verifierVersion: 'claim-level-v2',
      });
      return this.buildAuditFromFindings(
        claim,
        findings,
        'INDETERMINATE',
        'General principle — not verified against retrieved sources.',
      );
    }

    if (claim.type === 'APPLICATION' && claim.evidenceIds.length === 0) {
      const hasFactAndRuleBasis =
        (claim.factIds?.length ?? 0) > 0 && (claim.basedOnClaimIds?.length ?? 0) > 0;
      findings.push({
        checkId: `application:${claim.claimId}`,
        state: hasFactAndRuleBasis ? 'PASS' : 'FAIL',
        severity: hasFactAndRuleBasis ? 'LOW' : failSeverity,
        dimension: 'application',
        propositionId: claim.claimId,
        evidenceIds: [],
        explanation: hasFactAndRuleBasis
          ? 'Application proposition is tied to matter facts and verified legal propositions.'
          : 'Application proposition lacks factIds and basedOnClaimIds; it cannot be treated as verified.',
        repairAction: hasFactAndRuleBasis ? undefined : 'QUALIFY',
        verifierVersion: 'claim-level-v1',
      });
      return this.buildAuditFromFindings(claim, findings, hasFactAndRuleBasis ? 'SUPPORTED' : 'UNSUPPORTED');
    }

    const evidence = claim.evidenceIds.map((id) => evidenceIndex.get(id));
    const missingEvidenceIds = claim.evidenceIds.filter((id) => !evidenceIndex.has(id));

    if (missingEvidenceIds.length > 0) {
      this.logger.warn(
        `Claim ${claim.claimId} references unregistered evidenceIds: ${missingEvidenceIds.join(', ')}`,
      );
      findings.push({
        checkId: `identity:${claim.claimId}:missing-evidence`,
        state: 'FAIL',
        severity: failSeverity,
        dimension: 'identity',
        propositionId: claim.claimId,
        evidenceIds: missingEvidenceIds,
        explanation: 'Proposition references evidenceId not present in the locked evidence pack.',
        repairAction: 'REMOVE',
        verifierVersion: 'claim-level-v1',
      });
      return this.buildAuditFromFindings(claim, findings, 'UNSUPPORTED', 'References evidenceId not present in the evidence pack.');
    }

    if (evidence.length === 0 || evidence.every((entry) => !entry?.text.trim())) {
      findings.push({
        checkId: `passage:${claim.claimId}:missing`,
        state: 'INDETERMINATE',
        severity: failSeverity,
        dimension: 'passage',
        propositionId: claim.claimId,
        evidenceIds: claim.evidenceIds,
        explanation: 'No exact passage text was available for this material proposition.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'claim-level-v1',
      });
      return this.buildAuditFromFindings(claim, findings, 'INDETERMINATE');
    }

    const identityAuthority = evidence.find((entry): entry is EvidenceIndexEntry => !!entry)?.authority;
    if (identityAuthority) {
      const identity = this.authorityIdentity.resolveFromPack(identityAuthority, pack);
      const identityOverride = overrides?.identityByClaimId?.[claim.claimId];
      const acceptedIdentityOverride =
        identity.state !== 'PASS' &&
        identityOverride &&
        identityOverride.confidence >= 0.9 &&
        this.packHasAuthority(pack, identityOverride.authorityId) &&
        identityOverride.evidenceIds.every((id) => claim.evidenceIds.includes(id));
      const identityFinding = acceptedIdentityOverride
        ? this.authorityIdentity.findingForResolution(
            {
              authorityId: identityOverride.authorityId,
              evidenceIds: identityOverride.evidenceIds,
              state: 'PASS',
              explanation:
                'Authority identity confirmed by high-confidence semantic comparison within the locked evidence pack.',
              aliases: [],
            },
            claim.claimId,
          )
        : this.authorityIdentity.findingForResolution(identity, claim.claimId);
      if (identityFinding.state !== 'PASS' && this.claimMateriality(claim) === 'SUPPORTING') {
        identityFinding.severity = 'HIGH';
      }
      findings.push(identityFinding);
    }

    const evidenceEntries = evidence.filter(Boolean) as EvidenceIndexEntry[];
    const rejectedByAdmission = evidenceEntries.filter(
      (entry) => entry.admission?.admitted === false,
    );
    if (rejectedByAdmission.length > 0) {
      findings.push({
        checkId: `identity:${claim.claimId}:source-integrity`,
        state: 'FAIL',
        severity: failSeverity,
        dimension: 'identity',
        propositionId: claim.claimId,
        authorityId: rejectedByAdmission[0].authority.id,
        evidenceIds: rejectedByAdmission.map((entry) => entry.evidenceId),
        explanation: `Source integrity admission failed: ${[
          ...new Set(rejectedByAdmission.flatMap((entry) => entry.admission?.reasons ?? [])),
        ].join('; ')}`,
        repairAction: 'RETRIEVE',
        verifierVersion: 'claim-level-v3-source-integrity',
      });
    }
    findings.push(this.relevanceFinding(claim, evidenceEntries, query, legalDomain, failSeverity));
    findings.push(this.pinpointFinding(claim, evidenceEntries, failSeverity));
    const deterministicPassageSupport = this.entailment
      ? this.entailment.assess(
          claim.text,
          evidenceEntries.map((e) => e.text),
        )
      : this.computePassageSupport(claim.text, evidenceEntries);
    const passageOverride = overrides?.passageByClaimId?.[claim.claimId];
    const canApplyPassageOverride =
      deterministicPassageSupport !== 'SUPPORTED' &&
      passageOverride &&
      passageOverride.confidence >=
        (passageOverride.supportState === 'SUPPORTED' ? 0.82 : 0.72) &&
      passageOverride.evidenceIds.length > 0 &&
      passageOverride.evidenceIds.every((id) => claim.evidenceIds.includes(id));
    const passageSupport = canApplyPassageOverride
      ? passageOverride.supportState
      : deterministicPassageSupport;
    findings.push({
      checkId: `passage:${claim.claimId}`,
      state:
        passageSupport === 'SUPPORTED' || passageSupport === 'PARTIAL'
          ? 'PASS'
          : passageSupport === 'INDETERMINATE'
            ? 'INDETERMINATE'
            : 'FAIL',
      severity:
        passageSupport === 'SUPPORTED'
          ? 'LOW'
          : passageSupport === 'PARTIAL'
            ? 'MEDIUM'
            : failSeverity,
      dimension: 'passage',
      propositionId: claim.claimId,
      authorityId: identityAuthority?.id,
      evidenceIds: claim.evidenceIds,
      explanation: this.passageExplanation(passageSupport),
      repairAction:
        passageSupport === 'SUPPORTED'
          ? undefined
          : passageSupport === 'PARTIAL'
            ? 'QUALIFY'
            : 'RETRIEVE',
      verifierVersion: canApplyPassageOverride ? 'claim-level-v3-semantic' : 'claim-level-v2',
    });

    findings.push(...this.quotationVerification.verify({
      propositionId: claim.claimId,
      text: claim.text,
      evidenceIds: claim.evidenceIds,
      evidencePack: pack,
    }).map((finding) =>
      finding.state === 'FAIL' && finding.severity === 'BLOCKER' && this.claimMateriality(claim) === 'SUPPORTING'
        ? { ...finding, severity: 'HIGH' as const }
        : finding,
    ));

    findings.push(this.jurisdictionFinding(claim, evidenceEntries, jurisdiction));
    findings.push(this.currentLawFinding(claim, evidenceEntries, failSeverity));

    if (this.courtHierarchy) {
      findings.push(
        this.courtHierarchy.findingForClaim({
          claimId: claim.claimId,
          evidenceIds: claim.evidenceIds,
          jurisdiction,
          authorities: evidenceEntries.map((e) => ({
            authorityId: e.authority.id,
            court: e.authority.sourceName,
            controllingJurisdiction: e.controllingJurisdiction,
          })),
        }),
      );
    } else {
      findings.push(this.notApplicableFinding('hierarchy', claim, 'Court hierarchy service unavailable.'));
    }

    if (this.treatmentGraph) {
      const material = claim.type === 'RULE' || claim.type === 'HOLDING';
      findings.push(
        this.treatmentGraph.findingForClaim({
          claimId: claim.claimId,
          evidenceIds: claim.evidenceIds,
          material,
          treatmentSignals: evidenceEntries.map((e) => ({
            authorityId: e.authority.id,
            treatment: e.treatmentStatus,
            textHint: e.text.slice(0, 400),
            verified: e.case?.treatmentVerified,
            sourceName: e.case?.treatmentSourceName,
            sourceUrl: e.case?.treatmentSourceUrl,
          })),
        }),
      );
    } else {
      findings.push(this.notApplicableFinding('treatment', claim, 'Treatment graph service unavailable.'));
    }

    return this.buildAuditFromFindings(
      claim,
      findings,
      rejectedByAdmission.length > 0 &&
        passageSupport !== 'CONTRADICTED' &&
        !canApplyPassageOverride
        ? 'UNSUPPORTED'
        : passageSupport,
    );
  }

  private buildEvidenceIndex(pack: LegalEvidencePack): Map<string, EvidenceIndexEntry> {
    const ids = new Map<string, EvidenceIndexEntry>();
    for (const s of pack.statutes) {
      ids.set(s.evidenceId, {
        evidenceId: s.evidenceId,
        text: s.text,
        sourceHash: s.sourceHash,
        authority: { id: s.actId, title: s.heading, citation: `${s.actId} s.${s.section}` },
        statute: s,
        admission: s.admission,
      });
    }
    for (const c of pack.authorities) {
      ids.set(c.evidenceId, {
        evidenceId: c.evidenceId,
        text: c.passages.map((p) => p.text).join('\n\n'),
        authority: {
          id: c.authorityId,
          title: c.title,
          citation: c.citation,
          sourceName: c.court,
          sourceUrl: c.sourceUrl,
          practiceAreas: c.practiceAreas,
          topics: c.topics,
        },
        case: c,
        admission: c.admission,
      });
      for (const p of c.passages) {
        ids.set(p.evidenceId, {
          evidenceId: p.evidenceId,
          text: p.text,
          sourceHash: p.sourceHash,
          authority: {
            id: c.authorityId,
            title: c.title,
            citation: c.citation,
            sourceName: c.court,
            sourceUrl: c.sourceUrl,
            practiceAreas: c.practiceAreas,
            topics: c.topics,
          },
          case: c,
          passage: p,
          admission: c.admission,
          treatmentStatus: c.subsequentTreatment,
          controllingJurisdiction: c.controllingJurisdiction,
        });
      }
    }
    for (const o of pack.officialMaterials) {
      ids.set(o.evidenceId, {
        evidenceId: o.evidenceId,
        text: o.text,
        sourceHash: o.sourceHash,
        authority: { id: o.evidenceId, title: o.title, sourceName: o.sourceName },
        official: o,
        admission: o.admission,
      });
    }
    return ids;
  }

  private packHasAuthority(pack: LegalEvidencePack, authorityId: string): boolean {
    return (
      pack.authorities.some((authority) => authority.authorityId === authorityId) ||
      pack.statutes.some((statute) => statute.actId === authorityId) ||
      pack.officialMaterials.some(
        (material) =>
          this.authorityIdentity.stableAuthorityId({
            title: material.title,
            sourceName: material.sourceName,
          }) === authorityId,
      )
    );
  }

  private computePassageSupport(claimText: string, evidence: EvidenceIndexEntry[]): PassageSupport {
    const claimTokens = this.legalTokens(claimText);
    if (claimTokens.length === 0) return 'INDETERMINATE';

    let bestRatio = 0;
    for (const entry of evidence) {
      const passageTokens = new Set(this.legalTokens(entry.text));
      if (passageTokens.size === 0) continue;
      const overlap = claimTokens.filter((token) => passageTokens.has(token)).length;
      bestRatio = Math.max(bestRatio, overlap / claimTokens.length);
    }

    if (bestRatio >= 0.58) return 'SUPPORTED';
    if (bestRatio >= 0.32) return 'PARTIAL';
    if (bestRatio > 0) return 'UNSUPPORTED';
    return 'CONTRADICTED';
  }

  private buildAuditFromFindings(
    claim: ClaimBlock,
    findings: VerificationFinding[],
    passageSupport: PassageSupport,
    notes?: string,
  ): ClaimAudit {
    const hasBlockerFail = findings.some((f) => f.severity === 'BLOCKER' && f.state === 'FAIL');
    const hasBlockerIndeterminate = findings.some((f) => f.severity === 'BLOCKER' && f.state === 'INDETERMINATE');
    const hasPartial = passageSupport === 'PARTIAL';
    const isStatuteCharacterization =
      (claim.type === 'RULE' || claim.type === 'GENERAL_PRINCIPLE') &&
      (claim.evidenceIds?.length ?? 0) > 0 &&
      /\b(?:mandatory|default|characteriz|notice period|notice to quit|lease|injunction|declaration|premature|section|s\.\s*\d+)\b/i.test(
        claim.text,
      );
    let action: ClaimAudit['action'] =
      hasBlockerFail && claim.type !== 'APPLICATION'
        ? 'REMOVE'
        : hasBlockerFail || hasBlockerIndeterminate || hasPartial
          ? 'QUALIFY'
          : 'KEEP';
    if (isStatuteCharacterization && action !== 'KEEP' && passageSupport !== 'CONTRADICTED') {
      action = 'KEEP';
    }

    return {
      claimId: claim.claimId,
      identityVerified: this.booleanDimension(findings, 'identity'),
      relevanceValid: this.booleanDimension(findings, 'relevance'),
      passageSupport,
      pinpointValid: this.booleanDimension(findings, 'pinpoint'),
      jurisdictionValid: this.booleanDimension(findings, 'jurisdiction'),
      hierarchyValid: this.phaseTwoDimension(findings, 'hierarchy'),
      treatmentValid: this.phaseTwoDimension(findings, 'treatment'),
      currentLawValid: this.booleanDimension(findings, 'currentLaw'),
      confidence: action === 'KEEP' ? claim.confidence : Math.min(claim.confidence, 0.45),
      action,
      findings,
      notes:
        notes ??
        findings.find(
          (finding) =>
            finding.state !== 'PASS' &&
            finding.state !== 'NOT_APPLICABLE' &&
            !(finding.dimension === 'currentLaw' && finding.state === 'INDETERMINATE'),
        )?.explanation,
    };
  }

  private booleanDimension(findings: VerificationFinding[], dimension: VerificationFinding['dimension']): boolean | 'INDETERMINATE' {
    const related = findings.filter((f) => f.dimension === dimension);
    if (related.some((f) => f.state === 'FAIL')) return false;
    if (related.some((f) => f.state === 'INDETERMINATE')) return 'INDETERMINATE';
    return true;
  }

  private phaseTwoDimension(
    findings: VerificationFinding[],
    dimension: VerificationFinding['dimension'],
  ): boolean | 'NOT_APPLICABLE' | 'INDETERMINATE' {
    const related = findings.filter((f) => f.dimension === dimension);
    if (related.some((f) => f.state === 'FAIL')) return false;
    if (related.some((f) => f.state === 'INDETERMINATE')) return 'INDETERMINATE';
    if (related.some((f) => f.state === 'NOT_APPLICABLE')) return 'NOT_APPLICABLE';
    return true;
  }

  private jurisdictionFinding(
    claim: ClaimBlock,
    evidence: EvidenceIndexEntry[],
    jurisdiction: string,
  ): VerificationFinding {
    const hasMetadata = evidence.some((entry) => entry.controllingJurisdiction || entry.authority.sourceName);
    const mismatched = evidence.some((entry) => {
      const value = `${entry.controllingJurisdiction ?? ''} ${entry.authority.sourceName ?? ''}`.toLowerCase();
      return value && jurisdiction && !value.includes(jurisdiction.toLowerCase()) && !/supreme court|official|unknown/.test(value);
    });
    return {
      checkId: `jurisdiction:${claim.claimId}`,
      state: mismatched ? 'FAIL' : hasMetadata ? 'PASS' : 'INDETERMINATE',
      severity: mismatched ? 'BLOCKER' : hasMetadata ? 'LOW' : 'MEDIUM',
      dimension: 'jurisdiction',
      propositionId: claim.claimId,
      evidenceIds: claim.evidenceIds,
      explanation: mismatched
        ? 'Linked authority appears to belong to a different jurisdiction.'
        : hasMetadata
          ? 'Jurisdiction metadata is compatible with the requested jurisdiction.'
          : 'Jurisdiction metadata was unavailable for this authority.',
      repairAction: mismatched ? 'RETRIEVE' : hasMetadata ? undefined : 'ABSTAIN',
      verifierVersion: 'claim-level-v1',
    };
  }

  private currentLawFinding(
    claim: ClaimBlock,
    evidence: EvidenceIndexEntry[],
    failSeverity: FindingSeverity = 'BLOCKER',
  ): VerificationFinding {
    const superseded = evidence.find((entry) => entry.statute?.superseded || /overruled|repealed/.test(entry.treatmentStatus ?? ''));
    if (superseded) {
      return {
        checkId: `currentLaw:${claim.claimId}`,
        state: 'FAIL',
        severity: failSeverity,
        dimension: 'currentLaw',
        propositionId: claim.claimId,
        evidenceIds: claim.evidenceIds,
        explanation: 'Linked authority/provision is marked superseded, repealed, or overruled.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'claim-level-v1',
      };
    }
    const hasVersionMetadata = evidence.some((entry) => entry.statute?.effectiveDate || entry.statute?.effectiveFrom || entry.treatmentStatus);
    return {
      checkId: `currentLaw:${claim.claimId}`,
      state: hasVersionMetadata ? 'PASS' : 'INDETERMINATE',
      severity: hasVersionMetadata ? 'LOW' : 'MEDIUM',
      dimension: 'currentLaw',
      propositionId: claim.claimId,
      evidenceIds: claim.evidenceIds,
      explanation: hasVersionMetadata
        ? 'Available source metadata does not mark this authority as superseded.'
        : 'Current-law version metadata is unavailable for this authority.',
      repairAction: hasVersionMetadata ? undefined : 'ABSTAIN',
      verifierVersion: 'claim-level-v1',
    };
  }

  private relevanceFinding(
    claim: ClaimBlock,
    evidence: EvidenceIndexEntry[],
    query: string | undefined,
    legalDomain: string | undefined,
    failSeverity: FindingSeverity,
  ): VerificationFinding {
    if (!query?.trim() || !this.relevance) {
      return {
        checkId: `relevance:${claim.claimId}`,
        state: 'INDETERMINATE',
        severity: failSeverity,
        dimension: 'relevance',
        propositionId: claim.claimId,
        evidenceIds: claim.evidenceIds,
        explanation: 'Query context or relevance verifier was unavailable.',
        repairAction: 'ABSTAIN',
        verifierVersion: 'relevance-v1',
      };
    }
    const assessments = evidence.map((entry) =>
      this.relevance!.assess({
        authority: {
          title: entry.authority.title,
          citation: entry.authority.citation,
          fullText: entry.text,
          practiceAreas: entry.authority.practiceAreas,
          topics: entry.authority.topics,
        },
        query,
        legalDomain,
      }),
    );
    const best =
      assessments.find((assessment) => assessment.state === 'GOVERNS') ??
      assessments.find((assessment) => assessment.state === 'RELATED') ??
      assessments[0];
    const offPoint = !best || best.state === 'OFF_POINT';
    return {
      checkId: `relevance:${claim.claimId}`,
      state: offPoint ? 'FAIL' : 'PASS',
      severity: offPoint ? failSeverity : best.state === 'RELATED' ? 'MEDIUM' : 'LOW',
      dimension: 'relevance',
      propositionId: claim.claimId,
      evidenceIds: claim.evidenceIds,
      explanation: best?.reason ?? 'No authority was available for relevance assessment.',
      repairAction: offPoint ? 'RETRIEVE' : best.state === 'RELATED' ? 'NARROW' : undefined,
      verifierVersion: 'relevance-v1',
    };
  }

  private pinpointFinding(
    claim: ClaimBlock,
    evidence: EvidenceIndexEntry[],
    failSeverity: FindingSeverity,
  ): VerificationFinding {
    const hasPinpoint = evidence.some(
      (entry) =>
        Boolean(entry.passage?.paragraph || entry.passage?.page) ||
        Boolean(entry.statute?.section),
    );
    const quotes = [...claim.text.matchAll(/["“]([^"”]{12,})["”]/g)].map((match) =>
      match[1].replace(/\s+/g, ' ').trim().toLowerCase(),
    );
    const hasVerifiedQuote =
      quotes.length > 0 &&
      quotes.some((quote) =>
        evidence.some((entry) => entry.text.replace(/\s+/g, ' ').toLowerCase().includes(quote)),
      );
    return {
      checkId: `pinpoint:${claim.claimId}`,
      state: hasPinpoint || hasVerifiedQuote ? 'PASS' : 'INDETERMINATE',
      severity: hasPinpoint || hasVerifiedQuote ? 'LOW' : failSeverity,
      dimension: 'pinpoint',
      propositionId: claim.claimId,
      evidenceIds: claim.evidenceIds,
      explanation: hasPinpoint
        ? 'Evidence includes a paragraph, page, or statutory-section pinpoint.'
        : hasVerifiedQuote
          ? 'An exact quoted passage supplies the pinpoint.'
          : 'No paragraph/page pinpoint or verified quoted passage was available.',
      repairAction: hasPinpoint || hasVerifiedQuote ? undefined : 'RECITE',
      verifierVersion: 'pinpoint-v1',
    };
  }

  private notApplicableFinding(
    dimension: 'hierarchy' | 'treatment',
    claim: ClaimBlock,
    explanation: string,
  ): VerificationFinding {
    return {
      checkId: `${dimension}:${claim.claimId}:phase2`,
      state: 'NOT_APPLICABLE',
      severity: 'LOW',
      dimension,
      propositionId: claim.claimId,
      evidenceIds: claim.evidenceIds,
      explanation,
      verifierVersion: 'claim-level-v1',
    };
  }

  private passageExplanation(support: PassageSupport): string {
    switch (support) {
      case 'SUPPORTED':
        return 'Retrieved passage text supports the proposition.';
      case 'PARTIAL':
        return 'Retrieved passage text partially supports the proposition; wording should be narrowed.';
      case 'UNSUPPORTED':
        return 'Retrieved passage text does not sufficiently support the proposition.';
      case 'CONTRADICTED':
        return 'No meaningful overlap was found between proposition and linked passage.';
      case 'INDETERMINATE':
        return 'Passage support could not be determined from available source text.';
    }
  }

  private legalTokens(text: string): string[] {
    const stop = new Set([
      'the', 'and', 'that', 'this', 'with', 'from', 'into', 'for', 'shall', 'must', 'may', 'can',
      'court', 'section', 'under', 'where', 'there', 'been', 'being', 'have', 'has', 'are', 'was',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 3 && !stop.has(token));
  }
}

interface EvidenceIndexEntry {
  evidenceId: string;
  text: string;
  sourceHash?: string;
  authority: {
    id: string;
    title?: string | null;
    citation?: string | null;
    sourceName?: string | null;
    sourceUrl?: string;
    practiceAreas?: string[];
    topics?: string[];
  };
  case?: EvidenceCase;
  passage?: EvidencePassage;
  statute?: EvidenceStatute;
  official?: OfficialMaterialEvidence;
  treatmentStatus?: string;
  controllingJurisdiction?: string;
  admission?: EvidenceCase['admission'];
}
