import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { WorkflowsService, WorkflowStatus } from './workflows.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { RequestUser } from '@/common/types/request-user.interface';

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  /**
   * GET /workflows
   * List workflows for the current tenant with optional filtering and pagination.
   */
  @Get()
  @ApiOperation({ summary: 'List workflows (paginated, filterable by feature and status)' })
  @ApiQuery({ name: 'feature', required: false, description: 'Filter by feature (research, drafting, etc.)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by workflow status' })
  @ApiQuery({ name: 'matterId', required: false, description: 'Filter by matter ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  async listWorkflows(
    @TenantId() tenantId: string,
    @Query('feature') feature?: string,
    @Query('status') status?: WorkflowStatus,
    @Query('matterId') matterId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const safeLimit = Math.min(limit, 100);
    const result = await this.workflowsService.list({
      tenantId,
      feature,
      status,
      matterId,
      page,
      limit: safeLimit,
    });

    return {
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit: safeLimit,
        totalPages: Math.ceil(result.total / safeLimit),
      },
    };
  }

  /**
   * GET /workflows/:id
   * Fetch a single workflow by ID, tenant-scoped.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow by ID' })
  async getWorkflow(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.workflowsService.findOne(id, tenantId);
  }

  /**
   * POST /workflows/:id/cancellations
   * Cancel a workflow that is in a cancellable state (QUEUED, RUNNING, WAITING_FOR_INPUT).
   */
  @Post(':id/cancellations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a workflow' })
  async cancelWorkflow(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowsService.cancel(id, tenantId, user.id);
  }

  /**
   * POST /workflows/:id/retries
   * Retry a workflow that is in a retryable state (FAILED, PARTIAL).
   */
  @Post(':id/retries')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed or partial workflow' })
  async retryWorkflow(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.workflowsService.retry(id, tenantId);
  }

  /**
   * POST /workflows/:id/stages
   * Add a new stage to an existing workflow. Typically called by internal services.
   */
  @Post(':id/stages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a stage to a workflow (internal)' })
  async addStage(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { stage: string; metadata?: Record<string, unknown> },
  ) {
    await this.workflowsService.findOne(id, tenantId);
    return this.workflowsService.addStage(id, body.stage, body.metadata);
  }
}
