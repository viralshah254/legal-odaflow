import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';
import { DraftOrchestrationService } from './draft-orchestration.service';
import type {
  CreateDraftWorkspaceDto,
  ExportDraftDto,
  RepairRequestDto,
} from './drafting.types';

@Controller('drafting/workspaces')
@UseGuards(TenantGuard)
export class DraftController {
  private readonly logger = new Logger(DraftController.name);

  constructor(private readonly orchestration: DraftOrchestrationService) {}

  /**
   * POST /drafting/workspaces
   * Create a new draft workspace.
   */
  @Post()
  createWorkspace(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDraftWorkspaceDto,
  ) {
    return this.orchestration.createWorkspace(tenantId, user.id, dto);
  }

  /**
   * GET /drafting/workspaces
   * List all workspaces for the current tenant/user.
   */
  @Get()
  listWorkspaces(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orchestration.listWorkspaces(
      tenantId,
      user.id,
      skip ? Number(skip) : 0,
      take ? Number(take) : 20,
    );
  }

  /**
   * GET /drafting/workspaces/:id
   * Get a workspace with its sections.
   */
  @Get(':id')
  getWorkspace(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.getWorkspace(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/procedural-check
   * Run procedural gate checks on the workspace.
   */
  @Post(':id/procedural-check')
  runProcedural(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.runProcedural(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/plan
   * Build the legal plan and document outline (sections).
   */
  @Post(':id/plan')
  buildPlan(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.buildPlanAndOutline(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/generate
   * Generate content for all sections.
   */
  @Post(':id/generate')
  generateAllSections(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.generateAllSections(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/sections/:sId/regenerate
   * Regenerate content for a single section.
   */
  @Post(':id/sections/:sId/regenerate')
  regenerateSection(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('sId') sId: string,
  ) {
    return this.orchestration.generateSection(id, sId, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/verify
   * Run verification engine across all sections.
   */
  @Post(':id/verify')
  verifySections(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.verifySections(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/adversarial-review
   * Run opposing counsel + judge adversarial review (high/critical risk only).
   */
  @Post(':id/adversarial-review')
  runAdversarialReview(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.runAdversarialReview(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/repair
   * Repair sections with failed verification findings.
   * Body: { findingIds?: string[] } — omit to repair all failed sections.
   */
  @Post(':id/repair')
  repairSections(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: RepairRequestDto,
  ) {
    return this.orchestration.repairSections(id, tenantId, dto?.findingIds);
  }

  /**
   * GET /drafting/workspaces/:id/filing-readiness
   * Get filing readiness report for the workspace.
   */
  @Get(':id/filing-readiness')
  getFilingReadiness(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.getFilingReadiness(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/finalize
   * Mark the workspace as ready for export.
   */
  @Post(':id/finalize')
  finalize(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.orchestration.finalize(id, tenantId);
  }

  /**
   * POST /drafting/workspaces/:id/export
   * Export the draft in PDF or DOCX format.
   * Body: { format: 'pdf' | 'docx' }
   */
  @Post(':id/export')
  exportDraft(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ExportDraftDto,
  ) {
    return this.orchestration.export(id, tenantId, dto?.format ?? 'pdf');
  }
}
