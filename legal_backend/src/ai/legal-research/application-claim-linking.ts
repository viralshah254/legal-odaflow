import type { ClaimBlock } from './legal-research-draft.types';

const RULE_TYPES = new Set<ClaimBlock['type']>(['RULE', 'HOLDING']);

/**
 * Auto-link APPLICATION propositions to preceding RULE/HOLDING claims and matter facts.
 */
export function linkApplicationClaims<T extends ClaimBlock>(
  claims: T[],
  matterFacts: Array<{ factId: string; description: string }>,
): T[] {
  const ruleClaimIds: string[] = [];

  return claims.map((claim) => {
    if (RULE_TYPES.has(claim.type) && claim.evidenceIds.length > 0) {
      ruleClaimIds.push(claim.claimId);
    }

    if (claim.type !== 'APPLICATION' || claim.evidenceIds.length > 0) {
      return claim;
    }

    const factIds =
      (claim.factIds?.length ?? 0) > 0
        ? claim.factIds
        : matchFactIdsFromText(claim.text, matterFacts);

    const resolvedBasedOn =
      (claim.basedOnClaimIds?.length ?? 0) > 0
        ? claim.basedOnClaimIds
        : ruleClaimIds.length > 0
          ? [ruleClaimIds[ruleClaimIds.length - 1]!]
          : [];

    return {
      ...claim,
      factIds: factIds?.length ? factIds : claim.factIds,
      basedOnClaimIds:
        resolvedBasedOn && resolvedBasedOn.length > 0 ? resolvedBasedOn : claim.basedOnClaimIds,
    };
  });
}

export function linkApplicationClaimsInDraft<
  T extends { propositions: ClaimBlock[] },
>(issues: T[], matterFacts: Array<{ factId: string; description: string }>): T[] {
  return issues.map((issue) => ({
    ...issue,
    propositions: linkApplicationClaims(issue.propositions, matterFacts),
  }));
}

function matchFactIdsFromText(
  sentence: string,
  matterFacts: Array<{ factId: string; description: string }>,
): string[] | undefined {
  if (!matterFacts.length) return undefined;
  const lower = sentence.toLowerCase();
  const matched = matterFacts
    .filter((f) => {
      const tokens = f.description
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length >= 4);
      if (tokens.length === 0) return false;
      const hits = tokens.filter((t) => lower.includes(t)).length;
      return hits >= Math.min(2, tokens.length) || lower.includes(f.description.toLowerCase().slice(0, 40));
    })
    .map((f) => f.factId);
  return matched.length > 0 ? matched : undefined;
}
