import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { resolveRequestLocale } from '@/config/locales';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { SiteAnalyticsService } from '@/site-analytics/site-analytics.service';
import { UpdateTrainingConsentDto } from '@/training-consent/dto/training-consent.dto';
import { TrainingConsentService } from '@/training-consent/training-consent.service';
import { UsersService } from '@/users/users.service';
import { ConsumersService } from './consumers.service';
import { CreateConsumerCaseDto } from './dto/create-case.dto';
import { CreditTopupCheckoutDto } from './dto/credit-topup.dto';
import { IssueCheckerClassifyDto } from './dto/issue-checker-classify.dto';
import { IssueCheckerPlanQuestionsDto } from './dto/issue-checker-plan-questions.dto';
import { IssueCheckerOutcomeOptionsDto } from './dto/issue-checker-outcome-options.dto';
import { IssueCheckerPreviewDto } from './dto/issue-checker-preview.dto';
import { IssueCheckerTeaserDto } from './dto/issue-checker-teaser.dto';
import { LegalResearchTeaserDto } from './dto/legal-research-teaser.dto';
import { UpdateConsumerCaseDto } from './dto/update-case.dto';
import { IssueCheckerAbuseGuard } from './issue-checker-abuse.guard';

@Controller('consumers')
export class ConsumersController {
  constructor(
    private readonly consumersService: ConsumersService,
    private readonly trainingConsentService: TrainingConsentService,
    private readonly usersService: UsersService,
    private readonly siteAnalyticsService: SiteAnalyticsService,
  ) {}

  @Post('cases')
  createCase(@CurrentUser() user: RequestUser, @Body() dto: CreateConsumerCaseDto) {
    return this.consumersService.createCase(user.id, dto);
  }

  @Get('cases')
  listCases(@CurrentUser() user: RequestUser) {
    return this.consumersService.listCases(user.id);
  }

  @Get('cases/:caseId')
  getCase(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.consumersService.getCase(user.id, caseId);
  }

  @Patch('cases/:caseId')
  updateCase(
    @CurrentUser() user: RequestUser,
    @Param('caseId') caseId: string,
    @Body() dto: UpdateConsumerCaseDto,
  ) {
    return this.consumersService.updateCase(user.id, caseId, dto);
  }

  @Delete('cases/:caseId')
  deleteCase(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.consumersService.deleteCase(user.id, caseId);
  }

  @Get('cases/:caseId/drafts')
  listCaseDrafts(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.consumersService.listCaseDrafts(user.id, caseId);
  }

  @Get('cases/:caseId/messages')
  listCaseMessages(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.consumersService.listCaseMessages(user.id, caseId);
  }

  @Get('cases/:caseId/payments')
  listCasePayments(@CurrentUser() user: RequestUser, @Param('caseId') caseId: string) {
    return this.consumersService.listCasePayments(user.id, caseId);
  }

  @Public()
  @UseGuards(IssueCheckerAbuseGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('issue-checker/classify')
  classifyIssueChecker(
    @Body() dto: IssueCheckerClassifyDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.consumersService.classifyIssueChecker(
      dto,
      resolveRequestLocale(acceptLanguage),
    );
  }

  @Public()
  @UseGuards(IssueCheckerAbuseGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('issue-checker/plan-questions')
  getPlanQuestions(
    @Body() dto: IssueCheckerPlanQuestionsDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.consumersService.getPlanQuestions(
      dto,
      resolveRequestLocale(acceptLanguage),
    );
  }

  @Public()
  @UseGuards(IssueCheckerAbuseGuard)
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('issue-checker/outcome-options')
  getOutcomeOptions(
    @Body() dto: IssueCheckerOutcomeOptionsDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.consumersService.getOutcomeOptions(
      dto,
      resolveRequestLocale(acceptLanguage),
    );
  }

  @Public()
  @UseGuards(IssueCheckerAbuseGuard)
  @Throttle({ default: { limit: 2, ttl: 86400000 } })
  @Post('issue-checker/teaser')
  async teaserIssueChecker(
    @Body() dto: IssueCheckerTeaserDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const result = await this.consumersService.teaserIssueChecker(
      dto,
      resolveRequestLocale(acceptLanguage),
    );
    this.siteAnalyticsService.logSearchQuery({
      facts: dto.facts,
      issueType: dto.issueType,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      mode: dto.mode,
    });
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 86400000 } })
  @Post('legal-research/teaser')
  teaserLegalResearch(
    @Body() dto: LegalResearchTeaserDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.consumersService.teaserLegalResearch(
      dto,
      resolveRequestLocale(acceptLanguage, dto.locale),
    );
  }

  @Post('issue-checker/preview')
  async previewIssueChecker(
    @CurrentUser() user: RequestUser,
    @Body() dto: IssueCheckerPreviewDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    const result = await this.consumersService.previewIssueChecker(
      user,
      dto,
      resolveRequestLocale(acceptLanguage, preferredLocale),
    );
    if (dto.facts) {
      this.siteAnalyticsService.logSearchQuery({
        facts: dto.facts,
        issueType: dto.issueType,
        countryCode: dto.countryCode,
        jurisdiction: dto.jurisdiction,
        mode: dto.mode,
        userId: user.id,
      });
    }
    return result;
  }

  @Get('me/credits')
  getCredits(@CurrentUser() user: RequestUser) {
    return this.consumersService.getCredits(user.id);
  }

  @Post('credits/topup/checkout')
  createCreditTopupCheckout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreditTopupCheckoutDto,
  ) {
    return this.consumersService.createCreditTopupCheckout(user.id, dto);
  }

  /** Alias for mobile clients: GET /consumers/training-consent */
  @Get('training-consent')
  getTrainingConsent(@CurrentUser() user: RequestUser) {
    return this.trainingConsentService.getOrCreateForUser(user.id, null);
  }

  @Patch('training-consent')
  updateTrainingConsent(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateTrainingConsentDto,
  ) {
    return this.trainingConsentService.updateCurrentForUser(user.id, null, dto);
  }
}
