import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { IssueCheckerPreviewDto } from '@/consumers/dto/issue-checker-preview.dto';
import { AiCommandCenterService } from './ai-command-center.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiUsageService } from './ai-usage.service';
import { EstimateAiTaskDto } from './dto/estimate-ai-task.dto';
import { LegalResearchDto } from './dto/legal-research.dto';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly aiUsage: AiUsageService,
    private readonly commandCenter: AiCommandCenterService,
    private readonly creditWallet: CreditWalletService,
  ) {}

  @Get('usage')
  getUsage(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.aiUsage.getUsageSummary({
      tenantId: tenantId ?? user.tenantId,
      userId: user.userType === 'CONSUMER' ? user.id : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('preview')
  preview(
    @CurrentUser() user: RequestUser,
    @Body() dto: IssueCheckerPreviewDto,
  ) {
    return this.aiGateway.runConsumerFreePreview({
      userId: user.id,
      consumerCaseId: dto.consumerCaseId ?? 'preview-only',
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      issueType: dto.issueType,
      title: dto.title,
      facts: dto.facts,
      desiredOutcome: dto.desiredOutcome,
    });
  }

  @Post('research')
  research(@CurrentUser() user: RequestUser, @Body() dto: LegalResearchDto) {
    return this.aiGateway.runLawyerLegalResearch({
      userId: user.id,
      tenantId: user.tenantId,
      matterId: dto.matterId,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      practiceArea: dto.practiceArea,
      query: dto.query,
    });
  }

  @Post('estimate')
  estimate(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: EstimateAiTaskDto,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    return this.creditWallet.estimateTask({
      taskType: dto.taskType,
      userId: resolvedTenantId ? undefined : user.id,
      tenantId: resolvedTenantId,
      userSegment: dto.userSegment,
    });
  }

  @Get('command-center/summary')
  getCommandCenterSummary(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    if (!resolvedTenantId) {
      return {
        newConsumerLeads: 0,
        aiDraftsAwaitingReview: 0,
        highRiskMatters: 0,
        documentsNeedingClassification: 0,
        missedUrgentDeadlines: 0,
        suggestedTimeEntries: 0,
        researchMemosGenerated: 0,
        opponentFilingsNeedingResponse: 0,
        aiCostThisMonthUsd: 0,
        aiCreditsUsed: 0,
        aiCreditsIncluded: 0,
        providerHealth: { status: 'unknown', provider: 'openai' },
      };
    }
    return this.commandCenter.getSummary(resolvedTenantId);
  }
}
