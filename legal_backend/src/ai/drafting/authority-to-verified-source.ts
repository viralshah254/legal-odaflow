import { createHash } from 'crypto';
import type { RetrievedAuthority } from '@/legal-search/legal-retrieval.types';
import type { VerifiedSource } from '@/ai/unified-drafting/contracts/verified-source';

/**
 * Adapts retrieval-shaped authorities to the verified-source contract so the
 * engines that predate the registry (India v1, v2) can share the argument-graph
 * and coherence services with the unified engine.
 */
export function authoritiesToVerifiedSources(
  authorities: RetrievedAuthority[],
  jurisdiction = 'IN',
): VerifiedSource[] {
  return authorities.map((authority) => {
    const text = authority.fullText ?? authority.summary ?? '';
    const isStatute =
      (authority.authorityType ?? '').toUpperCase() === 'STATUTE' ||
      authority.sourceTier === 'primary';

    return {
      id: authority.id,
      type: isStatute ? 'statute' : 'case',
      jurisdiction,
      title: authority.title ?? authority.citation ?? authority.id,
      citation: authority.citation ?? undefined,
      court: authority.court ?? undefined,
      section: authority.section ?? undefined,
      text: text.slice(0, 800),
      proposition: authority.summary ?? undefined,
      verificationStatus: 'partially_verified',
      contentHash: createHash('sha256').update(text).digest('hex').slice(0, 16),
    };
  });
}
