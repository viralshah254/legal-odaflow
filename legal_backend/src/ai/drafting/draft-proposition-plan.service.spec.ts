import { DraftPropositionPlanService } from './draft-proposition-plan.service';
import { LegalEvidencePackService } from '@/ai/legal-research/legal-evidence-pack.service';

describe('DraftPropositionPlanService', () => {
  const service = new DraftPropositionPlanService();
  const packService = new LegalEvidencePackService();

  it('builds RULE grounds linked to pack evidence when section matches', () => {
    const pack = packService.buildFromAuthorities({
      jurisdiction: 'IN',
      authorities: [
        {
          id: 'bns_351',
          title: 'BNS Section 351',
          citation: 'BNS s.351',
          sourceName: 'India Code',
          sourceTier: 'primary',
          summary: 'Criminal intimidation.',
          fullText: 'Whoever commits criminal intimidation shall be punished...',
        },
      ],
      matterFacts: [{ factId: 'fact_1', description: 'Accused threatened the complainant on 1 Jan 2025.' }],
    });

    const plan = service.build({
      kind: 'india_fir',
      caseDetails: 'Accused threatened the complainant on 1 Jan 2025.',
      archetype: {
        matched: true,
        archetype: 'intimidation',
        register: 'police_complaint',
        governingSections: [
          { actId: 'bns', section: '351', label: 'BNS §351 Criminal intimidation' },
        ],
        substantiveSections: [],
        proceduralSections: [],
        warnings: [],
        missingFacts: [],
        sourceRefs: [],
      } as never,
      groundingAuthorities: [],
      evidencePack: pack,
      countryCode: 'IN',
    });

    expect(plan.issues[0].propositions.some((p) => p.type === 'RULE')).toBe(true);
    expect(plan.issues[0].propositions.some((p) => p.type === 'APPLICATION')).toBe(true);
    const block = service.buildPromptBlock(plan);
    expect(block).toContain('PROPOSITION PLAN');
    expect(block).toContain('evidenceIds=');
  });
});
