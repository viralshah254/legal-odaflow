import {
  inferCaseLawStatusFromDiagnostics,
  isCaseLawProviderFailureStatus,
  shouldSkipCaseLawCoverageRetries,
} from './research-provider-gate';

describe('research-provider-gate', () => {
  it('treats unauthorized and circuit_open as provider failures', () => {
    expect(isCaseLawProviderFailureStatus('unauthorized')).toBe(true);
    expect(isCaseLawProviderFailureStatus('circuit_open')).toBe(true);
    expect(isCaseLawProviderFailureStatus('searched')).toBe(false);
    expect(isCaseLawProviderFailureStatus('no_hits')).toBe(false);
  });

  it('infers hard failure status from IK diagnostics', () => {
    expect(
      inferCaseLawStatusFromDiagnostics([
        { provider: 'india-kanoon', status: 'unauthorized' },
        { provider: 'india-kanoon', status: 'circuit_open' },
      ]),
    ).toBe('unauthorized');
  });

  it('skips further case-law coverage when circuit is open', () => {
    expect(
      shouldSkipCaseLawCoverageRetries({
        caseLawSearchStatus: 'circuit_open',
        indiaKanoonCircuitOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipCaseLawCoverageRetries({
        caseLawSearchStatus: 'searched',
        indiaKanoonCircuitOpen: true,
      }),
    ).toBe(true);
    expect(
      shouldSkipCaseLawCoverageRetries({
        caseLawSearchStatus: 'no_hits',
        indiaKanoonCircuitOpen: false,
      }),
    ).toBe(false);
  });
});
