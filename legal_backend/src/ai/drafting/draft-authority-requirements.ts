import { resolveDraftReadinessPolicy } from './playbooks/draft-readiness-policy';
import type { PreferredCourtTier } from './playbooks/draft-kind-playbook.types';

export type CourtTier = PreferredCourtTier;

export interface AuthorityRequirement {
  /** Minimum number of verified case-law citations required in the draft. */
  minVerifiedCases: number;
  /** Proposition topics the verified authority set should cover. */
  requiredTopics: string[];
  /** Preferred minimum court tier for retrieval and ranking. */
  preferredTier: CourtTier;
  /** Whether to escalate to bounded deep research when below minimum. */
  escalateOnShortfall: boolean;
  /** Human-readable policy label used by readiness UI. */
  label: string;
}

/**
 * Compatibility adapter. Authority requirements are derived exclusively from the
 * canonical draft readiness playbook so retrieval and release gates cannot disagree.
 */
export function getAuthorityRequirement(kind: string): AuthorityRequirement {
  const policy = resolveDraftReadinessPolicy(kind);
  return {
    minVerifiedCases: policy.minVerifiedCaseAuthorities,
    requiredTopics: policy.requiredAuthorityTopics ?? policy.requiredGroundTypes,
    preferredTier: policy.preferredCourtTier ?? 'any',
    escalateOnShortfall: policy.escalateAuthorityShortfall ?? false,
    label: policy.kind,
  };
}

export function meetsAuthorityMinimum(kind: string, caseLawCount: number): boolean {
  return caseLawCount >= getAuthorityRequirement(kind).minVerifiedCases;
}

export function shouldEscalate(kind: string, caseLawCount: number): boolean {
  const requirement = getAuthorityRequirement(kind);
  return requirement.escalateOnShortfall && caseLawCount < requirement.minVerifiedCases;
}
