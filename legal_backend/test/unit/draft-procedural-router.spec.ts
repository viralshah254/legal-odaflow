import { DraftProceduralRouterService } from '@/ai/drafting/draft-procedural-router.service';
import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';

describe('DraftProceduralRouterService', () => {
  const service = new DraftProceduralRouterService(new DraftProceduralGateService());

  it('routes interim maintenance + appeal kind to maintenance order revision', () => {
    const result = service.route({
      kind: 'india_criminal_appeal',
      caseDetails:
        'Ram vs Ria. Interim maintenance order under CrPC 125 received. Appeal to Gujarat High Court.',
      countryCode: 'IN',
      courtName: 'High Court of Gujarat',
    });

    expect(result.recommendedKind).toBe('india_maintenance_order_revision');
    expect(result.kindOverridden).toBe(true);
    expect(result.maintainabilityNotes.some((n) => /interim/i.test(n))).toBe(true);
    expect(result.governingSections.some((s) => s.section === '438')).toBe(true);
  });

  it('routes service_agreement kind with interim maintenance facts to revision', () => {
    const result = service.route({
      kind: 'india_service_agreement_india',
      caseDetails:
        'Draft an appeal - interim order already received, for a 125 crpc maintenance case. Ram vs Ria. Appeal to Gujarat High Court.',
      countryCode: 'IN',
    });

    expect(result.recommendedKind).toBe('india_maintenance_order_revision');
    expect(result.kindOverridden).toBe(true);
    expect(result.causeTitleVehicle).toBe('CRIMINAL REVISION PETITION');
  });

  it('includes procedural prompt block with governing sections', () => {
    const result = service.route({
      kind: 'india_criminal_appeal',
      caseDetails: 'Interim maintenance under BNSS 144. Ram vs Ria.',
      countryCode: 'IN',
    });
    const block = service.buildPromptBlock(result);
    expect(block).toContain('PROCEDURAL DETERMINATION');
    expect(block).toContain('india_maintenance_order_revision');
  });

  it('respects explicit divorce petition selection despite maintenance facts', () => {
    const ramRia =
      'Ram vs ria. Ria filed for dowry, harassment, mental distress. They got married in 2025 jan. Shortly after a month ria filed a dv case. Interim order was issued to ram to pay 100000 per month. Ram challenges- no marriage happened as per hindu rituals.';

    const result = service.route({
      kind: 'india_divorce_petition_s13',
      caseDetails: ramRia,
      countryCode: 'IN',
      respectUserSelection: true,
    });

    expect(result.recommendedKind).toBe('india_divorce_petition_s13');
    expect(result.kindOverridden).toBe(false);
  });
});
