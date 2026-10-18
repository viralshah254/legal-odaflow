import { Body, Controller, Delete, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { AIBudgetPolicyService } from '@/cost-monitoring/ai-budget-policy.service';
import { UpdateAiPreferencesDto } from './dto/update-ai-preferences.dto';
import { UpdateAiBudgetPolicyDto } from './dto/update-ai-budget-policy.dto';
import { EstimateTaskDto } from './dto/estimate-task.dto';
import { ConfirmAutoTopUpDto } from './dto/confirm-auto-topup.dto';
import { AutoTopUpService } from './auto-topup.service';
import { CreditWalletService } from './credit-wallet.service';

@Controller('credits')
@UseGuards(TenantGuard)
export class CreditsController {
  constructor(
    private readonly creditWallet: CreditWalletService,
    private readonly aiPreferences: AiPreferencesService,
    private readonly autoTopUp: AutoTopUpService,
    private readonly aiBudgetPolicy: AIBudgetPolicyService,
  ) {}

  @Get('wallet')
  async getWallet(@CurrentUser() user: RequestUser, @TenantId() tenantId?: string) {
    const result =
      tenantId ?? user.tenantId
        ? await this.creditWallet.getTenantWallet(tenantId ?? user.tenantId!)
        : await this.creditWallet.getConsumerWallet(user.id);
    void this.creditWallet.syncBalanceToFirestore(user.id, result);
    return result;
  }

  @Get('plan-usage')
  async getPlanUsage(@CurrentUser() user: RequestUser, @TenantId() tenantId?: string) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    const result = await this.creditWallet.getPlanUsage(user.id, resolvedTenantId);
    void this.creditWallet.syncBalanceToFirestore(user.id, result);
    return result;
  }

  @Get('ledger')
  getLedger(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.creditWallet.getLedger({
      tenantId: resolvedTenantId,
      userId: resolvedTenantId ? undefined : user.id,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('estimate-task')
  estimateTask(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: EstimateTaskDto,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.creditWallet.estimateTask({
      taskType: dto.taskType,
      userId: resolvedTenantId ? user.id : user.id,
      tenantId: resolvedTenantId,
      userSegment: dto.userSegment,
      modelMode: dto.modelMode,
      premiumModelId: dto.premiumModelId,
    });
  }

  @Patch('ai-preferences')
  updateAiPreferences(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: UpdateAiPreferencesDto,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    if (resolvedTenantId) {
      return this.aiPreferences.updateForTenant(resolvedTenantId, dto);
    }
    return this.aiPreferences.updateForConsumer(user.id, dto);
  }

  @Post('auto-topup/setup-intent')
  createSetupIntent(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.autoTopUp.createSetupIntent({
      userId: user.id,
      tenantId: resolvedTenantId,
      email: user.email,
    });
  }

  @Post('auto-topup/confirm')
  confirmAutoTopUp(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: ConfirmAutoTopUpDto,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.autoTopUp.confirmPaymentMethod({
      userId: user.id,
      tenantId: resolvedTenantId,
      paymentMethodId: dto.paymentMethodId,
    });
  }

  @Delete('auto-topup/payment-method')
  removePaymentMethod(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.autoTopUp.removePaymentMethod({
      userId: user.id,
      tenantId: resolvedTenantId,
    });
  }

  /** GET /credits/ai-budget-policy — fetch current user's AI spend limits */
  @Get('ai-budget-policy')
  async getAiBudgetPolicy(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    const policy = await this.aiBudgetPolicy.getPolicy({
      tenantId: resolvedTenantId,
      userId: resolvedTenantId ? undefined : user.id,
    });
    return {
      monthlyBudgetUsd: policy ? Number(policy.monthlyBudgetUsd ?? 0) : 0,
      alertAtPercent: policy?.alertAtPercent ?? 80,
      // hardStopAtPercent === 0 means soft-limit only (warn but don't block)
      hardStopEnabled: policy ? policy.hardStopAtPercent > 0 : false,
      hardStopAtPercent: policy?.hardStopAtPercent ?? 0,
    };
  }

  /**
   * POST /credits/boost-plan
   * Creates a pro-rated Stripe Checkout to double plan credits for the rest of the cycle.
   */
  @Post('boost-plan')
  boostPlan(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.creditWallet.boostPlan({
      userId: user.id,
      tenantId: resolvedTenantId,
    });
  }

  /** PATCH /credits/ai-budget-policy — update user's AI spend limits */
  @Patch('ai-budget-policy')
  async updateAiBudgetPolicy(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: UpdateAiBudgetPolicyDto,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.aiBudgetPolicy.updateUserPolicy({
      tenantId: resolvedTenantId,
      userId: resolvedTenantId ? undefined : user.id,
      monthlyBudgetUsd: dto.monthlyBudgetUsd,
      alertAtPercent: dto.alertAtPercent,
      hardStopEnabled: dto.hardStopEnabled,
    });
  }
}
