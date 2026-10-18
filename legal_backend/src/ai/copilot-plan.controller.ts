import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import {
  CopilotPlanService,
  CreateCopilotPlanDto,
  UpdateCopilotPlanStepDto,
} from './copilot-plan.service';

@Controller('ai/copilot/plans')
@UseGuards(TenantGuard)
export class CopilotPlanController {
  constructor(private readonly copilotPlanService: CopilotPlanService) {}

  @Get()
  list(@TenantId() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.copilotPlanService.listPlans(tenantId, user.id);
  }

  @Get(':planId')
  get(@TenantId() tenantId: string, @Param('planId') planId: string) {
    return this.copilotPlanService.getPlan(tenantId, planId);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCopilotPlanDto,
  ) {
    return this.copilotPlanService.createPlan(tenantId, user.id, dto);
  }

  @Patch(':planId/steps')
  updateSteps(
    @TenantId() tenantId: string,
    @Param('planId') planId: string,
    @Body() body: { steps: UpdateCopilotPlanStepDto[] },
  ) {
    return this.copilotPlanService.updatePlanSteps(tenantId, planId, body.steps);
  }

  @Post(':planId/execute')
  execute(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Param('planId') planId: string,
  ) {
    return this.copilotPlanService.executePlan(tenantId, user.id, planId);
  }
}
