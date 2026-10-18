import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveModelProvider } from '@/ai/model-costs.config';

export interface AiModelEnvEntry {
  key: string;
  value: string;
  provider: string;
  isClaude: boolean;
}

export interface AiModelEnvAudit {
  anthropicApiKeyConfigured: boolean;
  premiumModels: string[];
  legalResearchModels: AiModelEnvEntry[];
  claudeInLegalResearchPath: boolean;
  notes: string[];
}

/**
 * Logs configured AI model env vars at startup and exposes audit for ops/admin.
 */
@Injectable()
export class AiModelEnvAuditService implements OnModuleInit {
  private readonly logger = new Logger(AiModelEnvAuditService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const audit = this.buildAudit();
    if (audit.claudeInLegalResearchPath) {
      this.logger.warn(
        `Claude configured on legal-research env path: ${audit.legalResearchModels
          .filter((m) => m.isClaude)
          .map((m) => m.key)
          .join(', ')}`,
      );
    } else {
      this.logger.log(
        `AI legal-research models: ${audit.legalResearchModels.map((m) => `${m.key}=${m.value}`).join('; ')}`,
      );
    }
  }

  buildAudit(): AiModelEnvAudit {
    const legalKeys = [
      'AI_LEGAL_FAST_MODEL',
      'AI_LEGAL_STANDARD_MODEL',
      'AI_LEGAL_COMPLEX_MODEL',
      'AI_LEGAL_COMPLEX_FALLBACK_MODEL',
      'AI_LEGAL_LIGHT_VERIFIER_MODEL',
      'AI_LEGAL_HARD_VERIFIER_MODEL',
      'AI_LEGAL_REPAIR_MODEL',
      'AI_LEGAL_ORCHESTRATOR_MODEL',
      'AI_REASONING_MODEL',
      'AI_MID_MODEL',
    ] as const;

    const legalResearchModels: AiModelEnvEntry[] = legalKeys.map((key) => {
      const value = this.configService.get<string>(key, '').trim() || '(unset)';
      const modelId = value === '(unset)' ? '' : value;
      const isClaude = modelId.startsWith('claude-');
      const provider = modelId
        ? isClaude
          ? 'anthropic'
          : resolveModelProvider(modelId)
        : 'unknown';
      return {
        key,
        value,
        provider,
        isClaude,
      };
    });

    const premiumRaw =
      this.configService.get<string>('AI_PREMIUM_MODELS', '') ||
      'gpt-5.6-sol,gpt-5.6-terra,gpt-5.6-luna,claude-sonnet-4-6,claude-opus-4-8';
    const premiumModels = premiumRaw.split(',').map((s) => s.trim()).filter(Boolean);

    const anthropicApiKeyConfigured = Boolean(
      this.configService.get<string>('ANTHROPIC_API_KEY', '').trim(),
    );

    const claudeInLegalResearchPath = legalResearchModels.some((m) => m.isClaude);

    const notes: string[] = [];
    if (!anthropicApiKeyConfigured) {
      notes.push('ANTHROPIC_API_KEY is unset — Claude picker models and Haiku fallback will fail.');
    }
    if (legalResearchModels.find((m) => m.key === 'AI_LEGAL_COMPLEX_FALLBACK_MODEL')?.isClaude) {
      notes.push(
        'AI_LEGAL_COMPLEX_FALLBACK_MODEL is Claude but is only used when the primary env for a route tier is unset.',
      );
    }
    notes.push(
      'Verified legal research synthesis uses AI_LEGAL_* models in AUTO mode; PREMIUM mode uses the user-selected premium model.',
    );

    return {
      anthropicApiKeyConfigured,
      premiumModels,
      legalResearchModels,
      claudeInLegalResearchPath,
      notes,
    };
  }
}
