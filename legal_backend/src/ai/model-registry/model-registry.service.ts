/**
 * Model Registry Service (UMB-014)
 *
 * Resolves AI model configuration from the database-backed `AiModel` and
 * `AiModelAlias` tables, enabling admins to change model routing, pricing,
 * and aliases without a code deployment.
 *
 * Resolution order:
 *  1. DB alias match (AiModelAlias → AiModel) — when DB_MODEL_REGISTRY_ENABLED=true
 *  2. DB direct model ID match (AiModel)
 *  3. Static fallback from model-costs.config.ts
 *
 * DB_MODEL_REGISTRY_ENABLED defaults to false until the migration
 * (20260626100000_add_ai_model_registry) has been applied to the target database.
 * After applying the migration, set DB_MODEL_REGISTRY_ENABLED=true to activate
 * live DB-backed resolution.
 *
 * Results are in-memory cached with DB_MODEL_CACHE_TTL_MS TTL (default 60 s).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import {
  MODEL_COSTS,
  type AiLlmProvider,
  type ModelCostRates,
  resolveModelProvider,
  normalizeModelId,
} from '@/ai/model-costs.config';

export interface ResolvedModel {
  providerModelId: string;
  provider: AiLlmProvider;
  displayName: string;
  tier: string;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
  cachedInputPricePerMillionUsd?: number;
  supportsPromptCaching: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  enabled: boolean;
  /** Source: 'db' when found in database, 'static' when using config fallback. */
  source: 'db' | 'static';
}

interface DbAiModelRow {
  providerModelId: string;
  provider: string;
  displayName: string;
  tier: string;
  enabled: boolean;
  inputPricePerMillionUsd: string | null;
  outputPricePerMillionUsd: string | null;
  cachedInputPricePerMillionUsd: string | null;
  supportsPromptCaching: boolean;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  contextWindowTokens: string | null;
  maxOutputTokens: string | null;
}

