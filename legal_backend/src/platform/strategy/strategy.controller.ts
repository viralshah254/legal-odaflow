import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { TenantGuard } from '@/common/guards/tenant.guard'
import { TenantId } from '@/common/decorators/tenant-id.decorator'
import { CurrentUser } from '@/common/decorators/current-user.decorator'
import type { RequestUser } from '@/common/types/request-user.interface'
import { StrategyService, BuildStrategyDto } from './strategy.service'

class BuildStrategyBody implements BuildStrategyDto {
  strategyType!: BuildStrategyDto['strategyType']
  objective!: string
  title?: string
  workflowId?: string
}

class RefineStrategyBody {
  feedback!: string
}

class ApproveStrategyBody {
  approvedBy?: string
}

@UseGuards(TenantGuard)
@Controller('matters/:matterId/strategies')
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Post()
  buildStrategy(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
    @Body() dto: BuildStrategyBody,
  ) {
    return this.strategyService.buildStrategy(tenantId, matterId, dto)
  }

  @Get()
  getStrategies(
    @TenantId() tenantId: string,
    @Param('matterId') matterId: string,
  ) {
    return this.strategyService.getStrategies(matterId, tenantId)
  }

  @Get(':id')
  getStrategy(
    @TenantId() tenantId: string,
    @Param('matterId') _matterId: string,
    @Param('id') id: string,
  ) {
    return this.strategyService.getStrategy(id, tenantId)
  }

  @Patch(':id')
  refineStrategy(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: RefineStrategyBody,
  ) {
    return this.strategyService.refineStrategy(id, tenantId, body.feedback)
  }

  @Post(':id/approve')
  approveStrategy(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: ApproveStrategyBody,
  ) {
    return this.strategyService.approveStrategy(id, tenantId, body.approvedBy ?? user.id)
  }
}
