import { DraftArchetypeRouterService } from './draft-archetype-router.service';

describe('DraftArchetypeRouterService', () => {
  const router = new DraftArchetypeRouterService();

  it('routes stalking facts to BNS §78 + FIR kind for India', () => {
    const result = router.route({
      jurisdiction: 'IN',
      caseDetails:
        'Mr K, 50, stalks Ms S, 19. They are neighbours. No relationship. She wants to file a police complaint.',
      offenceDate: '2025-01-15',
    });
    expect(result.matched).toBe(true);
    expect(result.recommendedKind).toBe('india_fir_complaint');
    expect(result.governingSections.some((s) => s.actId === 'bns' && s.section === '78')).toBe(
      true,
    );
    expect(result.governingSections.some((s) => s.actId === 'bnss' && s.section === '173')).toBe(
      true,
    );
    expect(result.register).toBe('police_complaint');
  });

  it('routes NI Act cheque bounce to magistrate complaint kind', () => {
    const result = router.route({
      jurisdiction: 'IN',
      caseDetails: 'Cheque bounce under NI Act section 138. Statutory notice sent.',
    });
    expect(result.matched).toBe(true);
    expect(result.recommendedKind).toBe('india_cheque_bounce_complaint_ni138');
    expect(result.archetype).toBe('magistrate_private_complaint');
  });

  it('routes US stalking to restraining order or criminal complaint', () => {
    const result = router.route({
      jurisdiction: 'US',
      caseDetails: 'Neighbor has been stalking and harassing me. I need a restraining order.',
    });
    expect(result.matched).toBe(true);
    expect(result.recommendedKind).toBe('us_state_restraining_order');
  });

  it('does not treat company name DV Tech as domestic violence', () => {
    const result = router.route({
      jurisdiction: 'US',
      caseDetails:
        'draft an agreement with DV Tech ventures co and meher srivastava an influencer engagement for reels at INR 2000 per reel',
    });
    expect(result.recommendedKind).not.toBe('us_state_domestic_violence_petition');
  });

  it('still routes explicit DV petition language to domestic violence petition', () => {
    const result = router.route({
      jurisdiction: 'US',
      caseDetails: 'I need a DV petition against my spouse for domestic violence and a protective order.',
    });
    expect(result.matched).toBe(true);
    expect(result.recommendedKind).toBe('us_state_domestic_violence_petition');
  });

  it('routes federal wire fraud to federal criminal complaint', () => {
    const result = router.route({
      jurisdiction: 'US',
      caseDetails: 'Defendant committed wire fraud under 18 U.S.C. §1343 using interstate wires.',
    });
    expect(result.matched).toBe(true);
    expect(result.recommendedKind).toBe('us_federal_criminal_complaint');
  });

  it('does not invent sections when no archetype matches', () => {
    const result = router.route({
      jurisdiction: 'IN',
      caseDetails: 'Please draft something generic about weather.',
    });
    expect(result.matched).toBe(false);
    expect(result.governingSections).toEqual([]);
  });
});
