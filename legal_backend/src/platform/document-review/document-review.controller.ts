import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import type { RequestUser } from '@/common/types/request-user.interface';
import {
  DocumentReviewOrchestrationService,
  CreateReviewWorkspaceDto,
} from './document-review-orchestration.service';
import {
  ContractManagementService,
  CreateContractDto,
  CreateApprovalDto,
} from './contract-management.service';
import { PlaybookComparisonService } from './playbook-comparison.service';

// ─── Inline DTOs ──────────────────────────────────────────────────────────────

class SaveToContractDto {
  contractId!: string;
}

class UpdateContractStatusDto {
  status!: string;
}

class PlaybookCreateDto {
  tenantId?: string;
  name!: string;
  contractType!: string;
  clauseType!: string;
  description?: string;
  preferredText?: string;
  acceptableText?: string;
  prohibitedPatterns?: string[];
  flaggedPatterns?: string[];
  negotiationGuide?: string;
  riskLevel?: string;
  jurisdiction?: string;
}

// ─── Document Review Controller ────────────────────────────────────────────────

@Controller()
@UseGuards(TenantGuard)
export class DocumentReviewController {
  private readonly logger = new Logger(DocumentReviewController.name);

  constructor(
    private readonly orchestration: DocumentReviewOrchestrationService,
    private readonly contractMgmt: ContractManagementService,
    private readonly playbookSvc: PlaybookComparisonService,
  ) {}

  // ─── Document review workspaces ──────────────────────────────────────────

  /** POST /document-review/workspaces */
  @Post('document-review/workspaces')
  createWorkspace(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReviewWorkspaceDto,
  ) {
    return this.orchestration.createWorkspace(tenantId, user.id, dto);
  }

  /** GET /document-review/workspaces */
  @Get('document-review/workspaces')
  listWorkspaces(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.orchestration.listWorkspaces(tenantId, {
      matterId,
      status,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
    });
  }

  /** GET /document-review/workspaces/:id */
  @Get('document-review/workspaces/:id')
  getWorkspace(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.orchestration.getWorkspace(id, tenantId);
  }

  /** POST /document-review/workspaces/:id/run */
  @Post('document-review/workspaces/:id/run')
  runReview(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.orchestration.runReview(id, tenantId);
  }

