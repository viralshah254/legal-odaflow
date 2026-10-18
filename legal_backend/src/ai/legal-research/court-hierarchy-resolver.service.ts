import { Injectable } from '@nestjs/common';

/**
 * Court node in the hierarchy graph.
 */
export interface CourtNode {
  courtId: string;
  jurisdiction: string;
  /** Higher level = more authoritative. Supreme Court = 10, District Court = 1. */
  level: number;
  /** Court IDs that are bound by this court's decisions. */
  binds: string[];
  /** Court IDs where decisions are persuasive only. */
  persuasiveTo: string[];
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface HierarchyResolution {
  /** The controlling authority ID, or null when neither controls the other. */
  controlling: string | null;
  /** Human-readable reason for the resolution. */
  reason: string;
  isPersuasiveOnly: boolean;
}

/**
 * Deterministic court hierarchy resolver for India and Kenya.
 *
 * The model may explain distinctions in prose, but this service provides
 * the authoritative binding/persuasive classification from metadata alone.
 *
 * Wave 3 stub — full graph with bench-strength and treatment records is pending.
 */
@Injectable()
export class CourtHierarchyResolverService {
  private static readonly KENYA_HIERARCHY: Map<string, CourtNode> = new Map([
    [
      'KE_SUPREME_COURT',
      {
        courtId: 'KE_SUPREME_COURT',
        jurisdiction: 'KE',
        level: 10,
        binds: ['KE_COURT_OF_APPEAL', 'KE_SUPERIOR_COURT', 'KE_SUBORDINATE_COURT'],
        persuasiveTo: [],
      },
    ],
    [
      'KE_COURT_OF_APPEAL',
      {
        courtId: 'KE_COURT_OF_APPEAL',
        jurisdiction: 'KE',
        level: 8,
        binds: ['KE_SUPERIOR_COURT', 'KE_SUBORDINATE_COURT'],
        persuasiveTo: [],
      },
    ],
    [
      'KE_SUPERIOR_COURT',
      {
        courtId: 'KE_SUPERIOR_COURT',
        jurisdiction: 'KE',
        level: 6,
        binds: ['KE_SUBORDINATE_COURT'],
        persuasiveTo: ['KE_SUPERIOR_COURT'],
      },
    ],
    [
      'KE_SUBORDINATE_COURT',
      {
        courtId: 'KE_SUBORDINATE_COURT',
        jurisdiction: 'KE',
        level: 3,
        binds: [],
        persuasiveTo: [],
      },
    ],
  ]);

  private static readonly INDIA_HIERARCHY: Map<string, CourtNode> = new Map([
    [
      'IN_SUPREME_COURT',
      {
        courtId: 'IN_SUPREME_COURT',
        jurisdiction: 'IN',
        level: 10,
        binds: ['IN_HIGH_COURT', 'IN_DISTRICT_COURT', 'IN_TRIBUNAL'],
        persuasiveTo: [],
      },
    ],
    [
      'IN_HIGH_COURT',
      {
        courtId: 'IN_HIGH_COURT',
        jurisdiction: 'IN',
        level: 7,
        binds: ['IN_DISTRICT_COURT', 'IN_TRIBUNAL'],
        persuasiveTo: ['IN_HIGH_COURT'],
      },
    ],
    [
      'IN_DISTRICT_COURT',
      {
        courtId: 'IN_DISTRICT_COURT',
        jurisdiction: 'IN',
        level: 3,
        binds: [],
        persuasiveTo: [],
      },
    ],
    [
      'IN_TRIBUNAL',
      {
        courtId: 'IN_TRIBUNAL',
        jurisdiction: 'IN',
        level: 5,
        binds: [],
        persuasiveTo: [],
      },
    ],
  ]);

