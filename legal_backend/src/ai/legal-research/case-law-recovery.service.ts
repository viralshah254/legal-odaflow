import { Injectable, Logger, Optional } from '@nestjs/common';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { StructuredLegalQueryContext } from '@/legal-search/legal-retrieval.types';
import { IndiaKanoonConnector } from '@/legal-sources/connectors/india-kanoon.connector';
import { EscrConnector, buildEscrAuthorityId } from '@/legal-sources/connectors/escr.connector';
import { TavilySearchConnector } from '@/legal-sources/connectors/tavily-search.connector';
import {
  LicensedCaseLawConnector,
  buildLicensedAuthorityId,
} from '@/legal-sources/connectors/licensed-case-law.connector';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import {
  curatedCaseLawCorpusLookup,
  curatedCaseLawTopicSearch,
} from '@/legal-sources/curated-case-law-corpus';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';
import { KenyaLawQueryBuilderService } from './kenya-law-query-builder.service';
import { KeEvidenceIngestService } from './ke-evidence-ingest.service';
import { isQuoteableCaseAuthority } from './named-authority-check-pack';
import {
  buildOfficialJudgmentWebQuery,
  getOfficialCaseSources,
} from './official-case-sources';
import {
  CONTRACT_ACT_WAIVER_CASE_QUERIES,
  isContractActWaiverQuery,
} from '@/legal-search/contract-act-waiver.util';
import {
  INDIA_TENANT_EVICTION_CASE_QUERIES,
  isIndiaTenantEvictionQuery,
} from '@/legal-search/india-tenant-eviction.util';
import {
  CaseCandidateDiscoveryService,
  type CaseDiscoveryCandidate,
} from './case-candidate-discovery.service';
import type { LegalDomain } from './legal-research-classifier.service';

export interface CaseLawRecoveryResult {
  authorities: RetrievedAuthority[];
  unverifiedLeads: CaseDiscoveryCandidate[];
  diagnostics: Array<{
    provider: string;
    status: string;
    tier?: string;
    hitCount?: number;
    hydratedCount?: number;
    admittedCount?: number;
    rejectedCount?: number;
    rejectionReasons?: Record<string, number>;
    query?: string;
    message?: string;
  }>;
  discoveryDegraded?: boolean;
}

@Injectable()
export class CaseLawRecoveryService {
  private readonly logger = new Logger(CaseLawRecoveryService.name);

  constructor(
    private readonly queryBuilder: IndiaKanoonQueryBuilderService,
    private readonly discovery: CaseCandidateDiscoveryService,
    private readonly kenyaLawQueryBuilder: KenyaLawQueryBuilderService,
    private readonly keEvidenceIngest: KeEvidenceIngestService,
    @Optional() private readonly indiaKanoon?: IndiaKanoonConnector,
    @Optional() private readonly escr?: EscrConnector,
    @Optional() private readonly tavily?: TavilySearchConnector,
    @Optional() private readonly licensedCaseLaw?: LicensedCaseLawConnector,
  ) {}

