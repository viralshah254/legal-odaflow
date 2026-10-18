import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LegalEvidencePack, EvidenceCase } from '@/ai/legal-research/legal-evidence-pack.service';
import { AuthorityIdentityService } from '@/ai/verification/authority-identity.service';
import { QuotationVerificationService } from '@/ai/verification/quotation-verification.service';
import { PropositionEntailmentService } from '@/ai/verification/proposition-entailment.service';
import { CourtHierarchyService } from '@/ai/verification/court-hierarchy.service';
import { TreatmentGraphService } from '@/ai/verification/treatment-graph.service';
import { CurrentLawCheckerService } from '@/ai/legal-research/current-law-checker.service';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { getAuthorityRequirement } from '@/ai/drafting/draft-authority-requirements';
import { DraftKindPlaybookService } from '@/ai/drafting/playbooks/draft-kind-playbook.service';
import {
  summarizeFindings,
  type VerificationFinding,
  type VerificationDimensions,
} from '@/ai/verification/verification-finding.types';
import { buildEvidencePackFromRegistry } from './registry-to-evidence-pack.adapter';
import { extractCitationPropositions } from './citation-proposition-extractor.util';
import type {
  DraftAuthorityVerificationInput,
  DraftAuthorityVerificationResult,
  ExtractedCitationProposition,
  VerifiedCitationAppendixEntry,
} from './draft-authority-verification.types';

type PassageSupport = 'SUPPORTED' | 'PARTIAL' | 'UNSUPPORTED' | 'INDETERMINATE' | 'CONTRADICTED';

interface EvidenceIndexEntry {
  evidenceId: string;
  text: string;
  authority: { id: string; title: string; citation: string; sourceName?: string };
  treatmentStatus?: string;
  controllingJurisdiction?: string;
  sourceTier?: string;
}

@Injectable()
export class DraftAuthorityVerificationService {
  private readonly logger = new Logger(DraftAuthorityVerificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly planner: AuthorityRetrievalPlannerService,
    private readonly playbooks: DraftKindPlaybookService,
    private readonly authorityIdentity: AuthorityIdentityService,
    private readonly quotationVerification: QuotationVerificationService,
    @Optional() private readonly entailment?: PropositionEntailmentService,
    @Optional() private readonly courtHierarchy?: CourtHierarchyService,
    @Optional() private readonly treatmentGraph?: TreatmentGraphService,
    @Optional() private readonly currentLawChecker?: CurrentLawCheckerService,
  ) {}

  isEnabled(): boolean {
    const flag = this.configService.get<string>('DRAFT_AUTHORITY_VERIFICATION_ENABLED');
    return flag !== 'false';
  }

  async verify(input: DraftAuthorityVerificationInput): Promise<DraftAuthorityVerificationResult> {
    const jurisdiction = input.jurisdiction ?? 'IN';
    const { pack, evidenceIdByCitation } = buildEvidencePackFromRegistry({
      sourceRegistry: input.sourceRegistry,
      documentKind: input.documentKind,
      jurisdiction,
      rawFacts: input.rawFacts,
      pinnedCaseLaws: input.pinnedCaseLaws,
    });

    const plan = this.planner.buildPlan({
      documentKind: input.documentKind,
      jurisdiction,
      rawFacts: input.rawFacts,
    });

    const propositions = extractCitationPropositions(
      input.draftText,
      input.documentKind,
      input.rawFacts,
      evidenceIdByCitation,
      plan.legalIssues,
    );

    const evidenceIndex = this.buildEvidenceIndex(pack);
    const allFindings: VerificationFinding[] = [];
    const appendix: VerifiedCitationAppendixEntry[] = [];

    for (const prop of propositions) {
      const { findings, dimensions } = this.verifyCitationProposition(
        prop,
        pack,
        evidenceIndex,
        jurisdiction,
        input.documentKind,
      );
      allFindings.push(...findings);
      appendix.push(this.toAppendixEntry(prop, pack, findings, dimensions));
    }

    const aggregateDimensions = summarizeFindings(allFindings);
    const gate = this.evaluateGate(input.documentKind, appendix, aggregateDimensions);

    return {
      citationAppendix: appendix,
      gate,
      findings: allFindings,
      aggregateDimensions,
    };
  }

