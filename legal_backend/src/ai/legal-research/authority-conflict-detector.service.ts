import { Injectable } from '@nestjs/common';
import { CourtHierarchyService } from '@/ai/verification/court-hierarchy.service';
import { TreatmentGraphService } from '@/ai/verification/treatment-graph.service';

export type ConflictType =
  | 'DIRECT_HOLDING'
  | 'INTERPRETIVE'
  | 'JURISDICTIONAL'
  | 'FACTUAL_DISTINCTION'
  | 'APPARENT_ONLY'
  | 'TREATMENT';

export interface AuthorityConflict {
  propositionKey: string;
  authorityA: string;
  authorityB: string;
  conflictType: ConflictType;
  controllingAuthorityId?: string;
  /** True when no controlling authority can be deterministically resolved. */
  unresolved: boolean;
  reason?: string;
}

export interface AuthorityInput {
  id: string;
  title: string;
  citation?: string | null;
  sourceTier?: string;
  sourceName?: string;
  summary?: string | null;
  treatmentStatus?: string | null;
  court?: string | null;
}

/**
 * Detects conflicting authorities using hierarchy + treatment signals.
 * Replaces the Wave-1 stub that only compared source tiers.
 */
@Injectable()
export class AuthorityConflictDetectorService {
  constructor(
    private readonly hierarchy: CourtHierarchyService,
    private readonly treatment: TreatmentGraphService,
  ) {}

  detect(authorities: AuthorityInput[], jurisdiction = 'IN'): AuthorityConflict[] {
    const conflicts: AuthorityConflict[] = [];

    for (const auth of authorities) {
      const treatmentFinding = this.treatment.findingForClaim({
        claimId: `conflict_${auth.id}`,
        evidenceIds: [auth.id],
        material: true,
        treatmentSignals: [
          {
            authorityId: auth.id,
            treatment: auth.treatmentStatus,
            textHint: `${auth.title} ${auth.summary ?? ''}`,
          },
        ],
      });
      if (treatmentFinding.state === 'FAIL') {
        conflicts.push({
          propositionKey: `treatment:${auth.id}`,
          authorityA: auth.id,
          authorityB: auth.id,
          conflictType: 'TREATMENT',
          unresolved: false,
          reason: treatmentFinding.explanation,
        });
      }
    }

    // Pairwise hierarchy: if two case-law authorities at different levels, record controlling
    const caseLaw = authorities.filter(
      (a) => a.sourceTier === 'case_law' || /court|scc|scr/i.test(a.sourceName ?? ''),
    );
    for (let i = 0; i < caseLaw.length; i++) {
      for (let j = i + 1; j < caseLaw.length; j++) {
        const a = caseLaw[i];
        const b = caseLaw[j];
        const levelA = this.hierarchy.levelFor(a.court ?? a.sourceName ?? '', jurisdiction);
        const levelB = this.hierarchy.levelFor(b.court ?? b.sourceName ?? '', jurisdiction);
        if (levelA === 0 || levelB === 0 || levelA === levelB) continue;
        const controlling = levelA > levelB ? a.id : b.id;
        conflicts.push({
          propositionKey: `hierarchy:${a.id}:${b.id}`,
          authorityA: a.id,
          authorityB: b.id,
          conflictType: 'JURISDICTIONAL',
          controllingAuthorityId: controlling,
          unresolved: false,
          reason: `Hierarchy levels ${levelA} vs ${levelB}; ${controlling} controls.`,
        });
      }
    }

    const byJurisdiction = this.groupByJurisdiction(authorities);
    for (const [jKey, group] of byJurisdiction.entries()) {
      if (group.length < 2) continue;
      const primaryTier = group.filter(
        (a) => a.sourceTier === 'primary' || a.sourceTier === 'seed',
      );
      const webTier = group.filter((a) => a.sourceTier === 'web');
      if (primaryTier.length > 0 && webTier.length > 0) {
        conflicts.push({
          propositionKey: `jurisdiction:${jKey}`,
          authorityA: primaryTier[0].id,
          authorityB: webTier[0].id,
          conflictType: 'APPARENT_ONLY',
          controllingAuthorityId: primaryTier[0].id,
          unresolved: false,
          reason: 'Primary corpus authority preferred over web aggregator hit.',
        });
      }
    }

    return conflicts;
  }

  private groupByJurisdiction(
    authorities: AuthorityInput[],
  ): Map<string, AuthorityInput[]> {
    const map = new Map<string, AuthorityInput[]>();
    for (const auth of authorities) {
      const key = auth.sourceName ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(auth);
    }
    return map;
  }
}
