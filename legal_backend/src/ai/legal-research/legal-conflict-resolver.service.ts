import type { PassageClassification, TreatmentStatus } from '@/legal-search/legal-retrieval.types';

export type LegalConflictStatus =
  | 'SETTLED'
  | 'PREDOMINANT'
  | 'JURISDICTION_SPLIT'
  | 'FACT_DEPENDENT'
  | 'UNRESOLVED';

export interface ConflictAuthority {
  authorityId: string;
  position: string;
  jurisdiction: string;
  bindingStatus: 'BINDING' | 'PERSUASIVE' | 'NON_PRECEDENTIAL' | 'UNKNOWN';
  treatmentStatus?: TreatmentStatus | 'reversed' | 'doubted' | 'followed' | 'affirmed';
  treatmentVerified?: boolean;
  courtLevel?: number;
  decisionDate?: string | Date;
  passageClassification?: PassageClassification;
  admissionPassed?: boolean;
  materiallyDistinguishableFacts?: boolean;
}

export interface LegalConflictResolution {
  status: LegalConflictStatus;
  prevailingPosition?: string;
  supportingAuthorityIds: string[];
  contraryAuthorityIds: string[];
  reasons: string[];
}

/** Conservative deterministic resolver. Missing admission/treatment facts reduce, never increase, confidence. */
export class LegalConflictResolver {
  resolve(authorities: ConflictAuthority[]): LegalConflictResolution {
    const usable = authorities.filter(
      (authority) =>
        authority.admissionPassed === true &&
        !['overruled', 'repealed', 'superseded', 'reversed'].includes(
          authority.treatmentStatus ?? '',
        ) &&
        authority.passageClassification !== 'HEADNOTE' &&
        authority.passageClassification !== 'PARTY_SUBMISSION',
    );
    if (usable.length === 0) return this.unresolved('No admitted current authority can resolve the conflict.');

    const groups = this.groupByPosition(usable);
    if (groups.size === 1) {
      const [position, aligned] = [...groups.entries()][0];
      const settled =
        aligned.some(
          (authority) =>
            authority.bindingStatus === 'BINDING' &&
            authority.treatmentVerified === true &&
            this.isHolding(authority.passageClassification),
        ) && authorities.every((authority) => authority.position === position || authority.admissionPassed !== true);
      return {
        status: settled ? 'SETTLED' : 'PREDOMINANT',
        prevailingPosition: position,
        supportingAuthorityIds: aligned.map((authority) => authority.authorityId),
        contraryAuthorityIds: [],
        reasons: [
          settled
            ? 'Admitted binding authority with verified treatment aligns on one position.'
            : 'Admitted authorities align, but binding status, passage class, or treatment is incomplete.',
        ],
      };
    }

    if (
      usable.some((authority) => authority.materiallyDistinguishableFacts) &&
      [...groups.values()].every((group) => group.length > 0)
    ) {
      return this.resultForSplit(
        'FACT_DEPENDENT',
        groups,
        'The competing outcomes are tied to materially distinguishable facts.',
      );
    }

    const controllingByJurisdiction = new Map<string, Set<string>>();
    for (const authority of usable.filter((candidate) => candidate.bindingStatus === 'BINDING')) {
      const positions = controllingByJurisdiction.get(authority.jurisdiction) ?? new Set<string>();
      positions.add(authority.position);
      controllingByJurisdiction.set(authority.jurisdiction, positions);
    }
    const jurisdictionPositions = new Set(
      [...controllingByJurisdiction.values()]
        .filter((positions) => positions.size === 1)
        .flatMap((positions) => [...positions]),
    );
    if (controllingByJurisdiction.size > 1 && jurisdictionPositions.size > 1) {
      return this.resultForSplit(
        'JURISDICTION_SPLIT',
        groups,
        'Different jurisdictions have conflicting binding positions.',
      );
    }

    const ranked = [...groups.entries()]
      .map(([position, group]) => ({
        position,
        group,
        score: group.reduce((sum, authority) => sum + this.weight(authority), 0),
      }))
      .sort((a, b) => b.score - a.score);
    const leader = ranked[0];
    const runnerUp = ranked[1];
    if (
      leader &&
      runnerUp &&
      leader.score >= runnerUp.score * 1.75 &&
      leader.group.some((authority) => authority.bindingStatus === 'BINDING')
    ) {
      return {
        status: 'PREDOMINANT',
        prevailingPosition: leader.position,
        supportingAuthorityIds: leader.group.map((authority) => authority.authorityId),
        contraryAuthorityIds: ranked
          .slice(1)
          .flatMap((candidate) => candidate.group.map((authority) => authority.authorityId)),
        reasons: ['One position has materially stronger admitted and binding precedential support.'],
      };
    }
    return this.resultForSplit(
      'UNRESOLVED',
      groups,
      'Competing admitted authorities lack a sufficiently dominant controlling position.',
    );
  }

  private groupByPosition(authorities: ConflictAuthority[]): Map<string, ConflictAuthority[]> {
    const groups = new Map<string, ConflictAuthority[]>();
    for (const authority of authorities) {
      const key = authority.position.trim();
      if (!key) continue;
      groups.set(key, [...(groups.get(key) ?? []), authority]);
    }
    return groups;
  }

  private isHolding(classification?: PassageClassification): boolean {
    return classification === 'HOLDING' || classification === 'RATIO' || classification === 'STATUTORY_TEXT';
  }

  private weight(authority: ConflictAuthority): number {
    const binding = authority.bindingStatus === 'BINDING' ? 6 : authority.bindingStatus === 'PERSUASIVE' ? 2 : 1;
    const treatment = authority.treatmentVerified ? 2 : 0;
    const passage = this.isHolding(authority.passageClassification) ? 2 : 0;
    const hierarchy = Math.max(0, 3 - Math.max(0, authority.courtLevel ?? 3));
    return binding + treatment + passage + hierarchy;
  }

  private resultForSplit(
    status: LegalConflictStatus,
    groups: Map<string, ConflictAuthority[]>,
    reason: string,
  ): LegalConflictResolution {
    return {
      status,
      supportingAuthorityIds: [...groups.values()][0]?.map((authority) => authority.authorityId) ?? [],
      contraryAuthorityIds: [...groups.values()]
        .slice(1)
        .flatMap((group) => group.map((authority) => authority.authorityId)),
      reasons: [reason],
    };
  }

  private unresolved(reason: string): LegalConflictResolution {
    return {
      status: 'UNRESOLVED',
      supportingAuthorityIds: [],
      contraryAuthorityIds: [],
      reasons: [reason],
    };
  }
}
