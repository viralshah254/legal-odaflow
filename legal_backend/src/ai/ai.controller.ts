import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import multer from 'multer';
import { resolveRequestLocale } from '@/config/locales';
import { assertUploadBuffer } from '@/common/file-upload-validation';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { CreditWalletService } from '@/credits/credit-wallet.service';
import { IssueCheckerPreviewDto } from '@/consumers/dto/issue-checker-preview.dto';
import { AzureOcrService } from '@/ocr/azure-ocr.service';
import { PrismaService } from '@/prisma/prisma.service';
import { AiCommandCenterService } from './ai-command-center.service';
import { AiGatewayService } from './ai-gateway.service';
import { ResearchApplicationService } from './legal-research/research-application.service';
import { AiUsageService } from './ai-usage.service';
import { DocumentReviewDto } from './dto/document-review.dto';
import { SaveDocumentReviewDto } from './dto/save-document-review.dto';
import {
  PromoteSavedResearchDto,
  SaveResearchDto,
} from './dto/save-research.dto';
import { ResearchEnrichDto } from './dto/research-enrich.dto';
import { ResearchAuthoritySearchDto } from './dto/research-authority-search.dto';
import { ResearchRefineDto } from './dto/research-refine.dto';
import { EnsureResearchOutputDto } from './dto/ensure-research-output.dto';
import { EstimateAiTaskDto } from './dto/estimate-ai-task.dto';
import { LegalResearchDto } from './dto/legal-research.dto';
import { ManualCitationReviewDecisionDto } from './dto/manual-citation-review.dto';
import { ManualCitationReviewService } from './legal-research/manual-citation-review.service';
import { SavedResearchService } from './legal-research/saved-research.service';
import { ResearchEnrichService } from './legal-research/research-enrich.service';
import { ProactiveCopilotService } from './proactive-copilot.service';
import { OutcomePredictorService } from './ml/outcome-predictor.service';
import { BillingRecoveryService } from './ml/billing-recovery.service';
import { LeadScoringService } from './ml/lead-scoring.service';
import { UsersService } from '@/users/users.service';
import { FirExtractionService } from './fir/fir-extraction.service';
import { LlmCompletionService } from './llm-completion.service';
import { TabularReviewService } from './tabular-review.service';
import { AgentsService } from '@/agents/agents.service';
import { DocumentReviewMiService } from './matter-intelligence/document-review-mi.service';
import { DocumentIngestService } from '@/drafting-session/document-ingest.service';
import { AI_JOB_TYPES } from '@/jobs/jobs.constants';
import { MatterResearchContextService } from './legal-research/matter-research-context.service';
import { LegalLocationService } from '@/legal-location/legal-location.service';
import type { EffectiveLegalLocation } from '@/legal-location/legal-location.types';

