import { Injectable, Logger } from '@nestjs/common';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { TokenCreditChargeService } from '@/ai-credits/token-credit-charge.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { SimilarCasesService, isStatuteAuthority } from '@/ai/legal-research/similar-cases.service';
import { IkEvidenceIngestService } from '@/ai/legal-research/ik-evidence-ingest.service';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { AuthorityRetrievalPlannerService } from '@/ai/drafting/platform/authority-retrieval-planner.service';
import { AuthorityVerificationGateValidator } from '@/ai/drafting/platform/validators/authority-verification-gate.validator';
import type { CitationAppendixEntry } from '@/ai/drafting-v2/drafting-v2.types';
import type {
  AuthorityEnrichGateResult,
  AuthorityType,
  VerifiedAuthorityRecord,
  VerificationCheckStatus,
} from '@/ai/drafting/contracts/authority-verification';
import { getAuthorityRequirement } from '@/ai/drafting/draft-authority-requirements';
import { AUTHORITY_GATE_FAIL_LABEL } from '@/ai/drafting/contracts/authority-verification';
import { resolveCuratedEnrichBank } from './curated-enrich-banks';
import { AuthorityEnrichVerifier } from './authority-enrich-verifier';
import { DraftAuthorityVerificationService } from '../verification/draft-authority-verification.service';
import type { VerifiedSourceRegistry } from '../contracts/verified-source';
import { createHash } from 'crypto';

import { ResearchSectionFinderGroundingService } from '@/ai/legal-research/research-section-finder-grounding.service';
import type { SectionChecksAudit } from '@/ai/legal-research/similar-cases.types';
import type { SimilarCase } from '@/ai/legal-research/similar-cases.types';

export type DraftEnrichMode = 'case_laws' | 'sections' | 'both';

const MAX_DISPLAYED_AUTHORITIES = 4;

const ISSUE_IK_QUERY: Record<string, string> = {
  specific_performance:
    'specific performance readiness and willingness immovable property Supreme Court',
  readiness_and_willingness:
    'specific performance readiness and willingness Specific Relief Act Supreme Court',
  temporary_injunction:
    'temporary injunction Order 39 CPC alienation irreparable injury Supreme Court',
  permanent_injunction: 'permanent injunction immovable property Supreme Court',
  unregistered_agreement: 'unregistered agreement to sell sale deed Suraj Lamp Supreme Court',
  subsequent_transferee_notice:
    'subsequent transferee bona fide purchaser notice Transfer of Property Act Supreme Court',
  limitation: 'limitation specific performance agreement to sell Supreme Court',
  territorial_jurisdiction: 'territorial jurisdiction cause of action civil suit CPC Supreme Court',
  alternative_compensation: 'compensation in lieu of specific performance Specific Relief Act Supreme Court',
  costs: 'costs discretion civil suit CPC Supreme Court',
  bail: 'bail liberty Supreme Court BNSS',
};

export interface CaseLawArea {
  caseId: string;
  citation: string;
  title: string;
  areas: string[];
  proposition: string;
  treatmentStatus: 'good_law' | 'overruled' | 'distinguished' | 'superseded' | 'repealed' | 'unknown';
  court: string;
  decisionYear?: number;
  sourceUrl?: string;
  authorityType?: AuthorityType;
  identityStatus?: VerificationCheckStatus;
  relevanceStatus?: VerificationCheckStatus;
  citedInDraft?: boolean;
  excluded?: boolean;
  exclusionReason?: string;
  issue?: string;
}

export interface CaseLawEnrichInput {
  jobId: string;
  draftText: string;
  documentKind: string;
  rawFacts: string;
  tenantId: string;
  userId: string;
  jurisdiction?: string;
  countryCode?: string;
  mode?: DraftEnrichMode;
}

