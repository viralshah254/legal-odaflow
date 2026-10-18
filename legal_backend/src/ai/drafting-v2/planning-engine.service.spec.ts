import { PlanningEngineService } from './planning-engine.service';
import type { DraftV2Input } from './drafting-v2.types';
import type { MatterProfile } from '@/ai/matter-intelligence/matter-intelligence.types';
import type { ProceduralRouterResult } from '@/ai/drafting/draft-procedural-router.types';

function procedural(kind: string): ProceduralRouterResult {
  return {
    recommendedKind: kind,
    userSelectedKind: kind,
    kindOverridden: false,
    causeTitleVehicle: kind.includes('habeas')
      ? 'WRIT PETITION (HABEAS CORPUS)'
      : kind.includes('bail')
        ? 'BAIL APPLICATION'
        : 'WRIT PETITION',
    documentClass: 'pleading',
    governingSections: [],
    maintainabilityNotes: [],
    requiredStructuralSections: [],
    proceduralWarnings: [],
    completenessGaps: [],
  };
}

const profile: MatterProfile = {
  country: 'IN',
  practiceArea: 'criminal',
  nature: 'dispute',
  remedies: [],
  issues: [],
  documentTypes: [],
  curatedKinds: [],
  confidence: 0.8,
  jurisdiction: 'Gujarat',
};

describe('PlanningEngineService taxonomy', () => {
  const service = new PlanningEngineService({} as never);

  it('plans habeas with cause title, jurisdiction, grounds and prayer', () => {
    const input: DraftV2Input = {
      kind: 'india_habeas_corpus_petition',
      caseDetails: 'Petitioner Meera Sharma seeks production of Riya Sharma at Ahmedabad.',
      courtName: 'High Court of Gujarat at Ahmedabad',
    };
    const plan = service.plan(input, profile, procedural(input.kind));
    expect(plan.mandatorySections).toEqual(
      expect.arrayContaining(['CAUSE TITLE', 'JURISDICTION', 'FACTS', 'GROUNDS', 'PRAYER']),
    );
    expect(plan.formattingRules.join(' ')).toMatch(/IN THE HIGH COURT/i);
  });

  it('plans regular bail with cause title, grounds and prayer', () => {
    const input: DraftV2Input = {
      kind: 'india_regular_bail_bnss_480',
      caseDetails: 'Rahul Mehta seeks regular bail before the Sessions Court, Ahmedabad.',
      courtName: 'Sessions Court, Ahmedabad',
    };
    const plan = service.plan(input, profile, procedural(input.kind));
    expect(plan.mandatorySections).toEqual(
      expect.arrayContaining(['CAUSE TITLE', 'FACTS', 'GROUNDS', 'PRAYER']),
    );
  });
});
