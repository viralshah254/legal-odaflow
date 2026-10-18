import { Injectable } from '@nestjs/common';
import { CourtHierarchyResolverService } from '@/ai/legal-research/court-hierarchy-resolver.service';
import type { VerificationFinding } from './verification-finding.types';

export interface HierarchyAuthorityMeta {
  authorityId: string;
  court?: string | null;
  decidedDate?: string;
  benchStrength?: number;
  controllingJurisdiction?: string | null;
}

/**
 * Shared court-hierarchy gate for research + drafting claim-level verification.
 * IN: SC > HC > trial/tribunal. US: federal SCOTUS > circuit > district; state SC > appellate > trial.
 */
@Injectable()
export class CourtHierarchyService {
  constructor(private readonly indiaResolver: CourtHierarchyResolverService) {}

  findingForClaim(input: {
    claimId: string;
    evidenceIds: string[];
    authorities: HierarchyAuthorityMeta[];
    jurisdiction: string;
  }): VerificationFinding {
    const { claimId, evidenceIds, authorities, jurisdiction } = input;
    if (authorities.length === 0) {
      return {
        checkId: `hierarchy:${claimId}`,
        state: 'INDETERMINATE',
        severity: 'MEDIUM',
        dimension: 'hierarchy',
        propositionId: claimId,
        evidenceIds,
        explanation: 'No court metadata available for hierarchy check.',
        repairAction: 'ABSTAIN',
        verifierVersion: 'court-hierarchy-v1',
      };
    }

    const ranked = authorities
      .map((a) => ({ meta: a, level: this.levelFor(a.court ?? '', jurisdiction) }))
      .filter((r) => r.level > 0);

    if (ranked.length === 0) {
      return {
        checkId: `hierarchy:${claimId}`,
        state: 'INDETERMINATE',
        severity: 'MEDIUM',
        dimension: 'hierarchy',
        propositionId: claimId,
        evidenceIds,
        explanation: 'Court could not be mapped onto the hierarchy graph.',
        repairAction: 'ABSTAIN',
        verifierVersion: 'court-hierarchy-v1',
      };
    }

    // Single authority: PASS if mapped; multi: ensure no lower court is treated as sole controlling without note.
    if (ranked.length === 1) {
      return {
        checkId: `hierarchy:${claimId}`,
        state: 'PASS',
        severity: 'LOW',
        dimension: 'hierarchy',
        propositionId: claimId,
        authorityId: ranked[0].meta.authorityId,
        evidenceIds,
        explanation: `Authority mapped at hierarchy level ${ranked[0].level}.`,
        verifierVersion: 'court-hierarchy-v1',
      };
    }

    const sorted = [...ranked].sort((a, b) => b.level - a.level);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top.level > bottom.level) {
      const resolution = this.indiaResolver.resolve(
        {
          court: top.meta.court ?? '',
          decidedDate: top.meta.decidedDate,
          benchStrength: top.meta.benchStrength,
        },
        {
          court: bottom.meta.court ?? '',
          decidedDate: bottom.meta.decidedDate,
          benchStrength: bottom.meta.benchStrength,
        },
      );
      return {
        checkId: `hierarchy:${claimId}`,
        state: 'PASS',
        severity: 'LOW',
        dimension: 'hierarchy',
        propositionId: claimId,
        authorityId: top.meta.authorityId,
        evidenceIds,
        explanation:
          resolution.reason ||
          `Higher court (level ${top.level}) controls over lower court (level ${bottom.level}).`,
        verifierVersion: 'court-hierarchy-v1',
      };
    }

    return {
      checkId: `hierarchy:${claimId}`,
      state: 'PASS',
      severity: 'LOW',
      dimension: 'hierarchy',
      propositionId: claimId,
      evidenceIds,
      explanation: 'Authorities sit at comparable hierarchy levels; treat as persuasive unless distinguished.',
      verifierVersion: 'court-hierarchy-v1',
    };
  }

  levelFor(court: string, jurisdiction: string): number {
    const c = court.toLowerCase();
    const j = jurisdiction.toUpperCase();
    if (j.startsWith('US') || /united states|u\.s\./i.test(court)) {
      if (/supreme court/.test(c) && !/state/.test(c)) return 10;
      if (/circuit|court of appeals/.test(c)) return 7;
      if (/district court/.test(c)) return 3;
      if (/supreme court/.test(c)) return 8; // state supreme
      if (/appellate|appeals/.test(c)) return 5;
      if (/superior|trial|county|municipal/.test(c)) return 2;
      return 0;
    }
    // India + Commonwealth-style default
    if (/supreme court/.test(c)) return 10;
    if (/high court/.test(c)) return 7;
    if (/tribunal|nclat|nclt|sat|itat/.test(c)) return 5;
    if (/district|sessions|magistrate|trial/.test(c)) return 3;
    return 0;
  }
}
