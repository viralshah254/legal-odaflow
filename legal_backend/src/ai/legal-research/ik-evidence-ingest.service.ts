import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  IndiaKanoonConnector,
  type IndiaKanoonResult,
} from '@/legal-sources/connectors/india-kanoon.connector';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { StructuredLegalQueryContext } from '@/legal-search/legal-retrieval.types';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import type { EvidenceCase, EvidencePassage, LegalEvidencePack } from './legal-evidence-pack.service';
import { LegalEvidencePackService } from './legal-evidence-pack.service';
import { IndiaKanoonQueryBuilderService } from './india-kanoon-query-builder.service';
import type { LegalDomain } from './legal-research-classifier.service';

import type { ConnectorSearchStatus } from '@/legal-sources/connectors/connector-outcome.types';

export type CaseLawSearchStatus = ConnectorSearchStatus;

export interface IkQueryDiagnostic {
  query: string;
  status: CaseLawSearchStatus;
  hitCount: number;
  admittedCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
}

export interface IkMultiQueryPlan {
  issueQuery: string;
  statuteQuery?: string;
  proceduralQuery?: string;
  bindingQuery?: string;
  jurisdictionQuery?: string;
  allQueries: string[];
  fragmentQuery: string;
}

export interface UnsupportedClaimRepairTarget {
  issueId: string;
  claimId: string;
  claimText: string;
  evidenceIds?: string[];
  supportState?: string;
  reason?: string;
}

export interface IkUnsupportedClaimRepairResult {
  /** Always one: callers must not recursively invoke another repair pass. */
  repairPass: 1;
  attemptedClaimIds: string[];
  authorities: RetrievedAuthority[];
  packDelta: EvidenceCase[];
  queries: string[];
  searchStatus: CaseLawSearchStatus;
}

/**
 * Live case-law API as retrieval + passage source only.
 * Hits are ingested into the locked evidence pack and must pass the same
 * identity / quotation / passage gates — never treated as pre-verified.
 */
@Injectable()
export class IkEvidenceIngestService {
  private readonly logger = new Logger(IkEvidenceIngestService.name);
  private readonly snapshotCache = new Map<
    string,
    { documentHash: string; retrievedAt: string; fullText: string; result: IndiaKanoonResult }
  >();

  constructor(
    private readonly indiaKanoon: IndiaKanoonConnector,
    private readonly evidencePackService: LegalEvidencePackService,
    private readonly queryBuilder: IndiaKanoonQueryBuilderService,
  ) {}

  planQueries(input: StructuredLegalQueryContext & {
    query: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    skipProceduralQuery?: boolean;
  }): IkMultiQueryPlan {
    const built = this.queryBuilder.build(input);
    return {
      issueQuery: built.caseLawQuery,
      bindingQuery: built.bindingQuery,
      statuteQuery: built.statuteQuery,
      jurisdictionQuery: built.jurisdictionQuery,
      proceduralQuery: input.skipProceduralQuery ? undefined : built.jurisdictionQuery,
      allQueries: built.allQueries,
      fragmentQuery: this.queryBuilder.fragmentQuery(input.query, input),
    };
  }

