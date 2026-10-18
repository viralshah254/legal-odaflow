import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  CitationVerificationService,
  type CitationAuthority,
} from '@/ai/citations/citation-verification.service';
import {
  SubstanceVerificationService,
  normalizeBnssText,
} from '@/ai/citations/substance-verification.service';
import { LegalSanityCheckService } from '@/ai/legal-research/legal-sanity-check.service';
import { SectionMismatchService } from '@/ai/legal-research/section-mismatch.service';
import { extractSectionRefs, SimilarCasesService } from '@/ai/legal-research/similar-cases.service';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { DEFAULT_AUTO_MODEL } from '@/ai/model-costs.config';
import {
  normalizeIndiaDraftStatutes,
  type StatuteCorrection,
} from '@/ai/india-draft/india-draft-statute-normalizer';
import { BareActLookupService } from '@/legal-search/bare-act-lookup.service';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { SentenceAuditService } from '@/legal-search/sentence-audit.service';
import { VerifyClassifierService } from '@/legal-search/verify-classifier.service';
import { UnifiedVerificationService } from '@/ai/verification/unified-verification.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';
import { ClaimLevelVerificationService } from '@/ai/legal-research/claim-level-verification.service';
import { PropositionExtractionService } from '@/ai/verification/proposition-extraction.service';
import { ClaimRepairService } from '@/ai/verification/claim-repair.service';
import {
  resolvePublicationState,
  summarizeFindings,
  type VerificationFinding,
} from '@/ai/verification/verification-finding.types';
import { sanitizeDraftOutput } from './draft-output-sanitizer';
import { DraftSectionFinderGroundingService } from './draft-section-finder-grounding.service';
import { detectLegalSafetyViolations } from './draft-legal-blocklist';
import { stripUnverifiedCitations, stripGroundingAuthorityDisclaimers } from './draft-citation-sanitizer';
import { LEGAL_ACCURACY_PROTOCOL } from './legal-accuracy-protocol';
import { DraftLegalRegisterService } from './draft-legal-register.service';
import { DraftFactFidelityService } from './draft-fact-fidelity.service';
import { DraftCaseBriefService } from './draft-case-brief.service';
import { DraftProceduralTimelineValidator } from './draft-procedural-timeline.validator';
import { DraftCaseFactCoverageService } from './draft-case-fact-coverage.service';
import type {
  AddVerifiedCitationsInput,
  AddVerifiedCitationsResult,
  DraftVerificationAudit,
  DraftVerificationStatus,
  DraftVerifyInput,
  DraftVerifyResult,
} from './draft-verification.types';

function parseSectionRef(ref: string): { actId: string; section: string } | null {
  const ACT_ID_MAP: Record<string, string> = {
    BNSS: 'bnss',
    BNS: 'bns',
    BSA: 'bsa',
    IPC: 'ipc',
    CRPC: 'crpc',
    IEA: 'iea',
    'NI ACT': 'ni_act',
    NDPS: 'ndps',
    PMLA: 'pmla',
    POCSO: 'pocso',
  };
  const m = ref.match(/^([A-Z\s]+)\s+s\.(\S+)$/i);
  if (!m) return null;
  const actId = ACT_ID_MAP[m[1].trim().toUpperCase()];
  if (!actId) return null;
  return { actId, section: m[2].trim().toUpperCase() };
}

function toCitationAuthority(authority: RetrievedAuthority): CitationAuthority {
  return {
    id: authority.id,
    title: authority.title ?? authority.id,
    citation: authority.citation ?? null,
    sourceName: authority.sourceName,
    summary: authority.summary ?? null,
  };
}

