import { Injectable, Logger } from '@nestjs/common';
import { ModelCapability } from '../gateways/ai-gateway.interface';
import { RiskLevel } from '../../common/types';
import { ModelRegistryEntry, ModelTier } from './model-registry.types';
import { ModelRegistryService } from './model-registry.service';

export interface ModelRoutingRequest {
  taskType: string;
  requiredCapabilities: ModelCapability[];
  riskLevel: RiskLevel;
  inputTokensEstimate: number;
  maxOutputTokens: number;
  maxCostUsd?: number;
  maxLatencyMs?: number;
  allowedProviders?: string[];
  excludedProviders?: string[];
  preferStructuredOutput?: boolean;
}

export interface ModelRoutingDecision {
  provider: string;
  model: string;
  modelId: string;
  reason: string;
  estimatedCostUsd: number;
  fallbackChain: Array<{ provider: string; model: string }>;
}

const RISK_TO_MAX_TIER: Record<RiskLevel, ModelTier> = {
  low: 'tier1_small',
  medium: 'tier2_medium',
  high: 'tier3_large',
  critical: 'tier3_large',
};

const RISK_MIN_TIER_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 0,
  high: 2,
  critical: 3,
};

const TIER_RANK: Record<ModelTier, number> = {
  tier0_deterministic: 0,
  tier1_small: 1,
  tier2_medium: 2,
  tier3_large: 3,
};

const LATENCY_MS: Record<'fast' | 'medium' | 'slow', number> = {
  fast: 2000,
  medium: 8000,
  slow: 30000,
};

@Injectable()
export class ModelRoutingService {
  private readonly logger = new Logger(ModelRoutingService.name);

  constructor(private readonly registry: ModelRegistryService) {}

  route(request: ModelRoutingRequest): ModelRoutingDecision {
    const candidates = this.buildCandidateList(request);

    if (candidates.length === 0) {
      throw new Error(
        `No suitable model found for task "${request.taskType}" with risk="${request.riskLevel}" ` +
          `and capabilities=[${request.requiredCapabilities.join(', ')}]`,
      );
    }

    const primary = candidates[0];
    const estimatedCost = this.estimateCost(
      primary.id,
      request.inputTokensEstimate,
      request.maxOutputTokens,
    );

    const fallbackChain = candidates
      .slice(1, 4)
      .map((m) => ({ provider: m.provider, model: m.model }));

    const reason = this.buildReason(primary, request);

    this.logger.debug(
      `Routed task "${request.taskType}" → ${primary.id} (cost ~$${estimatedCost.toFixed(6)})`,
    );

    return {
      provider: primary.provider,
      model: primary.model,
      modelId: primary.id,
      reason,
      estimatedCostUsd: estimatedCost,
      fallbackChain,
    };
  }

  estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    const entry = this.registry.findById(modelId);
    if (!entry) return 0;

    const inputCost =
      (inputTokens / 1000) * entry.costProfile.inputCostPer1kTokensUsd;
    const outputCost =
      (outputTokens / 1000) * entry.costProfile.outputCostPer1kTokensUsd;

    return inputCost + outputCost;
  }

  private buildCandidateList(request: ModelRoutingRequest): ModelRegistryEntry[] {
    const {
      requiredCapabilities,
      riskLevel,
      maxCostUsd,
      maxLatencyMs,
      allowedProviders,
      excludedProviders,
      preferStructuredOutput,
      inputTokensEstimate,
      maxOutputTokens,
    } = request;

    const maxTier = RISK_TO_MAX_TIER[riskLevel];
    const minTierRank = RISK_MIN_TIER_RANK[riskLevel];

    let candidates = this.registry.findForTask({
      capabilities: requiredCapabilities,
      maxTier,
      riskLevel,
    });

    // Enforce minimum tier for high/critical risk
    if (minTierRank > 0) {
      candidates = candidates.filter(
        (m) => TIER_RANK[m.tier] >= minTierRank,
      );
    }

    // Provider allow/deny filters
    if (allowedProviders && allowedProviders.length > 0) {
      candidates = candidates.filter((m) => allowedProviders.includes(m.provider));
    }
    if (excludedProviders && excludedProviders.length > 0) {
      candidates = candidates.filter((m) => !excludedProviders.includes(m.provider));
    }

    // Context window: model must accommodate the input
    candidates = candidates.filter(
      (m) => m.contextWindow >= inputTokensEstimate && m.maxOutputTokens >= maxOutputTokens,
    );

    // Latency constraint
    if (maxLatencyMs !== undefined) {
      candidates = candidates.filter(
        (m) => LATENCY_MS[m.latencyClass] <= maxLatencyMs,
      );
    }

    // Cost constraint: filter by per-request budget
    if (maxCostUsd !== undefined) {
      candidates = candidates.filter((m) => {
        const cost = this.estimateCost(m.id, inputTokensEstimate, maxOutputTokens);
        return cost <= maxCostUsd;
      });
    }

    // Prefer structured output capable models when requested
    if (preferStructuredOutput) {
      const structured = candidates.filter((m) => m.supportsStructuredOutput);
      if (structured.length > 0) {
        candidates = structured;
      }
    }

    // Sort: cheapest first within the same latency class, then by latency
    candidates.sort((a, b) => {
      const latencyDiff = LATENCY_MS[a.latencyClass] - LATENCY_MS[b.latencyClass];
      if (latencyDiff !== 0) return latencyDiff;
      const costA = this.estimateCost(a.id, inputTokensEstimate, maxOutputTokens);
      const costB = this.estimateCost(b.id, inputTokensEstimate, maxOutputTokens);
      return costA - costB;
    });

    return candidates;
  }

  private buildReason(model: ModelRegistryEntry, request: ModelRoutingRequest): string {
    const parts: string[] = [
      `Selected ${model.displayName} (${model.id})`,
      `tier=${model.tier}`,
      `risk=${request.riskLevel}`,
      `latency=${model.latencyClass}`,
    ];
    if (request.preferStructuredOutput && model.supportsStructuredOutput) {
      parts.push('structured_output=supported');
    }
    return parts.join(', ');
  }
}
