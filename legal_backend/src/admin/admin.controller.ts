import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { AdminService } from './admin.service';
import { AdminAiObservabilityService } from './admin-ai-observability.service';
import { AdminUserActivityService } from './admin-user-activity.service';
import type { ActivityCategory } from './admin-user-activity.util';
import { ModelCostSyncService } from '@/ai/costs/model-cost-sync.service';
import { ProviderBillingReconciliationService } from '@/cost-monitoring/provider-billing-reconciliation.service';
import { LawyerProspectsService } from './lawyer-prospects.service';
import { CreateLawyerProspectDto } from './dto/create-lawyer-prospect.dto';
import { GooglePlacesProspectService } from './google-places-prospect.service';
import { DemoRequestsService } from './demo-requests.service';
import { UnmatchedSectionsService } from './unmatched-sections.service';
import { SuperAdminGuard } from './super-admin.guard';
import { NotificationsService } from '@/notifications/notifications.service';
import { ResearchCorrectionService } from '@/ai/legal-research/research-correction.service';
import { WhatsappOutreachService, CreateCampaignDto } from './whatsapp-outreach.service';
import { PlatformAccountingService } from './platform-accounting.service';
import { CreatePlatformExpenseDto, UpdatePlatformExpenseDto } from './dto/platform-expense.dto';
import { AdminTodosService } from './admin-todos.service';
import { AiModelEnvAuditService } from '@/ai/ai-model-env-audit.service';
import { ResearchRetrievalGapService } from '@/legal-sources/research-retrieval-gap.service';