function toRetrievedAuthorityFromBareAct(
  authority: NonNullable<Awaited<ReturnType<BareActLookupService['lookupExactSection']>>['authority']>,
): RetrievedAuthority {
  return {
    id: authority.id,
    title: authority.title,
    citation: authority.citation,
    sourceName: authority.sourceName ?? 'Bare Act Corpus',
    summary: authority.summary ?? null,
    fullText: authority.fullText ?? null,
    sourceUrl: authority.sourceUrl ?? null,
    sourceTier: 'primary',
    authorityType: 'STATUTE_SECTION',
    score: authority.score,
    isRepealed: authority.isRepealed,
    repealNotes: authority.repealNotes,
    treatmentStatus: authority.isRepealed ? 'repealed' : undefined,
  };
}

function resolveVerificationStatus(audit: Omit<DraftVerificationAudit, 'verificationStatus'>): DraftVerificationStatus {
  if (
    audit.strippedCitations.length > 0 ||
    audit.citationWarnings.some((w) => /unverifiable/i.test(w)) ||
    audit.sectionChecks.anyUnconfirmedMismatches
  ) {
    return 'needs_review';
  }
  if (audit.similarCases.length === 0 && audit.corrections.length === 0) {
    return 'limited_sources';
  }
  if (audit.requiresLawyerReview) {
    return 'needs_review';
  }
  return 'verified';
}

@Injectable()
export class DraftVerificationService {
  private readonly logger = new Logger(DraftVerificationService.name);

  constructor(
    private readonly bareActLookup: BareActLookupService,
    private readonly retrieval: LegalRetrievalOrchestrator,
    private readonly similarCasesService: SimilarCasesService,
    private readonly sectionMismatch: SectionMismatchService,
    private readonly citationVerification: CitationVerificationService,
    private readonly substanceVerification: SubstanceVerificationService,
    private readonly sentenceAudit: SentenceAuditService,
    private readonly legalSanityCheck: LegalSanityCheckService,
    private readonly verifyClassifier: VerifyClassifierService,
    private readonly unifiedVerification: UnifiedVerificationService,
    private readonly sectionFinderGrounding: DraftSectionFinderGroundingService,
    private readonly llm: LlmCompletionService,
    private readonly evidencePackService: LegalEvidencePackService,
    private readonly claimVerifier: ClaimLevelVerificationService,
    private readonly propositionExtraction: PropositionExtractionService,
    private readonly claimRepair: ClaimRepairService,
    private readonly legalRegister: DraftLegalRegisterService,
    private readonly factFidelity: DraftFactFidelityService,
    private readonly caseBriefService: DraftCaseBriefService,
    private readonly timelineValidator: DraftProceduralTimelineValidator,
    private readonly factCoverage: DraftCaseFactCoverageService,
  ) {}

