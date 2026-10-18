import { Injectable } from '@nestjs/common';
import type { MatterGraph, MatterProfile } from './matter-intelligence.types';
import type { RetrievedAsset } from './legal-asset-retrieval.service';

export interface AuthorityRankInput<
  T extends { id: string; title: string; citation?: string | null; score?: number } = {
    id: string;
    title: string;
    citation?: string | null;
    score?: number;
  },
> {
  authorities: T[];
  profile?: MatterProfile;
  graph?: MatterGraph;
}

/** P17-03 — boost governing statutes from MatterGraph + taxonomy. */
@Injectable()
export class MiAuthorityRankerService {
  rank<T extends { id: string; title: string; citation?: string | null; score?: number }>(
    input: AuthorityRankInput<T>,
  ): T[] {
    const boosts = this.buildBoostTerms(input.profile, input.graph);
    if (boosts.length === 0) return input.authorities as T[];

    return [...input.authorities]
      .map((row) => {
        const haystack = `${row.title} ${row.citation ?? ''}`.toLowerCase();
        let boost = 0;
        for (const term of boosts) {
          if (haystack.includes(term.toLowerCase())) boost += 0.08;
        }
        return { ...row, score: (row.score ?? 0.5) + boost };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) as T[];
  }

  rankRetrievedAssets(assets: RetrievedAsset[], profile?: MatterProfile, graph?: MatterGraph) {
    return this.rank({
      authorities: assets.map((a) => ({
        ...a,
        id: a.id,
        title: a.label,
        score: a.combinedScore,
      })),
      profile,
      graph,
    });
  }

  private buildBoostTerms(profile?: MatterProfile, graph?: MatterGraph): string[] {
    const terms: string[] = [];
    for (const statute of graph?.statutes ?? []) {
      if (statute.act) terms.push(statute.act);
      if (statute.section) terms.push(`section ${statute.section}`);
    }
    if (profile?.practiceArea === 'employment_labour') {
      terms.push('Industrial Disputes Act', 'ID Act', 'labour');
    }
    if (profile?.practiceArea === 'family_matrimonial') {
      terms.push('Hindu Marriage Act', 'maintenance', 'BNSS');
    }
    return terms;
  }
}