@Controller('ai')
@UseGuards(TenantGuard)
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly aiUsage: AiUsageService,
    private readonly commandCenter: AiCommandCenterService,
    private readonly creditWallet: CreditWalletService,
    private readonly proactiveCopilot: ProactiveCopilotService,
    private readonly outcomePredictor: OutcomePredictorService,
    private readonly billingRecovery: BillingRecoveryService,
    private readonly leadScoring: LeadScoringService,
    private readonly usersService: UsersService,
    private readonly azureOcr: AzureOcrService,
    private readonly prisma: PrismaService,
    private readonly firExtraction: FirExtractionService,
    private readonly llmCompletion: LlmCompletionService,
    private readonly tabularReview: TabularReviewService,
    private readonly agentsService: AgentsService,
    private readonly documentReviewMi: DocumentReviewMiService,
    private readonly researchEnrich: ResearchEnrichService,
    private readonly documentIngest: DocumentIngestService,
    private readonly manualCitationReview: ManualCitationReviewService,
    private readonly savedResearch: SavedResearchService,
    private readonly matterResearchContext: MatterResearchContextService,
    private readonly legalLocation: LegalLocationService,
    private readonly researchApplication: ResearchApplicationService,
  ) {}

  private async resolveDtoLocation(
    user: RequestUser,
    tenantId: string | undefined,
    dto: {
      countryCode?: string;
      jurisdiction?: string;
      matterId?: string;
    },
  ): Promise<EffectiveLegalLocation> {
    return this.legalLocation.resolve({
      userId: user.id,
      tenantId: tenantId ?? user.tenantId,
      matterId: dto.matterId,
      requestCountryCode: dto.countryCode,
      requestJurisdiction: dto.jurisdiction,
    });
  }

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
  async preview(
    @CurrentUser() user: RequestUser,
    @Body() dto: IssueCheckerPreviewDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    return this.aiGateway.runConsumerFreePreview({
      userId: user.id,
      consumerCaseId: dto.consumerCaseId ?? 'preview-only',
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      issueType: dto.issueType,
      title: dto.title,
      facts: dto.facts,
      desiredOutcome: dto.desiredOutcome,
      locale: resolveRequestLocale(acceptLanguage, preferredLocale),
    });
  }

  @Post('research')
  async research(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: LegalResearchDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    const location = await this.resolveDtoLocation(user, tenantId, dto);
    try {
      return await this.researchApplication.runLawyerResearch({
        userId: user.id,
        tenantId: tenantId ?? user.tenantId,
        tenantRole: user.tenantRole,
        matterId: dto.matterId,
        selectedDocumentIds: dto.selectedDocumentIds,
        selectedSavedResearchIds: dto.selectedSavedResearchIds,
        contextScope: dto.contextScope,
        selectedFolderIds: dto.selectedFolderIds,
        countryCode: location.countryCode,
        jurisdiction: location.jurisdiction ?? dto.jurisdiction,
        practiceArea: dto.practiceArea,
        query: dto.query,
        aiModelMode: dto.aiModelMode,
        premiumModelId: dto.premiumModelId,
        researchMode: dto.researchMode,
        locale: resolveRequestLocale(acceptLanguage, preferredLocale),
        outputLanguage: dto.outputLanguage,
        priorContext: dto.priorContext,
        knowledgeSources: dto.knowledgeSources,
        asOfDate: dto.asOfDate,
        eventDate: dto.eventDate,
        desiredOutput: dto.desiredOutput,
        requestedTaskKind: dto.requestedTaskKind,
      });
    } catch (err) {
      this.logger.error(
        `[research] failed for user=${user.id} tenant=${tenantId ?? user.tenantId ?? 'none'}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  @Post('research/async')
  async researchAsync(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: LegalResearchDto,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const resolvedTenantId = tenantId ?? user.tenantId;
    if (!resolvedTenantId) {
      throw new BadRequestException('Tenant context is required for async research');
    }

    const preferredLocale = await this.usersService.getPreferredLocale(user.id);
    const locale = resolveRequestLocale(acceptLanguage, preferredLocale);
    const location = await this.resolveDtoLocation(user, tenantId, dto);

    const enqueue = await this.agentsService.enqueueAgentJob({
      agentId: 'research-agent',
      jobType: AI_JOB_TYPES.LEGAL_RESEARCH_MEMO,
      tenantId: resolvedTenantId,
      userId: user.id,
      priority: 'high',
      params: {
        query: dto.query,
        countryCode: location.countryCode,
        jurisdiction: location.jurisdiction ?? dto.jurisdiction,
        matterId: dto.matterId,
        tenantRole: user.tenantRole,
        selectedDocumentIds: dto.selectedDocumentIds,
        selectedSavedResearchIds: dto.selectedSavedResearchIds,
        contextScope: dto.contextScope,
        selectedFolderIds: dto.selectedFolderIds,
        practiceArea: dto.practiceArea,
        aiModelMode: dto.aiModelMode,
        premiumModelId: dto.premiumModelId,
        researchMode: dto.researchMode,
        priorContext: dto.priorContext,
        locale,
        outputLanguage: dto.outputLanguage,
        knowledgeSources: dto.knowledgeSources,
        asOfDate: dto.asOfDate,
        eventDate: dto.eventDate,
        desiredOutput: dto.desiredOutput,
        requestedTaskKind: dto.requestedTaskKind,
        toolName: 'legal_research_memo',
        legalLocationSource: location.source,
        legalLocationAssumed: location.assumed,
      },
    });

    return { jobId: enqueue.agentJobId };
  }

  @Get('research/matter-context')
  async getMatterResearchContext(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Query('matterId') matterId?: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid || !matterId) {
      throw new BadRequestException('Tenant and matter context are required');
    }
    return this.matterResearchContext.getSelectionOptions(
      { tenantId: tid, userId: user.id, tenantRole: user.tenantRole },
      matterId,
    );
  }

  @Get('research/history')
  getResearchHistory(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
  ) {
    return this.aiGateway.getResearchHistory(user.id, tenantId ?? user.tenantId);
  }

  @Get('research/:outputId/citation-reviews')
  getCitationReviews(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('outputId') outputId: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.manualCitationReview.listAndMaterialize({
      outputId,
      tenantId: tid,
      userId: user.id,
      userType: user.userType,
      tenantRole: user.tenantRole,
    });
  }

  @Post('research/:outputId/citation-reviews/:taskId/decision')
  decideCitationReview(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('outputId') outputId: string,
    @Param('taskId') taskId: string,
    @Body() dto: ManualCitationReviewDecisionDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.manualCitationReview.decide({
      outputId,
      taskId,
      tenantId: tid,
      userId: user.id,
      userType: user.userType,
      tenantRole: user.tenantRole,
      dto,
    });
  }

  /** POST /ai/research/saved — persist research to a client (optional matter). */
  @Post('research/saved')
  async saveResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: SaveResearchDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');

    return this.savedResearch.save({
      tenantId: tid,
      userId: user.id,
      tenantRole: user.tenantRole,
    }, dto);
  }

  /** POST /ai/research/saved/:id/promote — explicitly request matter-document promotion. */
  @Post('research/saved/:id/promote')
  async promoteSavedResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
    @Body() dto: PromoteSavedResearchDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.savedResearch.promote({
      tenantId: tid,
      userId: user.id,
      tenantRole: user.tenantRole,
    }, id, dto);
  }

  /** GET /ai/research/saved — list saved research accessible to this user. */
  @Get('research/saved')
  async listSavedResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Query('clientId') clientId?: string,
    @Query('matterId') matterId?: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.savedResearch.list({
      tenantId: tid,
      userId: user.id,
      tenantRole: user.tenantRole,
    }, {
      clientId,
      matterId,
    });
  }

  /** GET /ai/research/saved/:id — get a single saved research with full payload */
  @Get('research/saved/:id')
  async getSavedResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.savedResearch.get({
      tenantId: tid,
      userId: user.id,
      tenantRole: user.tenantRole,
    }, id);
  }

  /** POST /ai/research/ensure-output — persist memo so Enrich can run (cached / missing id). */
  @Post('research/ensure-output')
  async ensureResearchOutput(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: EnsureResearchOutputDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.researchEnrich.ensureOutput({
      userId: user.id,
      tenantId: tid,
      query: dto.query,
      answer: dto.answer,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      aiOutputId: dto.aiOutputId,
    });
  }

  /** POST /ai/research/authorities/search — find evidence-backed authorities for refinement. */
  @Post('research/authorities/search')
  async searchResearchAuthorities(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: ResearchAuthoritySearchDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.researchEnrich.searchAuthorities({
      tenantId: tid,
      userId: user.id,
      query: dto.query,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      limit: dto.limit,
    });
  }

  /** POST /ai/research/:outputId/enrich — add case laws and/or sections; token-based credit debit. */
  @Post('research/:outputId/enrich')
  async enrichResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('outputId') outputId: string,
    @Body() dto: ResearchEnrichDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.researchEnrich.enrich({
      outputId,
      mode: dto.mode,
      tenantId: tid,
      userId: user.id,
      query: dto.query,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
    });
  }

  /** POST /ai/research/:outputId/refine — re-synthesize from a bounded authority set. */
  @Post('research/:outputId/refine')
  async refineResearch(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('outputId') outputId: string,
    @Body() dto: ResearchRefineDto,
  ) {
    const tid = tenantId ?? user.tenantId;
    if (!tid) throw new BadRequestException('Tenant context is required');
    return this.researchEnrich.refine({
      outputId,
      tenantId: tid,
      userId: user.id,
      pinnedAuthorityIds: dto.pinnedAuthorityIds,
      excludedAuthorityIds: dto.excludedAuthorityIds,
      addedAuthorities: dto.addedAuthorities,
      addedContext: dto.addedContext,
      query: dto.query,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      requestedTaskKind: dto.requestedTaskKind,
      desiredOutput: dto.desiredOutput,
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

  @Get('proactive/brief')
  getProactiveBrief(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
  ) {
    return this.proactiveCopilot.getMorningBrief(tenantId, user.id);
  }

  /** GET /ai/review-queue — AI outputs flagged for lawyer review */
  @Get('review-queue')
  listAiReviewQueue(
    @TenantId() tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.proactiveCopilot.listPendingReview(
      tenantId,
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  /** GET /ai/review-queue/:outputId */
  @Get('review-queue/:outputId')
  getAiReviewItem(
    @TenantId() tenantId: string,
    @Param('outputId') outputId: string,
  ) {
    return this.proactiveCopilot.getPendingReviewItem(tenantId, outputId);
  }

  /** POST /ai/review-queue/:outputId/approve */
  @Post('review-queue/:outputId/approve')
  approveAiOutput(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string,
    @Param('outputId') outputId: string,
  ) {
    return this.proactiveCopilot.approveOutput(tenantId, user.id, outputId);
  }

  /** GET /ai/ml/outcome/:matterId */
  @Get('ml/outcome/:matterId')
  predictOutcome(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.outcomePredictor.predictOutcome({ matterId, tenantId });
  }

  /** GET /ai/ml/win-rates */
  @Get('ml/win-rates')
  getFirmWinRates(@TenantId() tenantId: string) {
    return this.outcomePredictor.getFirmWinRates(tenantId);
  }

  /** GET /ai/ml/billing-recovery */
  @Get('ml/billing-recovery')
  getBillingRecovery(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('daysBack') daysBack?: string,
  ) {
    return this.billingRecovery.analyzeBillingRecovery({
      tenantId,
      matterId,
      daysBack: daysBack ? Number(daysBack) : undefined,
    });
  }

  /** GET /ai/ml/lead-scores */
  @Get('ml/lead-scores')
  scoreLeads(@TenantId() tenantId: string) {
    return this.leadScoring.scoreLeads({ tenantId });
  }

  /** GET /ai/ml/lead-scores/:leadId */
  @Get('ml/lead-scores/:leadId')
  scoreOneLead(
    @TenantId() tenantId: string,
    @Param('leadId') leadId: string,
  ) {
    return this.leadScoring.scoreLead({ leadId, tenantId });
  }

  // ─── Saved Document Reviews ──────────────────────────────────────────────────

  /** POST /ai/document-review/saved — persist a completed review result */
  @Post('document-review/saved')
  async saveDocumentReview(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: SaveDocumentReviewDto,
  ) {
    const tid = tenantId ?? user.tenantId;

    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, tenantId: tid },
        select: { id: true },
      });
      if (!client) throw new BadRequestException('Client not found');
    }

    if (dto.matterId) {
      const matter = await this.prisma.matter.findFirst({
        where: { id: dto.matterId, tenantId: tid },
        select: { id: true },
      });
      if (!matter) throw new BadRequestException('Matter not found');
    }

    const saved = await this.prisma.savedDocumentReview.create({
      data: {
        tenantId: tid as string,
        clientId: dto.clientId ?? null,
        matterId: dto.matterId ?? null,
        fileName: dto.fileName,
        documentType: dto.documentType ?? null,
        reviewJson: dto.reviewJson as import('@prisma/client').Prisma.InputJsonValue,
        extractedText: dto.extractedText ?? null,
      },
      select: {
        id: true,
        fileName: true,
        documentType: true,
        clientId: true,
        matterId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        matter: { select: { id: true, title: true } },
      },
    });

    return saved;
  }

  /** GET /ai/document-review/saved — list saved reviews for this tenant */
  @Get('document-review/saved')
  async listSavedDocumentReviews(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Query('clientId') clientId?: string,
    @Query('matterId') matterId?: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    return this.prisma.savedDocumentReview.findMany({
      where: {
        tenantId: tid,
        ...(clientId ? { clientId } : {}),
        ...(matterId ? { matterId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fileName: true,
        documentType: true,
        clientId: true,
        matterId: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        matter: { select: { id: true, title: true } },
      },
    });
  }

  /** GET /ai/document-review/saved/:id — get a single saved review with full result */
  @Get('document-review/saved/:id')
  async getSavedDocumentReview(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Param('id') id: string,
  ) {
    const tid = tenantId ?? user.tenantId;
    const saved = await this.prisma.savedDocumentReview.findFirst({
      where: { id, tenantId: tid },
      include: {
        client: { select: { id: true, name: true } },
        matter: { select: { id: true, title: true } },
      },
    });
    if (!saved) throw new BadRequestException('Saved review not found');
    return saved;
  }

  /** POST /ai/document-review — review via text body or existing documentId */
  @Post('document-review')
  async documentReview(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() dto: DocumentReviewDto,
  ) {
    let extractedText = dto.extractedText ?? '';

    if (!extractedText && dto.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: dto.documentId, tenantId: tenantId ?? user.tenantId },
        select: { id: true, extractedText: true, fileUrl: true },
      });
      if (!doc) throw new BadRequestException('Document not found');
      extractedText = (doc.extractedText as string | null) ?? '';
      if (!extractedText && doc.fileUrl) {
        extractedText = await this.azureOcr.extractTextFromUrl(doc.fileUrl as string);
      }
    }

    if (!extractedText.trim()) {
      throw new BadRequestException('No text content available in the document');
    }

    const miContext = await this.documentReviewMi.buildReviewContext(
      extractedText,
      dto.countryCode,
      dto.jurisdiction,
    );

    return this.aiGateway.runDocumentReview({
      userId: user.id,
      tenantId: tenantId ?? user.tenantId,
      matterId: dto.matterId,
      extractedText,
      fileName: dto.fileName,
      documentType: dto.documentType,
      countryCode: dto.countryCode,
      jurisdiction: dto.jurisdiction,
      aiModelMode: dto.aiModelMode,
      premiumModelId: dto.premiumModelId,
      practiceChecklistBlock: miContext?.practiceChecklistBlock,
      matterProfileSummary: miContext
        ? `${miContext.matterProfile.practiceArea} / ${miContext.matterProfile.subPracticeArea ?? 'general'} (${miContext.matterProfile.nature})`
        : undefined,
    });
  }

  /** POST /ai/document-review/extract — text extraction only (no AI review, no credits) */
  @Post('document-review/extract')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async documentReviewExtract(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ extractedText: string; fileName: string; mimeType: string }> {
    try {
      if (!file) throw new BadRequestException('No file uploaded');

      assertUploadBuffer(file.buffer, file.originalname, 'document');

      const mime = file.mimetype ?? '';
      const result = await this.documentIngest.ingestBuffer(
        file.buffer,
        mime,
        file.originalname,
      );

      return {
        extractedText: result.plainText,
        fileName: file.originalname,
        mimeType: result.mimeType,
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Document text extraction failed',
      );
    }
  }

  /** POST /ai/document-review/upload — review via raw file upload (multipart) */
  @Post('document-review/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async documentReviewUpload(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      documentType?: string;
      countryCode?: string;
      jurisdiction?: string;
      matterId?: string;
      aiModelMode?: string;
      premiumModelId?: string;
    },
  ) {
    try {
      if (!file) throw new BadRequestException('No file uploaded');

      const mime = file.mimetype ?? '';
      const ext = (file.originalname ?? '').toLowerCase();

      const isPdf = mime === 'application/pdf' || ext.endsWith('.pdf');
      const isDocx =
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mime === 'application/msword' ||
        ext.endsWith('.docx') ||
        ext.endsWith('.doc');
      const isText =
        mime === 'text/plain' ||
        ext.endsWith('.txt') ||
        ext.endsWith('.md');

      let extractedText: string;

      if (isText) {
        extractedText = file.buffer.toString('utf8');
      } else if (isPdf) {
        // Try pdf-parse first (works for text-layer PDFs)
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(file.buffer);
          extractedText = pdfData.text ?? '';
        } catch {
          extractedText = '';
        }
        // If pdf-parse returned empty (scanned/image PDF) or threw, fall back to Azure OCR
        if (!extractedText.trim()) {
          try {
            extractedText = await this.azureOcr.extractTextFromBuffer(file.buffer, 'application/pdf');
          } catch (ocrErr) {
            this.logger.error(`Azure OCR failed: ${ocrErr instanceof Error ? ocrErr.message : String(ocrErr)}`);
            extractedText = '';
          }
        }
      } else if (isDocx) {
        // Use mammoth for proper DOCX → plain text extraction
        try {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          extractedText = result.value ?? '';
        } catch {
          // Fallback: strip XML tags from raw content (DOCX is a ZIP/XML)
          const rawUtf8 = file.buffer.toString('utf8');
          extractedText = rawUtf8
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s{3,}/g, '\n')
            .trim();
        }
      } else {
        // Images: try Azure OCR with the actual mime type
        if (mime.startsWith('image/')) {
          try {
            extractedText = await this.azureOcr.extractTextFromBuffer(file.buffer, mime);
          } catch {
            extractedText = '';
          }
        } else {
          // Unknown binary: best-effort ASCII extraction
          extractedText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
        }
      }

      if (!extractedText.trim()) {
        throw new BadRequestException(
          'Could not extract text from the uploaded file. This is likely a scanned or image-based PDF with no text layer. Please use the "Paste Text" tab to paste the document content directly, or upload a text-based PDF or DOCX file.',
        );
      }

      return this.aiGateway.runDocumentReview({
        userId: user.id,
        tenantId: tenantId ?? user.tenantId,
        matterId: body.matterId,
        extractedText,
        fileName: file.originalname,
        documentType: body.documentType as DocumentReviewDto['documentType'],
        countryCode: body.countryCode,
        jurisdiction: body.jurisdiction,
        aiModelMode: body.aiModelMode as 'AUTO' | 'PREMIUM' | undefined,
        premiumModelId: body.premiumModelId,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Document review failed'
      );
    }
  }

  /**
   * POST /ai/document-review/tabular
   * Compare two documents clause-by-clause in a structured table.
   */
  @Post('document-review/tabular')
  async tabularDocumentReview(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Body() body: {
      docAText?: string;
      docBText?: string;
      docAName?: string;
      docBName?: string;
      documentType?: string;
      countryCode?: string;
      aiModelMode?: string;
      premiumModelId?: string;
    },
  ) {
    try {
      if (!body.docAText || !body.docBText) {
        throw new BadRequestException(
          'Both docAText and docBText are required for tabular comparison.',
        );
      }
      return await this.tabularReview.compareDocuments({
        docAText: body.docAText,
        docBText: body.docBText,
        docAName: body.docAName,
        docBName: body.docBName,
        documentType: body.documentType,
        countryCode: body.countryCode,
        aiModelMode: body.aiModelMode as 'AUTO' | 'PREMIUM' | undefined,
        premiumModelId: body.premiumModelId,
      });
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'Tabular document comparison failed',
      );
    }
  }

  /**
   * POST /ai/fir/extract
   * India-only: extract structured facts and next legal steps from FIR text.
   */
  @Post('fir/extract')
  async firExtract(
    @CurrentUser() user: RequestUser,
    @Body() body: { extractedText: string; countryCode?: string },
  ) {
    const countryCode = body.countryCode ?? 'IN';
    return this.firExtraction.extractFromText(
      body.extractedText ?? '',
      countryCode,
    );
  }

  /**
   * POST /ai/fir/upload
   * India-only: upload FIR file (PDF/image/DOCX), OCR it, then extract structured facts.
   */
  @Post('fir/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async firUpload(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { countryCode?: string },
  ) {
    try {
      if (!file) throw new BadRequestException('No file uploaded');

      assertUploadBuffer(file.buffer, file.originalname, 'firDocument');

      const mime = file.mimetype ?? '';
      const ext = (file.originalname ?? '').toLowerCase();
      const isPdf = mime === 'application/pdf' || ext.endsWith('.pdf');
      const isDocx =
        mime.includes('wordprocessingml') || mime === 'application/msword' ||
        ext.endsWith('.docx') || ext.endsWith('.doc');
      const isText = mime === 'text/plain' || ext.endsWith('.txt');

      let extractedText: string;

      if (isText) {
        extractedText = file.buffer.toString('utf8');
      } else if (isPdf) {
        try {
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(file.buffer);
          extractedText = pdfData.text ?? '';
        } catch {
          extractedText = '';
        }
        // Scanned PDFs return empty from pdf-parse — fall back to Azure OCR
        if (!extractedText.trim()) {
          extractedText = await this.azureOcr.extractTextFromBuffer(file.buffer, 'application/pdf').catch(() => '');
        }
      } else if (isDocx) {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value ?? '';
      } else if (mime.startsWith('image/')) {
        extractedText = await this.azureOcr.extractTextFromBuffer(file.buffer, mime).catch(() => '');
      } else {
        extractedText = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      }

      if (!extractedText.trim()) {
        throw new BadRequestException(
          'Could not extract text from the uploaded file. This is likely a scanned or image-based PDF. Please paste the FIR text directly into the text field instead.',
        );
      }

      const countryCode = body.countryCode ?? 'IN';
      return this.firExtraction.extractFromText(extractedText, countryCode);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new InternalServerErrorException(
        err instanceof Error ? err.message : 'FIR extraction failed',
      );
    }
  }

  /**
   * POST /ai/citation-challenge
   * Accepts a citation (title, source) and a lawyer's challenge question.
   * Returns verdict (confirmed / questioned / overruled), confidence, explanation, and supporting authorities.
   */
  @Post('citation-challenge')
  async citationChallenge(
    @Body() body: {
      citationTitle: string;
      citationSource: string;
      claim?: string;
      challenge: string;
    },
    @CurrentUser() _user: RequestUser,
    @TenantId() tenantId?: string,
  ) {
    if (!body.citationTitle?.trim() || !body.challenge?.trim()) {
      throw new BadRequestException('citationTitle and challenge are required.');
    }

    const systemPrompt = `You are a senior legal verification specialist with expertise in citation analysis.
A lawyer is challenging a legal citation. Analyze it and respond in strict JSON:
{
  "verdict": "confirmed" | "questioned" | "overruled",
  "confidence": 0.0–1.0,
  "explanation": "2-4 sentence explanation",
  "supportingAuthorities": ["up to 3 concise authority references"]
}`;

    const userPrompt = `Citation: ${body.citationTitle} (${body.citationSource})
${body.claim ? `Claim supported: ${body.claim}` : ''}
Lawyer's challenge: ${body.challenge}

Respond with JSON only.`;

    try {
      const result = await this.llmCompletion.complete({
        modelName: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 800,
        temperature: 0.1,
      });

      const text = result.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      return JSON.parse(jsonMatch[0]) as {
        verdict: string;
        confidence: number;
        explanation: string;
        supportingAuthorities: string[];
      };
    } catch {
      return {
        verdict: 'questioned',
        confidence: 0.5,
        explanation: 'Unable to verify this citation automatically. Please consult official databases.',
        supportingAuthorities: [],
      };
    }
  }

  /**
   * POST /ai/inline-edit
   * Accepts a selected text snippet + natural-language instruction and returns
   * a proposed replacement. Designed for the highlight → Ask Umbrella bubble.
   * Accepts optional anchor fields (documentId, workspaceId, startOffset, endOffset, matterId)
   * for workspace-aware, anchor-stable edits.
   */
  @Post('inline-edit')
  async inlineEdit(
    @Body()
    body: {
      selectedText: string;
      instruction: string;
      // Anchor fields (optional — sent from smart workspace toolbar)
      documentId?: string;
      workspaceId?: string;
      startOffset?: number;
      endOffset?: number;
      matterId?: string;
    },
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId?: string,
  ) {
    if (!body.selectedText?.trim() || !body.instruction?.trim()) {
      throw new BadRequestException('selectedText and instruction are required.');
    }
    if (body.selectedText.length > 8000) {
      throw new BadRequestException('Selection too large — max 8000 characters.');
    }

    const systemPrompt = `You are an expert legal document editor.
The user has selected text from a legal document and given an instruction to improve it.
Reply with ONLY the revised text — no explanation, no preamble, no markdown fences.
Preserve meaning, jurisdiction compliance, and legal precision unless the instruction says otherwise.`;

    const userPrompt = `Instruction: ${body.instruction}

Selected text:
"""
${body.selectedText}
"""

Revised text:`;

    try {
      const result = await this.llmCompletion.complete({
        modelName: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 1500,
        temperature: 0.2,
      });
      return {
        proposed: result.content.trim(),
        // Echo anchor fields back so client can apply offset-aware patch
        anchor: body.startOffset !== undefined
          ? {
              documentId: body.documentId,
              workspaceId: body.workspaceId,
              startOffset: body.startOffset,
              endOffset: body.endOffset,
              matterId: body.matterId,
            }
          : undefined,
      };
    } catch {
      throw new InternalServerErrorException('Inline edit failed. Please try again.');
    }
  }

  /**
   * POST /ai/voice/transcribe
   * Accepts an audio file (webm/mp3/wav/m4a) and returns a plain-text transcript.
   * Uses the LLM service's audio transcription capability (Whisper via OpenAI or Azure OpenAI).
   * Falls back gracefully when unavailable, so clients can show a "not supported" message.
   */
  @Post('voice/transcribe')
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB – Whisper limit
      fileFilter: (_req, file, cb) => {
        const allowed = ['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4', 'audio/ogg'];
        if (allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Unsupported audio type: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async transcribeAudio(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { lang?: string },
  ) {
    if (!file) throw new BadRequestException('No audio file uploaded.');

    try {
      const transcript = await this.llmCompletion.transcribeAudio(file.buffer, {
        lang: body.lang ?? 'en',
        mimeType: file.mimetype,
      });
      return { transcript };
    } catch (err) {
      return {
        transcript: null,
        error: err instanceof Error ? err.message : 'Transcription failed.',
      };
    }
  }
}