export interface CaseLawEnrichResult {
  enrichedDraft: string;
  citationAppendix: CitationAppendixEntry[];
  caseLawAreas: CaseLawArea[];
  creditsCharged: number;
  providerCostUsd: number;
  canExport: boolean;
  releaseGate: AuthorityEnrichGateResult;
  excludedAuthorities: CaseLawArea[];
  mode?: DraftEnrichMode;
  sectionsAdded?: string[];
  similarCases?: SimilarCase[];
  sectionChecks?: SectionChecksAudit | null;
}

@Injectable()
export class CaseLawEnrichService {
  private readonly logger = new Logger(CaseLawEnrichService.name);

  constructor(
    private readonly llm: LlmCompletionService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly tokenCreditCharge: TokenCreditChargeService,
    private readonly retrievalOrchestrator: LegalRetrievalOrchestrator,
    private readonly similarCasesService: SimilarCasesService,
    private readonly ikEvidenceIngest: IkEvidenceIngestService,
    private readonly planner: AuthorityRetrievalPlannerService,
    private readonly authorityGate: AuthorityVerificationGateValidator,
    private readonly verifier: AuthorityEnrichVerifier,
    private readonly authorityVerification: DraftAuthorityVerificationService,
    private readonly sectionFinderGrounding: ResearchSectionFinderGroundingService,
  ) {}

