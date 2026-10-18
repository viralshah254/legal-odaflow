import { linkApplicationClaims, linkApplicationClaimsInDraft } from './application-claim-linking';
import type { ClaimBlock } from './legal-research-draft.types';

describe('linkApplicationClaims', () => {
  const matterFacts = [
    { factId: 'research_fact_1', description: 'Tenant withheld security deposit after lease ended' },
    { factId: 'research_fact_2', description: 'Notice period was thirty days' },
  ];

  it('links APPLICATION to preceding RULE and matched facts', () => {
    const claims: ClaimBlock[] = [
      {
        claimId: 'claim_rule_1',
        type: 'RULE',
        text: 'Landlord must return deposit within statutory period.',
        evidenceIds: ['ev_1'],
        confidence: 0.9,
      },
      {
        claimId: 'claim_app_1',
        type: 'APPLICATION',
        text: 'Tenant withheld security deposit after lease ended.',
        evidenceIds: [],
        confidence: 0.8,
      },
    ];

    const linked = linkApplicationClaims(claims, matterFacts);
    expect(linked[1]?.basedOnClaimIds).toEqual(['claim_rule_1']);
    expect(linked[1]?.factIds).toContain('research_fact_1');
  });

  it('skips APPLICATION claims that already cite evidence', () => {
    const claims: ClaimBlock[] = [
      {
        claimId: 'claim_app_1',
        type: 'APPLICATION',
        text: 'Applies to the facts.',
        evidenceIds: ['ev_2'],
        confidence: 0.7,
      },
    ];

    const linked = linkApplicationClaims(claims, matterFacts);
    expect(linked[0]).toEqual(claims[0]);
  });

  it('links APPLICATION claims inside draft issues', () => {
    const issues = [
      {
        issueId: 'issue_1',
        title: 'Deposit',
        propositions: [
          {
            claimId: 'claim_holding_1',
            type: 'HOLDING' as const,
            text: 'Deposit must be returned promptly.',
            evidenceIds: ['ev_3'],
            confidence: 0.85,
          },
          {
            claimId: 'claim_app_2',
            type: 'APPLICATION' as const,
            text: 'Notice period was thirty days before vacating.',
            evidenceIds: [],
            confidence: 0.75,
          },
        ],
      },
    ];

    const linked = linkApplicationClaimsInDraft(issues, matterFacts);
    const application = linked[0]?.propositions[1] as ClaimBlock | undefined;
    expect(application?.basedOnClaimIds).toEqual(['claim_holding_1']);
    expect(application?.factIds).toContain('research_fact_2');
  });
});
