import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { UpdateTrainingConsentDto } from '@/training-consent/dto/training-consent.dto';
import { TrainingConsentService } from '@/training-consent/training-consent.service';
import { ConsumersService } from './consumers.service';
import { CreateConsumerCaseDto } from './dto/create-case.dto';
import { CreditTopupCheckoutDto } from './dto/credit-topup.dto';
import { IssueCheckerClassifyDto } from './dto/issue-checker-classify.dto';
import { IssueCheckerPreviewDto } from './dto/issue-checker-preview.dto';
import { IssueCheckerTeaserDto } from './dto/issue-checker-teaser.dto';
import { UpdateConsumerCaseDto } from './dto/update-case.dto';

@Controller('consumers')
export class ConsumersController {
  constructor(
    private readonly consumersService: ConsumersService,
    private readonly trainingConsentService: TrainingConsentService,
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('issue-checker/classify')
  classifyIssueChecker(@Body() dto: IssueCheckerClassifyDto) {
    return this.consumersService.classifyIssueChecker(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 86400000 } })
  @Post('issue-checker/teaser')
  teaserIssueChecker(@Body() dto: IssueCheckerTeaserDto) {
    return this.consumersService.teaserIssueChecker(dto);
  }

  @Post('issue-checker/preview')
  previewIssueChecker(
    @CurrentUser() user: RequestUser,
    @Body() dto: IssueCheckerPreviewDto,
  ) {
    return this.consumersService.previewIssueChecker(user, dto);
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
