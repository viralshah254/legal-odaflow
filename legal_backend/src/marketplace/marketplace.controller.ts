import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CreateLawyerProfileDto,
  CreateLeadDto,
  CreateReviewRequestDto,
} from './dto/create-lawyer-profile.dto';
import { DeliverReviewDto, PayReviewRequestDto } from './dto/deliver-review.dto';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('lawyer-profile')
  upsertProfile(@CurrentUser() user: RequestUser, @Body() dto: CreateLawyerProfileDto) {
    return this.marketplaceService.upsertLawyerProfile(user.id, dto);
  }

  @Public()
  @Get('lawyers')
  listLawyers(
    @Query('countryCode') countryCode?: string,
    @Query('issueType') issueType?: string,
    @Query('minVerificationTier') minVerificationTier?: string,
  ) {
    return this.marketplaceService.listLawyerProfiles(
      countryCode,
      issueType,
      minVerificationTier,
    );
  }

  @Post('review-requests')
  createReviewRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReviewRequestDto,
  ) {
    return this.marketplaceService.createReviewRequest(user.id, dto);
  }

  @Get('review-requests')
  listReviewRequests(@CurrentUser() user: RequestUser) {
    return this.marketplaceService.listReviewRequests(user.id, user.userType);
  }

  @Get('review-requests/:reviewRequestId')
  getReviewRequest(
    @CurrentUser() user: RequestUser,
    @Param('reviewRequestId') reviewRequestId: string,
  ) {
    return this.marketplaceService.getReviewRequest(
      user.id,
      reviewRequestId,
      user.userType,
    );
  }

  @Post('review-requests/:reviewRequestId/pay')
  payForReview(
    @CurrentUser() user: RequestUser,
    @Param('reviewRequestId') reviewRequestId: string,
    @Body() dto: PayReviewRequestDto,
  ) {
    return this.marketplaceService.payForReviewRequest(
      user.id,
      reviewRequestId,
      dto.phone,
    );
  }

  @Post('review-requests/:reviewRequestId/accept')
  acceptReview(
    @CurrentUser() user: RequestUser,
    @Param('reviewRequestId') reviewRequestId: string,
  ) {
    return this.marketplaceService.acceptReviewRequest(user.id, reviewRequestId);
  }

  @Post('review-requests/:reviewRequestId/start')
  startReview(
    @CurrentUser() user: RequestUser,
    @Param('reviewRequestId') reviewRequestId: string,
  ) {
    return this.marketplaceService.startReview(user.id, reviewRequestId);
  }

  @Post('review-requests/:reviewRequestId/deliver')
  deliverReview(
    @CurrentUser() user: RequestUser,
    @Param('reviewRequestId') reviewRequestId: string,
    @Body() dto: DeliverReviewDto,
  ) {
    return this.marketplaceService.deliverReview(user.id, reviewRequestId, dto);
  }

  @Post('leads')
  createLead(@CurrentUser() user: RequestUser, @Body() dto: CreateLeadDto) {
    return this.marketplaceService.createLead(user.id, dto);
  }

  @Get('leads')
  listLeads(@CurrentUser() user: RequestUser) {
    return this.marketplaceService.listLeads(user.id, user.userType);
  }

  @Get('leads/:leadId')
  getLead(@CurrentUser() user: RequestUser, @Param('leadId') leadId: string) {
    return this.marketplaceService.getLead(user.id, user.userType, leadId);
  }

  @Get('leads/:leadId/analysis/runs')
  listAnalysisRuns(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
  ) {
    return this.marketplaceService.getAnalysisRuns(user.id, leadId);
  }

  @Post('leads/:leadId/analysis/similar-cases')
  runSimilarCases(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
  ) {
    return this.marketplaceService.runSimilarCases(user.id, leadId);
  }

  @Post('leads/:leadId/analysis/opponent-angles')
  runOpponentAngles(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
  ) {
    return this.marketplaceService.runOpponentAngles(user.id, leadId);
  }

  @Post('leads/:leadId/analysis/strategy')
  runStrategyMemo(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
  ) {
    return this.marketplaceService.runStrategyMemo(user.id, leadId);
  }

  @Patch('leads/:leadId/stage')
  updateIntakeStage(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body('intakeStage') intakeStage: string,
  ) {
    return this.marketplaceService.updateIntakeStage(user.id, leadId, intakeStage);
  }

  @Get('leads/pipeline')
  @UseGuards(TenantGuard)
  listPipeline(
    @TenantId() tenantId: string,
    @Query('intakeStage') intakeStage?: string,
  ) {
    return this.marketplaceService.listLeadsByStage(tenantId, intakeStage);
  }

  @Post('leads/:leadId/accept')
  acceptLead(@CurrentUser() user: RequestUser, @Param('leadId') leadId: string) {
    return this.marketplaceService.acceptLead(user.id, leadId);
  }

  @Post('leads/:leadId/reject')
  rejectLead(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body('reason') reason?: string,
  ) {
    return this.marketplaceService.rejectLead(user.id, leadId, reason);
  }

  @Post('leads/:leadId/convert')
  convertLead(@CurrentUser() user: RequestUser, @Param('leadId') leadId: string) {
    return this.marketplaceService.convertToMatter(user.id, leadId);
  }
}
