import { Body, Controller, Get, Headers, NotFoundException, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { resolveRequestLocale } from '@/config/locales';
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
import { CreatePublicBookingDto } from './dto/public-booking.dto';
import { MarketplaceService } from './marketplace.service';
import { UsersService } from '@/users/users.service';
import {
  CreateLeadDocumentDto,
  RunLeadAnalysisDto,
  UpdateLeadContextDto,
} from './dto/run-lead-analysis.dto';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly marketplaceService: MarketplaceService,
    private readonly usersService: UsersService,
  ) {}

  @Post('lawyer-profile')
  upsertProfile(@CurrentUser() user: RequestUser, @Body() dto: CreateLawyerProfileDto) {
    return this.marketplaceService.upsertLawyerProfile(user.id, dto);
  }

  @Get('my-profile')
  async getMyProfile(@CurrentUser() user: RequestUser) {
    const profile = await this.marketplaceService.getLawyerProfileByUserId(user.id);
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  @Put('my-profile')
  upsertMyProfile(@CurrentUser() user: RequestUser, @Body() dto: CreateLawyerProfileDto) {
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

  @Public()
  @Get('lawyers/:lawyerSlug')
  getLawyerBySlug(@Param('lawyerSlug') lawyerSlug: string) {
    return this.marketplaceService.getLawyerBySlug(lawyerSlug);
  }

  @Public()
  @Post('booking')
  createPublicBooking(@Body() dto: CreatePublicBookingDto) {
    return this.marketplaceService.createPublicBooking(dto);
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

  @Get('leads/pipeline')
  @UseGuards(TenantGuard)
  listPipeline(
    @TenantId() tenantId: string,
    @Query('intakeStage') intakeStage?: string,
  ) {
    return this.marketplaceService.listLeadsByStage(tenantId, intakeStage);
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
  async runSimilarCases(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() dto: RunLeadAnalysisDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.marketplaceService.runSimilarCases(
      user.id,
      leadId,
      dto,
      resolveRequestLocale(acceptLanguage, preferredLocale),
    );
  }

  @Post('leads/:leadId/analysis/opponent-angles')
  async runOpponentAngles(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() dto: RunLeadAnalysisDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.marketplaceService.runOpponentAngles(
      user.id,
      leadId,
      dto,
      resolveRequestLocale(acceptLanguage, preferredLocale),
    );
  }

  @Post('leads/:leadId/analysis/strategy')
  async runStrategyMemo(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() dto: RunLeadAnalysisDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.marketplaceService.runStrategyMemo(
      user.id,
      leadId,
      dto,
      resolveRequestLocale(acceptLanguage, preferredLocale),
    );
  }

  @Patch('leads/:leadId/context')
  updateLeadContext(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateLeadContextDto,
  ) {
    return this.marketplaceService.updateLeadContext(
      user.id,
      leadId,
      dto.lawyerContextMarkdown,
    );
  }

  @Get('leads/:leadId/documents')
  listLeadDocuments(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
  ) {
    return this.marketplaceService.listLeadDocuments(user.id, leadId);
  }

  @Post('leads/:leadId/documents/upload-url')
  createLeadDocumentUploadUrl(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body('fileName') fileName: string,
  ) {
    return this.marketplaceService.createLeadDocumentUploadUrl(
      user.id,
      leadId,
      fileName,
    );
  }

  @Post('leads/:leadId/documents')
  createLeadDocument(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() dto: CreateLeadDocumentDto,
  ) {
    return this.marketplaceService.createLeadDocument(user.id, leadId, dto);
  }

  @Patch('leads/:leadId/stage')
  updateIntakeStage(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body('intakeStage') intakeStage: string,
  ) {
    return this.marketplaceService.updateIntakeStage(user.id, leadId, intakeStage);
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
  convertLead(
    @CurrentUser() user: RequestUser,
    @Param('leadId') leadId: string,
    @Body() body?: { clientId?: string; overrideConflict?: boolean },
  ) {
    return this.marketplaceService.convertToMatter(user.id, leadId, body?.clientId, {
      overrideConflict: body?.overrideConflict,
    });
  }
}