  toAccuracyFindings(result: DraftAuthorityVerificationResult): Array<{
    code: string;
    severity: 'blocker' | 'high' | 'medium' | 'low';
    message: string;
    repairHint?: string;
  }> {
    const out: Array<{
      code: string;
      severity: 'blocker' | 'high' | 'medium' | 'low';
      message: string;
      repairHint?: string;
    }> = [];

    for (const entry of result.citationAppendix) {
      if (entry.identityStatus === 'fail') {
        out.push({
          code: 'CITATION_WITHOUT_PROPOSITION',
          severity: 'blocker',
          message: `Authority "${entry.citation}" could not be verified against the evidence pack.`,
          repairHint: 'RETRIEVE',
        });
      }
      if (entry.relevanceStatus === 'fail') {
        out.push({
          code: 'PASSAGE_NOT_VERIFIED',
          severity: 'blocker',
          message: `Proposition for "${entry.citation}" is not supported by retrieved passage text.`,
          repairHint: 'REMOVE',
        });
      }
    }

    if (!result.gate.canExport && result.gate.blockers.length > 0) {
      for (const blocker of result.gate.blockers) {
        out.push({
          code: 'AUTHORITY_VERIFICATION_GATE',
          severity: 'blocker',
          message: blocker,
        });
      }
    }

    return out;
  }

  private verifyCitationProposition(
    prop: ExtractedCitationProposition,
    pack: LegalEvidencePack,
    evidenceIndex: Map<string, EvidenceIndexEntry>,
    jurisdiction: string,
    documentKind: string,
  ): { findings: VerificationFinding[]; dimensions: VerificationDimensions } {
    const findings: VerificationFinding[] = [];

    if (prop.orphan) {
      findings.push({
        checkId: `identity:${prop.id}:orphan`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'identity',
        propositionId: prop.id,
        evidenceIds: [],
        explanation: 'Citation appears in draft but is absent from the locked evidence pack.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'draft-authority-v1',
      });
      return { findings, dimensions: summarizeFindings(findings) };
    }

    const evidenceEntries = prop.evidenceIds
      .map((id) => evidenceIndex.get(id))
      .filter(Boolean) as EvidenceIndexEntry[];

    if (evidenceEntries.length === 0) {
      const matched = this.matchPackByCitation(prop.citationKey, pack);
      if (matched) {
        for (const p of matched.passages) {
          evidenceEntries.push({
            evidenceId: p.evidenceId,
            text: p.text,
            authority: {
              id: matched.authorityId,
              title: matched.title,
              citation: matched.citation,
              sourceName: matched.court,
            },
            treatmentStatus: matched.subsequentTreatment,
            controllingJurisdiction: matched.controllingJurisdiction,
            sourceTier: p.sourceTier,
          });
        }
        prop.evidenceIds = evidenceEntries.map((e) => e.evidenceId);
      }
    }

    const identityAuthority = evidenceEntries[0]?.authority;
    if (identityAuthority) {
      const identity = this.authorityIdentity.resolveFromPack(identityAuthority, pack);
      findings.push(this.authorityIdentity.findingForResolution(identity, prop.id));
    } else {
      findings.push({
        checkId: `identity:${prop.id}:missing`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'identity',
        propositionId: prop.id,
        evidenceIds: [],
        explanation: 'No evidence pack entry matched this citation.',
        repairAction: 'RETRIEVE',
        verifierVersion: 'draft-authority-v1',
      });
    }

    const crossDomain = this.assessCrossDomainRelevance(documentKind, prop.issue, evidenceEntries);
    let passageSupport =
      crossDomain ?? this.assessPassage(prop.proposition, evidenceEntries);
    const curatedEvidence = evidenceEntries.some((e) => e.sourceTier === 'CURATED');
    if (!crossDomain && curatedEvidence && passageSupport === 'UNSUPPORTED') {
      const rescue = this.computePassageSupport(prop.proposition, evidenceEntries, true);
      passageSupport =
        rescue === 'UNSUPPORTED' || rescue === 'CONTRADICTED' ? 'PARTIAL' : rescue;
    }
    if (!crossDomain && curatedEvidence && passageSupport === 'INDETERMINATE') {
      passageSupport = 'PARTIAL';
    }
    findings.push({
      checkId: `passage:${prop.id}`,
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
            : 'BLOCKER',
      dimension: 'passage',
      propositionId: prop.id,
      authorityId: identityAuthority?.id,
      evidenceIds: prop.evidenceIds,
      explanation: this.passageExplanation(passageSupport, prop.issue),
      repairAction:
        passageSupport === 'SUPPORTED'
          ? undefined
          : passageSupport === 'PARTIAL'
            ? 'QUALIFY'
            : 'REMOVE',
      verifierVersion: 'draft-authority-v2',
    });

    if (
      evidenceEntries.length > 0 &&
      !evidenceEntries.every((entry) => entry.sourceTier === 'CURATED')
    ) {
      findings.push(
        ...this.quotationVerification.verify({
          propositionId: prop.id,
          text: prop.proposition,
          evidenceIds: prop.evidenceIds,
          evidencePack: pack,
        }),
      );
    }

    findings.push(this.currentLawFinding(prop, evidenceEntries));

    if (this.courtHierarchy) {
      findings.push(
        this.courtHierarchy.findingForClaim({
          claimId: prop.id,
          evidenceIds: prop.evidenceIds,
          jurisdiction,
          authorities: evidenceEntries.map((e) => ({
            authorityId: e.authority.id,
            court: e.authority.sourceName,
            controllingJurisdiction: e.controllingJurisdiction,
          })),
        }),
      );
    } else {
      findings.push(this.notApplicableFinding('hierarchy', prop.id, 'Court hierarchy service unavailable.'));
    }

    if (this.treatmentGraph) {
      findings.push(
        this.treatmentGraph.findingForClaim({
          claimId: prop.id,
          evidenceIds: prop.evidenceIds,
          material: true,
          treatmentSignals: evidenceEntries.map((e) => ({
            authorityId: e.authority.id,
            treatment: e.treatmentStatus,
            textHint: e.text.slice(0, 400),
          })),
        }),
      );
    } else {
      findings.push(this.notApplicableFinding('treatment', prop.id, 'Treatment graph service unavailable.'));
    }

    return { findings, dimensions: summarizeFindings(findings) };
  }

