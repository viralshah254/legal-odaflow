import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  KenyaLawJudgmentConnector,
  type KenyaLawSearchHit,
} from '@/legal-sources/connectors/kenya-law-judgment.connector';
import { LegalSourceService } from '@/legal-sources/legal-source.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { StructuredLegalQueryContext } from '@/legal-search/legal-retrieval.types';
import { assessCandidateRelevance } from '@/legal-search/retrieval-relevance';
import type { EvidenceCase } from './legal-evidence-pack.service';
import { KenyaLawQueryBuilderService } from './kenya-law-query-builder.service';
import type { LegalDomain } from './legal-research-classifier.service';
import type { ConnectorSearchStatus } from '@/legal-sources/connectors/connector-outcome.types';
import { normalizeCourtMetadata } from '@/legal-search/court-normalization';

export type KeCaseLawSearchStatus = ConnectorSearchStatus;

export interface KeQueryDiagnostic {
  query: string;
  status: KeCaseLawSearchStatus;
  hitCount: number;
  admittedCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
}

/**
 * Live Kenya Law judgment search as retrieval + passage source.
 * Hits are relevance-gated and asynchronously persisted into LegalAuthority.
 */
@Injectable()
export class KeEvidenceIngestService {
  private readonly logger = new Logger(KeEvidenceIngestService.name);

  constructor(
    private readonly kenyaLawJudgments: KenyaLawJudgmentConnector,
    private readonly legalSourceService: LegalSourceService,
    private readonly queryBuilder: KenyaLawQueryBuilderService,
  ) {}

  async retrieveAndIngest(input: StructuredLegalQueryContext & {
    query: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    limitPerQuery?: number;
    maxQueries?: number;
    existingAuthorities?: RetrievedAuthority[];
  }): Promise<{
    authorities: RetrievedAuthority[];
    packDelta: EvidenceCase[];
    queries: string[];
    searchStatus: KeCaseLawSearchStatus;
    diagnostics: KeQueryDiagnostic[];
  }> {
    const plan = this.queryBuilder.build({
      ...input,
      countryCode: 'KE',
    });
    const queries = plan.allQueries.slice(
      0,
      input.maxQueries ?? Math.min(plan.allQueries.length, 6),
    );
    const limit = input.limitPerQuery ?? 4;
    const byId = new Map<string, RetrievedAuthority>();
    const admittedIds = new Set<string>();
    let totalHits = 0;
    let hadError = false;
    const diagnostics: KeQueryDiagnostic[] = [];
    const persistHits: KenyaLawSearchHit[] = [];

    const withBodyBudget = async <T>(
      promise: Promise<T>,
      budgetMs = 4_000,
    ): Promise<T | null> =>
      Promise.race([
        promise.then((value) => value ?? null).catch(() => null),
        new Promise<null>((resolve) => {
          const timer = setTimeout(() => resolve(null), budgetMs);
          timer.unref?.();
        }),
      ]);

    for (const q of queries) {
      let queryAdmitted = 0;
      let queryRejected = 0;
      const rejectionReasons: Record<string, number> = {};
      try {
        const hits = await this.kenyaLawJudgments.searchJudgments(q, limit);
        totalHits += hits.length;
        for (const hit of hits) {
          if (byId.has(hit.id)) continue;
          const body = await withBodyBudget(
            this.kenyaLawJudgments.fetchJudgmentBody(hit.sourceUrl),
          );
          const fullText =
            body?.fullText ||
            hit.summary ||
            [hit.title, hit.citation ?? '', hit.summary ?? ''].filter(Boolean).join('\n\n');
          const courtMeta = normalizeCourtMetadata(body?.court ?? hit.court);
          const relevance = assessCandidateRelevance(
            {
              title: hit.title,
              citation: hit.citation,
              summary: hit.summary,
              fullText,
              sourceTier: 'case_law',
              authorityType: 'CASE',
              court: courtMeta.court,
            },
            input,
            { relaxSubjectAnchor: true },
          );
          if (!relevance.admitted) {
            queryRejected += 1;
            const rejectionCode = relevance.rejectionCode ?? 'UNKNOWN';
            rejectionReasons[rejectionCode] = (rejectionReasons[rejectionCode] ?? 0) + 1;
            continue;
          }

          queryAdmitted += 1;
          admittedIds.add(hit.id);
          persistHits.push(hit);
          byId.set(hit.id, {
            id: hit.id,
            title: body?.title || hit.title,
            citation: body?.citation ?? hit.citation,
            sourceName: 'Kenya Law',
            summary: hit.summary ?? fullText.slice(0, 600),
            fullText: fullText || null,
            sourceUrl: hit.sourceUrl,
            sourceTier: 'case_law',
            authorityType: 'CASE',
            court: courtMeta.court,
            decisionDate: hit.decisionDate,
            courtTierRank: courtMeta.courtTierRank,
            relevanceScore: relevance.score,
            relevanceReason: relevance.reason,
            relevanceGate: 'admitted',
          });
        }
        diagnostics.push({
          query: q,
          status: hits.length === 0 ? 'no_hits' : 'searched',
          hitCount: hits.length,
          admittedCount: queryAdmitted,
          rejectedCount: queryRejected,
          rejectionReasons,
        });
      } catch (err) {
        hadError = true;
        this.logger.warn(
          `KE evidence search failed for "${q.slice(0, 80)}": ${err instanceof Error ? err.message : String(err)}`,
        );
        diagnostics.push({
          query: q,
          status: 'error',
          hitCount: 0,
          admittedCount: 0,
          rejectedCount: 0,
          rejectionReasons: {},
        });
      }
    }

    for (const existing of input.existingAuthorities ?? []) {
      if (!byId.has(existing.id)) byId.set(existing.id, existing);
    }

    if (persistHits.length > 0) {
      this.legalSourceService.scheduleKenyaPersist(persistHits);
    }

    const authorities = [...byId.values()];
    const packDelta = this.toEvidenceCases(
      authorities.filter((a) => admittedIds.has(a.id)),
    );
    const searchStatus: KeCaseLawSearchStatus =
      hadError && totalHits === 0
        ? 'error'
        : admittedIds.size === 0
          ? 'no_hits'
          : 'searched';

    return { authorities, packDelta, queries, searchStatus, diagnostics };
  }