interface CacheEntry {
  value: ResolvedModel | null;
  expiresAt: number;
}

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);

  /** In-memory cache: lookup key → resolved model. */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get isDbEnabled(): boolean {
    return this.configService.get<string>('DB_MODEL_REGISTRY_ENABLED', 'false') === 'true';
  }

  private get cacheTtlMs(): number {
    return Number(this.configService.get<string>('DB_MODEL_CACHE_TTL_MS', '60000'));
  }

  /**
   * Resolve a model ID or alias to a `ResolvedModel`.
   *
   * Accepts:
   *  - A provider model ID (e.g. "gpt-5.4-mini", "gpt-5.6-luna", "deepseek-chat")
   *  - An Umbrella alias (e.g. "umbrella-economy-default")
   *
   * Returns the resolved model config, always falling back to the static registry
   * if DB is disabled or the lookup finds nothing.
   */
  async resolve(modelIdOrAlias: string): Promise<ResolvedModel> {
    if (!this.isDbEnabled) {
      return this.staticFallback(modelIdOrAlias);
    }

    const cacheKey = modelIdOrAlias.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.value ?? this.staticFallback(modelIdOrAlias);
    }

    try {
      const dbModel = await this.resolveFromDb(modelIdOrAlias);
      this.cache.set(cacheKey, { value: dbModel, expiresAt: Date.now() + this.cacheTtlMs });
      if (dbModel) return dbModel;
    } catch (err) {
      this.logger.warn(
        `ModelRegistry DB lookup failed for "${modelIdOrAlias}", using static fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.staticFallback(modelIdOrAlias);
  }

  /** Resolve and return just the provider model ID string (for quick alias lookups). */
  async resolveModelId(alias: string): Promise<string> {
    const resolved = await this.resolve(alias);
    return resolved.providerModelId;
  }

  /**
   * List all enabled models.
   * Falls back to the static registry when DB is disabled or unavailable.
   */
  async listEnabledModels(): Promise<ResolvedModel[]> {
    if (!this.isDbEnabled) {
      return Object.entries(MODEL_COSTS).map(([id, rates]) => this.staticToResolved(id, rates));
    }

    try {
      const rows = await this.prisma.$queryRaw<DbAiModelRow[]>`
        SELECT
          "providerModelId", "provider", "displayName", "tier", "enabled",
          CAST("inputPricePerMillionUsd" AS TEXT) AS "inputPricePerMillionUsd",
          CAST("outputPricePerMillionUsd" AS TEXT) AS "outputPricePerMillionUsd",
          CAST("cachedInputPricePerMillionUsd" AS TEXT) AS "cachedInputPricePerMillionUsd",
          "supportsPromptCaching", "supportsToolCalling", "supportsStreaming",
          "supportsReasoning",
          CAST("contextWindowTokens" AS TEXT) AS "contextWindowTokens",
          CAST("maxOutputTokens" AS TEXT) AS "maxOutputTokens"
        FROM "AiModel"
        WHERE "enabled" = true
        ORDER BY "tier" ASC, "provider" ASC
      `;
      if (rows.length > 0) {
        return rows.map((r) => this.dbRowToResolved(r));
      }
    } catch (err) {
      this.logger.warn(`ModelRegistry listEnabledModels DB error: ${err instanceof Error ? err.message : String(err)}`);
    }

    return Object.entries(MODEL_COSTS).map(([id, rates]) => this.staticToResolved(id, rates));
  }

  /** Invalidate the in-memory cache (useful after admin model updates). */
  invalidateCache(): void {
    this.cache.clear();
    this.logger.log('ModelRegistry cache invalidated');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async resolveFromDb(modelIdOrAlias: string): Promise<ResolvedModel | null> {
    // 1. Try alias lookup first (AiModelAlias → AiModel)
    const aliasRows = await this.prisma.$queryRaw<DbAiModelRow[]>`
      SELECT
        m."providerModelId", m."provider", m."displayName", m."tier", m."enabled",
        CAST(m."inputPricePerMillionUsd" AS TEXT) AS "inputPricePerMillionUsd",
        CAST(m."outputPricePerMillionUsd" AS TEXT) AS "outputPricePerMillionUsd",
        CAST(m."cachedInputPricePerMillionUsd" AS TEXT) AS "cachedInputPricePerMillionUsd",
        m."supportsPromptCaching", m."supportsToolCalling", m."supportsStreaming",
        m."supportsReasoning",
        CAST(m."contextWindowTokens" AS TEXT) AS "contextWindowTokens",
        CAST(m."maxOutputTokens" AS TEXT) AS "maxOutputTokens"
      FROM "AiModelAlias" a
      JOIN "AiModel" m ON m."id" = a."aiModelId"
      WHERE a."alias" = ${modelIdOrAlias}
        AND a."enabled" = true
        AND m."enabled" = true
      LIMIT 1
    `;
    if (aliasRows.length > 0) {
      return this.dbRowToResolved(aliasRows[0]);
    }

    // 2. Try direct providerModelId lookup
    const modelRows = await this.prisma.$queryRaw<DbAiModelRow[]>`
      SELECT
        "providerModelId", "provider", "displayName", "tier", "enabled",
        CAST("inputPricePerMillionUsd" AS TEXT) AS "inputPricePerMillionUsd",
        CAST("outputPricePerMillionUsd" AS TEXT) AS "outputPricePerMillionUsd",
        CAST("cachedInputPricePerMillionUsd" AS TEXT) AS "cachedInputPricePerMillionUsd",
        "supportsPromptCaching", "supportsToolCalling", "supportsStreaming",
        "supportsReasoning",
        CAST("contextWindowTokens" AS TEXT) AS "contextWindowTokens",
        CAST("maxOutputTokens" AS TEXT) AS "maxOutputTokens"
      FROM "AiModel"
      WHERE "providerModelId" = ${modelIdOrAlias}
        AND "enabled" = true
      LIMIT 1
    `;
    if (modelRows.length > 0) {
      return this.dbRowToResolved(modelRows[0]);
    }

    return null;
  }

  private dbRowToResolved(row: DbAiModelRow): ResolvedModel {
    return {
      providerModelId: row.providerModelId,
      provider: row.provider as AiLlmProvider,
      displayName: row.displayName,
      tier: row.tier,
      inputPricePerMillionUsd: row.inputPricePerMillionUsd ? parseFloat(row.inputPricePerMillionUsd) : 0,
      outputPricePerMillionUsd: row.outputPricePerMillionUsd ? parseFloat(row.outputPricePerMillionUsd) : 0,
      cachedInputPricePerMillionUsd: row.cachedInputPricePerMillionUsd
        ? parseFloat(row.cachedInputPricePerMillionUsd)
        : undefined,
      supportsPromptCaching: row.supportsPromptCaching,
      supportsToolCalling: row.supportsToolCalling,
      supportsStreaming: row.supportsStreaming,
      supportsReasoning: row.supportsReasoning,
      contextWindowTokens: row.contextWindowTokens ? parseInt(row.contextWindowTokens, 10) : undefined,
      maxOutputTokens: row.maxOutputTokens ? parseInt(row.maxOutputTokens, 10) : undefined,
      enabled: row.enabled,
      source: 'db',
    };
  }

  private staticFallback(modelIdOrAlias: string): ResolvedModel {
    const normalized = normalizeModelId(modelIdOrAlias);
    const rates: ModelCostRates = MODEL_COSTS[normalized] ?? {
      provider: resolveModelProvider(normalized),
      inputPer1M: 0.4,
      outputPer1M: 1.6,
      tier: 'cheap',
      label: normalized,
    };
    return this.staticToResolved(normalized, rates);
  }

  private staticToResolved(modelId: string, rates: ModelCostRates): ResolvedModel {
    return {
      providerModelId: modelId,
      provider: rates.provider,
      displayName: rates.label,
      tier: rates.tier,
      inputPricePerMillionUsd: rates.inputPer1M,
      outputPricePerMillionUsd: rates.outputPer1M,
      cachedInputPricePerMillionUsd: undefined,
      supportsPromptCaching: false,
      supportsToolCalling: true,
      supportsStreaming: true,
      supportsReasoning: rates.tier === 'reasoning',
      enabled: true,
      source: 'static',
    };
  }
}
