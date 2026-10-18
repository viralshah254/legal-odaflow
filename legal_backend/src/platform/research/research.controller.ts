import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { ResearchWorkflowService } from './research-workflow.service';
import { CreateResearchWorkflowDto, LegalRequestContext } from './research.types';

@Controller('research/workflows')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ResearchController {
  constructor(private readonly researchService: ResearchWorkflowService) {}

  @Post()
  async createResearchWorkflow(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateResearchWorkflowDto,
  ) {
    const workspace = await this.researchService.createWorkspace(tenantId, user.id, dto);

    const context: LegalRequestContext = {
      requestId: `req-${Date.now()}`,
      tenantId,
      userId: user.id,
      locale: 'en',
      timezone: 'UTC',
      countryCode: dto.jurisdiction,
      matterId: dto.matterId,
      feature: 'research',
      riskLevel: 'medium',
    };

    const result = await this.researchService.runResearch(workspace.id, tenantId, context);
    return {
      workspace: await this.researchService.getWorkspace(workspace.id, tenantId, user.id),
      result,
    };
  }

  @Get()
  listWorkflows(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
  ) {
    return this.researchService.listWorkspaces(tenantId, user.id, { matterId, status });
  }

  @Get(':id')
  getWorkflow(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.researchService.getWorkspace(id, tenantId, user.id);
  }

  @Get(':id/results')
  async getResults(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    const workspace = await this.researchService.getWorkspace(id, tenantId, user.id);
    return { result: workspace.result, confidence: workspace.confidence };
  }

  @Post(':id/clarifications')
  async addClarification(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { clarification: string },
  ) {
    const workspace = await this.researchService.getWorkspace(id, tenantId, user.id);

    const context: LegalRequestContext = {
      requestId: `req-${Date.now()}`,
      tenantId,
      userId: user.id,
      locale: 'en',
      timezone: 'UTC',
      feature: 'research',
      riskLevel: 'medium',
    };

    if (body.clarification?.trim()) {
      await this.researchService.appendClarification(id, tenantId, user.id, body.clarification.trim());
    }
    const result = await this.researchService.runResearch(workspace.id, tenantId, context);
    return {
      workspace: await this.researchService.getWorkspace(id, tenantId, user.id),
      result,
    };
  }

  @Post(':id/save-to-matter')
  saveToMatter(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { matterId: string; expectedRevision: number },
  ) {
    return this.researchService.saveToMatter(
      id,
      tenantId,
      user.id,
      body.matterId,
      body.expectedRevision,
    );
  }
}