  /** POST /document-review/run-inline — Word add-in: review document text in one call */
  @Post('document-review/run-inline')
  runInlineReview(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      rawText: string;
      matterId?: string;
      title?: string;
      documentType?: string;
    },
  ) {
    return this.orchestration.runInlineReview(tenantId, user.id, body);
  }

  /** POST /document-review/playbook-compare-inline — Word add-in playbook dashboard */
  @Post('document-review/playbook-compare-inline')
  async comparePlaybooksInline(
    @TenantId() tenantId: string,
    @Body() body: { rawText: string; documentType?: string },
  ) {
    const results = await this.orchestration.comparePlaybooksForText(
      tenantId,
      body.rawText,
      body.documentType ?? 'contract',
    );
    return {
      results,
      summary: this.orchestration.summarizePlaybookResults(results),
    };
  }

  /** POST /document-review/workspaces/:id/redlines/export */
  @Post('document-review/workspaces/:id/redlines/export')
  exportRedlines(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.orchestration.exportRedlineOps(id, tenantId);
  }

  /** PATCH /contract-playbooks/:id */
  @Patch('contract-playbooks/:id')
  async updatePlaybook(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: Partial<PlaybookCreateDto>,
  ) {
    return this.playbookSvc.updatePlaybook(id, tenantId, dto);
  }

  /** DELETE /contract-playbooks/:id */
  @Delete('contract-playbooks/:id')
  deletePlaybook(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.playbookSvc.deletePlaybook(id, tenantId);
  }

  /** GET /document-review/workspaces/:id/findings */
  @Get('document-review/workspaces/:id/findings')
  async getFindings(@TenantId() tenantId: string, @Param('id') id: string) {
    const ws = await this.orchestration.getWorkspace(id, tenantId);
    return { findings: ws.findingsJson ?? [] };
  }

  /** GET /document-review/workspaces/:id/redlines */
  @Get('document-review/workspaces/:id/redlines')
  async getRedlines(@TenantId() tenantId: string, @Param('id') id: string) {
    const ws = await this.orchestration.getWorkspace(id, tenantId);
    return { redlines: ws.redlinesJson ?? [] };
  }

  /** GET /document-review/workspaces/:id/obligations */
  @Get('document-review/workspaces/:id/obligations')
  async getWorkspaceObligations(@TenantId() tenantId: string, @Param('id') id: string) {
    const ws = await this.orchestration.getWorkspace(id, tenantId);
    return { obligations: ws.obligationsJson ?? [] };
  }

  /** POST /document-review/workspaces/:id/save-to-contract */
  @Post('document-review/workspaces/:id/save-to-contract')
  saveObligations(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SaveToContractDto,
  ) {
    return this.orchestration.saveObligationsToContract(id, tenantId, dto.contractId);
  }

  // ─── Contracts ────────────────────────────────────────────────────────────

  /** POST /contracts */
  @Post('contracts')
  createContract(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contractMgmt.createContract(tenantId, user.id, dto);
  }

  /** GET /contracts */
  @Get('contracts')
  listContracts(
    @TenantId() tenantId: string,
    @Query('matterId') matterId?: string,
    @Query('contractType') contractType?: string,
    @Query('status') status?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.contractMgmt.listContracts(tenantId, {
      matterId,
      contractType,
      status,
      skip: skip ? Number(skip) : 0,
      take: take ? Number(take) : 20,
    });
  }

  /** GET /contracts/obligations/due-soon — must come before /:id */
  @Get('contracts/obligations/due-soon')
  getObligationsDueSoon(
    @TenantId() tenantId: string,
    @Query('daysAhead') daysAhead?: string,
  ) {
    return this.contractMgmt.getObligationsDueSoon(tenantId, daysAhead ? Number(daysAhead) : 30);
  }

  /** GET /contracts/:id */
  @Get('contracts/:id')
  getContract(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.contractMgmt.getContract(id, tenantId);
  }

  /** PATCH /contracts/:id/status */
  @Patch('contracts/:id/status')
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContractStatusDto,
  ) {
    return this.contractMgmt.updateStatus(id, tenantId, dto.status);
  }

  /** GET /contracts/:id/clauses */
  @Get('contracts/:id/clauses')
  async getClauses(@TenantId() tenantId: string, @Param('id') id: string) {
    const contract = await this.contractMgmt.getContract(id, tenantId);
    return { clauses: (contract as any).clauses ?? [] };
  }

  /** GET /contracts/:id/obligations */
  @Get('contracts/:id/obligations')
  async getContractObligations(@TenantId() tenantId: string, @Param('id') id: string) {
    const contract = await this.contractMgmt.getContract(id, tenantId);
    return { obligations: (contract as any).obligations ?? [] };
  }

  /** POST /contracts/:id/approvals */
  @Post('contracts/:id/approvals')
  createApproval(
    @TenantId() tenantId: string,
    @Param('id') contractId: string,
    @Body() dto: CreateApprovalDto,
  ) {
    return this.contractMgmt.createApprovalWorkflow(contractId, tenantId, dto);
  }

  /** POST /contracts/:id/approvals/:approvalId/approve */
  @Post('contracts/:id/approvals/:approvalId/approve')
  approveContract(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') contractId: string,
    @Param('approvalId') approvalId: string,
    @Body('notes') notes?: string,
  ) {
    return this.contractMgmt.approveContract(approvalId, contractId, tenantId, user.id, notes);
  }

  /** POST /contracts/:id/approvals/:approvalId/reject */
  @Post('contracts/:id/approvals/:approvalId/reject')
  rejectApproval(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('id') contractId: string,
    @Param('approvalId') approvalId: string,
    @Body('notes') notes: string,
  ) {
    return this.contractMgmt.rejectApproval(approvalId, contractId, tenantId, user.id, notes);
  }

  // ─── Contract Playbooks ───────────────────────────────────────────────────

  /** POST /contract-playbooks */
  @Post('contract-playbooks')
  async createPlaybook(@TenantId() tenantId: string, @Body() dto: PlaybookCreateDto) {
    return this.playbookSvc.createPlaybook({
      tenantId: dto.tenantId ?? tenantId,
      name: dto.name,
      contractType: dto.contractType,
      clauseType: dto.clauseType,
      description: dto.description,
      preferredText: dto.preferredText,
      acceptableText: dto.acceptableText,
      prohibitedPatterns: dto.prohibitedPatterns ?? [],
      flaggedPatterns: dto.flaggedPatterns ?? [],
      negotiationGuide: dto.negotiationGuide,
      riskLevel: dto.riskLevel ?? 'medium',
      jurisdiction: dto.jurisdiction,
    });
  }

  /** GET /contract-playbooks */
  @Get('contract-playbooks')
  listPlaybooks(
    @TenantId() tenantId: string,
    @Query('contractType') contractType?: string,
  ) {
    return this.playbookSvc.getApplicablePlaybooks(tenantId, contractType ?? '');
  }

  /** GET /contract-playbooks/:id */
  @Get('contract-playbooks/:id')
  getPlaybook(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.playbookSvc.getPlaybook(id, tenantId);
  }
}
