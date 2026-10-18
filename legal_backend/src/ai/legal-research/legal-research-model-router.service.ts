import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveSeriousSynthesisModel, SERIOUS_LEGAL_MODEL } from './serious-model-lock';

export type ResearchComplexity = 'QUICK' | 'STANDARD' | 'COMPLEX' | 'ULTRA';

export interface LegalModelRoute {
  complexity: ResearchComplexity;
  /** Model for synthesis — resolved from AI_LEGAL_* env vars, never a hardcoded ID. */
  synthesisModel: string;
  /** Model for verification — deliberately from a different provider when cross-provider check is active. */
  verifierModel: string;
  /** Model for claim-level repair (Wave 3). */
  repairModel: string;
  reasoningEffort: 'low' | 'medium' | 'high';
  maxInputTokens: number;
  maxOutputTokens: number;
  /**
   * Cross-provider verification is expensive. Only required when risk justifies it.
   * Normal STANDARD research without conflicts should not incur a second-provider call.
   */
  requireCrossProviderVerification: boolean;
}

export interface ModelRouterInput {
  complexity: ResearchComplexity;
  highRisk: boolean;
  unresolvedConflict: boolean;
  negativeTreatmentFound: boolean;
  materialClaimSupportScore?: number;
  planAllowsUltra?: boolean;
  /** DEEP / serious research — lock synthesis + repair to Sol; ban cheap downgrade. */
  forceTopTier?: boolean;
}

/**
 * Resolves AI models and token budgets from capability aliases (AI_LEGAL_* env vars).
 * No literal model IDs live in this service — swap models by updating env vars alone.
 */
/** Env vars are strings — coerce before sending to OpenAI as max_completion_tokens. */
function readPositiveIntConfig(
  configService: ConfigService,
  key: string,
  defaultValue: number,
): number {
  const raw = configService.get<string>(key);
  if (raw === undefined || raw === null || raw === '') {
    return defaultValue;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : defaultValue;
}

@Injectable()
export class LegalResearchModelRouter {
  constructor(private readonly configService: ConfigService) {}

  resolve(input: ModelRouterInput): LegalModelRoute {
    const complexity = this.resolveEffectiveComplexity(input);
    const seriousSynthesisTier =
      input.forceTopTier === true || complexity === 'COMPLEX' || complexity === 'ULTRA';

    const synthesisModel = seriousSynthesisTier
      ? resolveSeriousSynthesisModel(
          this.configService.get<string>('AI_LEGAL_COMPLEX_MODEL', SERIOUS_LEGAL_MODEL),
        )
      : this.resolveSynthesisModel(complexity);
    const verifierModel = this.resolveVerifierModel(complexity, input);
    const repairModel = seriousSynthesisTier
      ? resolveSeriousSynthesisModel(
          this.configService.get<string>('AI_LEGAL_COMPLEX_MODEL', SERIOUS_LEGAL_MODEL),
        )
      : this.configService.get<string>('AI_LEGAL_REPAIR_MODEL', 'gpt-5.6-terra');

    const { reasoningEffort, maxInputTokens, maxOutputTokens } =
      this.resolveTokenBudget(seriousSynthesisTier && complexity === 'QUICK' ? 'STANDARD' : complexity);

    const requireCrossProviderVerification = this.shouldCrossVerify(input);

    return {
      complexity: seriousSynthesisTier && complexity === 'QUICK' ? 'STANDARD' : complexity,
      synthesisModel,
      verifierModel,
      repairModel,
      reasoningEffort,
      maxInputTokens,
      maxOutputTokens,
      requireCrossProviderVerification,
    };
  }

  private resolveEffectiveComplexity(input: ModelRouterInput): ResearchComplexity {
    const ultraEnabled =
      this.configService.get<string>('LEGAL_RESEARCH_ENABLE_ULTRA', 'false') === 'true';

    if (input.complexity === 'ULTRA') {
      if (ultraEnabled && input.planAllowsUltra) return 'ULTRA';
      return 'COMPLEX';
    }
    return input.complexity;
  }

  private resolveSynthesisModel(complexity: ResearchComplexity): string {
    switch (complexity) {
      case 'QUICK':
        return this.configService.get<string>('AI_LEGAL_FAST_MODEL', 'gpt-5.6-luna');
      case 'STANDARD':
        return this.configService.get<string>('AI_LEGAL_STANDARD_MODEL', 'gpt-5.6-terra');
      case 'COMPLEX':
        return this.configService.get<string>('AI_LEGAL_COMPLEX_MODEL', 'gpt-5.6-sol');
      case 'ULTRA':
        return this.configService.get<string>('AI_LEGAL_COMPLEX_MODEL', 'gpt-5.6-sol');
    }
  }

  private resolveVerifierModel(
    complexity: ResearchComplexity,
    input: ModelRouterInput,
  ): string {
    const needsHardVerifier =
      complexity === 'COMPLEX' ||
      complexity === 'ULTRA' ||
      this.shouldCrossVerify(input);

    return needsHardVerifier
      ? this.configService.get<string>('AI_LEGAL_HARD_VERIFIER_MODEL', 'gpt-5.6-sol')
      : this.configService.get<string>('AI_LEGAL_LIGHT_VERIFIER_MODEL', 'gpt-5.6-terra');
  }

  /**
   * Independent verification pass (Sol) — same provider is OK; must be a
   * separate completion with an adversarial prompt, not self-certification.
   */
  private shouldCrossVerify(input: ModelRouterInput): boolean {
    return (
      input.highRisk ||
      input.unresolvedConflict ||
      input.negativeTreatmentFound ||
      input.complexity === 'ULTRA' ||
      (input.materialClaimSupportScore !== undefined &&
        input.materialClaimSupportScore < 0.85)
    );
  }

  private resolveTokenBudget(complexity: ResearchComplexity): {
    reasoningEffort: 'low' | 'medium' | 'high';
    maxInputTokens: number;
    maxOutputTokens: number;
  } {
    switch (complexity) {
      case 'QUICK':
        return {
          reasoningEffort: 'low',
          maxInputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_QUICK_MAX_INPUT_TOKENS',
            16_000,
          ),
          maxOutputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_QUICK_MAX_OUTPUT_TOKENS',
            2_500,
          ),
        };
      case 'STANDARD': {
        const fastPipelineEnabled =
          this.configService.get<string>('LEGAL_RESEARCH_FAST_PIPELINE_ENABLED', 'true') !==
          'false';
        return {
          reasoningEffort: 'medium',
          maxInputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_STANDARD_MAX_INPUT_TOKENS',
            32_000,
          ),
          maxOutputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_STANDARD_MAX_OUTPUT_TOKENS',
            fastPipelineEnabled ? 4_500 : 6_000,
          ),
        };
      }
      case 'COMPLEX':
        return {
          reasoningEffort: 'high',
          maxInputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_COMPLEX_MAX_INPUT_TOKENS',
            64_000,
          ),
          maxOutputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_COMPLEX_MAX_OUTPUT_TOKENS',
            10_000,
          ),
        };
      case 'ULTRA':
        return {
          reasoningEffort: 'high',
          maxInputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_COMPLEX_MAX_INPUT_TOKENS',
            64_000,
          ),
          maxOutputTokens: readPositiveIntConfig(
            this.configService,
            'LEGAL_COMPLEX_MAX_OUTPUT_TOKENS',
            10_000,
          ),
        };
    }
  }
}
