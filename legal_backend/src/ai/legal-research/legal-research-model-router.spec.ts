import { LegalResearchModelRouter } from './legal-research-model-router.service';

function mockConfig(values: Record<string, string>) {
  return {
    get: <T = string>(key: string, defaultValue?: T) =>
      (values[key] as T | undefined) ?? defaultValue,
  };
}

describe('LegalResearchModelRouter GPT-5.6 hierarchy', () => {
  const router = new LegalResearchModelRouter(
    mockConfig({}) as never,
  );

  it('uses premium synthesis, repair and verification for QUICK requests', () => {
    const route = router.resolve({
      complexity: 'QUICK',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
    });
    expect(route.synthesisModel).toBe('gpt-5.6-sol');
    expect(route.verifierModel).toBe('gpt-5.6-sol');
    expect(route.repairModel).toBe('gpt-5.6-sol');
  });

  it('uses premium synthesis for STANDARD requests', () => {
    const route = router.resolve({
      complexity: 'STANDARD',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
    });
    expect(route.synthesisModel).toBe('gpt-5.6-sol');
    expect(route.verifierModel).toBe('gpt-5.6-sol');
    expect(route.maxOutputTokens).toBe(4_500);
  });

  it('maps COMPLEX → Sol synthesis and Sol hard verifier', () => {
    const route = router.resolve({
      complexity: 'COMPLEX',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
    });
    expect(route.synthesisModel).toBe('gpt-5.6-sol');
    expect(route.verifierModel).toBe('gpt-5.6-sol');
    expect(route.requireCrossProviderVerification).toBe(false);
  });

  it('escalates to Sol hard verifier on conflicts / high risk', () => {
    const route = router.resolve({
      complexity: 'STANDARD',
      highRisk: true,
      unresolvedConflict: true,
      negativeTreatmentFound: true,
    });
    expect(route.synthesisModel).toBe('gpt-5.6-sol');
    expect(route.verifierModel).toBe('gpt-5.6-sol');
    expect(route.requireCrossProviderVerification).toBe(true);
  });

  it('uses Sol hard verifier when claim support is below threshold', () => {
    const route = router.resolve({
      complexity: 'STANDARD',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
      materialClaimSupportScore: 0.5,
    });
    expect(route.verifierModel).toBe('gpt-5.6-sol');
    expect(route.requireCrossProviderVerification).toBe(true);
  });

  it('coerces string env token limits to numbers for OpenAI requests', () => {
    const configured = new LegalResearchModelRouter(
      mockConfig({
        LEGAL_STANDARD_MAX_OUTPUT_TOKENS: '6000',
        LEGAL_STANDARD_MAX_INPUT_TOKENS: '32000',
      }) as never,
    );
    const route = configured.resolve({
      complexity: 'STANDARD',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
    });
    expect(route.maxOutputTokens).toBe(6000);
    expect(typeof route.maxOutputTokens).toBe('number');
    expect(route.maxInputTokens).toBe(32_000);
    expect(typeof route.maxInputTokens).toBe('number');
  });
});