  private evaluateGate(
    documentKind: string,
    appendix: VerifiedCitationAppendixEntry[],
    aggregateDimensions: VerificationDimensions,
  ) {
    const requirement = getAuthorityRequirement(documentKind);
    const playbook = this.playbooks.resolve(documentKind);
    const minVerifiedCases =
      playbook.minVerifiedCaseAuthorities === 0 && !playbook.filingGrade
        ? 0
        : Math.max(requirement.minVerifiedCases, playbook.minVerifiedCaseAuthorities);

    const passing = appendix.filter((e) => this.isPassingAuthority(e));
    const passingCaseCount = passing.filter((e) => e.type === 'case_law').length;
    const blockers: string[] = [];

    const hasDimensionFail = Object.values(aggregateDimensions).some((d) => d.state === 'FAIL');
    if (hasDimensionFail) {
      blockers.push('One or more cited authorities failed verification dimensions.');
    }

    if (minVerifiedCases > 0 && passingCaseCount < minVerifiedCases) {
      blockers.push(
        `Requires at least ${minVerifiedCases} verified case authorities; found ${passingCaseCount}.`,
      );
    }

    const skipCaseMinimum = minVerifiedCases === 0;
    const filingGrade = playbook.filingGrade;
    const hardBlock = filingGrade && blockers.length > 0;

    return {
      canExport: hardBlock ? false : blockers.length === 0 || (skipCaseMinimum && !hasDimensionFail),
      status: hardBlock ? ('fail' as const) : blockers.length > 0 ? ('limitations' as const) : ('pass' as const),
      userLabel: hardBlock
        ? 'Authority verification failed — resolve before filing export.'
        : blockers.length > 0
          ? 'Authority verification has limitations — review before filing.'
          : 'Authorities verified.',
      blockers,
      verifiedCaseCount: passingCaseCount,
      minVerifiedCases,
      passingAuthorityCount: passing.length,
    };
  }

  isPassingAuthority(entry: VerifiedCitationAppendixEntry): boolean {
    if (entry.identityStatus !== 'pass' || entry.relevanceStatus !== 'pass') return false;
    const blockerFail = entry.verificationFindings?.some(
      (f) => f.severity === 'BLOCKER' && f.state === 'FAIL',
    );
    return !blockerFail;
  }

