import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { LlmCompletionService } from '@/ai/llm-completion.service';
import type { ResearchRefineAuthorityDto } from '@/ai/dto/research-refine.dto';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { TokenCreditChargeService } from '@/ai-credits/token-credit-charge.service';
import { AI_TASK_TYPES } from '@/ai-credits/task-types';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import { LegalResearchVerificationService } from '@/legal-search/legal-research-verification.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import { resolveSourceTier } from '@/legal-search/source-tier.util';
import { PrismaService } from '@/prisma/prisma.service';
import type {
  PublicationState,
  VerificationDimensions,
  VerificationFinding,
  VerifiedPropositionSummary,
} from '@/ai/verification/verification-finding.types';
import { SimilarCasesService } from './similar-cases.service';
import { ResearchSectionFinderGroundingService } from './research-section-finder-grounding.service';
import { IkEvidenceIngestService } from './ik-evidence-ingest.service';
import { KeEvidenceIngestService } from './ke-evidence-ingest.service';
import { LegalEvidencePackService } from './legal-evidence-pack.service';
import type { LegalResearchDraft } from './legal-research-draft.types';
import { StructuredResearchSynthesisService } from './structured-research-synthesis.service';
import type { SimilarCase, SectionChecksAudit } from './similar-cases.types';
import type { ResearchTaskKind } from './research-planning.types';

export type ResearchEnrichMode = 'case_laws' | 'sections' | 'both';

export interface ResearchEnrichInput {
  outputId: string;
  mode: ResearchEnrichMode;
  tenantId: string;
  userId: string;
  /** Optional override when AIOutput has no inputQuery. */
  query?: string;
  countryCode?: string;
  jurisdiction?: string;
}

export interface EnsureResearchOutputInput {
  userId: string;
  tenantId: string;
  query: string;
  answer: string;
  countryCode?: string;
  jurisdiction?: string;
  citations?: unknown;
  similarCases?: SimilarCase[];
  sectionChecks?: SectionChecksAudit | null;
  aiOutputId?: string;
}

export interface ResearchEnrichResult {
  aiOutputId: string;
  answer: string;
  similarCases: SimilarCase[];
  sectionChecks: SectionChecksAudit | null;
  creditsCharged: number;
  providerCostUsd: number;
  mode: ResearchEnrichMode;
  sectionsAdded: string[];
  casesAdded: number;
  /** Updated citation list for Sources / provenance panel. */
  citations?: Array<Record<string, unknown>>;
  findings?: VerificationFinding[];
  propositions?: VerifiedPropositionSummary[];
  dimensions?: VerificationDimensions;
  publicationState?: PublicationState;
  outputHash?: string;
  requiresLawyerReview?: boolean;
  /** Set when enrich could not retrieve requested authorities. */
  warning?: string;
}

export interface ResearchRefineInput {
  outputId: string;
  tenantId: string;
  userId: string;
  pinnedAuthorityIds: string[];
  excludedAuthorityIds: string[];
  addedAuthorities: ResearchRefineAuthorityDto[];
  addedContext: string;
  query?: string;
  countryCode?: string;
  jurisdiction?: string;
  requestedTaskKind?: ResearchTaskKind;
  desiredOutput?: 'ANSWER' | 'AUTHORITY_LIST' | 'ANALYSIS' | 'MEMO' | 'VERIFICATION';
}

export interface ResearchAuthoritySearchInput {
  tenantId: string;
  userId: string;
  query: string;
  countryCode?: string;
  jurisdiction?: string;
  limit?: number;
}

export interface ResearchAuthoritySearchItem {
  id: string;
  authorityId: string;
  title: string;
  citation: string | null;
  sourceName: string;
  sourceUrl: string | null;
  summary: string | null;
  excerpt?: string;
  sourceTier: RetrievedAuthority['sourceTier'];
  relevanceScore: number;
  relevanceReason: string;
}

export interface ResearchRefineResult {
  outputMarkdown: string;
  citations: Array<Record<string, unknown>>;
  mode: 'REFINE';
  provider: 'structured-research';
  modelName: string;
  countryCode: string;
  jurisdiction?: string;
  creditsUsed: number;
  providerCostUsd: number;
  verificationStatus: string;
  sourceTierSummary?: string;
  corpusEdition?: string;
  requiresLawyerReview: boolean;
  sentenceAudit: Array<{ sentence: string; status: string; authorityTitle?: string }>;
  findings: VerificationFinding[];
  propositions: VerifiedPropositionSummary[];
  dimensions: VerificationDimensions;
  publicationState: PublicationState;
  outputHash: string;
  researchMode: 'REFINE';
  structuredDraft: LegalResearchDraft;
  structuredMemo: LegalResearchDraft;
  similarCases: SimilarCase[];
  sectionChecks: SectionChecksAudit | null;
  aiOutputId: string;
  pinnedAuthorityIds: string[];
  excludedAuthorityIds: string[];
}

function resolveTaskType(mode: ResearchEnrichMode): string {
  if (mode === 'case_laws') return AI_TASK_TYPES.RESEARCH_CASE_LAW_ENRICH;
  if (mode === 'sections') return AI_TASK_TYPES.RESEARCH_SECTION_ENRICH;
  return AI_TASK_TYPES.RESEARCH_ENRICH_BOTH;
}

@Injectable()
export class ResearchEnrichService {
  private readonly logger = new Logger(ResearchEnrichService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmCompletionService,
    private readonly creditLedger: AICreditLedgerService,
    private readonly tokenCreditCharge: TokenCreditChargeService,
    private readonly retrievalOrchestrator: LegalRetrievalOrchestrator,
    private readonly similarCasesService: SimilarCasesService,
    private readonly sectionFinderGrounding: ResearchSectionFinderGroundingService,
    private readonly ikEvidenceIngest: IkEvidenceIngestService,
    private readonly keEvidenceIngest: KeEvidenceIngestService,
    private readonly researchVerification: LegalResearchVerificationService,
    private readonly evidencePackService: LegalEvidencePackService,
    private readonly structuredSynthesis: StructuredResearchSynthesisService,
  ) {}

