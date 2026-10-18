import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pLimit from 'p-limit';
import { CacheService } from '@/cache/cache.service';
import { hashPrompt } from '@/common/utils/prompt-hash.util';
import { IndiaKanoonConnector } from '@/legal-sources/connectors/india-kanoon.connector';
import {
  EscrConnector,
  buildEscrAuthorityId,
  type EscrSearchHit,
} from '@/legal-sources/connectors/escr.connector';
import { CourtListenerConnector } from '@/legal-sources/connectors/courtlistener.connector';
import { KenyaLawJudgmentConnector } from '@/legal-sources/connectors/kenya-law-judgment.connector';
import { TavilySearchConnector } from '@/legal-sources/connectors/tavily-search.connector';
import { LegalSourceService } from '@/legal-sources/legal-source.service';
import { BareActLookupService } from './bare-act-lookup.service';
import { LegalSearchPlanService } from './legal-search-plan.service';
import { KnowledgeStackService } from './knowledge-stack.service';
import { LegalRerankerService } from './legal-reranker.service';
import { parseStatuteQuery, requestedSectionMissingFromAuthorities } from './statute-registry';
import type { LegalRetrievalInput, LegalRetrievalResult, RetrievedAuthority } from './legal-retrieval.types';
import { rankAuthoritiesByTier, resolveSourceTier, shouldBlockWebForBareAct, summarizeSourceTiers } from './source-tier.util';
import { AuthorityTrustService } from '@/ai/feedback/authority-trust.service';
import { domainAnchors, domainFitRatio, isClearlyOffDomainAuthority } from './legal-domain-profile';
import { assessCandidateRelevance } from './retrieval-relevance';
import { isOfficialIndianJudgmentUrl } from '@/legal-sources/official-judgment-url';
import type { StructuredLegalQueryContext } from './legal-retrieval.types';
import { isHeadingOnlyStatuteAuthority } from './retrieval-citation-guard';
import {
  buildRbiAuthorityId,
  RbiRegulationConnector,
} from '@/legal-sources/connectors/rbi-regulation.connector';
import { IndiaKanoonQueryBuilderService } from '@/ai/legal-research/india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from '@/ai/legal-research/kenya-law-query-builder.service';
import type { KenyaLawSearchHit } from '@/legal-sources/connectors/kenya-law-judgment.connector';
import {
  buildLicensedAuthorityId,
  LicensedCaseLawConnector,
} from '@/legal-sources/connectors/licensed-case-law.connector';
import { normalizeCourtMetadata } from './court-normalization';
import { StatuteIngestService } from '@/legal-sources/statute-ingest.service';
import {
  findStatuteById,
  formatSectionCitation,
} from './statute-registry';
import {
  CONTRACT_ACT_WAIVER_CASE_QUERIES,
  CONTRACT_ACT_WAIVER_SIBLING_SECTIONS,
  isContractActWaiverQuery,
} from './contract-act-waiver.util';
import {
  INDIA_TENANT_EVICTION_CASE_QUERIES,
  INDIA_TENANT_EVICTION_SECTIONS,
  isIndiaTenantEvictionQuery,
} from './india-tenant-eviction.util';