  resolve(
    authorityA: { courtId?: string; court: string; decidedDate?: string; benchStrength?: number },
    authorityB: { courtId?: string; court: string; decidedDate?: string; benchStrength?: number },
  ): HierarchyResolution {
    const nodeA = this.resolveNode(authorityA.court);
    const nodeB = this.resolveNode(authorityB.court);

    if (!nodeA || !nodeB) {
      return {
        controlling: null,
        reason: 'Court hierarchy data unavailable for one or both authorities.',
        isPersuasiveOnly: true,
      };
    }

    if (nodeA.level > nodeB.level) {
      return {
        controlling: 'A',
        reason: `${nodeA.courtId} (level ${nodeA.level}) is hierarchically superior to ${nodeB.courtId} (level ${nodeB.level}).`,
        isPersuasiveOnly: false,
      };
    }

    if (nodeB.level > nodeA.level) {
      return {
        controlling: 'B',
        reason: `${nodeB.courtId} (level ${nodeB.level}) is hierarchically superior to ${nodeA.courtId} (level ${nodeA.level}).`,
        isPersuasiveOnly: false,
      };
    }

    // Same level — check bench strength
    if (
      authorityA.benchStrength !== undefined &&
      authorityB.benchStrength !== undefined
    ) {
      if (authorityA.benchStrength > authorityB.benchStrength) {
        return {
          controlling: 'A',
          reason: `Larger bench (${authorityA.benchStrength} judges) overrides smaller bench (${authorityB.benchStrength} judges) of same court.`,
          isPersuasiveOnly: false,
        };
      }
      if (authorityB.benchStrength > authorityA.benchStrength) {
        return {
          controlling: 'B',
          reason: `Larger bench (${authorityB.benchStrength} judges) overrides smaller bench (${authorityA.benchStrength} judges) of same court.`,
          isPersuasiveOnly: false,
        };
      }
    }

    // Same bench strength — later decision presumptively controls unless distinguished
    if (authorityA.decidedDate && authorityB.decidedDate) {
      const dateA = new Date(authorityA.decidedDate).getTime();
      const dateB = new Date(authorityB.decidedDate).getTime();
      if (dateA > dateB) {
        return {
          controlling: 'A',
          reason: `Later decision (${authorityA.decidedDate}) presumptively overrides earlier decision (${authorityB.decidedDate}) of same court and bench.`,
          isPersuasiveOnly: false,
        };
      }
      if (dateB > dateA) {
        return {
          controlling: 'B',
          reason: `Later decision (${authorityB.decidedDate}) presumptively overrides earlier decision (${authorityA.decidedDate}) of same court and bench.`,
          isPersuasiveOnly: false,
        };
      }
    }

    return {
      controlling: null,
      reason: 'Same court and bench strength; no date available to determine controlling authority.',
      isPersuasiveOnly: true,
    };
  }

  private resolveNode(courtName: string): CourtNode | undefined {
    if (/\b(?:supreme court of kenya|kenya supreme court|kesc)\b/i.test(courtName)) {
      return CourtHierarchyResolverService.KENYA_HIERARCHY.get('KE_SUPREME_COURT');
    }
    if (/\b(?:court of appeal of kenya|kenya court of appeal|keca)\b/i.test(courtName)) {
      return CourtHierarchyResolverService.KENYA_HIERARCHY.get('KE_COURT_OF_APPEAL');
    }
    if (
      /\b(?:high court of kenya|environment and land court|employment and labour relations court|kehc|kelc|keelrc)\b/i.test(
        courtName,
      )
    ) {
      return CourtHierarchyResolverService.KENYA_HIERARCHY.get('KE_SUPERIOR_COURT');
    }
    if (/\b(?:magistrates?'? courts?|kadhis?'? courts?|kemc)\b/i.test(courtName)) {
      return CourtHierarchyResolverService.KENYA_HIERARCHY.get('KE_SUBORDINATE_COURT');
    }
    for (const [, node] of CourtHierarchyResolverService.INDIA_HIERARCHY) {
      if (courtName.toLowerCase().includes(node.courtId.toLowerCase().replace('IN_', '').replace('_', ' ').toLowerCase())) {
        return node;
      }
    }
    if (/supreme court/i.test(courtName)) {
      return CourtHierarchyResolverService.INDIA_HIERARCHY.get('IN_SUPREME_COURT');
    }
    if (/high court/i.test(courtName)) {
      return CourtHierarchyResolverService.INDIA_HIERARCHY.get('IN_HIGH_COURT');
    }
    if (/district/i.test(courtName)) {
      return CourtHierarchyResolverService.INDIA_HIERARCHY.get('IN_DISTRICT_COURT');
    }
    if (/tribunal|nclat|nclat|sat|itat/i.test(courtName)) {
      return CourtHierarchyResolverService.INDIA_HIERARCHY.get('IN_TRIBUNAL');
    }
    return undefined;
  }
}