  async enrich(input: CaseLawEnrichInput): Promise<CaseLawEnrichResult> {
    const mode: DraftEnrichMode = input.mode ?? 'case_laws';
    const wantCases = mode === 'case_laws' || mode === 'both';
    const wantSections = mode === 'sections' || mode === 'both';
    const countryCode = (input.countryCode ?? input.jurisdiction?.split('-')[0] ?? 'IN')
      .slice(0, 2)
      .toUpperCase();

    const { documentKind, rawFacts, draftText, tenantId, userId, jobId } = input;
    const plan = this.planner.buildPlan({
      documentKind,
      jurisdiction: input.jurisdiction ?? countryCode,
      rawFacts,
    });

    const propositions = this.verifier.extractPropositions(draftText, documentKind, plan);
    const curated = wantCases ? resolveCuratedEnrichBank(documentKind, rawFacts) : [];
    const curatedRecords = wantCases
      ? this.verifier.verifyCurated(curated, propositions, draftText, plan)
      : [];

    let retrievedRecords: VerifiedAuthorityRecord[] = [];
    if (wantCases) {
      try {
        retrievedRecords = await this.retrieveAndVerify(
          propositions,
          plan,
          draftText,
          tenantId,
          userId,
          countryCode,
        );
      } catch (err) {
        this.logger.warn(
          `Draft case-law retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    let sectionBlock = '';
    const sectionsAdded: string[] = [];
    if (wantSections && (countryCode === 'IN' || countryCode === 'KE')) {
      try {
        const sf = await this.sectionFinderGrounding.buildContext(
          [rawFacts, documentKind].filter(Boolean).join(' ').slice(0, 500),
          undefined,
          countryCode,
        );
        sectionBlock = sf.promptBlock;
        sectionsAdded.push(...sf.verifiedSectionLabels);
      } catch (err) {
        this.logger.warn(
          `Draft section enrich failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Curated-first: prefer verified curated, then fill with retrieved to max 4
    const curatedPassed = curatedRecords.filter((r) => !r.excluded);
    const retrievedPassed = retrievedRecords.filter((r) => !r.excluded);
    const selected = this.selectAuthorities(curatedPassed, retrievedPassed, MAX_DISPLAYED_AUTHORITIES);
    const excluded = [
      ...curatedRecords.filter((r) => r.excluded),
      ...retrievedRecords.filter((r) => r.excluded),
      ...this.dedupeRecords([...curatedPassed, ...retrievedPassed]).filter(
        (r) => !selected.some((s) => s.id === r.id),
      ).map((r) => ({
        ...r,
        excluded: true,
        exclusionReason: r.exclusionReason ?? 'Not selected for enrich bank (cap 4)',
      })),
    ];

    const minCases = getAuthorityRequirement(documentKind).minVerifiedCases;
    const caseCount = selected.filter((r) => r.authorityType === 'case').length;
    const belowMinimum =
      wantCases && caseCount < Math.min(minCases, MAX_DISPLAYED_AUTHORITIES);

    const caseLawAreas = selected.map((r) => this.recordToArea(r));
    const excludedAuthorities = excluded.map((r) => this.recordToArea(r));

    if (caseLawAreas.length === 0 && !sectionBlock.trim()) {
      return {
        enrichedDraft: draftText,
        citationAppendix: [],
        caseLawAreas: [],
        creditsCharged: 0,
        providerCostUsd: 0,
        canExport: false,
        releaseGate: {
          canExport: false,
          status: 'fail',
          userLabel: AUTHORITY_GATE_FAIL_LABEL,
          blockers: [AUTHORITY_GATE_FAIL_LABEL],
          verifiedCount: 0,
          excludedCount: excludedAuthorities.length,
        },
        excludedAuthorities,
        mode,
        sectionsAdded,
      };
    }

    const { enrichedDraft, creditsCharged, providerCostUsd } = await this.runEnrichLlm({
      draftText,
      documentKind,
      rawFacts,
      caseLawAreas,
      sectionBlock,
      mode,
      countryCode,
      tenantId,
      userId,
      jobId,
    });

    const finalPassed = selected.map((r) => ({
      ...r,
      citedInDraft: this.verifier.isCitedInDraft(enrichedDraft, r),
    }));
    const finalGate = this.authorityGate.evaluateEnrich([...finalPassed, ...excluded]);

    const citationAppendix = finalPassed
      .filter(
        (r) =>
          r.citedInDraft &&
          r.identityStatus !== 'fail' &&
          r.relevanceStatus === 'pass' &&
          !r.authorityTypeMisclassified,
      )
      .map((r, i) => this.recordToAppendix(r, i));

    let verifiedAppendix = citationAppendix;
    let sharedGateCanExport = true;
    if (this.authorityVerification.isEnabled()) {
      try {
        const registry = this.buildRegistryFromRecords(jobId, finalPassed);
        const verified = await this.authorityVerification.verify({
          draftText: enrichedDraft,
          documentKind,
          jurisdiction: input.jurisdiction ?? 'IN',
          rawFacts,
          sourceRegistry: registry,
          tenantId,
          userId,
        });
        if (verified.citationAppendix.length > 0) {
          verifiedAppendix = verified.citationAppendix as CitationAppendixEntry[];
        }
        sharedGateCanExport = verified.gate.canExport;
      } catch (err) {
        this.logger.warn(
          `Shared authority verifier failed on enrich: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const toaSafe =
      finalGate.canExport &&
      sharedGateCanExport &&
      !belowMinimum &&
      verifiedAppendix.length > 0 &&
      finalPassed.every((r) => r.citedInDraft && r.relevanceStatus === 'pass');

    return {
      enrichedDraft,
      citationAppendix: verifiedAppendix,
      caseLawAreas: finalPassed.map((r) => this.recordToArea(r)),
      creditsCharged,
      providerCostUsd,
      canExport: toaSafe,
      releaseGate: {
        ...finalGate,
        canExport: toaSafe,
        status: toaSafe ? 'pass' : 'fail',
        userLabel: toaSafe
          ? 'Authorities verified for draft propositions'
          : belowMinimum
            ? `Authority verification failed — fewer than ${minCases} verified case authorities. Exclude noise and rerun proposition-based retrieval.`
            : finalGate.userLabel,
        blockers: [
          ...finalGate.blockers,
          ...(belowMinimum
            ? [`Need at least ${minCases} verified case authorities; found ${caseCount}`]
            : []),
        ],
      },
      excludedAuthorities: excluded.map((r) => this.recordToArea(r)),
      mode,
      sectionsAdded,
    };
  }

  /** Prefer curated, then fill remaining slots from retrieved (max cap). */
  private selectAuthorities(
    curatedPassed: VerifiedAuthorityRecord[],
    retrievedPassed: VerifiedAuthorityRecord[],
    cap: number,
  ): VerifiedAuthorityRecord[] {
    const out: VerifiedAuthorityRecord[] = [];
    const seen = new Set<string>();
    for (const r of curatedPassed) {
      const key = `${r.citation}|${r.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= cap) return out;
    }
    for (const r of retrievedPassed) {
      const key = `${r.citation}|${r.title}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
      if (out.length >= cap) break;
    }
    return out;
  }

  private buildIssueQueries(
    propositions: ReturnType<AuthorityEnrichVerifier['extractPropositions']>,
    plan: ReturnType<AuthorityRetrievalPlannerService['buildPlan']>,
  ): Array<{ issue: string; query: string }> {
    const issues = [
      ...new Set([
        ...propositions.map((p) => p.issue),
        ...plan.legalIssues.slice(0, 4),
      ]),
    ].slice(0, 4);

    return issues.map((issue) => ({
      issue,
      query:
        ISSUE_IK_QUERY[issue] ??
        `${issue.replace(/_/g, ' ')} Supreme Court India civil`.slice(0, 240),
    }));
  }

  private async retrieveAndVerify(
    propositions: ReturnType<AuthorityEnrichVerifier['extractPropositions']>,
    plan: ReturnType<AuthorityRetrievalPlannerService['buildPlan']>,
    draftText: string,
    tenantId: string,
    userId: string,
    countryCode = 'IN',
  ): Promise<VerifiedAuthorityRecord[]> {
    const records: VerifiedAuthorityRecord[] = [];
    const issueQueries = this.buildIssueQueries(propositions, plan);
    const isCivilEnrich =
      /civil_plaint|specific_performance|civil_suit|injunction|property/i.test(plan.documentKind);

    for (const { issue, query } of issueQueries) {
      const prop =
        propositions.find((p) => p.issue === issue) ??
        ({
          proposition: `The draft raises the legal issue of ${issue.replace(/_/g, ' ')}.`,
          issue,
          documentKind: plan.documentKind,
          preferredAuthorityType: 'case' as const,
        });
      try {
        const retrieval = await this.retrievalOrchestrator.retrieve({
          query,
          countryCode,
          jurisdiction: plan.jurisdiction,
          knowledgeSources: ['case_law'],
          researchMode: 'DEEP',
          limit: 6,
          tenantId,
          userId,
        });
        let authorities = retrieval.authorities.filter((a) => !isStatuteAuthority(a));
        try {
          const ik = await this.ikEvidenceIngest.retrieveAndIngest({
            query,
            limitPerQuery: 3,
            existingAuthorities: authorities,
            skipProceduralQuery: isCivilEnrich,
            practiceArea: issue.replace(/_/g, ' '),
            jurisdiction: plan.jurisdiction,
          });
          if (ik.authorities.length > 0) {
            const merged = new Map(authorities.map((a) => [a.id, a]));
            for (const a of ik.authorities) {
              if (!isStatuteAuthority(a)) merged.set(a.id, a);
            }
            authorities = [...merged.values()];
          }
        } catch (err) {
          this.logger.warn(
            `IK draft enrich failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        const similar = this.similarCasesService.extractAndRank(
          authorities,
          query,
          countryCode,
          4,
        );

        for (const [index, c] of similar.entries()) {
          records.push(
            this.verifier.verifyRetrievedCandidate(
              {
                id: c.authorityId || `retrieved_${index}`,
                title: c.title,
                citation: (c.citation ?? '').trim() || c.title,
                summary: c.summary ?? '',
                court: c.court ?? c.sourceName ?? 'Court',
                year: c.year,
                sourceUrl: c.sourceUrl,
                areas: (c.relevantSections ?? []).map((s) =>
                  s.replace(/\s+/g, '_').toLowerCase(),
                ),
              },
              prop,
              draftText,
              plan,
              false,
            ),
          );
        }
      } catch (err) {
        this.logger.warn(
          `Per-issue retrieval failed (${issue}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return records;
  }

  private dedupeRecords(records: VerifiedAuthorityRecord[]): VerifiedAuthorityRecord[] {
    const byKey = new Map<string, VerifiedAuthorityRecord>();
    for (const r of records) {
      const key = `${r.citation}|${r.title}`.toLowerCase();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, r);
        continue;
      }
      if (existing.excluded && !r.excluded) byKey.set(key, r);
      else if (existing.relevanceStatus !== 'pass' && r.relevanceStatus === 'pass') {
        byKey.set(key, r);
      }
    }
    return [...byKey.values()].slice(0, 16);
  }

  private recordToArea(r: VerifiedAuthorityRecord): CaseLawArea {
    const treatment: CaseLawArea['treatmentStatus'] =
      r.excluded || r.relevanceStatus !== 'pass' || r.identityStatus === 'fail'
        ? 'unknown'
        : r.currentLawStatus === 'good_law'
          ? 'good_law'
          : r.currentLawStatus === 'overruled'
            ? 'overruled'
            : r.currentLawStatus === 'repealed'
              ? 'repealed'
              : 'unknown';
    return {
      caseId: r.id,
      citation: r.citation,
      title: r.title,
      areas: r.areas ?? [r.issue],
      proposition: r.holding ?? r.proposition,
      treatmentStatus: treatment,
      court: r.court ?? (r.authorityType === 'case' ? 'Court' : 'Legislation'),
      decisionYear: r.decisionYear,
      sourceUrl: r.sourceUrl,
      authorityType: r.authorityType,
      identityStatus: r.identityStatus,
      relevanceStatus: r.relevanceStatus,
      citedInDraft: r.citedInDraft,
      excluded: r.excluded,
      exclusionReason: r.exclusionReason,
      issue: r.issue,
    };
  }

  private buildRegistryFromRecords(
    jobId: string,
    records: VerifiedAuthorityRecord[],
  ): VerifiedSourceRegistry {
    return {
      jobId,
      builtAt: new Date().toISOString(),
      sources: records.map((r) => {
        const text = r.holding ?? r.proposition ?? '';
        return {
          id: r.id,
          type: r.authorityType === 'case' ? ('case' as const) : ('statute' as const),
          jurisdiction: 'IN',
          title: r.title,
          citation: r.citation,
          court: r.court,
          text,
          proposition: r.proposition,
          verificationStatus: 'verified' as const,
          contentHash: createHash('sha256').update(text).digest('hex'),
        };
      }),
    };
  }

  private recordToAppendix(r: VerifiedAuthorityRecord, i: number): CitationAppendixEntry {
    const type: CitationAppendixEntry['type'] =
      r.authorityType === 'case' ? 'case_law' : 'statute';
    return {
      sectionId: `enrich_${i}`,
      sectionTitle: r.issue.replace(/_/g, ' ') || r.proposition.slice(0, 80),
      paragraphIndex: 0,
      type,
      citation: `${r.title} — ${r.citation}`,
      verified: r.identityStatus === 'pass' && r.relevanceStatus === 'pass',
      court: r.court,
      decisionYear: r.decisionYear,
      treatmentStatus:
        r.currentLawStatus === 'good_law' && r.relevanceStatus === 'pass'
          ? 'good_law'
          : undefined,
      holding: r.holding ?? r.proposition,
      identityStatus: r.identityStatus,
      relevanceStatus: r.relevanceStatus,
      authorityType: r.authorityType,
      citedInDraft: r.citedInDraft,
      excluded: r.excluded,
      exclusionReason: r.exclusionReason,
      sourceUrl: r.sourceUrl,
    };
  }

  private async runEnrichLlm(input: {
    draftText: string;
    documentKind: string;
    rawFacts: string;
    caseLawAreas: CaseLawArea[];
    sectionBlock?: string;
    mode?: DraftEnrichMode;
    countryCode?: string;
    tenantId: string;
    userId: string;
    jobId: string;
  }): Promise<{ enrichedDraft: string; creditsCharged: number; providerCostUsd: number }> {
    const {
      draftText,
      documentKind,
      rawFacts,
      caseLawAreas,
      sectionBlock = '',
      mode = 'case_laws',
      countryCode = 'IN',
      tenantId,
      userId,
      jobId,
    } = input;
    const bankBlock = caseLawAreas
      .map(
        (c, i) =>
          `[CASE_${i + 1}] ${c.title} — ${c.citation}\nSupports proposition (${c.issue ?? 'issue'}): ${c.proposition}`,
      )
      .join('\n\n');

    const jurisdictionLabel = countryCode === 'US' ? 'US' : 'Indian';
    const enrichTargets: string[] = [];
    if (mode !== 'sections' && bankBlock) enrichTargets.push('verified case law citations');
    if (mode !== 'case_laws' && sectionBlock.trim()) enrichTargets.push('verified statute sections');

    const systemPrompt = [
      `You are an expert ${jurisdictionLabel} legal drafter.`,
      `Enrich the draft by inserting ${enrichTargets.join(' and ') || 'verified legal authorities'} where they support legal propositions.`,
      '',
      'Rules:',
      '- Only use authorities from the ALLOWED blocks below. Do not invent citations.',
      '- Insert citations where they directly support the legal proposition.',
      '- Reference cases by their ID (e.g. [CASE_1]) followed by the citation when provided.',
      '- Do not alter the facts, parties, or overall structure of the draft.',
      countryCode === 'IN'
        ? '- Prefer current Indian codes (BNS/BNSS/BSA) framing where the draft already uses them.'
        : countryCode === 'KE'
          ? '- Prefer Kenya Law Cap / Act section numbers and eKLR / KESC / KECA / KEHC citations.'
          : '- Use standard Bluebook citation format for US authorities.',
      '- Output the complete enriched draft text only. No preamble, no JSON, no commentary.',
    ].join('\n');

    const userParts = [
      `DOCUMENT TYPE: ${documentKind}`,
      `CASE FACTS SUMMARY: ${rawFacts.slice(0, 800)}`,
    ];
    if (bankBlock) {
      userParts.push('', 'ALLOWED CASES:', bankBlock);
    }
    if (sectionBlock.trim()) {
      userParts.push('', 'ALLOWED STATUTE SECTIONS:', sectionBlock);
    }
    userParts.push('', 'DRAFT TO ENRICH:', draftText);
    const userPrompt = userParts.join('\n');

    const modelName = 'gpt-5.6-luna';
    let enrichedDraft = draftText;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const result = await this.llm.complete({
        modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      });
      enrichedDraft = result.content?.trim() || draftText;
      inputTokens = result.inputTokens ?? 0;
      outputTokens = result.outputTokens ?? 0;
    } catch (err) {
      this.logger.warn(
        `Case-law enrichment LLM call failed: ${String(err)} — returning unenriched draft`,
      );
    }

    const taskType = AI_TASK_TYPES.DRAFT_CASE_LAW_ENRICH;
    const charge = await this.tokenCreditCharge.computeCreditsForUsage({
      provider: 'openai',
      modelName,
      inputTokens,
      outputTokens,
      taskType,
      minCredits: getCreditCost(taskType),
      tenantId,
      userId,
    });

    if (charge.credits > 0) {
      await this.creditLedger.assertAndDebit({
        userId,
        tenantId,
        taskType,
        credits: charge.credits,
        metadata: {
          jobId,
          documentKind,
          providerCostUsd: charge.providerCostUsd,
          netMarginPercent: charge.netMarginPercent,
          inputTokens,
          outputTokens,
          casesUsed: caseLawAreas.length,
          chargeMode: this.tokenCreditCharge.isTokenBased() ? 'token_based' : 'flat',
        },
      });
    }

    return {
      enrichedDraft,
      creditsCharged: charge.credits,
      providerCostUsd: charge.providerCostUsd,
    };
  }
}
