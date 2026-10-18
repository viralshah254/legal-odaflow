import { Injectable, Logger } from '@nestjs/common';
import { LegalRetrievalOrchestrator } from '@/legal-search/legal-retrieval-orchestrator.service';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type {
  CandidateAuthority,
  ResearchIntelligenceMap,
} from './research-intelligence-map.types';

export interface CandidateResolveResult {
  map: ResearchIntelligenceMap;
  authorities: RetrievedAuthority[];
  resolved: CandidateAuthority[];
  unresolved: CandidateAuthority[];
  diagnostics: Array<{
    candidateId: string;
    title: string;
    status: string;
    hitCount: number;
    queriesTried: string[];
  }>;
}

export function titleOverlap(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  const tokensA = new Set(na.split(' ').filter((t) => t.length > 3));
  const tokensB = nb.split(' ').filter((t) => t.length > 3);
  if (tokensA.size === 0 || tokensB.length === 0) return false;
  const hits = tokensB.filter((t) => tokensA.has(t)).length;
  return hits >= Math.min(2, tokensB.length);
}

function knowledgeSourcesForKind(kind: CandidateAuthority['kind']): string[] {
  switch (kind) {
    case 'case':
      return ['case_law', 'web'];
    case 'statute':
      return ['statutes'];
    case 'regulation':
      return ['regulations', 'statutes', 'web'];
    case 'regulator':
      return ['regulations', 'web'];
    default:
      return ['statutes', 'case_law', 'web'];
  }
}

@Injectable()
export class AuthorityCandidateResolverService {
  private readonly logger = new Logger(AuthorityCandidateResolverService.name);

  constructor(private readonly retrieval: LegalRetrievalOrchestrator) {}