  private toAppendixEntry(
    prop: ExtractedCitationProposition,
    pack: LegalEvidencePack,
    findings: VerificationFinding[],
    dimensions: VerificationDimensions,
  ): VerifiedCitationAppendixEntry {
    const matched = this.matchPackByCitation(prop.citationKey, pack);
    const identityState = dimensions.identity.state;
    const passageState = dimensions.passage.state;

    const identityStatus =
      identityState === 'PASS' ? 'pass' : identityState === 'FAIL' ? 'fail' : 'indeterminate';
    const relevanceStatus =
      passageState === 'PASS' ? 'pass' : passageState === 'FAIL' ? 'fail' : 'indeterminate';

    const treatmentFinding = findings.find((f) => f.dimension === 'treatment');
    const currentLawFinding = findings.find((f) => f.dimension === 'currentLaw');
    let treatmentStatus: VerifiedCitationAppendixEntry['treatmentStatus'] = matched?.subsequentTreatment as
      | VerifiedCitationAppendixEntry['treatmentStatus']
      | undefined;
    if (currentLawFinding?.state === 'FAIL' || treatmentFinding?.state === 'FAIL') {
      treatmentStatus = 'overruled';
    } else if (matched?.subsequentTreatment) {
      treatmentStatus = matched.subsequentTreatment as VerifiedCitationAppendixEntry['treatmentStatus'];
    } else if (!treatmentStatus) {
      treatmentStatus = 'good_law';
    }

    const verified = identityStatus === 'pass' && relevanceStatus === 'pass';

    return {
      sectionId: 'draft',
      sectionTitle: prop.issue.replace(/_/g, ' '),
      paragraphIndex: prop.paragraphIndex,
      citation: matched ? `${matched.title} — ${matched.citation}` : prop.citationDisplay,
      type: 'case_law',
      verified,
      source: matched?.court,
      court: matched?.court,
      decisionYear: matched?.decidedDate ? Number(matched.decidedDate.slice(0, 4)) : undefined,
      holding: prop.proposition.slice(0, 300),
      identityStatus,
      relevanceStatus,
      treatmentStatus,
      citedInDraft: true,
      excluded: identityStatus === 'fail' || relevanceStatus === 'fail',
      exclusionReason:
        identityStatus === 'fail'
          ? 'Citation not found in verified evidence pack.'
          : relevanceStatus === 'fail'
            ? 'Draft proposition not supported by authority passage.'
            : undefined,
      dimensions,
      verificationFindings: findings,
      issue: prop.issue,
    };
  }

  private matchPackByCitation(citationKey: string, pack: LegalEvidencePack): EvidenceCase | undefined {
    const norm = citationKey.toLowerCase();
    return pack.authorities.find(
      (a) =>
        a.citation.toLowerCase().includes(norm) ||
        norm.includes(a.citation.toLowerCase()) ||
        a.title.toLowerCase().includes(norm.slice(0, 20)),
    );
  }

  private buildEvidenceIndex(pack: LegalEvidencePack): Map<string, EvidenceIndexEntry> {
    const ids = new Map<string, EvidenceIndexEntry>();
    for (const c of pack.authorities) {
      ids.set(c.evidenceId, {
        evidenceId: c.evidenceId,
        text: c.passages.map((p) => p.text).join('\n\n'),
        authority: { id: c.authorityId, title: c.title, citation: c.citation, sourceName: c.court },
        treatmentStatus: c.subsequentTreatment,
        controllingJurisdiction: c.controllingJurisdiction,
        sourceTier: c.passages[0]?.sourceTier,
      });
      for (const p of c.passages) {
        ids.set(p.evidenceId, {
          evidenceId: p.evidenceId,
          text: p.text,
          authority: { id: c.authorityId, title: c.title, citation: c.citation, sourceName: c.court },
          treatmentStatus: c.subsequentTreatment,
          controllingJurisdiction: c.controllingJurisdiction,
          sourceTier: p.sourceTier,
        });
      }
    }
    return ids;
  }

  private assessPassage(proposition: string, evidence: EvidenceIndexEntry[]): PassageSupport {
    if (evidence.length === 0 || evidence.every((e) => !e.text.trim())) return 'INDETERMINATE';
    const hasCurated = evidence.some((e) => e.sourceTier === 'CURATED');
    if (hasCurated) {
      const lexical = this.computePassageSupport(proposition, evidence, true);
      if (lexical === 'SUPPORTED' || lexical === 'PARTIAL') return lexical;
    }
    let support: PassageSupport = 'INDETERMINATE';
    if (this.entailment) {
      const result = this.entailment.assess(
        proposition,
        evidence.map((e) => e.text),
      );
      if (result === 'SUPPORTED' || result === 'PARTIAL') return result;
      if (result === 'INDETERMINATE') support = 'INDETERMINATE';
      else support = 'UNSUPPORTED';
    } else {
      support = this.computePassageSupport(proposition, evidence);
    }
    if (
      hasCurated &&
      (support === 'UNSUPPORTED' || support === 'CONTRADICTED' || support === 'INDETERMINATE')
    ) {
      const lexical = this.computePassageSupport(proposition, evidence);
      if (lexical === 'SUPPORTED' || lexical === 'PARTIAL') return lexical;
    }
    return support;
  }