  async verify(input: DraftVerifyInput): Promise<DraftVerifyResult> {
    const countryCode = input.countryCode.toUpperCase();
    let draft = input.draft;
    const corrections: StatuteCorrection[] = [];
    const citationWarnings: string[] = [
      ...(input.proceduralWarnings ?? []).map((w) => `Procedural: ${w}`),
    ];

    if (countryCode === 'IN') {
      const normalized = normalizeIndiaDraftStatutes(draft, {
        kind: input.kind,
        caseDetails: input.caseDetails,
      });
      draft = normalizeBnssText(normalized.text);
      corrections.push(...normalized.corrections);

      try {
        const finderContext = await this.sectionFinderGrounding.buildContext(
          input.kind,
          input.caseDetails,
        );
        for (const fix of this.sectionFinderGrounding.suggestCrosswalkFixes(
          draft,
          finderContext.matches,
        )) {
          if (!corrections.some((c) => c.from === fix.from)) {
            corrections.push({
              from: fix.from,
              to: fix.to,
              reason: fix.reason,
              source: 'schedule1_crosswalk',
            });
          }
          citationWarnings.push(`Section Finder: ${fix.reason}`);
        }
      } catch (err) {
        this.logger.warn(`Section Finder verification skipped: ${String(err)}`);
      }
    }

    const sectionRefs = extractSectionRefs(draft);
    const bareActAuthorities: RetrievedAuthority[] = [];
    if (countryCode === 'IN' && sectionRefs.length > 0) {
      // Deduplicate refs so the same section is only looked up once.
      const uniqueRefs = [...new Set(sectionRefs)];
      const lookupResults = await Promise.allSettled(
        uniqueRefs.map(async (ref) => {
          const parsed = parseSectionRef(ref);
          if (!parsed) return;
          const lookup = await this.bareActLookup.lookupExactSection(
            parsed.actId,
            parsed.section,
            countryCode,
          );
          if (!lookup.found) {
            citationWarnings.push(
              `${ref} could not be confirmed in the bare-act corpus — verify before filing.`,
            );
          } else if (lookup.authority) {
            bareActAuthorities.push(toRetrievedAuthorityFromBareAct(lookup.authority));
          }
        }),
      );
      for (const result of lookupResults) {
        if (result.status === 'rejected') {
          this.logger.warn(`Bare-act lookup failed: ${String(result.reason)}`);
        }
      }
    }

    const retrievalQuery = [input.caseDetails, input.kind, ...sectionRefs].join(' ').trim();
    let authorities: RetrievedAuthority[] = [];
    try {
      const retrieval = await this.retrieval.retrieve({
        query: retrievalQuery,
        countryCode,
        jurisdiction: input.jurisdiction,
        tenantId: input.tenantId,
        userId: input.userId,
        limit: 12,
      });
      authorities = retrieval.authorities;
    } catch (err) {
      this.logger.warn(`Draft verification retrieval failed: ${String(err)}`);
      citationWarnings.push('Case-law retrieval unavailable — verification limited.');
    }

    // Merge grounding authorities (curated + generation-time retrieved) so the
    // sanitizer never strips a reporter cite that was explicitly given to the LLM.
    // De-duplicate by id to avoid inflating citation counts.
    if (input.groundingAuthorities?.length || bareActAuthorities.length > 0) {
      const existingIds = new Set(authorities.map((a) => a.id));
      for (const ga of [...bareActAuthorities, ...(input.groundingAuthorities ?? [])]) {
        if (!existingIds.has(ga.id)) {
          authorities.push(ga);
          existingIds.add(ga.id);
        }
      }
    }

    const caseLawPool = authorities.filter(
      (a) => a.sourceTier === 'case_law' || (a.authorityType ?? '').toUpperCase() === 'CASE',
    );
    const similarCases = this.similarCasesService.extractAndRank(
      caseLawPool.length > 0 ? caseLawPool : authorities,
      retrievalQuery,
      countryCode,
      3,
    );

    const sectionResult = await this.sectionMismatch.checkAndCorrect({
      outputMarkdown: draft,
      similarCases,
      countryCode,
    });
    draft = sectionResult.markdown;

    const citationAuthorities = authorities.map(toCitationAuthority);
    const unified = await this.unifiedVerification.runChecks({
      query: retrievalQuery,
      outputMarkdown: draft,
      authorities,
      countryCode,
      isBareActQuery: sectionRefs.length > 0,
    });

    citationWarnings.push(...unified.citation.warnings);
    for (const unverified of unified.citation.unverifiableCitations) {
      citationWarnings.push(`Unverifiable case citation (not in corpus): ${unverified}`);
    }
    citationWarnings.push(...unified.substanceWarnings);

    const sentenceAuditResult = unified.sentenceAudit;

    const stripResult = stripUnverifiedCitations(
      draft,
      citationAuthorities,
      unified.verifiedCitationTexts,
      'strip',
    );
    draft = stripResult.text;

    const sanitized = sanitizeDraftOutput(draft, {
      documentClass: /contract|agreement|nda|lease|deed/i.test(input.kind) ? 'contract' : 'pleading',
      kind: input.kind,
      caseDetails: input.caseDetails,
    });
    draft = sanitized.text;

    // Safety net: remove any residual inline disclaimers the LLM added next to
    // authorities that were in the grounding block and are therefore verified.
    if (input.groundingAuthorities?.length) {
      draft = stripGroundingAuthorityDisclaimers(draft, input.groundingAuthorities);
    }

    const evidencePack = this.evidencePackService.buildFromAuthorities({
      jurisdiction: input.jurisdiction ?? countryCode,
      authorities,
      matterFacts: this.extractMatterFacts(input.caseDetails),
    });
    const extractedDraft = this.propositionExtraction.fromMarkdown(draft, evidencePack);
    const claimVerification = this.claimVerifier.verify({
      draft: extractedDraft,
      evidencePack,
      jurisdiction: input.jurisdiction ?? countryCode,
    });
    if (claimVerification.removedClaims.length > 0 || claimVerification.repairedClaims.length > 0) {
      draft = this.claimRepair.repairMarkdown(draft, claimVerification.claimAudits);
    }

    const legalSafetyViolations =
      countryCode === 'IN'
        ? detectLegalSafetyViolations({
            draft,
            recommendedKind: input.recommendedKind ?? input.kind,
            causeTitleVehicle: input.causeTitleVehicle,
          })
        : [];
    for (const v of legalSafetyViolations) {
      citationWarnings.push(`Legal safety: ${v.reason}`);
    }

    const verifiedInText = unified.citation.citations.filter((c) => c.verified !== false).length;
    const citationAudit = {
      verified: verifiedInText,
      total: unified.citation.citations.length + stripResult.stripped.length,
      unverifiable: unified.citation.unverifiableCitations,
    };

    const requiresLawyerReview =
      sectionResult.audit.anyUnconfirmedMismatches ||
      unified.citation.unverifiableCitations.length > 0 ||
      stripResult.stripped.length > 0 ||
      !unified.substancePassed ||
      !unified.classifierPassed ||
      !unified.sectionAlignment.passed ||
      unified.verificationUnavailable === true ||
      corrections.length > 0 ||
      (input.proceduralWarnings?.length ?? 0) > 0 ||
      legalSafetyViolations.length > 0 ||
      input.authoritiesOnPoint === false ||
      sentenceAuditResult.ungroundedCount > 3 ||
      claimVerification.findings.some((f) => f.severity === 'BLOCKER' && f.state !== 'PASS');

    const outputHash = createHash('sha256').update(draft).digest('hex');
    const registerFindings = this.legalRegister.evaluate({
      draft,
      kind: input.kind,
      caseDetails: input.caseDetails,
      countryCode,
      offenceDate: input.offenceDate,
      recommendedKind: input.recommendedKind ?? input.kind,
    });
    const fidelityFindings = this.factFidelity.evaluate({
      draft,
      caseDetails: input.caseDetails,
      kind: input.kind,
    });
    const brief =
      input.caseBrief ?? this.caseBriefService.extract(input.caseDetails, input.kind);
    const timelineFindings = this.timelineValidator.evaluate({
      draft,
      caseDetails: input.caseDetails,
      kind: input.kind,
      brief,
    });
    const coverageResult = this.factCoverage.evaluate({
      draft,
      brief,
      kind: input.kind,
      filingGrade: input.filingGrade !== false,
    });
    for (const f of [
      ...registerFindings,
      ...fidelityFindings,
      ...timelineFindings,
      ...coverageResult.findings,
    ]) {
      if (f.severity === 'BLOCKER' || f.severity === 'HIGH') {
        citationWarnings.push(`${f.checkId}: ${f.explanation}`);
      }
    }

    const gateBlockers = [
      ...registerFindings,
      ...fidelityFindings,
      ...timelineFindings,
      ...coverageResult.findings,
    ].some((f) => f.severity === 'BLOCKER' && f.state !== 'PASS');

    const findings: VerificationFinding[] = [
      ...claimVerification.findings,
      ...registerFindings,
      ...fidelityFindings,
      ...timelineFindings,
      ...coverageResult.findings,
      ...this.findingsFromDraftChecks({
        citationUnverifiable: unified.citation.unverifiableCitations,
        stripped: stripResult.stripped.map((s) => s.original),
        warnings: citationWarnings,
        sentenceUngroundedCount: sentenceAuditResult.ungroundedCount,
        verificationUnavailable: unified.verificationUnavailable === true,
      }),
    ];

    const auditBase = {
      corrections,
      similarCases,
      sectionChecks: sectionResult.audit,
      citationWarnings,
      strippedCitations: stripResult.stripped,
      citationAudit,
      sentenceAudit: {
        coverageRate: sentenceAuditResult.coverageRate,
        ungroundedCount: sentenceAuditResult.ungroundedCount,
      },
      proceduralWarnings: input.proceduralWarnings ?? [],
      completenessGaps: input.completenessGaps ?? [],
      requiresLawyerReview: requiresLawyerReview || gateBlockers,
      findings,
      propositions: claimVerification.propositions,
      evidencePackId: evidencePack.evidencePackId,
      outputHash,
      dimensions: summarizeFindings(findings),
      publicationState: resolvePublicationState(findings),
      factCoverageRate: coverageResult.coverageRate,
      missingDefenceFacts: coverageResult.missing,
    };

    const audit: DraftVerificationAudit = {
      ...auditBase,
      verificationStatus: resolveVerificationStatus(auditBase),
    };

    return { draft, audit };
  }

