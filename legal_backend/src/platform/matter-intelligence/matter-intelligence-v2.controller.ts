import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { MatterFactService, AssertFactDto, FactFilter } from './matter-fact.service';
import { ContradictionDetectionService } from './contradiction-detection.service';
import { TimelineService, AddTimelineEventDto } from './timeline.service';
import { IssueTrackerService, CreateIssueDto, IssueElement } from './issue-tracker.service';
import { LegalMemoryService, AddMemoryRecordDto, RetrieveQuery, ListRecordsFilter } from './legal-memory.service';

@Controller()
@UseGuards(TenantGuard)
export class MatterIntelligenceV2Controller {
  constructor(
    private readonly facts: MatterFactService,
    private readonly contradictions: ContradictionDetectionService,
    private readonly timeline: TimelineService,
    private readonly issues: IssueTrackerService,
    private readonly memory: LegalMemoryService,
  ) {}

  // ─── Facts ───────────────────────────────────────────────────────────────────

  @Post('matters/:matterId/facts')
  assertFact(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Body() dto: AssertFactDto,
  ) {
    return this.facts.assertFact(matterId, tenantId, dto, user.id);
  }

  @Get('matters/:matterId/facts')
  getFacts(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Query('status') status?: string,
    @Query('factType') factType?: string,
  ) {
    const filter: FactFilter = {};
    if (status) filter.status = status;
    if (factType) filter.factType = factType;
    return this.facts.getFacts(matterId, tenantId, filter);
  }

  @Patch('matters/:matterId/facts/:id/status')
  updateFactStatus(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') matterId: string,
    @Param('id') factId: string,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.facts.updateFactStatus(
      factId,
      matterId,
      tenantId,
      body.status,
      body.reason,
      user.id,
    );
  }

  @Post('matters/:matterId/facts/:id/dispute')
  disputeFact(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') factId: string,
    @Body() body: { contestedBy: string; reason: string },
  ) {
    return this.facts.disputeFact(factId, matterId, tenantId, body.contestedBy, body.reason);
  }

  @Get('matters/:matterId/facts/:id/versions')
  getVersions(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') factId: string,
  ) {
    return this.facts.getAllVersions(factId, matterId, tenantId);
  }

  // ─── Contradictions ───────────────────────────────────────────────────────────

  @Post('matters/:matterId/contradictions/detect')
  detectContradictions(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.contradictions.detectContradictions(matterId, tenantId);
  }

  @Get('matters/:matterId/contradictions')
  getContradictions(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.contradictions.getContradictions(matterId, tenantId);
  }

  @Post('matters/:matterId/contradictions/:id/resolve')
  resolveContradiction(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('matterId') _matterId: string,
    @Param('id') contradictionId: string,
    @Body() body: { resolution: string },
  ) {
    return this.contradictions.resolveContradiction(
      contradictionId,
      tenantId,
      body.resolution,
      user.id,
    );
  }

  // ─── Timeline ─────────────────────────────────────────────────────────────────

  @Post('matter-intelligence/v2/matters/:matterId/legal-timeline')
  addTimelineEvent(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: AddTimelineEventDto,
  ) {
    return this.timeline.addEvent(matterId, tenantId, dto);
  }

  @Get('matter-intelligence/v2/matters/:matterId/legal-timeline')
  getTimeline(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.timeline.getTimeline(matterId, tenantId);
  }

  @Post('matters/:matterId/deadlines/extract')
  async extractDeadlines(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    const facts = await this.facts.getFacts(matterId, tenantId);
    return this.timeline.extractDeadlines(matterId, tenantId, facts);
  }

  @Get('matters/:matterId/deadlines')
  getDeadlines(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.timeline.getDeadlines(matterId, tenantId);
  }

  @Patch('matters/:matterId/deadlines/:id/status')
  updateDeadlineStatus(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') deadlineId: string,
    @Body() body: { status: string },
  ) {
    return this.timeline.updateDeadlineStatus(deadlineId, matterId, tenantId, body.status);
  }

  // ─── Issues ───────────────────────────────────────────────────────────────────

  @Post('matters/:matterId/issues')
  createIssue(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.issues.createIssue(matterId, tenantId, dto);
  }

  @Get('matters/:matterId/issues')
  getIssues(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.issues.getIssues(matterId, tenantId);
  }

  @Post('matters/:matterId/issues/:id/elements')
  mapElements(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') issueId: string,
    @Body() body: { elements: IssueElement[] },
  ) {
    return this.issues.mapElements(issueId, matterId, tenantId, body.elements);
  }

  @Patch('matters/:matterId/issues/:id/elements/:elementId/satisfaction')
  updateElementSatisfaction(
    @TenantId() tenantId: string,
    @Param('id') issueId: string,
    @Param('elementId') elementId: string,
    @Body() body: { satisfactionStatus: 'unsatisfied' | 'partially_satisfied' | 'satisfied'; evidenceIds: string[] },
  ) {
    return this.issues.updateElementSatisfaction(
      issueId,
      elementId,
      tenantId,
      body.satisfactionStatus,
      body.evidenceIds,
    );
  }

  @Get('matters/:matterId/issues/:id/status')
  getIssueStatus(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Param('id') issueId: string,
  ) {
    return this.issues.getIssueStatus(issueId, matterId, tenantId);
  }

  // ─── Legal Memory ─────────────────────────────────────────────────────────────

  @Get('legal-memory')
  listMemoryRecords(
    @TenantId() tenantId: string,
    @Query('scope') scope?: string,
    @Query('recordType') recordType?: string,
    @Query('approved') approved?: string,
    @Query('matterId') matterId?: string,
  ) {
    const filters: ListRecordsFilter = {};
    if (scope) filters.scope = scope;
    if (recordType) filters.recordType = recordType;
    if (approved !== undefined) filters.approved = approved === 'true';
    if (matterId) filters.matterId = matterId;
    return this.memory.listRecords(tenantId, filters);
  }

  @Post('legal-memory')
  addMemoryRecord(
    @TenantId() tenantId: string,
    @Body() dto: AddMemoryRecordDto,
  ) {
    return this.memory.addRecord(tenantId, dto);
  }

  @Post('legal-memory/retrieve')
  retrieveMemory(
    @TenantId() tenantId: string,
    @Body() query: RetrieveQuery,
  ) {
    return this.memory.retrieve(tenantId, query);
  }

  @Patch('legal-memory/:id/approve')
  approveMemoryRecord(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') recordId: string,
  ) {
    return this.memory.approveRecord(recordId, tenantId, user.id);
  }

  @Delete('legal-memory/:id')
  deleteMemoryRecord(
    @TenantId() tenantId: string,
    @Param('id') recordId: string,
  ) {
    return this.memory.deleteRecord(recordId, tenantId);
  }
}