  /**
   * Ensure a persisted AIOutput exists so Enrich/Save work for cached or
   * in-memory research results that never received an aiOutputId.
   */
  async ensureOutput(input: EnsureResearchOutputInput): Promise<{ aiOutputId: string }> {
    const answer = input.answer?.trim();
    if (!answer) {
      throw new NotFoundException('Research answer is required to enrich');
    }

    if (input.aiOutputId) {
      const existing = await this.prisma.aIOutput.findFirst({
        where: {
          id: input.aiOutputId,
          tenantId: input.tenantId,
          taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        },
        select: { id: true },
      });
      if (existing) return { aiOutputId: existing.id };
    }

    const query = input.query.trim() || 'legal research';
    const byQuery = await this.prisma.aIOutput.findFirst({
      where: {
        userId: input.userId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        inputQuery: query,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (byQuery) {
      await this.prisma.aIOutput.update({
        where: { id: byQuery.id },
        data: {
          outputMarkdown: answer,
          citations: {
            items: Array.isArray(input.citations) ? input.citations : [],
            similarCases: input.similarCases?.slice(0, 10) ?? [],
            sectionChecks: input.sectionChecks ?? null,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return { aiOutputId: byQuery.id };
    }

    const created = await this.prisma.aIOutput.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        mode: 'AUTO',
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
        inputQuery: query,
        outputMarkdown: answer,
        citations: {
          items: Array.isArray(input.citations) ? input.citations : [],
          similarCases: input.similarCases?.slice(0, 10) ?? [],
          sectionChecks: input.sectionChecks ?? null,
        } as unknown as Prisma.InputJsonValue,
        jurisdiction: input.jurisdiction ?? input.countryCode ?? undefined,
        requiresLawyerReview: true,
      },
    });
    return { aiOutputId: created.id };
  }

  async searchAuthorities(
    input: ResearchAuthoritySearchInput,
  ): Promise<{ authorities: ResearchAuthoritySearchItem[] }> {
    const query = input.query.trim();
    if (query.length < 2) {
      throw new BadRequestException('Authority search query is required');
    }
    const countryCode = (input.countryCode?.trim() || 'IN').toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new BadRequestException('countryCode must be a two-letter ISO country code');
    }
    const limit = Math.min(8, Math.max(1, input.limit ?? 8));
    const retrieval = await this.retrievalOrchestrator.retrieve({
      query,
      countryCode,
      jurisdiction: input.jurisdiction?.trim() || undefined,
      tenantId: input.tenantId,
      userId: input.userId,
      knowledgeSources: ['case_law', 'statutes'],
      researchMode: 'FAST',
      limit: Math.max(limit, 8),
      supplementLive: true,
      skipTavilyInFast: true,
    });

    const candidates = new Map<string, RetrievedAuthority>();
    for (const authority of retrieval.authorities ?? []) {
      candidates.set(authority.id, authority);
    }
    let admitted = this.admitAuthoritySearchCandidates([...candidates.values()], query);

    const hasIkEvidence = admitted.some((authority) => authority.id.startsWith('ik-'));
    if (countryCode === 'IN' && !hasIkEvidence && admitted.length < limit) {
      try {
        const ik = await this.ikEvidenceIngest.retrieveAndIngest({
          query,
          jurisdiction: input.jurisdiction?.trim() || undefined,
          limitPerQuery: Math.min(4, limit),
          maxQueries: 2,
          existingAuthorities: [...candidates.values()],
          skipProceduralQuery: true,
        });
        for (const authority of ik.authorities) {
          candidates.set(authority.id, authority);
        }
        admitted = this.admitAuthoritySearchCandidates([...candidates.values()], query);
      } catch (err) {
        this.logger.warn(
          `[authority-search] IK supplement failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const hasKeEvidence = admitted.some(
      (authority) =>
        authority.sourceName?.toLowerCase().includes('kenya law') ||
        authority.id.startsWith('ke-') ||
        authority.id.startsWith('judgment-'),
    );
    if (countryCode === 'KE' && !hasKeEvidence && admitted.length < limit) {
      try {
        const ke = await this.keEvidenceIngest.retrieveAndIngest({
          query,
          jurisdiction: input.jurisdiction?.trim() || undefined,
          limitPerQuery: Math.min(4, limit),
          maxQueries: 2,
          existingAuthorities: [...candidates.values()],
        });
        for (const authority of ke.authorities) {
          candidates.set(authority.id, authority);
        }
        admitted = this.admitAuthoritySearchCandidates([...candidates.values()], query);
      } catch (err) {
        this.logger.warn(
          `[authority-search] KE supplement failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const deduped = new Map<string, RetrievedAuthority>();
    for (const authority of admitted) {
      const identity = this.authoritySearchIdentity(authority);
      const existing = deduped.get(identity);
      if (
        !existing ||
        (authority.relevanceScore ?? authority.score ?? 0) >
          (existing.relevanceScore ?? existing.score ?? 0)
      ) {
        deduped.set(identity, authority);
      }
    }
    const authorities = [...deduped.values()]
      .sort(
        (a, b) =>
          (b.relevanceScore ?? b.score ?? 0) -
          (a.relevanceScore ?? a.score ?? 0),
      )
      .slice(0, limit)
      .map((authority): ResearchAuthoritySearchItem => {
        const summary = authority.summary?.trim().slice(0, 3_000) || null;
        const excerpt = summary
          ? undefined
          : authority.fullText?.trim().slice(0, 3_000) || undefined;
        return {
          id: authority.id,
          authorityId: authority.id,
          title: authority.title,
          citation: authority.citation,
          sourceName: authority.sourceName,
          sourceUrl: authority.sourceUrl ?? null,
          summary,
          excerpt,
          sourceTier: authority.sourceTier,
          relevanceScore: authority.relevanceScore ?? authority.score ?? 0,
          relevanceReason:
            authority.relevanceReason ?? 'admitted by authority relevance gate',
        };
      });

    return { authorities };
  }

  async enrich(input: ResearchEnrichInput): Promise<ResearchEnrichResult> {
    const existing = await this.prisma.aIOutput.findFirst({
      where: {
        id: input.outputId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
      },
    });
    if (!existing) {
      throw new NotFoundException('Research output not found');
    }

    const query =
      input.query?.trim() ||
      existing.inputQuery?.trim() ||
      'legal research enrichment';
    const countryCode = (input.countryCode || existing.jurisdiction || 'IN')
      .slice(0, 2)
      .toUpperCase();
    const jurisdiction = input.jurisdiction ?? existing.jurisdiction ?? undefined;
    const memo = existing.outputMarkdown;
    const priorCitations = this.asRecord(existing.citations);
    const priorItems = Array.isArray(priorCitations.items)
      ? (priorCitations.items as Array<Record<string, unknown>>)
      : [];
    const priorSimilarCases = Array.isArray(priorCitations.similarCases)
      ? (priorCitations.similarCases as SimilarCase[])
      : [];
    const priorAuthorityIds = new Set(
      [
        ...priorItems.map((item) =>
          this.stringValue(item.authorityId) || this.stringValue(item.id),
        ),
        ...priorSimilarCases.map((item) => item.authorityId),
      ].filter((id): id is string => Boolean(id)),
    );
    const priorCaseIdentities = new Set(
      priorSimilarCases.map((item) => this.similarCaseIdentity(item)),
    );
    const priorSectionLabels = new Set(
      [
        ...(Array.isArray(priorCitations.sectionsAdded)
          ? (priorCitations.sectionsAdded as string[])
          : []),
        ...(((priorCitations.sectionChecks as SectionChecksAudit | undefined)?.entries ?? [])
          .flatMap((entry) => [
            entry.originalSection,
            ...entry.confirmedSections,
            ...entry.caseSuggestedSections,
          ])),
      ].map((value) => this.normalizedEvidenceIdentity(value)),
    );

    const wantCases = input.mode === 'case_laws' || input.mode === 'both';
    const wantSections = input.mode === 'sections' || input.mode === 'both';

    let caseBlock = '';
    let sectionBlock = '';
    let similarCases: SimilarCase[] = [];
    let authorities: RetrievedAuthority[] = [];
    const sectionsAdded: string[] = [];

    if (wantCases) {
      try {
        const retrieval = await this.retrievalOrchestrator.retrieve({
          query,
          countryCode,
          jurisdiction,
          knowledgeSources: ['case_law'],
          researchMode: 'DEEP',
          limit: 16,
          tenantId: input.tenantId,
          userId: input.userId,
          supplementLive: true,
        });
        authorities = retrieval.authorities ?? [];
        authorities = authorities.filter(
          (authority) => !priorAuthorityIds.has(authority.id),
        );

        if (authorities.length < 4) {
          const broadened = await this.retrievalOrchestrator.retrieve({
            query: `${query} case law judgment precedent`,
            countryCode,
            jurisdiction,
            knowledgeSources: ['case_law', 'web'],
            researchMode: 'DEEP',
            limit: 16,
            tenantId: input.tenantId,
            userId: input.userId,
            supplementLive: true,
          });
          const merged = new Map(authorities.map((a) => [a.id, a]));
          for (const a of broadened.authorities ?? []) {
            if (!priorAuthorityIds.has(a.id)) merged.set(a.id, a);
          }
          authorities = [...merged.values()];
        }

        if (countryCode === 'IN') {
          try {
            const ik = await this.ikEvidenceIngest.retrieveAndIngest({
              query,
              jurisdiction,
              limitPerQuery: 4,
              existingAuthorities: authorities,
            });
            this.logger.log(
              `[enrich] IK authorities=${ik.authorities.length} for query="${query.slice(0, 80)}"`,
            );
            if (ik.authorities.length > 0) {
              const merged = new Map(authorities.map((a) => [a.id, a]));
              for (const a of ik.authorities) {
                if (!priorAuthorityIds.has(a.id)) merged.set(a.id, a);
              }
              authorities = [...merged.values()];
            }
          } catch (err) {
            this.logger.warn(
              `IK enrich pass failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        if (countryCode === 'KE') {
          try {
            const ke = await this.keEvidenceIngest.retrieveAndIngest({
              query,
              jurisdiction,
              limitPerQuery: 4,
              maxQueries: 4,
              existingAuthorities: authorities,
            });
            this.logger.log(
              `[enrich] KE authorities=${ke.authorities.length} admitted status=${ke.searchStatus} for query="${query.slice(0, 80)}"`,
            );
            if (ke.authorities.length > 0) {
              const merged = new Map(authorities.map((a) => [a.id, a]));
              for (const a of ke.authorities) {
                if (!priorAuthorityIds.has(a.id)) merged.set(a.id, a);
              }
              authorities = [...merged.values()];
            }
          } catch (err) {
            this.logger.warn(
              `KE enrich pass failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        similarCases = this.similarCasesService.extractAndRank(
          authorities,
          query,
          countryCode,
          5,
        ).filter(
          (item) =>
            !priorAuthorityIds.has(item.authorityId) &&
            !priorCaseIdentities.has(this.similarCaseIdentity(item)),
        );
        this.logger.log(
          `[enrich] authorities=${authorities.length} similarCases=${similarCases.length} mode=${input.mode}`,
        );
        caseBlock = this.similarCasesService.buildPromptBlock(similarCases);
        if (!caseBlock && similarCases.length > 0) {
          caseBlock = similarCases
            .map(
              (c, i) =>
                `[CASE_${i + 1}] ${c.title}${c.citation ? ` — ${c.citation}` : ''}\n${c.relevance ?? c.summary ?? ''}`,
            )
            .join('\n\n');
        }
      } catch (err) {
        this.logger.warn(
          `Case-law enrich retrieval failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (wantSections && (countryCode === 'IN' || countryCode === 'KE')) {
      try {
        const sf = await this.sectionFinderGrounding.buildContext(
          query,
          undefined,
          countryCode,
        );
        sectionsAdded.push(
          ...sf.verifiedSectionLabels
            .filter(
              (label) =>
                !priorSectionLabels.has(this.normalizedEvidenceIdentity(label)),
            )
            .slice(0, 5),
        );
        sectionBlock =
          sectionsAdded.length > 0
            ? `${sf.promptBlock}\n\nNET-NEW SECTION ALLOWLIST (add only these): ${sectionsAdded.join(', ')}`
            : '';
        if (sf.authorities?.length) {
          const merged = new Map(authorities.map((a) => [a.id, a]));
          for (const a of sf.authorities) {
            if (!priorAuthorityIds.has(a.id)) merged.set(a.id, a);
          }
          authorities = [...merged.values()];
        }
      } catch (err) {
        this.logger.warn(
          `Section enrich failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const casesEmpty = wantCases && similarCases.length === 0;
    const sectionsEmpty = wantSections && sectionsAdded.length === 0;
    const nothingRetrieved =
      (wantCases && casesEmpty && !wantSections) ||
      (wantSections && sectionsEmpty && !wantCases) ||
      (wantCases && wantSections && casesEmpty && sectionsEmpty);

    if (nothingRetrieved) {
      const warning = wantCases
        ? priorSimilarCases.length > 0
          ? 'ALREADY_SUFFICIENTLY_GROUNDED'
          : 'NO_CASE_LAW_RETRIEVED'
        : priorSectionLabels.size > 0
          ? 'ALREADY_SUFFICIENTLY_GROUNDED'
          : 'NO_SECTIONS_RETRIEVED';
      this.logger.warn(`[enrich] ${warning} for output=${input.outputId}`);
      return {
        aiOutputId: existing.id,
        answer: memo,
        similarCases: priorSimilarCases,
        sectionChecks:
          (existing.citations && typeof existing.citations === 'object'
            ? ((existing.citations as Record<string, unknown>).sectionChecks as
                | SectionChecksAudit
                | null
                | undefined)
            : null) ?? null,
        creditsCharged: 0,
        providerCostUsd: 0,
        mode: input.mode,
        sectionsAdded,
        casesAdded: 0,
        warning,
      };
    }

    let warning: string | undefined;
    if (casesEmpty) warning = 'NO_CASE_LAW_RETRIEVED';
    else if (sectionsEmpty && wantSections) warning = 'NO_SECTIONS_RETRIEVED';

    const jurisdictionRules =
      countryCode === 'KE'
        ? [
            '- Prefer current Kenya Law expressions (Cap / Act section numbers from new.kenyalaw.org).',
            '- Use KLR / eKLR / KESC / KECA / KEHC citations for judgments; do not invent case names.',
            '- Do not treat bills or prospective instruments as in-force law.',
          ]
        : [
            '- Prefer current Indian codes (BNS/BNSS/BSA) over superseded IPC/CrPC/IEA for post-1-July-2024 facts.',
          ];
    const systemPrompt = [
      'You are an expert legal research editor.',
      'Update the existing Legal Research Memorandum by incorporating ONLY the allowed authorities below.',
      'Rules:',
      '- Do not invent case names, citations, or statute section numbers.',
      '- Only cite authorities from ALLOWED CASE LAWS and/or SECTION FINDER blocks.',
      '- Preserve the memo structure (Short Answer, Key Legal Test, Authorities, Application, Missing Facts).',
      ...jurisdictionRules,
      '- If an allowed block is empty, say so briefly in Authorities and do not fabricate.',
      '- Output the complete updated memo markdown only. No preamble.',
    ].join('\n');

    const userPrompt = [
      `MODE: ${input.mode}`,
      `QUERY: ${query}`,
      `COUNTRY: ${countryCode}`,
      '',
      wantCases ? 'ALLOWED CASE LAWS:\n' + (caseBlock || '(none retrieved)') : '',
      wantSections ? 'SECTION FINDER:\n' + (sectionBlock || '(none retrieved)') : '',
      '',
      'EXISTING MEMO:',
      memo,
    ]
      .filter(Boolean)
      .join('\n');

    const modelName = 'gpt-5.6-luna';
    let enriched = memo;
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
      enriched = result.content?.trim() || memo;
      inputTokens = result.inputTokens ?? 0;
      outputTokens = result.outputTokens ?? 0;
    } catch (err) {
      this.logger.warn(
        `Research enrich LLM failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const taskType = resolveTaskType(input.mode);
    const charge = await this.tokenCreditCharge.computeCreditsForUsage({
      provider: 'openai',
      modelName,
      inputTokens,
      outputTokens,
      taskType,
      minCredits: getCreditCost(taskType),
      tenantId: input.tenantId,
      userId: input.userId,
    });
    const providerCostUsd = charge.providerCostUsd;
    const creditsCharged =
      enriched !== memo || similarCases.length > 0 || sectionsAdded.length > 0
        ? charge.credits
        : 0;

    if (creditsCharged > 0) {
      await this.creditLedger.assertAndDebit({
        userId: input.userId,
        tenantId: input.tenantId,
        taskType,
        credits: creditsCharged,
        metadata: {
          aiOutputId: input.outputId,
          mode: input.mode,
          providerCostUsd,
          netMarginPercent: charge.netMarginPercent,
          inputTokens,
          outputTokens,
          modelName,
          casesAdded: similarCases.length,
          sectionsAdded: sectionsAdded.length,
          chargeMode: this.tokenCreditCharge.isTokenBased() ? 'token_based' : 'flat',
        },
      });
    }

    let verifiedCitations: Array<Record<string, unknown>> = this.mergeCitationItems(
      priorCitations,
      similarCases,
      authorities,
    );
    let findings: VerificationFinding[] | undefined;
    let propositions: VerifiedPropositionSummary[] | undefined;
    let dimensions: VerificationDimensions | undefined;
    let publicationState: PublicationState | undefined;
    let outputHash: string | undefined;
    let requiresLawyerReview = true;

    if (authorities.length > 0 && enriched.trim()) {
      try {
        const verified = await this.researchVerification.verifyAndPublish({
          query,
          outputMarkdown: enriched,
          authorities,
          isBareActQuery: false,
          countryCode,
          fastMode: false,
        });
        enriched = verified.outputMarkdown;
        findings = verified.findings;
        propositions = verified.propositions;
        dimensions = verified.dimensions;
        publicationState = verified.publicationState;
        outputHash = verified.outputHash;
        requiresLawyerReview = verified.provenance.requiresLawyerReview === true;
        const verifiedItems = Array.isArray(verified.citations)
          ? (verified.citations as unknown as Array<Record<string, unknown>>)
          : [];
        if (verifiedItems.length > 0) {
          verifiedCitations = this.mergeCitationLists(verifiedItems, verifiedCitations);
        }
      } catch (err) {
        this.logger.warn(
          `[enrich] re-verify failed (non-critical): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const mergedSimilarCases = [...priorSimilarCases, ...similarCases].filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            this.similarCaseIdentity(candidate) === this.similarCaseIdentity(item),
        ) === index,
    );
    const mergedSectionLabels = [
      ...(Array.isArray(priorCitations.sectionsAdded)
        ? (priorCitations.sectionsAdded as string[])
        : []),
      ...sectionsAdded,
    ].filter(
      (label, index, labels) =>
        labels.findIndex(
          (candidate) =>
            this.normalizedEvidenceIdentity(candidate) ===
            this.normalizedEvidenceIdentity(label),
        ) === index,
    );
    const citationsUpdate = {
      ...priorCitations,
      items: verifiedCitations,
      similarCases: mergedSimilarCases.slice(0, 15),
      enrichedAt: new Date().toISOString(),
      enrichMode: input.mode,
      sectionsAdded: mergedSectionLabels,
      findings,
      propositions,
      dimensions,
      publicationState,
      outputHash,
    };

    await this.prisma.aIOutput.update({
      where: { id: existing.id },
      data: {
        outputMarkdown: enriched,
        citations: citationsUpdate as unknown as Prisma.InputJsonValue,
        requiresLawyerReview,
      },
    });

    return {
      aiOutputId: existing.id,
      answer: enriched,
      similarCases: mergedSimilarCases,
      sectionChecks:
        (priorCitations.sectionChecks as SectionChecksAudit | null | undefined) ?? null,
      creditsCharged,
      providerCostUsd,
      mode: input.mode,
      sectionsAdded,
      casesAdded: similarCases.length,
      citations: verifiedCitations,
      findings,
      propositions,
      dimensions,
      publicationState,
      outputHash,
      requiresLawyerReview,
      warning,
    };
  }

  async refine(input: ResearchRefineInput): Promise<ResearchRefineResult> {
    const pinnedIds = this.normalizeIds(input.pinnedAuthorityIds);
    const excludedIds = this.normalizeIds(input.excludedAuthorityIds);
    const excludedSet = new Set(excludedIds);
    const overlap = pinnedIds.filter((id) => excludedSet.has(id));
    if (overlap.length > 0) {
      throw new BadRequestException(
        `Authorities cannot be both pinned and excluded: ${overlap.join(', ')}`,
      );
    }

    const existing = await this.prisma.aIOutput.findFirst({
      where: {
        id: input.outputId,
        tenantId: input.tenantId,
        taskType: AI_TASK_TYPES.LEGAL_RESEARCH,
      },
      include: {
        aiCitations: {
          include: { authority: true },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException('Research output not found');
    }

    const query = input.query?.trim() || existing.inputQuery?.trim();
    if (!query) {
      throw new BadRequestException('A research query is required to refine this output');
    }
    const countryCode = (input.countryCode?.trim() || 'IN').toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      throw new BadRequestException('countryCode must be a two-letter ISO country code');
    }
    const jurisdiction =
      input.jurisdiction?.trim() || existing.jurisdiction?.trim() || undefined;

    const priorCitations = this.asRecord(existing.citations);
    const priorItems = Array.isArray(priorCitations.items)
      ? (priorCitations.items as Array<Record<string, unknown>>)
      : Array.isArray(existing.citations)
        ? (existing.citations as Array<Record<string, unknown>>)
        : [];
    const citationAuthorityIds = priorItems
      .map((item) => this.stringValue(item.authorityId) || this.stringValue(item.id))
      .filter((id): id is string => !!id);
    const databaseIds = this.normalizeIds([...pinnedIds, ...citationAuthorityIds]);
    const databaseAuthorities =
      databaseIds.length > 0
        ? await this.prisma.legalAuthority.findMany({
            where: { id: { in: databaseIds } },
          })
        : [];

    const recovered = new Map<string, RetrievedAuthority>();
    for (const row of databaseAuthorities) {
      const authority = this.databaseAuthorityToRetrieved(row);
      if (this.hasUsableEvidence(authority)) recovered.set(row.id, authority);
    }
    for (const citation of existing.aiCitations) {
      if (citation.authority) {
        const authority = this.databaseAuthorityToRetrieved(citation.authority);
        if (this.hasUsableEvidence(authority)) {
          recovered.set(citation.authority.id, authority);
        }
      }
    }
    for (const item of priorItems) {
      const authority = this.citationItemToAuthority(item, existing.aiCitations);
      if (
        authority &&
        this.hasUsableEvidence(authority) &&
        !recovered.has(authority.id)
      ) {
        recovered.set(authority.id, authority);
      }
    }

    const manuallyAdded = input.addedAuthorities.map((authority) =>
      this.addedAuthorityToRetrieved(authority),
    );
    const collidingAdded = manuallyAdded.filter((authority) =>
      recovered.has(authority.id),
    );
    if (collidingAdded.length > 0) {
      throw new BadRequestException(
        `Added authority IDs must not replace persisted evidence: ${collidingAdded
          .map((authority) => authority.id)
          .join(', ')}`,
      );
    }
    const manuallyAddedIds = new Set(manuallyAdded.map((authority) => authority.id));
    const missingPinned = pinnedIds.filter(
      (id) => !recovered.has(id) && !manuallyAddedIds.has(id),
    );
    if (missingPinned.length > 0) {
      throw new BadRequestException(
        `Pinned authorities are not available in persisted evidence: ${missingPinned.join(', ')}`,
      );
    }
    const addedExcluded = manuallyAdded.filter((authority) => excludedSet.has(authority.id));
    if (addedExcluded.length > 0) {
      throw new BadRequestException(
        `Added authorities cannot also be excluded: ${addedExcluded.map((a) => a.id).join(', ')}`,
      );
    }

    const selected = new Map<string, RetrievedAuthority>();
    for (const id of pinnedIds) {
      const authority = recovered.get(id);
      if (authority) selected.set(id, authority);
    }
    for (const [id, authority] of recovered) {
      if (!excludedSet.has(id)) selected.set(id, authority);
    }
    for (const authority of manuallyAdded) {
      selected.set(authority.id, authority);
    }
    const authorities = [...selected.values()];
    if (authorities.length === 0) {
      throw new BadRequestException(
        'Refinement requires at least one persisted or manually added authority',
      );
    }
    if (authorities.length > 40) {
      throw new BadRequestException('Refinement is limited to 40 authorities');
    }

    const addedContext = input.addedContext.trim();
    const evidencePack = this.evidencePackService.buildFromAuthorities({
      jurisdiction: jurisdiction ?? countryCode,
      authorities,
      matterFacts: addedContext
        ? [{ factId: 'refinement_context_1', description: addedContext, sourceRef: 'user' }]
        : [],
    });
    const excludedDescriptions = this.describeExcludedAuthorities(
      excludedIds,
      recovered,
      priorItems,
    );
    const systemPrompt = [
      'You are an expert legal research editor revising an existing memorandum.',
      'Use only the locked evidence catalog supplied below for legal propositions and citations.',
      'Never rely on model memory for a case name, holding, quotation, citation, or statutory text.',
      'Remove claims and citations that depend only on excluded authorities.',
      'Pinned authorities should be addressed when relevant, but do not overstate their holdings.',
      'Treat user-added context as facts to analyze, not as legal authority.',
      'Preserve useful analysis only when it remains supported by the locked evidence catalog.',
      input.requestedTaskKind
        ? `Preserve the ${input.requestedTaskKind} task shape and ${input.desiredOutput ?? 'ANSWER'} output contract.`
        : '',
    ].join('\n');
    const prompt = [
      `RESEARCH QUERY:\n${query}`,
      addedContext ? `ADDED FACTUAL CONTEXT:\n${addedContext}` : '',
      pinnedIds.length > 0 ? `PINNED AUTHORITY IDS:\n${pinnedIds.join('\n')}` : '',
      excludedDescriptions.length > 0
        ? `EXCLUDED AUTHORITIES — DO NOT CITE OR CLAIM RELIANCE ON THESE:\n${excludedDescriptions.join('\n')}`
        : '',
      'EXISTING MEMORANDUM TO REVISE:',
      existing.outputMarkdown,
    ]
      .filter(Boolean)
      .join('\n\n');

    const modelName = 'gpt-5.6-luna';
    let synthesis: Awaited<ReturnType<StructuredResearchSynthesisService['synthesize']>>;
    try {
      synthesis = await this.structuredSynthesis.synthesize({
        query,
        prompt,
        systemPrompt,
        modelName,
        evidencePack,
        jurisdiction: jurisdiction ?? countryCode,
        taskKind: input.requestedTaskKind,
        reasoningEffort: 'high',
        maxTokens: 8_000,
      });
    } catch (err) {
      this.logger.warn(
        `[refine] synthesis failed for output=${input.outputId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ServiceUnavailableException('Research refinement could not be synthesized');
    }
    if (!synthesis.draft || synthesis.verificationUnavailable) {
      throw new ServiceUnavailableException(
        'Research refinement did not produce a verifiable structured memo',
      );
    }

    let verified: Awaited<ReturnType<LegalResearchVerificationService['verifyAndPublish']>>;
    try {
      verified = await this.researchVerification.verifyAndPublish({
        query,
        outputMarkdown: synthesis.outputMarkdown,
        authorities,
        isBareActQuery: false,
        modelName,
        countryCode,
        fastMode: true,
        structuredDraft: synthesis.draft,
        structuredFindings: synthesis.findings,
      });
    } catch (err) {
      this.logger.warn(
        `[refine] verification failed for output=${input.outputId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ServiceUnavailableException('Research refinement could not be verified');
    }

    const taskType = AI_TASK_TYPES.RESEARCH_ENRICH_BOTH;
    const charge = await this.tokenCreditCharge.computeCreditsForUsage({
      provider: 'openai',
      modelName,
      inputTokens: synthesis.usage.inputTokens,
      outputTokens: synthesis.usage.outputTokens,
      taskType,
      minCredits: getCreditCost(taskType),
      tenantId: input.tenantId,
      userId: input.userId,
    });
    await this.creditLedger.assertAndDebit({
      userId: input.userId,
      tenantId: input.tenantId,
      taskType,
      credits: charge.credits,
      metadata: {
        aiOutputId: input.outputId,
        mode: 'refine',
        authorityCount: authorities.length,
        pinnedCount: pinnedIds.length,
        excludedCount: excludedIds.length,
        addedCount: manuallyAdded.length,
        inputTokens: synthesis.usage.inputTokens,
        outputTokens: synthesis.usage.outputTokens,
        modelName,
      },
    });

    const verifiedCitations = Array.isArray(verified.citations)
      ? (verified.citations as unknown as Array<Record<string, unknown>>)
      : [];
    const priorSimilarCases = Array.isArray(priorCitations.similarCases)
      ? (priorCitations.similarCases as unknown as SimilarCase[])
      : [];
    const selectedIds = new Set(authorities.map((authority) => authority.id));
    const similarCases = priorSimilarCases.filter((item) =>
      selectedIds.has(item.authorityId),
    );
    const sectionChecks =
      (priorCitations.sectionChecks as SectionChecksAudit | null | undefined) ?? null;
    const citationsUpdate = {
      ...priorCitations,
      items: verifiedCitations,
      similarCases,
      sectionChecks,
      findings: verified.findings,
      propositions: verified.propositions,
      dimensions: verified.dimensions,
      publicationState: verified.publicationState,
      outputHash: verified.outputHash,
      structuredDraft: synthesis.draft,
      refinement: {
        refinedAt: new Date().toISOString(),
        pinnedAuthorityIds: pinnedIds,
        excludedAuthorityIds: excludedIds,
        selectedAuthorityIds: authorities.map((authority) => authority.id),
        addedContextHash: addedContext
          ? createHash('sha256').update(addedContext).digest('hex')
          : null,
      },
    };
    const localAuthorityIds = new Set(databaseAuthorities.map((authority) => authority.id));
    for (const citation of existing.aiCitations) {
      if (citation.authorityId) localAuthorityIds.add(citation.authorityId);
    }
    const citationRows = authorities.map((authority) => ({
      userId: input.userId,
      tenantId: input.tenantId,
      aiOutputId: existing.id,
      authorityId: localAuthorityIds.has(authority.id) ? authority.id : null,
      sourceUrl: localAuthorityIds.has(authority.id) ? null : authority.sourceUrl ?? null,
      quotedText: (authority.summary ?? authority.fullText ?? authority.title).slice(0, 4_000),
      confidence: 0.75,
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.aIOutput.update({
        where: { id: existing.id },
        data: {
          inputQuery: query,
          outputMarkdown: verified.outputMarkdown,
          citations: citationsUpdate as unknown as Prisma.InputJsonValue,
          citationAudit: Prisma.JsonNull,
          verified:
            verified.publicationState !== 'DRAFT_NOT_VERIFIED' &&
            verified.publicationState !== 'VERIFICATION_UNAVAILABLE',
          requiresLawyerReview: verified.provenance.requiresLawyerReview,
        },
      });
      await tx.aICitation.deleteMany({ where: { aiOutputId: existing.id } });
      if (citationRows.length > 0) {
        await tx.aICitation.createMany({ data: citationRows });
      }
    });

    return {
      outputMarkdown: verified.outputMarkdown,
      citations: verifiedCitations,
      mode: 'REFINE',
      provider: 'structured-research',
      modelName,
      countryCode,
      jurisdiction: jurisdiction ?? undefined,
      creditsUsed: charge.credits,
      providerCostUsd: charge.providerCostUsd,
      verificationStatus: verified.provenance.verificationStatus,
      sourceTierSummary: verified.provenance.sourceTierSummary,
      corpusEdition: verified.provenance.corpusEdition,
      requiresLawyerReview: verified.provenance.requiresLawyerReview,
      sentenceAudit: verified.sentenceAudit.entries.slice(0, 25).map((entry) => ({
        sentence: entry.sentence,
        status: entry.status,
        authorityTitle: entry.authorityTitle,
      })),
      findings: verified.findings,
      propositions: verified.propositions,
      dimensions: verified.dimensions,
      publicationState: verified.publicationState,
      outputHash: verified.outputHash,
      researchMode: 'REFINE',
      structuredDraft: synthesis.draft,
      structuredMemo: synthesis.draft,
      similarCases,
      sectionChecks,
      aiOutputId: existing.id,
      pinnedAuthorityIds: pinnedIds,
      excludedAuthorityIds: excludedIds,
    };
  }

  private normalizeIds(ids: string[]): string[] {
    return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  }

  private admitAuthoritySearchCandidates(
    authorities: RetrievedAuthority[],
    query: string,
  ): RetrievedAuthority[] {
    return authorities.flatMap((authority) => {
      if (
        authority.isRepealed ||
        authority.treatmentStatus === 'repealed' ||
        authority.treatmentStatus === 'overruled'
      ) {
        return [];
      }
      const assessment = assessCandidateRelevance(authority, { query });
      if (!assessment.admitted) return [];
      const evidenceText = (authority.summary || authority.fullText || '').trim();
      if (!evidenceText) return [];
      return [
        {
          ...authority,
          relevanceScore: Math.max(
            assessment.score,
            authority.relevanceScore ?? authority.score ?? 0,
          ),
          relevanceReason: authority.relevanceReason ?? assessment.reason,
          relevanceGate: 'admitted' as const,
        },
      ];
    });
  }

  private authoritySearchIdentity(authority: RetrievedAuthority): string {
    const citation = (authority.neutralCitation || authority.citation || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (citation) return `citation:${citation}`;
    if (authority.sourceUrl) {
      return `url:${authority.sourceUrl.toLowerCase().replace(/\/+$/, '')}`;
    }
    return `id:${authority.id}`;
  }

  private similarCaseIdentity(item: SimilarCase): string {
    if (item.authorityId) return `id:${item.authorityId}`;
    if (item.neutralCitation || item.citation) {
      return `citation:${this.normalizedEvidenceIdentity(
        item.neutralCitation || item.citation || '',
      )}`;
    }
    if (item.sourceUrl) return `url:${item.sourceUrl.toLowerCase().replace(/\/+$/, '')}`;
    return `title:${this.normalizedEvidenceIdentity(item.title)}`;
  }

  private normalizedEvidenceIdentity(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private databaseAuthorityToRetrieved(authority: {
    id: string;
    title: string;
    citation: string | null;
    neutralCitation: string | null;
    sourceName: string;
    sourceUrl: string | null;
    summary: string | null;
    fullText: string | null;
    authorityType: string;
    treatmentStatus: string;
    decisionDate: Date | null;
    isRepealed: boolean;
    repealNotes: string | null;
  }): RetrievedAuthority {
    return {
      id: authority.id,
      title: authority.title,
      citation: authority.citation,
      neutralCitation: authority.neutralCitation,
      sourceName: authority.sourceName,
      sourceUrl: authority.sourceUrl,
      summary: authority.summary,
      fullText: authority.fullText,
      authorityType: authority.authorityType,
      sourceTier: resolveSourceTier(authority.sourceName, authority.authorityType),
      treatmentStatus: this.toTreatmentStatus(authority.treatmentStatus),
      decisionYear: authority.decisionDate?.getUTCFullYear(),
      isRepealed: authority.isRepealed,
      repealNotes: authority.repealNotes,
    };
  }

  private citationItemToAuthority(
    item: Record<string, unknown>,
    citationRows: Array<{ sourceUrl: string | null; quotedText: string | null }>,
  ): RetrievedAuthority | null {
    const id = this.stringValue(item.authorityId) || this.stringValue(item.id);
    const sourceUrl = this.stringValue(item.sourceUrl) || this.stringValue(item.url);
    if (!id) return null;
    const title =
      this.stringValue(item.title) || this.stringValue(item.authorityTitle) || id;
    const linkedCitation = citationRows.find(
      (citation) => !!sourceUrl && citation.sourceUrl === sourceUrl,
    );
    const summary =
      this.stringValue(item.summary) ||
      this.stringValue(item.quotedText) ||
      linkedCitation?.quotedText ||
      null;
    return {
      id,
      title,
      citation: this.stringValue(item.citation) ?? null,
      sourceName:
        this.stringValue(item.sourceName) ||
        this.stringValue(item.source) ||
        'Persisted research source',
      sourceUrl: sourceUrl ?? null,
      summary,
      fullText: this.stringValue(item.fullText) ?? null,
      sourceTier: this.toSourceTier(item.sourceTier, item.sourceName, item.authorityType),
      authorityType: this.stringValue(item.authorityType),
    };
  }

  private addedAuthorityToRetrieved(
    authority: ResearchRefineAuthorityDto,
  ): RetrievedAuthority {
    const evidenceText = (
      authority.fullText ||
      authority.summary ||
      authority.excerpt ||
      ''
    ).trim();
    if (!evidenceText) {
      throw new BadRequestException(
        `Added authority "${authority.title}" must include fullText, summary, or excerpt`,
      );
    }
    const suppliedId = authority.authorityId?.trim() || authority.id?.trim();
    const id =
      suppliedId ||
      `user-added-${createHash('sha256')
        .update(`${authority.title}|${authority.citation ?? ''}|${authority.sourceUrl ?? ''}`)
        .digest('hex')
        .slice(0, 20)}`;
    return {
      id,
      title: authority.title.trim(),
      citation: authority.citation?.trim() || null,
      sourceName: authority.sourceName?.trim() || 'User-added authority',
      sourceUrl: authority.sourceUrl?.trim() || null,
      summary: authority.summary?.trim() || authority.excerpt?.trim() || null,
      fullText: authority.fullText?.trim() || evidenceText,
      sourceTier:
        authority.sourceTier ??
        resolveSourceTier(authority.sourceName, authority.authorityType),
      authorityType: authority.authorityType?.trim(),
    };
  }

  private toSourceTier(
    value: unknown,
    sourceName: unknown,
    authorityType: unknown,
  ): RetrievedAuthority['sourceTier'] {
    if (
      value === 'primary' ||
      value === 'case_law' ||
      value === 'firm' ||
      value === 'web' ||
      value === 'seed'
    ) {
      return value;
    }
    return resolveSourceTier(
      this.stringValue(sourceName),
      this.stringValue(authorityType),
    );
  }

  private toTreatmentStatus(
    value: string,
  ): RetrievedAuthority['treatmentStatus'] {
    if (
      value === 'good_law' ||
      value === 'overruled' ||
      value === 'distinguished' ||
      value === 'superseded' ||
      value === 'repealed'
    ) {
      return value;
    }
    return undefined;
  }

  private hasUsableEvidence(authority: RetrievedAuthority): boolean {
    const text = (authority.fullText || authority.summary || '').trim();
    if (!text) return false;
    const normalized = text.toLowerCase();
    return (
      normalized !== authority.title.trim().toLowerCase() &&
      normalized !== (authority.citation ?? '').trim().toLowerCase()
    );
  }

  private describeExcludedAuthorities(
    excludedIds: string[],
    recovered: Map<string, RetrievedAuthority>,
    priorItems: Array<Record<string, unknown>>,
  ): string[] {
    return excludedIds.map((id) => {
      const recoveredAuthority = recovered.get(id);
      const prior = priorItems.find(
        (item) =>
          this.stringValue(item.authorityId) === id || this.stringValue(item.id) === id,
      );
      const title =
        recoveredAuthority?.title ||
        (prior ? this.stringValue(prior.title) : undefined);
      const citation =
        recoveredAuthority?.citation ||
        (prior ? this.stringValue(prior.citation) : undefined);
      return `- ${id}${title ? ` — ${title}` : ''}${citation ? ` (${citation})` : ''}`;
    });
  }

  private mergeCitationItems(
    priorCitations: Record<string, unknown>,
    similarCases: SimilarCase[],
    authorities: RetrievedAuthority[],
  ): Array<Record<string, unknown>> {
    const priorItems = Array.isArray(priorCitations.items)
      ? (priorCitations.items as Array<Record<string, unknown>>)
      : Array.isArray(priorCitations)
        ? (priorCitations as unknown as Array<Record<string, unknown>>)
        : [];

    const fromCases = similarCases.map((c) => ({
      title: c.title,
      citation: c.citation ?? null,
      source: c.sourceName ?? 'Case law',
      sourceName: c.sourceName ?? 'Case law',
      sourceUrl: c.sourceUrl ?? null,
      url: c.sourceUrl ?? null,
      authorityId: c.authorityId,
      verified: c.verificationStatus === 'verified',
    }));

    const fromAuthorities = authorities.slice(0, 16).map((a) => ({
      title: a.title,
      citation: a.citation ?? null,
      source: a.sourceName ?? a.sourceTier,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl ?? null,
      url: a.sourceUrl ?? null,
      authorityId: a.id,
      sourceTier: a.sourceTier,
    }));

    return this.mergeCitationLists(priorItems, [...fromCases, ...fromAuthorities]);
  }

  private mergeCitationLists(
    primary: Array<Record<string, unknown>>,
    secondary: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const seen = new Set<string>();
    const out: Array<Record<string, unknown>> = [];
    for (const item of [...primary, ...secondary]) {
      const key = String(
        item.authorityId ??
          item.sourceUrl ??
          item.url ??
          `${item.title ?? ''}|${item.citation ?? ''}`,
      )
        .toLowerCase()
        .trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out.slice(0, 40);
  }
}