  async recover(
    input: StructuredLegalQueryContext & {
      query: string;
      countryCode: string;
      jurisdiction?: string;
      legalDomain?: LegalDomain;
      practiceArea?: string;
      existingAuthorities?: RetrievedAuthority[];
      maxQueries?: number;
      allowInventingHops?: boolean;
    },
  ): Promise<CaseLawRecoveryResult> {
    if (input.countryCode.toUpperCase() === 'KE') {
      return this.recoverKenya(input);
    }

    const byId = new Map(
      (input.existingAuthorities ?? []).map((authority) => [authority.id, authority]),
    );
    const diagnostics: CaseLawRecoveryResult['diagnostics'] = [];
    const unverifiedLeads: CaseDiscoveryCandidate[] = [];

    const tiers = this.queryBuilder.buildRelaxationTiers({
      query: input.query,
      countryCode: input.countryCode,
      jurisdiction: input.jurisdiction,
      legalDomain: input.legalDomain,
      practiceArea: input.practiceArea,
      legalIssues: input.legalIssues,
      entities: input.entities,
      remedies: input.remedies,
      doctrines: input.doctrines,
      requestedAuthorityTypes: input.requestedAuthorityTypes,
      issueDecomposition: input.issueDecomposition,
      statuteSections: input.statuteSections,
      propositionPhrases: input.propositionPhrases,
    });

    if (isContractActWaiverQuery(input.query)) {
      tiers.unshift({
        tier: 'exact',
        queries: CONTRACT_ACT_WAIVER_CASE_QUERIES.map(
          (q) => `${q} doctypes:judgments`.trim().slice(0, 200),
        ),
      });
    }
    if (isIndiaTenantEvictionQuery(input.query)) {
      tiers.unshift({
        tier: 'exact',
        queries: INDIA_TENANT_EVICTION_CASE_QUERIES.map(
          (q) => `${q} doctypes:judgments`.trim().slice(0, 200),
        ),
      });
    }

    const tierBudget = input.maxQueries ?? 8;
    let queriesUsed = 0;

    const admitIkHit = (hit: {
      id: string;
      title: string;
      citation: string | null;
      court: string | null;
      summary: string | null;
      fullText?: string | null;
      sourceUrl: string;
      decisionDate: Date | null;
    }): string => {
      if (byId.has(hit.id)) return 'DUPLICATE';
      const fullText = hit.fullText ?? hit.summary ?? '';
      const relevance = assessCandidateRelevance(
        {
          title: hit.title,
          citation: hit.citation,
          summary: hit.summary,
          fullText,
          sourceTier: 'case_law',
          authorityType: 'CASE',
          court: hit.court,
        },
        input,
        { relaxSubjectAnchor: !isIndiaTenantEvictionQuery(input.query) },
      );
      if (!relevance.admitted) return relevance.rejectionCode ?? 'BELOW_THRESHOLD';
      byId.set(hit.id, {
        id: hit.id,
        title: hit.title,
        citation: hit.citation,
        sourceName: hit.court ?? 'Published judgment',
        summary: hit.summary,
        fullText: fullText || null,
        sourceUrl: hit.sourceUrl,
        sourceTier: 'case_law',
        authorityType: 'CASE',
        court: hit.court,
        decisionDate: hit.decisionDate,
        courtTierRank: /supreme court/i.test(hit.court ?? '') ? 0 : undefined,
        relevanceScore: relevance.score,
        relevanceReason: relevance.reason,
        relevanceGate: 'admitted',
      });
      return 'ADMITTED';
    };

    // India Kanoon indexes Indian judgments only; other jurisdictions go straight
    // to the official-source fallback below rather than burning the query budget.
    const canUseIndiaKanoon = input.countryCode.toUpperCase() === 'IN';
    for (const tier of canUseIndiaKanoon ? tiers : []) {
      if (queriesUsed >= tierBudget) break;
      for (const query of tier.queries) {
        if (queriesUsed >= tierBudget) break;
        queriesUsed += 1;
        if (!this.indiaKanoon?.isConfigured()) continue;
        const outcome = await this.indiaKanoon.searchWithOutcome({
          query,
          limit: 4,
          fetchFullText: true,
        });
        const rejectionReasons: Record<string, number> = {};
        let admittedCount = 0;
        for (const hit of outcome.results) {
          const admission = admitIkHit(hit);
          if (admission === 'ADMITTED') admittedCount += 1;
          else if (admission !== 'DUPLICATE') {
            rejectionReasons[admission] = (rejectionReasons[admission] ?? 0) + 1;
          }
        }
        diagnostics.push({
          provider: 'india-kanoon-relaxation',
          status: outcome.status,
          tier: tier.tier,
          hitCount: outcome.hitCount,
          hydratedCount: outcome.results.filter(
            (result) => (result.fullText?.trim().length ?? 0) > 0,
          ).length,
          admittedCount,
          rejectedCount: Object.values(rejectionReasons).reduce(
            (total, count) => total + count,
            0,
          ),
          rejectionReasons,
          query,
          message: outcome.errorMessage,
        });
        if (this.caseLawCount(byId) >= 3) break;
      }
      if (this.caseLawCount(byId) >= 3) break;
    }

    if (this.quoteableCaseCount(byId) < 2) {
      await this.searchOfficialCaseSources({
        query: input.query,
        countryCode: input.countryCode,
        practiceArea: input.practiceArea,
        byId,
        diagnostics,
        context: input,
      });
    }

    if (this.quoteableCaseCount(byId) >= 2) {
      return { authorities: [...byId.values()], unverifiedLeads, diagnostics };
    }

    if (!input.allowInventingHops) {
      return { authorities: [...byId.values()], unverifiedLeads, diagnostics };
    }

    const plan = await this.discovery.planCandidates(input);
    if (plan.degraded) {
      diagnostics.push({
        provider: 'case-candidate-discovery',
        status: 'degraded',
        message: plan.degradationReason,
      });
    }

    const topicCandidates = curatedCaseLawTopicSearch(input.query);
    const lookupQueries = [
      ...topicCandidates.map((entry) => entry.title),
      ...plan.candidates.flatMap((c) =>
        [c.citation, c.searchPhrase, c.title].filter(Boolean) as string[],
      ),
      ...plan.alternateSearchPhrases,
    ].slice(0, 10);

    let curatedAdmitted = 0;
    for (const lookup of lookupQueries) {
      for (const entry of curatedCaseLawCorpusLookup(lookup)) {
        const id = `india-corpus-${entry.id}`;
        if (byId.has(id)) continue;
        const fullText =
          entry.keyParagraphs?.join('\n\n') ?? entry.holding ?? entry.summary ?? '';
        const relevance = assessCandidateRelevance(
          {
            title: entry.title,
            citation: entry.citation,
            summary: entry.summary,
            fullText,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: entry.court,
          },
          input,
          { relaxSubjectAnchor: true },
        );
        if (!relevance.admitted) continue;
        byId.set(id, {
          id,
          title: entry.title,
          citation: entry.citation,
          neutralCitation: entry.neutralCitation ?? null,
          sourceName: entry.sourceName,
          summary: entry.summary,
          fullText: fullText || null,
          sourceUrl: entry.sourceUrl ?? null,
          sourceTier: 'case_law',
          authorityType: 'CASE',
          court: entry.court,
          courtTierRank: entry.courtLevel === 'supreme' ? 0 : entry.courtLevel === 'high' ? 1 : 2,
          relevanceScore: relevance.score,
          relevanceReason: relevance.reason,
          relevanceGate: 'admitted',
        });
        curatedAdmitted += 1;
      }

      if (this.escr?.isConfigured() && /\(\d{4}\)\s*\d+\s*(?:SCC|SCR)\s*\d+/i.test(lookup)) {
        const escrHit = await this.escr.lookupByReporterCitation(lookup);
        if (escrHit) {
          const body = await this.escr.fetchJudgmentBody(escrHit);
          const id = buildEscrAuthorityId(escrHit.id);
          if (!byId.has(id)) {
            const relevance = assessCandidateRelevance(
              {
                title: escrHit.title,
                citation: escrHit.citation,
                summary: escrHit.summary,
                fullText: body?.fullText ?? escrHit.summary ?? '',
                sourceTier: 'case_law',
                authorityType: 'CASE',
                court: escrHit.court,
              },
              input,
              { relaxSubjectAnchor: true },
            );
            if (relevance.admitted) {
              byId.set(id, {
                id,
                title: escrHit.title,
                citation: escrHit.citation,
                neutralCitation: escrHit.neutralCitation,
                sourceName: 'e-SCR',
                summary: escrHit.summary,
                fullText: body?.fullText ?? null,
                sourceUrl: escrHit.sourceUrl,
                sourceTier: 'case_law',
                authorityType: 'CASE',
                court: escrHit.court,
                courtTierRank: 0,
                relevanceScore: relevance.score,
                relevanceReason: relevance.reason,
                relevanceGate: 'admitted',
              });
            }
          }
        }
      }

      if (this.indiaKanoon?.isConfigured()) {
        const outcome = await this.indiaKanoon.searchWithOutcome({
          query: lookup.includes('doctypes:') ? lookup : `"${lookup}" doctypes:judgments`,
          limit: 3,
          fetchFullText: true,
        });
        diagnostics.push({
          provider: 'india-kanoon-candidate',
          status: outcome.status,
          hitCount: outcome.hitCount,
          hydratedCount: outcome.results.filter(
            (result) => (result.fullText?.trim().length ?? 0) > 0,
          ).length,
          query: lookup,
        });
        for (const hit of outcome.results) {
          admitIkHit(hit);
        }
      }
    }
    diagnostics.push({
      provider: 'curated-case-law',
      status: 'searched',
      tier: 'validated-fallback',
      hitCount: topicCandidates.length,
      admittedCount: curatedAdmitted,
      rejectedCount: Math.max(0, topicCandidates.length - curatedAdmitted),
    });

    for (const candidate of plan.candidates) {
      const matched = [...byId.values()].some(
        (a) =>
          a.sourceTier === 'case_law' &&
          (candidate.citation
            ? (a.citation?.includes(candidate.citation) ?? false) ||
              candidate.citation.includes(a.citation ?? '')
            : a.title.toLowerCase().includes(candidate.title.toLowerCase().slice(0, 20))),
      );
      if (!matched) unverifiedLeads.push(candidate);
    }

    return {
      authorities: [...byId.values()],
      unverifiedLeads,
      diagnostics,
      discoveryDegraded: plan.degraded,
    };
  }