  /**
   * Resolve MODEL_KNOWLEDGE candidates via targeted live+corpus retrieval.
   * Promote only when a retrieved authority matches identity; never silent-verify.
   * Unresolved names stay CANDIDATE/UNVERIFIED research leads — not citeable as Verified.
   */
  async resolve(input: {
    map: ResearchIntelligenceMap;
    countryCode: string;
    jurisdiction?: string;
    practiceArea?: string;
    legalDomain?: string;
    tenantId?: string;
    userId: string;
    matterId?: string;
    priorAuthorities?: RetrievedAuthority[];
    /** Max candidates to chase (cost/latency budget). */
    maxCandidates?: number;
    /** Max query retrieves per candidate (after prior-authority match). */
    queriesPerCandidate?: number;
    /** Hard wall-clock for this resolve phase (ms). */
    deadlineMs?: number;
    skipIndiaKanoon?: boolean;
    skipTavily?: boolean;
  }): Promise<CandidateResolveResult> {
    const maxCandidates = input.maxCandidates ?? 3;
    const queriesPerCandidate = input.queriesPerCandidate ?? 1;
    const deadlineMs = input.deadlineMs ?? 25_000;
    const startedAt = Date.now();
    const timedOut = () => Date.now() - startedAt >= deadlineMs;

    // Prefer cases/statutes — regulators rarely need a full retrieve round-trip.
    const candidates = [
      ...input.map.likelyCases,
      ...input.map.likelyStatutes,
      ...input.map.likelyRegulations,
    ]
      .filter((c) => c.verificationStatus === 'CANDIDATE')
      .slice(0, maxCandidates);

    const authorityMap = new Map<string, RetrievedAuthority>(
      (input.priorAuthorities ?? []).map((a) => [a.id, a]),
    );
    const priorList = [...authorityMap.values()];
    const diagnostics: CandidateResolveResult['diagnostics'] = [];
    const resolved: CandidateAuthority[] = [];
    const unresolved: CandidateAuthority[] = [];

    // Pass 1: match against authorities already retrieved (zero network).
    const needsLive: CandidateAuthority[] = [];
    for (const candidate of candidates) {
      const priorMatch = priorList.find(
        (a) =>
          titleOverlap(a.title, candidate.title) ||
          (candidate.citation &&
            a.citation &&
            titleOverlap(a.citation, candidate.citation)),
      );
      if (priorMatch) {
        resolved.push({
          ...candidate,
          verificationStatus: 'RETRIEVED',
          origin: priorMatch.sourceTier === 'web' ? 'LIVE' : 'CORPUS',
          resolvedAuthorityId: priorMatch.id,
        });
        diagnostics.push({
          candidateId: candidate.id,
          title: candidate.title,
          status: 'RETRIEVED_PRIOR',
          hitCount: 1,
          queriesTried: [],
        });
      } else {
        needsLive.push(candidate);
      }
    }

    // Pass 2: light FAST retrieves (not full DEEP fan-out) within wall-clock.
    const batchSize = 2;
    for (let i = 0; i < needsLive.length; i += batchSize) {
      if (timedOut()) {
        for (const leftover of needsLive.slice(i)) {
          unresolved.push({ ...leftover, verificationStatus: 'UNVERIFIED' });
          diagnostics.push({
            candidateId: leftover.id,
            title: leftover.title,
            status: 'SKIPPED_BUDGET',
            hitCount: 0,
            queriesTried: [],
          });
        }
        this.logger.warn(
          `Candidate resolve budget exhausted after ${Date.now() - startedAt}ms — ${needsLive.length - i} left unverified`,
        );
        break;
      }

      const batch = needsLive.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (candidate) => {
          if (timedOut()) {
            unresolved.push({ ...candidate, verificationStatus: 'UNVERIFIED' });
            diagnostics.push({
              candidateId: candidate.id,
              title: candidate.title,
              status: 'SKIPPED_BUDGET',
              hitCount: 0,
              queriesTried: [],
            });
            return;
          }

          const queries = this.buildSearchQueries(candidate).slice(0, queriesPerCandidate);
          let bestMatch: RetrievedAuthority | undefined;
          let hitCount = 0;

          for (const query of queries) {
            if (timedOut()) break;
            try {
              // FAST mode: fewer connector queries, skip full-text enrich — authenticity
              // still requires a title/citation match before promotion to RETRIEVED.
              const result = await this.retrieval.retrieve({
                query,
                countryCode: input.countryCode,
                jurisdiction: input.jurisdiction,
                practiceArea: input.practiceArea,
                legalDomain: input.legalDomain as never,
                tenantId: input.tenantId,
                userId: input.userId,
                matterId: input.matterId,
                priorAuthorities: [...authorityMap.values()],
                supplementLive: true,
                researchMode: 'FAST',
                skipTavilyInFast: false,
                skipIndiaKanoon: input.skipIndiaKanoon,
                skipTavily: input.skipTavily,
                knowledgeSources: knowledgeSourcesForKind(candidate.kind),
                limit: 6,
              });
              for (const a of result.authorities) {
                if (!authorityMap.has(a.id)) authorityMap.set(a.id, a);
              }
              hitCount += result.authorities.length;
              const match = result.authorities.find(
                (a) =>
                  titleOverlap(a.title, candidate.title) ||
                  (candidate.citation &&
                    a.citation &&
                    titleOverlap(a.citation, candidate.citation)),
              );
              if (match) {
                bestMatch = match;
                break;
              }
            } catch (err) {
              this.logger.warn(
                `Candidate resolve query failed for ${candidate.title}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            }
          }

          if (bestMatch) {
            resolved.push({
              ...candidate,
              verificationStatus: 'RETRIEVED',
              origin: 'LIVE',
              resolvedAuthorityId: bestMatch.id,
            });
            diagnostics.push({
              candidateId: candidate.id,
              title: candidate.title,
              status: 'RETRIEVED',
              hitCount,
              queriesTried: queries,
            });
          } else {
            // Never invent verification — stays a research lead only.
            unresolved.push({
              ...candidate,
              verificationStatus: 'UNVERIFIED',
            });
            diagnostics.push({
              candidateId: candidate.id,
              title: candidate.title,
              status: hitCount > 0 ? 'UNVERIFIED' : 'NO_HITS',
              hitCount,
              queriesTried: queries,
            });
          }
        }),
      );
    }

    const map = this.applyCandidateUpdates(input.map, [...resolved, ...unresolved]);
    return {
      map,
      authorities: [...authorityMap.values()],
      resolved,
      unresolved,
      diagnostics,
    };
  }

  private buildSearchQueries(candidate: CandidateAuthority): string[] {
    const queries: string[] = [];
    // Prefer citation / exact title first — highest chance of identity match.
    if (candidate.citation) queries.push(candidate.citation);
    if (candidate.title) queries.push(candidate.title);
    if (candidate.title && candidate.court) {
      queries.push(`${candidate.title} ${candidate.court}`);
    }
    queries.push(...candidate.searchHints.slice(0, 2));
    if (candidate.kind === 'case' && /\bv\.?\s|\bvs\.?\s/i.test(candidate.title)) {
      const parts = candidate.title.split(/\bv\.?\s|\bvs\.?\s/i);
      if (parts.length >= 2) {
        queries.push(`${parts[0].trim()} ${parts[1].trim()}`);
      }
    }
    return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  }

  private applyCandidateUpdates(
    map: ResearchIntelligenceMap,
    updates: CandidateAuthority[],
  ): ResearchIntelligenceMap {
    const byId = new Map(updates.map((u) => [u.id, u]));
    const patch = (list: CandidateAuthority[]) =>
      list.map((c) => byId.get(c.id) ?? c);
    return {
      ...map,
      likelyStatutes: patch(map.likelyStatutes),
      likelyRegulations: patch(map.likelyRegulations),
      likelyCases: patch(map.likelyCases),
      likelyRegulators: patch(map.likelyRegulators),
    };
  }
}