  /**
   * One bounded Kenya Law pass for material claims that remained unsupported.
   * Mirrors the India unsupported-claim repair contract.
   */
  async retrieveUnsupportedClaimRepairPass(input: {
    repairPass: 1;
    targets: ReadonlyArray<{ claimId: string; claimText: string }>;
    query?: string;
    practiceArea?: string;
    legalDomain?: LegalDomain;
    jurisdiction?: string;
    existingAuthorities?: RetrievedAuthority[];
    maxQueries?: number;
    legalIssues?: string[];
    statuteSections?: string[];
    doctrines?: string[];
    propositionPhrases?: string[];
  }): Promise<{
    repairPass: 1;
    attemptedClaimIds: string[];
    authorities: RetrievedAuthority[];
    packDelta: EvidenceCase[];
    queries: string[];
    searchStatus: KeCaseLawSearchStatus;
  }> {
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
        searchStatus: 'no_hits',
      };
    }

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
      statuteSections: input.statuteSections,
      doctrines: input.doctrines,
      propositionPhrases: [
        ...targets.map((target) => target.claimText.trim()),
        ...(input.propositionPhrases ?? []),
      ],
      limitPerQuery: 2,
      maxQueries: Math.max(1, Math.min(input.maxQueries ?? 4, 6)),
    });

    const authorities = retrieval.authorities.filter(
      (authority) =>
        !existingIds.has(authority.id) && authority.relevanceGate === 'admitted',
    );
    const admittedIds = new Set(authorities.map((authority) => authority.id));
    return {
      repairPass: 1,
      attemptedClaimIds: targets.map((target) => target.claimId),
      authorities,
      packDelta: retrieval.packDelta.filter((evidence) =>
        admittedIds.has(evidence.authorityId),
      ),
      queries: retrieval.queries,
      searchStatus: retrieval.searchStatus,
    };
  }

  private toEvidenceCases(authorities: RetrievedAuthority[]): EvidenceCase[] {
    return authorities.map((auth) => {
      const exactText = auth.fullText ?? auth.summary ?? '';
      const evidenceId = `EVD_${auth.id.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 20)}`;
      return {
        evidenceId,
        authorityId: auth.id,
        title: auth.title,
        citation: auth.citation ?? '',
        court: auth.court ?? auth.sourceName ?? 'Unknown Court',
        decidedDate:
          auth.decisionDate instanceof Date
            ? auth.decisionDate.toISOString()
            : auth.decisionDate ?? undefined,
        controllingJurisdiction: 'KE',
        sourceUrl: auth.sourceUrl ?? undefined,
        sourceName: auth.sourceName,
        passages: [
          {
            evidenceId: `${evidenceId}_P1`,
            authorityId: auth.id,
            text: exactText || auth.title,
            sourceHash: createHash('sha256').update(exactText || auth.title).digest('hex'),
            propositionTags: [],
            sourceTier: 'OFFICIAL',
            retrievalScore: exactText.length > 400 ? 0.85 : 0.4,
            sourceUrl: auth.sourceUrl ?? undefined,
          },
        ],
      };
    });
  }
}
