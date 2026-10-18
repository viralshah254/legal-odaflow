import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { TenantId } from '@/common/decorators/tenant-id.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import type { RequestUser } from '@/common/types/request-user.interface'
import { AgenticWorkflowService, CreateWorkflowDto } from './agentic-workflow.service'

class CreateWorkflowBody implements CreateWorkflowDto {
  name!: string
  description?: string
  workflowDsl!: Record<string, unknown>
  triggerType?: CreateWorkflowDto['triggerType']
  schedule?: string
  matterId?: string
}

@UseGuards(TenantGuard)
@Controller('agent-workflows')
export class AgenticWorkflowController {
  constructor(private readonly agenticService: AgenticWorkflowService) {}

  @Post()
  createWorkflow(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateWorkflowBody,
  ) {
    return this.agenticService.createWorkflow(tenantId, user.id, dto)
  }

  @Get()
  listWorkflows(@TenantId() tenantId: string) {
    return this.agenticService.listWorkflows(tenantId)
  }

  @Get(':id')
  getWorkflow(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.agenticService.getWorkflow(id, tenantId)
  }

  @Post(':id/activate')
  activate(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.agenticService.activateWorkflow(id, tenantId)
  }

  @Post(':id/pause')
  pause(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.agenticService.pauseWorkflow(id, tenantId)
  }

  @Post(':id/runs')
  runWorkflow(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agenticService.runWorkflow(id, tenantId, user.id)
  }

  @Get(':id/runs')
  getRuns(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.agenticService.getRuns(id, tenantId)
  }
}