/** Nest ConfigService returns env vars as strings — p-limit requires a positive integer. */
function resolvePositiveInt(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normaliseCitation(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function preferVerifiedCorpusAuthorities(authorities: RetrievedAuthority[]): RetrievedAuthority[] {
  const byCitation = new Map<string, RetrievedAuthority>();
  for (const authority of authorities) {
    const key = normaliseCitation(authority.neutralCitation ?? authority.citation);
    if (!key) {
      byCitation.set(`id:${authority.id}`, authority);
      continue;
    }
    const existing = byCitation.get(key);
    const corpusAuthority = authority.id.startsWith('india-corpus-');
    const existingIsCorpus = existing?.id.startsWith('india-corpus-') ?? false;
    if (!existing || (corpusAuthority && !existingIsCorpus)) {
      byCitation.set(key, corpusAuthority ? { ...authority, score: Math.max(authority.score ?? 0, 0.98) } : authority);
    }
  }
  return [...byCitation.values()].sort((a, b) => {
    const aCorpus = a.id.startsWith('india-corpus-') ? 1 : 0;
    const bCorpus = b.id.startsWith('india-corpus-') ? 1 : 0;
    return bCorpus - aCorpus || (b.score ?? 0) - (a.score ?? 0);
  });
}

@Injectable()
export class LegalRetrievalOrchestrator {
  private readonly logger = new Logger(LegalRetrievalOrchestrator.name);
  private static readonly MIN_AUTHORITIES = 3;
  private static readonly RERANK_POOL = 20;
  private static readonly RERANK_TOP = 5;

  constructor(
    private readonly legalSearchPlan: LegalSearchPlanService,
    private readonly bareActLookup: BareActLookupService,
    private readonly knowledgeStack: KnowledgeStackService,
    private readonly reranker: LegalRerankerService,
    private readonly cacheService: CacheService,
    private readonly indiaKanoon: IndiaKanoonConnector,
    private readonly escr: EscrConnector,
    private readonly courtListener: CourtListenerConnector,
    private readonly kenyaLawJudgments: KenyaLawJudgmentConnector,
    private readonly tavilySearch: TavilySearchConnector,
    private readonly legalSourceService: LegalSourceService,
    private readonly configService: ConfigService,
    private readonly rbiRegulations: RbiRegulationConnector,
    private readonly indiaKanoonQueryBuilder: IndiaKanoonQueryBuilderService,
    private readonly kenyaLawQueryBuilder: KenyaLawQueryBuilderService,
    @Optional() private readonly authorityTrust: AuthorityTrustService | null,
    @Optional() private readonly licensedCaseLaw: LicensedCaseLawConnector | null = null,
    @Optional() private readonly statuteIngest?: StatuteIngestService,
  ) {}

  async retrieve(input: LegalRetrievalInput): Promise<LegalRetrievalResult> {
    const retrievalStartedAt = Date.now();
    const connectorDiagnostics: NonNullable<
      LegalRetrievalResult['connectorDiagnostics']
    > = [];
    const isFastMode = input.researchMode === 'FAST';
    // India has a large corpus — keep 10 variants for thorough DEEP coverage.
    // Other countries (KE, US, etc.) have smaller corpora; 5 variants avoids
    // duplicates and cuts retrieval time by ~40%.
    const deepVariants = input.countryCode.toUpperCase() === 'IN' ? 10 : 5;
    const searchPlan = this.legalSearchPlan.buildSearchPlan({
      ...input,
      limit: input.limit ?? 10,
      maxVariants: isFastMode ? 3 : deepVariants,
    });
    const structuredPhrases = [
      ...(input.legalIssues ?? []),
      ...(input.propositionPhrases ?? []),
      ...(input.doctrines ?? []),
    ]
      .map((phrase) => phrase.replace(/\s+/g, ' ').trim().slice(0, 120))
      .filter(Boolean);
    const structuredQueries = [
      ...structuredPhrases.map(
        (phrase) =>
          `"${phrase.replace(/"/g, '')}"${input.proceduralPosture ? ` ${input.proceduralPosture}` : ''}`,
      ),
      ...(input.statuteSections ?? []).map((section) => `"${section.replace(/"/g, '')}"`),
    ];
    searchPlan.expandedQueries = [
      ...new Set([
        ...(input.expandedQueries ?? []),
        ...structuredQueries,
        ...searchPlan.expandedQueries,
      ]),
    ].slice(0, isFastMode ? 5 : 12);

    const queryHash = hashPrompt(
      [
        input.query,
        ...searchPlan.expandedQueries,
        input.countryCode,
        input.jurisdiction ?? '',
        input.legalDomain ?? '',
      ].join('|'),
    );
    const cacheKey = this.cacheService.buildKey('legal:retrieval', [
      'v3-strict-case-relevance',
      input.countryCode,
      input.jurisdiction ?? 'all',
      queryHash,
      input.tenantId ?? 'none',
      input.matterId ?? 'none',
    ]);

    const cached = await this.cacheService.get<LegalRetrievalResult>(cacheKey);
    if (cached) return cached;

    const parsed = parseStatuteQuery(input.query, input.countryCode);
    // Prefer Schedule I successor (BNS/BNSS/BSA) for exact bare-act lookup when remap exists.
    const remapped = searchPlan.remappedSection;
    const requestedActId = remapped?.actId ?? parsed.actId;
    const requestedSection = remapped?.section ?? parsed.section;

    const merged = new Map<string, RetrievedAuthority>();
    const allSuggestedSections: RetrievedAuthority[] = [];
    const rejectedCandidates: NonNullable<LegalRetrievalResult['rejectedCandidates']> = [];
    let exactSectionFound = false;

    for (const prior of input.priorAuthorities ?? []) {
      merged.set(prior.id, prior);
    }

    // Run all query variants with bounded concurrency — p-limit ensures all queries are
    // processed; it limits simultaneous operations, NOT total operations.
    const internalConcurrency = resolvePositiveInt(
      this.configService.get('LEGAL_INTERNAL_SEARCH_CONCURRENCY'),
      6,
    );
    const internalLimit = pLimit(Math.max(1, internalConcurrency));


    const localStartedAt = Date.now();
    const variantResults = await Promise.allSettled(
      searchPlan.expandedQueries.map((queryVariant) =>
        internalLimit(() =>
          this.knowledgeStack.search({
            query: queryVariant,
            countryCode: input.countryCode,
            jurisdiction: input.jurisdiction,
            practiceArea: input.practiceArea,
            subPracticeArea: input.subPracticeArea,
            nature: input.nature,
            searchTopics: searchPlan.searchTopics,
            isBareActQuery: searchPlan.isBareActQuery,
            requestedActId,
            requestedSection,
            tenantId: input.tenantId,
            userId: input.userId,
            matterId: input.matterId,
            intakeFacts: input.intakeFacts,
            limit: searchPlan.limit,
            knowledgeSources: input.knowledgeSources,
          }),
        ),
      ),
    );
    const localMs = Date.now() - localStartedAt;

    for (const settled of variantResults) {
      if (settled.status === 'rejected') {
        this.logger.warn(`Query variant failed: ${String(settled.reason)}`);
        continue;
      }
      const stackResult = settled.value;
      for (const hit of stackResult.authorities) {
        if (!merged.has(hit.id)) merged.set(hit.id, hit);
      }
      if (stackResult.exactSectionFound) exactSectionFound = true;
      for (const s of stackResult.suggestedSections) {
        if (!allSuggestedSections.some((x) => x.id === s.id)) {
          allSuggestedSections.push(s);
        }
      }
    }

    // Contract Act contracting-out queries need sibling sections (ss.23–30, 62–63, 74).
    if (
      input.countryCode.toUpperCase() === 'IN' &&
      isContractActWaiverQuery(input.query) &&
      this.statuteIngest
    ) {
      for (const section of CONTRACT_ACT_WAIVER_SIBLING_SECTIONS) {
        try {
          const resolved = await this.statuteIngest.resolveSectionOnDemand(
            'contract-act',
            section,
            'IN',
          );
          if (!resolved?.fullText) continue;
          const authority = this.resolvedSectionToAuthority(resolved, input);
          if (!merged.has(authority.id)) {
            merged.set(authority.id, authority);
            exactSectionFound = true;
          }
        } catch (err) {
          this.logger.warn(
            `Contract Act sibling s.${section} resolve failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    // Tenant premature-notice queries need TPA lease + SRA/CPC remedy sections.
    if (
      input.countryCode.toUpperCase() === 'IN' &&
      isIndiaTenantEvictionQuery(input.query) &&
      this.statuteIngest
    ) {
      for (const { actId, section } of INDIA_TENANT_EVICTION_SECTIONS) {
        try {
          const resolved = await this.statuteIngest.resolveSectionOnDemand(
            actId,
            section,
            'IN',
          );
          if (!resolved?.fullText) continue;
          const authority = this.resolvedSectionToAuthority(resolved, input);
          if (!merged.has(authority.id)) {
            merged.set(authority.id, authority);
            exactSectionFound = true;
          }
        } catch (err) {
          this.logger.warn(
            `Tenant pack ${actId} s.${section} resolve failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    let authorities = [...merged.values()];

    const confidenceThresholdMet =
      authorities.filter((a) => a.sourceTier === 'primary' || a.sourceTier === 'seed').length >=
      LegalRetrievalOrchestrator.MIN_AUTHORITIES;

    // Respect knowledge source selection: skip live web/case_law connectors when user restricted to statutes-only
    const allowLive = !input.knowledgeSources ||
      input.knowledgeSources.some((s) => ['case_law', 'web', 'regulations'].includes(s));
    // When user explicitly requested case law (or no source filter set), always run live
    // connectors regardless of how many statutes the local corpus returned. Without this
    // override, 3+ statute hits set confidenceThresholdMet=true and Kanoon/CourtListener
    // are silently skipped even when the query is clearly about precedents.
    const forceLiveCaseLaw =
      !input.knowledgeSources ||
      input.knowledgeSources.includes('case_law');
    const forceLiveRegulations =
      input.countryCode.toUpperCase() === 'IN' &&
      input.knowledgeSources?.includes('regulations') === true;
    if (
      allowLive &&
      input.supplementLive !== false &&
      (!confidenceThresholdMet ||
        searchPlan.isBareActQuery ||
        forceLiveCaseLaw ||
        forceLiveRegulations)
    ) {
      authorities = await this.supplementWithLiveConnectors(authorities, {
        countryCode: input.countryCode,
        query: input.query,
        searchQueries: searchPlan.expandedQueries,
        jurisdiction: input.jurisdiction,
        isBareActQuery: searchPlan.isBareActQuery,
        skipTavilyInFast: input.skipTavilyInFast,
        skipIndiaKanoon: input.skipIndiaKanoon,
        skipTavily: input.skipTavily,
        skipLiveRegulations: input.skipLiveRegulations,
        isFastMode,
        forceCaseLaw: forceLiveCaseLaw,
        legalDomain: input.legalDomain,
        practiceArea: input.practiceArea,
        legalIssues: input.legalIssues,
        statuteSections: input.statuteSections,
        doctrines: input.doctrines,
        proceduralPosture: input.proceduralPosture,
        propositionPhrases: input.propositionPhrases,
        entities: input.entities,
        remedies: input.remedies,
        requestedAuthorityTypes: input.requestedAuthorityTypes,
        issueDecomposition: input.issueDecomposition,
        knowledgeSources: input.knowledgeSources,
        diagnostics: connectorDiagnostics,
      });
    }

    authorities = preferVerifiedCorpusAuthorities(authorities);
    authorities = authorities.filter((authority) => {
      if (!isHeadingOnlyStatuteAuthority(authority)) return true;
      rejectedCandidates.push({
        authorityId: authority.id,
        gate: 'heading_only_statute',
        reason: 'Heading-only statute section has no substantive operative text.',
      });
      const rejectedSection =
        authority.section ??
        authority.citation?.match(/\b(?:s(?:ection)?\.?|§)\s*(\d+[A-Za-z0-9()/-]*)/i)?.[1];
      if (requestedSection && rejectedSection?.toUpperCase() === requestedSection.toUpperCase()) {
        exactSectionFound = false;
      }
      return false;
    });

    // A sufficient count of primary sources is not enough if they are plainly
    // from a different practice area. Retry once with domain anchors before
    // allowing those sources into synthesis.
    const initialDomainFitLow =
      input.legalDomain !== undefined && domainFitRatio(authorities, input.legalDomain) < 0.6;
    if (initialDomainFitLow) {
      const retryQueries = domainAnchors(input.legalDomain, input.countryCode).map(
        (anchor) => `${input.query} ${anchor}`,
      );
      if (retryQueries.length > 0) {
        this.logger.warn(
          `Low domain fit for ${input.legalDomain}; broadening retrieval with domain anchors.`,
        );
        const retryResults = await Promise.allSettled(
          retryQueries.map((queryVariant) =>
            internalLimit(() =>
              this.knowledgeStack.search({
                query: queryVariant,
                countryCode: input.countryCode,
                jurisdiction: input.jurisdiction,
                practiceArea: input.practiceArea,
                subPracticeArea: input.subPracticeArea,
                nature: input.nature,
                searchTopics: searchPlan.searchTopics,
                isBareActQuery: searchPlan.isBareActQuery,
                requestedActId,
                requestedSection,
                tenantId: input.tenantId,
                userId: input.userId,
                matterId: input.matterId,
                intakeFacts: input.intakeFacts,
                limit: searchPlan.limit,
                knowledgeSources: input.knowledgeSources,
              }),
            ),
          ),
        );
        const retried = new Map(authorities.map((authority) => [authority.id, authority]));
        for (const settled of retryResults) {
          if (settled.status !== 'fulfilled') continue;
          for (const authority of settled.value.authorities) retried.set(authority.id, authority);
        }
        authorities = await this.supplementWithLiveConnectors([...retried.values()], {
          countryCode: input.countryCode,
          query: input.query,
          searchQueries: retryQueries,
          jurisdiction: input.jurisdiction,
          isBareActQuery: searchPlan.isBareActQuery,
          skipTavilyInFast: input.skipTavilyInFast,
          skipIndiaKanoon: input.skipIndiaKanoon,
          skipTavily: input.skipTavily,
          skipLiveRegulations: input.skipLiveRegulations,
          isFastMode,
          forceCaseLaw: forceLiveCaseLaw,
          legalDomain: input.legalDomain,
          practiceArea: input.practiceArea,
          legalIssues: input.legalIssues,
          statuteSections: input.statuteSections,
          doctrines: input.doctrines,
          proceduralPosture: input.proceduralPosture,
          propositionPhrases: input.propositionPhrases,
          entities: input.entities,
          remedies: input.remedies,
          requestedAuthorityTypes: input.requestedAuthorityTypes,
          issueDecomposition: input.issueDecomposition,
          knowledgeSources: input.knowledgeSources,
          diagnostics: connectorDiagnostics,
        });
        authorities = preferVerifiedCorpusAuthorities(authorities);
      }
    }

    // Every case-law source, including local corpus and retry results, must pass
    // the same query-specific admission gate before reranking or trust boosts.
    authorities = authorities
      .map((authority) => {
        if (authority.sourceTier !== 'case_law') return authority;
        const assessment = assessCandidateRelevance(authority, input);
        if (!assessment.admitted) {
          rejectedCandidates.push({
            authorityId: authority.id,
            gate: 'case_relevance',
            reason: assessment.reason,
          });
          return null;
        }
        return {
          ...authority,
          relevanceScore: assessment.score,
          relevanceReason: assessment.reason,
          relevanceGate: 'admitted' as const,
        };
      })
      .filter((authority): authority is RetrievedAuthority => authority !== null);

    const pool = [...authorities]
      .sort(
        (a, b) =>
          Number(isClearlyOffDomainAuthority(a, input.legalDomain)) -
          Number(isClearlyOffDomainAuthority(b, input.legalDomain)),
      )
      .slice(0, LegalRetrievalOrchestrator.RERANK_POOL);
    // When case law is requested, keep a wider top-N so statutes do not crowd out judgments.
    const rerankTop = forceLiveCaseLaw
      ? Math.max(LegalRetrievalOrchestrator.RERANK_TOP, 7)
      : LegalRetrievalOrchestrator.RERANK_TOP;
    let reranked = await this.reranker.rerank(input.query, pool, rerankTop, input.legalDomain);

    // Apply learned authority trust scores (strip/verify/user-correction signals)
    if (this.authorityTrust) {
      try {
        const trustMap = await this.authorityTrust.getTrustMap(input.countryCode ?? 'IN');
        if (trustMap.size > 0) {
          reranked = this.authorityTrust.applyTrustBoost(reranked, trustMap);
        }
      } catch (err) {
        this.logger.debug(`Authority trust boost skipped: ${String(err)}`);
      }
    }

    // Slot reservation: when case law is explicitly requested (or no source filter),
    // guarantee at least 3 of the top results are case-law authorities so statutes
    // do not crowd them out due to the tier boost differential.
    if (forceLiveCaseLaw) {
      const CASE_LAW_SLOTS = 3;
      const assessForSlot = (authority: RetrievedAuthority): RetrievedAuthority | null => {
        const assessment = assessCandidateRelevance(authority, input);
        return assessment.admitted
          ? {
              ...authority,
              relevanceScore: assessment.score,
              relevanceReason: assessment.reason,
              relevanceGate: 'admitted',
            }
          : null;
      };
      const caseLawHits = pool
        .filter((a) => a.sourceTier === 'case_law')
        .map(assessForSlot)
        .filter((a): a is RetrievedAuthority => a !== null);
      const admittedExisting = reranked
        .filter((a) => a.sourceTier === 'case_law')
        .map(assessForSlot)
        .filter((a): a is RetrievedAuthority => a !== null);
      const admittedById = new Map(admittedExisting.map((authority) => [authority.id, authority]));
      reranked = reranked.map((authority) => admittedById.get(authority.id) ?? authority);
      const alreadyHasCaseLaw = admittedExisting.length >= CASE_LAW_SLOTS;
      if (!alreadyHasCaseLaw && caseLawHits.length > 0) {
        const rerankedIds = new Set(reranked.map((a) => a.id));
        const caseLawToInject = caseLawHits
          .filter((a) => !rerankedIds.has(a.id))
          .slice(0, CASE_LAW_SLOTS - admittedExisting.length);
        if (caseLawToInject.length > 0) {
          // Replace the lowest-ranked non-case entries; only admitted candidates
          // can consume a reserved case-law slot.
          const retained = [...reranked];
          for (const candidate of caseLawToInject) {
            let replaceAt = -1;
            for (let index = retained.length - 1; index >= 0; index -= 1) {
              if (retained[index].sourceTier !== 'case_law') {
                replaceAt = index;
                break;
              }
            }
            if (replaceAt >= 0) retained.splice(replaceAt, 1);
            retained.push(candidate);
          }
          reranked = retained.slice(0, rerankTop);
        }
      }
    }

    const sectionGap = requestedSectionMissingFromAuthorities(
      input.query,
      input.countryCode,
      reranked,
    );

    if (shouldBlockWebForBareAct(searchPlan.isBareActQuery, authorities, sectionGap.missing)) {
      authorities = authorities.filter((a) => a.sourceTier !== 'web');
      reranked = reranked.filter((a) => a.sourceTier !== 'web');
    }
    if (searchPlan.isBareActQuery && sectionGap.missing) {
      const bareHits = await this.bareActLookup.lookupSection(input.query, input.countryCode);
      if (bareHits.length > 0) {
        const boosted: RetrievedAuthority[] = bareHits.map((hit) => ({
          id: hit.id,
          title: hit.title,
          citation: hit.citation,
          sourceName: hit.sourceName,
          summary: hit.summary,
          fullText: hit.fullText,
          sourceUrl: hit.sourceUrl,
          sourceTier: 'primary',
        }));
        const seen = new Set(boosted.map((row) => row.id));
        reranked = [
          ...boosted,
          ...reranked.filter((row) => !seen.has(row.id)),
        ].slice(0, rerankTop);
      }
    }

    reranked = reranked.filter((authority) => {
      if (!isHeadingOnlyStatuteAuthority(authority)) return true;
      if (!rejectedCandidates.some((candidate) => candidate.authorityId === authority.id)) {
        rejectedCandidates.push({
          authorityId: authority.id,
          gate: 'heading_only_statute',
          reason: 'Heading-only statute section has no substantive operative text.',
        });
      }
      const rejectedSection =
        authority.section ??
        authority.citation?.match(/\b(?:s(?:ection)?\.?|§)\s*(\d+[A-Za-z0-9()/-]*)/i)?.[1];
      if (requestedSection && rejectedSection?.toUpperCase() === requestedSection.toUpperCase()) {
        exactSectionFound = false;
      }
      return false;
    });
    const provenanceTimestamp = new Date().toISOString();
    reranked = reranked.map((authority) => {
      if (authority.sourceProvenance) return authority;
      const text = authority.fullText?.trim() ?? authority.summary?.trim() ?? '';
      const official = /\b(?:e-?scr|india code|supreme court|high court|gazette|legislative)\b/i.test(
        `${authority.sourceName} ${authority.sourceUrl ?? ''}`,
      );
      const reported = /\b(?:scc|manupatra|taxmann)\b/i.test(authority.sourceName);
      return {
        ...authority,
        sourceProvenance: {
          provider: authority.sourceName,
          retrievedAt: provenanceTimestamp,
          canonicalIdentity: authority.citation ?? authority.neutralCitation ?? authority.title,
          canonicalUrl: authority.sourceUrl ?? undefined,
          documentHash: text ? hashPrompt(text) : undefined,
          completeness:
            authority.fullText && authority.fullText.trim().length >= 1000
              ? ('COMPLETE' as const)
              : authority.fullText
                ? ('PARTIAL' as const)
                : authority.summary
                  ? ('EXCERPT' as const)
                  : ('UNKNOWN' as const),
          extractionMethod:
            authority.sourceTier === 'web'
              ? ('WEB_SCRAPE' as const)
              : authority.sourceTier === 'seed'
                ? ('UNKNOWN' as const)
                : ('STRUCTURED_API' as const),
          authoritativeStatus: official
            ? ('OFFICIAL' as const)
            : reported
              ? ('REPORTED' as const)
              : authority.sourceTier === 'web'
                ? ('SECONDARY' as const)
                : authority.sourceTier === 'case_law'
                  ? ('AGGREGATOR' as const)
                  : ('CURATED' as const),
          language: { extractedLanguage: 'en', translated: false },
          extractorVersion: 'retrieval-orchestrator-v11',
        },
      };
    });

    const primaryTierCount = reranked.filter(
      (a) => a.sourceTier === 'primary' || a.sourceTier === 'seed',
    ).length;

    const requestedSectionMeta =
      requestedActId && requestedSection
        ? {
            actId: requestedActId,
            section: requestedSection,
            statuteShortName: parsed.statute?.shortName,
          }
        : undefined;

    const result: LegalRetrievalResult = {
      authorities: reranked,
      isBareActQuery: searchPlan.isBareActQuery,
      confidence:
        primaryTierCount >= 2 ? 'high' : primaryTierCount >= 1 ? 'medium' : 'low',
      primaryTierCount,
      queryHash,
      requestedSection: requestedSectionMeta,
      // undefined = no section requested; true = found; false = searched but absent
      exactSectionFound: requestedActId && requestedSection ? exactSectionFound : undefined,
      suggestedSections: allSuggestedSections.length > 0 ? allSuggestedSections : undefined,
      domainFitLow: domainFitRatio(reranked, input.legalDomain) < 0.6,
      rejectedCandidates: rejectedCandidates.length > 0 ? rejectedCandidates : undefined,
      connectorDiagnostics,
      retrievalTimings: {
        local: localMs,
        total: Date.now() - retrievalStartedAt,
      },
    };

    await this.cacheService.set(cacheKey, result);
    return result;
  }

  private async supplementWithLiveConnectors(
    authorities: RetrievedAuthority[],
    input: StructuredLegalQueryContext & {
      countryCode: string;
      query: string;
      searchQueries?: string[];
      jurisdiction?: string;
      legalDomain?: import('@/ai/legal-research/legal-research-classifier.service').LegalDomain;
      practiceArea?: string;
      isBareActQuery?: boolean;
      skipTavilyInFast?: boolean;
      skipIndiaKanoon?: boolean;
      skipTavily?: boolean;
      skipLiveRegulations?: boolean;
      isFastMode?: boolean;
      /** When true, skip the hasEnoughLocal short-circuit so live case-law connectors always run. */
      forceCaseLaw?: boolean;
      knowledgeSources?: string[];
      diagnostics?: NonNullable<LegalRetrievalResult['connectorDiagnostics']>;
    },
  ): Promise<RetrievedAuthority[]> {
    const hasEnoughLocal =
      authorities.length >= LegalRetrievalOrchestrator.MIN_AUTHORITIES;
    // Only short-circuit when we're NOT explicitly asked for case law. Without this,
    // ≥3 statute hits prevent Kanoon/CourtListener from ever running.
    const forceRegulations =
      input.countryCode.toUpperCase() === 'IN' &&
      input.knowledgeSources?.includes('regulations') === true;
    if (
      hasEnoughLocal &&
      !input.isBareActQuery &&
      !input.forceCaseLaw &&
      !forceRegulations
    ) {
      return authorities;
    }

    const localCorpusHits = authorities.filter(
      (a) => a.sourceTier !== 'web' && a.sourceTier !== 'case_law',
    ).length;
    const sectionGap = requestedSectionMissingFromAuthorities(
      input.query,
      input.countryCode,
      authorities,
    );
    if (
      input.isBareActQuery &&
      localCorpusHits >= LegalRetrievalOrchestrator.MIN_AUTHORITIES &&
      !sectionGap.missing &&
      !input.forceCaseLaw
    ) {
      return authorities;
    }

    const supplemented = [...authorities];
    const seenCitations = new Set(
      supplemented.map((a) => a.citation).filter(Boolean) as string[],
    );
    const seenUrls = new Set<string>();
    const country = input.countryCode.toUpperCase();
    const connectorQueries = [
      ...new Set(
        [
          input.query,
          ...(input.searchQueries ?? []),
          ...(isContractActWaiverQuery(input.query)
            ? [...CONTRACT_ACT_WAIVER_CASE_QUERIES]
            : []),
          ...(isIndiaTenantEvictionQuery(input.query)
            ? [...INDIA_TENANT_EVICTION_CASE_QUERIES]
            : []),
        ].filter(Boolean),
      ),
    ];
    const allowCaseLaw =
      !input.knowledgeSources || input.knowledgeSources.includes('case_law');
    const allowWeb = !input.knowledgeSources || input.knowledgeSources.includes('web');
    const allowStatutes =
      !input.knowledgeSources ||
      input.knowledgeSources.includes('statutes') ||
      input.knowledgeSources.includes('primary');
    const allowPrimary =
      !input.knowledgeSources ||
      input.knowledgeSources.includes('primary') ||
      input.knowledgeSources.includes('statutes') ||
      input.knowledgeSources.includes('regulations');

    const extConcurrency = resolvePositiveInt(
      this.configService.get('LEGAL_EXTERNAL_SEARCH_CONCURRENCY'),
      2,
    );
    const externalTimeoutMs = resolvePositiveInt(
      this.configService.get('LEGAL_EXTERNAL_SEARCH_TIMEOUT_MS'),
      8000,
    );
    const externalLimit = pLimit(Math.max(1, extConcurrency));

    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      let timeout: NodeJS.Timeout | undefined;
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Connector timeout after ${ms}ms`)),
            ms,
          );
        }),
      ]).finally(() => {
        if (timeout) clearTimeout(timeout);
      });
    };

    const mergeHits = (hits: RetrievedAuthority[]) => {
      for (const hit of hits) {
        if (hit.citation && seenCitations.has(hit.citation)) continue;
        if (hit.sourceUrl && seenUrls.has(hit.sourceUrl)) continue;
        supplemented.push(hit);
        if (hit.citation) seenCitations.add(hit.citation);
        if (hit.sourceUrl) seenUrls.add(hit.sourceUrl);
      }
    };

    const runCountryConnector = async (): Promise<RetrievedAuthority[]> => {
      const startedAt = Date.now();
      const hits: RetrievedAuthority[] = [];

      if (country === 'IN' && allowCaseLaw && this.licensedCaseLaw?.isConfigured()) {
        const licensedStartedAt = Date.now();
        const providers = this.licensedCaseLaw.configuredProviders();
        const licensedSettled = await Promise.allSettled(
          providers.flatMap((provider) =>
            connectorQueries.slice(0, input.isFastMode ? 1 : 3).map((query) =>
              externalLimit(() =>
                withTimeout(
                  this.licensedCaseLaw!.search({
                    query,
                    practiceArea: input.practiceArea,
                    provider,
                    limit: input.isFastMode ? 3 : 5,
                  }),
                  externalTimeoutMs,
                ),
              ),
            ),
          ),
        );
        let licensedHitCount = 0;
        for (const settled of licensedSettled) {
          if (settled.status === 'rejected') continue;
          for (const licensed of settled.value) {
            const court = normalizeCourtMetadata(licensed.court);
            licensedHitCount += 1;
            hits.push({
              id: buildLicensedAuthorityId(licensed.id),
              title: licensed.title,
              citation: licensed.citation,
              neutralCitation: licensed.neutralCitation,
              sourceName:
                licensed.provider === 'scc'
                  ? 'SCC Online'
                  : licensed.provider === 'manupatra'
                    ? 'Manupatra'
                    : 'Taxmann',
              summary: licensed.summary,
              fullText: licensed.fullText,
              sourceUrl: licensed.sourceUrl,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: court.court,
              courtTierRank: court.courtTierRank,
              practiceAreas: licensed.practiceAreas,
            });
          }
        }
        input.diagnostics?.push({
          provider: 'india-licensed',
          status: 'searched',
          durationMs: Date.now() - licensedStartedAt,
          hitCount: licensedHitCount,
        });
      }

      if (
        country === 'IN' &&
        allowCaseLaw &&
        this.indiaKanoon.isConfigured() &&
        !input.skipIndiaKanoon
      ) {
        if (this.indiaKanoon.isCircuitOpen()) {
          input.diagnostics?.push({
            provider: 'india-kanoon',
            status: 'circuit_open',
            hitCount: 0,
            message: 'Skipped — India Kanoon circuit already open',
          });
        } else {
          const ikPlan = this.indiaKanoonQueryBuilder.build({
            query: input.query,
            countryCode: input.countryCode,
            legalDomain: input.legalDomain,
            practiceArea: input.practiceArea,
            jurisdiction: input.jurisdiction,
            legalIssues: input.legalIssues,
            statuteSections: input.statuteSections,
            doctrines: input.doctrines,
            proceduralPosture: input.proceduralPosture,
            propositionPhrases: input.propositionPhrases,
            entities: input.entities,
            remedies: input.remedies,
            requestedAuthorityTypes: input.requestedAuthorityTypes,
            issueDecomposition: input.issueDecomposition,
          });
          // Sequential + hard-capped: parallel fan-out races the circuit breaker open.
          const ikQueries = ikPlan.allQueries
            .filter((query) => /doctypes:(?!laws\b)[a-z_]+\b/.test(query))
            .slice(0, input.isFastMode ? 2 : 4);
          const ikResults = [];
          for (const q of ikQueries) {
            if (this.indiaKanoon.isCircuitOpen()) {
              input.diagnostics?.push({
                provider: 'india-kanoon',
                status: 'circuit_open',
                hitCount: 0,
                message: 'Short-circuited remaining IK queries after circuit open',
              });
              break;
            }
            const diagnosticQuery = q.slice(0, 160);
            try {
              const outcome = await withTimeout(
                this.indiaKanoon.searchWithOutcome({
                  query: q,
                  limit: input.isFastMode ? 3 : 5,
                  skipEnrich: input.isFastMode,
                  fetchFullText: !input.isFastMode,
                }),
                externalTimeoutMs,
              );
              input.diagnostics?.push({
                provider: 'india-kanoon',
                status: outcome.status,
                hitCount: outcome.hitCount,
                message: outcome.errorMessage,
              });
              this.logger.log(
                `IK orchestrator status=${outcome.status} query="${diagnosticQuery}" count=${outcome.hitCount}`,
              );
              for (const ik of outcome.results) {
                const court = normalizeCourtMetadata(ik.court);
                ikResults.push(ik);
                hits.push({
                  id: ik.id,
                  title: ik.title,
                  citation: ik.citation,
                  sourceName: court.court ?? 'Published judgment',
                  summary: ik.summary,
                  fullText: ik.fullText,
                  sourceUrl: ik.sourceUrl,
                  sourceTier: 'case_law',
                  authorityType: 'CASE',
                  court: court.court,
                  decisionDate: ik.decisionDate,
                  courtTierRank: court.courtTierRank,
                });
              }
              if (
                outcome.status === 'unauthorized' ||
                outcome.status === 'circuit_open' ||
                outcome.status === 'rate_limited'
              ) {
                break;
              }
            } catch (err) {
              input.diagnostics?.push({
                provider: 'india-kanoon',
                status: 'error',
                hitCount: 0,
                message: String(err),
              });
              this.logger.warn(
                `IK orchestrator status=error query="${diagnosticQuery}" count=0 reason="${String(err)}"`,
              );
              if (this.indiaKanoon.isCircuitOpen()) break;
            }
          }
          if (ikResults.length > 0) {
            this.legalSourceService.scheduleIndiaKanoonPersist(ikResults);
          }
        }
      } else if (
        country === 'IN' &&
        allowCaseLaw &&
        input.skipIndiaKanoon
      ) {
        input.diagnostics?.push({
          provider: 'india-kanoon',
          status: 'circuit_open',
          hitCount: 0,
          message: 'Skipped — run-scoped India Kanoon short-circuit',
        });
      }

      if (
        country === 'IN' &&
        forceRegulations &&
        !input.skipLiveRegulations &&
        !this.rbiRegulations.isCircuitOpen()
      ) {
        const regulationQueries = connectorQueries.slice(0, input.isFastMode ? 1 : 2);
        const regulationSettled = await Promise.allSettled(
          regulationQueries.map((query) =>
            externalLimit(() =>
              withTimeout(
                this.rbiRegulations.search(query, input.isFastMode ? 2 : 5),
                externalTimeoutMs,
              ),
            ),
          ),
        );
        for (const settled of regulationSettled) {
          if (settled.status === 'rejected') {
            this.logger.warn(`RBI regulation query failed: ${String(settled.reason)}`);
            continue;
          }
          for (const regulation of settled.value) {
            hits.push({
              id: buildRbiAuthorityId(regulation),
              title: regulation.title,
              citation: regulation.instrumentNumber,
              sourceName: regulation.regulator,
              summary: regulation.fullText.slice(0, 600),
              fullText: regulation.fullText,
              sourceUrl: regulation.sourceUrl,
              sourceTier: 'primary',
              authorityType: 'REGULATION',
              decisionDate: regulation.issueDate,
              regulator: regulation.regulator,
              instrumentType: regulation.instrumentType,
              instrumentNumber: regulation.instrumentNumber,
              instrumentDate: regulation.issueDate,
            });
          }
        }
      }

      if (country === 'IN' && this.escr.isConfigured()) {
        const escrRows: EscrSearchHit[] = [];
        const escrSettled = await Promise.allSettled(
          connectorQueries.slice(0, 2).map((q) =>
            externalLimit(() =>
              withTimeout(this.escr.searchJudgmentsBroad(q, input.isFastMode ? 3 : 5), externalTimeoutMs),
            ),
          ),
        );
        for (const settled of escrSettled) {
          if (settled.status === 'rejected') continue;
          for (const row of settled.value) {
            const court = normalizeCourtMetadata(row.court);
            escrRows.push(row);
            hits.push({
              id: buildEscrAuthorityId(row.id),
              title: row.title,
              citation: row.citation,
              neutralCitation: row.neutralCitation,
              sourceName: 'e-SCR',
              court: court.court,
              decisionDate: row.decisionDate,
              summary: row.summary,
              sourceUrl: row.sourceUrl,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              courtTierRank: court.courtTierRank ?? 0,
            });
          }
        }
        if (escrRows.length > 0) {
          this.legalSourceService.scheduleEscrPersist(escrRows);
        }
      }

      if (country === 'US' && this.courtListener.isConfigured()) {
        const clSettled = await Promise.allSettled(
          connectorQueries.map((q) =>
            externalLimit(() =>
              withTimeout(
                this.courtListener.search({ query: q, jurisdiction: input.jurisdiction, limit: 5 }),
                externalTimeoutMs,
              ),
            ),
          ),
        );
        for (const settled of clSettled) {
          if (settled.status === 'rejected') {
            this.logger.warn(`CourtListener query failed: ${String(settled.reason)}`);
            continue;
          }
          for (const cl of settled.value) {
            hits.push({
              id: cl.id,
              title: cl.title,
              citation: cl.citation,
              sourceName: 'CourtListener',
              summary: cl.summary,
              sourceUrl: cl.sourceUrl,
              sourceTier: 'case_law',
            });
          }
        }
      }

      if (country === 'KE') {
        // Kenya Law search/body fetch is slow; do not race under the global 8s default.
        const keTimeoutMs = Math.max(externalTimeoutMs, 35_000);
        const keBodyBudgetMs = 4_000;
        const kePlan = this.kenyaLawQueryBuilder.build({
          query: input.query,
          countryCode: 'KE',
          legalDomain: input.legalDomain,
          practiceArea: input.practiceArea,
          jurisdiction: input.jurisdiction,
          legalIssues: input.legalIssues,
          statuteSections: input.statuteSections,
          doctrines: input.doctrines,
          proceduralPosture: input.proceduralPosture,
          propositionPhrases: input.propositionPhrases,
          entities: input.entities,
          remedies: input.remedies,
          requestedAuthorityTypes: input.requestedAuthorityTypes,
          issueDecomposition: input.issueDecomposition,
        });
        const keQueries = kePlan.allQueries.slice(0, input.isFastMode ? 3 : 8);
        const statuteQueries = [
          ...new Set(
            [
              kePlan.statuteQuery,
              ...(input.statuteSections ?? []).slice(0, 3),
              ...keQueries.filter((q) =>
                /\b(act|regulation|constitution|evidence|protection|credit)\b/i.test(q),
              ),
            ].filter((q): q is string => !!q?.trim()),
          ),
        ].slice(0, input.isFastMode ? 2 : 4);

        const keSettled = allowCaseLaw
          ? await Promise.allSettled(
              keQueries.map((q) =>
                externalLimit(() =>
                  withTimeout(
                    this.kenyaLawJudgments.searchJudgments(q, 5),
                    keTimeoutMs,
                  ),
                ),
              ),
            )
          : [];
        const legisSettled =
          allowStatutes || allowPrimary
            ? await Promise.allSettled(
                statuteQueries.map((q) =>
                  externalLimit(() =>
                    withTimeout(
                      this.kenyaLawJudgments.searchLegislation(q, 5),
                      keTimeoutMs,
                    ),
                  ),
                ),
              )
            : [];

        const withBodyBudget = async <T>(
          promise: Promise<T> | undefined,
        ): Promise<T | null> => {
          if (!promise) return null;
          return Promise.race([
            promise.then((value) => value ?? null).catch(() => null),
            new Promise<null>((resolve) => {
              const timer = setTimeout(() => resolve(null), keBodyBudgetMs);
              timer.unref?.();
            }),
          ]);
        };

        const keHits: KenyaLawSearchHit[] = [];
        const seenKeIds = new Set<string>();
        for (const settled of keSettled) {
          if (settled.status === 'rejected') {
            this.logger.warn(`Kenya Law judgment search failed: ${String(settled.reason)}`);
            continue;
          }
          for (const hit of settled.value) {
            if (seenKeIds.has(hit.id)) continue;
            seenKeIds.add(hit.id);
            keHits.push(hit);
            const body = await withBodyBudget(
              this.kenyaLawJudgments.fetchJudgmentBody?.(hit.sourceUrl),
            );
            const court = normalizeCourtMetadata(body?.court ?? hit.court);
            const thinText =
              body?.fullText ||
              hit.summary ||
              [hit.title, hit.citation ?? ''].filter(Boolean).join('\n');
            hits.push({
              id: hit.id,
              title: body?.title || hit.title,
              citation: body?.citation ?? hit.citation,
              sourceName: 'Kenya Law',
              summary: hit.summary ?? thinText.slice(0, 600),
              fullText: thinText || null,
              sourceUrl: hit.sourceUrl,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: court.court,
              courtTierRank: court.courtTierRank,
              decisionDate: hit.decisionDate,
            });
          }
        }
        for (const settled of legisSettled) {
          if (settled.status === 'rejected') {
            this.logger.warn(
              `Kenya Law legislation search failed: ${String(settled.reason)}`,
            );
            continue;
          }
          for (const hit of settled.value) {
            if (seenKeIds.has(hit.id)) continue;
            seenKeIds.add(hit.id);
            keHits.push(hit);
            const thinText =
              hit.summary ||
              [hit.title, hit.citation ?? ''].filter(Boolean).join('\n');
            hits.push({
              id: hit.id,
              title: hit.title,
              citation: hit.citation,
              sourceName: 'Kenya Law',
              summary: hit.summary ?? thinText.slice(0, 600),
              fullText: thinText || null,
              sourceUrl: hit.sourceUrl,
              sourceTier: 'primary',
              authorityType: 'STATUTE',
            });
          }
        }
        if (keHits.length > 0) {
          this.legalSourceService.scheduleKenyaPersist(keHits);
        }
      }

      const admitted = hits
        .map((hit) => {
          if (hit.sourceTier !== 'case_law') return hit;
          const assessment = assessCandidateRelevance(
            hit,
            input,
            country === 'KE' ? { relaxSubjectAnchor: true } : undefined,
          );
          if (!assessment.admitted) {
            this.logger.debug(
              `Live orchestrator candidate status=rejected id=${hit.id} score=${assessment.score} code=${assessment.rejectionCode ?? 'UNKNOWN'} reason="${assessment.reason}"`,
            );
            return null;
          }
          return {
            ...hit,
            relevanceScore: assessment.score,
            relevanceReason: assessment.reason,
            relevanceGate: 'admitted' as const,
          };
        })
        .filter((hit): hit is RetrievedAuthority => hit !== null);
      input.diagnostics?.push({
        provider: country === 'IN' ? 'india-live' : country === 'US' ? 'courtlistener' : 'kenyalaw',
        status: 'searched',
        durationMs: Date.now() - startedAt,
        hitCount: admitted.length,
      });
      return admitted;
    };

    const isKenyaLawUrl = (url?: string | null): boolean =>
      !!url && /(?:https?:\/\/)?(?:www\.)?(?:new\.)?kenyalaw\.org\//i.test(url);

    const runTavilyConnector = async (): Promise<RetrievedAuthority[]> => {
      const startedAt = Date.now();
      const caseLawHits = supplemented.filter((authority) => authority.sourceTier === 'case_law');
      const ikProviderFailed = input.diagnostics?.some(
        (d) =>
          d.provider === 'india-kanoon' &&
          (d.status === 'unauthorized' ||
            d.status === 'timeout' ||
            d.status === 'circuit_open' ||
            d.status === 'rate_limited'),
      );
      const needsOfficialCaseLawFallback =
        allowCaseLaw &&
        (caseLawHits.length < 2 || ikProviderFailed) &&
        (country === 'IN' || country === 'KE');
      const needsTavily =
        input.isBareActQuery ||
        supplemented.length < LegalRetrievalOrchestrator.MIN_AUTHORITIES ||
        needsOfficialCaseLawFallback;
      if (
        (!allowWeb && !needsOfficialCaseLawFallback) ||
        input.skipTavilyInFast ||
        input.skipTavily ||
        this.tavilySearch.isCircuitOpen() ||
        !needsTavily ||
        !this.tavilySearch.isConfigured()
      ) {
        input.diagnostics?.push({
          provider: needsOfficialCaseLawFallback ? 'tavily-case-law-fallback' : 'tavily',
          status:
            input.skipTavily || this.tavilySearch.isCircuitOpen()
              ? 'circuit_open'
              : 'skipped',
          durationMs: Date.now() - startedAt,
          hitCount: 0,
          message:
            input.skipTavily || this.tavilySearch.isCircuitOpen()
              ? 'Skipped — Tavily circuit/short-circuit active'
              : undefined,
        });
        return [];
      }

      const hits: RetrievedAuthority[] = [];
      const tavilyQueries = connectorQueries.slice(0, input.isFastMode ? 1 : 2);
      for (const q of tavilyQueries) {
        if (this.tavilySearch.isCircuitOpen()) {
          input.diagnostics?.push({
            provider: needsOfficialCaseLawFallback ? 'tavily-case-law-fallback' : 'tavily',
            status: 'circuit_open',
            hitCount: hits.length,
            message: 'Short-circuited remaining Tavily queries after circuit open',
          });
          break;
        }
        try {
          const rows = await withTimeout(
            this.tavilySearch.search({ query: q, countryCode: country, limit: 6 }),
            Math.max(externalTimeoutMs, country === 'KE' ? 35_000 : externalTimeoutMs),
          );
          for (const tv of rows) {
            const officialIndia = isOfficialIndianJudgmentUrl(tv.sourceUrl);
            const kenyaLaw = country === 'KE' && isKenyaLawUrl(tv.sourceUrl);
            const officialCaseLaw = officialIndia || kenyaLaw;
            const isLegislation =
              kenyaLaw && /\/akn\/ke\/act\//i.test(tv.sourceUrl ?? '');
            const candidate: RetrievedAuthority = {
              id: tv.id,
              title: tv.title,
              citation: tv.citation,
              sourceName: kenyaLaw
                ? 'Kenya Law'
                : officialIndia
                  ? tv.court ?? 'Official judgment'
                  : 'Tavily Web Search',
              summary: tv.summary,
              fullText: tv.summary ?? null,
              sourceUrl: tv.sourceUrl,
              sourceTier: isLegislation
                ? 'primary'
                : officialCaseLaw
                  ? 'case_law'
                  : resolveSourceTier('Tavily Web Search'),
              authorityType: isLegislation
                ? 'STATUTE'
                : officialCaseLaw
                  ? 'CASE'
                  : undefined,
              court: tv.court,
              decisionDate: tv.decisionDate,
            };
            if (officialCaseLaw) {
              const relevance = assessCandidateRelevance(candidate, input);
              if (!relevance.admitted) continue;
              candidate.relevanceScore = relevance.score;
              candidate.relevanceReason = relevance.reason;
              candidate.relevanceGate = 'admitted';
            }
            hits.push(candidate);
          }
        } catch (err) {
          this.logger.warn(`Tavily query failed: ${String(err)}`);
        }
      }
      input.diagnostics?.push({
        provider: needsOfficialCaseLawFallback ? 'tavily-case-law-fallback' : 'tavily',
        status: this.tavilySearch.isCircuitOpen() && hits.length === 0 ? 'circuit_open' : 'searched',
        durationMs: Date.now() - startedAt,
        hitCount: hits.length,
      });
      return hits;
    };

    const countryEligible =
      (country === 'IN' &&
        ((allowCaseLaw &&
          !input.skipIndiaKanoon &&
          (this.indiaKanoon.isConfigured() ||
            this.licensedCaseLaw?.isConfigured() === true)) ||
          (forceRegulations && !input.skipLiveRegulations))) ||
      (country === 'US' && this.courtListener.isConfigured()) ||
      country === 'KE';
    const caseLawCount = supplemented.filter(
      (authority) => authority.sourceTier === 'case_law',
    ).length;
    const tavilyEligible =
      !input.skipTavilyInFast &&
      !input.skipTavily &&
      !this.tavilySearch.isCircuitOpen() &&
      this.tavilySearch.isConfigured() &&
      (allowWeb || (country === 'IN' && allowCaseLaw) || (country === 'KE' && allowCaseLaw)) &&
      (input.isBareActQuery ||
        supplemented.length < LegalRetrievalOrchestrator.MIN_AUTHORITIES ||
        (country === 'IN' && allowCaseLaw && caseLawCount < 2) ||
        (country === 'KE' && allowCaseLaw && caseLawCount < 2));

    if (countryEligible && tavilyEligible) {
      const [countryHits, tavilyHits] = await Promise.all([
        runCountryConnector(),
        runTavilyConnector(),
      ]);
      mergeHits(countryHits);
      mergeHits(tavilyHits);
    } else if (countryEligible) {
      mergeHits(await runCountryConnector());
    } else if (tavilyEligible) {
      mergeHits(await runTavilyConnector());
    }

    return supplemented;
  }

  buildAuthorityContextBlock(authorities: RetrievedAuthority[]): string {
    const admissible = authorities.filter((authority) => !isHeadingOnlyStatuteAuthority(authority));
    if (admissible.length === 0) return 'No authorities retrieved.';
    const tierSummary = summarizeSourceTiers(admissible.map((a) => a.sourceTier));
    const rows = admissible.map(
      (a, i) =>
        `[${i + 1}] ${a.title}${a.citation ? ` (${a.citation})` : ''} — ${a.sourceName}${a.sourceTier ? ` [${a.sourceTier}]` : ''}\n${a.fullText ?? a.summary ?? ''}`,
    );
    return `Retrieved authorities (${tierSummary}):\n${rows.join('\n\n')}`;
  }

  private resolvedSectionToAuthority(
    resolved: {
      actId: string;
      section: string;
      title?: string | null;
      summary?: string | null;
      fullText?: string | null;
      sourceName?: string | null;
      sourceUrl?: string | null;
    },
    input: StructuredLegalQueryContext & { query: string; countryCode: string },
  ): RetrievedAuthority {
    const statute = findStatuteById(resolved.actId);
    const citation =
      statute != null
        ? formatSectionCitation(statute, resolved.section)
        : `Indian Contract Act s.${resolved.section}`;
    const id = this.bareActLookup.buildSectionId(
      input.countryCode.toUpperCase(),
      resolved.actId,
      resolved.section,
    );
    return {
      id,
      title: resolved.title ?? citation,
      citation,
      sourceName: resolved.sourceName ?? 'India manifest (primary PDF)',
      summary: resolved.summary ?? resolved.fullText?.slice(0, 400) ?? null,
      fullText: resolved.fullText ?? null,
      sourceUrl: resolved.sourceUrl ?? null,
      sourceTier: 'primary',
      authorityType: 'STATUTE',
      relevanceScore: 0.95,
      relevanceReason: 'contract-act-waiver sibling section',
      relevanceGate: 'admitted',
    };
  }
}