  private async recoverKenya(
    input: StructuredLegalQueryContext & {
      query: string;
      countryCode: string;
      jurisdiction?: string;
      legalDomain?: LegalDomain;
      practiceArea?: string;
      existingAuthorities?: RetrievedAuthority[];
      maxQueries?: number;
      allowInventingHops?: boolean;
    },
  ): Promise<CaseLawRecoveryResult> {
    const byId = new Map(
      (input.existingAuthorities ?? []).map((authority) => [authority.id, authority]),
    );
    const diagnostics: CaseLawRecoveryResult['diagnostics'] = [];
    const unverifiedLeads: CaseDiscoveryCandidate[] = [];
    const tiers = this.kenyaLawQueryBuilder.buildRelaxationTiers({
      query: input.query,
      countryCode: 'KE',
      jurisdiction: input.jurisdiction,
      legalDomain: input.legalDomain,
      practiceArea: input.practiceArea,
      legalIssues: input.legalIssues,
      entities: input.entities,
      remedies: input.remedies,
      doctrines: input.doctrines,
      requestedAuthorityTypes: input.requestedAuthorityTypes,
      issueDecomposition: input.issueDecomposition,
      statuteSections: input.statuteSections,
      propositionPhrases: input.propositionPhrases,
    });

    const tierBudget = input.maxQueries ?? 8;
    let queriesUsed = 0;

    for (const tier of tiers) {
      if (queriesUsed >= tierBudget || this.caseLawCount(byId) >= 3) break;
      const remaining = Math.max(1, tierBudget - queriesUsed);
      const tierQueries = tier.queries.slice(0, remaining);
      queriesUsed += tierQueries.length;
      try {
        const ke = await this.keEvidenceIngest.retrieveAndIngest({
          ...input,
          query: tierQueries[0] ?? input.query,
          // Prefer tier queries via proposition/legalIssues so the builder expands them.
          legalIssues: [
            ...tierQueries,
            ...(input.legalIssues ?? []),
          ],
          existingAuthorities: [...byId.values()],
          limitPerQuery: 4,
          maxQueries: Math.min(tierQueries.length, remaining),
        });
        for (const authority of ke.authorities) {
          if (!byId.has(authority.id)) byId.set(authority.id, authority);
        }
        diagnostics.push({
          provider: 'kenya-law-relaxation',
          status: ke.searchStatus,
          tier: tier.tier,
          hitCount: ke.diagnostics.reduce((n, d) => n + d.hitCount, 0),
          admittedCount: ke.diagnostics.reduce((n, d) => n + d.admittedCount, 0),
          rejectedCount: ke.diagnostics.reduce((n, d) => n + d.rejectedCount, 0),
          query: tierQueries.join(' | '),
        });
      } catch (err) {
        this.logger.warn(
          `KE recovery tier ${tier.tier} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        diagnostics.push({
          provider: 'kenya-law-relaxation',
          status: 'error',
          tier: tier.tier,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!input.allowInventingHops) {
      return {
        authorities: [...byId.values()],
        unverifiedLeads,
        diagnostics,
      };
    }

    // Discovery only for unverified AI leads — do not run India curated corpus for KE.
    try {
      const plan = await this.discovery.planCandidates({ ...input, countryCode: 'KE' });
      if (plan.degraded) {
        diagnostics.push({
          provider: 'case-candidate-discovery',
          status: 'degraded',
          message: plan.degradationReason,
        });
      }
      for (const candidate of plan.candidates) {
        const matched = [...byId.values()].some(
          (a) =>
            a.sourceTier === 'case_law' &&
            (candidate.citation
              ? (a.citation?.includes(candidate.citation) ?? false) ||
                candidate.citation.includes(a.citation ?? '')
              : a.title
                  .toLowerCase()
                  .includes(candidate.title.toLowerCase().slice(0, 20))),
        );
        if (!matched) unverifiedLeads.push(candidate);
      }
    } catch (err) {
      this.logger.warn(
        `KE candidate discovery failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return {
      authorities: [...byId.values()],
      unverifiedLeads,
      diagnostics,
    };
  }

  private caseLawCount(byId: Map<string, RetrievedAuthority>): number {
    return [...byId.values()].filter((a) => a.sourceTier === 'case_law').length;
  }

  private quoteableCaseCount(byId: Map<string, RetrievedAuthority>): number {
    return [...byId.values()].filter(
      (a) => a.sourceTier === 'case_law' && isQuoteableCaseAuthority(a),
    ).length;
  }

  private issueSearchQuery(query: string): string {
    return query.replace(/\s+/g, ' ').trim().slice(0, 180);
  }

  private async searchOfficialCaseSources(input: {
    query: string;
    countryCode: string;
    practiceArea?: string;
    byId: Map<string, RetrievedAuthority>;
    diagnostics: CaseLawRecoveryResult['diagnostics'];
    context: StructuredLegalQueryContext;
  }): Promise<void> {
    const issueQuery = this.issueSearchQuery(input.query);
    // e-SCR only publishes Indian Supreme Court judgments.
    const escr = input.countryCode.toUpperCase() === 'IN' ? this.escr : undefined;
    if (escr?.isConfigured()) {
      try {
        const hits = await escr.searchJudgmentsBroad(issueQuery, 4);
        let admitted = 0;
        for (const hit of hits.slice(0, 3)) {
          const body = await escr.fetchJudgmentBody(hit);
          const quote = (body?.fullText ?? hit.summary ?? '').trim();
          const sourceUrl = hit.sourceUrl;
          if (!/^https?:\/\//i.test(sourceUrl) || quote.length < 80) continue;
          const id = buildEscrAuthorityId(hit.id);
          if (input.byId.has(id)) continue;
          const relevance = assessCandidateRelevance(
            {
              title: hit.title,
              citation: hit.citation,
              summary: hit.summary,
              fullText: quote,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: hit.court,
            },
            { ...input.context, query: input.query, countryCode: input.countryCode },
            { relaxSubjectAnchor: true },
          );
          if (!relevance.admitted) continue;
          input.byId.set(id, {
            id,
            title: hit.title,
            citation: hit.citation,
            neutralCitation: hit.neutralCitation,
            sourceName: 'e-SCR',
            summary: hit.summary ?? quote.slice(0, 400),
            fullText: quote,
            sourceUrl,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: hit.court ?? 'Supreme Court of India',
            courtTierRank: 0,
            relevanceScore: relevance.score,
            relevanceReason: relevance.reason,
            relevanceGate: 'admitted',
          });
          admitted += 1;
        }
        input.diagnostics.push({
          provider: 'e-scr-issue-search',
          status: hits.length > 0 ? 'searched' : 'no_hits',
          hitCount: hits.length,
          admittedCount: admitted,
          query: issueQuery,
        });
      } catch (err) {
        input.diagnostics.push({
          provider: 'e-scr-issue-search',
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          query: issueQuery,
        });
      }
    }

    if (this.quoteableCaseCount(input.byId) >= 2) return;

    if (this.tavily?.isConfigured() && !this.tavily.isCircuitOpen()) {
      try {
        const results = await this.tavily.search({
          query: buildOfficialJudgmentWebQuery(issueQuery, input.countryCode),
          countryCode: input.countryCode,
          limit: 4,
        });
        const { judgmentHints } = getOfficialCaseSources(input.countryCode);
        let admitted = 0;
        for (const hit of results) {
          const quote = (hit.summary ?? '').trim();
          if (!/^https?:\/\//i.test(hit.sourceUrl) || quote.length < 80) continue;
          if (!judgmentHints.test(`${hit.title} ${quote}`)) continue;
          if (input.byId.has(hit.id)) continue;
          const relevance = assessCandidateRelevance(
            {
              title: hit.title,
              citation: hit.citation,
              summary: hit.summary,
              fullText: quote,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: hit.court,
            },
            { ...input.context, query: input.query, countryCode: input.countryCode },
            { relaxSubjectAnchor: true },
          );
          if (!relevance.admitted) continue;
          input.byId.set(hit.id, {
            id: hit.id,
            title: hit.title,
            citation: hit.citation,
            sourceName: hit.court ?? 'Official court web',
            summary: quote.slice(0, 400),
            fullText: quote,
            sourceUrl: hit.sourceUrl,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: hit.court,
            relevanceScore: relevance.score,
            relevanceReason: relevance.reason,
            relevanceGate: 'admitted',
          });
          admitted += 1;
        }
        input.diagnostics.push({
          provider: 'tavily-official-courts',
          status: results.length > 0 ? 'searched' : 'no_hits',
          hitCount: results.length,
          admittedCount: admitted,
          query: issueQuery,
        });
      } catch (err) {
        input.diagnostics.push({
          provider: 'tavily-official-courts',
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          query: issueQuery,
        });
      }
    }

    if (this.quoteableCaseCount(input.byId) >= 2) return;

    if (this.licensedCaseLaw?.isConfigured()) {
      try {
        const hits = await this.licensedCaseLaw.search({
          query: issueQuery,
          practiceArea: input.practiceArea,
          limit: 4,
        });
        let admitted = 0;
        for (const hit of hits) {
          const quote = (hit.fullText ?? hit.summary ?? '').trim();
          const url = hit.sourceUrl ?? '';
          if (quote.length < 80 || !/^https?:\/\//i.test(url)) continue;
          const id = buildLicensedAuthorityId(hit.id);
          if (input.byId.has(id)) continue;
          const relevance = assessCandidateRelevance(
            {
              title: hit.title,
              citation: hit.citation,
              summary: hit.summary,
              fullText: quote,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: hit.court,
            },
            { ...input.context, query: input.query, countryCode: input.countryCode },
            { relaxSubjectAnchor: true },
          );
          if (!relevance.admitted) continue;
          input.byId.set(id, {
            id,
            title: hit.title,
            citation: hit.citation,
            neutralCitation: hit.neutralCitation,
            sourceName: `Licensed (${hit.provider})`,
            summary: (hit.summary ?? quote).slice(0, 400),
            fullText: quote,
            sourceUrl: url,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: hit.court,
            relevanceScore: relevance.score,
            relevanceReason: relevance.reason,
            relevanceGate: 'admitted',
          });
          admitted += 1;
        }
        input.diagnostics.push({
          provider: 'licensed-case-law',
          status: hits.length > 0 ? 'searched' : 'no_hits',
          hitCount: hits.length,
          admittedCount: admitted,
          query: issueQuery,
        });
      } catch (err) {
        input.diagnostics.push({
          provider: 'licensed-case-law',
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          query: issueQuery,
        });
      }
    }
  }
}
