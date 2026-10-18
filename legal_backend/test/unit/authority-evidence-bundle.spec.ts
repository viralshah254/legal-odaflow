import {
  buildAuthorityEvidenceBundle,
  registryFromRetrievedAuthorities,
} from '@/ai/legal-research/authority-evidence-bundle';

describe('AuthorityEvidenceBundle', () => {
  it('preserves verified retrieved sources for generation and reverify', () => {
    const registry = registryFromRetrievedAuthorities({
      jobId: 'draft-1',
      jurisdiction: 'IN-GJ',
      authorities: [
        {
          id: 'order-37',
          title: 'Code of Civil Procedure, 1908 — Order XXXVII',
          citation: 'CPC Order XXXVII',
          sourceName: 'India Code',
          sourceTier: 'primary',
          authorityType: 'STATUTE',
          summary: 'Summary procedure for written liquidated demands.',
          relevanceGate: 'admitted',
        },
      ],
    });

    const bundle = buildAuthorityEvidenceBundle({
      consumer: 'draft_generation',
      jurisdiction: 'IN-GJ',
      documentKind: 'india_suit_recovery_cpc_37',
      sourceRegistry: registry,
      appendixOnly: true,
    });

    expect(bundle.sourceRegistry.sources).toHaveLength(1);
    expect(bundle.sourceRegistry.sources[0].verificationStatus).toBe('verified');
    expect(bundle.presentation).toEqual({
      allowInlineCitation: false,
      maxInlineCaseCites: 0,
      appendixOnly: true,
    });
    expect(bundle.publicationState).toBe('RESEARCH_BACKED');
  });
});
