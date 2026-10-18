import {
  analyticalAgentRoundBudget,
  decideAnalyticalMode,
  shouldForceDeepForThinJurisdiction,
  shouldForceWebSearch,
} from './analytical-research-mode';

describe('analytical-research-mode', () => {
  it('enables analytical mode for best-effort thin RAG', () => {
    const decision = decideAnalyticalMode({
      countryCode: 'UG',
      authorityCount: 0,
      sufficiencyPassed: false,
    });
    expect(decision.enabled).toBe(true);
    expect(decision.relianceLabel).toBe('analytical-guidance');
    expect(decision.reasons).toContain('best_effort_jurisdiction');
  });

  it('keeps deep jurisdictions source-grounded when retrieval is strong', () => {
    const decision = decideAnalyticalMode({
      countryCode: 'IN',
      authorityCount: 5,
      sufficiencyPassed: true,
    });
    expect(decision.enabled).toBe(false);
    expect(decision.relianceLabel).toBe('source-grounded');
  });

  it('allows analytical fallback for deep jurisdictions with zero authorities', () => {
    const decision = decideAnalyticalMode({
      countryCode: 'KE',
      authorityCount: 0,
      sufficiencyPassed: false,
    });
    expect(decision.enabled).toBe(true);
    expect(decision.reasons).toContain('zero_authorities');
  });

  it('does not upgrade Fast or Guidance to DEEP', () => {
    expect(
      shouldForceDeepForThinJurisdiction({
        countryCode: 'UG',
        researchMode: 'FAST',
        complexity: 'COMPLEX',
      }),
    ).toBe(false);
    expect(
      shouldForceDeepForThinJurisdiction({
        countryCode: 'UG',
        researchMode: 'GUIDANCE',
        complexity: 'ULTRA',
      }),
    ).toBe(false);
    expect(
      shouldForceDeepForThinJurisdiction({
        countryCode: 'IN',
        researchMode: 'FAST',
        complexity: 'COMPLEX',
      }),
    ).toBe(false);
  });

  it('forces web search outside deep jurisdictions', () => {
    expect(shouldForceWebSearch('UG')).toBe(true);
    expect(shouldForceWebSearch('US')).toBe(false);
  });

  it('raises agent round budget for analytical / thin jurisdictions', () => {
    expect(
      analyticalAgentRoundBudget({
        countryCode: 'UG',
        analyticalMode: true,
        configuredMax: 2,
      }),
    ).toBe(4);
  });
});
