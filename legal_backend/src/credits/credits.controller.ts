import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { AiPreferencesService } from '@/ai-credits/ai-preferences.service';
import { UpdateAiPreferencesDto } from './dto/update-ai-preferences.dto';
import { EstimateTaskDto } from './dto/estimate-task.dto';
import { ConfirmAutoTopUpDto } from './dto/confirm-auto-topup.dto';
import { AutoTopUpService } from './auto-topup.service';
import { CreditWalletService } from './credit-wallet.service';

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditWallet: CreditWalletService,
    private readonly aiPreferences: AiPreferencesService,
    private readonly autoTopUp: AutoTopUpService,
  ) {}

  @Get('wallet')
  getWallet(@CurrentUser() user: RequestUser, @TenantId() tenantId?: string) {
    if (tenantId ?? user.tenantId) {
      return this.creditWallet.getTenantWallet(tenantId ?? user.tenantId!);
    }
    return this.creditWallet.getConsumerWallet(user.id);
  }

  @Get('plan-usage')
  getPlanUsage(@CurrentUser() user: RequestUser, @TenantId() tenantId?: string) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.creditWallet.getPlanUsage(user.id, resolvedTenantId);
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
}