  private extractMatterFacts(caseDetails: string): Array<{ factId: string; description: string }> {
    return caseDetails
      .split(/(?<=[.!?])\s+|\n+/)
      .map((fact) => fact.trim())
      .filter((fact) => fact.length > 12)
      .slice(0, 20)
      .map((description, index) => ({ factId: `fact_${index + 1}`, description }));
  }

  private findingsFromDraftChecks(input: {
    citationUnverifiable: string[];
    stripped: string[];
    warnings: string[];
    sentenceUngroundedCount: number;
    verificationUnavailable: boolean;
  }): VerificationFinding[] {
    const findings: VerificationFinding[] = [];
    for (const citation of input.citationUnverifiable) {
      findings.push({
        checkId: `citation:unverifiable:${citation}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'citation',
        evidenceIds: [],
        explanation: `Citation could not be resolved against the verification corpus: ${citation}`,
        repairAction: 'REMOVE',
        verifierVersion: 'draft-verification-v1',
      });
    }
    for (const citation of input.stripped) {
      findings.push({
        checkId: `citation:stripped:${citation}`,
        state: 'FAIL',
        severity: 'BLOCKER',
        dimension: 'citation',
        evidenceIds: [],
        explanation: `Citation was removed because it was not in verified authorities: ${citation}`,
        repairAction: 'REMOVE',
        verifierVersion: 'draft-verification-v1',
      });
    }
    if (input.sentenceUngroundedCount > 3) {
      findings.push({
        checkId: 'sentence:ungrounded',
        state: 'INDETERMINATE',
        severity: 'HIGH',
        dimension: 'passage',
        evidenceIds: [],
        explanation: `${input.sentenceUngroundedCount} sentences were not grounded in retrieved authorities.`,
        repairAction: 'QUALIFY',
        verifierVersion: 'draft-verification-v1',
      });
    }
    if (input.verificationUnavailable) {
      findings.push({
        checkId: 'draft:verification-unavailable',
        state: 'INDETERMINATE',
        severity: 'BLOCKER',
        dimension: 'system',
        evidenceIds: [],
        explanation: 'One or more draft verification checks were unavailable.',
        repairAction: 'ABSTAIN',
        verifierVersion: 'draft-verification-v1',
      });
    }
    if (findings.length === 0 && input.warnings.length === 0) {
      findings.push({
        checkId: 'draft:baseline',
        state: 'PASS',
        severity: 'LOW',
        dimension: 'system',
        evidenceIds: [],
        explanation: 'No deterministic draft verification blockers were detected.',
        verifierVersion: 'draft-verification-v1',
      });
    }
    return findings;
  }

  async addVerifiedCitations(input: AddVerifiedCitationsInput): Promise<AddVerifiedCitationsResult> {
    const countryCode = input.countryCode.toUpperCase();
    const retrievalQuery = [input.caseDetails, input.kind, input.selectedText].join(' ').trim();

    let authorities: RetrievedAuthority[] = [];
    try {
      const retrieval = await this.retrieval.retrieve({
        query: retrievalQuery,
        countryCode,
        jurisdiction: input.jurisdiction,
        tenantId: input.tenantId,
        userId: input.userId,
        limit: 12,
      });
      authorities = retrieval.authorities.filter(
        (a) => a.sourceTier === 'case_law' || (a.authorityType ?? '').toUpperCase() === 'CASE',
      );
    } catch (err) {
      this.logger.warn(`Verified citation retrieval failed: ${String(err)}`);
    }

    if (authorities.length === 0) {
      const emptyAudit: DraftVerificationAudit = {
        corrections: [],
        similarCases: [],
        sectionChecks: { entries: [], anyCorrections: false, anyUnconfirmedMismatches: false },
        citationWarnings: ['No verified case law retrieved — citations not added.'],
        strippedCitations: [],
        proceduralWarnings: [],
        completenessGaps: [],
        requiresLawyerReview: true,
        verificationStatus: 'limited_sources',
      };
      return {
        revisedText: input.selectedText,
        explanation: 'No verified authorities found in corpus. Passage unchanged.',
        audit: emptyAudit,
      };
    }

    const authorityBlock = authorities
      .slice(0, 8)
      .map(
        (a) =>
          `- ${a.title}${a.citation ? ` (${a.citation})` : ''}: ${(a.summary ?? '').slice(0, 300)}`,
      )
      .join('\n');

    const instruction =
      input.instruction === 'add_citations'
        ? 'Add supporting case law citations from VERIFIED AUTHORITIES only.'
        : 'Strengthen the argument using ONLY statutes and case law from VERIFIED AUTHORITIES.';

    const result = await this.llm.complete({
      modelName: DEFAULT_AUTO_MODEL,
      messages: [
        {
          role: 'system',
          content: `${LEGAL_ACCURACY_PROTOCOL}\n\nYou edit a legal draft passage. ${instruction} Do NOT invent citations.`,
        },
        {
          role: 'user',
          content: [
            `Document kind: ${input.kind}`,
            `Passage:\n"${input.selectedText}"`,
            '',
            'VERIFIED AUTHORITIES (cite ONLY from this list):',
            authorityBlock,
            '',
            'Return ONLY the revised passage. No explanation in the passage.',
          ].join('\n'),
        },
      ],
      maxTokens: 1200,
      temperature: 0.2,
    });

    const verified = await this.verify({
      draft: result.content.trim(),
      kind: input.kind,
      caseDetails: input.caseDetails,
      countryCode,
      jurisdiction: input.jurisdiction,
      tenantId: input.tenantId,
      userId: input.userId,
    });

    return {
      revisedText: verified.draft,
      explanation: this.buildVerificationExplanation(verified.audit),
      audit: verified.audit,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      modelName: result.modelName,
    };
  }

  buildVerificationExplanation(audit: DraftVerificationAudit): string {
    const parts: string[] = [];
    if (audit.corrections.length > 0) {
      parts.push(`Auto-corrected ${audit.corrections.length} statute reference(s).`);
    }
    if (audit.strippedCitations.length > 0) {
      parts.push(`Removed ${audit.strippedCitations.length} unverified citation(s).`);
    }
    if (audit.sectionChecks.anyCorrections) {
      parts.push('Section references adjusted via similar case consensus.');
    }
    if (audit.citationWarnings.length > 0) {
      parts.push(`${audit.citationWarnings.length} warning(s) — review before filing.`);
    }
    if (audit.similarCases.length > 0) {
      parts.push(`Cross-checked against ${audit.similarCases.length} similar case(s).`);
    }
    return parts.length > 0 ? parts.join(' ') : 'Draft reviewed against corpus.';
  }
}
