import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LegalDomain } from '@/ai/legal-research/legal-research-classifier.service';
import { isClearlyOffDomainAuthority } from './legal-domain-profile';
import type { RetrievedAuthority } from './legal-retrieval.types';
import { rankAuthoritiesByTier } from './source-tier.util';

@Injectable()
export class LegalRerankerService {
  private readonly logger = new Logger(LegalRerankerService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Re-rank retrieved authorities using lexical overlap + source tier,
   * with optional cross-encoder reranking when COHERE_API_KEY or JINA_API_KEY is set.
   */
  async rerank(
    query: string,
    authorities: RetrievedAuthority[],
    limit = 5,
    legalDomain?: LegalDomain,
  ): Promise<RetrievedAuthority[]> {
    if (authorities.length === 0) return [];

    const queryTokens = tokenize(query);
    const scored = authorities.map((row) => {
      const corpus = [row.title, row.citation, row.summary, row.fullText, row.sourceName]
        .filter(Boolean)
        .join(' ');
      const overlap = tokenOverlapScore(queryTokens, tokenize(corpus));
      const tierBoost =
        row.sourceTier === 'primary' ? 0.35 : row.sourceTier === 'case_law' ? 0.15 : 0;
      // A primary source from the wrong legal domain is not more useful than a
      // lower-tier authority addressing the actual question.
      const offDomainPenalty = isClearlyOffDomainAuthority(row, legalDomain) ? 0.5 : 0;
      return {
        ...row,
        score: overlap + tierBoost + (row.score ?? 0) * 0.1 - offDomainPenalty,
      };
    });

    const pool = scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const reranked = await this.applyCrossEncoderRerank(query, pool);
    const sliced = reranked.slice(0, limit);
    return rankAuthoritiesByTier(sliced);
  }

  /** Backward-compatible sync wrapper for callers not yet migrated to async rerank. */
  rerankSync(
    query: string,
    authorities: RetrievedAuthority[],
    limit = 5,
    legalDomain?: LegalDomain,
  ): RetrievedAuthority[] {
    if (authorities.length <= limit) {
      return rankAuthoritiesByTier(authorities);
    }

    const queryTokens = tokenize(query);
    const scored = authorities.map((row) => {
      const corpus = [row.title, row.citation, row.summary, row.fullText, row.sourceName]
        .filter(Boolean)
        .join(' ');
      const overlap = tokenOverlapScore(queryTokens, tokenize(corpus));
      const tierBoost =
        row.sourceTier === 'primary' ? 0.35 : row.sourceTier === 'case_law' ? 0.15 : 0;
      const offDomainPenalty = isClearlyOffDomainAuthority(row, legalDomain) ? 0.5 : 0;
      return {
        ...row,
        score: overlap + tierBoost + (row.score ?? 0) * 0.1 - offDomainPenalty,
      };
    });

    return rankAuthoritiesByTier(
      scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit),
    );
  }

  private async applyCrossEncoderRerank(
    query: string,
    authorities: RetrievedAuthority[],
  ): Promise<RetrievedAuthority[]> {
    const cohereKey = this.configService.get<string>('COHERE_API_KEY', '').trim();
    const jinaKey = this.configService.get<string>('JINA_API_KEY', '').trim();
    if (!cohereKey && !jinaKey) {
      return authorities;
    }

    const topPool = authorities.slice(0, 20);
    const documents = topPool.map((a) =>
      [a.title, a.citation, a.summary, a.fullText].filter(Boolean).join('\n'),
    );

    try {
      if (cohereKey) {
        const res = await fetch('https://api.cohere.com/v1/rerank', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cohereKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.configService.get<string>('COHERE_RERANK_MODEL', 'rerank-v3.5'),
            query,
            documents,
            top_n: topPool.length,
          }),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          this.logger.warn(`Cohere rerank returned ${res.status}`);
          return authorities;
        }
        const payload = (await res.json()) as {
          results?: Array<{ index: number; relevance_score: number }>;
        };
        const order = (payload.results ?? []).sort(
          (a, b) => b.relevance_score - a.relevance_score,
        );
        const rerankedTop = order.map((row) => ({
          ...topPool[row.index],
          score: (topPool[row.index].score ?? 0) + row.relevance_score,
        }));
        return [...rerankedTop, ...authorities.slice(topPool.length)];
      }

      const res = await fetch('https://api.jina.ai/v1/rerank', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jinaKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.configService.get<string>('JINA_RERANK_MODEL', 'jina-reranker-v2-base-multilingual'),
          query,
          documents,
          top_n: topPool.length,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`Jina rerank returned ${res.status}`);
        return authorities;
      }
      const payload = (await res.json()) as {
        results?: Array<{ index: number; relevance_score: number }>;
      };
      const order = (payload.results ?? []).sort((a, b) => b.relevance_score - a.relevance_score);
      const rerankedTop = order.map((row) => ({
        ...topPool[row.index],
        score: (topPool[row.index].score ?? 0) + row.relevance_score,
      }));
      return [...rerankedTop, ...authorities.slice(topPool.length)];
    } catch (err) {
      this.logger.warn(`Cross-encoder rerank failed: ${String(err)}`);
      return authorities;
    }
  }
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function tokenOverlapScore(query: Set<string>, doc: Set<string>): number {
  if (query.size === 0 || doc.size === 0) return 0;
  let overlap = 0;
  for (const token of query) {
    if (doc.has(token)) overlap += 1;
  }
  return overlap / query.size;
}
