import {
  isSeriousDraftPath,
  resolveSeriousDraftModel,
  resolveSeriousSynthesisModel,
  SERIOUS_LEGAL_MODEL,
} from './serious-model-lock';
import { DRAFT_PREMIUM_MODEL } from '@/ai/model-costs.config';
import { LegalResearchModelRouter } from './legal-research-model-router.service';
import type { ConfigService } from '@nestjs/config';

describe('serious-model-lock', () => {
  it('rejects luna/mini downgrades on serious synthesis', () => {
    expect(resolveSeriousSynthesisModel('gpt-5.6-luna')).toBe(SERIOUS_LEGAL_MODEL);
    expect(resolveSeriousSynthesisModel('gpt-5.4-mini')).toBe(SERIOUS_LEGAL_MODEL);
    expect(resolveSeriousSynthesisModel('gpt-5.6-sol')).toBe('gpt-5.6-sol');
  });

  it('treats non-express standard/complex as serious drafts', () => {
    expect(
      isSeriousDraftPath({ expressMode: false, complexity: 'standard' }),
    ).toBe(true);
    expect(isSeriousDraftPath({ expressMode: true, complexity: 'complex' })).toBe(true);
  });

  it('resolves Sol for serious drafts', () => {
    expect(
      resolveSeriousDraftModel({
        expressMode: false,
        complexity: 'standard',
        economyModel: 'deepseek-chat',
        enrichModel: 'gpt-5.6-terra',
      }),
    ).toBe(DRAFT_PREMIUM_MODEL);
  });
});

describe('LegalResearchModelRouter forceTopTier', () => {
  const config = {
    get: (key: string, fallback?: string) => {
      const map: Record<string, string> = {
        AI_LEGAL_FAST_MODEL: 'gpt-5.6-luna',
        AI_LEGAL_STANDARD_MODEL: 'gpt-5.6-terra',
        AI_LEGAL_COMPLEX_MODEL: 'gpt-5.6-sol',
        AI_LEGAL_HARD_VERIFIER_MODEL: 'gpt-5.6-sol',
        AI_LEGAL_LIGHT_VERIFIER_MODEL: 'gpt-5.6-terra',
        AI_LEGAL_REPAIR_MODEL: 'gpt-5.6-terra',
        LEGAL_RESEARCH_ENABLE_ULTRA: 'false',
      };
      return map[key] ?? fallback;
    },
  } as unknown as ConfigService;

  const router = new LegalResearchModelRouter(config);

  it('locks DEEP/forceTopTier research onto Sol', () => {
    const route = router.resolve({
      complexity: 'STANDARD',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
      forceTopTier: true,
    });
    expect(route.synthesisModel).toContain('sol');
    expect(route.repairModel).toContain('sol');
    expect(route.verifierModel).toContain('sol');
  });

  it('keeps QUICK on premium without requiring a user model selection', () => {
    const route = router.resolve({
      complexity: 'QUICK',
      highRisk: false,
      unresolvedConflict: false,
      negativeTreatmentFound: false,
    });
    expect(route.synthesisModel).toContain('sol');
  });
});
