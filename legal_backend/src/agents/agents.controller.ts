import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { TenantId } from '@/common/decorators/tenant-id.decorator';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { RequestUser } from '@/common/types/request-user.interface';
import { AgentsService } from './agents.service';

@Controller('agents')
@UseGuards(TenantGuard)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  listAgents() {
    return this.agentsService.listAgents();
  }

  @Get('recipes')
  listRecipes() {
    return this.agentsService.listRecipes();
  }

  @Get('jobs')
  listJobs(
    @CurrentUser() user: RequestUser,
    @TenantId() tenantId: string | undefined,
    @Query('limit') limit?: string,
  ) {
    return this.agentsService.listJobsForUser(
      user.id,
      tenantId,
      limit ? Number(limit) : 25,
    );
  }

  @Get('jobs/:jobId')
  getJob(@CurrentUser() user: RequestUser, @Param('jobId') jobId: string) {
    return this.agentsService.getJob(jobId, user.id);
  }
}