  async retrieveAndIngest(input: StructuredLegalQueryContext & {
    query: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    limitPerQuery?: number;
    maxQueries?: number;
    existingAuthorities?: RetrievedAuthority[];
    skipProceduralQuery?: boolean;
  }): Promise<{
    authorities: RetrievedAuthority[];
    packDelta: EvidenceCase[];
    queries: string[];
    searchStatus: CaseLawSearchStatus;
    diagnostics: IkQueryDiagnostic[];
  }> {
    if (!this.indiaKanoon.isConfigured()) {
      this.logger.warn('IK retrieveAndIngest skipped — INDIA_KANOON_API_KEY not configured');
      return {
        authorities: [],
        packDelta: [],
        queries: [],
        searchStatus: 'not_configured',
        diagnostics: [],
      };
    }
    if (this.indiaKanoon.isCircuitOpen()) {
      this.logger.warn('IK retrieveAndIngest skipped — circuit open');
      return {
        authorities: [],
        packDelta: [],
        queries: [],
        searchStatus: 'circuit_open',
        diagnostics: [
          {
            query: input.query,
            status: 'circuit_open',
            hitCount: 0,
            admittedCount: 0,
            rejectedCount: 0,
            rejectionReasons: {},
          },
        ],
      };
    }

    const plan = this.planQueries(input);
    const queries = plan.allQueries.slice(
      0,
      Math.min(2, input.maxQueries ?? plan.allQueries.length),
    );
    const limit = input.limitPerQuery ?? 4;
    const byId = new Map<string, RetrievedAuthority>();
    const admittedIkIds = new Set<string>();
    let totalHits = 0;
    let rejectedHits = 0;
    let hadError = false;
    const diagnostics: IkQueryDiagnostic[] = [];

    await Promise.allSettled(
      queries.map(async (q) => {
      if (this.indiaKanoon.isCircuitOpen()) {
        diagnostics.push({
          query: q,
          status: 'circuit_open',
          hitCount: 0,
          admittedCount: 0,
          rejectedCount: 0,
          rejectionReasons: {},
        });
        hadError = true;
        return;
      }
      let queryAdmitted = 0;
      let queryRejected = 0;
      const rejectionReasons: Record<string, number> = {};
      try {
        const outcome = await this.indiaKanoon.searchWithOutcome({
          query: q,
          limit,
          skipEnrich: false,
          fetchFullText: true,
        });
        const hits = outcome.results;
        totalHits += outcome.hitCount;
        if (outcome.status !== 'searched' && outcome.status !== 'no_hits') {
          hadError = true;
          if (
            outcome.status === 'unauthorized' ||
            outcome.status === 'circuit_open' ||
            outcome.status === 'rate_limited'
          ) {
            diagnostics.push({
              query: q,
              status: outcome.status,
              hitCount: outcome.hitCount,
              admittedCount: 0,
              rejectedCount: 0,
              rejectionReasons: {},
            });
            return;
          }
        }
        for (const hit of hits) {
          if (byId.has(hit.id)) continue;
          const tid = Number.parseInt(hit.id.replace(/^ik-/, ''), 10);
          let fragmentText: string | null = null;
          if (!Number.isNaN(tid)) {
            fragmentText = await this.indiaKanoon.fetchDocFragment(tid, plan.fragmentQuery);
          }
          const passageText = fragmentText ?? hit.fullText ?? hit.summary ?? '';
          const fullText = hit.fullText ?? fragmentText ?? hit.summary ?? '';
          const relevance = assessCandidateRelevance(
            {
              title: hit.title,
              citation: hit.citation,
              summary: hit.summary,
              fullText,
            },
            input,
          );
          if (!relevance.admitted) {
            rejectedHits += 1;
            queryRejected += 1;
            const rejectionCode = relevance.rejectionCode ?? 'UNKNOWN';
            rejectionReasons[rejectionCode] = (rejectionReasons[rejectionCode] ?? 0) + 1;
            this.logger.debug(
              `IK candidate rejected id=${hit.id} score=${relevance.score} code=${rejectionCode} reason="${relevance.reason}"`,
            );
            continue;
          }
          const documentHash = createHash('sha256').update(passageText).digest('hex');
          const retrievedAt = new Date().toISOString();
          this.snapshotCache.set(hit.id, {
            documentHash,
            retrievedAt,
            fullText: passageText,
            result: { ...hit, fullText: passageText, fragmentText },
          });
          const displayCourt = hit.court ?? 'Published judgment';
          admittedIkIds.add(hit.id);
          queryAdmitted += 1;
          byId.set(hit.id, {
            id: hit.id,
            title: hit.title,
            citation: hit.citation,
            sourceName: displayCourt,
            summary: fragmentText ?? hit.summary,
            fullText: fullText || null,
            sourceUrl: hit.sourceUrl,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: hit.court,
            decisionDate: hit.decisionDate,
            courtTierRank: /supreme court/i.test(hit.court ?? '') ? 0 : undefined,
            treatmentStatus: this.mapTreatment(hit.treatmentHint),
            decisionYear: hit.decisionDate ? hit.decisionDate.getFullYear() : undefined,
            relevanceScore: relevance.score,
            relevanceReason: relevance.reason,
            relevanceGate: 'admitted',
            sourcePassages: hit.passages,
            sourceProvenance: hit.sourceProvenance,
          });
        }
        const diagnostic: IkQueryDiagnostic = {
          query: q,
          status: outcome.status,
          hitCount: outcome.hitCount,
          admittedCount: queryAdmitted,
          rejectedCount: queryRejected,
          rejectionReasons,
        };
        diagnostics.push(diagnostic);
        this.logger.log(
          `IK ingest status=${diagnostic.status} queryChars=${q.length} count=${hits.length} admitted=${queryAdmitted} rejected=${queryRejected} rejectionReasons=${JSON.stringify(rejectionReasons)}`,
        );
      } catch (err) {
        hadError = true;
        diagnostics.push({
          query: q,
          status: 'error',
          hitCount: 0,
          admittedCount: 0,
          rejectedCount: 0,
          rejectionReasons: {},
        });
        this.logger.warn(
          `IK multi-query failed for "${q.slice(0, 80)}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      }),
    );

    for (const existing of input.existingAuthorities ?? []) {
      const cur = byId.get(existing.id);
      if (!cur) {
        byId.set(existing.id, existing);
        continue;
      }
      if ((existing.fullText?.length ?? 0) > (cur.fullText?.length ?? 0)) {
        byId.set(existing.id, { ...cur, ...existing, fullText: existing.fullText });
      }
    }

    const authorities = [...byId.values()];
    const packDelta = this.toEvidenceCases(
      authorities.filter((a) => admittedIkIds.has(a.id)),
    );
    const searchStatus: CaseLawSearchStatus =
      hadError && totalHits === 0
        ? 'error'
        : admittedIkIds.size === 0
          ? 'no_hits'
          : 'searched';

    this.logger.log(
      `IK ingest authorities=${authorities.length} admitted=${admittedIkIds.size} rejected=${rejectedHits} packDelta=${packDelta.length} status=${searchStatus} withFullText=${authorities.filter((a) => (a.fullText?.length ?? 0) > 200).length}`,
    );
    return { authorities, packDelta, queries, searchStatus, diagnostics };
  }

  /**
   * Executes one bounded post-verification retrieval pass for unsupported
   * material claims. The literal repairPass input makes the one-pass contract
   * explicit at call sites; this method never retries or recursively repairs.
   */
  async retrieveUnsupportedClaimRepairPass(
    input: StructuredLegalQueryContext & {
      repairPass: 1;
      targets: readonly UnsupportedClaimRepairTarget[];
      query?: string;
      practiceArea?: string;
      legalDomain?: LegalDomain;
      jurisdiction?: string;
      existingAuthorities?: RetrievedAuthority[];
      maxQueries?: number;
    },
  ): Promise<IkUnsupportedClaimRepairResult> {
    if (input.repairPass !== 1) {
      throw new Error('Unsupported-claim retrieval permits exactly one repair pass');
    }

    const targets = input.targets
      .filter((target) => target.claimId.trim() && target.claimText.trim())
      .slice(0, 3);
    if (targets.length === 0) {
      return {
        repairPass: 1,
        attemptedClaimIds: [],
        authorities: [],
        packDelta: [],
        queries: [],
        searchStatus: this.indiaKanoon.isConfigured() ? 'no_hits' : 'not_configured',
      };
    }

    const propositionPhrases = [
      ...new Set([
        ...targets.map((target) => target.claimText.trim()),
        ...(input.propositionPhrases ?? []),
      ]),
    ];
    const statuteSections = [
      ...new Set([
        ...(input.statuteSections ?? []),
        ...targets.flatMap((target) => this.extractStatutePhrases(target.claimText)),
      ]),
    ];
    const existingIds = new Set(
      (input.existingAuthorities ?? []).map((authority) => authority.id),
    );
    const retrieval = await this.retrieveAndIngest({
      query:
        input.query?.trim() ||
        targets.map((target) => target.claimText.trim()).join(' '),
      practiceArea: input.practiceArea,
      legalDomain: input.legalDomain,
      jurisdiction: input.jurisdiction,
      existingAuthorities: input.existingAuthorities,
      legalIssues: [
        ...targets.map((target) => target.claimText.trim()),
        ...(input.legalIssues ?? []),
      ],
      statuteSections,
      doctrines: input.doctrines,
      proceduralPosture: input.proceduralPosture,
      propositionPhrases,
      // Bounded repair deliberately uses a small result window.
      limitPerQuery: 2,
      maxQueries: Math.max(1, Math.min(input.maxQueries ?? 6, 6)),
      skipProceduralQuery: true,
    });

    const authorities = retrieval.authorities.filter(
      (authority) =>
        !existingIds.has(authority.id) &&
        authority.relevanceGate === 'admitted',
    );
    const admittedIds = new Set(authorities.map((authority) => authority.id));
    const packDelta = retrieval.packDelta.filter((evidence) =>
      admittedIds.has(evidence.authorityId),
    );

    return {
      repairPass: 1,
      attemptedClaimIds: targets.map((target) => target.claimId),
      authorities,
      packDelta,
      queries: retrieval.queries,
      searchStatus:
        retrieval.searchStatus === 'searched' && authorities.length === 0
          ? 'no_hits'
          : retrieval.searchStatus,
    };
  }

  mergeIntoPack(pack: LegalEvidencePack, cases: EvidenceCase[]): LegalEvidencePack {
    const existingIds = new Set(pack.authorities.map((a) => a.authorityId));
    const merged = [...pack.authorities];
    for (const c of cases) {
      if (existingIds.has(c.authorityId)) continue;
      merged.push(c);
      existingIds.add(c.authorityId);
    }
    return {
      ...pack,
      authorities: merged,
      sourceSnapshots: [
        ...pack.sourceSnapshots,
        ...cases.map((c) => ({
          authorityId: c.authorityId,
          sourceUrl: c.passages[0]?.sourceUrl,
          retrievedAt: this.snapshotCache.get(c.authorityId)?.retrievedAt ?? new Date().toISOString(),
          documentHash:
            this.snapshotCache.get(c.authorityId)?.documentHash ??
            createHash('sha256').update(c.passages.map((p) => p.text).join('\n')).digest('hex'),
          extractorVersion: 'ik-ingest-v2',
        })),
      ],
    };
  }

  buildPackFromIk(input: {
    jurisdiction: string;
    authorities: RetrievedAuthority[];
    matterFacts?: Array<{ factId: string; description: string }>;
  }): LegalEvidencePack {
    return this.evidencePackService.buildFromAuthorities(input);
  }

  private toEvidenceCases(authorities: RetrievedAuthority[]): EvidenceCase[] {
    return authorities.map((auth) => {
      const exactText = auth.fullText ?? auth.summary ?? '';
      const evidenceId = `EVD_${auth.id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 20)}`;
      const passages = this.buildEvidencePassages(auth, evidenceId);
      return {
        evidenceId,
        authorityId: auth.id,
        title: auth.title,
        citation: auth.citation ?? '',
        court: auth.court ?? auth.sourceName ?? 'Unknown Court',
        decidedDate:
          auth.decisionDate instanceof Date
            ? auth.decisionDate.toISOString()
            : auth.decisionDate ?? (auth.decisionYear ? `${auth.decisionYear}` : undefined),
        subsequentTreatment: auth.treatmentStatus ?? undefined,
        controllingJurisdiction: 'IN',
        passages:
          passages.length > 0
            ? passages
            : [
                {
                  evidenceId: `${evidenceId}_P1`,
                  authorityId: auth.id,
                  text: exactText || auth.title,
                  sourceHash: createHash('sha256').update(exactText || auth.title).digest('hex'),
                  propositionTags: [],
                  sourceTier: 'AGGREGATOR',
                  retrievalScore: exactText.length > 400 ? 0.85 : 0.4,
                  sourceUrl: auth.sourceUrl ?? undefined,
                },
              ],
      };
    });
  }

  private mapTreatment(
    hint?: string | null,
  ): import('@/legal-search/legal-retrieval.types').TreatmentStatus | undefined {
    if (!hint) return undefined;
    const h = hint.toLowerCase();
    if (h.includes('overrule') || h.includes('revers')) return 'overruled';
    if (h.includes('supersed')) return 'superseded';
    if (h.includes('distinguish')) return 'distinguished';
    if (h.includes('follow') || h.includes('affirm')) return 'good_law';
    return undefined;
  }

  private extractStatutePhrases(text: string): string[] {
    const phrases = new Set<string>();
    const patterns = [
      /\b(?:BNS|BNSS|BSA|IPC|CrPC|CPC|NI\s+Act|NDPS|PMLA|POCSO)\s*(?:§|s\.?|section)?\s*\d+[A-Za-z]?/gi,
      /\b(?:section|s\.|§)\s*\d+[A-Za-z]?(?:\s+of\s+(?:the\s+)?[A-Z][A-Za-z .&-]{2,60}(?:Act|Code|Rules))?/g,
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        phrases.add(match[0].replace(/\s+/g, ' ').trim());
      }
    }
    return [...phrases].slice(0, 3);
  }

  private splitPassages(
    authority: RetrievedAuthority,
    evidenceId: string,
  ): EvidencePassage[] {
    const sourcePassages = (authority.sourcePassages ?? [])
      .map((passage, sourceIndex) => ({ ...passage, sourceIndex, text: passage.text.trim() }))
      .filter((passage) => passage.text.length > 30);
    if (sourcePassages.length === 0) return [];

    const queryTokens = new Set(
      (authority.summary ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 3),
    );
    const selected = sourcePassages
      .map((passage) => ({
        passage,
        score: [...queryTokens].filter((token) => passage.text.toLowerCase().includes(token)).length,
      }))
      .sort((a, b) => b.score - a.score || a.passage.sourceIndex - b.passage.sourceIndex)
      .slice(0, 16)
      .sort((a, b) => a.passage.sourceIndex - b.passage.sourceIndex)
      .map(({ passage }) => passage);

    return selected.map((passage, index) => ({
      evidenceId: `${evidenceId}_P${index + 1}`,
      authorityId: authority.id,
      paragraph: passage.sourcePinpoint ? passage.paragraph : undefined,
      page: passage.page,
      text: passage.text.slice(0, 8_000),
      sourceHash: createHash('sha256').update(passage.text).digest('hex'),
      propositionTags: [],
      sourceTier: 'AGGREGATOR' as const,
      retrievalScore: passage.sourcePinpoint ? 0.9 : 0.75,
      sourceUrl: authority.sourceUrl ?? undefined,
    }));
  }

  private buildEvidencePassages(
    authority: RetrievedAuthority,
    evidenceId: string,
  ): EvidencePassage[] {
    const preserved = this.splitPassages(authority, evidenceId);
    if (preserved.length > 0) return preserved;

    const quotedText = (authority.summary ?? authority.fullText ?? '').trim();
    if (quotedText.length < 40) return [];
    return [
      {
        evidenceId: `${evidenceId}_P1`,
        authorityId: authority.id,
        // Deliberately no paragraph: this is a verified quote fallback, not a source pinpoint.
        text: quotedText.slice(0, 12_000),
        sourceHash: createHash('sha256').update(quotedText).digest('hex'),
        propositionTags: [],
        sourceTier: 'AGGREGATOR',
        retrievalScore: authority.summary ? 0.8 : 0.65,
        sourceUrl: authority.sourceUrl ?? undefined,
      },
    ];
  }
}
