import { LegalSearchPlanService } from './legal-search-plan.service';

describe('LegalSearchPlanService jurisdiction handling', () => {
  const service = new LegalSearchPlanService();

  it('does not inject India statute anchors when jurisdiction is unresolved', () => {
    const plan = service.buildSearchPlan({
      query: 'employee termination requirements',
      legalDomain: 'EMPLOYMENT',
    });

    expect(plan.expandedQueries.join(' ')).not.toMatch(
      /Industrial Disputes Act|POSH Act/i,
    );
  });

  it('adds Kenya statute anchors for Kenya research', () => {
    const plan = service.buildSearchPlan({
      query: 'employee termination requirements',
      countryCode: 'KE',
      legalDomain: 'EMPLOYMENT',
    });

    expect(plan.expandedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Employment Act 2007'),
        expect.stringContaining('Labour Relations Act 2007'),
      ]),
    );
  });
});
