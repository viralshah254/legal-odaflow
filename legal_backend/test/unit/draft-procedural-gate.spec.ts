import { DraftProceduralGateService } from '@/ai/drafting/draft-procedural-gate.service';

describe('DraftProceduralGateService', () => {
  const service = new DraftProceduralGateService();

  it('warns when appeal kind conflicts with maintenance-only facts', () => {
    const result = service.check({
      kind: 'india_criminal_appeal',
      caseDetails: 'Wife seeks interim maintenance under CrPC 125 against employed husband.',
      countryCode: 'IN',
    });

    expect(result.proceduralWarnings.some((w) => /maintenance/i.test(w))).toBe(true);
  });

  it('flags procedural vehicle uncertainty for appeal maintenance order phrasing', () => {
    const result = service.check({
      kind: 'india_maintenance_application_bnss_144',
      caseDetails: 'Client wants to appeal maintenance order passed by family court.',
      countryCode: 'IN',
    });

    expect(result.proceduralWarnings.length).toBeGreaterThan(0);
  });

  it('shares fail-closed commercial summary-suit procedure checks', () => {
    const result = service.check({
      kind: 'india_suit_recovery_cpc_37',
      caseDetails:
        'Purchase order and invoices record a debt of ₹25 lakh. Section 12A mediation concluded with a non-starter report. Plaintiff seeks attachment before judgment.',
      countryCode: 'IN',
      courtName: 'District Court, Ahmedabad',
    });

    expect(result.proceduralWarnings.join(' ')).toMatch(
      /commercial_forum_not_designated/i,
    );
    expect(result.proceduralWarnings.join(' ')).toMatch(
      /unsupported_attachment/i,
    );
    expect(result.proceduralWarnings.join(' ')).not.toMatch(
      /section_12a_status/i,
    );
  });

  it('rejects a contradictory Section 12A posture', () => {
    const result = service.check({
      kind: 'india_suit_recovery_cpc_37',
      caseDetails:
        'Purchase order debt is ₹25 lakh. Pre-institution mediation concluded with a non-starter report. The plaint invokes the Section 12A exception for urgent interim relief.',
      countryCode: 'IN',
    });

    expect(result.proceduralWarnings.join(' ')).toMatch(
      /section_12a_contradiction/i,
    );
  });
});