  /** Reject consumer/bail authorities cited only for unrelated civil issues (and vice versa). */
  private assessCrossDomainRelevance(
    documentKind: string,
    issue: string,
    evidence: EvidenceIndexEntry[],
  ): PassageSupport | null {
    const kind = documentKind.toLowerCase();
    const spIssue = /specific_performance|readiness_and_willingness|immovable/.test(issue);
    const consumerAuthority = evidence.some((e) =>
      /deficiency in service|consumer protection|consumer court|consumer forum/i.test(
        `${e.authority.title} ${e.text}`,
      ),
    );
    if (
      consumerAuthority &&
      /specific_performance|civil_plaint|india_plaint/.test(kind) &&
      spIssue
    ) {
      return 'UNSUPPORTED';
    }
    const bailAuthority = evidence.every((e) =>
      /\bbail\b|anticipatory|personal liberty|flight risk/i.test(`${e.authority.title} ${e.text}`),
    );
    if (bailAuthority && /consumer|specific_performance/.test(kind) && !/bail/.test(issue)) {
      return 'UNSUPPORTED';
    }
    return null;
  }

  private computePassageSupport(
    proposition: string,
    evidence: EvidenceIndexEntry[],
    curatedBank = false,
  ): PassageSupport {
    const claimTokens = this.legalTokens(proposition);
    if (claimTokens.length === 0) return 'INDETERMINATE';
    const significantClaim = claimTokens.filter((t) => t.length > 4).slice(0, 18);
    const denominator = Math.max(significantClaim.length, Math.min(claimTokens.length, 10));
    let bestRatio = 0;
    for (const entry of evidence) {
      const passageTokens = new Set(this.legalTokens(entry.text));
      if (passageTokens.size === 0) continue;
      const pool = significantClaim.length >= 4 ? significantClaim : claimTokens;
      const overlap = pool.filter((t) => passageTokens.has(t)).length;
      bestRatio = Math.max(bestRatio, overlap / denominator);
    }
    const supportedAt = curatedBank ? 0.42 : 0.58;
    const partialAt = curatedBank ? 0.22 : 0.32;
    if (bestRatio >= supportedAt) return 'SUPPORTED';
    if (bestRatio >= partialAt) return 'PARTIAL';
    if (bestRatio > 0) return 'UNSUPPORTED';
    return 'CONTRADICTED';
  }

  private legalTokens(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3);
  }

  private passageExplanation(support: PassageSupport, issue: string): string {
    if (support === 'SUPPORTED') return `Draft proposition for ${issue} is supported by authority passage.`;
    if (support === 'PARTIAL') return `Authority partially supports the ${issue} proposition — qualify before filing.`;
    if (support === 'INDETERMINATE') return 'Passage text unavailable for entailment check.';
    return `Authority passage does not support the ${issue} proposition in this draft.`;
  }

  private currentLawFinding(prop: ExtractedCitationProposition, evidence: EvidenceIndexEntry[]): VerificationFinding {
    const adverse = evidence.find((e) => /overruled|repealed|superseded/.test(e.treatmentStatus ?? ''));
    if (adverse) {
      return {
        checkId: `currentLaw:${prop.id}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'currentLaw',
        propositionId: prop.id,
        evidenceIds: prop.evidenceIds,
        explanation: 'Authority treatment indicates it may no longer be good law.',
        repairAction: 'REMOVE',
        verifierVersion: 'draft-authority-v1',
      };
    }
    return {
      checkId: `currentLaw:${prop.id}`,
      state: evidence.length > 0 ? 'PASS' : 'INDETERMINATE',
      severity: 'LOW',
      dimension: 'currentLaw',
      propositionId: prop.id,
      evidenceIds: prop.evidenceIds,
      explanation:
        evidence.length > 0
          ? 'No overruled or repealed signal on linked authority metadata.'
          : 'Current-law status unknown.',
      verifierVersion: 'draft-authority-v1',
    };
  }

  private notApplicableFinding(
    dimension: VerificationFinding['dimension'],
    propositionId: string,
    explanation: string,
  ): VerificationFinding {
    return {
      checkId: `${dimension}:${propositionId}:na`,
      state: 'NOT_APPLICABLE',
      severity: 'LOW',
      dimension,
      propositionId,
      evidenceIds: [],
      explanation,
      verifierVersion: 'draft-authority-v1',
    };
  }
}
