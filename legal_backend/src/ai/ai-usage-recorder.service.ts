import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveModelProvider } from '@/ai/model-costs.config';
import { AiCostService } from '@/ai/costs/ai-cost.service';
import { AiCreditEnforcementService } from '@/ai-credits/ai-credit-enforcement.service';
import { AICreditLedgerService } from '@/ai-credits/ai-credit-ledger.service';
import { getCreditCost } from '@/ai-credits/credit-costs';
import { AiUsageService } from '@/ai/ai-usage.service';

export interface RecordTokenUsageParams {
  userId?: string;
  tenantId?: string;
  consumerCaseId?: string;
  matterId?: string;
  taskType: string;
  mode: string;
  modelName: string;
  modelProvider?: string;
  modelTier?: string;
  inputTokens: number;
  outputTokens: number;
  retrievalCount?: number;
  status?: string;
  error?: string;
  latencyMs?: number;
  countryCode?: string;
  metadata?: Record<string, unknown>;
  /** Skip debit when credits were already charged (e.g. mock provider). */
  skipDebit?: boolean;
  flatCredits?: number;
}

export interface RecordFlatUsageParams {
  userId?: string;
  tenantId?: string;
  consumerCaseId?: string;
  matterId?: string;
  taskType: string;
  mode: string;
  modelName: string;
  modelProvider?: string;
  modelTier?: string;
  credits: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  status?: string;
  error?: string;
  latencyMs?: number;
  countryCode?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AiUsageRecorderService {
  constructor(
    private readonly aiUsage: AiUsageService,
    private readonly aiCostService: AiCostService,
    private readonly creditEnforcement: AiCreditEnforcementService,
    private readonly creditLedger: AICreditLedgerService,
  ) {}

  async recordTokenUsage(params: RecordTokenUsageParams) {
    const provider = params.modelProvider ?? resolveModelProvider(params.modelName);
    const costUsd = await this.aiCostService.computeActualCostUsd({
      provider,
      modelName: params.modelName,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    });

    let chargedCredits = params.flatCredits ?? getCreditCost(params.taskType);

    if (!params.skipDebit) {
      const debit = await this.creditEnforcement.debitForTokenUsage({
        userId: params.userId,
        tenantId: params.tenantId,
        taskType: params.taskType,
        modelName: params.modelName,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        metadata: {
          ...(params.metadata ?? {}),
          consumerCaseId: params.consumerCaseId,
          matterId: params.matterId,
        } as Prisma.InputJsonValue,
      });
      chargedCredits = debit.usageCharge.credits;
    } else if (params.flatCredits != null) {
      await this.creditLedger.assertAndDebit({
        userId: params.userId,
        tenantId: params.tenantId,
        taskType: params.taskType,
        credits: params.flatCredits,
        metadata: {
          ...(params.metadata ?? {}),
          consumerCaseId: params.consumerCaseId,
          matterId: params.matterId,
        } as Prisma.InputJsonValue,
      });
    }

    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      chargedCredits,
      params.countryCode,
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    await this.aiUsage.logUsage({
      userId: params.userId,
      tenantId: params.tenantId,
      consumerCaseId: params.consumerCaseId,
      matterId: params.matterId,
      taskType: params.taskType,
      mode: params.mode,
      modelProvider: provider,
      modelName: params.modelName,
      modelTier: params.modelTier,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      retrievalCount: params.retrievalCount ?? 0,
      costUsd,
      chargedCredits,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: params.latencyMs,
      status: params.status ?? 'SUCCESS',
      error: params.error,
    });

    return { costUsd, chargedCredits, creditValueUsd, platformMarginUsd };
  }

  /** Log usage for flat-credit debits that already happened via assertAndDebit. */
  async recordAfterFlatDebit(params: RecordFlatUsageParams) {
    const provider = params.modelProvider ?? resolveModelProvider(params.modelName);
    const inputTokens = params.inputTokens ?? 0;
    const outputTokens = params.outputTokens ?? 0;
    const costUsd =
      params.costUsd ??
      (inputTokens + outputTokens > 0
        ? await this.aiCostService.computeActualCostUsd({
            provider,
            modelName: params.modelName,
            inputTokens,
            outputTokens,
          })
        : 0);

    const creditValueUsd = this.aiCostService.computeCreditValueUsd(
      params.credits,
      params.countryCode,
    );
    const { platformMarginUsd } = this.aiCostService.computeMargin({
      creditValueUsd,
      actualCostUsd: costUsd,
    });

    await this.aiUsage.logUsage({
      userId: params.userId,
      tenantId: params.tenantId,
      consumerCaseId: params.consumerCaseId,
      matterId: params.matterId,
      taskType: params.taskType,
      mode: params.mode,
      modelProvider: provider,
      modelName: params.modelName,
      modelTier: params.modelTier,
      inputTokens,
      outputTokens,
      costUsd,
      chargedCredits: params.credits,
      creditValueUsd,
      platformMarginUsd,
      latencyMs: params.latencyMs,
      status: params.status ?? 'SUCCESS',
      error: params.error,
    });

    return { costUsd, chargedCredits: params.credits, creditValueUsd, platformMarginUsd };
  }
}