@Controller('admin')
@UseGuards(SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly aiObservability: AdminAiObservabilityService,
    private readonly userActivity: AdminUserActivityService,
    private readonly modelCostSync: ModelCostSyncService,
    private readonly providerBilling: ProviderBillingReconciliationService,
    private readonly lawyerProspectsService: LawyerProspectsService,
    private readonly googlePlacesProspectService: GooglePlacesProspectService,
    private readonly demoRequestsService: DemoRequestsService,
    private readonly notificationsService: NotificationsService,
    private readonly researchCorrection: ResearchCorrectionService,
    private readonly unmatchedSectionsService: UnmatchedSectionsService,
    private readonly whatsappOutreach: WhatsappOutreachService,
    private readonly platformAccounting: PlatformAccountingService,
    private readonly adminTodos: AdminTodosService,
    private readonly aiModelEnvAudit: AiModelEnvAuditService,
    private readonly retrievalGaps: ResearchRetrievalGapService,
  ) {}

  // ── Admin identity & todos ──────────────────────────────────────────────

  @Get('me')
  getAdminMe(@CurrentUser() user: RequestUser) {
    return this.adminTodos.getAdminMe(user.id);
  }

  @Get('super-admins')
  listSuperAdmins() {
    return this.adminTodos.listSuperAdmins();
  }

  @Get('me/todos')
  getDailyTodos(
    @CurrentUser() user: RequestUser,
    @Query('date') date?: string,
  ) {
    return this.adminTodos.getDailyTodos(user.id, date);
  }

  @Patch('me/todos/:id')
  toggleTodo(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { completed: boolean },
  ) {
    return this.adminTodos.toggleTodo(user.id, id, body.completed);
  }

  @Post('me/todos')
  createAdHocTodo(
    @CurrentUser() user: RequestUser,
    @Body() body: { title: string; description?: string; category?: string },
  ) {
    return this.adminTodos.createAdHocTodo(user.id, body);
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('user-activity')
  listUserActivity(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const allowed: ActivityCategory[] = [
      'research',
      'drafting',
      'copilot',
      'search',
      'other',
    ];
    const cat = category && allowed.includes(category as ActivityCategory)
      ? (category as ActivityCategory)
      : undefined;
    return this.userActivity.listActivity({
      from,
      to,
      userId,
      tenantId,
      category: cat,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('user-activity/:activityId')
  getUserActivityDetail(@Param('activityId') activityId: string) {
    return this.userActivity.getActivityDetail(activityId);
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.adminService.listSubscriptions();
  }

  @Patch('users/:userId/active')
  setUserActive(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.adminService.setUserActive(userId, body.isActive, admin.id);
  }

  @Post('users/:userId/master-delete')
  masterDeleteUser(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body() body: { confirmEmail: string },
  ) {
    return this.adminService.masterDeleteUser(userId, body.confirmEmail, admin.id);
  }

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('marketplace-lawyers')
  listMarketplaceLawyers(
    @Query('verified') verified?: string,
    @Query('countryCode') countryCode?: string,
    @Query('q') q?: string,
  ) {
    return this.adminService.listMarketplaceLawyerProfiles({
      verified:
        verified === 'true' ? true : verified === 'false' ? false : undefined,
      countryCode,
      q,
    });
  }

  @Patch('marketplace-lawyers/:profileId/verification')
  updateMarketplaceLawyerVerification(
    @Param('profileId') profileId: string,
    @Body() body: { verified: boolean; verificationStatus?: string; acceptsLeads?: boolean },
  ) {
    return this.adminService.updateMarketplaceLawyerVerification(profileId, body);
  }

  // ── Push notifications ──────────────────────────────────────────────────

  /**
   * POST /admin/notifications/broadcast
   * Sends a push notification to every user with a registered device token.
   * Body: { title: string; body: string; data?: Record<string, string> }
   */
  @Post('notifications/broadcast')
  broadcastNotification(
    @CurrentUser() admin: RequestUser,
    @Body() dto: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!dto.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    return this.notificationsService.broadcastPush(
      dto.title.trim(),
      dto.body?.trim() ?? '',
      dto.data,
    );
  }

  // ── AI ──────────────────────────────────────────────────────────────────

  @Get('ai/costs')
  listAiCosts(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('taskType') taskType?: string,
    @Query('modelName') modelName?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiObservability.listAiUsageLogs({
      from,
      to,
      tenantId,
      userId,
      taskType,
      modelName,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('ai/usage')
  getAiUsage() {
    return this.adminService.getUnitEconomicsSummary();
  }

  @Get('ai/logs')
  listAiLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('taskType') taskType?: string,
    @Query('modelName') modelName?: string,
    @Query('modelProvider') modelProvider?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiObservability.listAiUsageLogs({
      from,
      to,
      tenantId,
      userId,
      taskType,
      modelName,
      modelProvider,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** Research/drafting quality per jurisdiction, from per-run telemetry. */
  @Get('ai/run-quality')
  getRunQualityByCountry(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
    @Query('flow') flow?: 'research' | 'drafting',
  ) {
    return this.aiObservability.getRunQualityByCountry({ from, to, tenantId, flow });
  }

  @Get('ai/usage/anthropic')
  getAnthropicUsageByTaskType(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.aiObservability.getAnthropicUsageByTaskType({ from, to, tenantId });
  }

  @Get('ai/models/env-audit')
  getAiModelEnvAudit() {
    return this.aiModelEnvAudit.buildAudit();
  }

  @Get('ai/models/tenant-deep-analysis')
  getTenantDeepAnalysisModels() {
    return this.aiObservability.getTenantDeepAnalysisModelAudit();
  }

  @Get('ai/credit-ledger')
  listCreditLedger(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('taskType') taskType?: string,
    @Query('modelName') modelName?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiObservability.listCreditLedger({
      from,
      to,
      tenantId,
      userId,
      taskType,
      modelName,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('ai/costs/summary-v2')
  getCostsSummaryV2(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.aiObservability.getCostsSummaryV2({ from, to });
  }

  @Get('ai/costs/by-model')
  getCostsByModel(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.aiObservability.getCostsByModel({ from, to });
  }

  @Post('ai/backfill-from-ledger')
  backfillFromLedger(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aiObservability.backfillUsageFromLedger({
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('ai/fix-zero-cost-logs')
  fixZeroCostLogs(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aiObservability.fixZeroCostUsageLogs({
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('ai/profitability')
  getAiProfitability(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy') groupBy?: 'taskType' | 'modelName' | 'tenantId',
    @Query('taskType') taskType?: string,
    @Query('modelName') modelName?: string,
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.aiObservability.getProfitability({
      from,
      to,
      groupBy,
      taskType,
      modelName,
      tenantId,
      userId,
    });
  }

  @Get('ai/costs/by-tenant')
  getAiCostsByEntity(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.aiObservability.getCostsByEntityPaginated({
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('ai/provider-billing')
  listProviderBilling(@Query('limit') limit?: string) {
    return this.providerBilling.listSnapshots(limit ? Number(limit) : undefined);
  }

  @Post('ai/provider-billing/reconcile')
  reconcileProviderBilling(@Query('date') date?: string) {
    const target = date ? new Date(date) : new Date(Date.now() - 86400000);
    return this.providerBilling.reconcileDay(target);
  }

  @Get('ai/costs/entity-breakdown')
  getEntityCostBreakdown(
    @Query('entityId') entityId: string,
    @Query('entityType') entityType: 'tenant' | 'consumer',
  ) {
    return this.adminService.getEntityCostBreakdown(entityId, entityType);
  }

  @Get('credit-rates')
  listCreditRates() {
    return this.adminService.listCreditRates();
  }

  @Patch('credit-rates/:id')
  updateCreditRate(
    @Param('id') id: string,
    @Body() body: { baseCredits?: number; markupMultiplier?: number; enabled?: boolean },
  ) {
    return this.adminService.updateCreditRate(id, body);
  }

  @Get('ai-model-costs')
  listAiModelCosts() {
    return this.adminService.listAiModelCosts();
  }

  @Patch('ai-model-costs/:id')
  updateAiModelCost(
    @Param('id') id: string,
    @Body() body: { inputCostPer1M?: number; outputCostPer1M?: number; isActive?: boolean },
  ) {
    return this.adminService.updateAiModelCost(id, body);
  }

  @Post('ai-model-costs/sync-from-registry')
  syncAiModelCostsFromRegistry() {
    return this.modelCostSync.syncFromRegistry();
  }

  @Get('training-datasets')
  listTrainingDatasets() {
    return this.adminService.listTrainingDatasets();
  }

  @Post('training-datasets')
  createTrainingDataset(
    @Body() body: { name: string; datasetType: string; countryCode?: string; description?: string },
  ) {
    return this.adminService.createTrainingDataset(body);
  }

  @Patch('training-datasets/:id')
  updateTrainingDatasetStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.adminService.updateTrainingDatasetStatus(id, status);
  }

  @Get('training-datasets/:id/items')
  listTrainingDatasetItems(@Param('id') id: string) {
    return this.adminService.listTrainingDatasetItems(id);
  }

  @Patch('training-datasets/:datasetId/items/:itemId')
  updateTrainingDatasetItem(
    @Param('datasetId') datasetId: string,
    @Param('itemId') itemId: string,
    @Body('approvalStatus') approvalStatus: 'APPROVED' | 'REVOKED',
  ) {
    return this.adminService.updateTrainingDatasetItem(datasetId, itemId, approvalStatus);
  }

  @Get('presence')
  getPresence() {
    return this.adminService.getPresenceSnapshot();
  }

  @Get('legal-sources')
  listLegalSources() {
    return this.adminService.listLegalSources();
  }

  @Post('legal-sources/ingest')
  ingestLegalAuthority(
    @Body()
    body: {
      countryCode: string;
      title: string;
      authorityType: string;
      sourceName: string;
      citation?: string;
      jurisdiction?: string;
      court?: string;
      courtLevel?: string;
      sourceUrl?: string;
      sourceLicense?: string;
      fullText?: string;
      summary?: string;
      holding?: string;
      decisionDate?: string;
      topics?: string[];
      practiceAreas?: string[];
      legalSourceId?: string;
    },
  ) {
    return this.adminService.ingestLegalAuthority(body);
  }

  @Get('audit/logs')
  listAuditLogs(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'action' | 'entityType',
    @Query('sortDir') sortDir?: 'asc' | 'desc',
  ) {
    return this.adminService.listAuditLogs({
      action,
      entityType,
      entityId,
      userId,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      sortBy,
      sortDir,
    });
  }

  @Get('costs/summary')
  getCostsSummary() {
    return this.adminService.getUnitEconomicsSummary();
  }

  // ── Referrals — SUPER_ADMIN only ────────────────────────────────────────────

  @Get('review-requests')
  listAllReviewRequests(
    @Query('status') status?: string,
    @Query('countryCode') countryCode?: string,
  ) {
    return this.adminService.listAllReviewRequests({ status, countryCode });
  }

  @Get('referrals')
  listReferrals(
    @Query('status') status?: string,
    @Query('referrerUserId') referrerUserId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminService.listReferrals({
      status,
      referrerUserId,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('referrals/stats')
  getReferralStats() {
    return this.adminService.getReferralStats();
  }

  // ── Lawyer prospects (outreach directory) ───────────────────────────────────

  @Get('lawyer-prospects')
  listLawyerProspects(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('source') source?: string,
    @Query('hasEmail') hasEmail?: string,
    @Query('hasPhone') hasPhone?: string,
    @Query('hasWhatsapp') hasWhatsapp?: string,
    @Query('whatsappConfidence') whatsappConfidence?: string,
    @Query('lawyerVerified') lawyerVerified?: string,
    @Query('outreachStatus') outreachStatus?: string,
    @Query('isTest') isTest?: string,
    @Query('q') q?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.lawyerProspectsService.list({
      country,
      state,
      city,
      source,
      hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
      hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
      hasWhatsapp:
        hasWhatsapp === 'true' ? true : hasWhatsapp === 'false' ? false : undefined,
      whatsappConfidence,
      lawyerVerified:
        lawyerVerified === 'true' ? true : lawyerVerified === 'false' ? false : undefined,
      outreachStatus,
      isTest: isTest === 'true' ? true : isTest === 'false' ? false : undefined,
      q,
      sortBy,
      sortDir,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('lawyer-prospects')
  createLawyerProspect(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateLawyerProspectDto,
  ) {
    return this.lawyerProspectsService.createManualProspect(dto, user.id);
  }

  @Get('lawyer-prospects/stats')
  getLawyerProspectStats(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('source') source?: string,
    @Query('hasEmail') hasEmail?: string,
    @Query('hasPhone') hasPhone?: string,
    @Query('hasWhatsapp') hasWhatsapp?: string,
    @Query('whatsappConfidence') whatsappConfidence?: string,
    @Query('lawyerVerified') lawyerVerified?: string,
    @Query('outreachStatus') outreachStatus?: string,
    @Query('q') q?: string,
  ) {
    return this.lawyerProspectsService.getStats({
      country,
      state,
      city,
      source,
      hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
      hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
      hasWhatsapp:
        hasWhatsapp === 'true' ? true : hasWhatsapp === 'false' ? false : undefined,
      whatsappConfidence,
      lawyerVerified:
        lawyerVerified === 'true' ? true : lawyerVerified === 'false' ? false : undefined,
      outreachStatus,
      q,
    });
  }

  @Get('lawyer-prospects/cities')
  getLawyerProspectCities(@Query('country') country?: string) {
    return this.lawyerProspectsService.getCitiesForCountry(country);
  }

  @Get('lawyer-prospects/export')
  @Header('Content-Type', 'text/csv')
  exportLawyerProspects(
    @Query('country') country?: string,
    @Query('state') state?: string,
    @Query('city') city?: string,
    @Query('source') source?: string,
    @Query('hasEmail') hasEmail?: string,
    @Query('hasPhone') hasPhone?: string,
    @Query('hasWhatsapp') hasWhatsapp?: string,
    @Query('whatsappConfidence') whatsappConfidence?: string,
    @Query('lawyerVerified') lawyerVerified?: string,
    @Query('outreachStatus') outreachStatus?: string,
    @Query('q') q?: string,
  ) {
    return this.lawyerProspectsService.exportCsv({
      country,
      state,
      city,
      source,
      hasEmail: hasEmail === 'true' ? true : hasEmail === 'false' ? false : undefined,
      hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
      hasWhatsapp:
        hasWhatsapp === 'true' ? true : hasWhatsapp === 'false' ? false : undefined,
      whatsappConfidence,
      lawyerVerified:
        lawyerVerified === 'true' ? true : lawyerVerified === 'false' ? false : undefined,
      outreachStatus,
      q,
    });
  }

  @Post('lawyer-prospects/import')
  @UseInterceptors(FileInterceptor('file'))
  importLawyerProspects(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('batchLabel') batchLabel?: string,
    @Body('sourceSummary') sourceSummary?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    return this.lawyerProspectsService.importCsv(
      file.buffer,
      batchLabel || 'admin-upload',
      sourceSummary,
      user.id,
    );
  }

  @Get('lawyer-prospects/google-places/locations')
  getGooglePlacesLocations() {
    return this.googlePlacesProspectService.getLocationTree();
  }

  @Get('lawyer-prospects/google-places/test')
  testGooglePlacesApi(
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
  ) {
    return this.googlePlacesProspectService.testApiKey(
      city?.trim() || 'Ahmedabad',
      state?.trim() || 'Gujarat',
      country?.trim() || 'India',
    );
  }

  @Get('lawyer-prospects/google-places/compare')
  compareGooglePlacesApi(
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    return this.googlePlacesProspectService.compareApiApproaches(
      city?.trim() || 'Ahmedabad',
      state?.trim() || 'Gujarat',
      country?.trim() || 'India',
      limit ? Math.min(Number(limit), 100) : 100,
    );
  }

  @Post('lawyer-prospects/scrape/google-places')
  startGooglePlacesScrape(
    @CurrentUser() user: RequestUser,
    @Body() body: { country?: string; state?: string; city?: string; mode?: string },
  ) {
    const country = body?.country?.trim();
    const state = body?.state?.trim();
    const city = body?.city?.trim();
    const scrapeMode = body?.mode === 'enrichment' ? 'enrichment' : 'full';
    if (!country || !state || !city) {
      throw new BadRequestException('country, state, and city are required');
    }
    return this.lawyerProspectsService.startGooglePlacesScrape(
      country,
      state,
      city,
      user.id,
      scrapeMode,
    );
  }

  @Get('lawyer-prospects/import-runs/:id')
  getLawyerProspectImportRun(@Param('id') id: string) {
    return this.lawyerProspectsService.getImportRun(id);
  }

  @Post('lawyer-prospects/import-runs/:id/cancel')
  cancelLawyerProspectImportRun(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.lawyerProspectsService.cancelGooglePlacesScrape(id, user.id);
  }

  @Patch('lawyer-prospects/:id')
  updateLawyerProspectOutreach(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('outreachStatus') outreachStatus: string,
  ) {
    return this.lawyerProspectsService.updateOutreachStatus(
      id,
      outreachStatus,
      user.id,
    );
  }

  @Delete('lawyer-prospects/:id')
  deleteLawyerProspect(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.lawyerProspectsService.deleteProspect(id, user.id);
  }

  // ── Demo requests (inbound sales) ───────────────────────────────────────────

  @Get('demo-requests')
  listDemoRequests(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.demoRequestsService.list({
      status,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('demo-requests/stats')
  getDemoRequestStats() {
    return this.demoRequestsService.getStats();
  }

  @Patch('demo-requests/:id')
  updateDemoRequest(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('adminNotes') adminNotes?: string,
  ) {
    return this.demoRequestsService.updateStatus(id, status, adminNotes);
  }

  // ── Credit management ────────────────────────────────────────────────────────

  /**
   * POST /admin/tenants/:tenantId/credits/reset
   * Wipes the credit ledger for a tenant and resets to the provided credit amount,
   * starting a fresh 30-day billing cycle from today.
   * Body: { credits: number }
   */
  @Post('tenants/:tenantId/credits/reset')
  resetTenantCredits(
    @CurrentUser() admin: RequestUser,
    @Param('tenantId') tenantId: string,
    @Body('credits') credits: number,
  ) {
    if (!credits || credits <= 0) {
      throw new BadRequestException('credits must be a positive number');
    }
    return this.adminService.resetTenantCredits(tenantId, Number(credits), admin.id);
  }

  /**
   * POST /admin/users/:userId/credits/reset
   * Wipes the credit ledger for a consumer user and resets to the provided amount.
   * Body: { credits: number }
   */
  @Post('users/:userId/credits/reset')
  resetConsumerCredits(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body('credits') credits: number,
  ) {
    if (!credits || credits <= 0) {
      throw new BadRequestException('credits must be a positive number');
    }
    return this.adminService.resetConsumerCredits(userId, Number(credits), admin.id);
  }

  // ── Research Accuracy Review — Super Admin only ──────────────────────────────

  /**
   * GET /admin/research-corrections
   * Lists section-correction signals for review.
   * Defaults to status=pending; pass ?status=approved or ?status=rejected for others.
   */
  @Get('research-corrections')
  listResearchCorrections(
    @Query('status') status?: string,
    @Query('countryCode') countryCode?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.researchCorrection.listPendingSignals({
      status: status ?? 'pending',
      countryCode,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * GET /admin/research-corrections/:id
   * Returns a single correction signal with full evidence.
   */
  @Get('research-corrections/:id')
  getResearchCorrection(@Param('id') id: string) {
    return this.researchCorrection.getSignal(id);
  }

  /**
   * PATCH /admin/research-corrections/:id/approve
   * Approves the correction — it will influence future research immediately.
   */
  @Patch('research-corrections/:id/approve')
  approveResearchCorrection(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.researchCorrection.approveSignal(id, admin.id, reviewNotes);
  }

  /**
   * PATCH /admin/research-corrections/:id/reject
   * Rejects the correction — it will not influence future research.
   */
  @Patch('research-corrections/:id/reject')
  rejectResearchCorrection(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.researchCorrection.rejectSignal(id, admin.id, reviewNotes);
  }

  // ── Unmatched Section Finder queries ───────────────────────────────────────

  @Get('unmatched-sections')
  listUnmatchedSections(
    @Query('status') status?: string,
    @Query('countryCode') countryCode?: string,
    @Query('sort') sort?: 'searchCount' | 'lastSearchedAt',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.unmatchedSectionsService.list({
      status,
      countryCode,
      sort,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('unmatched-sections/stats')
  getUnmatchedSectionStats() {
    return this.unmatchedSectionsService.getStats();
  }

  @Patch('unmatched-sections/:id')
  updateUnmatchedSection(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      resolvedNote?: string;
      resolvedAuthorityId?: string;
    },
  ) {
    return this.unmatchedSectionsService.updateStatus(id, {
      ...body,
      resolvedByUserId: admin.id,
    });
  }

  @Post('unmatched-sections/:id/trigger-ingest')
  triggerUnmatchedSectionIngest(@Param('id') id: string) {
    return this.unmatchedSectionsService.triggerIngest(id);
  }

  // ── Research retrieval gaps and corpus health ─────────────────────────────

  @Get('retrieval-gaps')
  listRetrievalGaps(
    @Query('status') status?: string,
    @Query('countryCode') countryCode?: string,
    @Query('gapType') gapType?: string,
    @Query('legalDomain') legalDomain?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.retrievalGaps.list({
      status,
      countryCode,
      gapType,
      legalDomain,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('retrieval-gaps/stats')
  getRetrievalGapStats() {
    return this.retrievalGaps.getStats();
  }

  @Patch('retrieval-gaps/:id')
  updateRetrievalGap(
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      resolvedAuthorityId?: string;
      resolvedNote?: string;
    },
  ) {
    return this.retrievalGaps.update(id, body);
  }

  @Post('retrieval-gaps/:id/trigger-ingest')
  triggerRetrievalGapIngest(@Param('id') id: string) {
    return this.retrievalGaps.triggerIngest(id);
  }

  @Get('corpus-health')
  getCorpusHealth(@Query('countryCode') countryCode?: string) {
    return this.retrievalGaps.getCorpusHealth(countryCode);
  }

  // ─── WhatsApp Campaigns ───────────────────────────────────────────────────

  @Get('whatsapp-templates')
  listWhatsappTemplates() {
    return this.whatsappOutreach.getTemplates();
  }

  @Get('whatsapp-diagnostics')
  getWhatsappDiagnostics() {
    return this.whatsappOutreach.getConfigDiagnostics();
  }

  @Post('whatsapp-campaigns')
  createWhatsappCampaign(@Body() dto: CreateCampaignDto) {
    return this.whatsappOutreach.createCampaign(dto);
  }

  @Get('whatsapp-campaigns')
  listWhatsappCampaigns() {
    return this.whatsappOutreach.listCampaigns();
  }

  @Get('whatsapp-campaigns/:id')
  getWhatsappCampaign(@Param('id') id: string) {
    return this.whatsappOutreach.getCampaignDetail(id);
  }

  @Get('whatsapp-campaigns/:id/stats')
  getWhatsappCampaignStats(@Param('id') id: string) {
    return this.whatsappOutreach.getCampaignStats(id);
  }

  @Patch('whatsapp-campaigns/:id')
  updateWhatsappCampaign(
    @Param('id') id: string,
    @Body() body: { action: 'pause' | 'resume' },
  ) {
    if (body.action === 'pause') return this.whatsappOutreach.pauseCampaign(id);
    if (body.action === 'resume') return this.whatsappOutreach.resumeCampaign(id);
  }

  @Delete('whatsapp-campaigns/:id')
  deleteWhatsappCampaign(@Param('id') id: string) {
    return this.whatsappOutreach.deleteCampaign(id);
  }

  // ─── Platform Accounting ──────────────────────────────────────────────────

  @Get('accounting/summary')
  getAccountingSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.platformAccounting.getAccountingSummary(from, to);
  }

  @Get('accounting/revenue')
  getAccountingRevenue(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('source') source?: string,
    @Query('country') country?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platformAccounting.listRevenue({
      from,
      to,
      source,
      country,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('accounting/revenue/summary')
  getRevenueSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.platformAccounting.getRevenueSummary(from, to);
  }

  @Get('accounting/expenses')
  getAccountingExpenses(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
  ) {
    return this.platformAccounting.listExpenses({ from, to, category });
  }

  @Post('accounting/expenses')
  createAccountingExpense(
    @CurrentUser() admin: RequestUser,
    @Body() dto: CreatePlatformExpenseDto,
  ) {
    if (!dto.description || !dto.amount || !dto.currency || !dto.expenseDate) {
      throw new BadRequestException('description, amount, currency and expenseDate are required');
    }
    return this.platformAccounting.createExpense(admin.id, {
      ...dto,
      expenseDate: new Date(dto.expenseDate),
    });
  }

  @Patch('accounting/expenses/:id')
  updateAccountingExpense(
    @Param('id') id: string,
    @Body() dto: UpdatePlatformExpenseDto,
  ) {
    return this.platformAccounting.updateExpense(id, {
      ...dto,
      expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
    });
  }

  @Delete('accounting/expenses/:id')
  deleteAccountingExpense(@Param('id') id: string) {
    return this.platformAccounting.deleteExpense(id);
  }

  @Get('accounting/taxes')
  getAccountingTaxes(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('country') country?: string,
  ) {
    return this.platformAccounting.getTaxSummary({ from, to, country });
  }
}
