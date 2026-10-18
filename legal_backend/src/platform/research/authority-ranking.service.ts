import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthorityReference } from './research.types';

const TREATMENT_PENALTY: Record<string, number> = {
  overruled: -0.5,
  distinguished: -0.1,
  superseded: -0.3,
  repealed: -0.5,
};

@Injectable()
export class AuthorityRankingService {
  constructor(private readonly prisma: PrismaService) {}

  rankAuthorities(
    authorities: AuthorityReference[],
    jurisdiction: string,
    court?: string,
  ): AuthorityReference[] {
    return authorities
      .map((auth) => ({ auth, score: this.computeScore(auth, jurisdiction, court) }))
      .sort((a, b) => b.score - a.score)
      .map(({ auth }) => auth);
  }

  private computeScore(
    auth: AuthorityReference,
    jurisdiction: string,
    court?: string,
  ): number {
    const treatmentPenalty = TREATMENT_PENALTY[auth.treatmentStatus] ?? 0;
    const treatmentScore = Math.max(0, 0.2 + treatmentPenalty);

    const relevance = (auth.relevanceScore ?? 0.5) * 0.3;
    const authorityBase = auth.authorityWeight * 0.2;
    const jurisdictionMatch = auth.jurisdiction === jurisdiction ? 0.1 : 0;
    const freshness = this.freshnessScore(auth.publicationDate) * 0.1;
    const bindingHierarchy = this.bindingScore(auth, court) * 0.2;
    const citationBonus = 0.1;

    return (
      authorityBase + treatmentScore + relevance + jurisdictionMatch + freshness + bindingHierarchy + citationBonus
    );
  }

  private freshnessScore(publicationDate?: string): number {
    if (!publicationDate) return 0.5;
    const ageYears = (Date.now() - new Date(publicationDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageYears < 1) return 1.0;
    if (ageYears < 5) return 0.8;
    if (ageYears < 10) return 0.6;
    if (ageYears < 20) return 0.4;
    return 0.2;
  }

  private bindingScore(auth: AuthorityReference, court?: string): number {
    if (!court) return 0.5;
    const courtLower = (auth.court ?? '').toLowerCase();
    if (courtLower.includes('supreme')) return 1.0;
    if (courtLower.includes('high') || courtLower.includes('appellate')) return 0.7;
    return 0.3;
  }

  async checkTreatment(
    canonicalId: string,
  ): Promise<{ status: string; treatedBy: AuthorityReference[] }> {
    const doc = await this.prisma.legalSearchDocument.findUnique({
      where: { canonicalId },
    });

    return {
      status: doc?.treatmentStatus ?? 'unknown',
      treatedBy: [],
    };
  }

  filterOverruled(authorities: AuthorityReference[]): AuthorityReference[] {
    return authorities.map((auth) => {
      if (auth.treatmentStatus === 'overruled' || auth.treatmentStatus === 'repealed') {
        return { ...auth, snippet: `[WARNING: ${auth.treatmentStatus.toUpperCase()}] ${auth.snippet ?? ''}`.trim() };
      }
      return auth;
    });
  }
}
